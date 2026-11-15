import React, { useState, useEffect, useRef } from 'react';
import { Play, AlertCircle, RefreshCw, ExternalLink, Download, Film } from 'lucide-react';
import { getFileBlobLocally } from '../utils/idbStorage';
import { downloadFileSafely } from '../utils/fileDownload';
import { formatFileSize } from '../utils/fileUpload';
import { useLanguage } from '../context/LanguageContext';

interface ChatInlineVideoPlayerProps {
  src: string;
  downloadUrl?: string;
  poster?: string;
  fileName: string;
  fileSize?: number;
  messageId?: string;
  compact?: boolean;
  onOpenFullPlayer: () => void;
}

function extractLookupKeys(src: string, fileName: string): string[] {
  const keys: string[] = [];
  if (fileName) keys.push(fileName);
  try {
    if (src.includes('/api/files/view/')) {
      const id = decodeURIComponent(src.split('/api/files/view/')[1]?.split('?')[0] || '');
      if (id) keys.push(id);
    } else if (src.includes('/api/files/download/')) {
      const id = decodeURIComponent(src.split('/api/files/download/')[1]?.split('?')[0] || '');
      if (id) keys.push(id);
    }
    if (src.includes('fileId=')) {
      const urlObj = new URL(src, 'http://localhost');
      const fid = urlObj.searchParams.get('fileId');
      if (fid) keys.push(fid);
    }
  } catch {}
  return Array.from(new Set(keys.filter(Boolean)));
}

