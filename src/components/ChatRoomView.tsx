import { UserProfileModal } from './UserProfileModal';
import React, { useState, useEffect, useRef, startTransition } from 'react';
import { yieldToMain } from '../utils/scheduler';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs, 
  where, 
  limit, 
  serverTimestamp, 
  deleteDoc,
  writeBatch 
} from 'firebase/firestore';
import { ChatRoom, ChatMessage, ChatAttachment, RoomMember } from './types';
import { 
  MessagesSquare, 
  Plus, 
  Hash, 
  Send, 
  Paperclip, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Copy, 
  Check, 
  Users, 
  Laptop, 
  Smartphone, 
  Share2, 
  X, 
  Sparkles, 
  ArrowRight, 
  ChevronLeft, 
  Info, 
  Lock, 
  Globe, 
  Crown, 
  AlertTriangle, 
  ChevronDown, 
  Flame, 
  Clock, 
  ShieldAlert, 
  Trash2,
  Camera,
  Scale,
  Flag,
  Bold,
  Italic,
  Code,
  Wand2,
  Calendar,
  Zap,
  Loader2,
  History,
  Film,
  Cloud
} from 'lucide-react';
import { formatFileSize } from '../utils/device';
import { playSendSound, playReceiveSound, playDestructSound, playShieldAlertSound } from '../utils/sound';
import { censorProfanity, moderateUploadedImage } from '../utils/moderation';
import { inspectFileSecurity } from '../utils/fileSecurity';
import { checkContentWithAI } from '../utils/aiModeration';
import { downloadFileSafely } from '../utils/fileDownload';
import { 
  isDevUser, 
  formatGroupDateHeader, 
  getGroupDateKey, 
  isMessageFromToday, 
  getYesterdayStartIso,
  isMessageFromTodayOrYesterday,
  autoPruneWeeklyMessages 
} from '../utils/devModeration';
import { renderClickableText, cleanAndFormatUserText, sanitizeDisplayText } from '../utils/textFormat';
import { wrapSecureBase64Message, unwrapSecureBase64Message } from '../utils/base64Security';

// Global memory-efficient LRU cache to eliminate Base64 decoding and Profanity regex during scrolling
const textMessageCleanCache = new Map<string, string>();
function getCachedCleanMessageText(rawText: string): string {
  if (!rawText) return '';
  let cached = textMessageCleanCache.get(rawText);
  if (cached === undefined) {
    const unwrapped = unwrapSecureBase64Message(rawText);
    cached = censorProfanity(unwrapped).cleanText;
    if (textMessageCleanCache.size > 300) {
      const first = textMessageCleanCache.keys().next().value;
      if (first) textMessageCleanCache.delete(first);
    }
    textMessageCleanCache.set(rawText, cached);
  }
  return cached;
}
import { 
  uploadFileToServer, 
  generateImageThumbnail, 
  compressImageForDirectTransfer,
  isImageFile,
  isVideoFile,
  MAX_FILE_SIZE, 
  MAX_FILE_SIZE_LABEL 
} from '../utils/fileUpload';
import { RoomDetailsModal } from './RoomDetailsModal';
import { ResetServerModal } from './ResetServerModal';
import { FileDocIcon, getDocumentTypeInfo } from './FileDocIcon';
import { SelfDestructViewerModal } from './SelfDestructViewerModal';
import { RulesModal } from './RulesModal';
import { ReportMessageModal } from './ReportMessageModal';
import { ReportIncidentModal } from './ReportIncidentModal';
import { RichChatInput, RichChatInputHandle } from './RichChatInput';
import { ZoomableImageViewerModal } from './ZoomableImageViewerModal';
import { CloudDrivePickerModal } from './CloudDrivePickerModal';
import { CloudDriveFile } from './types';
import { cleanFirestoreObject } from '../utils/firestoreClean';
import { triggerIncomingChatMessageNotification } from '../utils/tabNotification';

// Default Earth / Globe SVG Avatar for Global Lounge (Đại Sảnh Toàn Cầu)
const DEFAULT_GLOBAL_LOUNGE_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23064e3b" stroke="%2310b981" stroke-width="3"/><circle cx="50" cy="50" r="38" fill="%23047857"/><ellipse cx="50" cy="50" rx="18" ry="38" fill="none" stroke="%2334d399" stroke-width="2.5"/><line x1="12" y1="50" x2="88" y2="50" stroke="%2334d399" stroke-width="2.5"/><path d="M20 30 Q50 38 80 30" fill="none" stroke="%236ee7b7" stroke-width="2"/><path d="M20 70 Q50 62 80 70" fill="none" stroke="%236ee7b7" stroke-width="2"/></svg>`;

const ROOM_PRESET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1'];

