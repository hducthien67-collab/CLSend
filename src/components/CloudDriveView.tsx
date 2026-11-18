import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, pickLang, getLocaleTag } from '../context/LanguageContext';
import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { CloudDriveFile } from './../types';
import { openMediaInLargeViewer } from '../utils/mediaViewerSession';
import {
  Cloud,
  Upload,
  HardDrive,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Trash2,
  Download,
  Share2,
  Star,
  Search,
  ExternalLink,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Edit2,
  X,
  Link as LinkIcon,
  Zap,
  Play,
  Film
} from 'lucide-react';
import { uploadFileToServer, isImageFile, isVideoFile, generateImageThumbnail, generateVideoThumbnail, createClientFallbackFileInfo } from '../utils/fileUpload';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';
import { FileDocIcon, getDocumentTypeInfo } from './FileDocIcon';
import { downloadFileSafely } from '../utils/fileDownload';
import { getTelegramConfig, uploadToTelegram } from '../utils/telegramStorage';
import { cacheFileInCommunitySwarm, getFileFromCommunitySwarm } from '../utils/p2pCommunitySwarm';
import { showGlobalToast } from '../utils/toast';
import { AudioPreviewPlayer } from './AudioPreviewPlayer';
import { getVideoWebWatchUrl, openVideoInWebTab } from '../utils/videoWatch';
import { PersistentVideoPlayerModal } from './PersistentVideoPlayerModal';
import { saveVideoToIndexedDB } from './AllInOneVideoPlayer';
import { storeFileBlobLocally } from '../utils/idbStorage';
import { subscribeUserCloudFiles } from '../utils/cloudSync';

const MAX_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB personal storage quota

