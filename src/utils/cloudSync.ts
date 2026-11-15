import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AppUser, CloudDriveFile, UserDevice } from '../types';
import { uploadFileToServer, generateVideoThumbnail, formatFileSize } from './fileUpload';
import { saveVideoToIndexedDB } from '../components/AllInOneVideoPlayer';
import { storeFileBlobLocally } from './idbStorage';

/**
 * Subscribe to all cloud_files belonging to the active ClSend account,
 * unifying primary UID, linked UIDs (e.g. linked Google UID), and verified/owned account email
 * so data always syncs seamlessly across different Google Chrome profiles & devices.
 */
export function subscribeUserCloudFiles(
  currentUser: AppUser | null | undefined,
  userProfile: UserDevice | null | undefined,
  onFiles: (files: CloudDriveFile[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!currentUser?.uid) {
    onFiles([]);
    return () => {};
  }

  const uidSet = new Set<string>([currentUser.uid]);
  if (Array.isArray(currentUser.linkedUids)) {
    currentUser.linkedUids.forEach((u) => {
      if (u && typeof u === 'string') uidSet.add(u);
    });
  }
  if (Array.isArray(userProfile?.linkedUids)) {
    userProfile.linkedUids.forEach((u) => {
      if (u && typeof u === 'string') uidSet.add(u);
    });
  }
  if (userProfile?.googleUid) {
    uidSet.add(userProfile.googleUid);
  }

  const emailSet = new Set<string>();
  const addCandidateEmail = (raw?: string | null) => {
    const clean = (raw || '').trim().toLowerCase();
    if (!clean) return;
    // Allow real emails (Google / verified / linked) or account-owned @cloudsend.local
    if (
      !clean.endsWith('@cloudsend.local') ||
      clean.startsWith(`${(userProfile?.username || currentUser.displayName || '').trim().toLowerCase().replace(/\s+/g, '_')}@`)
    ) {
      emailSet.add(clean);
    }
  };

  addCandidateEmail(currentUser.email);
  addCandidateEmail(userProfile?.email);
  addCandidateEmail(userProfile?.linkedEmail);

  const buckets = new Map<string, Map<string, CloudDriveFile>>();
  const unsubscribers: Array<() => void> = [];
  let isDisposed = false;
  let hasPrimaryResult = false;

  const emitMerged = () => {
    if (isDisposed || !hasPrimaryResult) return;
    const mergedMap = new Map<string, CloudDriveFile>();

    buckets.forEach((bucket) => {
      bucket.forEach((file, docId) => {
        const existing = mergedMap.get(docId);
        if (!existing) {
          mergedMap.set(docId, file);
        }
      });
    });

    const list = Array.from(mergedMap.values());
    list.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    onFiles(list);
  };

  const mapDoc = (docSnap: any): CloudDriveFile => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId || currentUser.uid,
      userEmail: data.userEmail,
      userName: data.userName,
      name: data.name || 'Không tên',
      size: Number(data.size) || 0,
      type: data.type || 'application/octet-stream',
      url: data.url || '',
      viewUrl: data.viewUrl || data.url || '',
      thumbnail: data.thumbnail || undefined,
      category: data.category || 'other',
      isFavorite: Boolean(data.isFavorite),
      createdAt:
        typeof data.createdAt === 'string'
          ? data.createdAt
          : data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      telegramFileId: data.telegramFileId,
      telegramBotToken: data.telegramBotToken,
    };
  };

  const subscribeBucket = (bucketKey: string, qRef: any, isPrimary = false) => {
    const unsub = onSnapshot(
      qRef,
      (snapshot: any) => {
        const bucket = new Map<string, CloudDriveFile>();
        snapshot.forEach((docSnap: any) => {
          bucket.set(docSnap.id, mapDoc(docSnap));
        });
        buckets.set(bucketKey, bucket);
        if (isPrimary) hasPrimaryResult = true;
        emitMerged();
      },
      (err: any) => {
        if (isPrimary) {
          hasPrimaryResult = true;
          if (onError) onError(err);
        } else {
          console.warn(`Secondary cloud sync listener (${bucketKey}) notice:`, err);
        }
      }
    );
    unsubscribers.push(unsub);
  };

  // 1. Primary subscription on currentUser.uid
  const uidList = Array.from(uidSet);
  subscribeBucket(
    `uid:${currentUser.uid}`,
    query(collection(db, 'cloud_files'), where('userId', '==', currentUser.uid)),
    true
  );

  // 2. Linked UIDs (e.g. from previous Google login linked to this ClSend account)
  uidList.slice(1, 6).forEach((linkedUid) => {
    subscribeBucket(
      `uid:${linkedUid}`,
      query(collection(db, 'cloud_files'), where('userId', '==', linkedUid)),
      false
    );
  });

  // 3. Matching account emails (both lowercase & original casing if different)
  const rawEmailCandidates = new Set<string>();
  emailSet.forEach((em) => rawEmailCandidates.add(em));
  if (currentUser.email && emailSet.has(currentUser.email.trim().toLowerCase())) {
    rawEmailCandidates.add(currentUser.email.trim());
  }
  if (userProfile?.linkedEmail && emailSet.has(userProfile.linkedEmail.trim().toLowerCase())) {
    rawEmailCandidates.add(userProfile.linkedEmail.trim());
  }

  Array.from(rawEmailCandidates)
    .slice(0, 4)
    .forEach((em) => {
      subscribeBucket(
        `email:${em}`,
        query(collection(db, 'cloud_files'), where('userEmail', '==', em)),
        false
      );
    });

  return () => {
    isDisposed = true;
    unsubscribers.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}

