import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { downloadFileSafely } from '../utils/fileDownload';
import { useLanguage } from '../context/LanguageContext';
import { openMediaInLargeViewer } from '../utils/mediaViewerSession';

interface ZoomableImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
  fileSize?: number;
}

export const ZoomableImageViewerModal: React.FC<ZoomableImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  fileSize
}) => {
  const { t } = useLanguage();
  const displayName = imageName || t('viewer.default_name', 'Hình ảnh');

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [renderAsVideo, setRenderAsVideo] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImgError(false);
      setRenderAsVideo(false);
      setRetrySeed(0);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, imageUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-' || e.key === '_') handleZoomOut();
      else if (e.key === 'r' || e.key === 'R') handleRotate();
      else if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale, rotation]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => {
    setScale((prev) => Math.min(5, Number((prev + 0.35).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(0.4, Number((prev - 0.35).toFixed(2)));
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/92 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none touch-none overscroll-none"
      onClick={onClose}
    >
      {/* Top Controls Bar */}
      <div
        className="w-full bg-slate-900/80 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md" title={displayName}>
              {displayName}
            </h3>
            {fileSize && fileSize > 0 && (
              <p className="text-[11px] text-slate-400 font-mono">
                {fileSize / 1024 > 1024 ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : `${(fileSize / 1024).toFixed(1)} KB`}
              </p>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-xs font-mono text-emerald-400 font-semibold px-2 py-1 bg-slate-800 rounded-lg hidden sm:inline-block">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title={t('viewer.zoom_out')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title={t('viewer.zoom_in')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title={t('viewer.rotate')}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title={t('viewer.reset')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              openMediaInLargeViewer({
                source: 'cloud',
                activeItem: {
                  id: imageUrl,
                  name: displayName,
                  title: displayName,
                  src: imageUrl,
                  size: fileSize,
                  type: 'image',
                },
              });
            }}
            className="p-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-semibold transition-all active:scale-95 flex items-center gap-1.5 px-3 text-xs cursor-pointer"
            title={t('player.open_dedicated', 'Mở trang xem riêng')}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden md:inline">{t('player.open_large', 'Phát lớn')}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadFileSafely(imageUrl, displayName)}
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all active:scale-95 shadow-md flex items-center gap-1.5 px-3 text-xs cursor-pointer"
            title={t('viewer.download')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('viewer.download')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500 text-slate-300 hover:text-white transition-all active:scale-95 ml-1 cursor-pointer"
            title={t('viewer.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport Area */}
      <div
        ref={containerRef}
        className="flex-1 w-full flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing p-4"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imgError ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-sm space-y-3"
          >
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs text-slate-200">{t('viewer.load_error')}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setImgError(false);
                  setRenderAsVideo(false);
                  setRetrySeed((s) => s + 1);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('player.retry')}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFileSafely(imageUrl, displayName)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('viewer.download')}</span>
              </button>
            </div>
          </div>
        ) : renderAsVideo ? (
          <video
            key={`v_${imageUrl}_${retrySeed}`}
            src={imageUrl}
            autoPlay
            loop
            muted
            playsInline
            onClick={(e) => e.stopPropagation()}
            onError={() => setImgError(true)}
            className="max-w-[92vw] max-h-[82vh] object-contain transition-transform duration-75 ease-out shadow-2xl rounded-lg"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
            }}
          />
        ) : (
          <img
            key={`${imageUrl}_${retrySeed}`}
            src={imageUrl}
            alt={displayName}
            draggable={false}
            referrerPolicy="no-referrer"
            onDoubleClick={handleDoubleClick}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setImgError(false)}
            onError={() => {
              if (!renderAsVideo && /\.gif([?#&]|$)/i.test(`${displayName} ${imageUrl}`)) {
                setRenderAsVideo(true);
              } else {
                setImgError(true);
              }
            }}
            className="max-w-[92vw] max-h-[82vh] object-contain transition-transform duration-75 ease-out shadow-2xl rounded-lg"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
            }}
          />
        )}
      </div>

      {/* Bottom Hint */}
      <div className="w-full text-center py-2 bg-slate-950/60 text-[11px] text-slate-400 pointer-events-none">
        {t('viewer.hint')}
      </div>
    </div>
  );
};
