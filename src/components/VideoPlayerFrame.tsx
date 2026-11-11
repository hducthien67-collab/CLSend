import React from 'react';
import AllInOneVideoPlayer from './AllInOneVideoPlayer';

export interface VideoPlayerFrameProps {
  onClose?: () => void;
  initialSrc?: string;
  initialTitle?: string;
  initialFile?: File | Blob;
  initialSize?: string | number;
  onDownload?: () => void;
}

export const VideoPlayerFrame: React.FC<VideoPlayerFrameProps> = ({
  onClose,
  initialSrc,
  initialTitle,
  initialFile,
  initialSize,
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

export const PersistentVideoFrame = VideoPlayerFrame;
export default VideoPlayerFrame;