/**
 * Sync a video (from local File/Blob or server/web URL) to the user's Firestore Cloud Drive
 * so it persists across devices, browsers, and Google Chrome profiles.
 */
export async function syncVideoFileToCloud(params: {
  file?: File | Blob;
  url?: string;
  name: string;
  size?: number;
  mimeType?: string;
  user: AppUser;
  deviceName?: string;
}): Promise<CloudDriveFile | null> {
  const { file, url, name, size, mimeType, user, deviceName } = params;
  if (!user?.uid) return null;

  const cleanName = (name || `video_${Date.now()}.mp4`).trim();

  // Check if user already has an identical cloud_files doc (same url OR same name + size)
  try {
    const existingSnap = await getDocs(query(collection(db, 'cloud_files'), where('userId', '==', user.uid)));
    for (const d of existingSnap.docs) {
      const data = d.data();
      if (url && !url.startsWith('blob:') && !url.startsWith('data:') && (data.viewUrl === url || data.url === url)) {
        return { id: d.id, ...(data as any) } as CloudDriveFile;
      }
      if (data.name === cleanName && Number(data.size || 0) === Number(size || file?.size || 0) && data.url) {
        return { id: d.id, ...(data as any) } as CloudDriveFile;
      }
    }
  } catch {}

  let finalUrl = url && !url.startsWith('blob:') && !url.startsWith('data:') ? url : '';
  let finalViewUrl = finalUrl ? finalUrl.replace('/api/files/download/', '/api/files/view/') : '';
  let thumb: string | null = null;
  let resolvedSize = size || file?.size || 0;
  let resolvedType = mimeType || (file as File)?.type || 'video/mp4';

  // If we have a local File/Blob and no durable remote/server URL, upload it to the server
  if (file && !finalUrl) {
    const fileObj =
      file instanceof File
        ? file
        : new File([file], cleanName, { type: resolvedType, lastModified: Date.now() });

    const [uploaded, videoThumb] = await Promise.all([
      uploadFileToServer(fileObj),
      generateVideoThumbnail(fileObj).catch(() => ''),
    ]);

    finalUrl = uploaded.url;
    finalViewUrl = uploaded.viewUrl || uploaded.url;
    if (videoThumb && videoThumb.length < 700000) thumb = videoThumb;
    resolvedSize = uploaded.size || fileObj.size;
    resolvedType = uploaded.type || fileObj.type || 'video/mp4';
  }

  if (!finalUrl || finalUrl.startsWith('blob:') || finalUrl.length >= 700000) {
    return null;
  }

  const docId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const docData: CloudDriveFile = {
    id: docId,
    userId: user.uid,
    userEmail: (user.email || '').trim().toLowerCase(),
    userName: user.displayName || deviceName || 'Người dùng',
    name: cleanName,
    size: resolvedSize,
    type: resolvedType,
    url: finalUrl,
    viewUrl: finalViewUrl || finalUrl,
    thumbnail: thumb || undefined,
    category: 'video',
    isFavorite: false,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'cloud_files', docId), {
    ...docData,
    thumbnail: thumb || null,
  });

  if (file) {
    saveVideoToIndexedDB({
      id: docId,
      title: cleanName,
      blob: file,
      size: formatFileSize(resolvedSize),
    }).catch(() => {});
    storeFileBlobLocally(docId, file).catch(() => {});
    storeFileBlobLocally(cleanName, file).catch(() => {});
  }

  return docData;
}
