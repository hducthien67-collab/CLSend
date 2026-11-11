import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  FolderOpen,
  Info,
  Link2,
  CheckCircle2,
  UploadCloud,
  Save,
  Trash2,
  X,
  AlertCircle,
  Film,
  Download
} from 'lucide-react';
import { downloadFileSafely } from '../utils/fileDownload';
import { getFileBlobLocally, storeFileBlobLocally } from '../utils/idbStorage';

/* 1. TYPES NỘI BỘ (Không cần file types riêng) */
export interface VideoItem {
  id: string;
  title: string;
  src: string;
  type?: string;
  size?: string;
  resolution?: string;
  isLocal?: boolean;
  blob?: Blob;
}

export interface AllInOneVideoPlayerProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
  initialSrc?: string;
  initialTitle?: string;
  initialFile?: File | Blob;
  initialSize?: string | number;
  onDownload?: () => void;
}

/* 2. HỆ THỐNG LƯU TRỮ INDEXEDDB NỘI BỘ (F5 Không mất, không cần thư viện ngoài) */
const DB_NAME = 'AllInOneVideoDB';
const STORE_NAME = 'saved_videos';

export function openVideoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB không được hỗ trợ'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoToIndexedDB(item: { id: string; title: string; blob: Blob; size: string }): Promise<void> {
  const db = await openVideoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...item, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllSavedVideosFromDB(): Promise<Array<{ id: string; title: string; blob: Blob; size: string }>> {
  const db = await openVideoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteVideoFromIndexedDB(id: string): Promise<void> {
  const db = await openVideoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* 3. VIDEO MẪU SẴN (CORS 100% không bị chặn, CDN phân giải cao mượt mà) */
const DEFAULT_SAMPLES: VideoItem[] = [
  {
    id: 'sample-1',
    title: 'Phim Hoạt Họa W3C (Big Buck Bunny)',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    type: 'video/mp4',
    size: '0.6 MB',
    resolution: '320 × 240',
    isLocal: false,
  },
  {
    id: 'sample-2',
    title: 'Đóa Hoa Nở (Mozilla MDN CC0)',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: 'video/mp4',
    size: '2.5 MB',
    resolution: '640 × 360',
    isLocal: false,
  },
  {
    id: 'sample-3',
    title: 'Đại Dương Xanh (Video.js CDN 100% Mượt)',
    src: 'https://vjs.zencdn.net/v/oceans.mp4',
    type: 'video/mp4',
    size: '46 MB',
    resolution: '1280 × 720 (HD)',
    isLocal: false,
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/* 4. COMPONENT VIDEO CHÍNH (All-In-One Single File Component) */
export default function AllInOneVideoPlayer({
  isOpen = true,
  onClose,
  isEmbedded = false,
  initialSrc = '',
  initialTitle = '',
  initialFile,
  initialSize,
  onDownload
}: AllInOneVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const [playlist, setPlaylist] = useState<VideoItem[]>(DEFAULT_SAMPLES);
  const [currentVideo, setCurrentVideo] = useState<VideoItem>(DEFAULT_SAMPLES[0]);
  const [pendingSaveFile, setPendingSaveFile] = useState<File | Blob | null>(null);
  const [savedDbIds, setSavedDbIds] = useState<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Tab dưới thanh công cụ: 'files' | 'details' | 'url' | 'tips' | null (đóng)
  const [activeBottomTab, setActiveBottomTab] = useState<'files' | 'details' | 'url' | 'tips' | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Đọc danh sách video đã lưu trong IndexedDB khi khởi tạo
  useEffect(() => {
    let isMounted = true;
    getAllSavedVideosFromDB()
      .then((savedItems) => {
        if (!isMounted) return;
        if (savedItems.length > 0) {
          const ids = new Set<string>();
          const loadedVideos: VideoItem[] = savedItems.map((item) => {
            ids.add(item.id);
            return {
              id: item.id,
              title: item.title,
              src: URL.createObjectURL(item.blob),
              type: 'video/mp4',
              size: item.size,
              isLocal: true,
              blob: item.blob,
            };
          });
          setSavedDbIds(ids);
          setPlaylist((prev) => {
            const nonSaved = prev.filter((v) => !ids.has(v.id));
            return [...loadedVideos, ...nonSaved];
          });
        }
      })
      .catch(console.warn);

    return () => {
      isMounted = false;
    };
  }, []);

  // Nạp video ban đầu nếu được truyền qua props (initialFile hoặc initialSrc)
  useEffect(() => {
    let isCancelled = false;

    if (initialFile) {
      try {
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(initialFile);
        activeBlobUrlRef.current = objectUrl;

        const sizeStr = typeof initialSize === 'number'
          ? formatBytes(initialSize)
          : (initialSize || (initialFile.size ? formatBytes(initialFile.size) : ''));

        const titleStr = initialTitle || (initialFile instanceof File ? initialFile.name : 'Video của bạn');
        const videoId = 'file-' + Date.now();

        const initialItem: VideoItem = {
          id: videoId,
          title: titleStr,
          src: objectUrl,
          type: (initialFile as any).type || 'video/mp4',
          size: sizeStr || 'Tệp trên máy',
          isLocal: true,
          blob: initialFile,
        };

        // Tự động lưu vào IndexedDB để lần sau mở lại xem ngay lập tức
        saveVideoToIndexedDB({ id: videoId, title: titleStr, blob: initialFile, size: sizeStr || 'Tệp trên máy' }).catch(() => {});
        storeFileBlobLocally(titleStr, initialFile).catch(() => {});

        setPendingSaveFile(initialFile);
        setCurrentVideo(initialItem);
        setPlaylist((prev) => [initialItem, ...prev.filter((v) => v.id !== initialItem.id)]);
        setPlaybackError(null);
        showToast(`Đã mở "${titleStr}" trực tiếp từ máy của bạn!`);
      } catch (err: any) {
        console.error('Lỗi khi nạp initialFile:', err);
      }
    } else if (initialSrc) {
      const sizeStr = typeof initialSize === 'number' ? formatBytes(initialSize) : (initialSize || 'Trực tuyến');
      const titleStr = initialTitle || initialSrc.split('/').pop()?.split('?')[0] || 'Video trực tuyến';

      // Kiểm tra xem tệp video đã có sẵn trong bộ nhớ IndexedDB chưa (đã tải lên trước đó)
      const lookupKeys = [
        titleStr,
        initialSrc.split('/api/files/view/')[1]?.split('?')[0],
        initialSrc.split('/api/files/download/')[1]?.split('?')[0],
      ].filter(Boolean) as string[];

      (async () => {
        let foundBlob: Blob | null = null;
        for (const k of lookupKeys) {
          try {
            const b = await getFileBlobLocally(k);
            if (b) {
              foundBlob = b;
              break;
            }
          } catch {}
        }

        if (isCancelled) return;

        const isLocalFound = Boolean(foundBlob);
        let resolvedSrc = initialSrc;
        if (foundBlob) {
          if (activeBlobUrlRef.current) URL.revokeObjectURL(activeBlobUrlRef.current);
          resolvedSrc = URL.createObjectURL(foundBlob);
          activeBlobUrlRef.current = resolvedSrc;
        }

        const initialItem: VideoItem = {
          id: 'initial-' + Date.now(),
          title: titleStr,
          src: resolvedSrc,
          type: foundBlob?.type || 'video/mp4',
          size: sizeStr,
          isLocal: isLocalFound || initialSrc.startsWith('blob:'),
          blob: foundBlob || undefined
        };

        if (foundBlob) {
          setPendingSaveFile(foundBlob);
          showToast(`Đã mở "${titleStr}" từ bộ nhớ lưu trữ!`);
        } else {
          showToast(`Đang phát "${titleStr}" từ Kho Cloud...`);
        }

        setCurrentVideo(initialItem);
        setPlaylist((prev) => [initialItem, ...prev.filter((v) => v.id !== initialItem.id)]);
        setPlaybackError(null);
      })();
    }

    return () => {
      isCancelled = true;
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [initialFile, initialSrc, initialTitle, initialSize, showToast]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
    }
  };

  // Tải lại video an toàn khi đổi nguồn
  useEffect(() => {
    const video = videoRef.current;
    if (video && currentVideo.src) {
      video.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      setPlaybackError(null);
      setIsBuffering(false);
      try {
        video.load();
      } catch (e) {
        console.warn('Lỗi load video:', e);
      }
    }
  }, [currentVideo.src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      if (!currentVideo.src) {
        setPlaybackError('Chưa có nguồn video. Vui lòng chọn tệp từ máy tính.');
        return;
      }
      setPlaybackError(null);
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setPlaybackError(null);
          })
          .catch((err: any) => {
            console.warn('Lỗi phát:', err);
            if (err.name === 'NotAllowedError') {
              setPlaybackError('Trình duyệt chặn tự động phát. Hãy bấm nút Play ở giữa để xem.');
            } else if (err.name === 'NotSupportedError' || err.message?.toLowerCase().includes('no supported sources')) {
              setPlaybackError('Nguồn video này đang được chuẩn bị hoặc bị chặn mạng. Hãy thử chọn tệp MP4 trực tiếp từ máy của bạn.');
            } else if (err.name !== 'AbortError') {
              setPlaybackError('Không thể phát video: ' + (err.message || 'Lỗi không xác định'));
            }
            setIsPlaying(false);
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Nạp tệp từ máy tính bằng Blob URL trực tiếp (0-copy GPU Decode, Không bao giờ giật lag hay format error)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      const sizeMB = formatBytes(file.size);
      const newVideo: VideoItem = {
        id: 'local-' + Date.now(),
        title: file.name,
        src: objectUrl,
        type: file.type || 'video/mp4',
        size: sizeMB,
        isLocal: true,
        blob: file,
      };
      setPendingSaveFile(file);
      setPlaylist((prev) => [newVideo, ...prev.filter((v) => v.id !== newVideo.id)]);
      setCurrentVideo(newVideo);
      setPlaybackError(null);
      setIsPlaying(false);
      showToast(`Đã mở "${file.name}" từ máy tính của bạn!`);
    } catch (err: any) {
      setPlaybackError('Lỗi khi nạp tệp: ' + err.message);
    }
  };

  const handleSaveToDB = async () => {
    try {
      // 1. Nếu đã có blob trong RAM / máy tính
      const blobToSave = currentVideo.blob || pendingSaveFile;
      if (blobToSave) {
        const sizeMB = formatBytes(blobToSave.size);
        const id = currentVideo.id.startsWith('saved-') ? currentVideo.id : 'saved-' + Date.now();
        await saveVideoToIndexedDB({ id, title: currentVideo.title, blob: blobToSave, size: sizeMB });
        await storeFileBlobLocally(currentVideo.title, blobToSave);
        setSavedDbIds((prev) => new Set(prev).add(id));
        setSavedDbIds((prev) => new Set(prev).add(currentVideo.id));
        setPendingSaveFile(null);
        showToast('✓ Đã lưu video vĩnh viễn vào bộ nhớ (F5 không mất)!');
        return;
      }

      // 2. Nếu là video từ Cloud Drive / đường dẫn mạng
      if (currentVideo.src && !currentVideo.src.startsWith('blob:')) {
        showToast('Đang tải dữ liệu để lưu vĩnh viễn vào máy...');
        const res = await fetch(currentVideo.src);
        if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ');
        const downloadedBlob = await res.blob();
        const sizeMB = formatBytes(downloadedBlob.size);
        const id = 'saved-' + Date.now();
        await saveVideoToIndexedDB({ id, title: currentVideo.title, blob: downloadedBlob, size: sizeMB });
        await storeFileBlobLocally(currentVideo.title, downloadedBlob);
        setSavedDbIds((prev) => new Set(prev).add(id));
        setSavedDbIds((prev) => new Set(prev).add(currentVideo.id));
        setCurrentVideo((prev) => ({
          ...prev,
          isLocal: true,
          blob: downloadedBlob,
          src: URL.createObjectURL(downloadedBlob)
        }));
        showToast('✓ Đã lưu video vĩnh viễn vào bộ nhớ (F5 không mất)!');
        return;
      }

      showToast('Video này đã được lưu trong bộ nhớ');
    } catch (err: any) {
      console.error('Lỗi khi lưu video vào IndexedDB:', err);
      showToast('Lỗi lưu: ' + (err.message || 'Không thể lưu video'));
    }
  };

  const handleDeleteFromDB = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteVideoFromIndexedDB(id);
      setSavedDbIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPlaylist((prev) => prev.filter((v) => v.id !== id));
      if (currentVideo.id === id) setCurrentVideo(DEFAULT_SAMPLES[0]);
      showToast('Đã xóa video khỏi bộ nhớ');
    } catch (err: any) {
      showToast('Không thể xóa: ' + err.message);
    }
  };

  // TÍNH NĂNG TẢI VIDEO VỀ MÁY TÍNH ("và có thể tải về")
  const handleDownload = () => {
    if (onDownload && currentVideo.id.startsWith('initial-')) {
      onDownload();
      showToast('Đang bắt đầu tải video...');
      return;
    }

    try {
      if (currentVideo.blob) {
        // Tải trực tiếp từ blob trong RAM / máy tính
        const blobUrl = URL.createObjectURL(currentVideo.blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = currentVideo.title.endsWith('.mp4') || currentVideo.title.includes('.')
          ? currentVideo.title
          : `${currentVideo.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        showToast(`Đang tải "${currentVideo.title}" về máy tính...`);
        return;
      }

      if (currentVideo.src) {
        let downloadUrl = currentVideo.src;
        // Chuyển đổi link view sang download an toàn của backend ClSend nếu có
        if (downloadUrl.includes('/api/files/view/')) {
          downloadUrl = downloadUrl.replace('/api/files/view/', '/api/files/download/');
        }

        downloadFileSafely(downloadUrl, currentVideo.title);
        showToast(`Đang tải "${currentVideo.title}"...`);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải video:', err);
      showToast('Không thể tải video: ' + (err.message || 'Lỗi kết nối'));
    }
  };

  const handleLoadCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    const url = customUrlInput.trim();
    const newVideo: VideoItem = {
      id: 'url-' + Date.now(),
      title: url.split('/').pop()?.split('?')[0] || 'Video URL',
      src: url,
      type: 'video/mp4',
      isLocal: false,
    };
    setPlaylist((prev) => [newVideo, ...prev]);
    setCurrentVideo(newVideo);
    setPlaybackError(null);
    setCustomUrlInput('');
    setActiveBottomTab(null);
    showToast('Đã nạp video từ đường dẫn mạng!');
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleBottomTab = (tab: 'files' | 'details' | 'url' | 'tips') => {
    setActiveBottomTab((prev) => (prev === tab ? null : tab));
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeekPos(ratio * 100);
    setHoverSeekTime(ratio * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverSeekTime(null);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Keyboard controls (Space: play/pause, Arrow Left/Right: seek, M: mute, F: fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      } else if (e.key === 'm' || e.key === 'M') {
        if (videoRef.current) {
          videoRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, isMuted, isPlaying]);

  if (!isOpen) return null;

  const playedPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const videoCardContent = (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-5xl mx-auto transition-all select-none relative"
    >
      <input ref={fileInputRef} type="file" accept="video/*,.mp4,.webm,.mov,.ogg,.mkv" onChange={handleFileUpload} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-950/95 border-b border-slate-800 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold truncate max-w-xs sm:max-w-md">{currentVideo.title}</h2>
              {currentVideo.isLocal ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Tệp trên máy
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                  Trực tuyến
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {currentVideo.resolution || 'Tự động thích ứng'} • {currentVideo.size || 'Stream'} • GPU Decode Không Giật Lag
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Nút Tải Về Trực Tiếp */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors shadow-sm cursor-pointer"
            title="Tải video này về máy tính"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline-block">Tải về</span>
          </button>



          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer group"
              title="Thoát xem video"
            >
              <span className="hidden sm:inline-block">Thoát</span>
              <X className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            </button>
          )}
        </div>
      </div>

      {/* Banner thông báo trạng thái màu xanh ngọc đồng bộ với ảnh mẫu */}
      {notification && (
        <div className="w-full px-4 py-2 bg-emerald-950/80 text-emerald-300 border-b border-emerald-500/30 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{notification}</span>
        </div>
      )}

      {/* Màn hình video tỉ lệ 16:9 ở chính giữa */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group select-none">
        {playbackError && (
          <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Không thể phát tệp video này</h3>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-4">{playbackError}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer flex items-center gap-1.5"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Chọn lại tệp từ máy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentVideo(DEFAULT_SAMPLES[0]);
                  setPlaybackError(null);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Xem video mẫu
              </button>
            </div>
          </div>
        )}

        {/* Vòng xoay đệm: Chỉ hiện khi thực sự đang phát mà mạng bị khựng, KHÔNG BAO GIỜ hiện khi đang tạm dừng hoặc chưa bấm phát */}
        {isBuffering && isPlaying && !playbackError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-xs text-indigo-300 font-medium bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-700">Đang đồng bộ luồng...</span>
            </div>
          </div>
        )}

        <video
          key={currentVideo.src}
          ref={videoRef}
          src={currentVideo.src}
          preload="auto"
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              setIsBuffering(false);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setPlaybackError(null);
              setIsBuffering(false);
              if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
                const res = `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}`;
                setCurrentVideo((prev) => ({ ...prev, resolution: res }));
              }
            }
          }}
          onLoadedData={() => {
            setIsBuffering(false);
          }}
          onCanPlay={() => {
            setIsBuffering(false);
          }}
          onCanPlayThrough={() => {
            setIsBuffering(false);
          }}
          onSeeked={() => {
            setIsBuffering(false);
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onWaiting={() => {
            if (videoRef.current && !videoRef.current.paused) {
              setIsBuffering(true);
            }
          }}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setPlaybackError(null);
          }}
          onPause={() => {
            setIsPlaying(false);
            setIsBuffering(false);
          }}
          onError={() => {
            setPlaybackError('Trình duyệt không hỗ trợ giải mã trực tiếp codec này hoặc đường truyền bị gián đoạn. Bạn có thể bấm nút "Tải về" để xem trên máy bằng VLC/Media Player hoặc chọn tệp MP4 chuẩn.');
            setIsBuffering(false);
            setIsPlaying(false);
          }}
          className="w-full h-full object-contain cursor-pointer"
        />

        {!isPlaying && !playbackError && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute z-10 w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/30 transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
          >
            <Play className="w-8 h-8 translate-x-0.5 fill-current" />
          </button>
        )}

        {/* 🎬 THANH TIẾN TRÌNH MINI Ở ĐÁY KHI CONTROLS TỰ ẨN (Luôn biết đã xem tới đâu) */}
        {!showControls && isPlaying && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40 z-10 pointer-events-none">
            <div
              className="h-full bg-indigo-500 shadow-xs transition-all duration-100"
              style={{ width: `${playedPercent}%` }}
            />
          </div>
        )}

        {/* Thanh điều khiển video */}
        <div
          className={`absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-10 transition-opacity duration-300 flex flex-col gap-2 ${
            showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* 🌟 THANH TIẾN TRÌNH TRỰC QUAN (Xem video tới đâu với chấm tròn tím & nhãn thời gian) */}
          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            onMouseMove={handleProgressBarMouseMove}
            onMouseLeave={handleProgressBarMouseLeave}
            className="relative group/bar py-2 flex items-center cursor-pointer select-none"
          >
            {/* Tooltip thời gian khi di chuột xem trước */}
            {hoverSeekTime !== null && (
              <div
                className="absolute bottom-6 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900/95 border border-slate-700 text-[10px] font-mono text-white pointer-events-none shadow-xl z-30 transition-opacity whitespace-nowrap"
                style={{ left: `${hoverSeekPos}%` }}
              >
                {formatTime(hoverSeekTime)}
              </div>
            )}

            {/* Thanh ray (Track nền) */}
            <div className="relative w-full h-1.5 group-hover/bar:h-2 bg-white/25 rounded-full overflow-hidden transition-all duration-150">
              {/* Phần đã phát (Played Progress - màu tím/xanh nổi bật) */}
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-75 relative"
                style={{ width: `${playedPercent}%` }}
              />
            </div>

            {/* 🟣 CHẤM TRÒN ĐIỂM DỪNG (Scrubber Thumb / Knob) - Cho biết mình đã xem tới đâu */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-md shadow-indigo-600/60 pointer-events-none group-hover/bar:scale-125 transition-transform"
              style={{ left: `${playedPercent}%` }}
            />

            {/* Input range ẩn mượt mà để kéo thả tua mượt mà */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              step={0.1}
              onChange={(e) => {
                const target = parseFloat(e.target.value);
                setCurrentTime(target);
                if (videoRef.current) videoRef.current.currentTime = target;
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs pt-1">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" title="Phát / Tạm dừng (Space)">
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                title="Lùi 10s (Phím mũi tên trái)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                title="Tua 10s (Phím mũi tên phải)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 group/vol ml-1">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.muted = !isMuted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                  title="Bật/Tắt âm thanh (Phím M)"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    setIsMuted(val === 0);
                    if (videoRef.current) videoRef.current.volume = val;
                  }}
                  className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <span className="font-mono text-[11px] text-slate-300 ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Nút tải về nhanh trên thanh điều khiển */}
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 text-[11px]"
                title="Tải video này"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  const rates = [1, 1.25, 1.5, 2];
                  const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                  const nextRate = rates[nextIdx];
                  setPlaybackRate(nextRate);
                  if (videoRef.current) videoRef.current.playbackRate = nextRate;
                }}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold cursor-pointer"
                title="Tốc độ phát"
              >
                {playbackRate}x
              </button>
              <button
                onClick={() => {
                  if (!document.fullscreenElement) {
                    containerRef.current?.requestFullscreen?.();
                  } else {
                    document.exitFullscreen?.();
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                title="Toàn màn hình (Phím F)"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) return videoCardContent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="my-auto w-full max-w-5xl flex items-center justify-center">
        {videoCardContent}
      </div>
    </div>
  );
}

export { AllInOneVideoPlayer };
