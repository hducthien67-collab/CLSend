import React from 'react';
import { PersistentVideoPlayerModal } from './PersistentVideoPlayerModal';

export interface VideoPlayerFrameProps {
  onClose?: () => void;
  initialSrc?: string;
  initialTitle?: string;
  initialFile?: File | Blob;
}

export const VideoPlayerFrame: React.FC<VideoPlayerFrameProps> = ({
  onClose,
  initialSrc,
  initialTitle,
  initialFile
}) => {
  return (
    <PersistentVideoPlayerModal
      onClose={onClose}
      initialSrc={initialSrc}
      initialTitle={initialTitle}
      initialFile={initialFile}
    />
  );
};

export const PersistentVideoFrame = VideoPlayerFrame;
export default VideoPlayerFrame;
