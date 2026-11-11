import React from 'react';
import AllInOneVideoPlayer, { VideoItem } from './AllInOneVideoPlayer';

export interface PersistentVideoPlayerModalProps {
  initialSrc?: string;
  initialTitle?: string;
  initialFile?: File | Blob;
  initialSize?: string | number;
  onClose?: () => void;
  onDownload?: () => void;
}

export const PersistentVideoPlayerModal: React.FC<PersistentVideoPlayerModalProps> = ({
  initialSrc = '',
  initialTitle = '',
  initialFile,
  initialSize,
  onClose,
  onDownload
}) => {
  return (
    <AllInOneVideoPlayer
      isOpen={true}
      onClose={onClose}
      initialSrc={initialSrc}
      initialTitle={initialTitle}
      initialFile={initialFile}
      initialSize={initialSize}
      onDownload={onDownload}
    />
  );
};

export type { VideoItem };
export default PersistentVideoPlayerModal;
