import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, RefreshCw, Download, Film } from 'lucide-react';

interface ChatMediaImageProps {
  src: string;
  backupSrc?: string;
  alt: string;
  className?: string;
  isGif?: boolean;
  minHeightClass?: string;
  onDownload?: (e: React.MouseEvent) => void;
}

export const ChatMediaImage: React.FC<ChatMediaImageProps> = ({
  src,
  backupSrc,
  alt,
  className = '',
  isGif = false,
  minHeightClass = 'min-h-[120px] min-w-[180px]',
  onDownload
}) => {
  const [activeSrc, setActiveSrc] = useState<string>(src);
  const [triedBackup, setTriedBackup] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [renderAsVideo, setRenderAsVideo] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(() => Boolean(src && src.startsWith('data:image/')));
  const prevSrcRef = useRef<string>(src);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (prevSrcRef.current === src) {
      // Check if cached image already finished loading synchronously
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setIsLoaded(true);
        setHasError(false);
      }
      return;
    }
    prevSrcRef.current = src;
    setActiveSrc(src);
    setTriedBackup(false);
    setRetryCount(0);
    setRenderAsVideo(false);
    setHasError(false);
    setIsLoaded(Boolean(src && src.startsWith('data:image/')));
  }, [src]);

  // Also detect synchronous cache completion whenever activeSrc or retryCount updates
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setIsLoaded(true);
      setHasError(false);
    }
  }, [activeSrc, retryCount]);

  const handleImageError = async () => {
    if (!triedBackup && backupSrc && backupSrc !== activeSrc) {
      setTriedBackup(true);
      setActiveSrc(backupSrc);
      return;
    }

    if (isGif && !renderAsVideo && activeSrc && !activeSrc.startsWith('data:image/')) {
      try {
        const headRes = await fetch(activeSrc, { method: 'HEAD' });
        const ct = (headRes.headers.get('content-type') || '').toLowerCase();
        if (ct.startsWith('video/')) {
          setRenderAsVideo(true);
          setHasError(false);
          return;
        }
      } catch {
        setRenderAsVideo(true);
        setHasError(false);
        return;
      }
    }

    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`w-full ${minHeightClass} bg-slate-900/90 flex flex-col items-center justify-center gap-2 p-4 text-center`}
      >
        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          {isGif ? <Film className="w-4 h-4 text-emerald-400" /> : <ImageIcon className="w-4 h-4 text-sky-400" />}
        </div>
        <p className="text-[11px] text-slate-300 font-medium truncate max-w-[200px]" title={alt}>
          {alt}
        </p>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              setRenderAsVideo(false);
              setTriedBackup(false);
              setIsLoaded(false);
              setRetryCount((c) => c + 1);
              setActiveSrc(src);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử lại</span>
          </button>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Tải về</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (renderAsVideo) {
    return (
      <div className={`relative w-full bg-slate-950/60 ${!isLoaded ? minHeightClass : ''}`}>
        <video
          key={`vid_${activeSrc}_${retryCount}`}
          src={activeSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => {
            setHasError(false);
            setIsLoaded(true);
          }}
          onCanPlay={() => {
            setHasError(false);
            setIsLoaded(true);
          }}
          onError={() => setHasError(true)}
          className={`relative z-[1] ${className}`}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full bg-slate-950/60 ${!isLoaded ? minHeightClass : ''}`}>
      {!isLoaded && (
        <div className="absolute inset-0 z-0 bg-slate-900/60 flex items-center justify-center pointer-events-none">
          {isGif ? (
            <Film className="w-5 h-5 text-emerald-400/50 animate-pulse" />
          ) : (
            <ImageIcon className="w-5 h-5 text-slate-500/50 animate-pulse" />
          )}
        </div>
      )}
      <img
        ref={imgRef}
        key={`img_${activeSrc}_${retryCount}`}
        src={activeSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => {
          setIsLoaded(true);
          setHasError(false);
        }}
        onError={handleImageError}
        className={`relative z-[1] ${className}`}
      />
    </div>
  );
};