const ChatInlineVideoPlayerComponent: React.FC<ChatInlineVideoPlayerProps> = ({
  src,
  downloadUrl,
  poster,
  fileName,
  fileSize,
  compact = false,
  onOpenFullPlayer,
}) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localBlobUrlRef = useRef<string | null>(null);

  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsPlaying(false);
    setIsBuffering(false);
    setIsReady(false);

    let cancelled = false;
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
      setResolvedSrc(src);
      return;
    }

    const keys = extractLookupKeys(src, fileName);
    if (keys.length === 0) {
      setResolvedSrc(src);
      return;
    }

    const tryQuickIdb = async (): Promise<Blob | null> => {
      for (const k of keys) {
        try {
          const blob = await getFileBlobLocally(k);
          if (blob && blob.size > 0) return blob;
        } catch {}
      }
      return null;
    };

    (async () => {
      const foundBlob = await Promise.race([
        tryQuickIdb(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60)),
      ]);
      if (cancelled) return;
      if (foundBlob) {
        if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
        const blobUrl = URL.createObjectURL(foundBlob);
        localBlobUrlRef.current = blobUrl;
        setResolvedSrc(blobUrl);
      } else {
        setResolvedSrc(src);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, fileName]);

  useEffect(() => {
    return () => {
      if (localBlobUrlRef.current) {
        URL.revokeObjectURL(localBlobUrlRef.current);
        localBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleOverlayPlay = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el || !resolvedSrc) return;

    setHasError(false);
    setIsBuffering(true);
    try {
      if (el.readyState === 0) {
        el.load();
      }
      await el.play();
      setIsPlaying(true);
      setIsBuffering(false);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        try {
          el.muted = true;
          await el.play();
          setIsPlaying(true);
          setIsBuffering(false);
          return;
        } catch {}
      }
      setIsBuffering(false);
      if (err?.name !== 'AbortError') {
        setIsPlaying(false);
        if (err?.name === 'NotSupportedError') {
          setHasError(true);
        }
      }
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setIsBuffering(true);
    setIsReady(false);
    setRetrySeed((prev) => prev + 1);
    const el = videoRef.current;
    if (el) {
      try {
        el.load();
        el.play().catch(() => {});
      } catch {}
    }
  };

  const effectiveDownload = downloadUrl || resolvedSrc;

  return (
    <div className="rounded-xl overflow-hidden bg-black/90 border border-slate-700/80 shadow-md">
      <div
        className={`relative group/vid bg-black ${compact ? 'max-h-64' : 'max-h-80'} min-h-[168px] w-full flex items-center justify-center overflow-hidden`}
      >
        {resolvedSrc && !hasError ? (
          <>
            <video
              key={`${resolvedSrc}_${retrySeed}`}
              ref={videoRef}
              src={resolvedSrc}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              {...({ 'webkit-playsinline': 'true', 'x-webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' } as any)}
              onLoadStart={() => {
                if (isPlaying) setIsBuffering(true);
              }}
              onLoadedMetadata={() => {
                setIsReady(true);
                setHasError(false);
              }}
              onTimeUpdate={() => {
                const el = videoRef.current;
                if (el && !el.paused && !el.ended) {
                  setIsPlaying(true);
                  setIsBuffering(false);
                }
              }}
              onWaiting={() => {
                if (videoRef.current && !videoRef.current.paused) {
                  setIsBuffering(true);
                }
              }}
              onCanPlay={() => {
                setIsReady(true);
                setIsBuffering(false);
              }}
              onPlay={() => {
                setIsPlaying(true);
                setHasError(false);
              }}
              onPlaying={() => {
                setIsBuffering(false);
                setIsPlaying(true);
                setHasError(false);
                setIsReady(true);
              }}
              onPause={() => {
                setIsPlaying(false);
                setIsBuffering(false);
              }}
              onEnded={() => {
                setIsPlaying(false);
                setIsBuffering(false);
              }}
              onError={async () => {
                // Before showing error, verify if IndexedDB has a local cached copy under fileName/fileId
                if (!resolvedSrc.startsWith('blob:')) {
                  const keys = extractLookupKeys(src, fileName);
                  for (const k of keys) {
                    try {
                      const blob = await getFileBlobLocally(k);
                      if (blob && blob.size > 0) {
                        if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
                        const blobUrl = URL.createObjectURL(blob);
                        localBlobUrlRef.current = blobUrl;
                        setResolvedSrc(blobUrl);
                        setHasError(false);
                        setIsBuffering(false);
                        return;
                      }
                    } catch {}
                  }
                }
                setIsBuffering(false);
                setIsPlaying(false);
                setHasError(true);
              }}
              className={`w-full ${compact ? 'max-h-64' : 'max-h-80'} object-contain bg-black`}
            />

            {!isPlaying && !isBuffering && (
              <div
                onClick={handleOverlayPlay}
                className="absolute inset-x-0 top-0 bottom-12 flex items-center justify-center pointer-events-auto cursor-pointer z-10 bg-black/15"
                title={t('player.click_to_play', 'Bấm để phát video')}
              >
                <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-emerald-500/95 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95">
                  <Play className="w-6 h-6 translate-x-0.5 fill-current" />
                </div>
              </div>
            )}

            {isBuffering && (
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] font-medium text-emerald-300 flex items-center gap-1.5 pointer-events-none z-10">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>{isReady ? t('player.syncing_stream', 'Đang đồng bộ luồng...') : t('player.loading_video', 'Đang tải video...')}</span>
              </div>
            )}
          </>
        ) : hasError ? (
          <div className="p-4 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <p className="text-[11px] font-semibold text-slate-200 max-w-[240px]">
              {t('player.stream_failed', 'Không thể tải luồng video trực tiếp.')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
              <button
                type="button"
                onClick={handleRetry}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('player.retry', 'Thử lại')}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullPlayer();
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t('player.open_large', 'Phát lớn')}</span>
              </button>
              {effectiveDownload && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadFileSafely(effectiveDownload, fileName || 'video.mp4');
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('player.download', 'Tải về')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            {t('player.video_not_ready', 'Video chưa sẵn sàng để phát trực tuyến.')}
          </div>
        )}
      </div>

      <div className="p-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Film className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[200px]">
              {fileName || 'Video'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {formatFileSize(fileSize || 0)} • {t('player.video_label', 'Video')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(resolvedSrc || src) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullPlayer();
              }}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-[11px] font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title={t('player.open_large', 'Phát lớn')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('player.open_large', 'Phát lớn')}</span>
            </button>
          )}
          {effectiveDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadFileSafely(effectiveDownload, fileName || 'video.mp4');
              }}
              className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-white transition-colors shrink-0 cursor-pointer shadow-sm flex items-center justify-center"
              title={t('player.download', 'Tải về')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChatInlineVideoPlayer = React.memo(ChatInlineVideoPlayerComponent);
export default ChatInlineVideoPlayer;