const CloudDriveViewComponent: React.FC = () => {
  const { currentUser, userProfile, settings } = useAuth();
  const { t, currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh?: string) => pickLang(currentLang, vi, en, zh);
  const [files, setFiles] = useState<CloudDriveFile[]>(() => {
    try {
      const userRaw = localStorage.getItem('cloudsend_custom_session');
      const uid = (userRaw ? JSON.parse(userRaw)?.uid : '') || '';
      if (uid) {
        const cached = localStorage.getItem(`cloudsend_cache_files_${uid}`);
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(() => {
    try {
      const userRaw = localStorage.getItem('cloudsend_custom_session');
      const uid = (userRaw ? JSON.parse(userRaw)?.uid : '') || '';
      if (uid && localStorage.getItem(`cloudsend_cache_files_${uid}`)) {
        return false;
      }
    } catch {}
    return true;
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'image' | 'video' | 'audio' | 'document' | 'other' | 'favorite'>('all');
  const [previewFile, setPreviewFile] = useState<CloudDriveFile | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileBaseName, setEditFileBaseName] = useState('');
  const [editFileExtension, setEditFileExtension] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPersistentVideoModalOpen, setIsPersistentVideoModalOpen] = useState(false);

  // Cloud URL Modal states
  const [isCloudUrlModalOpen, setIsCloudUrlModalOpen] = useState(false);
  const [cloudUrlModalValue, setCloudUrlModalValue] = useState('');

  const handleCloudUrlAdded = async () => {
    const finalUrl = cloudUrlModalValue.trim();
    if (!finalUrl) return;
    let validUrl = finalUrl;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }
    try {
      const urlObj = new URL(validUrl);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const rawName = segments[segments.length - 1] || urlObj.hostname;
      const decodedName = decodeURIComponent(rawName);
      const fileName = decodedName.includes('.') ? decodedName : `${urlObj.hostname}_link`;
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(validUrl);
      const isVideo = /\.(mp4|webm|mov|mkv|avi|m4v|3gp)(\?.*)?$/i.test(validUrl);

      setUploading(true);
      const newFileDoc = {
        userId: currentUser?.uid,
        userEmail: (currentUser?.email || '').trim().toLowerCase(),
        userName: currentUser?.displayName || settings.deviceName || pick('Người dùng', 'User', '用户'),
        name: fileName,
        size: 0,
        type: isImage ? 'image/jpeg' : isVideo ? 'video/mp4' : 'text/uri-list',
        url: validUrl,
        viewUrl: validUrl,
        thumbnail: isImage ? validUrl : null,
        category: isImage ? 'image' : isVideo ? 'video' : 'other',
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'cloud_files'), newFileDoc);
      setCloudUrlModalValue('');
      setIsCloudUrlModalOpen(false);
      setUploading(false);
      showBottomToast(pick('🔗 Đã lưu URL "{name}" vào Cloud Drive thành công!', '🔗 Saved URL "{name}" to Cloud Drive successfully!', '🔗 已成功将 URL “{name}” 保存到云盘！').replace('{name}', fileName));
    } catch (err) {
      setUploading(false);
      showBottomToast(pick('⚠️ Không thể thêm URL này. Vui lòng kiểm tra lại định dạng.', '⚠️ Unable to add this URL. Please check the format.', '⚠️ 无法添加此 URL，请检查格式。'), true);
    }
  };

  // Custom in-app delete modal states (bảng xác nhận xóa tùy chỉnh trong web)
  const [filePendingDelete, setFilePendingDelete] = useState<CloudDriveFile | null>(null);
  const [bulkPendingDelete, setBulkPendingDelete] = useState<{ count: number; catLabel: string; targetFiles: CloudDriveFile[] } | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('cloudsend_skip_delete_confirm') === 'true';
  });
  const [dontAskAgainChecked, setDontAskAgainChecked] = useState(false);
  const [bottomToast, setBottomToast] = useState<{ id: string; message: string; isError?: boolean } | null>(null);
  const toastTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [reuploadingFile, setReuploadingFile] = useState<CloudDriveFile | null>(null);

  const showBottomToast = (message: string, isError = false) => {
    showGlobalToast(message, isError ? 'error' : 'success');
  };

  // Lock background scroll when file preview or modals are open
  useEffect(() => {
    if (previewFile || filePendingDelete || bulkPendingDelete || isCloudUrlModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [previewFile, filePendingDelete, bulkPendingDelete, isCloudUrlModalOpen]);

  // Real-time synchronization of personal Cloud files via Firestore (supports linked UIDs & email across Chrome profiles)
  useEffect(() => {
    if (!currentUser?.uid) {
      setFiles([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeUserCloudFiles(
      currentUser,
      userProfile,
      (loaded) => {
        setFiles(loaded);
        try {
          if (currentUser?.uid) {
            localStorage.setItem(`cloudsend_cache_files_${currentUser.uid}`, JSON.stringify(loaded.slice(0, 100)));
          }
        } catch {}
        setLoading(false);
      },
      (err) => {
        console.error('Lỗi khi tải danh sách tệp đám mây:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.email, currentUser?.linkedEmail, (currentUser?.linkedUids || []).join(','), userProfile?.linkedEmail, (userProfile?.linkedUids || []).join(',')]);

  // Compute storage quota
  const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const quotaUsedPercent = Math.min(100, Math.round((totalSizeBytes / MAX_QUOTA_BYTES) * 100));

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileCategory = (mime: string, name: string): 'image' | 'video' | 'audio' | 'document' | 'other' => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg'].includes(ext)) {
      return 'image';
    }
    if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
      return 'video';
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
      return 'audio';
    }
    if (
      mime.includes('pdf') ||
      mime.includes('word') ||
      mime.includes('document') ||
      mime.includes('sheet') ||
      mime.includes('presentation') ||
      ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv', 'md'].includes(ext)
    ) {
      return 'document';
    }
    return 'other';
  };

  const getFileIcon = (category: string, name?: string, mime?: string) => {
    if (name || mime) {
      return <FileDocIcon fileName={name} mimeType={mime} size="sm" />;
    }
    switch (category) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-sky-400" />;
      case 'video':
        return <Video className="w-5 h-5 text-rose-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-violet-400" />;
      case 'document':
        return <FileText className="w-5 h-5 text-amber-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  // Upload file to personal Cloud with 3-worker parallel pipeline
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !currentUser) return;

    setUploading(true);
    setUploadProgress(5);
    setStatusMessage(null);

    try {
      const filesToUpload = Array.from(fileList);
      const totalFiles = filesToUpload.length;
      let completedCount = 0;
      let totalFailed = 0;

      const uploadOne = async (file: File) => {
        // Quota check
        if (totalSizeBytes + file.size > MAX_QUOTA_BYTES) {
          totalFailed++;
          return;
        }

        // Generate client thumbnail in parallel without blocking upload, then merge if available
        let clientThumb: string | undefined = undefined;
        const thumbPromise = isImageFile(file)
          ? generateImageThumbnail(file, 480, 0.8).then(t => { if (t) clientThumb = t; return t; }).catch(() => '')
          : isVideoFile(file)
          ? generateVideoThumbnail(file).then(t => { if (t) clientThumb = t; return t; }).catch(() => '')
          : Promise.resolve('');

        let fileUrl = '';
        let fileViewUrl = '';
        let fileThumbnail: string | null = null;

        try {
          const uploadedFile = await uploadFileToServer(file, (pct) => {
            const overall = Math.min(99, Math.round(((completedCount + (pct / 100)) / totalFiles) * 100));
            setUploadProgress(overall);
          });
          fileUrl = uploadedFile.url;
          fileViewUrl = uploadedFile.viewUrl || uploadedFile.url;
          if (uploadedFile.thumbnail) {
            fileThumbnail = uploadedFile.thumbnail;
          } else {
            const awaitedThumb = await Promise.race([
              thumbPromise,
              new Promise<string>((res) => setTimeout(() => res(clientThumb || ''), 800)),
            ]);
            if (awaitedThumb) fileThumbnail = awaitedThumb;
          }
        } catch (uploadErr: any) {
          console.warn(`Server upload fallback notice for "${file.name}":`, uploadErr);
          if (isImageFile(file) || file.size <= 400 * 1024) {
            const fallback = await createClientFallbackFileInfo(file);
            fileUrl = fallback.url || '';
            fileViewUrl = fallback.viewUrl || '';
            fileThumbnail = fallback.thumbnail || (isImageFile(file) ? fallback.url : null);
          }
        }

        if (!fileUrl || !fileUrl.trim()) {
          console.warn(`Không thể lưu trữ tệp "${file.name}" do liên kết tải về rỗng.`);
          totalFailed++;
          return;
        }

        const category = getFileCategory(file.type, file.name);
        const safeUrl = (fileUrl && fileUrl.length < 700000) ? fileUrl : '';
        const safeViewUrl = (fileViewUrl && fileViewUrl.length < 700000) ? fileViewUrl : safeUrl;
        const safeThumbnail: string | null = (fileThumbnail && typeof fileThumbnail === 'string' && fileThumbnail.length < 700000) ? fileThumbnail : null;

        if (!safeUrl || !safeUrl.trim()) {
          totalFailed++;
          return;
        }

        // Save metadata into Firestore
        const docId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const docData: any = {
          id: docId,
          userId: currentUser.uid,
          userEmail: currentUser.email || '',
          userName: currentUser.displayName || settings.deviceName || pick('Người dùng', 'User', '用户'),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: safeUrl,
          viewUrl: safeViewUrl,
          thumbnail: safeThumbnail,
          category: category,
          isFavorite: false,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'cloud_files', docId), docData);

        // Store video in IndexedDB for immediate offline viewing
        if (category === 'video' || file.type.startsWith('video/')) {
          saveVideoToIndexedDB({
            id: docId,
            title: file.name,
            blob: file,
            size: formatFileSize(file.size)
          }).catch(() => {});
          storeFileBlobLocally(docId, file).catch(() => {});
          storeFileBlobLocally(file.name, file).catch(() => {});
        }

        // Cache file in local P2P Community Swarm for instant peer acceleration
        cacheFileInCommunitySwarm(docId, file, file.name).catch(() => {});

        completedCount++;
        setUploadProgress(Math.min(99, Math.round((completedCount / totalFiles) * 100)));
      };

      // Parallel pool: up to 3 files uploaded concurrently
      const CONCURRENCY = Math.min(3, filesToUpload.length);
      const queue = [...filesToUpload];
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            await uploadOne(item);
          }
        }
      });
      await Promise.all(workers);

      setUploadProgress(100);
      if (totalFailed === 0 && completedCount > 0) {
        setStatusMessage({
          type: 'success',
          text: pick('Đã lưu thành công {count} tệp vào Kho Cloud siêu tốc!', 'Successfully saved {count} file(s) to High-Speed Cloud Drive!', '已成功将 {count} 个文件保存到高速云盘！').replace('{count}', String(completedCount))
        });
      } else if (completedCount === 0) {
        setStatusMessage({
          type: 'error',
          text: pick('Không thể tải tệp lên Kho Cloud. Vui lòng kiểm tra kết nối và thử lại.', 'Could not upload files to Cloud Drive. Please check your connection and try again.', '无法上传文件到云盘，请检查网络连接后重试。')
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: pick('Đã lưu {saved}/{total} tệp vào Kho Cloud.', 'Saved {saved}/{total} file(s) to Cloud Drive.', '已将 {saved}/{total} 个文件保存到云盘。').replace('{saved}', String(completedCount)).replace('{total}', String(totalFiles))
        });
      }
    } catch (err: any) {
      console.error('Upload to Cloud error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || pick('Đã có lỗi xảy ra trong quá trình tải tệp lên Cloud.', 'An error occurred while uploading files to Cloud.', '上传文件到云端时发生错误。')
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (file: CloudDriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'cloud_files', file.id), {
        isFavorite: !file.isFavorite
      });
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Rename file
  const handleSaveRename = async (file: CloudDriveFile, e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBase = editFileBaseName.trim();
    if (!trimmedBase) return;
    const finalName = `${trimmedBase}${editFileExtension}`;
    try {
      await updateDoc(doc(db, 'cloud_files', file.id), {
        name: finalName
      });
      setEditingFileId(null);
      showBottomToast(pick('Đã đổi tên tệp thành "{name}"', 'Renamed file to "{name}"', '已将文件重命名为 “{name}”').replace('{name}', finalName));
    } catch (err) {
      console.error('Error renaming file:', err);
      showBottomToast(pick('Không thể đổi tên tệp. Vui lòng thử lại.', 'Unable to rename file. Please try again.', '无法重命名文件，请重试。'), true);
    }
  };

  // Re-upload data for an interrupted file
  const handleTriggerReupload = (file: CloudDriveFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReuploadingFile(file);
    if (reuploadInputRef.current) {
      reuploadInputRef.current.value = '';
      reuploadInputRef.current.click();
    }
  };

  const handleExecuteReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reuploadingFile) return;

    setUploading(true);
    setUploadProgress(5);
    setStatusMessage({
      type: 'info',
      text: pick('Đang tải bù dữ liệu phân mảnh cho tệp "{name}"...', 'Re-uploading chunked data for "{name}"...', '正在为“{name}”重新上传分片数据...').replace('{name}', reuploadingFile.name)
    });

    try {
      const uploaded = await uploadFileToServer(file, (pct) => {
        setUploadProgress(pct);
      });

      if (!uploaded.url || !uploaded.url.trim()) {
        throw new Error(pick('Máy chủ chưa trả về đường dẫn tải.', 'Server did not return a download link.', '服务器未返回下载链接。'));
      }

      const safeUrl = uploaded.url;
      const safeViewUrl = uploaded.viewUrl || safeUrl;
      const safeThumbnail = uploaded.thumbnail || null;
      const category = getFileCategory(file.type, file.name);

      await updateDoc(doc(db, 'cloud_files', reuploadingFile.id), {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: safeUrl,
        viewUrl: safeViewUrl,
        thumbnail: safeThumbnail,
        category: category,
        createdAt: new Date().toISOString()
      });

      setStatusMessage({
        type: 'success',
        text: pick('Đã khôi phục và cập nhật dữ liệu thành công cho tệp "{name}"!', 'Restored and updated data for "{name}" successfully!', '已成功恢复并更新“{name}”的数据！').replace('{name}', file.name)
      });
      showBottomToast(pick('Đã khôi phục dữ liệu cho "{name}"', 'Restored data for "{name}"', '已为“{name}”恢复数据').replace('{name}', file.name));
    } catch (err: any) {
      console.error('Lỗi khi tải bù tệp:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || pick('Lỗi khi tải lại tệp lên máy chủ.', 'Error re-uploading file to server.', '重新上传文件到服务器出错。')
      });
      showBottomToast(pick('Không thể tải lại tệp: {msg}', 'Unable to re-upload file: {msg}', '无法重新上传文件：{msg}').replace('{msg}', err.message || pick('Vui lòng thử lại', 'Please try again', '请重试')), true);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setReuploadingFile(null);
    }
  };

  // Direct reupload when user picks file directly inside Preview Player
  const performDirectReupload = async (targetFile: CloudDriveFile, file: File) => {
    setUploading(true);
    setUploadProgress(5);
    showBottomToast(pick('Đang đồng bộ tệp "{name}" vào Kho Cloud...', 'Syncing "{name}" to Cloud Drive...', '正在将“{name}”同步到云盘...').replace('{name}', file.name));

    try {
      const uploaded = await uploadFileToServer(file, (pct) => {
        setUploadProgress(pct);
      });

      if (!uploaded.url || !uploaded.url.trim()) {
        throw new Error(pick('Máy chủ chưa trả về đường dẫn tải.', 'Server did not return a download link.', '服务器未返回下载链接。'));
      }

      const safeUrl = uploaded.url;
      const safeViewUrl = uploaded.viewUrl || safeUrl;
      const safeThumbnail = uploaded.thumbnail || null;
      const category = getFileCategory(file.type, file.name);

      await updateDoc(doc(db, 'cloud_files', targetFile.id), {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: safeUrl,
        viewUrl: safeViewUrl,
        thumbnail: safeThumbnail,
        category: category,
        createdAt: new Date().toISOString()
      });

      setPreviewFile(prev => prev && prev.id === targetFile.id ? {
        ...prev,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: safeUrl,
        viewUrl: safeViewUrl,
        thumbnail: safeThumbnail || undefined
      } : prev);

      showBottomToast(pick('Đã lưu tệp "{name}" vĩnh viễn vào Kho Cloud!', 'Saved "{name}" permanently to Cloud Drive!', '已将“{name}”永久保存到云盘！').replace('{name}', file.name));
    } catch (err: any) {
      console.warn('Direct reupload error:', err);
      showBottomToast(pick('Lỗi khi lưu lên Cloud: {msg}', 'Error saving to Cloud: {msg}', '保存到云端出错：{msg}').replace('{msg}', err.message || pick('Thử lại sau', 'Try again later', '请稍后重试')), true);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Clean all interrupted/broken files with empty URLs
  const handleCleanBrokenFiles = async () => {
    const broken = files.filter(f => !f.url || !f.url.trim());
    if (broken.length === 0) return;
    try {
      for (const f of broken) {
        await deleteDoc(doc(db, 'cloud_files', f.id)).catch(() => {});
      }
      showBottomToast(pick('Đã dọn dẹp {count} tệp bị gián đoạn.', 'Cleaned up {count} interrupted file(s).', '已清理 {count} 个中断的文件。').replace('{count}', String(broken.length)));
    } catch (err) {
      console.error('Lỗi khi dọn tệp lỗi:', err);
    }
  };

  // Xử lý khi nhấn vào thẻ tệp trên Cloud Drive:
  // Nếu là Video hoặc Hình ảnh, chuyển sang trang xem lớn độc lập (nguồn Kho Cloud)
  const handleFileCardClick = (file: CloudDriveFile) => {
    const isVideo = file.category === 'video' || (file.type && file.type.startsWith('video/')) || file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i);
    const isImage = file.category === 'image' || (file.type && file.type.startsWith('image/')) || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i);
    const mediaSrc = file.viewUrl || file.url;

    if ((isVideo || isImage) && mediaSrc) {
      openMediaInLargeViewer({
        source: 'cloud',
        activeItem: {
          id: file.id,
          name: file.name,
          title: file.name,
          src: mediaSrc,
          thumbnail: file.thumbnail || null,
          size: file.size,
          type: isVideo ? 'video' : 'image',
          mimeType: file.type,
          createdAt: file.createdAt,
        },
      });
      return;
    }

    setPreviewFile(file);
  };

  // Trigger single file deletion
  const handleDeleteFile = (file: CloudDriveFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (skipDeleteConfirm) {
      performDeleteFile(file);
    } else {
      setDontAskAgainChecked(false);
      setFilePendingDelete(file);
    }
  };

  // Perform actual single file delete
  const performDeleteFile = async (file: CloudDriveFile) => {
    try {
      // 1. Delete Firestore record
      await deleteDoc(doc(db, 'cloud_files', file.id));

      // 2. Extract server filename to delete from disk
      const serverFilename = file.url.split('/').pop()?.split('?')[0];
      if (serverFilename) {
        await fetch(`/api/files/${serverFilename}`, { method: 'DELETE' }).catch(() => {});
      }

      if (previewFile?.id === file.id) {
        setPreviewFile(null);
      }

      showBottomToast(pick('Bạn đã xóa "{name}" khỏi Kho Cloud', 'Deleted "{name}" from Cloud Drive', '已从云盘删除“{name}”').replace('{name}', file.name));
    } catch (err) {
      console.error('Error deleting file:', err);
      showBottomToast(pick('Không thể xóa tệp "{name}". Vui lòng thử lại.', 'Unable to delete "{name}". Please try again.', '无法删除“{name}”，请重试。').replace('{name}', file.name), true);
    }
  };

  // Confirm delete from in-app modal
  const confirmDeleteFile = async () => {
    if (!filePendingDelete) return;
    if (dontAskAgainChecked) {
      setSkipDeleteConfirm(true);
      localStorage.setItem('cloudsend_skip_delete_confirm', 'true');
    }
    const file = filePendingDelete;
    setFilePendingDelete(null);
    await performDeleteFile(file);
  };

  // Trigger bulk deletion modal
  const handleDeleteFiles = (scope: 'all' | 'category' = 'all') => {
    const targetFiles = scope === 'category' && selectedCategory !== 'all'
      ? files.filter(f => selectedCategory === 'favorite' ? f.isFavorite : f.category === selectedCategory)
      : files;

    if (targetFiles.length === 0) return;
    const count = targetFiles.length;
    const catLabel = scope === 'category'
      ? (selectedCategory === 'image' ? pick('hình ảnh', 'images', '图片')
        : selectedCategory === 'video' ? pick('video', 'videos', '视频')
        : selectedCategory === 'audio' ? pick('âm thanh', 'audio files', '音频')
        : selectedCategory === 'document' ? pick('tài liệu', 'documents', '文档')
        : selectedCategory === 'favorite' ? pick('tệp yêu thích', 'favorite files', '收藏文件')
        : pick('tệp', 'files', '文件'))
      : pick('tất cả tệp (Hình ảnh, Video, Âm thanh, Tài liệu...)', 'all files (Images, Videos, Audio, Documents...)', '所有文件（图片、视频、音频、文档...）');

    setBulkPendingDelete({ count, catLabel, targetFiles });
  };

  // Confirm bulk delete from modal
  const confirmBulkDelete = async () => {
    if (!bulkPendingDelete) return;
    const { count, catLabel, targetFiles } = bulkPendingDelete;
    setBulkPendingDelete(null);

    try {
      const batchPromises = targetFiles.map(async (file) => {
        await deleteDoc(doc(db, 'cloud_files', file.id));
        const serverFilename = file.url.split('/').pop()?.split('?')[0];
        if (serverFilename) {
          await fetch(`/api/files/${serverFilename}`, { method: 'DELETE' }).catch(() => {});
        }
      });
      await Promise.all(batchPromises);
      showBottomToast(
        pick('Bạn đã xóa toàn bộ {count} {label} khỏi Kho Cloud', 'Deleted all {count} {label} from Cloud Drive', '已从云盘删除全部 {count} 个{label}')
          .replace('{count}', String(count))
          .replace('{label}', catLabel)
      );
    } catch (err: any) {
      console.error('Error deleting files:', err);
      showBottomToast(pick('Có lỗi xảy ra khi xóa tệp.', 'An error occurred while deleting files.', '删除文件时出错。'), true);
    }
  };

  // Copy shareable link
  const handleCopyLink = (file: CloudDriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = `${window.location.origin}${file.url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopyToast(pick('Đã sao chép link tải: {name}', 'Copied download link: {name}', '已复制下载链接：{name}').replace('{name}', file.name));
      setTimeout(() => setCopyToast(null), 3000);
    });
  };

  // Filtering files
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'favorite') return f.isFavorite;
    return f.category === selectedCategory;
  });

  return (
    <>
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Storage Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  {t('drive.title')}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                    Live Sync
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  {t('drive.desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              className="hidden"
            />
            <input
              type="file"
              ref={reuploadInputRef}
              onChange={handleExecuteReupload}
              className="hidden"
            />
            <button
              id="upload-to-cloud-btn"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{pick('Đang tải lên', 'Uploading', '正在上传')} {uploadProgress !== null ? `(${uploadProgress}%)` : '...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-950" />
                  <span>{t('drive.upload_btn')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mb-2 font-medium gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>{t('drive.used')}</span>
              <span className="text-white font-semibold">{formatFileSize(totalSizeBytes)}</span>
              <span>/ 5 GB</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-emerald-400 font-bold">{quotaUsedPercent}%</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quotaUsedPercent > 90
                  ? 'bg-rose-500'
                  : quotaUsedPercent > 70
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${quotaUsedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'info'
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : statusMessage.type === 'info' ? (
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) {
            handleUploadFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
        }`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 transition-transform ${dragOver ? 'text-emerald-400 scale-125' : 'text-slate-400'}`} />
        <p className="text-sm font-semibold text-slate-200">
          {t('drive.drop_title')}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {t('drive.drop_sub')}
        </p>
      </div>

      {/* Filter Categories, Actions and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills with Icons matching Image 1 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {[
            { id: 'all', label: t('drive.filter_all'), icon: HardDrive, iconClass: 'text-emerald-400', count: files.length },
            { id: 'image', label: t('drive.filter_image'), icon: ImageIcon, iconClass: 'text-sky-400', count: files.filter((f) => f.category === 'image').length },
            { id: 'document', label: t('drive.filter_doc'), icon: FileText, iconClass: 'text-amber-400', count: files.filter((f) => f.category === 'document').length },
            { id: 'video', label: t('drive.filter_video'), icon: Video, iconClass: 'text-rose-400', count: files.filter((f) => f.category === 'video').length },
            { id: 'audio', label: t('drive.filter_audio'), icon: Music, iconClass: 'text-purple-400', count: files.filter((f) => f.category === 'audio').length },
            { id: 'favorite', label: t('drive.filter_fav'), icon: Star, iconClass: 'text-yellow-400 fill-yellow-400', count: files.filter((f) => f.isFavorite).length },
          ].map((cat) => {
            const IconComp = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <IconComp className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : cat.iconClass}`} />
                <span>
                  {cat.label}
                  {cat.count > 0 ? ` (${cat.count})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right tools: Delete All & Search Input & Video Player Frame */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {files.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedCategory !== 'all' && filteredFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDeleteFiles('category')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  title={t('drive.delete_category')}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('drive.delete_category')} ({filteredFiles.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteFiles('all')}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm whitespace-nowrap"
                title={t('drive.delete_all')}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{t('drive.delete_all')} ({files.length})</span>
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative min-w-[180px] sm:min-w-[220px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('drive.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="smooth-input w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition-all duration-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Files Grid / List */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl py-16 px-6 text-center">
          <Cloud className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300 mb-1">
            {t('drive.empty')}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            {t('drive.empty_sub')}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-emerald-400 transition-colors inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>{t('drive.upload_btn')}</span>
          </button>
        </div>
      ) : (
        <>
          {files.some((f) => !f.url || !f.url.trim()) && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-300">
                    {pick('Phát hiện tệp bị gián đoạn dữ liệu (từ lần tải trước khi nâng cấp phân mảnh)', 'Detected interrupted file data (from upload before chunked upgrade)', '检测到数据中断的文件（来自升级分片上传前的上传）')}
                  </h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {pick(
                      'Hệ thống đã nâng cấp Phân mảnh (Chunked Upload) cho tệp lớn. Bạn có thể bấm nút "Tải lại" trên tệp để chọn file bù vào, hoặc dọn dẹp các tệp bị gián đoạn này.',
                      'The system has upgraded Chunked Upload for large files. You can click "Re-upload" on the file to patch it, or clean up these interrupted files.',
                      '系统已升级大文件分片上传。您可以点击文件上的“重新上传”补充数据，或清理这些中断的文件。'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCleanBrokenFiles}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs transition-colors"
                >
                  {pick('Dọn dẹp tệp lỗi', 'Clean broken files', '清理损坏文件')}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleFileCardClick(file)}
              className="group bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-850/80 rounded-2xl p-4 transition-all shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between"
            >
              {/* Card Header & Preview Thumbnail */}
              <div>
                <div className="relative aspect-video w-full rounded-xl bg-slate-950/80 border border-slate-800/60 overflow-hidden mb-3 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors">
                  {file.category === 'image' ? (
                    <img
                      src={file.thumbnail || file.viewUrl || file.url}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : file.category === 'video' ? (
                    file.thumbnail ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/90 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <FileDocIcon fileName={file.name} mimeType={file.type || 'video/mp4'} size="md" />
                      </div>
                    )
                  ) : file.category === 'audio' ? (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <FileDocIcon fileName={file.name} mimeType={file.type} size="md" />
                      <span className="text-[10px] text-slate-400">{pick('Nghe nhạc', 'Play Audio', '播放音频')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <FileDocIcon fileName={file.name} mimeType={file.type} size="md" />
                      <span className="text-[10px] text-slate-400">
                        {getDocumentTypeInfo(file.name, file.type, currentLang).label}
                      </span>
                    </div>
                  )}

                  {/* Favorite star badge */}
                  <button
                    type="button"
                    title={file.isFavorite ? pick('Bỏ yêu thích', 'Remove from favorites', '取消收藏') : pick('Đánh dấu yêu thích', 'Add to favorites', '添加到收藏')}
                    onClick={(e) => handleToggleFavorite(file, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-400 hover:text-amber-400 transition-colors backdrop-blur-sm"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        file.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* File Name & Rename Form */}
                {editingFileId === file.id ? (
                  <form
                    onSubmit={(e) => handleSaveRename(file, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 mb-1"
                  >
                    <input
                      type="text"
                      value={editFileBaseName}
                      autoFocus
                      onChange={(e) => setEditFileBaseName(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-white"
                      placeholder={pick('Tên tệp', 'File name', '文件名')}
                    />
                    {editFileExtension && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                        {editFileExtension}
                      </span>
                    )}
                    <button
                      type="submit"
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      {pick('Lưu', 'Save', '保存')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFileId(null)}
                      className="p-0.5 text-slate-400 hover:text-white shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4
                      title={file.name}
                      className="text-xs font-semibold text-slate-200 truncate group-hover:text-white"
                    >
                      {file.name}
                    </h4>
                    <button
                      type="button"
                      title={t('drive.rename')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFileId(file.id);
                        const lastDot = file.name.lastIndexOf('.');
                        if (lastDot !== -1 && lastDot > 0) {
                          setEditFileBaseName(file.name.substring(0, lastDot));
                          setEditFileExtension(file.name.substring(lastDot));
                        } else {
                          setEditFileBaseName(file.name);
                          setEditFileExtension('');
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity p-0.5"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* File Meta */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                  <span>{formatFileSize(file.size)}</span>
                  {!file.url ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {pick('Lỗi tải lên', 'Upload error', '上传错误')}
                    </span>
                  ) : (
                    <span>{new Date(file.createdAt).toLocaleDateString(getLocaleTag(currentLang))}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400"
              >
                <div className="flex items-center gap-1">
                  {/* Download or Re-upload */}
                  {!file.url ? (
                    <button
                      type="button"
                      onClick={(e) => handleTriggerReupload(file, e)}
                      title={pick('Tệp bị gián đoạn - Bấm để tải bù dữ liệu cho tệp này', 'Interrupted file - Click to re-upload data for this file', '文件中断 - 点击补充上传此文件数据')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-300" />
                      <span>{t('drive.reupload')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => downloadFileSafely(file.url, file.name, undefined, [file.id])}
                      title={t('drive.download_btn')}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {/* Copy Share Link */}
                  <button
                    type="button"
                    title={t('drive.share')}
                    onClick={(e) => handleCopyLink(file, e)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Direct Web Player Link for Videos */}
                  {file.category === 'video' && (
                    <a
                      href={getVideoWebWatchUrl(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={pick('Mở video trên tab Web riêng (siêu mượt)', 'Open video in dedicated Web tab (ultra smooth)', '在独立网页标签中打开视频（超流畅）')}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Preview */}
                  <button
                    type="button"
                    title={t('drive.preview')}
                    onClick={() => setPreviewFile(file)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-teal-400 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  title={t('drive.delete_btn')}
                  onClick={(e) => handleDeleteFile(file, e)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    )}

      {/* Preview Modal */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 touch-none overscroll-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b1120] border border-slate-800/80 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 sm:gap-4 bg-[#0a0f1d]">
              <div className="flex items-center gap-3 min-w-0">
                <FileDocIcon fileName={previewFile.name} mimeType={previewFile.type} size="sm" />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-md" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatFileSize(previewFile.size)} • {new Date(previewFile.createdAt).toLocaleTimeString(getLocaleTag(currentLang))} {new Date(previewFile.createdAt).toLocaleDateString(getLocaleTag(currentLang))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!previewFile.url) {
                      showBottomToast(pick('Tệp "{name}" không có dữ liệu do lần tải trước bị gián đoạn. Bạn hãy tải lại nhé!', 'File "{name}" has no data due to interrupted upload. Please re-upload it!', '文件“{name}”因上次上传中断而无数据，请重新上传！').replace('{name}', previewFile.name), true);
                      return;
                    }
                    downloadFileSafely(previewFile.url, previewFile.name, undefined, [previewFile.id]);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{pick('Tải về', 'Download', '下载')}</span>
                </button>
                {previewFile.category === 'video' && (
                  <a
                    href={getVideoWebWatchUrl(previewFile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                    title={pick('Mở xem trên Web riêng (Tab mới)', 'Open in Dedicated Web Tab', '在新网页标签页中打开')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{pick('Mở xem trên Web ↗', 'Open in Web ↗', '在网页中打开 ↗')}</span>
                  </a>
                )}
                <button
                  type="button"
                  title={pick('Xóa tệp này khỏi Cloud', 'Delete this file from Cloud', '从云端删除此文件')}
                  onClick={() => handleDeleteFile(previewFile)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={pick('Đóng xem trước', 'Close preview', '关闭预览')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Media Viewer */}
            <div className="p-4 sm:p-6 overflow-auto flex-1 flex items-center justify-center bg-[#070b14]/70 min-h-[300px] modal-scrollable">
              {previewFile.category === 'image' ? (
                <img
                  src={previewFile.viewUrl || previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              ) : previewFile.category === 'video' ? (
                <VideoPreviewPlayer
                  src={previewFile.viewUrl || previewFile.url}
                  fallbackUrl={previewFile.url}
                  fileId={previewFile.id}
                  fileName={previewFile.name}
                  fileSize={previewFile.size}
                  onDownload={() => downloadFileSafely(previewFile.url, previewFile.name, undefined, [previewFile.id])}
                  onReupload={() => {
                    const target = previewFile;
                    setPreviewFile(null);
                    handleTriggerReupload(target);
                  }}
                  onFileSelected={(file) => performDirectReupload(previewFile, file)}
                />
              ) : previewFile.category === 'audio' ? (
                <AudioPreviewPlayer
                  src={previewFile.viewUrl || previewFile.url}
                  fileName={previewFile.name}
                />
              ) : (
                <div className="text-center p-8 flex flex-col items-center">
                  <div className="mb-4">
                    <FileDocIcon fileName={previewFile.name} mimeType={previewFile.type} size="hero" />
                  </div>
                  <p className="text-base text-white font-bold mb-1">{previewFile.name}</p>
                  <p className="text-xs text-slate-400 mb-5">
                    {getDocumentTypeInfo(previewFile.name, previewFile.type, currentLang).label} • {formatFileSize(previewFile.size)}
                  </p>
                  {!previewFile.url ? (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-amber-400 text-xs font-semibold">
                        {pick('Tệp này bị gián đoạn dữ liệu (từ lần tải trước khi nâng cấp phân mảnh).', 'This file has interrupted data (from upload before chunked upgrade).', '此文件数据中断（来自升级分片上传前的上传）。')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const target = previewFile;
                            setPreviewFile(null);
                            handleTriggerReupload(target);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>{pick('Tải bù dữ liệu ngay', 'Re-upload Data Now', '立即补充上传数据')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = previewFile;
                            setPreviewFile(null);
                            handleDeleteFile(target);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs inline-flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>{pick('Xóa tệp này', 'Delete this file', '删除此文件')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => downloadFileSafely(previewFile.url, previewFile.name, undefined, [previewFile.id])}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg hover:shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{pick('Tải tệp về máy để xem', 'Download file to view', '下载到本地查看')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. BẢNG XÁC NHẬN XÓA TỆP TÙY CHỈNH (IN-APP DELETE MODAL)      */}
      {/* ============================================================ */}
      {filePendingDelete && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none"
          onClick={() => setFilePendingDelete(null)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-slate-900/98 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-rose-950/40 space-y-4 animate-in zoom-in-95 text-slate-100 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow trang trí */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header: Icon tệp lớn & Tiêu đề */}
            <div className="text-center space-y-3 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50 overflow-hidden">
                {filePendingDelete.thumbnail ? (
                  <img
                    src={filePendingDelete.thumbnail}
                    alt={filePendingDelete.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <FileDocIcon fileName={filePendingDelete.name} mimeType={filePendingDelete.type} size="hero" />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {pick('Xác nhận xóa tệp?', 'Confirm file deletion?', '确认删除文件？')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  {pick('Bạn có chắc chắn là muốn xóa nó không?', 'Are you sure you want to delete it?', '您确定要删除它吗？')}
                </p>
              </div>
            </div>

            {/* Khung chi tiết tệp */}
            <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1 text-center relative z-10">
              <div className="text-xs font-bold text-white truncate max-w-full px-2" title={filePendingDelete.name}>
                {filePendingDelete.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {formatFileSize(filePendingDelete.size)} • {getDocumentTypeInfo(filePendingDelete.name, filePendingDelete.type, currentLang).label}
              </div>
            </div>

            {/* Ô vuông nhỏ: Xóa liên tục không cần hỏi lại */}
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition-colors relative z-10 group">
              <input
                type="checkbox"
                checked={dontAskAgainChecked}
                onChange={(e) => setDontAskAgainChecked(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer"
              />
              <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                {pick('Xóa liên tục mà không cần hỏi lại lần sau', 'Delete without asking again next time', '下次删除不再询问')}
              </span>
            </label>

            {/* 2 Nút: Thoát & Chấp nhận */}
            <div className="grid grid-cols-2 gap-3 pt-1 relative z-10">
              <button
                type="button"
                onClick={() => setFilePendingDelete(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/60 transition-all cursor-pointer active:scale-95"
              >
                {pick('Thoát', 'Cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all cursor-pointer active:scale-95 border border-rose-400/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{pick('Chấp nhận', 'Confirm', '确认')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. BẢNG XÁC NHẬN XÓA NHIỀU TỆP (BULK DELETE MODAL)            */}
      {/* ============================================================ */}
      {bulkPendingDelete && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none"
          onClick={() => setBulkPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-slate-900/98 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-rose-950/40 space-y-4 animate-in zoom-in-95 text-slate-100 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 shadow-lg">
                <Trash2 className="w-7 h-7 text-rose-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {pick('Xác nhận xóa {count} {label}?', 'Confirm deletion of {count} {label}?', '确认删除 {count} 个{label}？')
                    .replace('{count}', String(bulkPendingDelete.count))
                    .replace('{label}', bulkPendingDelete.catLabel)}
                </h3>
                <p className="text-xs text-slate-300">
                  {pick('Bạn có chắc chắn muốn xóa vĩnh viễn không? Hành động này sẽ giải phóng dung lượng và không thể hoàn tác.', 'Are you sure you want to permanently delete? This will free up space and cannot be undone.', '您确定要永久删除吗？此操作将释放空间且无法撤销。')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkPendingDelete(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {pick('Thoát', 'Cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{pick('Xác nhận xóa', 'Confirm Delete', '确认删除')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* Cloud URL Modal */}
      {isCloudUrlModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-[2px] animate-in fade-in duration-150 touch-none overscroll-none"
          onClick={() => setIsCloudUrlModalOpen(false)}
        >
          <div 
            className="bg-[#181e29] border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl space-y-3.5 text-left animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-400" />
                <span>{pick('Thêm tệp từ URL vào Cloud', 'Add File from URL to Cloud', '从 URL 添加文件到云端')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCloudUrlModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              {pick('Nhập hoặc dán URL (hình ảnh, tài liệu, video hoặc liên kết) để lưu trực tiếp vào Cloud Drive của bạn:', 'Enter or paste a URL (image, document, video, or link) to save directly to your Cloud Drive:', '输入或粘贴 URL（图片、文档、视频或链接）直接保存到您的云盘：')}
            </p>
            <div className="rounded-xl overflow-hidden bg-[#242b3b] border border-slate-700/70 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all p-2.5">
              <input
                type="url"
                value={cloudUrlModalValue}
                onChange={(e) => setCloudUrlModalValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCloudUrlAdded();
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder:text-slate-500 font-mono"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsCloudUrlModalOpen(false)}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
              >
                {pick('Thoát', 'Cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={handleCloudUrlAdded}
                disabled={uploading}
                className="px-5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <LinkIcon className="w-3.5 h-3.5" />}
                <span>{pick('Lưu vào Cloud', 'Save to Cloud', '保存到云端')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Khung Xem Video Trực Tiếp & IndexedDB Bền Vững */}
      {isPersistentVideoModalOpen && (
        <PersistentVideoPlayerModal
          onClose={() => setIsPersistentVideoModalOpen(false)}
        />
      )}

    </>
  );
};

export const CloudDriveView = React.memo(CloudDriveViewComponent);
