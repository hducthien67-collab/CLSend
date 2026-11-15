import { UserProfileModal } from '../UserProfileModal';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { yieldToMain } from '../../utils/scheduler';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ChatInlineVideoPlayer } from '../ChatInlineVideoPlayer';
import { ChatMediaImage } from '../ChatMediaImage';
import { db } from '../../firebase/config';
import { 
  collection, 
  query, 
  orderBy, 
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { ChatMessage, ChatRoom, RoomMember } from '../../types';
import {
  getCachedRoomMessages,
  setCachedRoomMessages,
  removeCachedRoomMessage,
} from '../../utils/chatMessageCache';
import { 
  Send, 
  Image as ImageIcon, 
  Camera, 
  Paperclip, 
  Trash2, 
  Flag, 
  Download, 
  Eye, 
  ShieldAlert, 
  Loader2, 
  Sparkles,
  ArrowDown,
  X,
  ChevronLeft,
  Info,
  Globe,
  Lock,
  Plus,
  Key,
  MessagesSquare,
  Users,
  Crown,
  Search,
  Check,
  Calendar,
  Zap,
  History,
  Clipboard,
  AlertTriangle,
  Copy,
  Video,
  Cloud,
  ExternalLink
} from 'lucide-react';
import { CloudDrivePickerModal } from '../CloudDrivePickerModal';
import { CloudDriveFile } from '../../types';
import { uploadFileToServer, isImageFile, isVideoFile, isGifFile, generateImageThumbnail, extractVideoModerationFrames, fileToBase64, createClientFallbackFileInfo } from '../../utils/fileUpload';
import { downloadFileSafely } from '../../utils/fileDownload';
import { formatFileSize } from '../../utils/device';
import { renderClickableText } from '../../utils/textFormat';
import { wrapSecureBase64Message, unwrapSecureBase64Message } from '../../utils/base64Security';
import { ReportMessageModal } from '../ReportMessageModal';
import { RoomDetailsModal } from '../RoomDetailsModal';
import { ZoomableImageViewerModal } from '../ZoomableImageViewerModal';
import { ResetServerModal } from '../ResetServerModal';
import { playSendSound, playReceiveSound, playShieldAlertSound } from '../../utils/sound';
import { cleanFirestoreObject } from '../../utils/firestoreClean';
import { censorProfanity, moderateUploadedImage, moderateUploadedVideo, deleteServerUploadedFile } from '../../utils/moderation';
import { inspectFileSecurity } from '../../utils/fileSecurity';
import { checkContentWithAI } from '../../utils/aiModeration';
import { 
  isDevUser, 
  formatGroupDateHeader, 
  getGroupDateKey, 
  getYesterdayStartIso,
  autoPruneWeeklyMessages 
} from '../../utils/devModeration';
import { extractRoomMediaFromMessages, openMediaInLargeViewer } from '../../utils/mediaViewerSession';

const ROOM_PRESET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1'];

export const MobileChatView: React.FC = () => {
  const { currentUser, userProfile, settings } = useAuth();
  const { t, currentLang } = useLanguage();
  const isVi = currentLang === 'vi';
  const isZh = currentLang === 'zh-CN' || currentLang === 'zh-TW';
  const pick = <T,>(vi: T, en: T, zh: T): T => (isVi ? vi : isZh ? zh : en);
  
  // Room navigation state: 'rooms_list' | 'chat_feed'
  const [viewMode, setViewMode] = useState<'rooms_list' | 'chat_feed'>('chat_feed');
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('public-relay-lounge');
  // Message state: today & yesterday loaded by default, older messages loaded when scrolling up
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [memberMetaMap, setMemberMetaMap] = useState<Record<string, { displayName: string; avatarUrl?: string; avatarColor?: string; isDev?: boolean; isOnline?: boolean; lastSeen?: string }>>({});

  const messages = React.useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of olderMessages) map.set(m.id, m);
    for (const m of recentMessages) map.set(m.id, m);
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    return arr;
  }, [olderMessages, recentMessages]);
  
  // Input & Upload state
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  
  const INITIAL_LIVE_PAGE_SIZE = 35;
  const OLDER_PAGE_BATCH_SIZE = 25;

  // Modals & Viewers
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [showResetServerModal, setShowResetServerModal] = useState(false);

  // Discord / Zalo / Messenger cursor pagination & instant room cache
  const [isInitialLoadingMessages, setIsInitialLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [unreadNewCount, setUnreadNewCount] = useState(0);

  const oldestCursorDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasLoadedOlderHistoryRef = useRef(false);
  const isFetchingOlderRef = useRef(false);
  const pendingScrollAnchorRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const pendingInitialSnapRef = useRef(false);
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const soundEnabledRef = useRef(Boolean(settings?.soundEnabled));
  soundEnabledRef.current = Boolean(settings?.soundEnabled);
  const initialMessageIdsRef = useRef<Set<string>>(new Set());

  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any | null>(null);
  const [viewingZoomImage, setViewingZoomImage] = useState<{ url: string; name?: string; size?: number } | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const showScrollBottomRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);
  const lastLoadOlderRef = useRef(0);
  const [memberNamesMap, setMemberNamesMap] = useState<Record<string, string>>({});

  const roomMediaGallery = React.useMemo(() => {
    return extractRoomMediaFromMessages(messages, {
      roomId: activeRoomId,
      currentUserUid: currentUser?.uid,
      currentUserName: memberNamesMap[currentUser?.uid || ''] || userProfile?.displayName || 'Bạn',
      currentUserAvatar: userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL || null,
      memberNamesMap,
      memberMetaMap,
    });
  }, [messages, activeRoomId, currentUser?.uid, currentUser?.photoURL, userProfile?.displayName, userProfile?.customAvatarUrl, settings?.customAvatarUrl, memberNamesMap, memberMetaMap]);

  // Room Create & Join state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMode, setNewRoomMode] = useState<'public' | 'private'>('public');
  const [newRoomAvatar, setNewRoomAvatar] = useState('');
  const [newRoomColor, setNewRoomColor] = useState('#10b981');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isFirstLoadRef = useRef(true);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || {
    id: 'public-relay-lounge',
    name: 'Đại Sảnh Toàn Cầu',
    code: 'PUBLIC',
    isPrivate: false,
    avatarColor: '#10b981',
    membersCount: 1,
    members: []
  };

  const scrollToBottom = (smooth = true) => {
    setUnreadNewCount(0);
    showScrollBottomRef.current = false;
    setShowScrollBottom(false);
    isNearBottomRef.current = true;
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Real-time member display names & avatars synchronization from presence and users collection
  useEffect(() => {
    const presenceRef = collection(db, 'presence');
    const unsubPresence = onSnapshot(presenceRef, (snapshot) => {
      const names: Record<string, string> = {};
      const meta: Record<string, { displayName: string; avatarUrl?: string; avatarColor?: string; isDev?: boolean; isOnline?: boolean; lastSeen?: string }> = {};
      const now = Date.now();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const displayName = data.displayName || data.deviceName;
        const avatarUrl = data.customAvatarUrl || data.photoURL || undefined;
        const avatarColor = data.avatarColor || '#10b981';
        const isDev = Boolean(data.isDev || isDevUser(data.email));

        const peerTime = data.lastSeenServer?.toMillis?.() || 
          (data.lastSeenServer?.seconds ? data.lastSeenServer.seconds * 1000 : 0) || 
          data.lastSeenMs || 
          (data.lastSeen ? new Date(data.lastSeen).getTime() : 0);
        // Thời gian sống 3 phút (180.000ms) chuẩn Facebook: chỉ offline khi > 3 phút không phản hồi
        const isOnline = peerTime > 0 && Math.abs(now - peerTime) <= 180000 && data.status !== 'offline';

        if (displayName) {
          const item = { displayName, avatarUrl, avatarColor, isDev, isOnline, lastSeen: data.lastSeen };
          if (data.uid) {
            names[data.uid] = displayName;
            meta[data.uid] = item;
          }
          if (data.deviceName) {
            names[data.deviceName] = displayName;
            meta[data.deviceName] = item;
          }
          meta[docSnap.id] = item;
        }
      });
      setMemberNamesMap((prev) => ({ ...prev, ...names }));
      setMemberMetaMap((prev) => ({ ...prev, ...meta }));
    });

    const usersRef = collection(db, 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const names: Record<string, string> = {};
      const meta: Record<string, { displayName: string; avatarUrl?: string; avatarColor?: string; isDev?: boolean }> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const displayName = data.displayName || data.deviceName;
        const avatarUrl = data.customAvatarUrl || data.photoURL || undefined;
        const avatarColor = data.avatarColor || '#10b981';
        const isDev = Boolean(data.isDev || isDevUser(data.email));

        if (displayName) {
          const item = { displayName, avatarUrl, avatarColor, isDev };
          names[docSnap.id] = displayName;
          meta[docSnap.id] = item;
          if (data.uid) {
            names[data.uid] = displayName;
            meta[data.uid] = item;
          }
        }
      });
      setMemberNamesMap((prev) => ({ ...prev, ...names }));
      setMemberMetaMap((prev) => ({ ...prev, ...meta }));
    });

    return () => {
      unsubPresence();
      unsubUsers();
    };
  }, []);

  // Listen to available chat rooms
  useEffect(() => {
    if (!currentUser) return;

    const roomsRef = collection(db, 'rooms');
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      const roomList: ChatRoom[] = [];
      snapshot.forEach((docSnap) => {
        roomList.push({ id: docSnap.id, ...docSnap.data() } as ChatRoom);
      });

      // Sort so public room is first, then newest
      roomList.sort((a, b) => {
        if (a.id === 'public-relay-lounge') return -1;
        if (b.id === 'public-relay-lounge') return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      setRooms(roomList);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Watch for active room deletion by owner (Auto-redirect to lounge)
  useEffect(() => {
    if (activeRoomId && activeRoomId !== 'public-relay-lounge' && rooms.length > 0) {
      const roomStillExists = rooms.some((r) => r.id === activeRoomId);
      if (!roomStillExists) {
        setActiveRoomId('public-relay-lounge');
        setRecentMessages([]);
        setOlderMessages([]);
      }
    }
  }, [rooms, activeRoomId]);

  // Zero-jump scroll restoration BEFORE paint when prepending older messages
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || !pendingScrollAnchorRef.current) return;
    const heightDiff = el.scrollHeight - pendingScrollAnchorRef.current.prevScrollHeight;
    el.scrollTop = pendingScrollAnchorRef.current.prevScrollTop + heightDiff;
    pendingScrollAnchorRef.current = null;
  }, [olderMessages]);

  // Instant bottom snap before paint when hydrating cache or switching to chat feed
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || !pendingInitialSnapRef.current || recentMessages.length === 0) return;
    el.scrollTop = el.scrollHeight;
    pendingInitialSnapRef.current = false;
  }, [recentMessages, activeRoomId, viewMode]);

  // Cursor-based one-shot getDocs pagination for older history (never tears down live listener)
  const handleLoadOlderMessages = async () => {
    if (isFetchingOlderRef.current || !hasMoreOlder || !activeRoomId) return;
    const cursorDoc = oldestCursorDocRef.current;
    if (!cursorDoc) return;

    const targetRoomId = activeRoomId;
    isFetchingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const messagesRef = collection(db, 'rooms', targetRoomId, 'messages');
      const olderQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(cursorDoc),
        limit(OLDER_PAGE_BATCH_SIZE)
      );
      const snap = await getDocs(olderQuery);

      if (activeRoomIdRef.current !== targetRoomId) return;

      const olderBatch: ChatMessage[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data({ serverTimestamps: 'estimate' });
        olderBatch.push({ id: docSnap.id, ...data } as ChatMessage);
        initialMessageIdsRef.current.add(docSnap.id);
      });

      if (snap.docs.length > 0) {
        oldestCursorDocRef.current = snap.docs[snap.docs.length - 1];
      }
      hasLoadedOlderHistoryRef.current = true;
      setHasMoreOlder(snap.docs.length >= OLDER_PAGE_BATCH_SIZE);

      if (olderBatch.length > 0) {
        const el = messagesContainerRef.current;
        if (el) {
          pendingScrollAnchorRef.current = {
            prevScrollHeight: el.scrollHeight,
            prevScrollTop: el.scrollTop,
          };
        }
        setOlderMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          for (const m of prev) map.set(m.id, m);
          for (const m of olderBatch) map.set(m.id, m);
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn('Mobile load older messages error:', err);
    } finally {
      isFetchingOlderRef.current = false;
      if (activeRoomIdRef.current === targetRoomId) {
        setIsLoadingOlder(false);
      }
    }
  };

  // Single stable live listener + instant cache hydration on room switch
  useEffect(() => {
    if (!currentUser || !activeRoomId) return;

    const targetRoomId = activeRoomId;
    isFirstLoadRef.current = true;
    initialMessageIdsRef.current.clear();
    oldestCursorDocRef.current = null;
    hasLoadedOlderHistoryRef.current = false;
    isFetchingOlderRef.current = false;
    pendingScrollAnchorRef.current = null;
    setIsLoadingOlder(false);
    setUnreadNewCount(0);
    setShowScrollBottom(false);
    showScrollBottomRef.current = false;
    isNearBottomRef.current = true;
    setOlderMessages([]);

    const cached = getCachedRoomMessages(targetRoomId);
    if (cached && cached.messages.length > 0) {
      cached.messages.forEach((m) => initialMessageIdsRef.current.add(m.id));
      setRecentMessages(cached.messages);
      setHasMoreOlder(cached.hasMore);
      setIsInitialLoadingMessages(false);
      pendingInitialSnapRef.current = true;
    } else {
      setRecentMessages([]);
      setHasMoreOlder(false);
      setIsInitialLoadingMessages(true);
      pendingInitialSnapRef.current = false;
    }

    const messagesRef = collection(db, 'rooms', targetRoomId, 'messages');
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(INITIAL_LIVE_PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (activeRoomIdRef.current !== targetRoomId) return;

        const list: ChatMessage[] = [];
        const confirmedTempIds = new Set<string>();
        let externalCount = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data({ serverTimestamps: 'estimate' });
          const msg = { id: docSnap.id, ...data } as ChatMessage;
          list.push(msg);
          if (msg.clientTempId) {
            confirmedTempIds.add(msg.clientTempId);
          }
          if (isFirstLoadRef.current) {
            initialMessageIdsRef.current.add(docSnap.id);
          } else if (!initialMessageIdsRef.current.has(docSnap.id)) {
            initialMessageIdsRef.current.add(docSnap.id);
            if (msg.senderId !== currentUser?.uid) {
              externalCount += 1;
            }
          }
        });

        if (!hasLoadedOlderHistoryRef.current) {
          oldestCursorDocRef.current =
            snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
          setHasMoreOlder(snapshot.docs.length >= INITIAL_LIVE_PAGE_SIZE);
        }

        list.sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );

        setRecentMessages((prev) => {
          const pendingOptimistic = prev.filter(
            (m) => m.id.startsWith('temp-') && !confirmedTempIds.has(m.id)
          );
          if (pendingOptimistic.length === 0) return list;
          const combined = [...list, ...pendingOptimistic];
          combined.sort(
            (a, b) =>
              new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          );
          return combined;
        });

        setCachedRoomMessages(
          targetRoomId,
          list,
          snapshot.docs.length >= INITIAL_LIVE_PAGE_SIZE
        );

        if (externalCount > 0 && soundEnabledRef.current) {
          playReceiveSound();
        }

        const wasFirst = isFirstLoadRef.current;
        isFirstLoadRef.current = false;
        setIsInitialLoadingMessages(false);

        if (wasFirst) {
          pendingInitialSnapRef.current = true;
        } else {
          const latestMsg = list.length > 0 ? list[list.length - 1] : null;
          if (latestMsg?.senderId === currentUser?.uid || isNearBottomRef.current) {
            setUnreadNewCount(0);
            requestAnimationFrame(() => scrollToBottom(true));
          } else if (externalCount > 0) {
            setUnreadNewCount((prev) => prev + externalCount);
            showScrollBottomRef.current = true;
            setShowScrollBottom(true);
          }
        }
      },
      (err) => {
        console.warn('Mobile room messages listener notice:', err);
        setIsInitialLoadingMessages(false);
      }
    );

    return () => unsubscribe();
  }, [activeRoomId, currentUser?.uid]);

  // Snap to bottom when returning to chat feed from rooms list
  useEffect(() => {
    if (viewMode === 'chat_feed') {
      setIsLoadingOlder(false);
      pendingInitialSnapRef.current = true;
    }
  }, [viewMode, activeRoomId]);

  // Auto maintenance for DEV / rooms with weekly auto-reset
  useEffect(() => {
    if (!currentUser || !activeRoomId || !isDevUser(currentUser.email)) return;
    if (activeRoom && (activeRoom as any).autoWeeklyReset) {
      autoPruneWeeklyMessages(activeRoomId).catch(() => {});
    }
  }, [activeRoomId, currentUser?.email, (activeRoom as any)?.autoWeeklyReset]);

  // Auto register current user into active room members with DEV role if applicable
  useEffect(() => {
    if (!currentUser || !activeRoomId || !activeRoom) return;
    const members = activeRoom.members || [];
    const isMember = members.some(m => m.uid === currentUser.uid);
    if (!isMember) {
      const isDev = isDevUser(currentUser.email);
      const isRoomOwner = activeRoom.ownerId === currentUser.uid || activeRoom.createdBy === currentUser.uid;
      const newMember: RoomMember = {
        uid: currentUser.uid,
        displayName: userProfile?.displayName || currentUser.displayName || settings?.deviceName || 'Người dùng',
        deviceName: settings?.deviceName || 'Điện thoại',
        avatarColor: settings?.avatarColor || '#10b981',
        role: isRoomOwner ? 'owner' : 'member',
        joinedAt: new Date().toISOString(),
        email: currentUser.email || '',
        isDev: isDev
      };
      updateDoc(doc(db, 'rooms', activeRoomId), {
        members: [...members, newMember],
        membersCount: members.length + 1
      }).catch(err => {
        console.warn('Auto register member error:', err);
      });
    }
  }, [currentUser?.uid, activeRoomId, activeRoom?.id]);

  const handleSendMessage = async (textOverride?: string) => {
    const rawText = typeof textOverride === 'string' ? textOverride : inputText;
    if (!rawText.trim() || !currentUser || isUploading) return;

    const rawTextOriginal = rawText.trim();
    // 1. Instant 0ms clear
    setInputText('');
    await yieldToMain();

    // Moderate text: filter profanity ONLY in public rooms
    const isPublicRoom = activeRoomId === 'public-relay-lounge' || (activeRoom && activeRoom.isPrivate !== true);
    const profanityResult = isPublicRoom
      ? censorProfanity(rawTextOriginal)
      : { cleanText: rawTextOriginal, hasProfanity: false, matchCount: 0, detectedList: [] };
    const sanitizedText = profanityResult.cleanText;
    const hasProfanity = profanityResult.hasProfanity;
    const detectedList = profanityResult.detectedList || [];

    if (hasProfanity) {
      playShieldAlertSound();
      setModerationWarning(
        `⚠️ Cảnh báo: Tin nhắn chứa từ ngữ vi phạm tiêu chuẩn cộng đồng ("${detectedList.join(', ')}"). Hệ thống đã tự động lọc dấu sao ***.`
      );
      setTimeout(() => setModerationWarning(null), 5000);
    }

    // Background AI safety audit (non-blocking, only in public rooms to save tokens)
    if (sanitizedText && sanitizedText.length >= 2 && isPublicRoom) {
      checkContentWithAI(sanitizedText, currentUser?.email || undefined, currentUser?.uid)
        .then(aiCheck => {
          if (aiCheck?.isFlagged && (aiCheck.severity === 'high' || aiCheck.severity === 'critical')) {
            playShieldAlertSound();
            setModerationWarning(
              `🚫 [AI Kiểm Duyệt] Cảnh báo vi phạm: ${aiCheck.message || aiCheck.matchedRule}. Nhắc nhở: "${aiCheck.remindText || 'Vui lòng tuân thủ nội quy'}"`
            );
            setTimeout(() => setModerationWarning(null), 7000);
          }
        })
        .catch(() => {});
    }

    const isDev = isDevUser(currentUser.email);
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const nowIso = new Date().toISOString();

    const optimisticPayload: ChatMessage = {
      id: tempId,
      roomId: activeRoomId,
      senderId: currentUser.uid,
      senderName: userProfile?.displayName || currentUser.displayName || settings?.deviceName || 'Người dùng di động',
      senderEmail: currentUser.email || '',
      senderDevice: settings?.deviceName || 'Điện thoại',
      senderAvatar: userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL || '',
      senderAvatarColor: userProfile?.avatarColor || settings?.avatarColor || '#10b981',
      text: wrapSecureBase64Message(sanitizedText),
      rawText: wrapSecureBase64Message(rawTextOriginal),
      hasProfanity: hasProfanity,
      detectedProfanity: detectedList,
      isDevMessage: isDev,
      createdAt: nowIso,
      clientTempId: tempId,
    };

    // 2. Play sound immediately & optimistic render (0ms response)
    if (settings?.soundEnabled) playSendSound();
    setRecentMessages(prev => [...prev.filter(m => m.id !== tempId), optimisticPayload]);
    requestAnimationFrame(() => scrollToBottom(true));

    // 3. Send to Firestore in background
    try {
      const payload = cleanFirestoreObject({
        ...optimisticPayload,
        serverTimestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'rooms', activeRoomId, 'messages'), payload);
    } catch (err) {
      console.error('Send message error:', err);
      // Remove optimistic message if failed & restore text
      setRecentMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(rawTextOriginal);
    }
  };

  const handleSendMedia = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !currentUser) return;

    setIsUploading(true);
    setUploadPercent(10);

    try {
      const file = fileList[0];

      // 1. File Security inspection
      const secCheck = inspectFileSecurity(file);
      if (!secCheck.isSafe) {
        playShieldAlertSound();
        setModerationWarning(secCheck.error || `Tệp "${file.name}" không đáp ứng tiêu chuẩn an toàn.`);
        setTimeout(() => setModerationWarning(null), 6000);
        setIsUploading(false);
        return;
      }

      let fileUrl = '';
      let thumb: string | null = null;
      const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
      const isPublicRoom = activeRoomId === 'public-relay-lounge' || (activeRoom && activeRoom.isPrivate !== true);
      const fileIsImage = isImageFile(file);
      const fileIsVideo = isVideoFile(file);
      let imageAlreadyVerified = !isPublicRoom || !fileIsImage;
      let videoAlreadyVerified = !isPublicRoom || !fileIsVideo;

      const precheckPromise = (async () => {
        let localThumb: string | null = null;
        if (fileIsImage) {
          try {
            localThumb = await generateImageThumbnail(file, 480, 0.75);
            if (localThumb && isPublicRoom) {
              const imgMod = await moderateUploadedImage(localThumb, file.name);
              if (!imgMod.safe) {
                return { blocked: true, reason: imgMod.reason, localThumb, verified: false };
              }
              return { blocked: false, localThumb, verified: true };
            }
          } catch {}
        } else if (fileIsVideo && isPublicRoom) {
          try {
            const frames = await extractVideoModerationFrames(file, 4);
            if (frames.length > 0) {
              const vidMod = await moderateUploadedVideo(frames, file.name);
              if (!vidMod.safe) {
                return { blocked: true, reason: vidMod.reason, localThumb: null, verified: false };
              }
              return { blocked: false, localThumb: null, verified: true };
            }
          } catch {}
        }
        return { blocked: false, localThumb, verified: !isPublicRoom || (!fileIsImage && !fileIsVideo) };
      })();

      const uploadPromise = (async () => {
        try {
          const uploaded = await uploadFileToServer(file, (pct) => {
            setUploadPercent(pct);
          });
          return {
            url: (isGif || fileIsVideo) ? (uploaded.viewUrl || uploaded.url) : uploaded.url,
            thumb: !isGif ? uploaded.thumbnail : undefined,
            isFallback: false
          };
        } catch {
          const fallback = await createClientFallbackFileInfo(file);
          return {
            url: fallback.viewUrl || fallback.url,
            thumb: isGif ? (await fileToBase64(file).catch(() => fallback.thumbnail || null)) : (fallback.thumbnail || null),
            isFallback: true
          };
        }
      })();

      const [precheck, uploadedRes] = await Promise.all([precheckPromise, uploadPromise]);
      fileUrl = uploadedRes.url;
      thumb = uploadedRes.thumb || precheck.localThumb || null;

      if (precheck.blocked) {
        if (!uploadedRes.isFallback && fileUrl) deleteServerUploadedFile(fileUrl);
        playShieldAlertSound();
        setModerationWarning(
          precheck.reason ||
          (fileIsVideo
            ? `🚫 Cảnh báo: Video "${file.name}" chứa nội dung 18+/khiêu dâm nên đã bị xóa ngay lập tức!`
            : `🚫 Cảnh báo: Ảnh "${file.name}" chứa nội dung 18+/khiêu dâm nên đã bị xóa ngay lập tức!`)
        );
        setTimeout(() => setModerationWarning(null), 9000);
        setIsUploading(false);
        return;
      }

      if (fileIsImage) imageAlreadyVerified = precheck.verified;
      if (fileIsVideo) videoAlreadyVerified = precheck.verified;

      if (isPublicRoom && fileIsImage && !imageAlreadyVerified) {
        const imgMod = await moderateUploadedImage(thumb || fileUrl || '', file.name);
        if (!imgMod.safe) {
          deleteServerUploadedFile(fileUrl);
          playShieldAlertSound();
          setModerationWarning(imgMod.reason || `🚫 Cảnh báo: Ảnh "${file.name}" chứa nội dung 18+/khiêu dâm nên đã bị xóa ngay lập tức!`);
          setTimeout(() => setModerationWarning(null), 9000);
          setIsUploading(false);
          return;
        }
      } else if (isPublicRoom && fileIsVideo && !videoAlreadyVerified) {
        const vidMod = await moderateUploadedVideo([], file.name, fileUrl);
        if (!vidMod.safe) {
          deleteServerUploadedFile(fileUrl);
          playShieldAlertSound();
          setModerationWarning(vidMod.reason || `🚫 Cảnh báo: Video "${file.name}" chứa nội dung 18+/khiêu dâm nên đã bị xóa ngay lập tức!`);
          setTimeout(() => setModerationWarning(null), 9000);
          setIsUploading(false);
          return;
        }
      }

      // Never overwrite animated GIF URL with a static single-frame JPEG thumbnail
      const safeUrl = (fileUrl && fileUrl.length < 700000) ? fileUrl : '';
      let safeThumb = (thumb && thumb.length < 700000) ? thumb : '';
      if (isGif) {
        if (safeUrl) {
          safeThumb = '';
        } else if (file.size <= 600 * 1024) {
          const rawGif = await fileToBase64(file).catch(() => '');
          safeThumb = rawGif.length < 700000 ? rawGif : safeThumb;
        }
      }
      const isDev = isDevUser(currentUser.email);

      const payload = cleanFirestoreObject({
        roomId: activeRoomId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || settings?.deviceName || 'Người dùng di động',
        senderEmail: currentUser.email || '',
        senderDevice: settings?.deviceName || 'Điện thoại',
        senderAvatar: userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL || '',
        senderAvatarColor: userProfile?.avatarColor || settings?.avatarColor || '#10b981',
        text: fileIsImage ? (isGif ? 'Đã gửi một ảnh GIF' : 'Đã gửi một hình ảnh') : `Đã gửi tệp: ${file.name}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || (isGif ? 'image/gif' : 'application/octet-stream'),
        fileUrl: safeUrl,
        fileData: safeThumb,
        isDevMessage: isDev,
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'rooms', activeRoomId, 'messages'), payload);

      if (settings?.soundEnabled) playSendSound();
      scrollToBottom(true);
    } catch (err) {
      console.error('Send media error:', err);
    } finally {
      setIsUploading(false);
      setUploadPercent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Handle files chosen from Cloud Drive
  const handleCloudFilesSelected = async (chosen: CloudDriveFile[]) => {
    setIsCloudPickerOpen(false);
    if (!chosen.length || !currentUser) return;

    const isPublicRoom = activeRoomId === 'public-relay-lounge' || (activeRoom && activeRoom.isPrivate !== true);
    let sentAny = false;
    const blockedNames: string[] = [];

    for (const cf of chosen) {
      const isImg = isImageFile(cf);
      const isVid = isVideoFile(cf);
      if (isPublicRoom && isImg) {
        const imgMod = await moderateUploadedImage(cf.thumbnail || cf.viewUrl || cf.url || '', cf.name);
        if (!imgMod.safe) {
          blockedNames.push(cf.name);
          continue;
        }
      } else if (isPublicRoom && isVid) {
        const vidMod = await moderateUploadedVideo([], cf.name, cf.viewUrl || cf.url || '');
        if (!vidMod.safe) {
          blockedNames.push(cf.name);
          continue;
        }
      }

      const isDev = isDevUser(currentUser.email);

      const payload = cleanFirestoreObject({
        roomId: activeRoomId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || settings?.deviceName || 'Người dùng',
        senderEmail: currentUser.email || '',
        senderDevice: settings?.deviceName || 'Điện thoại',
        senderAvatar: userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL || '',
        senderAvatarColor: userProfile?.avatarColor || settings?.avatarColor || '#10b981',
        text: isImg ? pick('Đã chia sẻ một hình ảnh từ Kho Cloud', 'Shared an image from Cloud Drive', '从云盘分享了一张图片') : pick(`Đã chia sẻ tệp từ Kho Cloud: ${cf.name}`, `Shared file from Cloud: ${cf.name}`, `从云盘分享了文件：${cf.name}`),
        fileName: cf.name,
        fileSize: cf.size,
        fileType: cf.type || 'application/octet-stream',
        fileUrl: cf.viewUrl || cf.url,
        fileData: cf.thumbnail || '',
        isDevMessage: isDev,
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'rooms', activeRoomId, 'messages'), payload);
      sentAny = true;
    }

    if (blockedNames.length > 0) {
      playShieldAlertSound();
      setModerationWarning(`🚫 Cảnh báo: AI đã phát hiện và xóa ngay ${blockedNames.length} ảnh/video 18+/khiêu dâm ("${blockedNames.join(', ')}") khỏi Đại Sảnh Toàn Cầu!`);
      setTimeout(() => setModerationWarning(null), 9000);
    }

    if (sentAny) {
      if (settings?.soundEnabled) playSendSound();
      scrollToBottom(true);
    }
  };

  // Clipboard Paste Support on Mobile (Images and Text)
  const handlePasteEvent = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      imageFiles.forEach(f => dt.items.add(f));
      handleSendMedia(dt.files);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const ext = type.split('/')[1] || 'png';
              const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type });
              const dt = new DataTransfer();
              dt.items.add(file);
              handleSendMedia(dt.files);
              return;
            }
          }
        }
      }
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputText(prev => prev ? `${prev} ${text}` : text);
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setRecentMessages(prev => prev.filter(m => m.id !== msgId));
    setOlderMessages(prev => prev.filter(m => m.id !== msgId));
    removeCachedRoomMessage(activeRoomId, msgId);

    try {
      await deleteDoc(doc(db, 'rooms', activeRoomId, 'messages', msgId));
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newRoomName.trim()) return;

    const isPrivate = true;
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomId = `room-${Date.now()}`;

    const isCreatorDev = isDevUser(currentUser.email);
    const creatorMember: RoomMember = {
      uid: currentUser.uid,
      displayName: userProfile?.displayName || currentUser.displayName || 'Trưởng phòng',
      deviceName: settings.deviceName,
      avatarColor: settings.avatarColor || '#10b981',
      role: 'owner',
      joinedAt: new Date().toISOString(),
      email: currentUser.email || '',
      isDev: isCreatorDev
    };

    try {
      const roomPayload: ChatRoom = {
        id: roomId,
        name: newRoomName.trim(),
        code: randomCode,
        isPrivate: isPrivate,
        createdBy: currentUser.uid,
        createdByName: userProfile?.displayName || 'Người dùng',
        ownerId: currentUser.uid,
        ownerName: userProfile?.displayName || currentUser.displayName || 'Trưởng phòng',
        avatar: newRoomAvatar || '',
        avatarColor: newRoomColor || '#10b981',
        createdAt: new Date().toISOString(),
        description: isPrivate 
          ? 'Phòng riêng tư (Nhập mã ID để vào)' 
          : 'Phòng cộng đồng (Tự do tham gia)',
        members: [creatorMember],
        membersCount: 1
      };

      await setDoc(doc(db, 'rooms', roomId), cleanFirestoreObject(roomPayload));
      setActiveRoomId(roomId);
      setViewMode('chat_feed');
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomAvatar('');
      setNewRoomColor('#10b981');
    } catch (err) {
      console.error('Create room error:', err);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const code = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) return;

    let found = rooms.find(r => r.code?.toUpperCase() === code || r.id === code);

    if (!found) {
      try {
        const qCode = query(collection(db, 'rooms'), where('code', '==', code));
        const snap = await getDocs(qCode);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          found = { id: docSnap.id, ...docSnap.data() } as ChatRoom;
        }
      } catch (e) {
        console.warn('Room code direct query error:', e);
      }
    }

    if (found) {
      const existingMembers = found.members || [];
      const isAlreadyMember = existingMembers.some(m => m.uid === currentUser?.uid);

      if (!isAlreadyMember && currentUser) {
        const isDev = isDevUser(currentUser.email);
        const newMember: RoomMember = {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName || 'Thành viên',
          deviceName: settings.deviceName,
          avatarColor: settings.avatarColor || '#3b82f6',
          role: 'member',
          joinedAt: new Date().toISOString(),
          email: currentUser.email || '',
          isDev: isDev
        };

        try {
          await updateDoc(doc(db, 'rooms', found.id), {
            members: [...existingMembers, newMember],
            membersCount: existingMembers.length + 1
          });
        } catch (err) {
          console.warn('Update room members error:', err);
        }
      }

      setActiveRoomId(found.id);
      setViewMode('chat_feed');
      setShowJoinModal(false);
      setJoinCodeInput('');
    } else {
      setJoinError('Không tìm thấy phòng với mã ID này. Vui lòng kiểm tra lại!');
    }
  };

  const handleScroll = () => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = messagesContainerRef.current;
      if (!el) return;

      const now = Date.now();
      if (
        el.scrollTop <= 160 &&
        hasMoreOlder &&
        !isFetchingOlderRef.current &&
        now - lastLoadOlderRef.current > 350
      ) {
        lastLoadOlderRef.current = now;
        handleLoadOlderMessages();
      }

      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceToBottom < 140;
      isNearBottomRef.current = nearBottom;
      if (nearBottom) {
        setUnreadNewCount(0);
      }

      const isFarFromBottom = distanceToBottom > 280;
      if (showScrollBottomRef.current !== isFarFromBottom) {
        showScrollBottomRef.current = isFarFromBottom;
        setShowScrollBottom(isFarFromBottom);
      }
    });
  };

  const visibleRooms = rooms.filter(room => {
    if (room.id === 'public-relay-lounge' || room.isPrivate === false) return true;
    if (!currentUser) return false;
    const isOwner = room.ownerId === currentUser.uid || room.createdBy === currentUser.uid;
    const isMember = (room.members || []).some(m => m.uid === currentUser.uid);
    const isDev = isDevUser(currentUser.email);
    return isOwner || isMember || isDev;
  }).filter(r => {
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q);
  });

  // ================= VIEW 1: ROOMS LIST / BROWSER =================
  if (viewMode === 'rooms_list') {
    return (
      <div className="flex flex-col h-full w-full bg-[#0b0f19] overflow-hidden">
        {/* Top Header of Room List - Compact single horizontal row */}
        <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            <MessagesSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate whitespace-nowrap">
              Phòng Chat Trực Tuyến
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
              title={pick("Nhập mã phòng", "Enter Room Code", "输入房间代码")}
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{pick("Nhập mã", "Join Code", "输入代码")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              title={pick("Tạo phòng mới", "Create Room", "创建房间")}
            >
              <Plus className="w-3 h-3" />
              <span>{pick("Tạo phòng", "Create Room", "创建房间")}</span>
            </button>
          </div>
        </div>

        {/* Search Bar - Slim & Compact */}
        <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={roomSearchQuery}
              onChange={(e) => setRoomSearchQuery(e.target.value)}
              placeholder={pick("Tìm kiếm phòng chat theo tên hoặc mã ID...", "Search chat rooms by name or ID code...", "按名称或 ID 代码搜索聊天室...")}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Rooms Scroll List - Compact cards with full readable text */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
          {visibleRooms.map((room) => {
            const isSelected = room.id === activeRoomId;
            const isOwner = currentUser && (room.ownerId === currentUser.uid || room.createdBy === currentUser.uid);

            return (
              <div
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id);
                  setViewMode('chat_feed');
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.99] ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/70'
                }`}
              >
                {/* Room Avatar */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 border border-white/10 overflow-hidden relative"
                  style={{ backgroundColor: room.avatarColor || '#10b981' }}
                >
                  {room.avatar ? (
                    <img src={room.avatar} alt="Room" className="w-full h-full object-cover" />
                  ) : room.id === 'public-relay-lounge' ? (
                    <Globe className="w-3.5 h-3.5 text-emerald-200" />
                  ) : (
                    <span>{(room.name || 'R').charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Room Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  {/* Line 1: Room Name + Privacy Badge */}
                  <div className="flex items-center justify-between gap-1.5">
                    <h3 className="text-xs font-bold text-white truncate" title={room.name}>
                      {room.name}
                    </h3>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0 ${
                      room.isPrivate !== false 
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {room.isPrivate !== false ? <Lock className="w-2 h-2" /> : <Globe className="w-2 h-2" />}
                      {room.isPrivate !== false ? 'Riêng tư' : 'Công cộng'}
                    </span>
                  </div>

                  {/* Line 2: Full continuous description */}
                  <p className="text-[10.5px] text-slate-400 truncate leading-tight">
                    {room.description || (room.id === 'public-relay-lounge' ? 'Sảnh trò chuyện công khai toàn cầu' : 'Phòng chat kết nối trực tuyến')}
                  </p>

                  {/* Line 3: Meta details */}
                  <div className="flex items-center gap-2 text-[9.5px] text-slate-500">
                    <span className="flex items-center gap-0.5 whitespace-nowrap">
                      <Users className="w-2.5 h-2.5" />
                      {room.members?.length || room.membersCount || 1} thành viên
                    </span>
                    {room.code && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-emerald-400/90 font-medium whitespace-nowrap">
                          ID: {room.code}
                        </span>
                      </>
                    )}
                    {isOwner && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400 flex items-center gap-0.5 font-semibold whitespace-nowrap">
                          <Crown className="w-2.5 h-2.5" /> Trưởng phòng
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Tạo phòng mới */}
        {/* Modal Tạo phòng mới */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessagesSquare className="w-5 h-5 text-emerald-400" />
                  {pick('Tạo phòng chat mới', 'Create new chat room', '创建新聊天室')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                {/* Avatar Preview */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0 border border-white/10 overflow-hidden"
                    style={{ backgroundColor: newRoomColor }}
                  >
                    {newRoomAvatar ? (
                      <img src={newRoomAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(newRoomName.trim() || 'R').charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 inline-flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      {pick('Tải ảnh đại diện', 'Upload photo', '上传头像')}
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={avatarInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setNewRoomAvatar(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }} 
                        className="hidden" 
                      />
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{pick('Màu nền:', 'Background:', '背景色：')}</span>
                      {ROOM_PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewRoomColor(col)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newRoomColor === col ? 'scale-125 ring-2 ring-white' : ''
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    {pick('Tên phòng', 'ROW 1: ROOM NAME', '房间名称')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder={pick('Nhập tên phòng...', 'e.g. Project Team, Best Friends...', '例如：项目组、好友群...')}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>{pick('Phòng Riêng Tư Bảo Mật', 'Private Secure Room (Private Room)', '私密安全房间')}</span>
                        <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[10px] rounded border border-purple-500/30">{pick('Mặc định', 'Default', '默认')}</span>
                      </p>
                      <p className="text-[11px] text-purple-300/80 mt-0.5 leading-snug">
                        {pick('Tự động tạo mã truy cập 6 ký tự. Chỉ thành viên có mã mới vào được phòng.', 'The system will generate a unique 6-digit access code. Others can only join when you share this code.', '系统将自动生成 6 位访问代码，仅持有该代码的成员方可加入。')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-md"
                >
                  {pick('Tạo phòng ngay', 'Create room now', '立即创建房间')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Nhập mã phòng */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  {pick('Nhập mã ID phòng', 'Enter Room ID Code', '输入房间 ID 代码')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder={pick('Nhập mã 6 ký tự (VD: ABCD12)...', 'Enter 6-character code (e.g. ABCD12)...', '输入 6 位代码（如 ABCD12）...')}
                    className="w-full px-3.5 py-3 text-center font-mono uppercase tracking-widest text-base font-bold bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                  {joinError && (
                    <p className="text-xs text-rose-400 mt-1.5 font-medium">{joinError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-md"
                >
                  {pick('Tham gia phòng', 'Join Room', '加入房间')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= VIEW 2: ACTIVE ROOM CHAT FEED =================
  return (
    <div className="flex flex-col h-full w-full bg-[#0b0f19] overflow-hidden relative">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleSendMedia(e.target.files)}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={(e) => handleSendMedia(e.target.files)}
        className="hidden"
      />

      {/* Modern Room Header Bar with Back Button, Avatar, Title, and (i) Info Button */}
      <div className="px-2 py-1 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-sm z-20">
        {/* Left: Back to Rooms List button */}
        <button
          type="button"
          onClick={() => setViewMode('rooms_list')}
          className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold shrink-0 border border-slate-700/60 active:scale-95 transition-all mr-1.5"
          title="Chọn phòng khác"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xs:inline">Phòng</span>
        </button>

        {/* Center: Room Avatar + Title + Status */}
        <div 
          className="flex-1 min-w-0 flex items-center gap-1.5 cursor-pointer"
          onClick={() => setShowRoomDetails(true)}
        >
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 border border-white/10 overflow-hidden"
            style={{ backgroundColor: activeRoom.avatarColor || '#10b981' }}
          >
            {activeRoom.avatar ? (
              <img src={activeRoom.avatar} alt="Room" className="w-full h-full object-cover" />
            ) : activeRoom.id === 'public-relay-lounge' ? (
              <Globe className="w-3.5 h-3.5 text-emerald-200" />
            ) : (
              <span>{(activeRoom.name || 'R').charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-xs font-bold text-white truncate flex items-center gap-1 leading-tight">
              <span>{activeRoom.name}</span>
              {activeRoom.isPrivate !== false && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
            </h2>
            <p className="text-[9px] text-slate-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>{activeRoom.members?.length || activeRoom.membersCount || 1} thành viên</span>
              <span>•</span>
              <span className="font-mono text-emerald-400/90">{messages.length} tin</span>
            </p>
          </div>
        </div>

        {/* Right: Info (i) button & DEV Reset button */}
        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {isDevUser(currentUser?.email) && (
            <button
              type="button"
              onClick={() => setShowResetServerModal(true)}
              className="w-7 h-7 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center justify-center shrink-0 active:scale-95 transition-all"
              title="Quyền DEV: Reset máy chủ trò chuyện để chống lag"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRoomDetails(true)}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 flex items-center justify-center shrink-0 border border-slate-700/60 active:scale-95 transition-all"
            title="Xem thông tin và cấu trúc phòng"
          >
            <Info className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area - Clean inner scroll without outer scrollbar */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5 overscroll-contain"
      >
        {(() => {
          const visibleMessages = messages.filter(m => !m.deletedBySender && !m.isDeletedBySender);

          return (
            <>
              {/* Discord / Zalo / Messenger smooth history status bar */}
              {isLoadingOlder ? (
                <div className="py-2 flex items-center justify-center text-xs text-slate-400 gap-2 select-none">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>{t('chat.loading_older')}</span>
                </div>
              ) : hasMoreOlder ? (
                <div className="py-1.5 flex items-center justify-center select-none">
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    className="px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 text-[10px] font-medium text-slate-300 hover:text-emerald-300 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <History className="w-3 h-3 text-emerald-400" />
                    <span>{t('chat.load_older_10')}</span>
                  </button>
                </div>
              ) : visibleMessages.length > 0 ? (
                <div className="py-2 text-center text-[10px] text-slate-500 font-medium select-none border-b border-slate-800/60 mb-2 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{t('chat.reached_beginning')}</span>
                </div>
              ) : null}

              {/* Shimmer Skeleton on Uncached Room Initial Fetch */}
              {isInitialLoadingMessages && visibleMessages.length === 0 ? (
                <div className="py-3 space-y-3 animate-pulse">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className={`flex flex-col ${row % 2 === 1 ? 'items-end' : 'items-start'} gap-1`}>
                      <div className="h-2.5 w-20 rounded bg-slate-800" />
                      <div className={`h-8 rounded-xl bg-slate-800/70 ${row % 2 === 0 ? 'w-52' : 'w-40'}`} />
                    </div>
                  ))}
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-500">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center shadow-inner">
                    <MessagesSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300">{t('chat.empty')}</p>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-0.5">
                      {pick('Gửi tin nhắn hoặc đính kèm ảnh bên dưới để bắt đầu!', 'Send a message or attach a file below!', '在下方发送消息或附加文件即可开始！')}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Messages with Group Date Dividers */}
              {visibleMessages.map((msg, index) => {
                const isMe = msg.senderId === currentUser?.uid;
                const isDevMsg = !!(msg.isDevMessage || isDevUser(msg.senderEmail) || (msg.senderName && msg.senderName.includes('DEV')));
                const senderLiveName = isMe 
                  ? (userProfile?.displayName || currentUser?.displayName || settings?.deviceName || 'Bạn')
                  : (memberNamesMap[msg.senderId] || memberNamesMap[msg.senderDevice] || msg.senderName);

                const rawAttachments: Array<{ name?: string; size?: number; type?: string; data?: string; url?: string }> =
                  Array.isArray((msg as any).attachments) && (msg as any).attachments.length > 0
                    ? (msg as any).attachments
                    : (msg.fileUrl || msg.fileData || msg.fileName)
                    ? [{ name: msg.fileName, size: msg.fileSize, type: msg.fileType, data: msg.fileData, url: msg.fileUrl }]
                    : [];

                const normalizedMedia = rawAttachments.map((att, attIdx) => {
                  const attName = att.name || msg.fileName || 'file';
                  const attType = att.type || msg.fileType || '';
                  const attUrl = att.url || '';
                  const attData = att.data || '';
                  const attSize = att.size ?? msg.fileSize;
                  const attIsGif = isGifFile(attName || attUrl, attType);
                  const attIsVideo = Boolean(
                    (attData && attData.startsWith('data:video')) ||
                    (attType && attType.startsWith('video/')) ||
                    (attName && attName.match(/\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv|ts|ogv)$/i))
                  );
                  const attIsImage = !attIsVideo && Boolean(
                    attIsGif ||
                    (attData && attData.startsWith('data:image')) ||
                    (attType && attType.startsWith('image/')) ||
                    (attName && attName.match(/\.(jpg|jpeg|png|webp|gif|heic|heif|avif)$/i))
                  );
                  const rawFileViewUrl = attUrl
                    ? (attUrl.includes('/api/telegram/download')
                        ? (attUrl.includes('inline=true') ? attUrl : `${attUrl}${attUrl.includes('?') ? '&' : '?'}inline=true`)
                        : attUrl.replace('/api/files/download/', '/api/files/view/'))
                    : '';
                  const imgSrc = attIsImage
                    ? (attIsGif
                        ? (rawFileViewUrl || attUrl || (attData?.startsWith('data:image/gif') ? attData : '') || attData || '')
                        : (attData || rawFileViewUrl || attUrl || ''))
                    : '';
                  const videoPoster = attData && attData.startsWith('data:image/') ? attData : undefined;
                  const videoSrc = attIsVideo
                    ? (rawFileViewUrl ||
                       (attUrl && !attUrl.startsWith('data:image/') ? attUrl : '') ||
                       (attData && attData.startsWith('data:video/') ? attData : ''))
                    : '';
                  const mediaDownloadUrl = attUrl
                    ? attUrl.replace('/api/files/view/', '/api/files/download/').replace(/[?&]inline=true/g, '')
                    : (videoSrc || imgSrc || '');
                  return {
                    key: `${msg.id || index}_att_${attIdx}`,
                    name: attName,
                    size: attSize,
                    isGif: attIsGif,
                    isImage: attIsImage,
                    isVideo: attIsVideo,
                    rawFileViewUrl,
                    imgSrc,
                    videoPoster,
                    videoSrc,
                    mediaDownloadUrl,
                    rawUrl: attUrl || attData || ''
                  };
                });

                const canDelete = isMe || activeRoom?.ownerId === currentUser?.uid || activeRoom?.createdBy === currentUser?.uid || isDevUser(currentUser?.email);

                // Date separator logic
                const currentDateKey = getGroupDateKey(msg.createdAt);
                const prevDateKey = index > 0 ? getGroupDateKey(visibleMessages[index - 1].createdAt) : null;
                const showDateHeader = index === 0 || currentDateKey !== prevDateKey;

                return (
                  <React.Fragment key={msg.id || `m_${index}`}>
                    {/* Group Date Timeline Divider */}
                    {showDateHeader && (
                      <div className="flex items-center justify-center my-2 select-none">
                        <div className="px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-[10px] font-semibold text-slate-300 shadow-sm flex items-center gap-1 backdrop-blur-sm">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          <span>{formatGroupDateHeader(msg.createdAt)}</span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[88%] ${isMe ? 'ml-auto' : 'mr-auto'}`}
                    >
                      {/* Sender Header with Avatar on top of chat frame like Discord & Zalo */}
                      {(() => {
                        const senderMeta = memberMetaMap[msg.senderId] || memberMetaMap[msg.senderDevice];
                        const effectiveAvatarUrl = msg.senderAvatar || (isMe ? (userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL) : senderMeta?.avatarUrl);
                        const effectiveAvatarColor = msg.senderAvatarColor || (isMe ? (userProfile?.avatarColor || settings?.avatarColor || '#10b981') : (senderMeta?.avatarColor || '#10b981'));
                        const initialChar = (senderLiveName.trim().charAt(0) || 'U').toUpperCase();

                        return (
                          <div className={`flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 flex-wrap ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar on top of chat frame */}
                            <div 
                              className="relative shrink-0 select-none cursor-pointer active:scale-95 transition-transform"
                              onClick={() => {
                                setSelectedProfileUser({
                                  uid: msg.senderId,
                                  displayName: senderLiveName,
                                  photoURL: effectiveAvatarUrl,
                                  avatarColor: effectiveAvatarColor,
                                  deviceName: msg.senderDevice,
                                });
                              }}
                            >
                              {effectiveAvatarUrl ? (
                                <img
                                  src={effectiveAvatarUrl}
                                  alt={senderLiveName}
                                  className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-700/80 shadow-xs"
                                />
                              ) : (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shadow-xs ring-1 ring-white/10"
                                  style={{ backgroundColor: effectiveAvatarColor }}
                                >
                                  {initialChar}
                                </div>
                              )}
                              {isDevMsg ? (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-xs ring-1 ring-slate-900">
                                  <Crown className="w-1.5 h-1.5 text-slate-950 fill-slate-950" />
                                </span>
                              ) : (isMe || senderMeta?.isOnline) ? (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-slate-900 shadow-xs" title="Đang online (Thời gian sống 3p)" />
                              ) : null}
                            </div>

                            {isDevMsg ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-extrabold text-[11px] bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent truncate max-w-[120px]">
                                  {senderLiveName}
                                </span>
                                <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs inline-flex items-center gap-0.5 shrink-0">
                                  👑 DEV
                                </span>
                              </div>
                            ) : (
                              <span className={`font-semibold truncate max-w-[120px] ${isMe ? 'text-slate-300' : 'text-emerald-400'}`}>
                                {isMe ? 'Bạn' : senderLiveName}
                              </span>
                            )}

                            <span className="text-slate-500 text-[9px]">• {msg.senderDevice || 'Điện thoại'}</span>
                            <span className="text-slate-500 font-mono text-[9px]">
                              • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Message Bubble */}
                      <div
                        className={`px-2.5 py-1.5 rounded-xl shadow-sm text-xs relative group break-words space-y-1 ${
                          isDevMsg
                            ? 'bg-gradient-to-r from-emerald-950/95 via-slate-900 to-amber-950/70 border border-amber-400/80 shadow-md shadow-amber-500/10 ring-1 ring-emerald-500/40 text-white rounded-br-xl'
                            : isMe
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none'
                            : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-none'
                        }`}
                      >
                        {/* DEV Banner inside bubble */}
                        {isDevMsg && (
                          <div className="flex items-center gap-1 pb-0.5 border-b border-amber-500/30 text-[8.5px] text-amber-300 font-bold">
                            <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                            <span>DEV Chính Chủ</span>
                          </div>
                        )}

                        {/* Render all normalized attachments (Images, Videos, Documents) */}
                        {normalizedMedia.map((media, mediaIdx) => {
                          const senderMeta = memberMetaMap[msg.senderId] || memberMetaMap[msg.senderDevice];
                          const effectiveSenderAvatar = msg.senderAvatar || (isMe ? (userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL) : senderMeta?.avatarUrl);
                          if (media.isImage && media.imgSrc) {
                            const viewerImgUrl = media.rawFileViewUrl || media.imgSrc;
                            return (
                              <div
                                key={media.key}
                                onClick={() => {
                                  if (!viewerImgUrl) return;
                                  openMediaInLargeViewer({
                                    source: 'chat',
                                    roomId: activeRoomId,
                                    roomMedia: roomMediaGallery.unifiedMedia,
                                    activeItem: {
                                      id: `${msg.id}_i_${mediaIdx}`,
                                      name: media.name || 'Hình ảnh',
                                      title: media.name || 'Hình ảnh',
                                      src: viewerImgUrl,
                                      downloadUrl: media.mediaDownloadUrl || media.rawUrl,
                                      thumbnail: media.imgSrc || null,
                                      size: media.size,
                                      type: 'image',
                                      mimeType: media.isGif ? 'image/gif' : 'image/jpeg',
                                      isGif: media.isGif,
                                      senderName: isMe ? 'Bạn' : senderLiveName,
                                      senderAvatar: effectiveSenderAvatar || null,
                                      createdAt: msg.createdAt,
                                      roomId: activeRoomId,
                                    },
                                  });
                                }}
                                className="rounded-xl overflow-hidden mb-1.5 border border-black/20 relative group/img cursor-pointer"
                              >
                                <ChatMediaImage
                                  src={media.imgSrc}
                                  backupSrc={media.rawUrl && media.rawUrl !== media.imgSrc ? media.rawUrl : undefined}
                                  alt={media.name || 'Attached photo'}
                                  isGif={media.isGif}
                                  minHeightClass="min-h-[120px] min-w-[160px]"
                                  className="w-full max-h-64 object-cover active:opacity-90"
                                  onDownload={(e) => {
                                    e.stopPropagation();
                                    downloadFileSafely(media.mediaDownloadUrl || media.rawUrl, media.name || 'image');
                                  }}
                                />
                                {media.isGif && (
                                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-emerald-300 border border-emerald-500/40 pointer-events-none z-10">
                                    GIF
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity pointer-events-none z-10">
                                  <span className="px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-semibold flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> Xem lớn
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          if (media.isVideo && media.videoSrc) {
                            return (
                              <div key={media.key} className="mb-1.5">
                                <ChatInlineVideoPlayer
                                  src={media.videoSrc}
                                  downloadUrl={media.mediaDownloadUrl}
                                  poster={media.videoPoster}
                                  fileName={media.name || 'Video'}
                                  fileSize={media.size}
                                  messageId={`${msg.id}_${mediaIdx}`}
                                  compact={true}
                                  onOpenFullPlayer={() => {
                                    openMediaInLargeViewer({
                                      source: 'chat',
                                      roomId: activeRoomId,
                                      roomMedia: roomMediaGallery.unifiedMedia,
                                      activeItem: {
                                        id: `${msg.id}_v_${mediaIdx}`,
                                        name: media.name || 'Video',
                                        title: media.name || 'Video',
                                        src: media.videoSrc,
                                        downloadUrl: media.mediaDownloadUrl,
                                        thumbnail: media.videoPoster || null,
                                        size: media.size,
                                        type: 'video',
                                        mimeType: 'video/mp4',
                                        senderName: isMe ? 'Bạn' : senderLiveName,
                                        senderAvatar: effectiveSenderAvatar || null,
                                        createdAt: msg.createdAt,
                                        roomId: activeRoomId,
                                      },
                                    });
                                  }}
                                />
                              </div>
                            );
                          }
                          if (media.name && !media.isImage && !media.isVideo) {
                            return (
                              <div key={media.key} className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between gap-2 mb-1">
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{media.name}</p>
                                  <p className="text-[10px] opacity-75">{formatFileSize(media.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => downloadFileSafely(media.mediaDownloadUrl || media.rawUrl, media.name || 'file')}
                                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })}

                        {/* Text Content with full highlight & bôi đen support */}
                        {msg.text && (
                          <div 
                            className="whitespace-pre-wrap leading-relaxed chat-message-text select-text cursor-text [user-select:text] selection:bg-emerald-500 selection:text-slate-950"
                            data-chat-message="true"
                          >
                            {renderClickableText(
                              (activeRoomId === 'public-relay-lounge' || (activeRoom && activeRoom.isPrivate !== true))
                                ? censorProfanity(unwrapSecureBase64Message(msg.text)).cleanText
                                : unwrapSecureBase64Message(msg.text)
                            )}
                          </div>
                        )}

                        {/* Message Meta: Time & Actions */}
                        <div className="flex items-center justify-end gap-2 text-[9px] opacity-75 pt-0.5">
                          <span className="font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* 1-Tap Copy Message Button */}
                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => {
                                const textToCopy = unwrapSecureBase64Message(msg.text || '');
                                if (textToCopy) {
                                  navigator.clipboard.writeText(textToCopy);
                                  setCopiedMsgId(msg.id);
                                  setTimeout(() => setCopiedMsgId(null), 2000);
                                }
                              }}
                              className="opacity-70 hover:opacity-100 text-slate-300 hover:text-emerald-300 transition-opacity p-0.5 flex items-center gap-0.5 cursor-pointer"
                              title="Sao chép nội dung tin nhắn"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}

                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-70 hover:opacity-100 text-rose-300 hover:text-white transition-opacity p-0.5 flex items-center gap-0.5"
                              title={isDevUser(currentUser?.email) && !isMe ? "Quyền DEV: Tiêu hủy tin nhắn vi phạm" : "Xóa tin nhắn"}
                            >
                              <Trash2 className="w-3 h-3" />
                              {isDevUser(currentUser?.email) && !isMe && (
                                <span className="text-[8px] font-mono text-amber-300 font-bold">DEV</span>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReportTarget(msg)}
                              className="opacity-60 hover:opacity-100 text-slate-400 hover:text-amber-300 transition-opacity p-0.5"
                              title="Báo cáo"
                            >
                              <Flag className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          );
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom / New Message Pill */}
      {(showScrollBottom || unreadNewCount > 0) && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute right-4 bottom-16 px-2.5 py-2 rounded-full bg-emerald-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xl active:scale-95 transition-all z-30 cursor-pointer"
        >
          <ArrowDown className="w-4 h-4" />
          {unreadNewCount > 0 && <span>{unreadNewCount}</span>}
        </button>
      )}

      {/* Uploading indicator */}
      {isUploading && (
        <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-emerald-400">
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang tải ảnh/tệp đính kèm...
          </span>
          <span className="font-mono">{uploadPercent || 10}%</span>
        </div>
      )}

      {/* DEV Identity Badge Bar above input on Mobile - Slim & Compact with Server Reset Button */}
      {isDevUser(currentUser?.email) && (
        <div className="flex items-center justify-between gap-1 px-2.5 py-0.5 text-[8.5px] text-amber-300/90 bg-amber-500/10 border-t border-amber-500/20 shrink-0">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-slate-400 font-sans">Gửi tin tư cách:</span>
            <span className="font-bold text-amber-200 truncate">
              {(userProfile?.displayName || currentUser?.displayName || settings?.deviceName || 'Admin').trim()} (DEV)
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowResetServerModal(true)}
              className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[7.5px] font-bold flex items-center gap-0.5 transition-all active:scale-95"
              title="Quyền DEV: Reset máy chủ trò chuyện để dọn dẹp tin nhắn và chống lag"
            >
              <Zap className="w-2 h-2 text-rose-400 fill-rose-400" />
              <span>Reset Server</span>
            </button>
            <span className="text-[7.5px] font-mono font-bold px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              👑 DEV
            </span>
          </div>
        </div>
      )}

      {/* Moderation Warning Toast/Banner */}
      {moderationWarning && (() => {
        const isSevereBlock = moderationWarning.includes('🚫') || moderationWarning.includes('18+') || moderationWarning.includes('khiêu dâm');
        return (
          <div className={`mx-2 mb-1 p-2 rounded-xl text-[11px] flex items-center justify-between gap-2 shadow-xl animate-in fade-in duration-150 z-20 ${
            isSevereBlock
              ? 'bg-rose-950/95 border border-rose-500/80 text-rose-100'
              : 'bg-[#020712] border border-[#1e3a5f] text-cyan-300 italic'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              {isSevereBlock ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-300 shrink-0 animate-pulse" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              )}
              <span className={`font-sans leading-snug break-words ${isSevereBlock ? 'text-rose-100 font-medium' : 'italic text-cyan-300'}`}>
                {moderationWarning}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModerationWarning(null)}
              className={`p-1 rounded shrink-0 ${isSevereBlock ? 'text-rose-300 hover:text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })()}

      {/* Sticky Bottom Input Bar - Ultra-compact */}
      <div
        className="p-1.5 bg-slate-900/95 border-t border-slate-800 flex items-center gap-1.5 shrink-0 z-20"
        style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom, 4px))' }}
      >
        {/* Camera Quick Button */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0"
          title="Chụp ảnh gửi ngay"
        >
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        {/* Gallery / File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0"
          title={pick("Chọn tệp đính kèm từ thiết bị", "Attach file from device", "从设备添加附件")}
        >
          <Paperclip className="w-3.5 h-3.5 text-sky-400" />
        </button>

        {/* Cloud Drive Button */}
        <button
          type="button"
          onClick={() => setIsCloudPickerOpen(true)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0 cursor-pointer"
          title={pick("Chọn tệp từ Kho Cloud", "Select files from Cloud Drive", "从云盘选择文件")}
        >
          <Cloud className="w-3.5 h-3.5 text-indigo-400" />
        </button>

        {/* Clipboard Image Paste Button */}
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0"
          title={pick("Dán ảnh hoặc văn bản từ bộ nhớ tạm (Clipboard)", "Paste image or text from clipboard", "从剪贴板粘贴图片或文本")}
        >
          <Clipboard className="w-3.5 h-3.5 text-amber-400" />
        </button>

        {/* Text Input Field */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onPaste={handlePasteEvent}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if ((e.nativeEvent as any).isComposing) return;
              e.preventDefault();
              handleSendMessage(e.currentTarget.value);
            }
          }}
          placeholder={t('chat.placeholder')}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />

        {/* Send Button (INP Optimized < 16ms) */}
        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shrink-0 shadow-sm cursor-pointer"
          style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Room Details & Management Modal ("i" button) */}
      {showRoomDetails && activeRoom && (
        <RoomDetailsModal
          isOpen={showRoomDetails}
          onClose={() => setShowRoomDetails(false)}
          room={activeRoom}
          currentUserUid={currentUser?.uid || ''}
          currentUserEmail={currentUser?.email || ''}
          currentUserName={userProfile?.displayName || currentUser?.displayName || 'Người dùng'}
          currentDeviceName={settings.deviceName}
          messages={messages}
          onRoomDeleted={() => {
            setActiveRoomId('public-relay-lounge');
            setViewMode('rooms_list');
          }}
          onRoomLeft={() => {
            setActiveRoomId('public-relay-lounge');
            setViewMode('rooms_list');
          }}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportMessageModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          message={reportTarget}
          roomId={activeRoomId}
          roomName={activeRoom.name}
          currentUserId={currentUser?.uid || ''}
          currentUserName={userProfile?.displayName || settings?.deviceName || 'Người dùng'}
        />
      )}

      {/* Zoomable Image Lightbox Modal */}
      {viewingZoomImage && (
        <ZoomableImageViewerModal
          isOpen={Boolean(viewingZoomImage)}
          onClose={() => setViewingZoomImage(null)}
          imageUrl={viewingZoomImage.url}
          imageName={viewingZoomImage.name || 'Hình ảnh'}
          fileSize={viewingZoomImage.size}
        />
      )}

      {/* DEV Server Reset Modal */}
      <ResetServerModal
        isOpen={showResetServerModal}
        onClose={() => setShowResetServerModal(false)}
        roomId={activeRoomId}
        roomName={activeRoom.name}
        totalMessagesCount={messages.length}
        isAutoWeeklyEnabled={Boolean((activeRoom as any)?.autoWeeklyReset)}
      />

      {/* Cloud Drive Picker Modal */}
      <CloudDrivePickerModal
        isOpen={isCloudPickerOpen}
        onClose={() => setIsCloudPickerOpen(false)}
        onSelectFiles={handleCloudFilesSelected}
      />
    </div>
  );
};
