import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Repeat, 
  Music, 
  MoreVertical, 
  Loader2,
  Sparkles
} from 'lucide-react';

interface AudioPreviewPlayerProps {
  src: string;
  fileName: string;
  autoPlay?: boolean;
}

export const AudioPreviewPlayer: React.FC<AudioPreviewPlayerProps> = ({
  src,
  fileName,
  autoPlay = true,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Format time (seconds) to mm:ss
  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setAudioError(null);
      audioRef.current.play().catch((err) => {
        console.warn('Audio play prevented or failed:', err);
      });
    }
  };

  // Scrubbing / Progress Click & Drag
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume toggle
  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Change playback speed
  const changeSpeed = (rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowMenu(false);
  };

  // Toggle loop
  const toggleLoop = () => {
    if (!audioRef.current) return;
    const nextLoop = !isLooping;
    audioRef.current.loop = nextLoop;
    setIsLooping(nextLoop);
  };

  // Reset to start
  const handleReset = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().catch(() => {});
  };

  // Keyboard shortcut: Spacebar to toggle play/pause when in focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 select-none">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={src}
        autoPlay={autoPlay}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={() => {
          if (!isLooping) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }}
        onError={() => {
          setIsBuffering(false);
          setIsPlaying(false);
          setAudioError('Không thể phát tệp âm thanh này hoặc liên kết đã hết hạn.');
        }}
      />

      {/* Main Player Card Container matching image_85d641b4.png */}
      <div className="w-full max-w-lg bg-[#0e1628]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center shadow-2xl relative backdrop-blur-md animate-in zoom-in-95 duration-200">
        
        {/* Animated equalizer waves / pulsing music icon */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-2xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-xl shadow-violet-950/40 transition-transform duration-300 ${isPlaying ? 'scale-105 ring-4 ring-violet-500/20' : ''}`}>
            <Music className={`w-8 h-8 ${isPlaying ? 'animate-pulse text-violet-300' : 'text-violet-400'}`} />
          </div>

          {/* Equalizer animation mini bars */}
          {isPlaying && (
            <div className="absolute -bottom-2 flex items-end gap-1 h-3 px-2">
              <span className="w-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
              <span className="w-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.1s] h-2" />
              <span className="w-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.4s] h-3.5" />
              <span className="w-1 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.2s] h-2.5" />
            </div>
          )}
        </div>

        {/* Track Title */}
        <p className="text-sm sm:text-base font-bold text-slate-100 text-center mb-6 max-w-md truncate px-3" title={fileName}>
          {fileName}
        </p>

        {/* Error message fallback */}
        {audioError && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-center w-full">
            {audioError}
          </div>
        )}

        {/* The White Capsule Player (Directly matching image_85d641b4.png) */}
        <div className="bg-white text-slate-900 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 shadow-2xl flex items-center gap-2.5 sm:gap-3.5 w-full max-w-md relative">
          
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isBuffering && !isPlaying}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-900 hover:text-black hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title={isPlaying ? 'Tạm dừng (Phím Space)' : 'Phát (Phím Space)'}
          >
            {isBuffering ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-slate-900" />
            ) : (
              <Play className="w-4 h-4 fill-slate-900 ml-0.5" />
            )}
          </button>

          {/* Time Counter: e.g. 1:12 / 2:46 */}
          <span className="text-[11px] sm:text-xs font-semibold text-slate-800 tracking-tight shrink-0 select-none font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Interactive Progress Bar */}
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="flex-1 h-3 flex items-center cursor-pointer group py-1"
            title="Tua đến vị trí"
          >
            <div className="w-full h-1 bg-slate-300 group-hover:h-1.5 transition-all rounded-full overflow-hidden relative">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Volume / Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-800 hover:text-black hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-600" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* More options menu button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:text-black hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              title="Tùy chọn phát"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div 
                className="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tốc độ phát
                </div>
                <div className="grid grid-cols-4 gap-1 mb-2 px-1">
                  {[1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changeSpeed(rate)}
                      className={`py-1 text-center font-semibold rounded-lg transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <div className="h-px bg-slate-800 my-1" />

                <button
                  type="button"
                  onClick={toggleLoop}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Lặp lại bài hát</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isLooping ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Phát lại từ đầu</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick status indicators (Looping, speed if not 1x) */}
        {(isLooping || playbackRate !== 1) && (
          <div className="flex items-center gap-2 mt-3 text-[11px] text-violet-300 font-medium">
            {isLooping && (
              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
                🔁 Đang lặp lại
              </span>
            )}
            {playbackRate !== 1 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                ⚡ Tốc độ: {playbackRate}x
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
