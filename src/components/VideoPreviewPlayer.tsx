import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Film,
  FolderOpen
} from 'lucide-react';
import { getFileBlobLocally } from '../utils/idbStorage';
import { formatFileSize } from '../utils/device';
import { downloadFileSafely } from '../utils/fileDownload';
import { getVideoWebWatchUrl } from '../utils/videoWatch';

interface VideoPreviewPlayerProps {
  src?: string;
  fallbackUrl?: string;
  file?: File | Blob;
  fileId?: string;
  fileName: string;
  fileSize?: number;
  autoPlay?: boolean;
  className?: string;
  onDownload?: () => void;
  onReupload?: () => void;
  onFileSelected?: (file: File) => void;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  src,
  fallbackUrl,
  file,
  fileId,
  fileName,
  fileSize,
  autoPlay = false,
  className = '',
  onDownload,
  onReupload,
  onFileSelected
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorReason, setErrorReason] = useState<string>('');
  const [isLocalFile, setIsLocalFile] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [triedIdb, setTriedIdb] = useState<boolean>(false);
  const [triedFallback, setTriedFallback] = useState<boolean>(false);
  const blobUrlRef = useRef<string | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const isMkvOrAvi = ['mkv', 'avi', 'flv', 'wmv'].includes(ext);

  const webWatchUrl = getVideoWebWatchUrl({
    url: resolvedSrc || src || fallbackUrl,
    viewUrl: src,
    name: fileName,
    id: fileId
  });

  // Initialize or update source
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorReason('');
    setTriedIdb(false);
    setTriedFallback(false);
    setIsLocalFile(false);

    // 1. Direct File / Blob has highest priority (0-latency instant playback from memory)
    if (file) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      blobUrlRef.current = url;
      setResolvedSrc(url);
      setIsLocalFile(true);
      return;
    }

    // 2. Otherwise use the provided network URL
    if (src) {
      setResolvedSrc(src);
    } else if (fallbackUrl) {
      setResolvedSrc(fallbackUrl);
    } else {
      // Try IDB directly if no source provided
      attemptIdbRecovery();
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, fallbackUrl, file, fileId]);

  const attemptIdbRecovery = async (): Promise<boolean> => {
    if (triedIdb) return false;
    setTriedIdb(true);

    const candidateKeys: string[] = [];
    if (fileId) candidateKeys.push(fileId);
    if (src) {
      if (src.includes('/api/files/download/')) {
        const k = src.split('/api/files/download/')[1]?.split('?')[0];
        if (k) candidateKeys.push(k);
      }
      if (src.includes('/api/files/view/')) {
        const k = src.split('/api/files/view/')[1]?.split('?')[0];
        if (k) candidateKeys.push(k);
      }
    }
    if (fallbackUrl) {
      if (fallbackUrl.includes('/api/files/download/')) {
        const k = fallbackUrl.split('/api/files/download/')[1]?.split('?')[0];
        if (k) candidateKeys.push(k);
      }
    }
    if (fileName) candidateKeys.push(fileName);

    for (const key of candidateKeys) {
      if (!key) continue;
      try {
        const localBlob = await getFileBlobLocally(key);
        if (localBlob) {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const objUrl = URL.createObjectURL(localBlob);
          blobUrlRef.current = objUrl;
          setResolvedSrc(objUrl);
          setIsLocalFile(true);
          setHasError(false);
          setIsLoading(false);
          return true;
        }
      } catch (e) {
        console.warn('IDB video recovery notice:', e);
      }
    }
    return false;
  };

  const handleVideoError = async () => {
    // 1. Try local IndexedDB store if not tried yet
    const recovered = await attemptIdbRecovery();
    if (recovered) return;

    // 2. Try alternate URL (e.g. download route vs view route)
    if (!triedFallback) {
      setTriedFallback(true);
      if (fallbackUrl && fallbackUrl !== resolvedSrc) {
        setResolvedSrc(fallbackUrl);
        return;
      }
      if (resolvedSrc.includes('/api/files/view/')) {
        const dlUrl = resolvedSrc.replace('/api/files/view/', '/api/files/download/');
        setResolvedSrc(dlUrl);
        return;
      }
    }

    // 3. Mark final error state
    setIsLoading(false);
    setHasError(true);
    if (isMkvOrAvi) {
      setErrorReason(`Định dạng video .${ext.toUpperCase()} chứa codec nâng cao mà trình duyệt web chưa hỗ trợ giải mã trực tiếp. Hãy tải video về máy để xem mượt mà bằng VLC hoặc Windows Media Player.`);
    } else {
      setErrorReason('Video này chưa có tệp dữ liệu trên máy chủ (do bộ nhớ tạm của máy chủ đã được làm mới). Hãy bấm nút dưới đây để chọn tệp từ máy của bạn: video sẽ phát ngay lập tức và tự động đồng bộ lại vào Kho Cloud!');
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    setErrorReason('');
    setTriedIdb(false);
    setTriedFallback(false);
    if (src) {
      setResolvedSrc(`${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`);
    }
  };

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload();
    } else {
      downloadFileSafely(resolvedSrc || src || fallbackUrl || '', fileName);
    }
  };

  return (
    <div className={`relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-black/95 border border-slate-800 shadow-2xl group ${className}`}>
      {/* Top Action Bar with Direct Standalone Web Player Link */}
      <div className="w-full px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate">{fileName}</span>
          {fileSize ? (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({formatFileSize(fileSize)})
            </span>
          ) : null}
        </div>
        <a
          href={webWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-emerald-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
          title="Mở video trong tab Web riêng để xem siêu mượt mà không bị gián đoạn luồng"
        >
          <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Mở xem trên Web riêng ↗</span>
        </a>
      </div>

      {/* Video element */}
      {!hasError && resolvedSrc ? (
        <div className="relative w-full aspect-video max-h-[70vh] flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={resolvedSrc}
            controls
            autoPlay={autoPlay}
            playsInline
            preload="metadata"
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => setIsLoading(false)}
            onLoadedData={() => setIsLoading(false)}
            onCanPlay={() => setIsLoading(false)}
            onError={handleVideoError}
            className="w-full h-full object-contain"
          />

          {/* Local storage badge */}
          {isLocalFile && (
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-emerald-500/90 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 z-20 pointer-events-none backdrop-blur-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-pulse" />
              <span>{isSyncing ? 'Đang phát từ máy • Đang lưu lên Cloud...' : 'Đang phát trực tiếp từ máy của bạn'}</span>
            </div>
          )}

          {/* Subtle Corner Buffering Indicator - Never blacks out the video frame */}
          {isLoading && (
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/85 border border-slate-700/80 text-emerald-300 font-mono text-xs flex items-center gap-2 pointer-events-none backdrop-blur-md z-20 shadow-lg">
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Đang đệm...</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Error Fallback Card */}
      {hasError && (
        <div className="w-full min-h-[350px] aspect-video max-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 via-slate-950 to-black space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-xl">
            <Film className="w-8 h-8" />
          </div>

          <div className="max-w-lg space-y-2">
            <h4 className="text-base sm:text-lg font-bold text-white truncate px-2" title={fileName}>
              {fileName}
            </h4>
            {fileSize ? (
              <p className="text-xs text-emerald-400 font-mono font-semibold">{formatFileSize(fileSize)}</p>
            ) : null}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed px-4">
              {errorReason}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-2 w-full max-w-md">
            <input
              ref={localInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
                  const url = URL.createObjectURL(f);
                  blobUrlRef.current = url;
                  setResolvedSrc(url);
                  setIsLocalFile(true);
                  setHasError(false);
                  setIsLoading(false);
                  if (onFileSelected) {
                    setIsSyncing(true);
                    onFileSelected(f);
                    setTimeout(() => setIsSyncing(false), 8000);
                  }
                }
              }}
            />

            <button
              type="button"
              onClick={() => localInputRef.current?.click()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Chọn video từ máy để XEM NGAY & LƯU</span>
            </button>

            <div className="flex items-center gap-2">
              {onReupload && (
                <button
                  type="button"
                  onClick={onReupload}
                  className="px-4 py-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tải bù dữ liệu lên Cloud</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReload}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
