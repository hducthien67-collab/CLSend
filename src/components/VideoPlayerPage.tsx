import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Film, 
  Image as ImageIcon, 
  ExternalLink, 
  Download, 
  FolderOpen, 
  ShieldCheck, 
  Search, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Minimize, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Check, 
  Sparkles,
  Layers,
  HardDrive,
  RefreshCw,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import AllInOneVideoPlayer from './AllInOneVideoPlayer';
import { downloadFileSafely } from '../utils/fileDownload';
import { formatFileSize } from '../utils/fileUpload';
import { FileDocIcon } from './FileDocIcon';

export interface UnifiedMediaItem {
  id: string;
  name: string;
  title: string;
  src: string;
  thumbnail?: string | null;
  size?: number | string;
  type: 'video' | 'image';
  mimeType?: string;
  file?: File | Blob;
  createdAt?: string;
  isLocal?: boolean;
}

interface VideoPlayerPageProps {
  onBack?: () => void;
  initialVideo?: {
    src?: string;
    title?: string;
    id?: string;
    size?: number | string;
    file?: File | Blob;
    type?: 'video' | 'image';
  };
}

const DEFAULT_SAMPLES: UnifiedMediaItem[] = [
  {
    id: 'sample-video-1',
    name: 'W3C Animation (Big Buck Bunny)',
    title: 'W3C Animation (Big Buck Bunny)',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 612718,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-video-2',
    name: 'Mozilla MDN Flower Bloom',
    title: 'Mozilla MDN Flower Bloom',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 2621440,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-video-3',
    name: 'Blue Oceans HD (Video.js)',
    title: 'Blue Oceans HD (Video.js)',
    src: 'https://vjs.zencdn.net/v/oceans.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 48234496,
    createdAt: new Date().toISOString()
  }
];

