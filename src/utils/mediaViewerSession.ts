import { ChatMessage } from '../components/types';
import { isGifFile } from './fileUpload';
import { pickActiveLang } from '../context/LanguageContext';

export type MediaViewerSource = 'chat' | 'cloud';

export interface UnifiedMediaItem {
  id: string;
  name: string;
  title: string;
  src: string;
  downloadUrl?: string;
  thumbnail?: string | null;
  size?: number | string;
  type: 'video' | 'image';
  mimeType?: string;
  isGif?: boolean;
  file?: File | Blob;
  createdAt?: string;
  isLocal?: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  roomId?: string;
}

export interface RoomExtractedImage {
  id: string;
  url: string;
  backupSrc?: string;
  downloadUrl?: string;
  name: string;
  isGif: boolean;
  size?: number;
  sender: string;
  senderAvatar?: string | null;
  time: string;
}

export interface RoomExtractedVideo {
  id: string;
  url: string;
  downloadUrl?: string;
  poster?: string | null;
  name: string;
  size?: number;
  sender: string;
  senderAvatar?: string | null;
  time: string;
}

export const CHAT_MEDIA_STORAGE_KEY = 'clsend_player_chat_media';
export const CLOUD_MEDIA_STORAGE_KEY = 'clsend_player_cloud_media';

interface StoredChatSession {
  source: 'chat';
  roomId?: string;
  activeItem: UnifiedMediaItem;
  roomMedia?: UnifiedMediaItem[];
}

interface StoredCloudSession {
  source: 'cloud';
  activeItem: UnifiedMediaItem;
}

function sanitizeForSessionStorage(item: UnifiedMediaItem): UnifiedMediaItem {
  const { file, ...rest } = item;
  // Guard against storing huge base64 data URIs inside sessionStorage
  const safeThumb =
    rest.thumbnail && rest.thumbnail.startsWith('data:') && rest.thumbnail.length > 60_000
      ? null
      : rest.thumbnail;
  const safeSrc =
    rest.src && rest.src.startsWith('data:') && rest.src.length > 250_000
      ? ''
      : rest.src;
  return {
    ...rest,
    src: safeSrc,
    thumbnail: safeThumb ?? null,
  };
}