const ChatRoomViewComponent: React.FC = () => {
  const { currentUser, userProfile, settings } = useAuth();
  const { currentLang, t } = useLanguage();
  
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('public-relay-lounge');
  // Message state: today & yesterday loaded by default, older messages loaded when scrolling up
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [memberNamesMap, setMemberNamesMap] = useState<Record<string, string>>({});
  const [memberMetaMap, setMemberMetaMap] = useState<Record<string, {
    displayName: string;
    avatarUrl?: string;
    avatarColor?: string;
    isDev?: boolean;
    isOnline?: boolean;
    lastSeen?: string;
    email?: string;
    deviceName?: string;
    deviceType?: string;
    bannerUrl?: string;
    customBio?: string;
    customBadgeText?: string;
    createdAt?: string;
  }>>({});
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [profileAnchor, setProfileAnchor] = useState<{
    top: number;
    bottom?: number;
    left: number;
    right?: number;
    width?: number;
    height?: number;
    isRightHalf?: boolean;
    isMe?: boolean;
  } | null>(null);

  // Helper to extract a reliable numeric timestamp from a message (prioritizes true atomic server time)
  const getMessageTime = (msg: Partial<ChatMessage>): number => {
    if (msg.serverTimestamp && typeof (msg.serverTimestamp as any).toMillis === 'function') {
      return (msg.serverTimestamp as any).toMillis();
    }
    if (msg.serverTimestamp && typeof (msg.serverTimestamp as any).seconds === 'number') {
      return (msg.serverTimestamp as any).seconds * 1000;
    }
    if (typeof msg.timestamp === 'number' && msg.timestamp > 0) {
      return msg.timestamp;
    }
    if (msg.createdAt) {
      const parsed = new Date(msg.createdAt).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
  };

  // Combine olderMessages + recentMessages with deduplication and chronological ordering
  const messages = React.useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of olderMessages) map.set(m.id, m);
    for (const m of recentMessages) map.set(m.id, m);
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const timeA = getMessageTime(a);
      const timeB = getMessageTime(b);
      if (timeA !== timeB) return timeA - timeB;
      const strA = a.createdAt || '';
      const strB = b.createdAt || '';
      if (strA !== strB) return strA.localeCompare(strB);
      return a.id.localeCompare(b.id);
    });
    return arr;
  }, [olderMessages, recentMessages]);

  const [viewingZoomImage, setViewingZoomImage] = useState<{ url: string; name?: string; size?: number } | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  
  // Create / Join Room state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomAvatar, setNewRoomAvatar] = useState<string>('');
  const [newRoomColor, setNewRoomColor] = useState<string>('#10b981');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Room details & structure modal ("i" button)
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);

  // Moderation warning notification
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);

  // Self-destruct image mode ('off' | 'view_once' | '10s' | '30s')
  const [selfDestructMode, setSelfDestructMode] = useState<'off' | 'view_once' | '10s' | '30s'>('off');
  const [showSelfDestructMenu, setShowSelfDestructMenu] = useState(false);
  const [activeDestructMessage, setActiveDestructMessage] = useState<ChatMessage | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showRoomReportModal, setShowRoomReportModal] = useState(false);

  // Restore draft when active room changes
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(`cloudsend_chat_draft_${activeRoomId}`) || '';
      setInputText(savedDraft);
      richInputRef.current?.setText(savedDraft);
    } catch {
      // ignore
    }
  }, [activeRoomId]);

  // Formatting & anti-glitch text toolbar
  const richInputRef = useRef<RichChatInputHandle>(null);
  const [formatNotice, setFormatNotice] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [enterKeyMode, setEnterKeyMode] = useState<'send' | 'newline'>(() => {
    return (localStorage.getItem('chat_enter_key_mode') as 'send' | 'newline') || 'send';
  });

  // Toggle or apply formatting on selection / cursor (WYSIWYG: in đậm / in nghiêng / mã trực tiếp)
  const toggleFormatting = (type: 'bold' | 'italic' | 'code' | 'codeblock') => {
    if (type === 'bold') {
      richInputRef.current?.applyBold();
      setFormatNotice(t('chat.bold_applied'));
      setTimeout(() => setFormatNotice(null), 2500);
    } else if (type === 'italic') {
      richInputRef.current?.applyItalic();
      setFormatNotice(t('chat.italic_applied'));
      setTimeout(() => setFormatNotice(null), 2500);
    } else if (type === 'code' || type === 'codeblock') {
      richInputRef.current?.applyCode?.();
      setFormatNotice(t('chat.code_applied'));
      setTimeout(() => setFormatNotice(null), 2500);
    }
  };

  // Smart Clean / Format Text (Làm gọn văn bản - chống văn bản rác, khoảng trắng thừa, BiDi rác, layout vỡ)
  const handleCleanInputText = () => {
    richInputRef.current?.cleanText();
    setFormatNotice(t('chat.cleaned'));
    setTimeout(() => setFormatNotice(null), 3500);
  };

  // Multiple file attachments in chat
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const sendTimestampsRef = useRef<number[]>([]);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isCloudPickerOpen, setIsCloudPickerOpen] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showResetServerModal, setShowResetServerModal] = useState(false);
  // Pagination: load latest 10 messages by default, scroll up to load +10 more
  const [messageLimit, setMessageLimit] = useState(10);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);

  const [mobileTab, setMobileTab] = useState<'rooms' | 'chat'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [hasUnreadNewMessage, setHasUnreadNewMessage] = useState(false);
  const hasUnreadNewMessageRef = useRef(false);
  const lastSeenMessageIdRef = useRef<string | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);

  // Reset scroll and pagination tracking when switching rooms
  useEffect(() => {
    initialLoadRef.current = true;
    lastSeenMessageIdRef.current = null;
    latestMessageIdRef.current = null;
    hasUnreadNewMessageRef.current = false;
    setHasUnreadNewMessage(false);
    setShowScrollBottomBtn(false);
    isNearBottomRef.current = true;
    setMessageLimit(10);
    setOlderMessages([]);
    setRecentMessages([]);
    setHasMoreOlder(false);
    setIsLoadingOlder(false);
    previousScrollHeightRef.current = 0;
    previousScrollTopRef.current = 0;

    // Auto scroll down immediately when switching rooms
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeRoomId]);

  // Auto clear Global Lounge messages every Monday morning
  useEffect(() => {
    if (activeRoomId !== 'public-relay-lounge') return;
    const checkMondayClear = async () => {
      const now = new Date();
      if (now.getDay() === 1) { // Monday
        const mondayKey = `global_lounge_monday_clear_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
        if (!localStorage.getItem(mondayKey)) {
          try {
            const messagesRef = collection(db, 'rooms', 'public-relay-lounge', 'messages');
            const snap = await getDocs(messagesRef);
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
            localStorage.setItem(mondayKey, 'true');
          } catch (err) {
            console.warn('Monday auto clear error:', err);
          }
        }
      }
    };
    checkMondayClear();
  }, [activeRoomId]);

  // Optimized scroll to bottom of messages
  const scrollToBottom = (smooth = true) => {
    if (latestMessageIdRef.current) {
      lastSeenMessageIdRef.current = latestMessageIdRef.current;
    }
    hasUnreadNewMessageRef.current = false;
    setHasUnreadNewMessage(false);
    setShowScrollBottomBtn(false);
    isNearBottomRef.current = true;

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Tải thêm 10 đoạn chat cũ hơn khi cuộn lên trên
  const handleLoadOlderMessages = () => {
    if (isLoadingOlder || !hasMoreOlder || !activeRoomId) return;
    const el = chatContainerRef.current;
    if (el) {
      previousScrollHeightRef.current = el.scrollHeight;
      previousScrollTopRef.current = el.scrollTop;
    }
    setIsLoadingOlder(true);
    setMessageLimit((prev) => prev + 10);
  };

  const showScrollBottomBtnRef = useRef(false);
  const scrollRafIdRef = useRef<number | null>(null);
  const lastLoadOlderTimeRef = useRef(0);

  // Track scroll position to handle new unread messages & infinite scroll up to load +10 older messages (Throttled via rAF)
  const handleScrollChat = () => {
    if (scrollRafIdRef.current !== null) return;

    scrollRafIdRef.current = requestAnimationFrame(() => {
      scrollRafIdRef.current = null;
      const el = chatContainerRef.current;
      if (!el) return;

      // Khi người dùng lăn chuột lên gần đầu (<= 60px), tự động nạp thêm 10 tin nhắn cũ hơn (cooldown 400ms)
      const now = Date.now();
      if (el.scrollTop <= 60 && hasMoreOlder && !isLoadingOlder && now - lastLoadOlderTimeRef.current > 400) {
        lastLoadOlderTimeRef.current = now;
        handleLoadOlderMessages();
      }

      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceToBottom < 100;
      isNearBottomRef.current = nearBottom;

      if (nearBottom) {
        if (latestMessageIdRef.current) {
          lastSeenMessageIdRef.current = latestMessageIdRef.current;
        }
        if (hasUnreadNewMessageRef.current) {
          hasUnreadNewMessageRef.current = false;
          setHasUnreadNewMessage(false);
        }
        if (showScrollBottomBtnRef.current) {
          showScrollBottomBtnRef.current = false;
          setShowScrollBottomBtn(false);
        }
      } else {
        const hasUnread = Boolean(
          hasUnreadNewMessageRef.current &&
          latestMessageIdRef.current &&
          latestMessageIdRef.current !== lastSeenMessageIdRef.current
        );
        if (showScrollBottomBtnRef.current !== hasUnread) {
          showScrollBottomBtnRef.current = hasUnread;
          setShowScrollBottomBtn(hasUnread);
        }
      }
    });
  };

  // Listen to available rooms
  useEffect(() => {
    if (!currentUser) return;

    // Ensure Public Lounge room exists without overwriting custom edits
    const ensurePublicRoom = async () => {
      try {
        const publicRoomRef = doc(db, 'rooms', 'public-relay-lounge');
        const snap = await getDoc(publicRoomRef);
        if (!snap.exists()) {
          await setDoc(publicRoomRef, {
            id: 'public-relay-lounge',
            name: 'Đại Sảnh Toàn Cầu (Global Lounge)',
            code: 'PUBLIC',
            isPrivate: false,
            createdBy: 'system',
            createdByName: 'Hệ thống CloudSend',
            ownerId: 'system',
            ownerName: 'Hệ thống CloudSend',
            avatar: '',
            avatarColor: '#10b981',
            createdAt: '2026-01-01T00:00:00.000Z',
            description: 'Sảnh kết nối công khai không giới hạn cho mọi thiết bị trên mạng',
            members: [],
          });
        }
      } catch (err) {
        console.warn('Init public room error:', err);
      }
    };
    ensurePublicRoom();

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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRooms(roomList);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Watch for active room deletion/dissolution by owner (Auto-redirect to lounge)
  useEffect(() => {
    if (activeRoomId && activeRoomId !== 'public-relay-lounge' && rooms.length > 0) {
      const roomStillExists = rooms.some((r) => r.id === activeRoomId);
      if (!roomStillExists) {
        setActiveRoomId('public-relay-lounge');
        setRecentMessages([]);
        setOlderMessages([]);
        setModerationWarning('📢 Phòng chat bạn đang tham gia đã được Chủ phòng giải tán. Bạn đã được chuyển về Đại Sảnh Toàn Cầu.');
        setTimeout(() => setModerationWarning(null), 8000);
      }
    }
  }, [rooms, activeRoomId]);

  // Maintain real-time member names & avatars map so when any user updates their profile, it immediately reflects across chat messages
  useEffect(() => {
    const names: Record<string, string> = {};
    const meta: Record<string, { displayName: string; avatarUrl?: string; avatarColor?: string; isDev?: boolean }> = {};
    
    // 1. Current user
    if (currentUser?.uid) {
      const myName = userProfile?.displayName || currentUser.displayName || settings.deviceName || 'Bạn';
      names[currentUser.uid] = myName;
      meta[currentUser.uid] = {
        displayName: myName,
        avatarUrl: userProfile?.customAvatarUrl || settings.customAvatarUrl || currentUser.photoURL || undefined,
        avatarColor: userProfile?.avatarColor || settings.avatarColor || '#10b981',
        isDev: isDevUser(currentUser.email)
      };
    }

    // 2. Active room members
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    if (currentRoom?.members) {
      currentRoom.members.forEach((m) => {
        if (m.uid && m.displayName) {
          names[m.uid] = m.displayName;
          meta[m.uid] = {
            displayName: m.displayName,
            avatarUrl: (m as any).customAvatarUrl || undefined,
            avatarColor: m.avatarColor || '#10b981',
            isDev: Boolean(m.isDev)
          };
        }
      });
    }

    setMemberNamesMap((prev) => ({ ...prev, ...names }));
    setMemberMetaMap((prev) => ({ ...prev, ...meta }));
  }, [currentUser?.uid, currentUser?.email, currentUser?.photoURL, userProfile?.displayName, userProfile?.customAvatarUrl, userProfile?.avatarColor, settings.deviceName, settings.customAvatarUrl, settings.avatarColor, rooms, activeRoomId]);

  // Listen to presence collection to keep live names, avatars and online status of all connected peers updated
  useEffect(() => {
    const presenceRef = collection(db, 'presence');
    const unsubscribePresence = onSnapshot(presenceRef, (snapshot) => {
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
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const names: Record<string, string> = {};
      const meta: Record<string, {
        displayName: string;
        avatarUrl?: string;
        avatarColor?: string;
        isDev?: boolean;
        email?: string;
        deviceName?: string;
        deviceType?: string;
        bannerUrl?: string;
        customBio?: string;
        customBadgeText?: string;
        createdAt?: string;
      }> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const displayName = data.displayName || data.deviceName;
        const avatarUrl = data.customAvatarUrl || data.photoURL || undefined;
        const avatarColor = data.avatarColor || '#10b981';
        const isDev = Boolean(data.isDev || isDevUser(data.email));
        const bannerUrl = data.bannerUrl || undefined;
        const customBio = (data.customBio || data.bio || '').replace(/^\$+\s*/, '').replace(/\$/g, '').trim();
        const customBadgeText = data.customBadgeText || undefined;
        const email = data.email || '';
        const deviceName = data.deviceName || '';
        const deviceType = data.deviceType || '';
        const createdAt = data.createdAt || '';

        if (displayName) {
          const item = { 
            displayName, 
            avatarUrl, 
            avatarColor, 
            isDev,
            bannerUrl,
            customBio,
            customBadgeText,
            email,
            deviceName,
            deviceType,
            createdAt
          };
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
      unsubscribePresence();
      unsubscribeUsers();
    };
  }, []);

  // Listen to messages in active room (Tải 10 tin nhắn mới nhất, cuộn lên để xem tiếp 10 tin nhắn cũ)
  useEffect(() => {
    if (!currentUser || !activeRoomId) return;

    const messagesRef = collection(db, 'rooms', activeRoomId, 'messages');
    
    // Tải theo messageLimit (bắt đầu là 10, tăng dần +10 khi cuộn lên trên)
    const q = query(
      messagesRef, 
      orderBy('createdAt', 'desc'),
      limit(messageLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      let hasNewExternalMsg = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data({ serverTimestamps: 'estimate' });
        const msg = { id: docSnap.id, ...data } as ChatMessage;
        msgs.push(msg);
        if (msg.senderId !== currentUser.uid && !initialLoadRef.current) {
          hasNewExternalMsg = true;
        }
      });

      // Nếu số lượng tin nhắn đạt tới messageLimit thì nghĩa là còn tin nhắn cũ hơn phía trước
      setHasMoreOlder(snapshot.docs.length >= messageLimit);

      // Sắp xếp thứ tự thời gian tăng dần để hiển thị từ trên xuống dưới
      msgs.sort((a, b) => {
        const timeA = getMessageTime(a);
        const timeB = getMessageTime(b);
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        const strA = a.createdAt || '';
        const strB = b.createdAt || '';
        if (strA !== strB) {
          return strA.localeCompare(strB);
        }
        return a.id.localeCompare(b.id);
      });

      setRecentMessages(msgs);

      if (hasNewExternalMsg) {
        if (settings.soundEnabled) {
          playReceiveSound();
        }
        if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
          triggerIncomingChatMessageNotification(1);
        }
      }

      const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      if (latestMsg) {
        latestMessageIdRef.current = latestMsg.id;
      }

      const isFirst = initialLoadRef.current;
      initialLoadRef.current = false;
      
      // Giữ nguyên vị trí mắt nhìn khi vừa nạp thêm 10 tin nhắn cũ (chống nhảy/giật màn hình)
      if (isLoadingOlder) {
        requestAnimationFrame(() => {
          const el = chatContainerRef.current;
          if (el) {
            const heightDiff = el.scrollHeight - previousScrollHeightRef.current;
            el.scrollTop = previousScrollTopRef.current + heightDiff;
          }
          setIsLoadingOlder(false);
        });
        return;
      }

      // Handle scrolling & scroll restoration
      if (isFirst) {
        if (latestMsg) {
          lastSeenMessageIdRef.current = latestMsg.id;
        }
        hasUnreadNewMessageRef.current = false;
        setHasUnreadNewMessage(false);
        setShowScrollBottomBtn(false);
        requestAnimationFrame(() => {
          scrollToBottom(false);
        });
      } else if (!latestMsg) {
        setShowScrollBottomBtn(false);
      } else if (latestMsg.senderId === currentUser.uid) {
        lastSeenMessageIdRef.current = latestMsg.id;
        hasUnreadNewMessageRef.current = false;
        setHasUnreadNewMessage(false);
        setShowScrollBottomBtn(false);
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      } else if (isNearBottomRef.current) {
        lastSeenMessageIdRef.current = latestMsg.id;
        hasUnreadNewMessageRef.current = false;
        setHasUnreadNewMessage(false);
        setShowScrollBottomBtn(false);
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      } else {
        if (latestMsg.id !== lastSeenMessageIdRef.current) {
          hasUnreadNewMessageRef.current = true;
          setHasUnreadNewMessage(true);
          setShowScrollBottomBtn(true);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, activeRoomId, messageLimit, settings.soundEnabled]);

  // Auto-detect and register user as a member when entering any room
  useEffect(() => {
    if (!currentUser || !activeRoomId || rooms.length === 0) return;
    const currentRoom = rooms.find(r => r.id === activeRoomId);
    if (!currentRoom) return;

    const existingMembers = currentRoom.members || [];
    const isAlreadyMember = existingMembers.some(m => m.uid === currentUser.uid);

    if (!isAlreadyMember) {
      const isRoomOwner = currentRoom.ownerId === currentUser.uid || currentRoom.createdBy === currentUser.uid;
      const isDev = isDevUser(currentUser.email);
      const newMember: RoomMember = {
        uid: currentUser.uid,
        displayName: userProfile?.displayName || currentUser.displayName || 'Thành viên',
        deviceName: settings.deviceName,
        avatarColor: settings.avatarColor || '#10b981',
        role: isRoomOwner ? 'owner' : 'member',
        joinedAt: new Date().toISOString(),
        email: currentUser.email || '',
        isDev: isDev
      };

      const updatedMembers = [...existingMembers, newMember];
      updateDoc(doc(db, 'rooms', activeRoomId), {
        members: updatedMembers,
        membersCount: updatedMembers.length
      }).catch(err => {
        console.warn('Auto register member error:', err);
      });
    }
  }, [currentUser, activeRoomId, rooms]);

  // Compress a single image file to a lightweight data URL and upload original for heavy files
  const compressImage = async (file: File): Promise<ChatAttachment> => {
    // Generate lightweight preview thumbnail
    const thumb = await generateImageThumbnail(file, 800, 0.75);

    // If file is > 200KB or if it is HEIC/HEIF (which needs server conversion for browsers), upload to server
    let fileUrl: string | undefined = undefined;
    let serverThumb: string | undefined = undefined;
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';

    if (file.size > 200 * 1024 || isHeic || !thumb) {
      try {
        const uploaded = await uploadFileToServer(file, (pct) => {
          setUploadProgressText(`Đang xử lý ảnh "${file.name}" (${pct}%)...`);
        });
        fileUrl = uploaded.url;
        if (uploaded.thumbnail) {
          serverThumb = uploaded.thumbnail;
        }
      } catch (err) {
        console.warn('Could not upload original image to server, fallback to thumbnail:', err);
      }
    }

    let finalData = serverThumb || thumb || '';
    if (!finalData && !fileUrl) {
      // Smart direct fallback for mobile photos when server proxy is unavailable
      finalData = await compressImageForDirectTransfer(file, 1080, 0.8);
    }

    return {
      name: file.name,
      size: file.size,
      type: isHeic ? 'image/heic' : (file.type || 'image/jpeg'),
      data: finalData,
      url: fileUrl
    };
  };

  // Convert and upload heavy non-image file with security extension checks
  const processGeneralFile = async (file: File): Promise<ChatAttachment | null> => {
    // Security check: block dangerous executables, scripts, and double extensions
    const securityCheck = inspectFileSecurity(file);
    if (!securityCheck.isSafe) {
      playShieldAlertSound();
      setModerationWarning(`🚫 ${securityCheck.error || `Tệp "${file.name}" không an toàn và đã bị chặn.`}`);
      setTimeout(() => setModerationWarning(null), 7000);
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setModerationWarning(`⚠️ Tệp "${file.name}" (${formatFileSize(file.size)}) vượt quá giới hạn tối đa ${MAX_FILE_SIZE_LABEL}.`);
      setTimeout(() => setModerationWarning(null), 5000);
      return null;
    }

    try {
      setUploadProgressText(`Đang tải tệp "${file.name}"...`);
      const uploaded = await uploadFileToServer(file, (pct) => {
        setUploadProgressText(`Đang tải tệp "${file.name}" (${pct}%)...`);
      });

      return {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        data: '',
        url: uploaded.viewUrl || uploaded.url
      };
    } catch (err: any) {
      setModerationWarning(err?.message || 'Lỗi khi tải tệp lên máy chủ.');
      setTimeout(() => setModerationWarning(null), 5000);
      return null;
    }
  };

  // Process multiple incoming files (via file picker, drag drop, or paste) in parallel for high speed
  const processAndAttachFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const MAX_FILES = 10;
    const itemsToProcess = files.slice(0, MAX_FILES);

    setIsCompressing(true);
    setUploadProgressText('Đang đính kèm tệp tin...');
    try {
      const results = await Promise.all(
        itemsToProcess.map(async (file) => {
          if (isImageFile(file)) {
            return await compressImage(file);
          } else {
            return await processGeneralFile(file);
          }
        })
      );

      const validAttachments = results.filter(Boolean) as ChatAttachment[];

      setAttachments((prev) => {
        const combined = [...prev];
        for (const item of validAttachments) {
          if (!combined.some(c => c.name === item.name && c.size === item.size)) {
            combined.push(item);
          }
        }
        return combined.slice(0, 10);
      });
    } catch (err) {
      console.error('Process files error:', err);
    } finally {
      setIsCompressing(false);
      setUploadProgressText(null);
      setTimeout(() => {
        richInputRef.current?.focus();
      }, 50);
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle files selected from Cloud Drive (direct attach without re-upload)
  const handleCloudFilesSelected = (chosen: CloudDriveFile[]) => {
    if (!chosen.length) return;
    const newAttachments: ChatAttachment[] = chosen.map((cf) => ({
      name: cf.name,
      size: cf.size,
      type: cf.type || 'application/octet-stream',
      data: cf.thumbnail || '',
      url: cf.viewUrl || cf.url
    }));

    setAttachments((prev) => {
      const combined = [...prev];
      for (const item of newAttachments) {
        if (!combined.some(c => c.name === item.name && c.size === item.size)) {
          combined.push(item);
        }
      }
      return combined.slice(0, 10);
    });

    setIsCloudPickerOpen(false);
    setTimeout(() => {
      richInputRef.current?.focus();
    }, 50);
  };

  // Handle drag & drop over chat
  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOverChat) {
      setIsDraggingOverChat(true);
    }
  };

  const handleChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOverChat(false);
  };

  const handleChatDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndAttachFiles(e.dataTransfer.files);
    }
  };

  // Handle pasting images from clipboard directly in input (Ctrl+V / Cmd+V)
  const handleChatPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      processAndAttachFiles(pastedFiles);
      e.preventDefault();
    }
  };

  // Send message - Instant 0ms response like Discord / Zalo
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const rawTextOriginal = typeof customText === 'string' ? customText : inputText;
    if (!rawTextOriginal.trim() && attachments.length === 0) return;

    // Security & Anti-Flood: Max 5 messages per 3 seconds
    const now = Date.now();
    sendTimestampsRef.current = sendTimestampsRef.current.filter(t => now - t < 3000);
    if (sendTimestampsRef.current.length >= 5) {
      setModerationWarning('⚠️ Bạn đang gửi tin nhắn quá nhanh. Vui lòng chậm lại 1-2 giây.');
      setTimeout(() => setModerationWarning(null), 3000);
      return;
    }
    sendTimestampsRef.current.push(now);

    if (rawTextOriginal.length > 5000) {
      setModerationWarning('⚠️ Độ dài tin nhắn vượt quá giới hạn 5,000 ký tự cho phép.');
      setTimeout(() => setModerationWarning(null), 4000);
      return;
    }

    // 1. INSTANT CLEAR & UI FEEDBACK (Immediate Visual Reaction)
    setInputText('');
    richInputRef.current?.clear();
    setAttachments([]);
    setSelfDestructMode('off');
    setShowSelfDestructMenu(false);
    try {
      localStorage.removeItem(`cloudsend_chat_draft_${activeRoomId}`);
    } catch {}

    // 2. Play send sound off the main critical paint path
    if (settings.soundEnabled) {
      requestAnimationFrame(() => playSendSound());
    }

    // 3. ⚡ YIELD TO MAIN: Lets browser complete Next Paint (<16ms INP) before heavy processing
    await yieldToMain();

    const sanitizedInput = sanitizeDisplayText(rawTextOriginal);
    const { cleanText, hasProfanity, detectedList } = censorProfanity(sanitizedInput);
    const textToSend = cleanText;

    if (hasProfanity) {
      setModerationWarning(`⚠️ Phát hiện từ ngữ thô tục (${detectedList.slice(0, 3).join(', ')}). Đã tự động thay bằng ***.`);
      setTimeout(() => setModerationWarning(null), 4000);
    }

    const attachmentsToSend = [...attachments];
    const isSelfDestruct = selfDestructMode !== 'off' && attachmentsToSend.length > 0;
    const selfDestructDuration = selfDestructMode === '10s' ? 10 : selfDestructMode === '30s' ? 30 : 0;

    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const effectiveTimeMs = Date.now();
    const effectiveIso = new Date(effectiveTimeMs).toISOString();
    const isDev = isDevUser(currentUser.email);

    // Prepare safe attachments
    const safeAttachments = attachmentsToSend.map(att => ({
      name: att.name || 'file',
      size: att.size || 0,
      type: att.type || 'application/octet-stream',
      data: (att.data && att.data.length < 500000) ? att.data : '',
      url: (att.url && att.url.length < 700000) ? att.url : undefined
    }));

    const messagePayload: any = {
      roomId: activeRoomId,
      senderId: currentUser.uid,
      senderName: userProfile?.displayName || settings.deviceName || 'Người dùng',
      senderEmail: currentUser.email || userProfile?.email || '',
      senderDevice: settings.deviceName,
      senderAvatar: userProfile?.customAvatarUrl || settings.customAvatarUrl || currentUser.photoURL || '',
      senderAvatarColor: userProfile?.avatarColor || settings.avatarColor || '#10b981',
      text: wrapSecureBase64Message(textToSend),
      rawText: wrapSecureBase64Message(rawTextOriginal),
      hasProfanity: hasProfanity,
      detectedProfanity: detectedList,
      createdAt: effectiveIso,
      timestamp: effectiveTimeMs,
      serverTimestamp: serverTimestamp(),
      isDevMessage: isDev,
    };

    if (isSelfDestruct) {
      messagePayload.isSelfDestruct = true;
      messagePayload.selfDestructDuration = selfDestructDuration;
      messagePayload.viewedBy = [];
    }

    if (safeAttachments.length === 1) {
      messagePayload.fileName = safeAttachments[0].name;
      messagePayload.fileSize = safeAttachments[0].size;
      messagePayload.fileType = safeAttachments[0].type;
      messagePayload.fileData = safeAttachments[0].data || '';
      if (safeAttachments[0].url) messagePayload.fileUrl = safeAttachments[0].url;
    }
    if (safeAttachments.length > 0) {
      messagePayload.attachments = safeAttachments;
    }

    // 3. OPTIMISTIC UPDATE: Add message to local state immediately so it renders at 0ms!
    const optimisticMessage: ChatMessage = {
      id: tempId,
      ...messagePayload,
      serverTimestamp: null
    };
    setRecentMessages(prev => [...prev.filter(m => m.id !== tempId), optimisticMessage]);
    requestAnimationFrame(() => scrollToBottom(true));

    // 4. Send to Firestore in the background
    try {
      const sanitizedPayload = cleanFirestoreObject(messagePayload);
      const docRef = await addDoc(collection(db, 'rooms', activeRoomId, 'messages'), sanitizedPayload);

      // Audit archiving in background
      setDoc(doc(db, 'rooms', activeRoomId, 'audit_messages', docRef.id), {
        ...sanitizedPayload,
        id: docRef.id,
        archivedAt: effectiveIso,
        isDeletedBySender: false
      }).catch(() => {});
    } catch (err: any) {
      console.error('Send message background error:', err);
      // Remove optimistic message on error and restore text if failed
      setRecentMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(rawTextOriginal);
      setModerationWarning('Lỗi khi gửi tin nhắn lên máy chủ. Vui lòng thử lại.');
      setTimeout(() => setModerationWarning(null), 4000);
    }

    // 5. Background AI safety audit (non-blocking, doesn't delay user typing)
    if (sanitizedInput && sanitizedInput.length >= 2) {
      checkContentWithAI(sanitizedInput, currentUser?.email || undefined, currentUser?.uid)
        .then(aiCheck => {
          if (aiCheck?.isFlagged && (aiCheck.severity === 'high' || aiCheck.severity === 'critical')) {
            playShieldAlertSound();
            setModerationWarning(
              `🚫 [AI Kiểm Duyệt] Cảnh báo vi phạm: ${aiCheck.message || aiCheck.matchedRule}. Nhắc nhở: "${aiCheck.remindText || 'Vui lòng tuân thủ nội quy'}"`
            );
            setTimeout(() => setModerationWarning(null), 8000);
          }
        })
        .catch(() => {});
    }
  };

  // Delete message (destruct manually or upon self-destruct trigger)
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const nowIso = new Date().toISOString();

      // 1. Mark in audit_messages archive so DEV Frame 4 always retains it uncensored
      try {
        await setDoc(doc(db, 'rooms', activeRoomId, 'audit_messages', messageId), {
          deletedBySender: true,
          isDeletedBySender: true,
          deletedAt: nowIso
        }, { merge: true });
      } catch (err) {
        console.warn('Audit update error:', err);
      }

      // 2. Update active room messages with soft-delete flag so client disappears instantly without breaking or losing data
      setRecentMessages(prev => prev.filter(m => m.id !== messageId));
      setOlderMessages(prev => prev.filter(m => m.id !== messageId));

      try {
        await updateDoc(doc(db, 'rooms', activeRoomId, 'messages', messageId), {
          deletedBySender: true,
          isDeletedBySender: true,
          deletedAt: nowIso
        });
      } catch (err) {
        // Fallback hard-delete if update fails
        await deleteDoc(doc(db, 'rooms', activeRoomId, 'messages', messageId));
      }

      playDestructSound();
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  // Create new chat room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newRoomName.trim()) return;

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

    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      const roomPayload: ChatRoom = {
        id: roomId,
        name: newRoomName.trim(),
        code: randomCode,
        isPrivate: true,
        createdBy: currentUser.uid,
        createdByName: userProfile?.displayName || 'Người dùng',
        ownerId: currentUser.uid,
        ownerName: userProfile?.displayName || currentUser.displayName || 'Trưởng phòng',
        avatar: newRoomAvatar || '',
        avatarColor: newRoomColor || '#10b981',
        createdAt: new Date().toISOString(),
        description: `Phòng riêng tư bảo mật (Mã: ${randomCode})`,
        members: [creatorMember],
        membersCount: 1
      };

      await setDoc(doc(db, 'rooms', roomId), roomPayload);
      setActiveRoomId(roomId);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomAvatar('');
      setNewRoomColor('#10b981');
    } catch (err) {
      console.error('Create room error:', err);
    }
  };

  // Join room by ID / Code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const code = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) return;

    let found = rooms.find(r => r.code?.toUpperCase() === code || r.id === code);
    
    // Fallback: query Firestore server directly if not yet in local state
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
      // Khi người nào đó nhập trúng ID và vô nhóm thì tự động là thành viên
      const existingMembers = found.members || [];
      const isAlreadyMember = existingMembers.some(m => m.uid === currentUser?.uid);

      if (!isAlreadyMember && currentUser) {
        const isDev = isDevUser(currentUser.email);
        const newMember: RoomMember = {
          uid: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName || 'Thành viên',
          deviceName: settings.deviceName,
          avatarColor: settings.avatarColor || '#3b82f6',
          role: 'member', // Là thành viên
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
      setJoinCodeInput('');
      setMobileTab('chat');
    } else {
      setJoinError('Không tìm thấy phòng với mã ID này. Vui lòng kiểm tra lại!');
    }
  };

  const handleCopyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filter visible rooms: all public rooms, and private rooms where user is member or creator
  const visibleRooms = rooms.filter(room => {
    if (room.id === 'public-relay-lounge' || room.isPrivate === false) return true;
    if (!currentUser) return false;
    const isOwner = room.ownerId === currentUser.uid || room.createdBy === currentUser.uid;
    const isMember = (room.members || []).some(m => m.uid === currentUser.uid);
    return isOwner || isMember;
  });

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];

  // Auto maintenance for DEV / rooms with weekly auto-reset
  useEffect(() => {
    if (!currentUser || !activeRoomId || !isDevUser(currentUser.email)) return;
    if (activeRoom && (activeRoom as any).autoWeeklyReset) {
      autoPruneWeeklyMessages(activeRoomId).catch(() => {});
    }
  }, [activeRoomId, currentUser?.email, (activeRoom as any)?.autoWeeklyReset]);

  return (
    <div className="flex-1 h-full min-h-0 w-full px-3 sm:px-6 lg:px-8 py-2 sm:py-4 flex flex-col md:flex-row gap-3 md:gap-6 overflow-hidden">
      {/* Left Sidebar: Room List & Actions */}
      <div className={`${mobileTab === 'rooms' ? 'flex' : 'hidden md:flex'} w-full md:w-80 lg:w-96 bg-slate-900 border border-slate-800 rounded-2xl flex-col shadow-xl overflow-hidden shrink-0`}>
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">{t('chat.rooms')}</h3>
          </div>
          <button
            id="create-room-btn"
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('chat.new_room')}
          </button>
        </div>

        {/* Quick Join by Code */}
        <div className="p-3 sm:p-3.5 border-b border-slate-800/80 bg-slate-950/20">
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder={t('chat.join_room')}
              className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 uppercase focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold shrink-0 transition-colors"
            >
              OK
            </button>
          </form>
          {joinError && <p className="text-xs text-rose-400 mt-1.5">{joinError}</p>}
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1.5">
          {visibleRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const isOwner = room.ownerId === currentUser?.uid || room.createdBy === currentUser?.uid;
            return (
              <button
                key={room.id}
                id={`room-item-${room.id}`}
                type="button"
                onClick={() => {
                  setActiveRoomId(room.id);
                  setMobileTab('chat');
                }}
                className={`w-full text-left p-2.5 sm:p-3 rounded-xl transition-all flex items-center gap-3 group ${
                  isActive
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {/* Room Avatar thumbnail */}
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 border border-white/10 overflow-hidden"
                  style={{ backgroundColor: room.avatarColor || '#10b981' }}
                >
                  {room.avatar ? (
                    <img src={room.avatar} alt={room.name} className="w-full h-full object-cover" />
                  ) : room.id === 'public-relay-lounge' ? (
                    <img src={DEFAULT_GLOBAL_LOUNGE_AVATAR} alt="Đại Sảnh Toàn Cầu" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(room.name || 'P').charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {room.isPrivate !== false && room.id !== 'public-relay-lounge' && (
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="font-semibold text-sm truncate">
                      {room.id === 'public-relay-lounge' ? t('chat.public_lounge') : room.name}
                    </span>
                    {room.id === 'public-relay-lounge' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        {t('chat.public')}
                      </span>
                    ) : isOwner ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5 text-amber-400" />
                        {t('chat.owner')}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {t('chat.member')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {room.id === 'public-relay-lounge' ? t('chat.global_lounge_desc') : (room.description || (room.isPrivate !== false ? `Mã riêng tư: ${room.code}` : 'Phòng cộng đồng'))}
                  </p>
                </div>
                {room.isPrivate !== false && room.id !== 'public-relay-lounge' && (
                  <span className="text-xs font-mono px-2 py-1 rounded-md bg-slate-800 text-amber-400 shrink-0 border border-amber-500/20">
                    {room.code}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
        className={`${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'} flex-1 bg-slate-900 border rounded-2xl flex-col shadow-xl overflow-hidden min-h-[350px] relative transition-colors ${
          isDraggingOverChat ? 'border-emerald-500 bg-slate-900/90 ring-2 ring-emerald-500/40' : 'border-slate-800'
        }`}
      >
        {/* Full-area Drag Drop Overlay Hint */}
        {isDraggingOverChat && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-in fade-in duration-150">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
              <ImageIcon className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Thả ảnh hoặc tệp vào đây</h3>
            <p className="text-xs text-emerald-300/90 max-w-xs">
              Ảnh sẽ được tự động đính kèm và hiển thị ngay trên thanh chat để bạn xem trước!
            </p>
          </div>
        )}

        {/* Room Header */}
        {activeRoom && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileTab('rooms')}
                className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                title="Danh sách phòng"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Room Avatar in Header - Before the Room Title */}
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 border border-white/10 overflow-hidden relative cursor-pointer group"
                style={{ backgroundColor: activeRoom.avatarColor || '#10b981' }}
                onClick={() => setShowRoomDetails(true)}
                title="Xem & Chỉnh sửa thông tin phòng (nút i)"
              >
                {activeRoom.avatar ? (
                  <img src={activeRoom.avatar} alt={activeRoom.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : activeRoom.id === 'public-relay-lounge' ? (
                  <img src={DEFAULT_GLOBAL_LOUNGE_AVATAR} alt="Đại Sảnh Toàn Cầu" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <span>{(activeRoom.name || 'P').charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    {activeRoom.id === 'public-relay-lounge' ? t('chat.public_lounge') : activeRoom.name}
                  </h2>
                  {activeRoom.isPrivate !== false && activeRoom.id !== 'public-relay-lounge' && (
                    <button
                      type="button"
                      onClick={() => handleCopyRoomCode(activeRoom.code)}
                      title="Sao chép mã phòng"
                      className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors border border-amber-500/30 shrink-0"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span className="copyable-text select-text cursor-text" data-copyable="true">ID: {activeRoom.code}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                  {activeRoom.id === 'public-relay-lounge' ? t('chat.global_lounge_desc') : (activeRoom.description || (activeRoom.isPrivate !== false ? 'Phòng riêng tư bảo mật' : 'Sảnh kết nối công khai'))}
                </p>
              </div>
            </div>

            {/* Action buttons: Report & Room Info */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="room-report-btn"
                type="button"
                onClick={() => setShowRoomReportModal(true)}
                title={currentLang === 'en' ? "Report room violation / Send report to DEV" : "Báo cáo vi phạm phòng chat / Gửi phản hồi tới DEV"}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 flex items-center justify-center shadow-sm active:scale-95 transition-all group cursor-pointer"
              >
                <Flag className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </button>

              <button
                id="room-info-i-btn"
                type="button"
                onClick={() => setShowRoomDetails(true)}
                title={activeRoom.isPrivate !== false ? "Cấu trúc & Cài đặt phòng riêng tư" : "Thông tin & Thành viên phòng"}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 flex items-center justify-center shadow-sm active:scale-95 transition-all group"
              >
                <span className="font-serif italic font-bold text-base text-emerald-400 group-hover:scale-110 transition-transform">
                  i
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Message Feed */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScrollChat}
          className="flex-1 chat-scroll-container p-3 sm:p-4 space-y-3 relative"
        >
          {(() => {
            const visibleMessages = messages.filter(m => !m.deletedBySender && !m.isDeletedBySender);

            return (
              <>
                {/* 10-message pagination controls at top */}
                {isLoadingOlder ? (
                  <div className="py-2.5 flex items-center justify-center text-xs text-slate-400 gap-2 select-none animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{t('chat.loading_older')}</span>
                  </div>
                ) : hasMoreOlder ? (
                  <div className="py-2 flex items-center justify-center select-none">
                    <button
                      type="button"
                      onClick={handleLoadOlderMessages}
                      className="px-3.5 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 shadow-sm flex items-center gap-1.5 transition-all active:scale-95 group cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-emerald-400 group-hover:-rotate-45 transition-transform" />
                      <span>{t('chat.load_older_10')}</span>
                    </button>
                  </div>
                ) : visibleMessages.length > 0 ? (
                  <div className="py-2.5 text-center text-xs text-slate-500 font-medium select-none border-b border-slate-800/60 mb-2 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('chat.reached_beginning')}</span>
                  </div>
                ) : null}

                {/* Empty State */}
                {visibleMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center shadow-inner">
                      <MessagesSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-slate-200">
                        {t('chat.empty')}
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        {currentLang === 'en' ? 'Send a message or drop files below to start the conversation!' : 'Gửi tin nhắn hoặc đính kèm tệp tin bên dưới để bắt đầu cuộc trò chuyện!'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Messages Map with Group Date Timeline Dividers */}
                {visibleMessages.map((msg, index) => {
                  const isMe = msg.senderId === currentUser?.uid;
                  const isDevMsg = !!(msg.isDevMessage || isDevUser(msg.senderEmail) || (msg.senderName && msg.senderName.includes('DEV')));
                  const isWarned = !!(msg.hasProfanity || msg.hasWarning || msg.isReported);

                  // Group Date Timeline Divider calculation
                  const currentDateKey = getGroupDateKey(msg.createdAt);
                  const prevDateKey = index > 0 ? getGroupDateKey(visibleMessages[index - 1].createdAt) : null;
                  const showDateHeader = index === 0 || currentDateKey !== prevDateKey;

                  // Collect all attachments from message (supports multiple attachments & legacy single file format)
                  const msgAttachments: ChatAttachment[] = [];
                  if (msg.attachments && msg.attachments.length > 0) {
                    msgAttachments.push(...msg.attachments);
                  } else if (msg.fileData || msg.fileUrl) {
                    msgAttachments.push({
                      name: msg.fileName || 'file',
                      size: msg.fileSize || 0,
                      type: msg.fileType || 'application/octet-stream',
                      data: msg.fileData || '',
                      url: msg.fileUrl
                    });
                  }

                  const imageAttachments = msgAttachments.filter(a => isImageFile(a));
                  const videoAttachments = msgAttachments.filter(a => isVideoFile(a));
                  const otherAttachments = msgAttachments.filter(a => !isImageFile(a) && !isVideoFile(a));

                  return (
                    <React.Fragment key={msg.id ? `${msg.id}_${index}` : index}>
                      {/* Group Date Timeline Divider */}
                      {showDateHeader && (
                        <div className="flex items-center justify-center my-3 select-none">
                          <div className="px-3.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] font-semibold text-slate-300 shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{formatGroupDateHeader(msg.createdAt)}</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`chat-bubble-item flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-message-enter`}
                      >
                  {/* Sender Header with Avatar on top of chat frame like Discord & Zalo */}
                  {(() => {
                    const senderMeta = memberMetaMap[msg.senderId] || memberMetaMap[msg.senderDevice];
                    const effectiveAvatarUrl = msg.senderAvatar || (isMe ? (userProfile?.customAvatarUrl || settings?.customAvatarUrl || currentUser?.photoURL) : senderMeta?.avatarUrl);
                    const effectiveAvatarColor = msg.senderAvatarColor || (isMe ? (userProfile?.avatarColor || settings?.avatarColor || '#10b981') : (senderMeta?.avatarColor || '#10b981'));
                    const senderDisplayName = isMe 
                      ? (memberNamesMap[currentUser?.uid || ''] || userProfile?.displayName || 'Bạn') 
                      : (memberNamesMap[msg.senderId] || senderMeta?.displayName || msg.senderName || 'Người dùng');
                    const initialChar = (senderDisplayName.trim().charAt(0) || 'U').toUpperCase();

                    return (
                      <div className={`flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400 flex-wrap ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar on top of chat frame */}
                        <div 
                          className={`relative shrink-0 select-none group/avatar transition-transform ${isMe ? '' : 'cursor-pointer hover:scale-105'}`}
                          onClick={(e) => {
                            // UX Filter Logic: Chặn tài khoản chính (Current User), hoàn toàn im lặng, chỉ kích hoạt cho người khác
                            if (isMe || (currentUser?.uid && msg.senderId === currentUser.uid)) return;

                            const rect = e.currentTarget.getBoundingClientRect();
                            setProfileAnchor({
                              top: rect.top,
                              bottom: rect.bottom,
                              left: rect.left,
                              right: rect.right,
                              width: rect.width,
                              height: rect.height,
                              isRightHalf: false,
                              isMe: false
                            });
                            setSelectedProfileUser({
                              uid: msg.senderId || msg.senderDevice,
                              displayName: senderDisplayName,
                              email: senderMeta?.email || '',
                              avatarUrl: effectiveAvatarUrl,
                              avatarColor: effectiveAvatarColor,
                              isDev: isDevMsg,
                              isOnline: isMe || Boolean(senderMeta?.isOnline),
                              deviceName: senderMeta?.deviceName,
                              deviceType: senderMeta?.deviceType,
                              createdAt: senderMeta?.createdAt,
                              bannerUrl: senderMeta?.bannerUrl,
                              customBio: senderMeta?.customBio || (senderMeta as any)?.bio,
                              customBadgeText: senderMeta?.customBadgeText,
                              isMe: false
                            });
                          }}
                          title={isMe ? undefined : "Xem hồ sơ cá nhân"}
                        >
                          {effectiveAvatarUrl ? (
                            <img
                              src={effectiveAvatarUrl}
                              alt={senderDisplayName}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-1 ring-slate-700/80 shadow-xs"
                            />
                          ) : (
                            <div
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-xs ring-1 ring-white/10"
                              style={{ backgroundColor: effectiveAvatarColor }}
                            >
                              {initialChar}
                            </div>
                          )}
                          {isDevMsg ? (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-full flex items-center justify-center shadow-xs ring-1 ring-slate-900"
                              title="DEV Chính Chủ"
                            >
                              <Crown className="w-2 h-2 text-slate-950 fill-slate-950" />
                            </span>
                          ) : (isMe || senderMeta?.isOnline) ? (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900 shadow-xs"
                              title="Đang hoạt động (Online - Thời gian sống 3p)"
                            />
                          ) : null}
                        </div>

                        {/* Sender Name / DEV Badge */}
                        {isDevMsg ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent truncate max-w-[150px]">
                              {senderDisplayName}
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs inline-flex items-center gap-0.5 shrink-0">
                              👑 DEV
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                            {senderDisplayName}
                          </span>
                        )}

                        <span>•</span>
                        <span className="text-slate-500 truncate max-w-[120px]">
                          {msg.senderDevice}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono shrink-0">
                          {(() => {
                            const t = getMessageTime(msg);
                            return t > 0
                              ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '';
                          })()}
                        </span>

                        {/* Delete button on hover for sender or owner */}
                        {(isMe || activeRoom?.ownerId === currentUser?.uid) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-1"
                            title="Xóa / tiêu hủy tin nhắn này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Copy message button */}
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
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all ml-1 cursor-pointer"
                            title="Sao chép nội dung tin nhắn"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Report button for other users */}
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => setReportingMessage(msg)}
                            className="opacity-60 sm:opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all ml-1"
                            title="Tố cáo tin nhắn này đến DEV (lách luật, 18+, quấy rối)"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Message Bubble - Compact, neat & balanced */}
                  <div
                    className={`max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl px-3.5 py-2 space-y-1.5 shadow-sm text-xs sm:text-[13px] ${
                      isWarned
                        ? 'border-2 border-rose-500 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/50'
                        : isDevMsg
                        ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/50 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10 ring-1 ring-emerald-500/40 text-white'
                        : isMe
                        ? 'bg-emerald-600 text-white rounded-tr-sm'
                        : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60'
                    }`}
                  >
                    {/* DEV Banner inside bubble */}
                    {isDevMsg && (
                      <div className="flex items-center gap-1.5 pb-1 border-b border-amber-500/20 text-[10px] text-amber-300 font-semibold">
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Thông điệp từ Nhà Phát Triển (DEV)</span>
                      </div>
                    )}
                    {/* Warning Notice if flagged */}
                    {isWarned && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-500/40 text-rose-200 text-[10px] font-semibold w-fit">
                        <AlertTriangle className="w-3 h-3 text-rose-300 animate-pulse" />
                        <span>Nội dung bị cảnh cáo vi phạm</span>
                      </div>
                    )}

                    {/* Self-Destruct Notice Badge */}
                    {msg.isSelfDestruct && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 text-[10px] font-semibold w-fit">
                        <Flame className="w-3 h-3 text-orange-400 animate-pulse" />
                        <span>{msg.selfDestructDuration ? `Ảnh tự hủy sau ${msg.selfDestructDuration}s` : 'Ảnh bảo mật (Xem 1 lần)'}</span>
                      </div>
                    )}

                    {/* Attached Images Grid OR Protected Self-Destruct Card */}
                    {imageAttachments.length > 0 && (
                      msg.isSelfDestruct ? (
                        <div
                          onClick={() => setActiveDestructMessage(msg)}
                          className="cursor-pointer group/destruct rounded-xl overflow-hidden bg-slate-950/80 border border-orange-500/40 p-3.5 flex flex-col items-center justify-center text-center space-y-2 hover:border-orange-500 transition-all hover:shadow-lg hover:shadow-orange-500/10"
                        >
                          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 group-hover/destruct:scale-110 transition-transform shadow-md shadow-orange-500/20">
                            <Flame className="w-5 h-5 animate-bounce" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-orange-200">
                              {msg.selfDestructDuration ? `Ảnh tự hủy (${msg.selfDestructDuration} giây)` : 'Ảnh tự hủy (Xem 1 lần)'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Nhấn để mở xem ({imageAttachments.length} ảnh) • Tự động tiêu hủy sau khi xem
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={`grid gap-1.5 ${
                          imageAttachments.length === 1 
                            ? 'grid-cols-1' 
                            : imageAttachments.length === 2 
                              ? 'grid-cols-2' 
                              : 'grid-cols-2 sm:grid-cols-3'
                        }`}>
                          {imageAttachments.map((img, idx) => {
                            const viewUrl = img.url ? img.url.replace('/api/files/download/', '/api/files/view/') : '';
                            const imgSrc = img.data || viewUrl || img.url;
                            const imgDownload = img.url || img.data;
                            return (
                            <div key={idx} className="relative group rounded-xl overflow-hidden bg-black/40 border border-white/10 shadow-sm">
                              <img
                                src={imgSrc}
                                alt={img.name}
                                loading="lazy"
                                decoding="async"
                                className={`w-full ${imageAttachments.length === 1 ? 'max-h-56 sm:max-h-64' : 'h-32 sm:h-36'} object-cover hover:opacity-95 transition-opacity cursor-pointer`}
                                onClick={() => {
                                  if (imgSrc) {
                                    setViewingZoomImage({ url: imgSrc, name: img.name, size: img.size });
                                  }
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 flex items-center justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                                <span className="text-[11px] text-white truncate max-w-[130px] font-medium drop-shadow">
                                  {img.name}
                                </span>
                                <button
                                  type="button"
                                  className="p-1 rounded-md bg-black/40 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                                  title="Tải ảnh về máy"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFileSafely(imgDownload, img.name);
                                  }}
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )
                    )}

                    {/* Attached Videos - Native high-performance inline video player */}
                    {videoAttachments.length > 0 && (
                      <div className="space-y-2 mt-1.5">
                        {videoAttachments.map((vid, idx) => {
                          const viewUrl = vid.url 
                            ? (vid.url.includes('/api/telegram/download') 
                                ? (vid.url.includes('inline=true') ? vid.url : vid.url + '&inline=true') 
                                : vid.url.replace('/api/files/download/', '/api/files/view/')) 
                            : '';
                          const vidSrc = vid.data || viewUrl || vid.url;
                          const vidDownload = vid.url 
                            ? vid.url.replace('/api/files/view/', '/api/files/download/').replace('&inline=true', '') 
                            : vid.data;
                          return (
                            <div key={idx} className="rounded-xl overflow-hidden bg-black/75 border border-slate-700/80 shadow-md">
                              <div className="relative group/vid bg-black max-h-80 w-full flex items-center justify-center">
                                <video
                                  src={vidSrc}
                                  controls
                                  preload="metadata"
                                  playsInline
                                  className="w-full max-h-80 object-contain rounded-t-xl"
                                />
                              </div>
                              <div className="p-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  <Film className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate max-w-[200px]">{vid.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{formatFileSize(vid.size)} • Video</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => downloadFileSafely(vidDownload, vid.name)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-white transition-colors shrink-0 cursor-pointer shadow-sm"
                                  title="Tải video về máy"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Non-image File Attachments */}
                    {otherAttachments.length > 0 && (
                      <div className="space-y-1">
                        {otherAttachments.map((file, idx) => {
                          const fileHref = file.url || file.data;
                          return (
                          <div 
                            key={idx} 
                            className={`rounded-xl p-2.5 flex items-center justify-between gap-3 ${
                              isMe ? 'bg-emerald-700/60 border border-emerald-500/30' : 'bg-slate-900/90 border border-slate-700/80'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-2.5">
                              <FileDocIcon fileName={file.name} mimeType={file.type} size="sm" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate text-white">{file.name}</p>
                                <p className="text-[10px] opacity-80">
                                  {formatFileSize(file.size)} • {getDocumentTypeInfo(file.name, file.type).label}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadFileSafely(fileHref, file.name)}
                              className="p-1.5 rounded-lg bg-black/25 hover:bg-emerald-600 text-white transition-colors shrink-0 shadow-sm cursor-pointer"
                              title="Tải tệp"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                        })}
                      </div>
                    )}

                    {/* Text Message with full highlight & selection support */}
                    {msg.text && (
                      <div 
                        className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full chat-message-text select-text cursor-text [user-select:text] selection:bg-emerald-500 selection:text-slate-950"
                        data-chat-message="true"
                      >
                        {renderClickableText(getCachedCleanMessageText(msg.text), isMe)}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </>
      );
    })()}
          <div ref={messagesEndRef} />

          {/* Quick Jump to Bottom Floating Button */}
          {showScrollBottomBtn && (
            <button
              id="scroll-to-bottom-btn"
              type="button"
              onClick={() => scrollToBottom(true)}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-800/95 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500 shadow-xl shadow-black/40 text-xs font-semibold backdrop-blur-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-150 z-20 cursor-pointer"
              title="Cuộn xuống tin nhắn mới nhất"
            >
              <ChevronDown className="w-4 h-4 text-emerald-400 hover:text-white animate-bounce" />
              <span>Tin nhắn mới nhất</span>
            </button>
          )}
        </div>

        {/* Multiple File/Image Preview Bar directly above input */}
        {attachments.length > 0 && (
          <div className="px-4 py-3 bg-slate-950/95 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Đã chọn {attachments.length} ảnh/tệp ({formatFileSize(attachments.reduce((acc, cur) => acc + cur.size, 0))})
              </span>
              <button
                type="button"
                onClick={() => setAttachments([])}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                Xóa tất cả
              </button>
            </div>

            {/* Horizontal Scrollable Thumbnails */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5">
              {attachments.map((att, idx) => {
                const isImg = isImageFile(att);
                const isVid = isVideoFile(att);
                const viewUrl = att.url ? att.url.replace('/api/files/download/', '/api/files/view/') : '';
                const displaySrc = att.data || viewUrl;
                return (
                  <div 
                    key={idx} 
                    className="relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/40 shadow-md flex items-center justify-center"
                  >
                    {isImg && displaySrc ? (
                      <img 
                        src={displaySrc} 
                        alt={att.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : isVid ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-slate-900/90 text-emerald-400">
                        <Film className="w-6 h-6 text-emerald-400 mb-1" />
                        <span className="text-[9px] text-slate-300 truncate w-full px-1 font-medium">{att.name}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-slate-900">
                        <FileDocIcon fileName={att.name} mimeType={att.type} size="sm" />
                        <span className="text-[9px] text-slate-300 truncate w-full px-1 mt-1 font-medium">{att.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      title="Xóa tệp này"
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-950/80 hover:bg-rose-600 text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Moderation Warning Toast/Banner (Roblox-styled cyan italic message box as in image) */}
        {moderationWarning && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-[#020712] border border-[#1e3a5f] text-cyan-300 italic text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="font-sans italic text-cyan-300 leading-relaxed break-words">{moderationWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setModerationWarning(null)}
              className="p-1 rounded-lg hover:bg-cyan-500/20 text-slate-400 hover:text-white shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Self-Destruct Active Indicator Banner */}
        {selfDestructMode !== 'off' && (
          <div className="mx-4 mb-2 px-3.5 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-200 text-xs flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
              <span>
                Chế độ Ảnh tự hủy đang bật:{' '}
                <strong className="text-orange-300">
                  {selfDestructMode === 'view_once' ? 'Xem 1 lần rồi biến mất vĩnh viễn' : `Tự tiêu hủy sau ${selfDestructMode === '10s' ? '10 giây' : '30 giây'}`}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelfDestructMode('off')}
              className="text-orange-400 hover:text-white font-semibold underline text-xs"
            >
              Tắt tự hủy
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-slate-800 bg-slate-950/80 shrink-0">
          {isDevUser(currentUser?.email) && (
            <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] sm:text-[11px] text-amber-300 bg-gradient-to-r from-amber-500/20 via-emerald-500/10 to-transparent border-b border-amber-500/30 font-medium flex-wrap">
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse shrink-0" />
              <span>Gửi tin với tư cách:</span>
              <span className="font-extrabold bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
                {(userProfile?.displayName || currentUser?.displayName || settings.deviceName || 'Admin').trim()} (DEV)
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                👑 DEV CHÍNH CHỦ
              </span>
              <span className="text-[10px] text-emerald-400/90 ml-auto hidden md:inline font-mono">
                ✨ Trang trí vương miện & viền vàng như DEV Datastore
              </span>
            </div>
          )}

          <div className="p-2 sm:p-3 space-y-1.5">
            {/* Typing Indicator & Character Count */}
            {inputText.trim().length > 0 && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                  </span>
                  <span className="italic">{t('chat.composing')}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {inputText.length} {currentLang === 'en' ? (inputText.length === 1 ? 'character' : 'characters') : t('chat.characters')}
                </span>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-1.5 sm:gap-2">
              {/* Hidden general file input (multiple enabled) */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => e.target.files && processAndAttachFiles(e.target.files)}
                className="hidden"
              />
              
              {/* Hidden dedicated image input (supports phone photos, iPhone HEIC/HEIF, RAW) */}
              <input
                type="file"
                multiple
                accept="image/*,.heic,.heif,.dng,.raw"
                ref={imageInputRef}
                onChange={(e) => e.target.files && processAndAttachFiles(e.target.files)}
                className="hidden"
              />

              {/* Hidden dedicated video input (MP4, WebM, MOV, MKV, AVI, etc.) */}
              <input
                type="file"
                multiple
                accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.3gp,.flv,.wmv,.ts,.ogv"
                ref={videoInputRef}
                onChange={(e) => e.target.files && processAndAttachFiles(e.target.files)}
                className="hidden"
              />

              {/* Quick Image Picker Button */}
              <button
                id="attach-image-btn"
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Chọn một hoặc nhiều ảnh để gửi (hỗ trợ tới 250MB hoặc kéo thả / dán Ctrl+V)"
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-colors shrink-0"
              >
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Dedicated Video Picker Button */}
              <button
                id="attach-video-btn"
                type="button"
                onClick={() => videoInputRef.current?.click()}
                title="Chọn một hoặc nhiều video để gửi (hỗ trợ MP4, WebM, MOV, MKV... lên tới 2GB)"
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-colors shrink-0"
              >
                <Film className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* General File Attachment Button */}
              <button
                id="attach-file-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={currentLang === 'en' ? "Attach files from computer / phone (up to 2GB)" : "Đính kèm tệp tin từ máy tính / điện thoại (tài liệu, ZIP, ứng dụng...)"}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0 cursor-pointer"
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Cloud Drive File Picker Button */}
              <button
                id="attach-cloud-btn"
                type="button"
                onClick={() => setIsCloudPickerOpen(true)}
                title={currentLang === 'en' ? "Attach files from Cloud Drive (zero upload bandwidth)" : "Chọn tệp từ Kho Cloud (gửi ngay không tốn dung lượng upload)"}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-sky-400 border border-slate-700 hover:border-sky-500/40 transition-all shrink-0 cursor-pointer group"
              >
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              </button>

              {/* Smart Rich Input with WYSIWYG Bold / Italic / Code & Gliding Neon Caret */}
              <div className="flex-1 relative min-w-0">
                <RichChatInput
                  id="chat-message-input"
                  ref={richInputRef}
                  value={inputText}
                  onChange={(md, _plain) => {
                    setInputText(md);
                    try {
                      if (md.trim()) {
                        localStorage.setItem(`cloudsend_chat_draft_${activeRoomId}`, md);
                      } else {
                        localStorage.removeItem(`cloudsend_chat_draft_${activeRoomId}`);
                      }
                    } catch {}
                  }}
                  onSend={(text) => handleSendMessage(undefined, text)}
                  onPasteFiles={processAndAttachFiles}
                  onSelectionChange={setHasSelection}
                  onFormatNotice={(notice) => {
                    setFormatNotice(notice);
                    setTimeout(() => setFormatNotice(null), 2500);
                  }}
                  enterKeyMode={enterKeyMode}
                  disabled={false}
                  placeholder={t('chat.placeholder')}
                  className="smooth-input"
                />
              </div>

              {/* Send Button (INP Optimized < 16ms) */}
              <button
                id="send-message-btn"
                type="submit"
                disabled={(!inputText.trim() && attachments.length === 0) || isCompressing}
                className="p-2 sm:p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white will-change-transform transform-gpu select-none transition-transform duration-75 ease-out active:scale-95 active:opacity-90 shadow-md shrink-0"
                style={{ transform: 'translateZ(0)', contain: 'layout paint' }}
                title={t('chat.send_btn')}
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessagesSquare className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">{t('chat.create_room_title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* Ảnh đại diện & Biểu tượng nhóm */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {t('chat.avatar_label')}
                </label>
                <div 
                  className={`flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border transition-all ${
                    isDraggingAvatar ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-950/30' : 'border-slate-800'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingAvatar(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingAvatar(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingAvatar(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setNewRoomAvatar(ev.target?.result as string);
                      };
                      reader.readAsDataURL(files[0]);
                    }
                  }}
                >
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0 border border-white/10 overflow-hidden relative"
                    style={{ backgroundColor: newRoomColor }}
                  >
                    {newRoomAvatar ? (
                      <img src={newRoomAvatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(newRoomName.trim() || 'R').charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-1.5 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        {t('chat.upload_photo')}
                        <input 
                          type="file" 
                          accept="image/*" 
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
                      {newRoomAvatar && (
                        <button
                          type="button"
                          onClick={() => setNewRoomAvatar('')}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors"
                        >
                          {t('chat.use_default_icon')}
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {t('chat.drag_hint')}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 mr-1">{t('chat.bg_color')}</span>
                      {ROOM_PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewRoomColor(col)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newRoomColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dòng 1: Tên phòng */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {t('chat.name_label')}
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder={t('chat.name_placeholder')}
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Chế độ phòng: Luôn là phòng riêng tư */}
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200 flex items-start gap-3">
                <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span>{t('chat.private_room')}</span>
                    <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[10px] rounded border border-purple-500/30">{t('chat.default')}</span>
                  </p>
                  <p className="text-[11px] text-purple-300/80 leading-relaxed">
                    {t('chat.private_desc')}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t('chat.owner_badge')}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  {t('chat.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  {t('chat.create_now')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          }}
          onRoomLeft={() => {
            setActiveRoomId('public-relay-lounge');
          }}
        />
      )}

      {/* Safe Self-Destruct Image Viewer Modal */}
      {activeDestructMessage && (
        <SelfDestructViewerModal
          isOpen={!!activeDestructMessage}
          message={activeDestructMessage}
          onClose={() => setActiveDestructMessage(null)}
          onDestruct={handleDeleteMessage}
        />
      )}

      {/* Community Rules & Conduct Modal */}
      {showRules && (
        <RulesModal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
        />
      )}

      {/* Report Message to DEV Modal */}
      {reportingMessage && activeRoom && currentUser && (
        <ReportMessageModal
          isOpen={!!reportingMessage}
          onClose={() => setReportingMessage(null)}
          message={reportingMessage}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={currentUser.uid}
          currentUserName={userProfile?.displayName || settings?.deviceName || 'Người dùng'}
        />
      )}

      {/* General Room Incident / Violation Report Modal */}
      {showRoomReportModal && activeRoom && currentUser && (
        <ReportIncidentModal
          isOpen={showRoomReportModal}
          onClose={() => setShowRoomReportModal(false)}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={currentUser.uid}
          currentUserName={userProfile?.displayName || settings?.deviceName || 'Người dùng'}
        />
      )}

      {/* Zoomable Image Viewer Modal for full-screen photo viewing */}
      {viewingZoomImage && (
        <ZoomableImageViewerModal
          isOpen={Boolean(viewingZoomImage)}
          onClose={() => setViewingZoomImage(null)}
          imageUrl={viewingZoomImage.url}
          imageName={viewingZoomImage.name || 'Hình ảnh'}
          fileSize={viewingZoomImage.size}
        />
      )}

      {/* Discord-style User Profile Modal */}
      {selectedProfileUser && (
        <UserProfileModal 
          user={selectedProfileUser} 
          anchorPosition={profileAnchor}
          onClose={() => { setSelectedProfileUser(null); setProfileAnchor(null); }} 
        />
      )}

      {/* DEV Server Reset Modal */}
      {activeRoom && (
        <ResetServerModal
          isOpen={showResetServerModal}
          onClose={() => setShowResetServerModal(false)}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          totalMessagesCount={messages.length}
          isAutoWeeklyEnabled={Boolean((activeRoom as any)?.autoWeeklyReset)}
        />
      )}

      {/* Cloud Drive Picker Modal */}
      <CloudDrivePickerModal
        isOpen={isCloudPickerOpen}
        onClose={() => setIsCloudPickerOpen(false)}
        onSelectFiles={handleCloudFilesSelected}
        alreadySelectedUrls={attachments.filter(a => a.url).map(a => a.url!)}
      />
    </div>
  );
};

export const ChatRoomView = React.memo(ChatRoomViewComponent);
