import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  X,
  FolderOpen,
  Save,
  Trash2,
  CheckCircle2,
  Film,
  ExternalLink,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { formatFileSize } from '../utils/device';
import { getVideoWebWatchUrl } from '../utils/videoWatch';

// Xác định chính xác MIME type từ tên tệp video để tránh lỗi định dạng (Format error)
function getVideoMimeType(fileName: string, originalType?: string): string {
  if (originalType && originalType.startsWith('video/')) return originalType;
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'mp4':
    case 'm4v':
    case 'mp4v':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case '3gp':
      return 'video/3gpp';
    case 'flv':
      return 'video/x-flv';
    case 'wmv':
      return 'video/x-ms-wmv';
    case 'ogv':
    case 'ogg':
      return 'video/ogg';
    case 'ts':
      return 'video/mp2t';
    default:
      return 'video/mp4';
  }
}

// Quản lý lưu trữ IndexedDB bền vững cho Video (F5 không mất)
const DB_NAME = 'MyWebVideoDB';
const STORE_NAME = 'videos';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SavedVideoItem {
  id: string;
  title: string;
  blob: Blob;
  size?: number;
  savedAt?: number;
}

interface PersistentVideoPlayerModalProps {
  initialSrc?: string;
  initialTitle?: string;
  initialFile?: File | Blob;
  onClose?: () => void;
}

