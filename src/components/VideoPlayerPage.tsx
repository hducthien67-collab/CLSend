import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Image as ImageIcon,
  Download,
  FolderOpen,
  Search,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Play,
  Check,
  RefreshCw,
  AlertCircle,
  Globe,
  X,
  PanelRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  Link2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AllInOneVideoPlayer from './AllInOneVideoPlayer';
import { downloadFileSafely } from '../utils/fileDownload';
import { formatFileSize, isGifFile } from '../utils/fileUpload';
import { subscribeUserCloudFiles } from '../utils/cloudSync';
import {
  MediaViewerSource,
  UnifiedMediaItem,
  saveActiveMediaForSource,
  readMediaSessionForSource,
  resolveMediaTimeMs
} from '../utils/mediaViewerSession';

export type { UnifiedMediaItem };

interface VideoPlayerPageProps {
  onBack?: (returnTab?: 'chat' | 'drive') => void;
  initialVideo?: {
    src?: string;
    title?: string;
    id?: string;
    size?: number | string;
    file?: File | Blob;
    type?: 'video' | 'image';
    source?: MediaViewerSource;
  };
}

const isImageFileExt = (nameOrSrc: string) =>
  /\.(jpg|jpeg|png|webp|gif|svg|bmp|heic|heif|avif)([?#&]|$)/i.test(nameOrSrc);

function getDateGroupInfo(iso?: string): { key: string; label: string } {
  if (!iso) return { key: 'unknown', label: 'Trước đó' };
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getTime() <= 0) return { key: 'unknown', label: 'Trước đó' };

  const yyyy = d.getFullYear();
  const mmNum = d.getMonth() + 1;
  const ddNum = d.getDate();
  const mm = String(mmNum).padStart(2, '0');
  const dd = String(ddNum).padStart(2, '0');
  const key = `${yyyy}-${mm}-${dd}`;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(yyyy, d.getMonth(), ddNum).getTime();
  const dayDiff = Math.round((todayStart - targetStart) / 86400000);

  if (dayDiff === 0) return { key, label: `Hôm nay (${dd}/${mm}/${yyyy})` };
  if (dayDiff === 1) return { key, label: `Hôm qua (${dd}/${mm}/${yyyy})` };
  return { key, label: `${dd}/${mm}/${yyyy}` };
}

function formatItemTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mi} ${dd}/${mm}/${yyyy}`;
}

export const VideoPlayerPage: React.FC<VideoPlayerPageProps> = ({
  onBack,
  initialVideo
}) => {
  const { currentUser, userProfile } = useAuth();
  const { t, currentLang, setLanguage, languages } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const [viewerSource, setViewerSource] = useState<MediaViewerSource>(() => {
    if (initialVideo?.source) return initialVideo.source;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const srcParam = p.get('source');
      if (srcParam === 'chat' || srcParam === 'cloud') return srcParam;
      if (p.get('roomId')) return 'chat';
    }
    return 'cloud';
  });
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('roomId') || undefined;
    }
    return undefined;
  });

  const [cloudMedia, setCloudMedia] = useState<UnifiedMediaItem[]>([]);
  const [chatRoomMedia, setChatRoomMedia] = useState<UnifiedMediaItem[]>([]);
  const [localMedia, setLocalMedia] = useState<UnifiedMediaItem[]>([]);
  const [priorityItem, setPriorityItem] = useState<UnifiedMediaItem | null>(null);
  const [activeItem, setActiveItem] = useState<UnifiedMediaItem | null>(null);
  const hasExplicitSelectionRef = useRef<boolean>(false);

  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Image stage controls (zoom, rotate, pan, retry, GIF-as-video fallback)
  const [zoomScale, setZoomScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imageLoadedDimensions, setImageLoadedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [renderGifAsVideo, setRenderGifAsVideo] = useState(false);
  const [imageRetrySeed, setImageRetrySeed] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const railScrollRef = useRef<HTMLDivElement>(null);
  const mobileStripRef = useRef<HTMLDivElement>(null);
  const isProgrammaticMobileScrollRef = useRef<boolean>(false);
  const programmaticMobileScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileScrollRafRef = useRef<number | null>(null);
  const mobileSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileCatchPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticItemIdRef = useRef<string | null>(null);
  const hasCenteredMobileStripOnceRef = useRef<boolean>(false);
  const [mobileFocusedId, setMobileFocusedId] = useState<string | null>(null);
  const [isWhiteBoxCaught, setIsWhiteBoxCaught] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = (txt: string) => {
    setToastText(txt);
    setTimeout(() => setToastText(null), 2600);
  };

  // Sync fullscreen listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // 1. Real-time listen to Firestore cloud_files ONLY when opened from Kho Cloud (strictly isolated from Phòng Chat)
  useEffect(() => {
    if (viewerSource === 'chat') {
      setCloudMedia([]);
      return;
    }
    if (!currentUser?.uid) {
      setCloudMedia([]);
      return;
    }

    const unsubscribe = subscribeUserCloudFiles(
      currentUser,
      userProfile,
      (files) => {
        const list: UnifiedMediaItem[] = [];
        files.forEach((d) => {
          const ext = (d.name || '').split('.').pop()?.toLowerCase() || '';
          const mime = d.type || '';
          const isVideo = d.category === 'video' || mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp'].includes(ext);
          const isImage = d.category === 'image' || mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif', 'avif'].includes(ext);

          if (isVideo || isImage) {
            list.push({
              id: d.id,
              name: d.name || tRef.current('player.media_file_label'),
              title: d.name || tRef.current('player.media_file_label'),
              src: d.viewUrl || d.url,
              thumbnail: d.thumbnail || null,
              size: d.size || 0,
              type: isVideo ? 'video' : 'image',
              mimeType: mime,
              createdAt: d.createdAt,
              senderName: userProfile?.displayName || currentUser?.displayName || undefined,
              senderAvatar: userProfile?.customAvatarUrl || currentUser?.photoURL || null
            });
          }
        });
        setCloudMedia(list);
      },
      (err) => console.warn('VideoPlayerPage cloud sync notice:', err)
    );

    return () => unsubscribe();
  }, [viewerSource, currentUser?.uid, currentUser?.email, currentUser?.linkedEmail, (currentUser?.linkedUids || []).join(','), userProfile?.linkedEmail, (userProfile?.linkedUids || []).join(',')]);

  const sourceMediaPool = viewerSource === 'chat' ? chatRoomMedia : cloudMedia;

  const allMediaItems = useMemo<UnifiedMediaItem[]>(() => {
    const combined: UnifiedMediaItem[] = [];
    const seenIds = new Set<string>();
    const seenSrcs = new Set<string>();

    const matchesPriority = (item: UnifiedMediaItem) =>
      Boolean(
        priorityItem &&
          (item.id === priorityItem.id ||
            (priorityItem.src && item.src && item.src === priorityItem.src))
      );

    const mergeWithPriority = (item: UnifiedMediaItem): UnifiedMediaItem => {
      if (!priorityItem || !matchesPriority(item)) return item;
      return {
        ...priorityItem,
        ...item,
        thumbnail: item.thumbnail || priorityItem.thumbnail || null,
        size: item.size || priorityItem.size,
        mimeType: item.mimeType || priorityItem.mimeType,
        // Keep genuine stored send timestamp first; only fallback to priorityItem.createdAt
        createdAt: item.createdAt || priorityItem.createdAt,
        senderName: item.senderName || priorityItem.senderName,
        senderAvatar: item.senderAvatar || priorityItem.senderAvatar
      };
    };

    const pushUnique = (rawItem: UnifiedMediaItem) => {
      const item = mergeWithPriority(rawItem);
      if (seenIds.has(item.id)) return;
      if (item.src && seenSrcs.has(item.src)) return;
      seenIds.add(item.id);
      if (item.src) seenSrcs.add(item.src);
      combined.push(item);
    };

    for (const m of sourceMediaPool) pushUnique(m);
    for (const m of localMedia) pushUnique(m);
    // Only add priorityItem if it was not already part of sourceMediaPool or localMedia;
    // NEVER force it to index 0 — it will sit in its true chronological position.
    if (priorityItem) {
      pushUnique(priorityItem);
    }

    // Sort strictly chronologically (oldest month/year -> newest month/year) matching Zalo timeline
    combined.sort((a, b) => {
      const timeA = resolveMediaTimeMs(a);
      const timeB = resolveMediaTimeMs(b);
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    return combined;
  }, [priorityItem, localMedia, sourceMediaPool]);

  // 2. Initialize & prioritize clicked media from Props, URL search params, or source-isolated sessionStorage
  useEffect(() => {
    const applySelectedMedia = (item: UnifiedMediaItem, nextSource: MediaViewerSource, nextRoomId?: string, nextRoomMedia?: UnifiedMediaItem[]) => {
      hasExplicitSelectionRef.current = true;
      setViewerSource(nextSource);
      if (nextSource === 'chat') {
        setActiveRoomId(nextRoomId);
        if (nextRoomMedia) {
          setChatRoomMedia(nextRoomMedia);
        }
      } else {
        setActiveRoomId(undefined);
        setChatRoomMedia([]);
      }
      setPriorityItem((prev) =>
        prev && prev.id === item.id && prev.src === item.src ? prev : item
      );
      setActiveItem((prev) =>
        prev && prev.id === item.id && prev.src === item.src ? prev : item
      );
    };

    const resolveAndActivateMedia = () => {
      if (initialVideo?.file) {
        const url = URL.createObjectURL(initialVideo.file);
        const defaultName =
          initialVideo.title ||
          (initialVideo.file instanceof File ? initialVideo.file.name : tRef.current('player.media_file_label'));
        const isImg =
          initialVideo.file.type.startsWith('image/') ||
          initialVideo.type === 'image' ||
          isImageFileExt(defaultName);
        const item: UnifiedMediaItem = {
          id: initialVideo.id || `initial-prop-${defaultName}`,
          name: defaultName,
          title: defaultName,
          src: url,
          file: initialVideo.file,
          size: initialVideo.size || initialVideo.file.size,
          type: isImg ? 'image' : 'video',
          isLocal: true,
          createdAt: new Date().toISOString()
        };
        setLocalMedia((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
        applySelectedMedia(item, initialVideo.source || 'cloud');
        return;
      }

      if (initialVideo?.src) {
        const defaultName = initialVideo.title || tRef.current('player.media_file_label');
        const isImg =
          initialVideo.type === 'image' ||
          isImageFileExt(defaultName) ||
          isImageFileExt(initialVideo.src);
        const item: UnifiedMediaItem = {
          id: initialVideo.id || `initial-src-${initialVideo.src}`,
          name: defaultName,
          title: defaultName,
          src: initialVideo.src,
          size: initialVideo.size,
          type: isImg ? 'image' : 'video'
        };
        applySelectedMedia(item, initialVideo.source || 'cloud');
        return;
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlSrc = params.get('src');
        const urlName = params.get('name');
        const urlId = params.get('id');
        const urlSize = params.get('size');
        const urlType = params.get('type');
        const urlRoomId = params.get('roomId') || undefined;
        const urlSourceParam = params.get('source');
        const detectedSource: MediaViewerSource =
          urlSourceParam === 'chat' || Boolean(urlRoomId) ? 'chat' : 'cloud';

        const storedSession = readMediaSessionForSource(detectedSource);
        const storedRoomMedia =
          storedSession?.source === 'chat' ? storedSession.roomMedia || [] : undefined;
        const storedActive = storedSession?.activeItem;

        if (urlSrc || urlId) {
          const finalSrc =
            urlSrc ||
            (storedActive && (!urlId || storedActive.id === urlId) ? storedActive.src : '') ||
            `/api/files/view/${encodeURIComponent(urlId || '')}`;
          const finalName =
            urlName ||
            (storedActive && (!urlId || storedActive.id === urlId) ? storedActive.name : '') ||
            finalSrc.split('/').pop()?.split('?')[0] ||
            tRef.current('player.media_file_label');
          const isImg =
            urlType === 'image' ||
            (urlType !== 'video' && (isImageFileExt(finalName) || isImageFileExt(finalSrc)));

          const matchedMeta =
            storedActive && (storedActive.id === urlId || storedActive.src === finalSrc)
              ? storedActive
              : storedRoomMedia?.find((m) => (urlId && m.id === urlId) || m.src === finalSrc) || null;

          const deterministicId = urlId || matchedMeta?.id || finalSrc;
          const item: UnifiedMediaItem = {
            id: deterministicId,
            name: finalName,
            title: finalName,
            src: finalSrc,
            downloadUrl: matchedMeta?.downloadUrl,
            thumbnail: matchedMeta?.thumbnail || null,
            size: urlSize ? Number(urlSize) || urlSize : matchedMeta?.size,
            type: isImg ? 'image' : 'video',
            mimeType: matchedMeta?.mimeType,
            isGif: matchedMeta?.isGif,
            senderName: matchedMeta?.senderName,
            senderAvatar: matchedMeta?.senderAvatar || null,
            createdAt: matchedMeta?.createdAt,
            roomId: urlRoomId || (storedSession?.source === 'chat' ? storedSession.roomId : undefined)
          };
          applySelectedMedia(
            item,
            detectedSource,
            item.roomId,
            detectedSource === 'chat' ? storedRoomMedia : undefined
          );
          return;
        }

        if (storedActive && (storedActive.src || storedActive.name || storedActive.id)) {
          const nameVal = storedActive.name || storedActive.title || tRef.current('player.media_file_label');
          const finalSrc = storedActive.src || (storedActive.id ? `/api/files/view/${encodeURIComponent(storedActive.id)}` : '');
          const isImg =
            storedActive.type === 'image' ||
            (storedActive.type !== 'video' && (isImageFileExt(nameVal) || isImageFileExt(finalSrc)));
          const item: UnifiedMediaItem = {
            ...storedActive,
            id: storedActive.id || finalSrc,
            name: nameVal,
            title: nameVal,
            src: finalSrc,
            type: isImg ? 'image' : 'video',
          };
          if (item.src) {
            applySelectedMedia(
              item,
              detectedSource,
              storedSession?.source === 'chat' ? storedSession.roomId : undefined,
              detectedSource === 'chat' ? storedRoomMedia : undefined
            );
            return;
          }
        }
      }
    };

    resolveAndActivateMedia();

    window.addEventListener('popstate', resolveAndActivateMedia);
    window.addEventListener('hashchange', resolveAndActivateMedia);
    window.addEventListener('clsend:open-media', resolveAndActivateMedia);
    return () => {
      window.removeEventListener('popstate', resolveAndActivateMedia);
      window.removeEventListener('hashchange', resolveAndActivateMedia);
      window.removeEventListener('clsend:open-media', resolveAndActivateMedia);
    };
  }, [initialVideo?.src, initialVideo?.id, initialVideo?.file, initialVideo?.source]);

  useEffect(() => {
    if (allMediaItems.length === 0) return;
    if (!activeItem && !hasExplicitSelectionRef.current) {
      setActiveItem(allMediaItems[allMediaItems.length - 1]);
    }
  }, [allMediaItems, activeItem]);

  // Smoothly scroll the active thumbnail tile into view inside the chronological right rail
  useEffect(() => {
    const rail = railScrollRef.current;
    if (!rail || !activeItem) return;
    const raf = requestAnimationFrame(() => {
      const activeTile = rail.querySelector('[data-media-active="true"]') as HTMLElement | null;
      if (activeTile) {
        activeTile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeItem?.id, activeItem?.src, isSidebarVisible, isMobileRailOpen, mediaFilter]);

  useEffect(() => {
    setZoomScale(1.0);
    setRotation(0);
    setPanPos({ x: 0, y: 0 });
    setImageLoadedDimensions(null);
    setImageError(false);
    setRenderGifAsVideo(false);
    setImageRetrySeed(0);
  }, [activeItem?.id, activeItem?.src]);

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

  // Group filtered items strictly by full YYYY-MM-DD key so different months/years never collide
  const groupedMediaSections = useMemo(() => {
    const groups: Array<{ dateKey: string; dateLabel: string; items: UnifiedMediaItem[] }> = [];
    const map = new Map<string, UnifiedMediaItem[]>();
    filteredMediaList.forEach((item) => {
      const { key, label } = getDateGroupInfo(item.createdAt);
      if (!map.has(key)) {
        const arr: UnifiedMediaItem[] = [];
        map.set(key, arr);
        groups.push({ dateKey: key, dateLabel: label, items: arr });
      }
      map.get(key)!.push(item);
    });
    return groups;
  }, [filteredMediaList]);

  const handlePickLocalFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UnifiedMediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = URL.createObjectURL(f);
      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(f.name);

      newItems.push({
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
      });
    }

    if (newItems.length > 0) {
      hasExplicitSelectionRef.current = true;
      setLocalMedia((prev) => [...newItems, ...prev]);
      setPriorityItem(newItems[0]);
      setActiveItem(newItems[0]);
      showToast(t('player.opened_local_toast', 'Đã mở "{name}"').replace('{name}', newItems[0].name));
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      showToast(t('player.downloading_toast', 'Đang tải "{name}"...').replace('{name}', itemToDl.name));
      return;
    }

    if (itemToDl.src) {
      let dlUrl = itemToDl.src;
      if (dlUrl.includes('/api/files/view/')) {
        dlUrl = dlUrl.replace('/api/files/view/', '/api/files/download/');
      }
      downloadFileSafely(dlUrl, itemToDl.name);
      showToast(t('player.downloading_toast', 'Đang tải "{name}"...').replace('{name}', itemToDl.name));
    }
  };

  const handleSelectMediaItem = (item: UnifiedMediaItem) => {
    hasExplicitSelectionRef.current = true;
    setActiveItem(item);
    setMobileFocusedId(item.id);
    saveActiveMediaForSource(viewerSource, item, activeRoomId);
  };

  const handleZoomIn = () => setZoomScale((prev) => Math.min(4.0, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next <= 1.0) setPanPos({ x: 0, y: 0 });
      return next;
    });
  };
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
    setPanPos({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y)
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStartStage = (e: React.TouchEvent) => {
    if (zoomScale <= 1.0 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      panX: panPos.x,
      panY: panPos.y
    };
  };

  const handleTouchMoveStage = (e: React.TouchEvent) => {
    if (!isDragging || zoomScale <= 1.0 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPanPos({
      x: dragStartRef.current.panX + (touch.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (touch.clientY - dragStartRef.current.y)
    });
  };

  const handleImageWheel = (e: React.WheelEvent) => {
    if (activeItem?.type !== 'image') return;
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const activeIndex = useMemo(() => {
    if (!activeItem) return -1;
    return filteredMediaList.findIndex((m) => m.id === activeItem.id || m.src === activeItem.src);
  }, [filteredMediaList, activeItem]);

  // Smoothly center the active item inside the mobile white focus box when selected/opened
  useEffect(() => {
    const strip = mobileStripRef.current;
    if (!strip || !isMobileRailOpen || activeIndex < 0) return;
    const targetTile = strip.querySelector(`[data-mobile-tile-idx="${activeIndex}"]`) as HTMLElement | null;
    if (!targetTile) return;

    const targetLeft = Math.max(0, targetTile.offsetLeft + targetTile.offsetWidth / 2 - strip.clientWidth / 2);
    const currentDist = Math.abs(strip.scrollLeft - targetLeft);
    setMobileFocusedId(filteredMediaList[activeIndex]?.id || null);

    if (currentDist <= 2) return;

    const useInstant = !hasCenteredMobileStripOnceRef.current;
    hasCenteredMobileStripOnceRef.current = true;
    isProgrammaticMobileScrollRef.current = true;
    if (programmaticMobileScrollTimerRef.current) clearTimeout(programmaticMobileScrollTimerRef.current);

    strip.scrollTo({
      left: targetLeft,
      behavior: useInstant ? 'auto' : 'smooth'
    });

    programmaticMobileScrollTimerRef.current = setTimeout(() => {
      isProgrammaticMobileScrollRef.current = false;
    }, useInstant ? 50 : 380);
  }, [activeIndex, isMobileRailOpen, mediaFilter, filteredMediaList.length]);

  useEffect(() => {
    return () => {
      if (mobileScrollRafRef.current) cancelAnimationFrame(mobileScrollRafRef.current);
      if (mobileSnapTimerRef.current) clearTimeout(mobileSnapTimerRef.current);
      if (programmaticMobileScrollTimerRef.current) clearTimeout(programmaticMobileScrollTimerRef.current);
      if (mobileCatchPulseTimerRef.current) clearTimeout(mobileCatchPulseTimerRef.current);
    };
  }, []);

  const triggerWhiteBoxCatchPulse = () => {
    setIsWhiteBoxCaught(true);
    if (mobileCatchPulseTimerRef.current) clearTimeout(mobileCatchPulseTimerRef.current);
    mobileCatchPulseTimerRef.current = setTimeout(() => {
      setIsWhiteBoxCaught(false);
    }, 220);
  };

  const settleMobileStripNearestItem = () => {
    const strip = mobileStripRef.current;
    if (!strip || filteredMediaList.length === 0) return;

    const viewportCenter = strip.scrollLeft + strip.clientWidth / 2;
    const tiles = strip.querySelectorAll<HTMLElement>('[data-mobile-tile-idx]');
    let closestIdx = -1;
    let closestEl: HTMLElement | null = null;
    let minDistance = Infinity;

    tiles.forEach((tile) => {
      const idx = Number(tile.dataset.mobileTileIdx);
      const center = tile.offsetLeft + tile.offsetWidth / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
        closestEl = tile;
      }
    });

    if (closestIdx < 0 || !closestEl) return;
    const targetItem = filteredMediaList[closestIdx];
    if (!targetItem) return;

    const elRef = closestEl as HTMLElement;
    const exactCenterLeft = Math.max(0, elRef.offsetLeft + elRef.offsetWidth / 2 - strip.clientWidth / 2);

    // Gentle magnetic pull back into exact center of the small white box so it feels caught/locked ("níu lại")
    if (Math.abs(strip.scrollLeft - exactCenterLeft) > 1.5) {
      isProgrammaticMobileScrollRef.current = true;
      if (programmaticMobileScrollTimerRef.current) clearTimeout(programmaticMobileScrollTimerRef.current);
      strip.scrollTo({ left: exactCenterLeft, behavior: 'smooth' });
      programmaticMobileScrollTimerRef.current = setTimeout(() => {
        isProgrammaticMobileScrollRef.current = false;
      }, 280);
    }

    triggerWhiteBoxCatchPulse();
    setMobileFocusedId(targetItem.id);

    if (!activeItem || (activeItem.id !== targetItem.id && activeItem.src !== targetItem.src)) {
      hasExplicitSelectionRef.current = true;
      setActiveItem(targetItem);
      saveActiveMediaForSource(viewerSource, targetItem, activeRoomId);
    }
  };

  const handleMobileStripScroll = () => {
    const strip = mobileStripRef.current;
    if (!strip) return;

    if (mobileScrollRafRef.current) cancelAnimationFrame(mobileScrollRafRef.current);
    mobileScrollRafRef.current = requestAnimationFrame(() => {
      const viewportCenter = strip.scrollLeft + strip.clientWidth / 2;
      const tiles = strip.querySelectorAll<HTMLElement>('[data-mobile-tile-idx]');
      let closestIdx = -1;
      let minDistance = Infinity;

      tiles.forEach((tile) => {
        const idx = Number(tile.dataset.mobileTileIdx);
        const center = tile.offsetLeft + tile.offsetWidth / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (closestIdx >= 0 && filteredMediaList[closestIdx]) {
        const item = filteredMediaList[closestIdx];
        setMobileFocusedId(item.id);
        if (!isProgrammaticMobileScrollRef.current && lastHapticItemIdRef.current !== item.id) {
          lastHapticItemIdRef.current = item.id;
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(6);
            }
          } catch {}
        }
      }
    });

    if (!isProgrammaticMobileScrollRef.current) {
      if (mobileSnapTimerRef.current) clearTimeout(mobileSnapTimerRef.current);
      mobileSnapTimerRef.current = setTimeout(() => {
        settleMobileStripNearestItem();
      }, 95);
    }
  };

  const handlePrevItem = () => {
    if (filteredMediaList.length === 0) return;
    const prevIdx = activeIndex <= 0 ? filteredMediaList.length - 1 : activeIndex - 1;
    handleSelectMediaItem(filteredMediaList[prevIdx]);
  };

  const handleNextItem = () => {
    if (filteredMediaList.length === 0) return;
    const nextIdx = activeIndex >= filteredMediaList.length - 1 ? 0 : activeIndex + 1;
    handleSelectMediaItem(filteredMediaList[nextIdx]);
  };

  // Keyboard shortcuts for fast vertical Up/Down item switching & Escape exit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevItem();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextItem();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredMediaList]);

  const handleReturn = () => {
    const returnTab: 'chat' | 'drive' = viewerSource === 'chat' ? 'chat' : 'drive';
    if (onBack) {
      onBack(returnTab);
    } else {
      window.history.pushState(null, '', `/?page=${returnTab}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleCopyOrOpenLink = async () => {
    if (!activeItem?.src) return;
    const absoluteUrl = activeItem.src.startsWith('http')
      ? activeItem.src
      : `${window.location.origin}${activeItem.src}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      showToast('Đã sao chép liên kết media');
    } catch {
      showToast(activeItem.name);
    }
  };

  const currentLangInfo = languages.find((l) => l.code === currentLang) || languages[0];
  const isActiveGif = activeItem ? isGifFile(activeItem.name || activeItem.src, activeItem.mimeType) : false;

  const ownerLabel = activeItem?.senderName || userProfile?.displayName || activeItem?.name || t('player.media_viewer');
  const ownerInitial = (ownerLabel.trim().charAt(0) || 'C').toUpperCase();
  const formattedTime = formatItemTimestamp(activeItem?.createdAt);
  const formattedSize = activeItem?.size
    ? (typeof activeItem.size === 'number' ? formatFileSize(activeItem.size) : String(activeItem.size))
    : '';

  const renderThumbnailTile = (item: UnifiedMediaItem) => {
    const isActive = activeItem?.id === item.id || activeItem?.src === item.src;
    const itemIsGif = isGifFile(item.name || item.src, item.mimeType);
    const thumbSrc = item.type === 'image' ? (item.thumbnail || item.src) : item.thumbnail;

    return (
      <button
        key={item.id}
        type="button"
        data-media-active={isActive ? 'true' : undefined}
        onClick={() => handleSelectMediaItem(item)}
        title={item.name}
        className={`w-[76px] h-[76px] mx-auto rounded-lg overflow-hidden relative bg-[#181d27] shrink-0 block transition-all cursor-pointer group ${
          isActive
            ? 'ring-2 ring-white shadow-lg opacity-100 scale-[1.02]'
            : 'ring-1 ring-white/10 opacity-70 hover:opacity-100 hover:ring-white/30'
        }`}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#181d27] text-slate-400">
            {item.type === 'video' ? <Film className="w-5 h-5 text-slate-400" /> : <ImageIcon className="w-5 h-5 text-slate-400" />}
            <span className="text-[9px] mt-1 px-1 truncate max-w-[68px] text-slate-500">{item.name}</span>
          </div>
        )}

        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
            <div className="w-7 h-7 rounded-full bg-black/60 border border-white/35 flex items-center justify-center shadow">
              <Play className="w-3.5 h-3.5 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        )}

        {itemIsGif && (
          <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/75 text-[8px] font-bold text-emerald-300 pointer-events-none">
            GIF
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className="h-[100dvh] w-full bg-[#090c11] text-slate-100 flex flex-col overflow-hidden select-none relative"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,.gif,.mp4,.webm,.mov,.mkv"
        multiple
        className="hidden"
        onChange={(e) => handlePickLocalFiles(e.target.files)}
      />

      {toastText && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-lg bg-[#161c26]/95 border border-emerald-500/40 text-emerald-200 text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastText}</span>
        </div>
      )}

      {/* BAND 1: Slim Top Bar (Index Counter + Centered Title + Minimal Right Controls — No Back Button) */}
      <header className="h-11 px-3 sm:px-4 bg-[#12161f] border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-2 min-w-0 w-20 sm:w-32 shrink-0">
          {filteredMediaList.length > 0 && activeIndex >= 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
              {activeIndex + 1} / {filteredMediaList.length}
            </span>
          )}
        </div>

        {/* Centered Single-Line Title */}
        <div className="flex-1 min-w-0 flex items-center justify-center px-2">
          <h1
            className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md md:max-w-xl text-center"
            title={activeItem?.name || ''}
          >
            {activeItem?.name || t('player.media_viewer')}
          </h1>
        </div>

        {/* Top-Right Compact Actions */}
        <div className="flex items-center justify-end gap-1.5 w-20 sm:w-32 shrink-0">
          <div className="relative" translate="no">
            <button
              type="button"
              onClick={() => setIsLangMenuOpen((v) => !v)}
              className="h-8 px-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
              title={t('nav.language')}
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs">{currentLangInfo?.flag}</span>
            </button>
            {isLangMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)} />
                <div className="notranslate absolute ltr:right-0 rtl:left-0 top-full mt-1.5 w-52 rounded-xl bg-[#161b26] border border-white/12 shadow-2xl z-50 p-1.5 max-h-72 overflow-y-auto space-y-0.5">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        currentLang === lang.code
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{lang.flag}</span>
                        <span className="truncate">{lang.name}</span>
                      </span>
                      {currentLang === lang.code && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleReturn}
            className="w-8 h-8 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            title={t('viewer.close', 'Đóng')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* BAND 2: Dark Media Stage + Desktop Right Rail + Mobile Bottom Horizontal Carousel */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative bg-[#090c11]">
        {/* MAIN MEDIA CANVAS */}
        <main className="flex-1 min-w-0 min-h-0 h-full relative flex items-center justify-center overflow-hidden">
          {activeItem ? (
            activeItem.type === 'video' ? (
              <div className="w-full h-full flex items-center justify-center p-1 sm:p-3">
                <AllInOneVideoPlayer
                  key={activeItem.id}
                  isOpen={true}
                  isEmbedded={true}
                  framelessStage={true}
                  disableCloudPlaylist={true}
                  initialSrc={activeItem.src}
                  initialTitle={activeItem.name}
                  initialFile={activeItem.file}
                  initialSize={activeItem.size}
                  onDownload={() => handleDownloadActiveItem(activeItem)}
                />
              </div>
            ) : (
              <div
                ref={containerRef}
                className={`w-full h-full flex items-center justify-center p-3 sm:p-6 overflow-hidden relative ${
                  zoomScale > 1.0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                }`}
                onWheel={handleImageWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStartStage}
                onTouchMove={handleTouchMoveStage}
                onTouchEnd={handleMouseUp}
                onDoubleClick={() => (zoomScale > 1.0 ? handleResetZoom() : setZoomScale(2.0))}
              >
                {imageError ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 bg-[#12161f] border border-white/10 rounded-xl max-w-sm">
                    <div className="w-11 h-11 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{t('player.image_error_title')}</h3>
                    <p className="text-xs text-slate-400">{t('player.image_error_desc')}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setImageError(false);
                          setRenderGifAsVideo(false);
                          setImageRetrySeed((s) => s + 1);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{t('player.retry')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadActiveItem(activeItem)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('player.download')}</span>
                      </button>
                    </div>
                  </div>
                ) : renderGifAsVideo ? (
                  <video
                    key={`gifvid_${activeItem.src}_${imageRetrySeed}`}
                    src={activeItem.src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    {...({ 'webkit-playsinline': 'true', 'x-webkit-playsinline': 'true' } as any)}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (v.videoWidth && v.videoHeight) {
                        setImageLoadedDimensions({ width: v.videoWidth, height: v.videoHeight });
                      }
                    }}
                    onError={() => setImageError(true)}
                    className="max-h-full max-w-full object-contain transition-transform duration-150 select-none pointer-events-none"
                    style={{
                      transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale}) rotate(${rotation}deg)`
                    }}
                  />
                ) : (
                  <img
                    key={`${activeItem.src}_${imageRetrySeed}`}
                    src={activeItem.src}
                    alt={activeItem.name}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain transition-transform duration-150 select-none pointer-events-none"
                    style={{
                      transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale}) rotate(${rotation}deg)`
                    }}
                    onLoad={(e) => {
                      setImageError(false);
                      const img = e.currentTarget;
                      setImageLoadedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    onError={() => {
                      if (isActiveGif && !renderGifAsVideo) {
                        setRenderGifAsVideo(true);
                      } else {
                        setImageError(true);
                      }
                    }}
                  />
                )}
              </div>
            )
          ) : (
            <div className="p-10 rounded-xl border border-dashed border-white/15 bg-[#11151d] flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-4">
              <Film className="w-9 h-9 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-200">{t('player.empty_stage_title')}</h3>
              <p className="text-xs text-slate-400">{t('player.empty_stage_desc')}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{t('player.empty_stage_btn')}</span>
              </button>
            </div>
          )}

          {/* Floating Vertical Up/Down Prev/Next Controls on Right Edge of Stage */}
          {filteredMediaList.length > 1 && (
            <div className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevItem();
                }}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                title={t('player.prev_item')}
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextItem();
                }}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                title={t('player.next_item')}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>

        {/* MOBILE BOTTOM HORIZONTAL FILMSTRIP SELECTOR WITH CENTER WHITE MAGNETIC FOCUS BOX (< lg) */}
        {isMobileRailOpen && allMediaItems.length > 0 && (
          <section className="lg:hidden shrink-0 bg-[#12161f] border-t border-white/[0.08] flex flex-col select-none">
            {/* Compact Filter + Active Date Header */}
            <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-slate-400 tabular-nums truncate">
                {getDateGroupInfo(activeItem?.createdAt).label}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMediaFilter('all')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                    mediaFilter === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({allMediaItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMediaFilter('video')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    mediaFilter === 'video' ? 'bg-white/15 text-emerald-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaFilter('image')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    mediaFilter === 'image' ? 'bg-white/15 text-sky-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Ảnh</span>
                </button>
              </div>
            </div>

            {/* Horizontal Scroll Filmstrip + Small White Focus Box */}
            <div className="relative h-[78px] w-full bg-[#0d1118] flex items-center overflow-hidden">
              {/* Soft side vignette fades */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0d1118] to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0d1118] to-transparent z-10" />

              {/* Small White Focus Box ("ô màu trắng nhỏ") with gentle catch pulse */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[62px] h-[62px] rounded-xl border-2 border-white z-20 transition-transform duration-200 ease-out ${
                  isWhiteBoxCaught
                    ? 'scale-[1.06] shadow-[0_0_0_2px_rgba(255,255,255,0.28),0_0_18px_rgba(255,255,255,0.35)]'
                    : 'scale-100 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.65)]'
                }`}
              >
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-white" />
              </div>

              {filteredMediaList.length === 0 ? (
                <div className="w-full text-center text-[11px] text-slate-500">
                  {t('player.empty_search')}
                </div>
              ) : (
                <div
                  ref={mobileStripRef}
                  onScroll={handleMobileStripScroll}
                  onTouchEnd={() => {
                    if (mobileSnapTimerRef.current) clearTimeout(mobileSnapTimerRef.current);
                    mobileSnapTimerRef.current = setTimeout(() => {
                      settleMobileStripNearestItem();
                    }, 120);
                  }}
                  className="w-full h-full flex items-center gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory touch-pan-x overscroll-x-contain"
                >
                  {/* Start spacer so first thumbnail stops centered inside the small white box */}
                  <div className="shrink-0 h-1" style={{ width: 'calc(50% - 38px)' }} aria-hidden="true" />

                  {filteredMediaList.map((item, idx) => {
                    const isFocused = (mobileFocusedId || activeItem?.id) === item.id;
                    const itemIsGif = isGifFile(item.name || item.src, item.mimeType);
                    const thumbSrc = item.type === 'image' ? (item.thumbnail || item.src) : item.thumbnail;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-mobile-tile-idx={idx}
                        onClick={() => {
                          handleSelectMediaItem(item);
                          triggerWhiteBoxCatchPulse();
                        }}
                        style={{ scrollSnapStop: 'always' }}
                        title={item.name}
                        className={`w-[56px] h-[56px] rounded-lg overflow-hidden relative bg-[#181d27] shrink-0 snap-center cursor-pointer transition-[transform,opacity] duration-200 ease-out ${
                          isFocused
                            ? 'scale-[1.03] opacity-100'
                            : 'scale-[0.88] opacity-50 hover:opacity-80'
                        }`}
                      >
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt={item.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-[#181d27] text-slate-400">
                            {item.type === 'video' ? <Film className="w-4 h-4 text-slate-400" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
                          </div>
                        )}

                        {item.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
                            <div className="w-6 h-6 rounded-full bg-black/65 border border-white/35 flex items-center justify-center">
                              <Play className="w-3 h-3 fill-white text-white translate-x-0.5" />
                            </div>
                          </div>
                        )}

                        {itemIsGif && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/75 text-[7.5px] font-bold text-emerald-300 pointer-events-none">
                            GIF
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* End spacer so last thumbnail stops centered inside the small white box */}
                  <div className="shrink-0 h-1" style={{ width: 'calc(50% - 38px)' }} aria-hidden="true" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* SLIM RIGHT VERTICAL THUMBNAIL RAIL (Desktop only — matches PC Zalo structure) */}
        {isSidebarVisible && (
          <aside className="hidden lg:flex w-[108px] sm:w-[116px] shrink-0 bg-[#12161f] border-l border-white/[0.08] flex-col overflow-hidden">
            {/* Compact Filter Strip */}
            <div className="px-1.5 py-2 border-b border-white/[0.07] flex items-center justify-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMediaFilter('all')}
                className={`px-1.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                  mediaFilter === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Tất cả"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMediaFilter('video')}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  mediaFilter === 'video' ? 'bg-white/15 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
                title="Video"
              >
                <Film className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMediaFilter('image')}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  mediaFilter === 'image' ? 'bg-white/15 text-sky-300' : 'text-slate-400 hover:text-white'
                }`}
                title="Ảnh / GIF"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Date-Grouped Square Thumbnail List */}
            <div
              ref={railScrollRef}
              className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3 no-scrollbar"
            >
              {groupedMediaSections.length === 0 ? (
                <div className="py-8 px-1 text-center text-[10px] text-slate-500">
                  {t('player.empty_search')}
                </div>
              ) : (
                groupedMediaSections.map((group) => (
                  <div key={group.dateKey} className="space-y-2">
                    <div
                      className="text-center text-[10px] font-semibold text-slate-400 tabular-nums px-1 truncate"
                      title={group.dateLabel}
                    >
                      {group.dateLabel}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => renderThumbnailTile(item))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Quick Search / Filter Floating Popover */}
        {showSearchPopover && (
          <div className="absolute bottom-3 right-3 lg:right-32 z-30 w-64 p-2.5 rounded-xl bg-[#161b26] border border-white/15 shadow-2xl">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('player.search_placeholder')}
                className="w-full bg-[#0d1118] border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BAND 3: Slim Bottom Utility & Metadata Bar */}
      <footer className="h-13 px-2.5 sm:px-4 bg-[#12161f] border-t border-white/[0.08] flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 z-40">
        {/* Bottom-Left: Owner / Media Info (clean unboxed text) */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 max-w-[30%] sm:max-w-[32%]">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
            {activeItem?.senderAvatar ? (
              <img
                src={activeItem.senderAvatar}
                alt={ownerLabel}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xs font-semibold text-slate-200">{ownerInitial}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-white truncate" title={activeItem?.name || ownerLabel}>
              {ownerLabel}
            </p>
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-slate-400 tabular-nums truncate">
              <span>{activeItem?.type === 'video' ? t('player.video_label') : isActiveGif ? 'GIF' : t('player.image_label')}</span>
              {formattedSize && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formattedSize}</span>
                </>
              )}
              {imageLoadedDimensions && activeItem?.type === 'image' && (
                <>
                  <span aria-hidden="true" className="hidden md:inline">·</span>
                  <span className="hidden md:inline">{imageLoadedDimensions.width}×{imageLoadedDimensions.height}</span>
                </>
              )}
              {formattedTime && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{formattedTime}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom-Center: Compact Centered Icon Utility Bar with Hairline Dividers */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={t('player.open_local_tooltip')}
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleDownloadActiveItem()}
            disabled={!activeItem}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-emerald-300 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
            title={t('player.download_tooltip')}
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="hidden sm:block w-px h-4 bg-white/15 mx-1" />

          <button
            type="button"
            onClick={handleCopyOrOpenLink}
            disabled={!activeItem?.src}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
            title="Sao chép liên kết"
          >
            <Link2 className="w-4 h-4" />
          </button>

          {activeItem?.src && !activeItem.isLocal && (
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = activeItem.src;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.click();
              }}
              className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white items-center justify-center transition-colors cursor-pointer"
              title="Mở liên kết gốc"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {activeItem?.type === 'image' && (
            <>
              <div className="hidden sm:block w-px h-4 bg-white/15 mx-1" />

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomScale >= 4.0}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                title={t('player.zoom_in')}
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomScale <= 0.5}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                title={t('player.zoom_out')}
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white items-center justify-center transition-colors cursor-pointer"
                title={t('player.rotate_90')}
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {zoomScale !== 1.0 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-1.5 sm:px-2 h-7 sm:h-8 rounded-lg bg-white/10 hover:bg-white/15 text-[10.5px] sm:text-[11px] font-mono tabular-nums text-white cursor-pointer"
                  title={t('player.zoom_reset')}
                >
                  {Math.round(zoomScale * 100)}%
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom-Right: Search, Thumbnail Rail Toggle & Fullscreen */}
        <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowSearchPopover((v) => !v)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              showSearchPopover || searchQuery
                ? 'bg-white/15 text-emerald-300'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            title={t('player.search_placeholder')}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsMobileRailOpen((v) => !v);
              } else {
                setIsSidebarVisible((v) => !v);
              }
            }}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isMobileRailOpen
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            } ${
              isSidebarVisible ? 'lg:bg-white/15 lg:text-white' : 'lg:bg-transparent lg:text-slate-400'
            }`}
            title={t('player.toggle_list_tooltip')}
          >
            <PanelRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white items-center justify-center transition-colors cursor-pointer"
            title={t('player.shortcut_fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default VideoPlayerPage;
