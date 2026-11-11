import React, { useState, useEffect } from 'react';
import AllInOneVideoPlayer from './AllInOneVideoPlayer';
import { getFileBlobLocally } from '../utils/idbStorage';
import { ExternalLink } from 'lucide-react';

export interface VideoPreviewPlayerProps {
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
  className = '',
  onDownload
}) => {
  const [resolvedFile, setResolvedFile] = useState<File | Blob | undefined>(file);
  const [resolvedSrc, setResolvedSrc] = useState<string>(src || fallbackUrl || '');

  // Cập nhật khi props file hoặc src thay đổi
  useEffect(() => {
    if (file) {
      setResolvedFile(file);
      return;
    }

    if (src) {
      setResolvedSrc(src);
      return;
    }

    if (fallbackUrl) {
      setResolvedSrc(fallbackUrl);
      return;
    }

    // Nếu chưa có file hay src, thử tìm trong local IndexedDB
    if (fileId || fileName) {
      const candidates = [fileId, fileName].filter(Boolean) as string[];
      (async () => {
        for (const key of candidates) {
          try {
            const blob = await getFileBlobLocally(key);
            if (blob) {
              setResolvedFile(blob);
              return;
            }
          } catch (e) {
            console.warn('IDB lookup notice:', e);
          }
        }
      })();
    }
  }, [file, src, fallbackUrl, fileId, fileName]);

  const handleOpenDedicatedPage = () => {
    try {
      sessionStorage.setItem('clsend_player_video', JSON.stringify({
        id: fileId,
        name: fileName,
        title: fileName,
        src: resolvedSrc,
        size: fileSize
      }));
    } catch (e) {
      console.warn(e);
    }

    const query = new URLSearchParams();
    query.set('page', 'player');
    if (fileId) query.set('id', fileId);
    if (fileName) query.set('name', fileName);
    if (resolvedSrc) query.set('src', resolvedSrc);
    if (fileSize) query.set('size', String(fileSize));

    window.history.pushState(null, '', `/?${query.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
        <span className="text-[11px] text-slate-300 font-medium truncate max-w-[200px] sm:max-w-md">
          {fileName}
        </span>
        <button
          type="button"
          onClick={handleOpenDedicatedPage}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shadow-xs shrink-0"
          title="Chuyển sang trang xem video độc lập để xem mượt mà nhất không giật lag"
        >
          <ExternalLink className="w-3 h-3 stroke-[2.5]" />
          <span>Mở Trang Riêng (0% Lag)</span>
        </button>
      </div>

      <AllInOneVideoPlayer
        isOpen={true}
        isEmbedded={true}
        initialSrc={resolvedSrc}
        initialTitle={fileName}
        initialFile={resolvedFile}
        initialSize={fileSize}
        onDownload={onDownload}
      />
    </div>
  );
};

export default VideoPreviewPlayer;