export const PersistentVideoPlayerModal: React.FC<PersistentVideoPlayerModalProps> = ({
  initialSrc = '',
  initialTitle = '',
  initialFile,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [currentTitle, setCurrentTitle] = useState<string>(initialTitle || 'Chưa chọn video');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [savedList, setSavedList] = useState<SavedVideoItem[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Làm sạch ObjectURL khi unmount hoặc đổi video
  const cleanActiveBlobUrl = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  // Tải danh sách video đã lưu trong IndexedDB khi mở component
  const loadSaved = useCallback(async () => {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = async () => {
        const items = (req.result || []) as SavedVideoItem[];
        
        // Filter out corrupted 0-byte or empty blobs and clean them from IDB
        const validItems: SavedVideoItem[] = [];
        for (const item of items) {
          const rawBlob = item.blob;
          const isValid = rawBlob && (rawBlob instanceof Blob ? rawBlob.size > 0 : (rawBlob as any).size > 0 || (rawBlob as any).length > 0);
          if (isValid) {
            validItems.push(item);
          } else {
            try {
              store.delete(item.id);
            } catch {}
          }
        }

        setSavedList(validItems);

        // Nếu chưa có nguồn video nào đang phát và có tệp đã lưu hợp lệ -> tự chọn video đầu tiên
        if (!currentSrc && validItems.length > 0) {
          cleanActiveBlobUrl();
          const rawBlob = validItems[0].blob;
          const mime = getVideoMimeType(validItems[0].title, (rawBlob as any).type);
          const safeBlob = rawBlob instanceof Blob ? new Blob([rawBlob], { type: mime }) : new Blob([rawBlob as any], { type: mime });
          const objUrl = URL.createObjectURL(safeBlob);
          activeBlobUrlRef.current = objUrl;
          setCurrentSrc(objUrl);
          setCurrentTitle(validItems[0].title);
        }
      };
    } catch (e) {
      console.warn('Lỗi đọc IndexedDB:', e);
    }
  }, [currentSrc, cleanActiveBlobUrl]);

  useEffect(() => {
    loadSaved();
    return () => {
      cleanActiveBlobUrl();
    };
  }, [loadSaved, cleanActiveBlobUrl]);

  // Nếu có initialFile được truyền vào (từ Cloud Drive hoặc SendView)
  useEffect(() => {
    if (initialFile) {
      cleanActiveBlobUrl();
      const mime = getVideoMimeType(initialTitle || (initialFile as File).name || 'video.mp4', initialFile.type);
      const safeBlob = initialFile instanceof Blob ? new Blob([initialFile], { type: mime }) : new Blob([initialFile], { type: mime });
      const objUrl = URL.createObjectURL(safeBlob);
      activeBlobUrlRef.current = objUrl;
      setCurrentSrc(objUrl);
      if (initialTitle) setCurrentTitle(initialTitle);
      if (initialFile instanceof File || initialFile instanceof Blob) {
        setPendingFile(initialFile as File);
      }
    }
  }, [initialFile, initialTitle, cleanActiveBlobUrl]);

  // Reload video element when currentSrc changes
  useEffect(() => {
    if (videoRef.current && currentSrc) {
      videoRef.current.load();
    }
  }, [currentSrc]);

  // Đóng modal bằng phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Khi chọn file từ máy tính: Tạo Object URL phát mượt ngay tức thì
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      cleanActiveBlobUrl();
      const mime = getVideoMimeType(file.name, file.type);
      const safeBlob = new Blob([file], { type: mime });
      const objectUrl = URL.createObjectURL(safeBlob);
      activeBlobUrlRef.current = objectUrl;

      setPendingFile(file);
      setCurrentSrc(objectUrl);
      setCurrentTitle(file.name);
      setErrorMsg(null);
      setIsPlaying(true);
      showToast(`Đã mở "${file.name}" trực tiếp từ máy của bạn!`);

      // Tự động phát sau khi nạp nguồn
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => setIsPlaying(false));
        }
      }, 100);
    } catch (err: any) {
      setErrorMsg('Không thể mở tệp: ' + err.message);
    }
  };

  // Lưu bền vững vào IndexedDB (F5 không mất)
  const saveToDB = async () => {
    if (!pendingFile) return;
    setIsSaving(true);
    try {
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist().catch(() => {});
      }
      const db = await getDB();
      const mime = getVideoMimeType(pendingFile.name, pendingFile.type);
      const cleanBlob = new Blob([pendingFile], { type: mime });
      const item: SavedVideoItem = {
        id: 'vid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: pendingFile.name,
        blob: cleanBlob,
        size: pendingFile.size,
        savedAt: Date.now()
      };
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => {
        setIsSaving(false);
        setPendingFile(null);
        loadSaved();
        showToast('Đã lưu video vĩnh viễn vào IndexedDB! Tải lại trang (F5) sẽ không bị mất.');
      };
      tx.onerror = () => {
        setIsSaving(false);
        setErrorMsg('Lỗi khi ghi dữ liệu vào IndexedDB.');
      };
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg('Không thể lưu vào IndexedDB: ' + (err?.message || err));
    }
  };

  // Xóa video khỏi IndexedDB
  const deleteFromDB = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        loadSaved();
        showToast('Đã xóa video khỏi bộ nhớ lưu tạm IndexedDB.');
      };
    } catch (err: any) {
      console.warn('Lỗi xóa khỏi IndexedDB:', err);
    }
  };

  // Phát một video từ danh sách đã lưu
  const playSavedItem = (item: SavedVideoItem) => {
    cleanActiveBlobUrl();
    const rawBlob = item.blob;
    const mime = getVideoMimeType(item.title, (rawBlob as any).type);
    const safeBlob = rawBlob instanceof Blob ? new Blob([rawBlob], { type: mime }) : new Blob([rawBlob as any], { type: mime });
    const objUrl = URL.createObjectURL(safeBlob);
    activeBlobUrlRef.current = objUrl;
    setCurrentSrc(objUrl);
    setCurrentTitle(item.title);
    setPendingFile(null);
    setErrorMsg(null);
    setIsPlaying(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      }
    }, 100);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const webWatchUrl = getVideoWebWatchUrl({
    url: currentSrc,
    name: currentTitle
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-950 text-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input file ẩn từ máy tính */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.3gp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 🔴 HEADER: Tiêu đề tệp & Nút hành động */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-slate-800/80 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Film className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md text-slate-100" title={currentTitle}>
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Nút lưu vĩnh viễn vào IndexedDB */}
            {pendingFile && (
              <button
                type="button"
                onClick={saveToDB}
                disabled={isSaving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                title="Lưu video vào bộ nhớ trình duyệt để không bị mất khi F5"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lưu vĩnh viễn (F5 không mất)</span>
                <span className="sm:hidden">Lưu F5</span>
              </button>
            )}

            {/* Nút mở tệp máy tính */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Chọn file video bất kỳ trên máy tính để phát ngay"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở tệp máy tính</span>
              <span className="sm:hidden">Chọn tệp</span>
            </button>

            {/* Nút mở tab Web riêng */}
            {currentSrc && (
              <a
                href={webWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
                title="Mở video trong tab Web riêng biệt"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Nút đóng Modal */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng khung xem video"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Thông báo Toast ngắn */}
        {toastMessage && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 flex items-center gap-2 text-xs text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 🎬 MÀN HÌNH PHÁT VIDEO */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-xs text-rose-300 bg-slate-950/95 rounded-2xl border border-rose-500/30 flex flex-col items-center gap-2 max-w-md mx-4">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-3 py-1.5 bg-indigo-600 rounded-lg text-white font-medium"
              >
                Chọn lại tệp khác từ máy
              </button>
            </div>
          ) : currentSrc ? (
            <video
              ref={videoRef}
              src={currentSrc}
              playsInline
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
              onError={(e) => {
                const err = videoRef.current?.error;
                console.warn('Video playback error details:', err?.code, err?.message);
                setErrorMsg('Không thể phát video này (Mã lỗi: ' + (err?.code || 'unknown') + '). Định dạng có thể không được trình duyệt giải mã.');
              }}
              className="w-full h-full object-contain cursor-pointer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-500">
              <Film className="w-10 h-10 text-slate-600" />
              <p className="text-xs text-slate-400">Chưa có video được chọn.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Mở tệp từ máy tính để xem ngay</span>
              </button>
            </div>
          )}
        </div>

        {/* 🎛️ THANH ĐIỀU KHIỂN DƯỚI */}
        <div className="p-3 sm:p-3.5 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-2 text-xs">
          {/* Thanh tua thời gian */}
          <div className="flex items-center gap-3 w-full">
            <span className="font-mono text-[11px] text-slate-400 w-11 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="font-mono text-[11px] text-slate-400 w-11">
              {formatTime(duration)}
            </span>
          </div>

          {/* Hàng nút bấm Play, Volume, Fullscreen */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.requestFullscreen) {
                      videoRef.current.requestFullscreen();
                    } else if ((videoRef.current as any).webkitRequestFullscreen) {
                      (videoRef.current as any).webkitRequestFullscreen();
                    }
                  }
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Toàn màn hình (F)"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 💾 DANH SÁCH VIDEO ĐÃ LƯU TRONG INDEXEDDB (F5 không mất) */}
        {savedList.length > 0 && (
          <div className="p-3.5 bg-slate-950/90 border-t border-slate-800/80 max-h-44 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Video đã lưu offline ({savedList.length} tệp • {(savedList.reduce((acc, cur) => acc + (cur.size || cur.blob?.size || 0), 0) / (1024 * 1024)).toFixed(1)} MB):
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">🔒 Lưu vĩnh viễn (F5 không mất)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {savedList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => playSavedItem(item)}
                  className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between text-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-200 group-hover:text-white" title={item.title}>
                        {item.title}
                      </p>
                      {item.size ? (
                        <p className="text-[10px] text-slate-500 font-mono">
                          {formatFileSize(item.size)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => deleteFromDB(item.id, e)}
                    className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800 ml-1 transition-colors"
                    title="Xóa khỏi IndexedDB"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersistentVideoPlayerModal;