export const VideoPlayerPage: React.FC<VideoPlayerPageProps> = ({
  onBack,
  initialVideo
}) => {
  const { currentUser } = useAuth();
  
  // Cloud & Local media items
  const [cloudMedia, setCloudMedia] = useState<UnifiedMediaItem[]>([]);
  const [localMedia, setLocalMedia] = useState<UnifiedMediaItem[]>([]);
  
  // Currently viewed / playing item
  const [activeItem, setActiveItem] = useState<UnifiedMediaItem | null>(null);

  // Filters & UI states
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'stage' | 'playlist'>('stage');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Image stage controls (zoom, rotate, pan)
  const [zoomScale, setZoomScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imageLoadedDimensions, setImageLoadedDimensions] = useState<{ width: number; height: number } | null>(null);

  // File pickers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = (txt: string) => {
    setToastText(txt);
    setTimeout(() => setToastText(null), 3000);
  };

  // 1. Real-time listen to Firestore cloud_files for currentUser
  useEffect(() => {
    if (!currentUser) return;

    const cloudRef = collection(db, 'cloud_files');
    const q = query(cloudRef, where('userId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UnifiedMediaItem[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const ext = (d.name || '').split('.').pop()?.toLowerCase() || '';
        const mime = d.type || '';
        const isVideo = d.category === 'video' || mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp'].includes(ext);
        const isImage = d.category === 'image' || mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'].includes(ext);

        if (isVideo || isImage) {
          list.push({
            id: docSnap.id,
            name: d.name || 'Tệp Media',
            title: d.name || 'Tệp Media',
            src: d.viewUrl || d.url,
            thumbnail: d.thumbnail || null,
            size: d.size || 0,
            type: isVideo ? 'video' : 'image',
            mimeType: mime,
            createdAt: d.createdAt
          });
        }
      });

      // Sort newest first
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      setCloudMedia(list);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Combine media list
  const allMediaItems = useMemo<UnifiedMediaItem[]>(() => {
    const combined: UnifiedMediaItem[] = [];
    const seenIds = new Set<string>();

    // 1. Local user-picked media first
    for (const m of localMedia) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        combined.push(m);
      }
    }

    // 2. Cloud Drive media items
    for (const m of cloudMedia) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        combined.push(m);
      }
    }

    // 3. If empty, append default samples
    if (combined.length === 0) {
      return DEFAULT_SAMPLES;
    }

    return combined;
  }, [localMedia, cloudMedia]);

  // 2. Initialize activeItem from Props, URL search params, or sessionStorage
  useEffect(() => {
    // A. Check initialVideo prop
    if (initialVideo?.file) {
      const url = URL.createObjectURL(initialVideo.file);
      const isImg = initialVideo.file.type.startsWith('image/') || initialVideo.type === 'image';
      const item: UnifiedMediaItem = {
        id: initialVideo.id || 'initial-prop-' + Date.now(),
        name: initialVideo.title || (initialVideo.file instanceof File ? initialVideo.file.name : 'Tệp của bạn'),
        title: initialVideo.title || (initialVideo.file instanceof File ? initialVideo.file.name : 'Tệp của bạn'),
        src: url,
        file: initialVideo.file,
        size: initialVideo.size || initialVideo.file.size,
        type: isImg ? 'image' : 'video',
        isLocal: true
      };
      setLocalMedia((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
      setActiveItem(item);
      return;
    }

    if (initialVideo?.src) {
      const isImg = initialVideo.type === 'image' || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(initialVideo.src);
      const item: UnifiedMediaItem = {
        id: initialVideo.id || 'initial-src-' + Date.now(),
        name: initialVideo.title || 'Tệp Media',
        title: initialVideo.title || 'Tệp Media',
        src: initialVideo.src,
        size: initialVideo.size,
        type: isImg ? 'image' : 'video'
      };
      setActiveItem(item);
      return;
    }

    // B. Check sessionStorage
    try {
      const stored = sessionStorage.getItem('clsend_player_video');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.src || parsed.name || parsed.id)) {
          const isImg = parsed.type === 'image' || (parsed.name && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(parsed.name));
          const item: UnifiedMediaItem = {
            id: parsed.id || 'session-' + Date.now(),
            name: parsed.name || parsed.title || 'Tệp Media',
            title: parsed.name || parsed.title || 'Tệp Media',
            src: parsed.src || (parsed.id ? `/api/files/view/${encodeURIComponent(parsed.id)}` : ''),
            thumbnail: parsed.thumbnail || null,
            size: parsed.size,
            type: isImg ? 'image' : 'video'
          };
          if (item.src) {
            setActiveItem(item);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Session storage media parse notice:', e);
    }

    // C. Check URL Search Params (?page=player&src=...&name=...&type=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSrc = params.get('src');
      const urlName = params.get('name');
      const urlId = params.get('id');
      const urlSize = params.get('size');
      const urlType = params.get('type');

      if (urlSrc || urlId) {
        const finalSrc = urlSrc || `/api/files/view/${encodeURIComponent(urlId || '')}`;
        const finalName = urlName || finalSrc.split('/').pop()?.split('?')[0] || 'Tệp Media';
        const isImg = urlType === 'image' || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(finalName);

        const item: UnifiedMediaItem = {
          id: urlId || 'url-' + Date.now(),
          name: finalName,
          title: finalName,
          src: finalSrc,
          size: urlSize ? Number(urlSize) || urlSize : undefined,
          type: isImg ? 'image' : 'video'
        };
        setActiveItem(item);
        return;
      }
    }

    // D. Default to first item if none specified
    if (!activeItem && allMediaItems.length > 0) {
      setActiveItem(allMediaItems[0]);
    }
  }, [initialVideo]);

  // If activeItem is still null after items load, set first item
  useEffect(() => {
    if (!activeItem && allMediaItems.length > 0) {
      setActiveItem(allMediaItems[0]);
    }
  }, [allMediaItems, activeItem]);

  // Reset zoom & pan when activeItem changes
  useEffect(() => {
    setZoomScale(1.0);
    setRotation(0);
    setPanPos({ x: 0, y: 0 });
    setImageLoadedDimensions(null);
  }, [activeItem?.id, activeItem?.src]);

  // Filtered media list for sidebar
  const filteredMediaList = useMemo(() => {
    return allMediaItems.filter((item) => {
      if (mediaFilter === 'video' && item.type !== 'video') return false;
      if (mediaFilter === 'image' && item.type !== 'image') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allMediaItems, mediaFilter, searchQuery]);

  const videoCount = useMemo(() => allMediaItems.filter((m) => m.type === 'video').length, [allMediaItems]);
  const imageCount = useMemo(() => allMediaItems.filter((m) => m.type === 'image').length, [allMediaItems]);

  // Handle local file picking
  const handlePickLocalFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UnifiedMediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = URL.createObjectURL(f);
      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name);
      const isVid = f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i.test(f.name);

      const item: UnifiedMediaItem = {
        id: 'local-' + Date.now() + '-' + i,
        name: f.name,
        title: f.name,
        src: url,
        file: f,
        size: f.size,
        type: isImg ? 'image' : 'video',
        mimeType: f.type,
        isLocal: true,
        createdAt: new Date().toISOString()
      };
      newItems.push(item);
    }

    if (newItems.length > 0) {
      setLocalMedia((prev) => [...newItems, ...prev]);
      setActiveItem(newItems[0]);
      setMobileTab('stage');
      showToast(`Đã mở "${newItems[0].name}" trực tiếp từ máy của bạn!`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download active item
  const handleDownloadActiveItem = (itemToDl = activeItem) => {
    if (!itemToDl) return;

    if (itemToDl.file) {
      const blobUrl = URL.createObjectURL(itemToDl.file);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = itemToDl.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast(`Đang tải "${itemToDl.name}" về máy...`);
      return;
    }

    if (itemToDl.src) {
      let dlUrl = itemToDl.src;
      if (dlUrl.includes('/api/files/view/')) {
        dlUrl = dlUrl.replace('/api/files/view/', '/api/files/download/');
      }
      downloadFileSafely(dlUrl, itemToDl.name);
      showToast(`Đang tải "${itemToDl.name}" về máy...`);
    }
  };

  // Image zoom & pan handlers
  const handleZoomIn = () => setZoomScale((prev) => Math.min(4.0, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  const handleResetZoom = () => {
    setZoomScale(1.0);
    setRotation(0);
    setPanPos({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1.0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panPos.x,
      panY: panPos.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanPos({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Navigate through media
  const activeIndex = useMemo(() => {
    if (!activeItem) return -1;
    return filteredMediaList.findIndex((m) => m.id === activeItem.id || m.src === activeItem.src);
  }, [filteredMediaList, activeItem]);

  const handlePrevItem = () => {
    if (filteredMediaList.length === 0) return;
    const prevIdx = activeIndex <= 0 ? filteredMediaList.length - 1 : activeIndex - 1;
    setActiveItem(filteredMediaList[prevIdx]);
  };

  const handleNextItem = () => {
    if (filteredMediaList.length === 0) return;
    const nextIdx = activeIndex >= filteredMediaList.length - 1 ? 0 : activeIndex + 1;
    setActiveItem(filteredMediaList[nextIdx]);
  };

  const handleReturn = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.pushState(null, '', '/?page=drive');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative">
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => handlePickLocalFiles(e.target.files)}
      />

      {/* Toast Notification */}
      {toastText && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastText}</span>
        </div>
      )}

      {/* Top Standalone Header */}
      <header className="w-full px-4 sm:px-6 py-3 bg-slate-950/95 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleReturn}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white text-xs font-semibold transition-all active:scale-95 border border-slate-700/80 shadow-sm cursor-pointer shrink-0"
            title="Quay lại ứng dụng chính ClSend"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại ClSend</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
              activeItem?.type === 'image' 
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' 
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {activeItem?.type === 'image' ? (
                <ImageIcon className="w-3.5 h-3.5" />
              ) : (
                <Film className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md" title={activeItem?.name || ''}>
                  {activeItem?.name || 'Trình Xem Đa Phương Tiện'}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" /> 0% Lag • GPU Decode
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mở tệp từ máy */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Mở thêm video hoặc ảnh từ máy tính để xem ngay lập tức"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mở tệp máy tính</span>
          </button>

          {/* Tải về */}
          {activeItem && (
            <button
              type="button"
              onClick={() => handleDownloadActiveItem()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
              title="Tải tệp này về máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tải về</span>
            </button>
          )}

          {/* Toggle Sidebar on Desktop */}
          <button
            type="button"
            onClick={() => setIsSidebarVisible((prev) => !prev)}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isSidebarVisible
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30'
            }`}
            title="Đóng / mở danh sách tệp bên phải"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isSidebarVisible ? 'Ẩn danh sách' : 'Hiện danh sách'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher (Stage vs Danh sách) */}
      <div className="lg:hidden flex items-center justify-center p-2 bg-slate-950 border-b border-slate-800/80 gap-2">
        <button
          type="button"
          onClick={() => setMobileTab('stage')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'stage'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          {activeItem?.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
          <span>Khung Xem Chính</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('playlist')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'playlist'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Danh Sách ({allMediaItems.length})</span>
        </button>
      </div>

      {/* Main Workspace (Two Columns on Desktop / Tablet) */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-2 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-4 overflow-hidden items-stretch">
        {/* ========================================================= */}
        {/* LEFT COLUMN: THEATER STAGE (Video Player or Image Viewer) */}
        {/* ========================================================= */}
        <div className={`flex-1 min-w-0 flex flex-col items-center justify-center ${
          mobileTab === 'playlist' ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeItem ? (
            activeItem.type === 'video' ? (
              /* --- VIDEO VIEWER STAGE --- */
              <div className="w-full h-full flex flex-col items-center justify-center">
                <AllInOneVideoPlayer
                  isOpen={true}
                  isEmbedded={true}
                  initialSrc={activeItem.src}
                  initialTitle={activeItem.name}
                  initialFile={activeItem.file}
                  initialSize={activeItem.size}
                  onDownload={() => handleDownloadActiveItem(activeItem)}
                />
              </div>
            ) : (
              /* --- IMAGE VIEWER STAGE --- */
              <div
                ref={containerRef}
                className="w-full flex-1 flex flex-col bg-slate-950/95 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative min-h-[480px] lg:min-h-[620px]"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Image Toolbar Header */}
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs gap-2 z-20 backdrop-blur-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-200 truncate max-w-xs">{activeItem.name}</span>
                    {imageLoadedDimensions && (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        ({imageLoadedDimensions.width} × {imageLoadedDimensions.height} px)
                      </span>
                    )}
                    {activeItem.size ? (
                      <span className="text-[10px] text-emerald-400 font-mono hidden md:inline">
                        • {typeof activeItem.size === 'number' ? formatFileSize(activeItem.size) : activeItem.size}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={zoomScale <= 0.5}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                      title="Thu nhỏ"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 transition-colors"
                      title="Đặt lại tỉ lệ 100%"
                    >
                      {Math.round(zoomScale * 100)}%
                    </button>

                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={zoomScale >= 4.0}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                      title="Phóng to"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleRotate}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Xoay ảnh 90 độ"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-3 w-[1px] bg-slate-800 mx-0.5" />

                    <button
                      type="button"
                      onClick={() => handleDownloadActiveItem(activeItem)}
                      className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition-colors"
                      title="Tải ảnh về máy"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Canvas Area */}
                <div
                  className={`flex-1 w-full flex items-center justify-center p-4 overflow-hidden relative ${
                    zoomScale > 1.0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                  }`}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={() => (zoomScale > 1.0 ? handleResetZoom() : setZoomScale(2.0))}
                >
                  <img
                    src={activeItem.src}
                    alt={activeItem.name}
                    className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150 select-none pointer-events-none"
                    style={{
                      transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale}) rotate(${rotation}deg)`
                    }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImageLoadedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                  />

                  {/* Previous / Next Arrow buttons on left & right */}
                  {filteredMediaList.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrevItem();
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700 shadow-xl backdrop-blur-sm transition-transform active:scale-95 cursor-pointer z-10"
                        title="Tệp trước đó"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextItem();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700 shadow-xl backdrop-blur-sm transition-transform active:scale-95 cursor-pointer z-10"
                        title="Tệp tiếp theo"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Bottom hint banner */}
                <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 text-center text-[10px] text-slate-500">
                  <span>💡 Nhấp đúp vào ảnh để phóng to/thu nhỏ • Kéo chuột để di chuyển ảnh khi phóng to</span>
                </div>
              </div>
            )
          ) : (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-center space-y-3">
              <Film className="w-10 h-10 text-slate-600 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-300">Chưa chọn tệp video hoặc hình ảnh</h3>
              <p className="text-xs text-slate-500 max-w-sm">Chọn một tệp từ danh sách bên phải hoặc nhấn nút bên dưới để mở tệp từ máy tính.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Chọn tệp từ máy</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================================= */}
        {/* RIGHT COLUMN: MEDIA LIBRARY SIDEBAR ("Đoạn nhỏ chứa các file video hình ảnh tiện lợi")   */}
        {/* ========================================================================================= */}
        {isSidebarVisible && (
          <aside className={`w-full lg:w-80 xl:w-96 flex flex-col bg-slate-950/95 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden shrink-0 ${
            mobileTab === 'stage' ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Sidebar Top: Title & Counter */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Thư Viện Media</h3>
                    <p className="text-[10px] text-slate-400">{allMediaItems.length} video & hình ảnh</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs transition-colors"
                  title="Thêm tệp từ máy tính"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setMediaFilter('all')}
                  className={`flex-1 py-1 rounded-lg transition-all text-center ${
                    mediaFilter === 'all'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả ({allMediaItems.length})
                </button>

                <button
                  type="button"
                  onClick={() => setMediaFilter('video')}
                  className={`flex-1 py-1 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                    mediaFilter === 'video'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span>Video ({videoCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaFilter('image')}
                  className={`flex-1 py-1 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                    mediaFilter === 'image'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Ảnh ({imageCount})</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tệp video, ảnh..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Media Items Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[460px] lg:max-h-[calc(100vh-270px)] no-scrollbar">
              {filteredMediaList.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-slate-500">
                  <HardDrive className="w-6 h-6 mx-auto text-slate-600" />
                  <p className="text-xs font-semibold text-slate-400">Không tìm thấy tệp nào</p>
                  <p className="text-[10px]">Tải thêm ảnh hoặc video để xem tại đây.</p>
                </div>
              ) : (
                filteredMediaList.map((item) => {
                  const isActive = activeItem?.id === item.id || activeItem?.src === item.src;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveItem(item);
                        setMobileTab('stage');
                      }}
                      className={`group p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Thumbnail Preview */}
                      <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 relative">
                        {item.type === 'image' ? (
                          <img
                            src={item.thumbnail || item.src}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : item.thumbnail ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img
                              src={item.thumbnail}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-emerald-400">
                            <Film className="w-4 h-4" />
                          </div>
                        )}

                        {/* Tiny corner badge */}
                        <div className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-bold bg-black/80 text-slate-300">
                          {item.type === 'video' ? 'MP4' : 'IMG'}
                        </div>
                      </div>

                      {/* Center: File Title & Meta */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs font-semibold truncate ${
                            isActive ? 'text-emerald-300 font-bold' : 'text-slate-200 group-hover:text-white'
                          }`} title={item.name}>
                            {item.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className={item.type === 'video' ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
                            {item.type === 'video' ? 'Video' : 'Hình ảnh'}
                          </span>
                          <span>•</span>
                          <span>{typeof item.size === 'number' ? formatFileSize(item.size) : (item.size || 'Tệp')}</span>
                          {isActive && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                              Đang xem
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Download */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadActiveItem(item);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-slate-800 transition-colors shrink-0"
                        title="Tải tệp này"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom: Pick local file action */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/70 space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 stroke-[2.5]" />
                <span>Mở tệp từ máy (Video / Ảnh)</span>
              </button>
              <p className="text-[9px] text-slate-500 text-center">
                Bấm vào bất kỳ tệp nào để phát hoặc xem tức thì với độ trễ 0s.
              </p>
            </div>
          </aside>
        )}
      </main>

      {/* Ambient Footer Info */}
      <footer className="w-full py-2.5 px-4 border-t border-slate-900 bg-slate-950/80 text-center text-[11px] text-slate-500 flex flex-wrap items-center justify-center gap-4">
        <span>🎬 Phím tắt Video: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Space</kbd> Phát/Dừng</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">→</kbd> Tua/Chuyển ảnh</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">F</kbd> Toàn màn hình</span>
        <span className="text-emerald-400 font-semibold">• Giải mã phần cứng GPU trực tiếp 0% Lag</span>
      </footer>
    </div>
  );
};

export default VideoPlayerPage;