export function normalizeMediaViewUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  if (rawUrl.includes('/api/telegram/download')) {
    return rawUrl.includes('inline=true')
      ? rawUrl
      : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}inline=true`;
  }
  if (rawUrl.includes('/api/files/download/')) {
    return rawUrl.replace('/api/files/download/', '/api/files/view/');
  }
  return rawUrl;
}

export function normalizeMediaDownloadUrl(rawUrl?: string, fallbackSrc?: string): string {
  if (!rawUrl) return fallbackSrc || '';
  return rawUrl
    .replace('/api/files/view/', '/api/files/download/')
    .replace(/[?&]inline=true/g, '');
}

export function resolveMediaTimeMs(raw?: {
  createdAt?: string;
  time?: string;
  timestamp?: number;
  serverTimestamp?: any;
}): number {
  if (!raw) return 0;
  if (raw.serverTimestamp && typeof raw.serverTimestamp.toMillis === 'function') {
    return raw.serverTimestamp.toMillis();
  }
  if (raw.serverTimestamp && typeof raw.serverTimestamp.seconds === 'number') {
    return raw.serverTimestamp.seconds * 1000;
  }
  if (typeof raw.timestamp === 'number' && raw.timestamp > 0) {
    return raw.timestamp;
  }
  const iso = raw.createdAt || raw.time;
  if (iso) {
    const ms = new Date(iso).getTime();
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return 0;
}

function resolveMessageIsoTime(msg: Partial<ChatMessage>): string {
  if (msg.createdAt) {
    const ms = new Date(msg.createdAt).getTime();
    if (!isNaN(ms) && ms > 0) return msg.createdAt;
  }
  const resolvedMs = resolveMediaTimeMs(msg);
  if (resolvedMs > 0) return new Date(resolvedMs).toISOString();
  return '';
}

export function extractRoomMediaFromMessages(
  messages: ChatMessage[],
  options?: {
    roomId?: string;
    currentUserUid?: string;
    currentUserName?: string;
    currentUserAvatar?: string | null;
    memberNamesMap?: Record<string, string>;
    memberMetaMap?: Record<string, { displayName?: string; avatarUrl?: string | null }>;
  }
): {
  images: RoomExtractedImage[];
  videos: RoomExtractedVideo[];
  unifiedMedia: UnifiedMediaItem[];
} {
  const images: RoomExtractedImage[] = [];
  const videos: RoomExtractedVideo[] = [];
  const unifiedMedia: UnifiedMediaItem[] = [];
  const seenKeys = new Set<string>();

  // Work on a chronologically sorted copy (oldest -> newest) so extracted media stays strictly chronological
  const sortedMessages = [...messages].sort((a, b) => {
    const tA = resolveMediaTimeMs(a);
    const tB = resolveMediaTimeMs(b);
    if (tA !== tB) return tA - tB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  sortedMessages.forEach((msg) => {
    if ((msg as any).isSelfDestruct) return;

    const msgIsoTime = resolveMessageIsoTime(msg);
    const isMe = Boolean(options?.currentUserUid && msg.senderId === options.currentUserUid);
    const senderMeta =
      options?.memberMetaMap?.[msg.senderId] || options?.memberMetaMap?.[msg.senderDevice];
    const senderName = isMe
      ? options?.currentUserName || msg.senderName || pickActiveLang('Bạn', 'You', '我')
      : options?.memberNamesMap?.[msg.senderId] ||
        options?.memberNamesMap?.[msg.senderDevice] ||
        senderMeta?.displayName ||
        msg.senderName ||
        pickActiveLang('Người dùng', 'User', '用户');
    const senderAvatar =
      msg.senderAvatar ||
      (isMe ? options?.currentUserAvatar || null : senderMeta?.avatarUrl || null);

    const rawAttachments: Array<{
      name?: string;
      size?: number;
      type?: string;
      data?: string;
      url?: string;
    }> =
      Array.isArray((msg as any).attachments) && (msg as any).attachments.length > 0
        ? (msg as any).attachments
        : msg.fileUrl || msg.fileData || msg.fileName
        ? [
            {
              name: msg.fileName,
              size: msg.fileSize,
              type: msg.fileType,
              data: msg.fileData,
              url: msg.fileUrl,
            },
          ]
        : [];

    rawAttachments.forEach((att, idx) => {
      const attName = att.name || msg.fileName || 'file';
      const attType = att.type || msg.fileType || '';
      const attUrl = att.url || '';
      const attData = att.data || '';
      const attSize = att.size ?? msg.fileSize;

      const attIsGif = isGifFile(attName || attUrl, attType);
      const attIsVideo = Boolean(
        (attData && attData.startsWith('data:video')) ||
          (attType && attType.startsWith('video/')) ||
          (attName &&
            attName.match(/\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv|ts|ogv)$/i))
      );
      const attIsImage =
        !attIsVideo &&
        Boolean(
          attIsGif ||
            (attData && attData.startsWith('data:image')) ||
            (attType && attType.startsWith('image/')) ||
            (attName &&
              attName.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp|heic|heif|avif)$/i))
        );

      const viewUrl = normalizeMediaViewUrl(attUrl);
      const downloadUrl = normalizeMediaDownloadUrl(attUrl, viewUrl || attData);

      if (attIsImage) {
        const imgSrc = attIsGif
          ? viewUrl ||
            attUrl ||
            (attData?.startsWith('data:image/gif') ? attData : '') ||
            attData ||
            ''
          : attData || viewUrl || attUrl || '';
        const viewerSrc = viewUrl || imgSrc;
        const backupSrc =
          attData && attData !== imgSrc
            ? attData
            : viewUrl && viewUrl !== imgSrc
            ? viewUrl
            : undefined;
        if (!imgSrc && !viewerSrc) return;

        const id = `${msg.id || msg.createdAt}_i_${idx}`;
        const dedupeKey = `img_${viewerSrc || imgSrc}`;
        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
        }

        images.push({
          id,
          url: imgSrc || viewerSrc,
          backupSrc,
          downloadUrl,
          name: attName || pickActiveLang('Ảnh', 'Image', '图片'),
          isGif: attIsGif,
          size: attSize,
          sender: senderName,
          senderAvatar,
          time: msgIsoTime,
        });

        unifiedMedia.push({
          id,
          name: attName || pickActiveLang('Ảnh', 'Image', '图片'),
          title: attName || pickActiveLang('Ảnh', 'Image', '图片'),
          src: viewerSrc || imgSrc,
          downloadUrl,
          thumbnail: (attData && attData.startsWith('data:image/') ? attData : imgSrc) || null,
          size: attSize,
          type: 'image',
          mimeType: attIsGif ? 'image/gif' : attType || 'image/jpeg',
          isGif: attIsGif,
          senderName,
          senderAvatar,
          createdAt: msgIsoTime,
          roomId: options?.roomId,
        });
      } else if (attIsVideo) {
        const videoSrc =
          viewUrl ||
          (attUrl && !attUrl.startsWith('data:image/') ? attUrl : '') ||
          (attData && attData.startsWith('data:video/') ? attData : '');
        if (!videoSrc) return;

        const poster =
          attData && attData.startsWith('data:image/') ? attData : null;
        const id = `${msg.id || msgIsoTime}_v_${idx}`;

        videos.push({
          id,
          url: videoSrc,
          downloadUrl: downloadUrl || videoSrc,
          poster,
          name: attName || 'Video',
          size: attSize,
          sender: senderName,
          senderAvatar,
          time: msgIsoTime,
        });

        unifiedMedia.push({
          id,
          name: attName || 'Video',
          title: attName || 'Video',
          src: videoSrc,
          downloadUrl: downloadUrl || videoSrc,
          thumbnail: poster,
          size: attSize,
          type: 'video',
          mimeType: attType || 'video/mp4',
          senderName,
          senderAvatar,
          createdAt: msgIsoTime,
          roomId: options?.roomId,
        });
      }
    });
  });

  // Room gallery modal tabs display newest first; unifiedMedia preserves exact chronological order (oldest -> newest)
  images.reverse();
  videos.reverse();

  return { images, videos, unifiedMedia };
}

export function saveActiveMediaForSource(
  source: MediaViewerSource,
  item: UnifiedMediaItem,
  roomId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    if (source === 'chat') {
      const existing = readMediaSessionForSource('chat');
      const existingRoomMedia =
        existing?.source === 'chat' &&
        (!roomId || !existing.roomId || existing.roomId === roomId)
          ? existing.roomMedia || []
          : [];

      const safeItem = sanitizeForSessionStorage(item);
      const payload: StoredChatSession = {
        source: 'chat',
        roomId: roomId || (existing?.source === 'chat' ? existing.roomId : undefined),
        activeItem: safeItem,
        roomMedia: existingRoomMedia,
      };
      sessionStorage.setItem(CHAT_MEDIA_STORAGE_KEY, JSON.stringify(payload));
    } else {
      const payload: StoredCloudSession = {
        source: 'cloud',
        activeItem: sanitizeForSessionStorage(item),
      };
      sessionStorage.setItem(CLOUD_MEDIA_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Fallback without roomMedia if storage quota is tight
    try {
      const key = source === 'chat' ? CHAT_MEDIA_STORAGE_KEY : CLOUD_MEDIA_STORAGE_KEY;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          source,
          roomId,
          activeItem: sanitizeForSessionStorage(item),
        })
      );
    } catch {}
  }
}

export function readMediaSessionForSource(
  source: MediaViewerSource
): StoredChatSession | StoredCloudSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = source === 'chat' ? CHAT_MEDIA_STORAGE_KEY : CLOUD_MEDIA_STORAGE_KEY;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.activeItem) {
      return parsed;
    }
  } catch {}
  return null;
}

export function openMediaInLargeViewer(params: {
  source: MediaViewerSource;
  activeItem: UnifiedMediaItem;
  roomId?: string;
  roomMedia?: UnifiedMediaItem[];
}): void {
  if (typeof window === 'undefined') return;
  const { source, activeItem, roomId, roomMedia } = params;

  try {
    if (source === 'chat') {
      const sanitizedList = (roomMedia || []).map(sanitizeForSessionStorage);
      const payload: StoredChatSession = {
        source: 'chat',
        roomId,
        activeItem: sanitizeForSessionStorage(activeItem),
        roomMedia: sanitizedList,
      };
      sessionStorage.setItem(CHAT_MEDIA_STORAGE_KEY, JSON.stringify(payload));
    } else {
      const payload: StoredCloudSession = {
        source: 'cloud',
        activeItem: sanitizeForSessionStorage(activeItem),
      };
      sessionStorage.setItem(CLOUD_MEDIA_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Retry compact without roomMedia array if quota exceeded
    try {
      const key = source === 'chat' ? CHAT_MEDIA_STORAGE_KEY : CLOUD_MEDIA_STORAGE_KEY;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          source,
          roomId,
          activeItem: sanitizeForSessionStorage(activeItem),
        })
      );
    } catch {}
  }

  const q = new URLSearchParams();
  q.set('page', 'player');
  q.set('source', source);
  if (roomId && source === 'chat') q.set('roomId', roomId);
  if (activeItem.id) q.set('id', activeItem.id);
  if (activeItem.name) q.set('name', activeItem.name);
  if (activeItem.src && !activeItem.src.startsWith('data:')) {
    q.set('src', activeItem.src);
  }
  if (activeItem.size) q.set('size', String(activeItem.size));
  q.set('type', activeItem.type);

  window.history.pushState(null, '', `/?${q.toString()}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(
    new CustomEvent('clsend:open-media', {
      detail: { source, roomId, activeItem },
    })
  );
}
