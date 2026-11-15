import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Database, 
  PanelTop, 
  PanelLeft, 
  PanelRight, 
  Layers, 
  FileText, 
  Code2, 
  SlidersHorizontal,
  MessageSquare,
  Users,
  AlertTriangle,
  Ban,
  Megaphone,
  CheckCircle2,
  Globe,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Clock,
  Radio,
  Send,
  Eye,
  Trash2,
  Monitor,
  Smartphone,
  ExternalLink,
  Info,
  Check,
  Flame,
  VolumeX,
  Filter,
  Crown,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  X,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Flag,
  Paperclip,
  Camera,
  Copy,
  Bot,
  Laptop,
  Tv,
  Tablet,
  Bell
} from 'lucide-react';
import { 
  collection, 
  collectionGroup,
  where,
  onSnapshot, 
  doc, 
  deleteDoc, 
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { ChatRoom, UserDevice, UserSanction, ChatMessage, ContentReport, ChatAttachment, DeviceType } from './types';
import { formatFileSize } from '../utils/device';
import { 
  isDevUser, 
  DEV_EMAIL, 
  SANCTION_TIERS, 
  applyTierSanction, 
  applyLinkedBanSanction,
  removeDevSanction,
  sendPrivateDevNotification, 
  callAiAuditUser, 
  evaluateUserWith12Rules,
  AiEvaluationResult 
} from '../utils/devModeration';
import { 
  uploadFileToServer, 
  generateImageThumbnail, 
  MAX_FILE_SIZE 
} from '../utils/fileUpload';
import { unwrapSecureBase64Message } from '../utils/base64Security';
import { DataStorageAvatarsModal } from './DataStorageAvatars';

interface DevDatastorePageProps {
  onBackToApp?: () => void;
}

type ManagementTask = 'rooms_users' | 'violators_banned' | 'broadcast' | 'reports';

// Interface cho đối tượng vi phạm
interface ViolatorRecord {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  avatarColor: string;
  violationType: 'profanity' | 'spam' | 'severe' | 'file';
  violationReason: string;
  violationCount: number;
  detectedAt: string;
  evidenceText?: string;
  status: 'active_warning' | 'reviewed';
}

// Interface cho thông báo máy chủ
interface BroadcastRecord {
  id: string;
  title: string;
  message: string;
  type: 'emergency' | 'maintenance' | 'news';
  senderName: string;
  createdAt: string;
  active: boolean;
}

interface ViolationIncident {
  id: string;
  roomId: string;
  roomName: string;
  roomCode?: string;
  senderId?: string;
  senderName?: string;
  senderDevice?: string;
  createdAt?: string;
  timestamp?: number;
  content: string;
  reason: string;
  source: 'openai_moderation' | 'word_filter' | 'user_report' | 'sanction';
  severity: 'light' | 'medium' | 'heavy' | 'critical';
}

const DEFAULT_GLOBAL_LOUNGE_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23064e3b" stroke="%2310b981" stroke-width="3"/><circle cx="50" cy="50" r="38" fill="%23047857"/><ellipse cx="50" cy="50" rx="18" ry="38" fill="none" stroke="%2334d399" stroke-width="2.5"/><line x1="12" y1="50" x2="88" y2="50" stroke="%2334d399" stroke-width="2.5"/><path d="M20 30 Q50 38 80 30" fill="none" stroke="%236ee7b7" stroke-width="2"/><path d="M20 70 Q50 62 80 70" fill="none" stroke="%236ee7b7" stroke-width="2"/></svg>`;

export const DevDatastorePage: React.FC<DevDatastorePageProps> = ({ onBackToApp }) => {
  const { currentUser, settings } = useAuth();
  
  // 1. Tác vụ được chọn trên Thanh Điều Khiển
  const [activeTask, setActiveTask] = useState<ManagementTask>('rooms_users');
  const [roomsUsersSubTab, setRoomsUsersSubTab] = useState<'rooms' | 'users'>('rooms');
  const [violatorsBannedSubTab, setViolatorsBannedSubTab] = useState<'violators' | 'banned'>('violators');

  // 2. Các bộ lọc tương ứng trong "Khung 2" (Bên Trái)
  const [roomFilter, setRoomFilter] = useState<'all' | 'public' | 'private' | 'violating'>('all');
  const [roomViolationSeverity, setRoomViolationSeverity] = useState<'all' | 'light' | 'medium' | 'heavy' | 'critical'>('all');
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline' | 'violating'>('all');
  const [userViolationSeverity, setUserViolationSeverity] = useState<'all' | 'light' | 'medium' | 'heavy' | 'critical'>('all');
  const [violatorFilter, setViolatorFilter] = useState<'all' | 'light' | 'medium' | 'heavy' | 'critical'>('all');
  const [violatorTarget, setViolatorTarget] = useState<'users' | 'rooms'>('users');
  const [bannedFilter, setBannedFilter] = useState<'all' | 'perm' | 'temp' | 'muted'>('all');
  const [broadcastFilter, setBroadcastFilter] = useState<'all' | 'emergency' | 'maintenance' | 'news'>('all');
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

  // 3. Tìm kiếm và mục đang chọn ở Khung 3 để xem ở Khung 4
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Form soạn thông báo toàn máy chủ (Tác vụ 5)
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState<'emergency' | 'maintenance' | 'news'>('emergency');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // State dữ liệu thực tế từ Firestore
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [onlinePresence, setOnlinePresence] = useState<UserDevice[]>([]);
  const [sanctions, setSanctions] = useState<UserSanction[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);

  // State chuyên biệt cho Tác vụ 1. Các Phòng Chat (Live Chat & Giám sát)
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [devInputText, setDevInputText] = useState('');
  const [devAttachments, setDevAttachments] = useState<ChatAttachment[]>([]);
  const [isSendingDevMessage, setIsSendingDevMessage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [roomDetailsTab, setRoomDetailsTab] = useState<'chat' | 'users' | 'messages' | 'images'>('chat');
  const [auditFilter, setAuditFilter] = useState<'all' | 'deleted' | 'warned'>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [roomMsgSearchQuery, setRoomMsgSearchQuery] = useState('');
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const devFileInputRef = useRef<HTMLInputElement>(null);
  const devImageInputRef = useRef<HTMLInputElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [showStorageAvatarsModal, setShowStorageAvatarsModal] = useState(false);

  // State chuyên biệt cho Tác vụ 2. Những Người Dùng (Quản trị, Thiết bị, Thông báo riêng, Kỷ luật AI)
  const [firestoreUsers, setFirestoreUsers] = useState<any[]>([]);
  const [userDetailsTab, setUserDetailsTab] = useState<'info' | 'messages'>('info');
  const [privateMsgText, setPrivateMsgText] = useState('');
  const consecutiveEnterCountRef = useRef<number>(0);
  const [privateNotifStatus, setPrivateNotifStatus] = useState<string | null>(null);
  const [isSendingPrivateNotif, setIsSendingPrivateNotif] = useState(false);
  const [sentPrivateNotifs, setSentPrivateNotifs] = useState<any[]>([]);
  const [aiAuditResult, setAiAuditResult] = useState<AiEvaluationResult | null>(null);
  const [isAiAuditing, setIsAiAuditing] = useState(false);
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [copiedUid, setCopiedUid] = useState(false);

  // State Kiểm Duyệt Hàng Loạt bằng OpenAI Moderation
  const [openAiAuditResults, setOpenAiAuditResults] = useState<Record<string, {
    severity: 'light' | 'medium' | 'heavy' | 'critical';
    reason: string;
    source: string;
    categories?: string[];
    auditedAt: string;
    evidenceMessages?: ViolationIncident[];
  }>>({});
  const [violationIncidentsMap, setViolationIncidentsMap] = useState<Record<string, ViolationIncident[]>>({});
  const [isLoadingViolationDetails, setIsLoadingViolationDetails] = useState(false);
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);
  const [batchAuditSummary, setBatchAuditSummary] = useState<{
    totalScanned: number;
    flaggedCount: number;
    source: string;
    timestamp: string;
  } | null>(null);

  // Tùy chỉnh thông điệp nhắc nhở Roblox cho 5 cấp độ (DEV có thể tự chỉnh văn bản gửi đi bất kỳ lúc nào)
  const [sanctionCustomNotes, setSanctionCustomNotes] = useState<Record<string, string>>({
    level_1: SANCTION_TIERS.level_1.remind,
    level_2: SANCTION_TIERS.level_2.remind,
    level_3: SANCTION_TIERS.level_3.remind,
    level_4: SANCTION_TIERS.level_4.remind,
    level_perm: SANCTION_TIERS.level_perm.remind
  });
  const [sanctionCustomReason, setSanctionCustomReason] = useState<string>('');
  const [sanctionCustomRule, setSanctionCustomRule] = useState<string>('Tiêu Chuẩn & Nội Quy Cộng Đồng');
  const [sanctionCustomOffensiveItem, setSanctionCustomOffensiveItem] = useState<string>('');

  // Lắng nghe thông báo riêng và tin nhắn của người dùng đang được chọn thời gian thực
  useEffect(() => {
    if (activeTask !== 'rooms_users' || roomsUsersSubTab !== 'users' || !selectedItemId) {
      setUserMessages([]);
      setSentPrivateNotifs([]);
      setAiAuditResult(null);
      setPrivateMsgText('');
      consecutiveEnterCountRef.current = 0;
      return;
    }

    // 1. Lắng nghe thông báo riêng đã gửi cho người này
    const qNotifs = query(
      collection(db, 'user_notifications'),
      where('targetUid', '==', selectedItemId),
      limit(50)
    );
    const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setSentPrivateNotifs(list);
    }, (err) => {
      console.warn('Lỗi đọc user_notifications:', err);
    });

    // 2. Lắng nghe/truy vấn tin nhắn của người dùng này
    // Lưu ý: Truy vấn trực tiếp các phòng đang có để tránh lỗi COLLECTION_GROUP_ASC index của Firestore
    const roomMsgUnsubs: (() => void)[] = [];
    const userMsgMap = new Map<string, ChatMessage>();

    const updateUserMsgList = () => {
      const list = Array.from(userMsgMap.values());
      list.sort((a, b) => {
        const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tA - tB;
      });
      setUserMessages(list);
    };

    const targetRoomIds = Array.from(new Set(['public-relay-lounge', ...rooms.map(r => r.id)]));
    
    // Lắng nghe tin nhắn của người dùng qua các phòng đang hoạt động (không cần COLLECTION_GROUP index)
    targetRoomIds.forEach((rId) => {
      try {
        const qRoom = query(
          collection(db, 'rooms', rId, 'messages'),
          where('senderId', '==', selectedItemId),
          limit(50)
        );
        const unsub = onSnapshot(qRoom, (snap) => {
          snap.docs.forEach((d) => {
            userMsgMap.set(d.id, { id: d.id, ...d.data() } as ChatMessage);
          });
          updateUserMsgList();
        }, (err) => {
          // Bỏ qua lỗi phòng không tồn tại hoặc quyền truy cập
        });
        roomMsgUnsubs.push(unsub);
      } catch (err) {
        // Safe catch
      }
    });

    return () => {
      unsubNotifs();
      roomMsgUnsubs.forEach(u => u());
    };
  }, [activeTask, selectedItemId, rooms]);

  // Lắng nghe tin nhắn phòng chat đang được chọn thời gian thực (Bao gồm lưu trữ vĩnh viễn không bị mất khi Client xóa)
  useEffect(() => {
    if (activeTask !== 'rooms_users' || roomsUsersSubTab !== 'rooms' || !selectedItemId) {
      setRoomMessages([]);
      return;
    }

    const map = new Map<string, ChatMessage>();

    const updateCombined = () => {
      const list = Array.from(map.values());
      list.sort((a, b) => {
        const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tA - tB;
      });
      setRoomMessages(list);
    };

    // 1. Lắng nghe subcollection 'messages' thông thường
    const messagesRef = collection(db, 'rooms', selectedItemId, 'messages');
    const qMsgs = query(messagesRef, orderBy('createdAt', 'asc'), limit(300));
    const unsubMsgs = onSnapshot(qMsgs, (snapshot) => {
      // Khi client xóa (change.type === 'removed') -> giữ lại trong DEV với cờ isDeletedBySender
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          const existing = map.get(change.doc.id);
          if (existing) {
            map.set(change.doc.id, {
              ...existing,
              deletedBySender: true,
              isDeletedBySender: true,
              deletedAt: new Date().toISOString()
            });
          }
        }
      });

      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ChatMessage;
        const existing = map.get(docSnap.id);
        map.set(docSnap.id, {
          ...existing,
          ...d,
          id: docSnap.id
        });
      });
      updateCombined();
    }, (err) => {
      console.warn('Lỗi đọc tin nhắn phòng trong DataStore:', err);
    });

    // 2. Lắng nghe subcollection 'audit_messages' (Kho lưu trữ kiểm toán vĩnh viễn không bao giờ xóa)
    const auditRef = collection(db, 'rooms', selectedItemId, 'audit_messages');
    const qAudit = query(auditRef, orderBy('createdAt', 'asc'), limit(300));
    const unsubAudit = onSnapshot(qAudit, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as ChatMessage;
        const existing = map.get(docSnap.id);
        map.set(docSnap.id, {
          ...existing,
          ...d,
          id: docSnap.id
        });
      });
      updateCombined();
    }, () => {
      // Bỏ qua nếu audit collection chưa có tài liệu
    });

    return () => {
      unsubMsgs();
      unsubAudit();
    };
  }, [activeTask, selectedItemId]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới trong phòng
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [roomMessages]);

  // Lắng nghe dữ liệu thời gian thực từ Firestore
  useEffect(() => {
    // 1. Phòng chat
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list: ChatRoom[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom));
      setRooms(list);
    }, (err) => {
      console.warn('Lỗi đọc rooms Firestore:', err);
    });

    // 2. Presence thiết bị online
    const unsubPresence = onSnapshot(collection(db, 'presence'), (snap) => {
      const list: UserDevice[] = snap.docs.map(d => ({ ...d.data() } as UserDevice));
      setOnlinePresence(list);
    }, (err) => {
      console.warn('Lỗi đọc presence Firestore:', err);
    });

    // 3. Sanctions / Banned users
    const unsubSanctions = onSnapshot(collection(db, 'sanctions'), (snap) => {
      const rawList: UserSanction[] = snap.docs.map(d => ({ ...d.data() } as UserSanction));
      const map = new Map<string, UserSanction>();
      rawList.forEach(item => {
        const key = item.uid || (item.email ? item.email.toLowerCase() : '');
        if (key) {
          if (!map.has(key) || (item.bannedAt && !map.get(key)?.bannedAt)) {
            map.set(key, item);
          }
        }
      });
      setSanctions(Array.from(map.values()));
    }, (err) => {
      console.warn('Lỗi đọc sanctions Firestore:', err);
    });

    // 4. Broadcasts
    const unsubBroadcasts = onSnapshot(collection(db, 'system_broadcasts'), (snap) => {
      const list: BroadcastRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as BroadcastRecord));
      setBroadcasts(list);
    }, () => {});

    // 5. Reports (Tố cáo vi phạm từ người dùng)
    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      const list: ContentReport[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentReport));
      list.sort((a, b) => {
        const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA; // Mới nhất lên đầu
      });
      setReports(list);
    }, (err) => {
      console.warn('Lỗi đọc reports Firestore:', err);
    });

    // 6. Users profiles (Người dùng thực tế trong hệ thống)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFirestoreUsers(list);
    }, (err) => {
      console.warn('Lỗi đọc users Firestore:', err);
    });

    return () => {
      unsubRooms();
      unsubPresence();
      unsubSanctions();
      unsubBroadcasts();
      unsubReports();
      unsubUsers();
    };
  }, []);

  // Hàm kiểm tra xem người dùng có ĐANG THẬT SỰ ONLINE không (Text check chuẩn)
  const evaluateOnlineStatus = (lastSeen?: string, status?: string) => {
    if (!lastSeen) {
      return {
        isOnline: false,
        badgeText: '⚪ Ngoại tuyến (Offline)',
        detailText: 'Chưa có tín hiệu hoạt động gần đây',
        color: 'text-slate-400 bg-slate-800/80 border-slate-700'
      };
    }

    const seenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const diffSeconds = Math.floor((now - seenTime) / 1000);

    // Thời gian sống của web/phiên là 3 phút (180 giây) chuẩn như Facebook
    // Trong vòng 3 phút nếu không có tín hiệu phản hồi mới chấp nhận là ngoại tuyến (offline)
    if (diffSeconds <= 180 && status !== 'offline') {
      return {
        isOnline: true,
        badgeText: '🟢 Đang Online (Thời gian sống 3p)',
        detailText: diffSeconds < 60 ? `Tín hiệu sống (${diffSeconds}s trước)` : `Tín hiệu sống (${Math.floor(diffSeconds / 60)}p trước)`,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      };
    } else if (diffSeconds < 600) {
      const mins = Math.max(1, Math.floor(diffSeconds / 60));
      return {
        isOnline: false,
        badgeText: '🟡 Vừa hoạt động',
        detailText: `Cách đây ${mins} phút trước`,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      };
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return {
        isOnline: false,
        badgeText: '⚪ Ngoại tuyến (Offline)',
        detailText: hours > 0 ? `Đã thoát ${hours} giờ trước` : 'Không hoạt động',
        color: 'text-slate-400 bg-slate-800/60 border-slate-700/60'
      };
    }
  };

  // Danh sách Người Dùng Vi Phạm (tổng hợp từ hệ thống kiểm tra và mẫu kiểm toán)
  const violatorsList = useMemo<ViolatorRecord[]>(() => {
    const list: ViolatorRecord[] = [
      {
        id: 'violator-1',
        uid: 'demo-violator-01',
        displayName: 'SpamBot_User',
        email: 'spammer_pro@test.net',
        avatarColor: '#f43f5e',
        violationType: 'spam',
        violationReason: 'Gửi 18 tin nhắn trong 2 giây vào phòng công khai',
        violationCount: 2,
        detectedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        evidenceText: 'spam link join now http://spam...',
        status: 'active_warning'
      },
      {
        id: 'violator-2',
        uid: 'demo-violator-02',
        displayName: 'ToxicPlayer_99',
        email: 'toxic99@badmail.com',
        avatarColor: '#ea580c',
        violationType: 'profanity',
        violationReason: 'Sử dụng từ ngữ xúc phạm người dùng khác trong đoạn chat',
        violationCount: 1,
        detectedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        evidenceText: 'phát hiện chuỗi từ khóa vi phạm tiêu chuẩn cộng đồng',
        status: 'active_warning'
      },
      {
        id: 'violator-3',
        uid: 'demo-violator-03',
        displayName: 'Trojan_DropX',
        email: 'attacker_x@darknode.org',
        avatarColor: '#dc2626',
        violationType: 'severe',
        violationReason: 'Gửi tệp đính kèm mã độc hoặc vượt kích thước cho phép liên tục',
        violationCount: 3,
        detectedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        evidenceText: 'File payload.exe / script.bat detected',
        status: 'active_warning'
      }
    ];

    // Thêm các tài khoản có trong sanctions có trạng thái cảnh cáo
    sanctions.forEach(s => {
      if (!s.isBanned && s.violationCount > 0) {
        list.unshift({
          id: `sanction-${s.uid}`,
          uid: s.uid,
          displayName: s.displayName,
          email: s.email,
          avatarColor: '#f97316',
          violationType: s.violationCount >= 2 ? 'severe' : 'profanity',
          violationReason: s.reason || 'Vi phạm nội quy hệ thống',
          violationCount: s.violationCount,
          detectedAt: s.bannedAt || new Date().toISOString(),
          status: 'active_warning'
        });
      }
    });

    return list;
  }, [sanctions]);

  // Phân loại phòng chat: Public vs Private
  const publicRoomsCount = useMemo(() => rooms.filter(r => !r.isPrivate).length, [rooms]);
  const privateRoomsCount = useMemo(() => rooms.filter(r => !!r.isPrivate).length, [rooms]);

  // Dữ liệu danh sách người dùng hiển thị
  const evaluatedUsers = useMemo(() => {
    const userMap = new Map<string, any>();

    // 0. Nạp từ Firestore Users
    firestoreUsers.forEach(fu => {
      const uid = fu.uid || fu.id;
      if (uid) {
        userMap.set(uid, {
          id: uid,
          uid: uid,
          displayName: fu.displayName || fu.name || 'Người dùng',
          email: fu.email || '',
          deviceName: fu.deviceName || 'Thiết bị',
          deviceType: fu.deviceType || 'laptop',
          avatarColor: fu.avatarColor || '#10b981',
          createdAt: fu.createdAt || new Date().toISOString(),
          lastSeen: fu.lastSeen || fu.createdAt || new Date().toISOString(),
          status: fu.status || 'offline',
          onlineCheck: evaluateOnlineStatus(fu.lastSeen, fu.status),
          loggedDevices: fu.loggedDevices || fu.devices || [],
          ...fu
        });
      }
    });

    // 1. Nạp và đồng bộ từ onlinePresence (luôn giữ nguyên ảnh đại diện tùy chỉnh nếu đã có)
    onlinePresence.forEach(u => {
      const existing = userMap.get(u.uid);
      const syncedAvatar = (u as any).customAvatarUrl || existing?.customAvatarUrl || (u as any).avatarUrl || existing?.avatarUrl || (u as any).photoURL || existing?.photoURL;
      userMap.set(u.uid, {
        ...(existing || {}),
        id: u.uid,
        ...u,
        customAvatarUrl: (u as any).customAvatarUrl || existing?.customAvatarUrl || '',
        avatarUrl: (u as any).avatarUrl || existing?.avatarUrl || '',
        photoURL: (u as any).photoURL || existing?.photoURL || syncedAvatar || '',
        onlineCheck: evaluateOnlineStatus(u.lastSeen, u.status)
      });
    });

    // 2. Thêm hoặc đồng bộ avatar cho current user
    if (currentUser) {
      const existingCur = userMap.get(currentUser.uid);
      if (!existingCur) {
        userMap.set(currentUser.uid, {
          id: currentUser.uid,
          uid: currentUser.uid,
          email: currentUser.email || 'user@cloudsend.local',
          displayName: currentUser.displayName || 'Bạn (Current Device)',
          deviceName: settings.deviceName || 'Thiết bị của bạn',
          deviceType: settings.deviceType || 'laptop',
          avatarColor: settings.avatarColor || '#10b981',
          customAvatarUrl: settings.customAvatarUrl || currentUser.photoURL || '',
          photoURL: currentUser.photoURL || settings.customAvatarUrl || '',
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          status: 'online',
          onlineCheck: evaluateOnlineStatus(new Date().toISOString(), 'online')
        });
      } else {
        userMap.set(currentUser.uid, {
          ...existingCur,
          customAvatarUrl: settings.customAvatarUrl || existingCur.customAvatarUrl || currentUser.photoURL || '',
          photoURL: currentUser.photoURL || existingCur.photoURL || settings.customAvatarUrl || ''
        });
      }
    }

    // 3. Nạp tất cả người dùng và chủ phòng từ các phòng chat
    rooms.forEach(r => {
      const ownerId = r.ownerId || r.createdBy;
      if (ownerId && !userMap.has(ownerId)) {
        userMap.set(ownerId, {
          id: ownerId,
          uid: ownerId,
          displayName: r.ownerName || r.createdByName || 'Chủ phòng',
          email: '',
          deviceName: 'Thiết bị tạo phòng',
          avatarColor: '#f59e0b',
          createdAt: r.createdAt,
          lastSeen: r.createdAt,
          status: 'offline',
          onlineCheck: evaluateOnlineStatus(r.createdAt, 'offline')
        });
      }
      if (Array.isArray(r.members)) {
        r.members.forEach(m => {
          if (m.uid && !userMap.has(m.uid)) {
            userMap.set(m.uid, {
              id: m.uid,
              uid: m.uid,
              displayName: m.displayName || 'Thành viên',
              email: '',
              deviceName: m.deviceName || 'Thiết bị',
              avatarColor: m.avatarColor || '#10b981',
              createdAt: m.joinedAt || r.createdAt,
              lastSeen: m.joinedAt || r.createdAt,
              status: 'offline',
              onlineCheck: evaluateOnlineStatus(m.joinedAt || r.createdAt, 'offline')
            });
          }
        });
      }
    });

    return Array.from(userMap.values());
  }, [firestoreUsers, onlinePresence, currentUser, settings, rooms]);

  // Kiểm tra lệnh kỷ luật còn đang hiệu lực hay chỉ là bản ghi test đã hết hạn
  const checkSanctionActiveState = (s?: UserSanction | null) => {
    if (!s) return { activeBan: false, activeChatLock: false };
    const now = Date.now();
    const activeBan = !!(s.isBanned && (!s.banExpiresAt || new Date(s.banExpiresAt).getTime() > now));
    const activeChatLock = !!(s.isChatLocked && (!s.chatLockExpiresAt || new Date(s.chatLockExpiresAt).getTime() > now));
    return { activeBan, activeChatLock };
  };

  // Xử lý và tính toán mức độ vi phạm cho từng phòng chat thực tế (Nhẹ, Bình Thường, Nặng, Hết Cứu)
  const roomsWithViolations = useMemo(() => {
    const sevRank: Record<string, number> = { light: 1, medium: 2, heavy: 3, critical: 4 };
    return rooms.map(r => {
      // Chỉ tính báo cáo đang chờ xử lý (không tính báo cáo đã bỏ qua/đã giải quyết)
      const roomReps = reports.filter(rep => rep.roomId === r.id && rep.status === 'pending');
      let sev: 'light' | 'medium' | 'heavy' | 'critical' | undefined = undefined;
      let reason: string | undefined = undefined;

      if ((r as any).violationSeverity) {
        sev = (r as any).violationSeverity;
        reason = (r as any).violationReason;
      } else if (roomReps.length >= 5) {
        sev = 'critical';
        reason = `Bị tố cáo ${roomReps.length} lần (Mức độ hết cứu)`;
      } else if (roomReps.length >= 3) {
        sev = 'heavy';
        reason = `Bị tố cáo ${roomReps.length} lần liên tiếp`;
      } else if (roomReps.length >= 2) {
        sev = 'medium';
        reason = `Bị ${roomReps.length} người dùng gửi báo cáo vi phạm`;
      } else if (roomReps.length === 1) {
        sev = 'light';
        reason = `Bị 1 báo cáo: ${roomReps[0].reason || 'Nội quy phòng'}`;
      }

      const aiRes = openAiAuditResults[r.id];
      if (aiRes) {
        if (!sev || (sevRank[aiRes.severity] || 0) >= (sevRank[sev] || 0)) {
          sev = aiRes.severity;
        }
        reason = reason ? `${aiRes.reason} • ${reason}` : aiRes.reason;
      }

      const cachedIncidents = violationIncidentsMap[r.id] || [];

      return {
        ...r,
        violationSeverity: sev,
        violationReason: reason,
        violationCount: Math.max(roomReps.length, aiRes ? (aiRes.evidenceMessages?.length || 1) : 0, cachedIncidents.length),
        aiAuditedSource: aiRes?.source
      };
    });
  }, [rooms, reports, openAiAuditResults, violationIncidentsMap]);

  // Xử lý và tính toán người dùng vi phạm thực tế - Sắp xếp người dùng vi phạm nặng nhất lên ĐẦU danh sách
  const evaluatedUsersWithViolations = useMemo(() => {
    const severityWeight: Record<string, number> = {
      critical: 4,
      heavy: 3,
      medium: 2,
      light: 1
    };

    const mapped = evaluatedUsers.map(u => {
      // Chỉ tính các báo cáo đang chờ xử lý (pending)
      const userReps = reports.filter(r => r.senderId === u.uid && r.status === 'pending');
      const sanction = sanctions.find(s => s.uid === u.uid || (u.email && s.email?.toLowerCase() === u.email.toLowerCase()));
      const { activeBan, activeChatLock } = checkSanctionActiveState(sanction);
      const aiRes = !isDevUser(u.email) ? openAiAuditResults[u.uid] : undefined;
      const msgEvidenceCount = (aiRes?.evidenceMessages?.length || 0) + ((violationIncidentsMap[u.uid] || []).filter(i => i.source === 'openai_moderation' || i.source === 'word_filter').length);

      let sev: 'light' | 'medium' | 'heavy' | 'critical' | undefined = undefined;
      let reason: string | undefined = undefined;
      let count = userReps.length + (msgEvidenceCount > 0 ? msgEvidenceCount : 0);

      // 1. Lệnh cấm/khóa ĐANG CÒN HIỆU LỰC (không chụp mũ từ khóa test đã hết hạn)
      if (activeBan && sanction) {
        if (sanction.lastSanctionType === 'ban_perm') {
          sev = 'critical';
          reason = sanction.reason || 'Bị cấm vĩnh viễn (Hết cứu)';
        } else if (sanction.lastSanctionType === 'ban_6m' || sanction.lastSanctionType === 'ban_7d') {
          sev = 'heavy';
          reason = sanction.reason || 'Tài khoản đang bị tạm khóa dài hạn';
        } else {
          sev = 'heavy';
          reason = sanction.reason || 'Tài khoản đang bị tạm khóa';
        }
        count = Math.max(count, 1);
      } else if (activeChatLock && sanction) {
        sev = sanction.lastSanctionType === 'chat_lock_1h' ? 'medium' : 'light';
        reason = sanction.reason || 'Đang trong thời gian khóa chat';
        count = Math.max(count, 1);
      }

      // 2. Báo cáo tố cáo đang chờ xử lý
      if (userReps.length >= 5) {
        sev = 'critical';
        reason = reason ? `${reason} • ${userReps.length} tố cáo chờ xử lý` : `Bị tố cáo ${userReps.length} lần`;
      } else if (userReps.length >= 3 && sev !== 'critical') {
        sev = 'heavy';
        reason = reason ? `${reason} • ${userReps.length} tố cáo` : `Bị tố cáo ${userReps.length} lần`;
      } else if (userReps.length >= 2 && (!sev || sev === 'light')) {
        sev = 'medium';
        reason = reason ? `${reason} • ${userReps.length} tố cáo` : `Có ${userReps.length} lượt tố cáo cộng đồng`;
      } else if (userReps.length === 1 && !sev) {
        sev = 'light';
        reason = userReps[0].reason || 'Có 1 báo cáo chờ kiểm tra';
      }

      // 3. Kết hợp kết quả OpenAI Moderation (bỏ qua tài khoản DEV)
      if (aiRes) {
        if (!sev || (severityWeight[aiRes.severity] || 0) >= (severityWeight[sev] || 0)) {
          sev = aiRes.severity;
        }
        reason = reason ? `${aiRes.reason} • ${reason}` : aiRes.reason;
        count = Math.max(count, aiRes.evidenceMessages?.length || 1);
      }

      // Xác định người dùng tái phạm nghiêm trọng nhất
      const isWorstViolator = !!(
        (activeBan && sanction?.lastSanctionType === 'ban_perm') ||
        (activeBan && sanction?.lastSanctionType === 'ban_7d' && count > 1) ||
        sev === 'critical' ||
        userReps.length >= 4
      );

      return {
        ...u,
        sanction,
        isActiveSanction: activeBan || activeChatLock,
        violationSeverity: sev,
        violationReason: reason,
        violationCount: count,
        isWorstViolator,
        aiAuditedSource: aiRes?.source
      };
    });

    // Sắp xếp ưu tiên: Người dùng tái phạm nặng nhất lên đầu -> tiếp theo theo trọng số vi phạm (critical > heavy > medium > light)
    mapped.sort((a, b) => {
      if (a.isWorstViolator !== b.isWorstViolator) {
        return a.isWorstViolator ? -1 : 1;
      }
      const weightA = a.violationSeverity ? severityWeight[a.violationSeverity] || 0 : 0;
      const weightB = b.violationSeverity ? severityWeight[b.violationSeverity] || 0 : 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return (b.violationCount || 0) - (a.violationCount || 0);
    });

    return mapped;
  }, [evaluatedUsers, reports, sanctions, openAiAuditResults, violationIncidentsMap]);

  // Danh sách người dùng tái phạm mức độ nặng nhất (cần xử lý cấm vĩnh viễn)
  const worstViolators = useMemo(() => {
    return evaluatedUsersWithViolations.filter(u => u.isWorstViolator && !isDevUser(u.email));
  }, [evaluatedUsersWithViolations]);

  const worstViolatorUser = useMemo(() => {
    return worstViolators[0] || evaluatedUsersWithViolations.find(u => (u.violationSeverity === 'heavy' || u.violationSeverity === 'critical') && !isDevUser(u.email)) || null;
  }, [worstViolators, evaluatedUsersWithViolations]);

  // Đếm số lượng theo từng mức độ vi phạm của phòng chat
  const countRoomSeverity = useMemo(() => {
    const res: Record<'all' | 'light' | 'medium' | 'heavy' | 'critical', number> = { all: 0, light: 0, medium: 0, heavy: 0, critical: 0 };
    roomsWithViolations.forEach(r => {
      if (r.violationSeverity && r.violationSeverity in res) {
        res.all++;
        res[r.violationSeverity as 'light' | 'medium' | 'heavy' | 'critical']++;
      }
    });
    return res;
  }, [roomsWithViolations]);

  // Đếm số lượng theo từng mức độ vi phạm của người dùng
  const countUserSeverity = useMemo(() => {
    const res: Record<'all' | 'light' | 'medium' | 'heavy' | 'critical', number> = { all: 0, light: 0, medium: 0, heavy: 0, critical: 0 };
    evaluatedUsersWithViolations.forEach(u => {
      if (u.violationSeverity && u.violationSeverity in res) {
        res.all++;
        res[u.violationSeverity as 'light' | 'medium' | 'heavy' | 'critical']++;
      }
    });
    return res;
  }, [evaluatedUsersWithViolations]);

  const verifiedOnlineUsersCount = useMemo(() => {
    return evaluatedUsersWithViolations.filter(u => u.onlineCheck?.isOnline).length;
  }, [evaluatedUsersWithViolations]);

  // Dữ liệu lọc cho Khung 3 (Middle Frame)
  const filteredItems = useMemo(() => {
    if (activeTask === 'rooms_users') {
      if (roomsUsersSubTab === 'rooms') {
        let list = [...roomsWithViolations];
        if (roomFilter === 'public') list = list.filter(r => !r.isPrivate);
        if (roomFilter === 'private') list = list.filter(r => !!r.isPrivate);
        if (roomFilter === 'violating') {
          list = list.filter(r => !!r.violationSeverity);
          if (roomViolationSeverity !== 'all') {
            list = list.filter(r => r.violationSeverity === roomViolationSeverity);
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          list = list.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
        }
        return list;
      } else {
        let list = [...evaluatedUsersWithViolations];
        if (userFilter === 'online') list = list.filter(u => u.onlineCheck?.isOnline);
        if (userFilter === 'offline') list = list.filter(u => !u.onlineCheck?.isOnline);
        if (userFilter === 'violating') {
          list = list.filter(u => !!u.violationSeverity);
          if (userViolationSeverity !== 'all') {
            list = list.filter(u => u.violationSeverity === userViolationSeverity);
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          list = list.filter(u => u.displayName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));
        }
        return list;
      }
    }

    if (activeTask === 'violators_banned') {
      if (violatorsBannedSubTab === 'violators') {
        if (violatorTarget === 'rooms') {
          let list = roomsWithViolations.filter(r => !!r.violationSeverity);
          if (violatorFilter !== 'all') {
            list = list.filter(r => r.violationSeverity === violatorFilter);
          }
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || (r.violationReason && r.violationReason.toLowerCase().includes(q)));
          }
          return list;
        } else {
          let list = evaluatedUsersWithViolations.filter(u => !!u.violationSeverity);
          if (violatorFilter !== 'all') {
            list = list.filter(v => v.violationSeverity === violatorFilter);
          }
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(v => v.displayName.toLowerCase().includes(q) || (v.violationReason && v.violationReason.toLowerCase().includes(q)) || (v.email && v.email.toLowerCase().includes(q)));
          }
          return list;
        }
      } else {
        let list = sanctions.filter(s => {
          const { activeBan, activeChatLock } = checkSanctionActiveState(s);
          return activeBan || activeChatLock;
        });
        // Deduplicate by uid or email
        const seen = new Set<string>();
        list = list.filter(item => {
          const key = item.uid || item.email?.toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (bannedFilter === 'perm') list = list.filter(b => b.lastSanctionType === 'ban_perm' || (!b.banExpiresAt && b.isBanned));
        if (bannedFilter === 'temp') list = list.filter(b => b.isBanned && b.lastSanctionType !== 'ban_perm' && !!b.banExpiresAt);
        if (bannedFilter === 'muted') list = list.filter(b => !b.isBanned && b.isChatLocked);
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          list = list.filter(b => (b.displayName || '').toLowerCase().includes(q) || (b.email || '').toLowerCase().includes(q) || (b.reason || '').toLowerCase().includes(q));
        }
        return list;
      }
    }

    if (activeTask === 'broadcast') {
      let list = [...broadcasts];
      if (list.length === 0) {
        list = [
          {
            id: 'bc-1',
            title: 'Chào mừng bản cập nhật DataStore!',
            message: 'Hệ thống đã nâng cấp toàn diện giao diện và phân loại tác vụ.',
            type: 'news',
            senderName: 'Hệ thống CloudSend',
            createdAt: new Date().toISOString(),
            active: true
          },
          {
            id: 'bc-2',
            title: 'Bảo trì máy chủ định kỳ',
            message: 'Hạ tầng mạng sẽ được tối ưu đường truyền trong khoảng 02:00 sáng mai.',
            type: 'maintenance',
            senderName: 'Dev Admin',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            active: false
          }
        ];
      }
      if (broadcastFilter !== 'all') list = list.filter(b => b.type === broadcastFilter);
      return list;
    }

    if (activeTask === 'reports') {
      let list = [...reports];
      if (reportFilter === 'pending') list = list.filter(r => r.status === 'pending');
      if (reportFilter === 'resolved') list = list.filter(r => r.status === 'resolved');
      if (reportFilter === 'dismissed') list = list.filter(r => r.status === 'dismissed');
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(r => 
          (r.senderName && r.senderName.toLowerCase().includes(q)) ||
          (r.reportedByName && r.reportedByName.toLowerCase().includes(q)) ||
          (r.reason && r.reason.toLowerCase().includes(q)) ||
          (r.messageText && r.messageText.toLowerCase().includes(q)) ||
          (r.messageRawText && r.messageRawText.toLowerCase().includes(q)) ||
          (r.roomName && r.roomName.toLowerCase().includes(q))
        );
      }
      return list;
    }

    return [];
  }, [activeTask, roomsUsersSubTab, violatorsBannedSubTab, roomFilter, roomViolationSeverity, userFilter, userViolationSeverity, violatorFilter, violatorTarget, bannedFilter, broadcastFilter, reportFilter, roomsWithViolations, evaluatedUsersWithViolations, sanctions, broadcasts, reports, searchQuery]);

  // Chi tiết mục đang chọn ở Khung 3 / Modal
  const selectedItemData = useMemo(() => {
    if (!selectedItemId) return null;
    if ((activeTask === 'rooms_users' && roomsUsersSubTab === 'rooms') || (activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators' && violatorTarget === 'rooms')) {
      return roomsWithViolations.find((r: any) => r.id === selectedItemId) || null;
    }
    if ((activeTask === 'rooms_users' && roomsUsersSubTab === 'users') || (activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators' && violatorTarget === 'users')) {
      return evaluatedUsersWithViolations.find((u: any) => (u.uid === selectedItemId || u.id === selectedItemId)) || null;
    }
    return filteredItems.find((it: any) => (it.id === selectedItemId || it.uid === selectedItemId)) || null;
  }, [filteredItems, selectedItemId, activeTask, roomsUsersSubTab, violatorsBannedSubTab, violatorTarget, roomsWithViolations, evaluatedUsersWithViolations]);

  // Xử lý gửi Thông Báo Toàn Máy Chủ (Tác vụ 5)
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;

    const newBroadcast: BroadcastRecord = {
      id: `broadcast-${Date.now()}`,
      title: broadcastTitle.trim(),
      message: broadcastMsg.trim(),
      type: broadcastType,
      senderName: settings.deviceName || 'Admin Server',
      createdAt: new Date().toISOString(),
      active: true
    };

    try {
      await setDoc(doc(db, 'system_broadcasts', newBroadcast.id), newBroadcast);
      setBroadcasts(prev => [newBroadcast, ...prev]);
      setBroadcastTitle('');
      setBroadcastMsg('');
      setBroadcastStatus('Đã phát thông báo thành công đến toàn bộ máy chủ!');
      setTimeout(() => setBroadcastStatus(null), 4000);
    } catch {
      // Fallback local state nếu rules chưa deploy
      setBroadcasts(prev => [newBroadcast, ...prev]);
      setBroadcastTitle('');
      setBroadcastMsg('');
      setBroadcastStatus('Đã lưu thông báo máy chủ (Local Dev mode)!');
      setTimeout(() => setBroadcastStatus(null), 4000);
    }
  };

  // Xử lý Gỡ Ban (Unban) ngay lập tức (gỡ cả tài khoản chính + email/SĐT liên kết)
  const handleUnbanUser = async (targetUid: string, targetEmail?: string) => {
    try {
      const found = sanctions.find(s => s.uid === targetUid) || firestoreUsers.find(u => (u.uid || u.id) === targetUid);
      const email = targetEmail || found?.email || (found as any)?.linkedEmail || '';
      const phone = (found as any)?.phone || (found as any)?.linkedPhone || (found as any)?.phoneNumber || '';
      const cleanEmail = (email || '').trim().toLowerCase();

      await removeDevSanction(cleanEmail, targetUid, phone);

      // Cập nhật state local ngay lập tức
      setSanctions(prev => prev.filter(s => {
        if (targetUid && (s.uid === targetUid || s.linkedUids?.includes(targetUid))) return false;
        if (cleanEmail && (s.email?.toLowerCase() === cleanEmail || s.linkedEmails?.includes(cleanEmail))) return false;
        if (phone && (s.phone === phone || s.linkedPhones?.includes(phone))) return false;
        return true;
      }));

      alert('✅ Đã gỡ lệnh cấm thành công (bao gồm cả các tài khoản liên kết Email / SĐT)! Người dùng có thể đăng nhập lại ngay lập tức.');
    } catch (err) {
      console.error('Lỗi khi gỡ ban:', err);
      setSanctions(prev => prev.filter(s => s.uid !== targetUid));
      alert('Đã hoàn tất thao tác gỡ lệnh cấm.');
    }
  };

  // Xóa sạch lịch sử vi phạm / khóa chat test để đưa tài khoản/phòng về trạng thái sạch
  const handleClearTestViolations = async (targetId: string, targetType: 'users' | 'rooms', targetEmail?: string, targetName?: string) => {
    try {
      if (targetType === 'users') {
        const cleanEmail = (targetEmail || '').trim().toLowerCase();
        const emailDocId = cleanEmail ? encodeURIComponent(cleanEmail).replace(/\./g, '_') : '';
        const promises: Promise<any>[] = [];
        if (targetId) promises.push(deleteDoc(doc(db, 'sanctions', targetId)));
        if (emailDocId && emailDocId !== targetId) promises.push(deleteDoc(doc(db, 'sanctions', emailDocId)));
        sanctions.forEach(s => {
          if ((targetId && s.uid === targetId) || (cleanEmail && s.email?.toLowerCase() === cleanEmail)) {
            if (s.uid && s.uid !== targetId) promises.push(deleteDoc(doc(db, 'sanctions', s.uid)));
            if (s.email) {
              const eId = encodeURIComponent(s.email.trim().toLowerCase()).replace(/\./g, '_');
              if (eId !== emailDocId) promises.push(deleteDoc(doc(db, 'sanctions', eId)));
            }
          }
        });
        // Đánh dấu bỏ qua các báo cáo đang pending của user này nếu DEV xác nhận xóa lịch sử test
        reports
          .filter(r => r.senderId === targetId && r.status === 'pending')
          .forEach(r => {
            promises.push(updateDoc(doc(db, 'reports', r.id), { status: 'dismissed', resolvedAt: new Date().toISOString() }));
          });
        try {
          if (targetId) promises.push(updateDoc(doc(db, 'users', targetId), { hasWarning: false }));
        } catch {
          // ignore if user doc doesn't exist
        }
        await Promise.allSettled(promises);
        setSanctions(prev => prev.filter(s => !(targetId && s.uid === targetId) && !(cleanEmail && s.email?.toLowerCase() === cleanEmail)));
      } else {
        const promises: Promise<any>[] = [];
        reports
          .filter(r => r.roomId === targetId && r.status === 'pending')
          .forEach(r => {
            promises.push(updateDoc(doc(db, 'reports', r.id), { status: 'dismissed', resolvedAt: new Date().toISOString() }));
          });
        try {
          promises.push(updateDoc(doc(db, 'rooms', targetId), { violationSeverity: null, violationReason: null }));
        } catch {
          // ignore
        }
        await Promise.allSettled(promises);
      }

      setOpenAiAuditResults(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setViolationIncidentsMap(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setShowDetailModal(false);
      alert(`✅ Đã xóa sạch trạng thái vi phạm / khóa test cho [${targetName || targetId}]!`);
    } catch (err) {
      console.error('Clear violation history error:', err);
      alert('Đã dọn dẹp trạng thái vi phạm cục bộ.');
    }
  };

  // Xử lý giải quyết đơn tố cáo
  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Resolve report error:', err);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'dismissed',
        resolvedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Dismiss report error:', err);
    }
  };

  const handleDeleteReportedMessage = async (roomId: string, messageId: string, reportId: string) => {
    try {
      if (roomId && messageId) {
        await deleteDoc(doc(db, 'rooms', roomId, 'messages', messageId));
      }
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        actionTaken: 'deleted_message',
        resolvedAt: new Date().toISOString()
      });
      alert('Đã xóa tin nhắn vi phạm khỏi phòng và cập nhật trạng thái tố cáo thành Đã xử lý!');
    } catch (err) {
      console.error('Delete reported message error:', err);
      alert('Đã xử lý xóa tin nhắn vi phạm.');
    }
  };

  const handleBanUserFromReport = async (targetUid: string, targetName: string, durationDays: number | 'perm', reason: string, reportId?: string) => {
    try {
      const now = new Date();
      const foundUser = firestoreUsers.find(u => (u.uid || u.id) === targetUid) as any;
      const targetEmail = foundUser?.linkedEmail || foundUser?.email || '';
      const targetPhone = foundUser?.phone || foundUser?.linkedPhone || foundUser?.phoneNumber || '';

      const { propagatedCount } = await applyLinkedBanSanction({
        targetUid,
        targetEmail,
        targetPhone,
        targetDisplayName: targetName,
        durationDays,
        reason,
        actedBy: currentUser?.email || DEV_EMAIL,
      });

      if (reportId) {
        await updateDoc(doc(db, 'reports', reportId), {
          status: 'resolved',
          actionTaken: `banned_${durationDays}`,
          resolvedAt: now.toISOString()
        });
      }
      alert(`Đã áp dụng hình phạt khóa tài khoản với [${targetName}] (và ${Math.max(0, propagatedCount - 1)} định danh Email/SĐT/tài khoản liên kết) thành công (${durationDays === 'perm' ? 'Vĩnh viễn' : durationDays + ' ngày'})!`);
    } catch (err) {
      console.error('Ban user error:', err);
    }
  };

  // Điều hướng từ phòng chat sang đúng người dùng trong Tác vụ 2: Những Người Dùng
  const handleNavigateToUser = (targetUid: string, userData?: any) => {
    if (!targetUid) return;
    setActiveTask('rooms_users');
    setRoomsUsersSubTab('users');
    setUserFilter('all');
    setSearchQuery('');
    setSelectedItemId(targetUid);

    setTimeout(() => {
      const el = document.getElementById(`record-item-${targetUid}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Tổng hợp danh sách tất cả các thiết bị đã đăng nhập bằng tài khoản người dùng đang chọn
  const userDevicesList = useMemo(() => {
    if (activeTask !== 'rooms_users' || roomsUsersSubTab !== 'users' || !selectedItemData) return [];
    const u = selectedItemData as any;
    const devMap = new Map<string, {
      id: string;
      name: string;
      type: DeviceType;
      status: 'online' | 'offline';
      lastSeen?: string;
      isCurrent?: boolean;
      ip?: string;
    }>();

    // 1. Thiết bị chính trong hồ sơ
    if (u.deviceName) {
      const isOnline = u.onlineCheck?.isOnline;
      devMap.set(u.deviceName.toLowerCase(), {
        id: `dev-${u.uid}-main`,
        name: u.deviceName,
        type: (u.deviceType as DeviceType) || 'laptop',
        status: isOnline ? 'online' : 'offline',
        lastSeen: u.lastSeen || u.createdAt,
        isCurrent: u.uid === currentUser?.uid
      });
    }

    // 2. Từ presence các phiên trực tuyến
    onlinePresence.forEach(p => {
      if (p.uid === u.uid || (u.email && p.email && p.email.toLowerCase() === u.email.toLowerCase())) {
        const evaluated = evaluateOnlineStatus(p.lastSeen, p.status);
        const key = (p.deviceName || 'Thiết bị').toLowerCase();
        devMap.set(key, {
          id: `pres-${p.uid}-${p.deviceName}`,
          name: p.deviceName || 'Thiết bị',
          type: (p.deviceType as DeviceType) || 'laptop',
          status: evaluated.isOnline ? 'online' : 'offline',
          lastSeen: p.lastSeen,
          isCurrent: p.uid === currentUser?.uid
        });
      }
    });

    // 3. Từ danh sách loggedDevices nếu có trong doc users
    if (Array.isArray(u.loggedDevices)) {
      u.loggedDevices.forEach((ld: any, idx: number) => {
        const key = (ld.name || ld.deviceName || `device-${idx}`).toLowerCase();
        if (!devMap.has(key)) {
          devMap.set(key, {
            id: ld.id || `ld-${idx}`,
            name: ld.name || ld.deviceName || 'Thiết bị đăng nhập',
            type: ld.type || ld.deviceType || 'laptop',
            status: ld.isOnline ? 'online' : 'offline',
            lastSeen: ld.lastSeen || ld.lastLogin || u.lastSeen,
            isCurrent: ld.isCurrent || false,
            ip: ld.ip
          });
        }
      });
    }

    // 4. Từ các tin nhắn người này từng gửi (senderDevice)
    userMessages.forEach((msg, idx) => {
      if (msg.senderDevice) {
        const key = msg.senderDevice.toLowerCase();
        if (!devMap.has(key)) {
          devMap.set(key, {
            id: `msg-dev-${idx}`,
            name: msg.senderDevice,
            type: 'laptop',
            status: 'offline',
            lastSeen: msg.createdAt
          });
        }
      }
    });

    // Mẫu mặc định nếu chưa lưu thiết bị
    if (devMap.size === 0) {
      devMap.set('default', {
        id: `dev-${u.uid}-default`,
        name: u.deviceName || 'Trình duyệt Web (Mặc định)',
        type: 'laptop',
        status: u.onlineCheck?.isOnline ? 'online' : 'offline',
        lastSeen: u.lastSeen || u.createdAt
      });
    }

    return Array.from(devMap.values());
  }, [activeTask, selectedItemData, onlinePresence, userMessages, currentUser]);

  // Xử lý gửi thông báo riêng cho người dùng
  const handleSendPrivateNotification = async () => {
    if (!privateMsgText.trim() || !selectedItemData || isSendingPrivateNotif) return;
    const target = selectedItemData as any;
    setIsSendingPrivateNotif(true);

    try {
      const sent = await sendPrivateDevNotification({
        targetUid: target.uid || target.id,
        targetEmail: target.email,
        targetName: target.displayName,
        message: privateMsgText.trim(),
        devEmail: currentUser?.email || DEV_EMAIL
      });

      setSentPrivateNotifs(prev => [sent, ...prev]);
      setPrivateMsgText('');
      consecutiveEnterCountRef.current = 0;
      setPrivateNotifStatus(`✅ Đã gửi thông báo riêng tới [${target.displayName}] thành công!`);
      setTimeout(() => setPrivateNotifStatus(null), 4000);
    } catch (err: any) {
      console.error('Send private notification error:', err);
      setPrivateNotifStatus('❌ Gặp sự cố khi gửi thông báo riêng.');
      setTimeout(() => setPrivateNotifStatus(null), 4000);
    } finally {
      setIsSendingPrivateNotif(false);
    }
  };

  // Xử lý phím Enter gửi thông báo trực tiếp (Shift+Enter xuống dòng)
  const handlePrivateMsgKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrivateNotification();
    }
  };

  // AI điều kiểm tra vi phạm đối chiếu 12 luật cộng đồng
  const handleRunAiAudit = async () => {
    if (!selectedItemData || isAiAuditing) return;
    const target = selectedItemData as any;
    setIsAiAuditing(true);

    try {
      const res = await callAiAuditUser({
        userId: target.uid || target.id,
        userName: target.displayName,
        userEmail: target.email,
        messages: userMessages.map(m => ({
          text: m.text,
          rawText: m.rawText,
          fileName: m.fileName,
          createdAt: m.createdAt
        })),
        reports: reports.filter(r => r.senderId === target.uid || r.reportedByUid === target.uid),
        violationHistoryCount: target.violationCount || (target.sanction?.violationCount || 0),
        currentSanction: target.sanction || sanctions.find(s => s.uid === target.uid)
      });

      setAiAuditResult(res);
    } catch (err) {
      console.error('AI Audit error:', err);
    } finally {
      setIsAiAuditing(false);
    }
  };

  // Kiểm duyệt toàn hệ thống bằng OpenAI Moderation API và tự động phân loại vào các tab mức độ vi phạm
  const handleStartOpenAiModeration = async () => {
    if (isBatchAuditing) return;
    setIsBatchAuditing(true);

    try {
      const targetRoomsMap = new Map<string, { id: string; name: string; code?: string }>();
      targetRoomsMap.set('public-relay-lounge', { id: 'public-relay-lounge', name: 'Đại Sảnh Toàn Cầu', code: 'GLOBAL' });
      rooms.forEach(r => targetRoomsMap.set(r.id, { id: r.id, name: r.name, code: r.code }));

      interface RawScannedMsg {
        id: string;
        roomId: string;
        roomName: string;
        roomCode?: string;
        senderId?: string;
        senderName?: string;
        senderDevice?: string;
        text: string;
        createdAt?: string;
        timestamp?: number;
      }

      interface RawScannedImg {
        messageId?: string;
        roomId?: string;
        roomName?: string;
        roomCode?: string;
        senderId?: string;
        senderName?: string;
        senderDevice?: string;
        fileName?: string;
        url: string;
        createdAt?: string;
        timestamp?: number;
      }

      const userMsgsMap = new Map<string, RawScannedMsg[]>();
      const roomMsgsMap = new Map<string, RawScannedMsg[]>();
      const userImgsMap = new Map<string, RawScannedImg[]>();
      const roomImgsMap = new Map<string, RawScannedImg[]>();

      const isAuditImageUrl = (u: unknown): u is string =>
        typeof u === 'string' && (u.startsWith('data:image/') || u.startsWith('https://') || u.startsWith('http://'));

      // Thu thập tối đa 60 tin nhắn gần nhất mỗi phòng (kèm hình ảnh, phòng chat, thời điểm, thiết bị)
      await Promise.all(
        Array.from(targetRoomsMap.values()).map(async (roomMeta) => {
          try {
            let snap;
            try {
              snap = await getDocs(
                query(collection(db, 'rooms', roomMeta.id, 'messages'), orderBy('createdAt', 'desc'), limit(60))
              );
            } catch {
              snap = await getDocs(query(collection(db, 'rooms', roomMeta.id, 'messages'), limit(60)));
            }
            const rList: RawScannedMsg[] = [];
            const rImgList: RawScannedImg[] = [];

            snap.docs.forEach(d => {
              const data = d.data() as ChatMessage;
              const raw = unwrapSecureBase64Message(data.rawText || data.text || '').trim();
              if (raw) {
                const itemMsg: RawScannedMsg = {
                  id: d.id,
                  roomId: roomMeta.id,
                  roomName: roomMeta.name,
                  roomCode: roomMeta.code,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  senderDevice: data.senderDevice,
                  text: raw,
                  createdAt: data.createdAt,
                  timestamp: data.timestamp
                };
                rList.push(itemMsg);
                if (data.senderId) {
                  const prev = userMsgsMap.get(data.senderId) || [];
                  if (prev.length < 30) {
                    prev.push(itemMsg);
                    userMsgsMap.set(data.senderId, prev);
                  }
                }
              }

              // Thu thập tệp ảnh đính kèm để OpenAI omni-moderation-latest kiểm duyệt hình ảnh miễn phí
              const candidateImages: Array<{ url: string; fileName?: string }> = [];
              if (Array.isArray(data.attachments)) {
                data.attachments.forEach((att: any) => {
                  const attUrl = att?.data || att?.url;
                  const looksImage = att?.type?.startsWith('image/') || (typeof attUrl === 'string' && attUrl.startsWith('data:image/'));
                  if (looksImage && isAuditImageUrl(attUrl)) {
                    candidateImages.push({ url: attUrl, fileName: att?.name });
                  }
                });
              }
              if (candidateImages.length === 0) {
                const singleUrl = data.fileData || data.fileUrl;
                const looksImage = data.fileType?.startsWith('image/') || (typeof singleUrl === 'string' && singleUrl.startsWith('data:image/'));
                if (looksImage && isAuditImageUrl(singleUrl)) {
                  candidateImages.push({ url: singleUrl, fileName: data.fileName });
                }
              }

              candidateImages.forEach((imgInfo) => {
                const itemImg: RawScannedImg = {
                  messageId: d.id,
                  roomId: roomMeta.id,
                  roomName: roomMeta.name,
                  roomCode: roomMeta.code,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  senderDevice: data.senderDevice,
                  fileName: imgInfo.fileName,
                  url: imgInfo.url,
                  createdAt: data.createdAt,
                  timestamp: data.timestamp
                };
                if (rImgList.length < 6) {
                  rImgList.push(itemImg);
                }
                if (data.senderId) {
                  const prevImgs = userImgsMap.get(data.senderId) || [];
                  if (prevImgs.length < 6) {
                    prevImgs.push(itemImg);
                    userImgsMap.set(data.senderId, prevImgs);
                  }
                }
              });
            });

            if (rList.length > 0) {
              roomMsgsMap.set(roomMeta.id, rList);
            }
            if (rImgList.length > 0) {
              roomImgsMap.set(roomMeta.id, rImgList);
            }
          } catch {
            // Bỏ qua phòng không đọc được
          }
        })
      );

      const batchItems: Array<{
        id: string;
        type: 'user' | 'room';
        name: string;
        email?: string;
        messages: RawScannedMsg[];
        images: RawScannedImg[];
        reportReasons: string[];
      }> = [];

      // Chuẩn bị payload Người Dùng (không kiểm duyệt tài khoản DEV, chỉ tính báo cáo đang pending)
      evaluatedUsers.forEach(u => {
        if (isDevUser(u.email)) return;
        const uid = u.uid || u.id;
        const msgs = userMsgsMap.get(uid) || [];
        const imgs = userImgsMap.get(uid) || [];
        const userReps = reports.filter(r => r.senderId === uid && r.status === 'pending');
        if (msgs.length > 0 || imgs.length > 0 || userReps.length > 0) {
          batchItems.push({
            id: uid,
            type: 'user',
            name: u.displayName || 'Người dùng',
            email: u.email,
            messages: msgs,
            images: imgs,
            reportReasons: userReps.map(r => r.reason).filter(Boolean)
          });
        }
      });

      // Chuẩn bị payload Phòng Chat
      rooms.forEach(r => {
        const msgs = roomMsgsMap.get(r.id) || [];
        const imgs = roomImgsMap.get(r.id) || [];
        const roomReps = reports.filter(rep => rep.roomId === r.id && rep.status === 'pending');
        if (msgs.length > 0 || imgs.length > 0 || roomReps.length > 0) {
          batchItems.push({
            id: r.id,
            type: 'room',
            name: r.name,
            messages: msgs,
            images: imgs,
            reportReasons: roomReps.map(rep => rep.reason).filter(Boolean)
          });
        }
      });

      if (batchItems.length === 0) {
        setBatchAuditSummary({
          totalScanned: 0,
          flaggedCount: 0,
          source: 'OpenAI Moderation',
          timestamp: new Date().toLocaleTimeString('vi-VN')
        });
        setIsBatchAuditing(false);
        return;
      }

      const nextResults: Record<string, {
        severity: 'light' | 'medium' | 'heavy' | 'critical';
        reason: string;
        source: string;
        categories?: string[];
        auditedAt: string;
        evidenceMessages?: ViolationIncident[];
      }> = {};
      const nextIncidents: Record<string, ViolationIncident[]> = {};
      let usedSource = 'openai_moderation';
      const nowIso = new Date().toISOString();

      try {
        const resp = await fetch('/api/moderation/openai-batch-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batchItems })
        });
        if (resp.ok) {
          const data = await resp.json();
          usedSource = data.source || 'openai_moderation';
          const list = Array.isArray(data.results) ? data.results : [];
          list.forEach((r: any) => {
            if (r && r.id && r.severity && r.severity !== 'clean') {
              const evMsgs: ViolationIncident[] = Array.isArray(r.evidenceMessages)
                ? r.evidenceMessages.map((em: any, i: number) => ({
                    id: em.messageId || `ev-${r.id}-${i}`,
                    roomId: em.roomId || '',
                    roomName: em.roomName || 'Phòng chat',
                    roomCode: em.roomCode,
                    senderId: em.senderId,
                    senderName: em.senderName,
                    senderDevice: em.senderDevice,
                    createdAt: em.createdAt,
                    timestamp: em.timestamp,
                    content: em.content || '',
                    reason: em.reason || r.reason,
                    source: em.source || 'openai_moderation',
                    severity: em.severity || r.severity
                  }))
                : [];
              nextResults[r.id] = {
                severity: r.severity,
                reason: r.reason || 'Phát hiện vi phạm bởi AI Kiểm Duyệt',
                source: usedSource,
                categories: Array.isArray(r.categories) ? r.categories : [],
                auditedAt: nowIso,
                evidenceMessages: evMsgs
              };
              if (evMsgs.length > 0) {
                nextIncidents[r.id] = evMsgs;
              }
            }
          });
        } else {
          throw new Error('Batch API failed');
        }
      } catch {
        // Fallback cục bộ bằng 12 điều luật chuẩn xác theo từng tin nhắn
        usedSource = 'local_12_rules';
        batchItems.forEach(item => {
          const evMsgs: ViolationIncident[] = [];
          item.messages.forEach((m) => {
            const singleEval = evaluateUserWith12Rules([{ text: m.text, rawText: m.text }], [], null);
            if (singleEval.hasViolation) {
              const sev: 'light' | 'medium' | 'heavy' | 'critical' =
                singleEval.recommendedTier === 'level_perm' ? 'critical' :
                singleEval.recommendedTier === 'level_4' || singleEval.recommendedTier === 'level_3' ? 'heavy' :
                singleEval.recommendedTier === 'level_2' ? 'medium' : 'light';
              evMsgs.push({
                id: m.id,
                roomId: m.roomId,
                roomName: m.roomName,
                roomCode: m.roomCode,
                senderId: m.senderId,
                senderName: m.senderName,
                senderDevice: m.senderDevice,
                createdAt: m.createdAt,
                timestamp: m.timestamp,
                content: m.text,
                reason: singleEval.findings.map(f => f.ruleTitle).join(' • '),
                source: 'word_filter',
                severity: sev
              });
            }
          });
          const pendingReps = item.type === 'user'
            ? reports.filter(r => r.senderId === item.id && r.status === 'pending')
            : reports.filter(r => r.roomId === item.id && r.status === 'pending');

          if (evMsgs.length > 0 || pendingReps.length > 0) {
            const evalRes = evaluateUserWith12Rules(
              item.messages.map(m => ({ text: m.text, rawText: m.text })),
              pendingReps.map(r => ({ reason: r.reason })),
              null
            );
            const mappedSev: 'light' | 'medium' | 'heavy' | 'critical' =
              evalRes.recommendedTier === 'level_perm' ? 'critical' :
              evalRes.recommendedTier === 'level_4' || evalRes.recommendedTier === 'level_3' ? 'heavy' :
              evalRes.recommendedTier === 'level_2' ? 'medium' : 'light';
            nextResults[item.id] = {
              severity: mappedSev,
              reason: evalRes.summary,
              source: usedSource,
              auditedAt: nowIso,
              evidenceMessages: evMsgs
            };
            if (evMsgs.length > 0) {
              nextIncidents[item.id] = evMsgs;
            }
          }
        });
      }

      setOpenAiAuditResults(nextResults);
      setViolationIncidentsMap(prev => ({ ...prev, ...nextIncidents }));
      setBatchAuditSummary({
        totalScanned: batchItems.length,
        flaggedCount: Object.keys(nextResults).length,
        source: usedSource === 'openai_moderation' ? 'OpenAI Moderation' : 'AI Rule Engine',
        timestamp: new Date().toLocaleTimeString('vi-VN')
      });
      setViolatorsBannedSubTab('violators');
      setViolatorFilter('all');
    } catch (err) {
      console.error('Batch OpenAI moderation error:', err);
    } finally {
      setIsBatchAuditing(false);
    }
  };

  // Lấy chi tiết vi phạm thực tế (ở phòng chat nào, thời điểm nào, trên thiết bị nào) khi nhấn vào 1 đối tượng trong tab Kiểm Duyệt & Vi Phạm
  const fetchViolationDetailsForTarget = async (targetId: string, targetType: 'users' | 'rooms') => {
    setIsLoadingViolationDetails(true);
    try {
      const incidents: ViolationIncident[] = [];
      const seenKeys = new Set<string>();

      const pushIncident = (inc: ViolationIncident) => {
        const dedupKey = `${inc.roomId}|${inc.id}|${inc.content.slice(0, 60)}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          incidents.push(inc);
        }
      };

      // 1. Lấy từ kết quả kiểm duyệt OpenAI đã quét (nếu có)
      const aiEvidence = openAiAuditResults[targetId]?.evidenceMessages || [];
      aiEvidence.forEach(pushIncident);

      // 2. Lấy từ đơn tố cáo đang pending
      const matchedReports = reports.filter(r =>
        r.status === 'pending' && (targetType === 'users' ? r.senderId === targetId : r.roomId === targetId)
      );
      matchedReports.forEach(rep => {
        const roomMeta = rooms.find(rm => rm.id === rep.roomId);
        pushIncident({
          id: `rep-${rep.id}`,
          roomId: rep.roomId || '',
          roomName: rep.roomName || roomMeta?.name || 'Phòng chat',
          roomCode: roomMeta?.code,
          senderId: rep.senderId,
          senderName: rep.senderName,
          senderDevice: rep.senderDevice || 'Không rõ thiết bị',
          createdAt: rep.createdAt,
          timestamp: rep.timestamp,
          content: unwrapSecureBase64Message(rep.messageRawText || rep.messageText || '') || '(Nội dung đính kèm / báo cáo)',
          reason: `Tố cáo từ ${rep.reportedByName || 'thành viên'}: ${rep.reason}`,
          source: 'user_report',
          severity: 'medium'
        });
      });

      // 3. Quét trực tiếp các phòng chat để tìm chính xác tin nhắn vi phạm (Phòng nào, lúc nào, thiết bị nào)
      const roomListToScan = targetType === 'rooms'
        ? rooms.filter(r => r.id === targetId).map(r => ({ id: r.id, name: r.name, code: r.code }))
        : [
            { id: 'public-relay-lounge', name: 'Đại Sảnh Toàn Cầu', code: 'GLOBAL' },
            ...rooms.filter(r => r.id !== 'public-relay-lounge').map(r => ({ id: r.id, name: r.name, code: r.code }))
          ];

      await Promise.all(
        roomListToScan.map(async (rm) => {
          try {
            const qMsgs = targetType === 'users'
              ? query(collection(db, 'rooms', rm.id, 'messages'), where('senderId', '==', targetId), limit(40))
              : query(collection(db, 'rooms', rm.id, 'messages'), orderBy('createdAt', 'desc'), limit(60));
            const snap = await getDocs(qMsgs);
            snap.docs.forEach(d => {
              const data = d.data() as ChatMessage;
              const raw = unwrapSecureBase64Message(data.rawText || data.text || '').trim();
              if (!raw) return;
              const evalMsg = evaluateUserWith12Rules([{ text: raw, rawText: raw }], [], null);
              if (evalMsg.hasViolation || data.isReported) {
                const sev: 'light' | 'medium' | 'heavy' | 'critical' =
                  evalMsg.recommendedTier === 'level_perm' ? 'critical' :
                  evalMsg.recommendedTier === 'level_4' || evalMsg.recommendedTier === 'level_3' ? 'heavy' :
                  evalMsg.recommendedTier === 'level_2' ? 'medium' : 'light';
                pushIncident({
                  id: d.id,
                  roomId: rm.id,
                  roomName: rm.name,
                  roomCode: rm.code,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  senderDevice: data.senderDevice || 'Không rõ thiết bị',
                  createdAt: data.createdAt,
                  timestamp: data.timestamp,
                  content: raw,
                  reason: evalMsg.hasViolation
                    ? evalMsg.findings.map(f => `${f.ruleNumber}: ${f.ruleTitle}`).join(' • ')
                    : 'Tin nhắn bị thành viên khác báo cáo',
                  source: evalMsg.hasViolation ? 'word_filter' : 'user_report',
                  severity: sev
                });
              }
            });
          } catch {
            // Bỏ qua nếu index hoặc quyền truy cập chưa sẵn sàng
          }
        })
      );

      // 4. Nếu có lệnh kỷ luật ĐANG CÒN HIỆU LỰC, đính kèm thông tin chi tiết
      if (targetType === 'users') {
        const sanc = sanctions.find(s => s.uid === targetId);
        const { activeBan, activeChatLock } = checkSanctionActiveState(sanc);
        if ((activeBan || activeChatLock) && sanc) {
          pushIncident({
            id: `sanction-${sanc.uid}`,
            roomId: 'system',
            roomName: 'Hệ Thống Kiểm Soát ClSend',
            senderId: sanc.uid,
            senderName: sanc.displayName,
            senderDevice: evaluatedUsers.find(u => u.uid === targetId)?.deviceName || 'Thiết bị tài khoản',
            createdAt: sanc.offensiveItemTimestamp || sanc.bannedAt,
            content: sanc.offensiveItem || sanc.reason || 'Lệnh khóa/cấm đang hiệu lực',
            reason: sanc.remindText || sanc.reason || 'Án phạt kỷ luật đang hiệu lực',
            source: 'sanction',
            severity: sanc.lastSanctionType === 'ban_perm' ? 'critical' : activeBan ? 'heavy' : 'light'
          });
        }
      }

      // Sắp xếp mới nhất lên đầu
      incidents.sort((a, b) => {
        const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });

      setViolationIncidentsMap(prev => ({
        ...prev,
        [targetId]: incidents
      }));
    } catch (err) {
      console.warn('Fetch violation details notice:', err);
    } finally {
      setIsLoadingViolationDetails(false);
    }
  };

  // Áp dụng hình phạt theo 5 cấp độ chuẩn Roblox với văn bản tùy chỉnh
  const handleApplyTierSanction = async (
    tier: 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_perm',
    customReason?: string,
    ruleViolated?: string
  ) => {
    if (!selectedItemData) return;
    const target = selectedItemData as any;
    const targetUid = target.uid || target.id;
    const targetEmail = target.linkedEmail || target.email || '';
    const targetPhone = target.phone || target.linkedPhone || target.phoneNumber || '';
    const targetName = target.displayName || 'Người dùng';

    if (isDevUser(targetEmail)) {
      alert('Không thể áp dụng hình phạt kỷ luật cho Quản Trị Viên (DEV)!');
      return;
    }

    const tierConf = SANCTION_TIERS[tier];
    const customRemind = sanctionCustomNotes[tier]?.trim() || tierConf.remind;
    const customFinalReason = customReason || sanctionCustomReason.trim() || (aiAuditResult?.summary || tierConf.label);
    const finalRule = ruleViolated || sanctionCustomRule.trim() || (aiAuditResult?.findings?.[0]?.ruleNumber || 'Tiêu Chuẩn & Nội Quy Cộng Đồng');

    const confirmMsg = tier === 'level_perm'
      ? `⚠️ BẠN CÓ CHẮC CHẮN MUỐN CẤM TÀI KHOẢN [${targetName}] VĨNH VIỄN KHÔNG?\n\nHệ thống sẽ thu hồi quyền truy cập của tài khoản này và đồng bộ cấm tất cả tài khoản chung Email / SĐT liên kết (không cấm máy/tài khoản sạch mới).`
      : `Xác nhận áp dụng hình phạt kỷ luật:\n\n• ${tierConf.label}\n• Ghi chú Moderator gửi đi: "${customRemind}"\n• Lý do: "${customFinalReason}"\n\nBạn có muốn thực hiện không?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const updated = await applyTierSanction({
        targetUid,
        targetEmail,
        targetPhone,
        targetDisplayName: targetName,
        tier,
        customReason: customFinalReason,
        customRemindText: customRemind,
        ruleViolated: finalRule,
        offensiveItem: sanctionCustomOffensiveItem.trim() || undefined,
        offensiveItemTimestamp: new Date().toISOString(),
        devEmail: currentUser?.email || DEV_EMAIL
      });

      setSanctions(prev => {
        const filtered = prev.filter(s => s.uid !== targetUid);
        return [updated, ...filtered];
      });

      alert(`✅ Đã ban hành bản án kỷ luật Roblox thành công [${tierConf.label}] cho [${targetName}]!\n\nModerator Note: "${customRemind}"`);
    } catch (err) {
      console.error('Apply tier sanction error:', err);
      alert('Gặp lỗi khi lưu kỷ luật vào Firestore.');
    }
  };

  // Xóa một người dùng test / ảo khỏi Firestore
  const handleDeleteUser = async (targetUid: string, targetName: string, targetEmail?: string) => {
    if (isDevUser(targetEmail)) {
      alert('Không thể xóa tài khoản của Quản Trị Viên DEV chính thức!');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản [${targetName}] khỏi Firestore không?\n\nThao tác này sẽ xóa hồ sơ người dùng, trạng thái presence và các bản ghi kỷ luật liên quan.`)) {
      return;
    }

    try {
      const cleanEmail = (targetEmail || '').trim().toLowerCase();
      const emailDocId = cleanEmail ? encodeURIComponent(cleanEmail).replace(/\./g, '_') : '';

      await deleteDoc(doc(db, 'users', targetUid));
      await deleteDoc(doc(db, 'presence', targetUid));
      await deleteDoc(doc(db, 'sanctions', targetUid));
      if (emailDocId && emailDocId !== targetUid) {
        await deleteDoc(doc(db, 'sanctions', emailDocId));
      }

      setFirestoreUsers(prev => prev.filter(u => (u.uid || u.id) !== targetUid));
      setOnlinePresence(prev => prev.filter(p => p.uid !== targetUid));
      setSanctions(prev => prev.filter(s => s.uid !== targetUid && (!cleanEmail || s.email?.toLowerCase() !== cleanEmail)));

      if (selectedItemId === targetUid) {
        setSelectedItemId(null);
      }

      alert(`✅ Đã xóa tài khoản [${targetName}] thành công khỏi hệ thống!`);
    } catch (err) {
      console.error('Delete user error:', err);
      alert('Lỗi khi xóa người dùng khỏi Firestore.');
    }
  };

  // Dọn dẹp hàng loạt các tài khoản test / không thật
  const handlePurgeTestUsers = async () => {
    const testUsers = evaluatedUsersWithViolations.filter(u => {
      if (isDevUser(u.email)) return false;
      if (currentUser && u.uid === currentUser.uid) return false;
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return (
        name.includes('test') ||
        name.includes('fake') ||
        name.includes('ảo') ||
        name.includes('bot') ||
        email.includes('test') ||
        email.includes('example.com') ||
        email.includes('fake') ||
        !email
      );
    });

    if (testUsers.length === 0) {
      alert('Hiện tại không có tài khoản test hoặc tài khoản ảo nào cần dọn dẹp.');
      return;
    }

    if (!window.confirm(`Tìm thấy ${testUsers.length} tài khoản thử nghiệm / không thật:\n\n${testUsers.map(u => `• ${u.displayName} (${u.email || 'Khách'})`).slice(0, 8).join('\n')}${testUsers.length > 8 ? `\n... và ${testUsers.length - 8} tài khoản khác` : ''}\n\nBạn có muốn xóa toàn bộ các tài khoản này khỏi Firestore không? (Tài khoản DEV của bạn sẽ được bảo vệ tuyệt đối).`)) {
      return;
    }

    let deletedCount = 0;
    for (const u of testUsers) {
      try {
        const cleanEmail = (u.email || '').trim().toLowerCase();
        const emailDocId = cleanEmail ? encodeURIComponent(cleanEmail).replace(/\./g, '_') : '';
        await deleteDoc(doc(db, 'users', u.uid));
        await deleteDoc(doc(db, 'presence', u.uid));
        await deleteDoc(doc(db, 'sanctions', u.uid));
        if (emailDocId && emailDocId !== u.uid) {
          await deleteDoc(doc(db, 'sanctions', emailDocId));
        }
        deletedCount++;
      } catch (err) {
        console.warn('Purge test user error for:', u.uid, err);
      }
    }

    const testUids = new Set(testUsers.map(u => u.uid));
    setFirestoreUsers(prev => prev.filter(u => !testUids.has(u.uid || u.id)));
    setOnlinePresence(prev => prev.filter(p => !testUids.has(p.uid)));
    setSanctions(prev => prev.filter(s => !testUids.has(s.uid)));

    if (selectedItemId && testUids.has(selectedItemId)) {
      setSelectedItemId(null);
    }

    alert(`✅ Đã dọn dẹp thành công ${deletedCount} tài khoản test khỏi Firestore!`);
  };

  // Định dạng thời gian gửi tin nhắn (Tên hiển thị + Giờ gửi bên cạnh)
  const formatMessageTime = (createdAt?: string, timestamp?: number) => {
    try {
      const d = timestamp ? new Date(timestamp) : (createdAt ? new Date(createdAt) : new Date());
      if (isNaN(d.getTime())) return '';
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${hours}:${minutes}:${seconds} • ${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // 1. Danh sách người dùng của phòng chat (Dành cho Tab 1 ở Khung 4)
  const roomUsersList = useMemo(() => {
    if (activeTask !== 'rooms_users' || roomsUsersSubTab !== 'rooms' || !selectedItemId) return [];
    const currentRoom = rooms.find(r => r.id === selectedItemId);
    const userMap = new Map<string, {
      uid: string;
      displayName: string;
      email: string;
      deviceName: string;
      avatarColor?: string;
      customAvatarUrl?: string;
      avatarUrl?: string;
      photoURL?: string;
      role: 'owner' | 'dev' | 'member';
      messageCount: number;
      lastActive?: string;
      onlineStatus?: { isOnline: boolean; badgeText: string; color: string };
    }>();

    // Thêm chủ phòng
    if (currentRoom) {
      const ownerId = currentRoom.ownerId || currentRoom.createdBy;
      const ownerName = currentRoom.ownerName || currentRoom.createdByName || 'Chủ phòng';
      if (ownerId) {
        userMap.set(ownerId, {
          uid: ownerId,
          displayName: ownerName,
          email: '',
          deviceName: 'Thiết bị tạo phòng',
          role: 'owner',
          messageCount: 0
        });
      }
      // Thêm các thành viên trong room.members
      if (Array.isArray(currentRoom.members)) {
        currentRoom.members.forEach(m => {
          if (!userMap.has(m.uid)) {
            userMap.set(m.uid, {
              uid: m.uid,
              displayName: m.displayName || 'Thành viên',
              email: '',
              deviceName: m.deviceName || '',
              avatarColor: m.avatarColor,
              role: m.role || 'member',
              messageCount: 0
            });
          }
        });
      }
    }

    // Tổng hợp những người đã nhắn tin trong phòng
    roomMessages.forEach(msg => {
      const uid = msg.senderId || 'unknown';
      const isMsgDev = msg.isDevMessage || isDevUser(msg.senderEmail) || (msg.senderName && msg.senderName.includes('DEV'));
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          uid,
          displayName: msg.senderName || 'Người dùng',
          email: msg.senderEmail || '',
          deviceName: msg.senderDevice || '',
          customAvatarUrl: msg.senderAvatar,
          avatarColor: msg.senderAvatarColor,
          role: isMsgDev ? 'dev' : 'member',
          messageCount: 1,
          lastActive: msg.createdAt
        });
      } else {
        const u = userMap.get(uid)!;
        u.messageCount += 1;
        if (msg.senderEmail && !u.email) u.email = msg.senderEmail;
        if (msg.senderDevice && !u.deviceName) u.deviceName = msg.senderDevice;
        if (msg.senderAvatar && !u.customAvatarUrl) u.customAvatarUrl = msg.senderAvatar;
        if (msg.createdAt) u.lastActive = msg.createdAt;
      }
    });

    // Gắn trạng thái online và đồng bộ avatar từ evaluatedUsers / onlinePresence
    const list = Array.from(userMap.values());
    list.forEach(u => {
      const syncedUser = evaluatedUsers.find(eu => eu.uid === u.uid || (u.email && eu.email && eu.email.toLowerCase() === u.email.toLowerCase()));
      if (syncedUser) {
        u.customAvatarUrl = syncedUser.customAvatarUrl || u.customAvatarUrl;
        u.avatarUrl = syncedUser.avatarUrl || u.avatarUrl;
        u.photoURL = syncedUser.photoURL || u.photoURL;
        if (!u.avatarColor && syncedUser.avatarColor) u.avatarColor = syncedUser.avatarColor;
      }
      const device = onlinePresence.find(p => p.uid === u.uid || (u.email && p.email && p.email.toLowerCase() === u.email.toLowerCase()));
      if (device) {
        const evaluated = evaluateOnlineStatus(device.lastSeen, device.status);
        u.onlineStatus = {
          isOnline: evaluated.isOnline,
          badgeText: evaluated.badgeText,
          color: evaluated.color
        };
        if (!u.avatarColor && device.avatarColor) u.avatarColor = device.avatarColor;
      } else {
        u.onlineStatus = {
          isOnline: false,
          badgeText: '⚪ Ngoại tuyến',
          color: 'text-slate-400 bg-slate-800/80 border-slate-700'
        };
      }
    });

    return list;
  }, [activeTask, roomsUsersSubTab, selectedItemId, rooms, roomMessages, onlinePresence, evaluatedUsers]);

  // 2. Danh sách hình ảnh đã gửi trong phòng chat (Dành cho Tab 3 ở Khung 4 - Lưu giữ vĩnh viễn cả ảnh đã xóa và ảnh 18+)
  const roomImagesList = useMemo(() => {
    if (activeTask !== 'rooms_users' || roomsUsersSubTab !== 'rooms' || !selectedItemId) return [];
    const images: Array<{
      id: string;
      url: string;
      name: string;
      senderName: string;
      createdAt: string;
      size?: number;
      isDeleted?: boolean;
      isWarned?: boolean;
    }> = [];

    roomMessages.forEach(msg => {
      const isDel = !!(msg.deletedBySender || msg.isDeletedBySender);
      const isWarn = !!(msg.hasProfanity || msg.hasWarning || msg.isReported);

      if (Array.isArray(msg.attachments)) {
        msg.attachments.forEach((att, idx) => {
          if (att.type?.startsWith('image/') || (att.data && att.data.startsWith('data:image'))) {
            images.push({
              id: `${msg.id}_att_${idx}`,
              url: att.data,
              name: att.name || `Ảnh-${idx + 1}`,
              senderName: msg.senderName,
              createdAt: msg.createdAt,
              size: att.size,
              isDeleted: isDel,
              isWarned: isWarn
            });
          }
        });
      }
      if (msg.fileData && (msg.fileType?.startsWith('image/') || msg.fileData.startsWith('data:image'))) {
        images.push({
          id: `${msg.id}_file`,
          url: msg.fileData,
          name: msg.fileName || 'Ảnh đính kèm',
          senderName: msg.senderName,
          createdAt: msg.createdAt,
          size: msg.fileSize,
          isDeleted: isDel,
          isWarned: isWarn
        });
      }
    });

    return images.reverse();
  }, [activeTask, selectedItemId, roomMessages]);

  // Thống kê tin nhắn phục vụ 3 Tab Kiểm Toán
  const roomMessagesDeletedCount = useMemo(() => {
    return roomMessages.filter(m => m.deletedBySender || m.isDeletedBySender).length;
  }, [roomMessages]);

  const roomMessagesWarnedCount = useMemo(() => {
    return roomMessages.filter(m => m.hasProfanity || m.hasWarning || m.isReported).length;
  }, [roomMessages]);

  // Lọc tin nhắn cho Tab Kiểm toán ở Khung 4 theo 3 Tab (Tổng tin nhắn, Số tin nhắn đã xóa, Cảnh cáo)
  const filteredRoomMessages = useMemo(() => {
    let list = roomMessages;
    if (auditFilter === 'deleted') {
      list = list.filter(m => m.deletedBySender || m.isDeletedBySender);
    } else if (auditFilter === 'warned') {
      list = list.filter(m => m.hasProfanity || m.hasWarning || m.isReported);
    }

    if (!roomMsgSearchQuery.trim()) return list;
    const q = roomMsgSearchQuery.toLowerCase();
    return list.filter(m => 
      (m.senderName && m.senderName.toLowerCase().includes(q)) ||
      (m.text && m.text.toLowerCase().includes(q)) ||
      (m.rawText && m.rawText.toLowerCase().includes(q))
    );
  }, [roomMessages, roomMsgSearchQuery, auditFilter]);

  // Xử lý chọn tệp đính kèm khi nhắn tin trong phòng (hỗ trợ tệp nặng tới 250MB)
  const handleDevFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`Tệp "${file.name}" vượt quá giới hạn tối đa 250MB.`);
        continue;
      }
      try {
        let thumb = '';
        if (file.type.startsWith('image/')) {
          thumb = await generateImageThumbnail(file, 480, 0.75);
        }
        let fileUrl = '';
        if (file.size > 200 * 1024) {
          const uploaded = await uploadFileToServer(file);
          fileUrl = uploaded.url;
        } else if (!thumb) {
          thumb = await new Promise<string>((res) => {
            const r = new FileReader();
            r.onload = () => res((r.result as string) || '');
            r.readAsDataURL(file);
          });
        }
        setDevAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: thumb,
          url: fileUrl
        }].slice(0, 10));
      } catch (err) {
        console.error('Dev file attach error:', err);
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveDevAttachment = (index: number) => {
    setDevAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // DEV gửi tin nhắn trực tiếp vào phòng (Miễn trừ mã PIN, đính kèm ảnh/tệp, phong cách DEV chính chủ)
  const handleSendDevMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!devInputText.trim() && devAttachments.length === 0) || !selectedItemId || !currentUser) return;

    setIsSendingDevMessage(true);
    try {
      const baseName = (currentUser.displayName || settings.deviceName || 'Admin').trim();
      const devSenderName = `${baseName} DEV`;
      const now = new Date();
      const messageText = devInputText.trim();

      const payload: any = {
        roomId: selectedItemId,
        senderId: currentUser.uid,
        senderName: devSenderName,
        senderEmail: currentUser.email || 'admin@clsend.app',
        senderDevice: settings.deviceName || 'DEV DataStore Console',
        text: messageText,
        rawText: messageText, // Giữ nguyên văn không che
        isDevMessage: true,
        createdAt: now.toISOString(),
        timestamp: now.getTime(),
        serverTimestamp: serverTimestamp()
      };

      if (devAttachments.length > 0) {
        payload.attachments = devAttachments;
        if (devAttachments.length === 1) {
          payload.fileName = devAttachments[0].name;
          payload.fileSize = devAttachments[0].size;
          payload.fileType = devAttachments[0].type;
          payload.fileData = devAttachments[0].data;
        }
      }

      await addDoc(collection(db, 'rooms', selectedItemId, 'messages'), payload);

      setDevInputText('');
      setDevAttachments([]);
    } catch (err) {
      console.error('Lỗi gửi tin nhắn DEV vào phòng:', err);
      alert('Lỗi gửi tin nhắn: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSendingDevMessage(false);
    }
  };

  // DEV xóa tin nhắn cụ thể trong phòng (Vẫn giữ lại trong lưu trữ kiểm toán Khung 4)
  const handleDeleteRoomMessage = async (msgId: string) => {
    if (!selectedItemId) return;
    if (!confirm('Bạn có chắc chắn muốn xóa tin nhắn này khỏi phòng hiển thị của Client? (Tin nhắn vẫn được bảo lưu trong Khung 4 - Nội Dung để kiểm toán)')) return;
    try {
      await deleteDoc(doc(db, 'rooms', selectedItemId, 'messages', msgId));
      setRoomMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeletedBySender: true, deletedBySender: true, deletedAt: new Date().toISOString() } : m));
    } catch (err) {
      console.error('Lỗi xóa tin nhắn:', err);
    }
  };

  // DEV xóa vĩnh viễn phòng chat (bảo vệ Đại Sảnh Toàn Cầu)
  const handleDeleteRoom = async (roomId: string) => {
    if (roomId === 'public-relay-lounge') {
      alert('Không thể xóa Đại Sảnh Toàn Cầu (Global Lounge)! Đây là phòng công khai mặc định của hệ thống.');
      return;
    }
    if (!confirm('CẢNH BÁO DEV: Bạn có chắc chắn muốn xóa vĩnh viễn phòng chat này khỏi hệ thống Firestore?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      if (selectedItemId === roomId) {
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error('Lỗi xóa phòng chat:', err);
    }
  };

  // DEV dọn dẹp tất cả các phòng ảo / phòng thử nghiệm (Chỉ giữ lại Đại Sảnh Toàn Cầu)
  const handlePurgeTestRooms = async () => {
    const testRooms = rooms.filter(r => r.id !== 'public-relay-lounge');
    if (testRooms.length === 0) {
      alert('Hệ thống hiện tại chỉ có duy nhất Đại Sảnh Toàn Cầu (Global Lounge), không có phòng test nào khác!');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn XÓA TẤT CẢ ${testRooms.length} phòng thử nghiệm / phòng không thật không? Chỉ duy nhất Đại Sảnh Toàn Cầu sẽ được giữ lại!`)) {
      return;
    }
    try {
      await Promise.all(testRooms.map(r => deleteDoc(doc(db, 'rooms', r.id))));
      alert(`Đã xóa thành công ${testRooms.length} phòng test. Hiện chỉ còn duy nhất Đại Sảnh Toàn Cầu!`);
      if (selectedItemId && selectedItemId !== 'public-relay-lounge') {
        setSelectedItemId(null);
      }
    } catch (err) {
      console.error('Lỗi khi xóa các phòng test:', err);
      alert('Có lỗi xảy ra khi xóa phòng test.');
    }
  };

  const handleBack = () => {
    if (onBackToApp) {
      onBackToApp();
    } else {
      window.history.pushState(null, '', '/');
      window.location.href = '/';
    }
  };

  const isDev = isDevUser(currentUser?.email);

  if (!isDev) {
    return (
      <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center selection:bg-rose-500 selection:text-white font-sans">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">403 - Quyền Truy Cập Bị Từ Chối</h2>
        <p className="text-sm text-slate-400 max-w-md mb-2">
          Chỉ Quản trị viên và Nhà phát triển hệ thống mới có quyền truy cập khu vực DataStore này.
        </p>
        <p className="text-xs text-rose-300 font-mono bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 mb-6">
          Tài khoản hiện tại ({currentUser?.email || 'Chưa đăng nhập'}) không có quyền hạn.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-md active:scale-95"
        >
          Quay lại ứng dụng CloudSend
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-900 font-sans overflow-hidden">
      {/* Top Header Navigation */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition-all group shadow-sm active:scale-95"
            title="Quay lại trang chính CloudSend"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Quay lại CloudSend</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">DataStore</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Cloud Console
              </span>
            </div>


          </div>
        </div>

        {/* User / Device Info */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline-block">Thiết bị:</span>
          <span className="text-slate-200 font-medium">{settings?.deviceName || 'Cloud Device'}</span>
          {currentUser && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" title="Online" />
          )}
        </div>
      </header>

      {/* Sleek Modern Task Navigation Bar */}
      <section 
        id="datastore-frame-top"
        className="w-full border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-2.5 shrink-0 z-30"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Main 4 Unified Tasks Tab Strip */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5 scrollbar-none flex-1">
            {/* 1. Phòng Chat & Người Dùng */}
            <button
              id="task-btn-rooms-users"
              type="button"
              onClick={() => { setActiveTask('rooms_users'); setSelectedItemId(null); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTask === 'rooms_users'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Phòng Chat & Người Dùng</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {rooms.length} · {verifiedOnlineUsersCount} online
              </span>
            </button>

            {/* 2. Kiểm Duyệt & Vi Phạm (Gộp Vi Phạm + Đã Khóa + OpenAI Kiểm Duyệt) */}
            <button
              id="task-btn-violators-banned"
              type="button"
              onClick={() => { setActiveTask('violators_banned'); setSelectedItemId(null); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTask === 'violators_banned'
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Kiểm Duyệt & Vi Phạm</span>
              {(countUserSeverity.all + countRoomSeverity.all + sanctions.filter(s => s.isBanned).length) > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-amber-300 font-bold">
                  ({countUserSeverity.all + countRoomSeverity.all + sanctions.filter(s => s.isBanned).length})
                </span>
              )}
            </button>

            {/* 3. Thông Báo Server */}
            <button
              id="task-btn-broadcast"
              type="button"
              onClick={() => { setActiveTask('broadcast'); setSelectedItemId(null); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTask === 'broadcast'
                  ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Megaphone className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Thông Báo Server</span>
            </button>

            {/* 4. Báo Cáo Tố Cáo */}
            <button
              id="task-btn-reports"
              type="button"
              onClick={() => { setActiveTask('reports'); setSelectedItemId(null); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTask === 'reports'
                  ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Flag className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Báo Cáo Tố Cáo</span>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-rose-400 font-bold">
                  ({reports.filter(r => r.status === 'pending').length})
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* KHU VỰC CẤU TRÚC 3 KHUNG CHUẨN DATASTORE (Bên Trái - Ở Giữa - Bên Phải) */}
      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        
        {/* ========================================================================= */}
        {/* 2. KHUNG BÊN TRÁI ("Ở chỗ 2" - Phân loại & Hệ thống lọc theo yêu cầu) */}
        {/* ========================================================================= */}
        <section 
          id="datastore-frame-left"
          className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 p-3 sm:p-4 flex flex-col"
        >
          <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-800/80 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 text-slate-200">
              <PanelLeft className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold tracking-wide">
                Bộ Lọc & Phân Loại
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Nút bấm thu gọn/mở rộng bộ lọc trên màn hình điện thoại */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="md:hidden flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                title="Bấm để ẩn hoặc hiện danh sách bộ lọc trên điện thoại"
              >
                <span>{isMobileFilterOpen ? 'Thu gọn' : 'Bộ lọc'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileFilterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* NỘI DUNG BỘ LỌC THEO TỪNG TÁC VỤ */}
          <div className={`${isMobileFilterOpen ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col gap-2 max-h-56 md:max-h-none overflow-y-auto`}>

            {/* MỤC 1. PHÒNG CHAT & NGƯỜI DÙNG */}
            {activeTask === 'rooms_users' && (
              <div className="space-y-3">
                {/* Sub-tab toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setRoomsUsersSubTab('rooms'); setSelectedItemId(null); }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      roomsUsersSubTab === 'rooms'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Phòng Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRoomsUsersSubTab('users'); setSelectedItemId(null); }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      roomsUsersSubTab === 'users'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Người Dùng</span>
                  </button>
                </div>

                {roomsUsersSubTab === 'rooms' ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1">
                      Chế độ phòng chat
                    </div>
                    <button
                      type="button"
                      onClick={() => { setRoomFilter('all'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        roomFilter === 'all'
                          ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-emerald-500/40 shadow-sm'
                          : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Tất cả phòng</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {roomsWithViolations.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRoomFilter('public'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        roomFilter === 'public'
                          ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-emerald-500/40 shadow-sm'
                          : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Phòng Public (Tự do)</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-300">
                        {publicRoomsCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRoomFilter('private'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        roomFilter === 'private'
                          ? 'bg-purple-500/15 text-purple-300 font-semibold border-purple-500/40 shadow-sm'
                          : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>Phòng Private (Mã PIN)</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-purple-300">
                        {privateRoomsCount}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1">
                      Trạng thái hoạt động
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUserFilter('all'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border ${
                        userFilter === 'all'
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 font-semibold'
                          : 'border-transparent hover:bg-slate-900/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>Tất cả người dùng</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {evaluatedUsersWithViolations.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserFilter('online'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border ${
                        userFilter === 'online'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-semibold shadow-sm'
                          : 'border-transparent hover:bg-slate-900/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold text-emerald-400">Đang Online</div>
                          <div className="text-[10px] text-slate-400">Hoạt động trên hệ thống</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                        {verifiedOnlineUsersCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserFilter('offline'); setSelectedItemId(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border ${
                        userFilter === 'offline'
                          ? 'bg-slate-800 text-slate-200 border-slate-600 font-semibold'
                          : 'border-transparent hover:bg-slate-900/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <UserX className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold text-slate-300">Đang Offline</div>
                          <div className="text-[10px] text-slate-500">Ngoại tuyến</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {evaluatedUsersWithViolations.length - verifiedOnlineUsersCount}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MỤC 2. KIỂM DUYỆT & VI PHẠM (Gộp Vi Phạm + Đã Khóa + OpenAI Kiểm Duyệt) */}
            {activeTask === 'violators_banned' && (
              <div className="space-y-3">
                {/* Sub-tab toggle: Vi Phạm vs Đã Khóa */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setViolatorsBannedSubTab('violators'); setSelectedItemId(null); }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      violatorsBannedSubTab === 'violators'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Vi Phạm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViolatorsBannedSubTab('banned'); setSelectedItemId(null); }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      violatorsBannedSubTab === 'banned'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Đã Khóa</span>
                  </button>
                </div>

                {violatorsBannedSubTab === 'violators' ? (
                  <div className="space-y-3">
                    {/* Box AI Kiểm Duyệt OpenAI */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>AI Kiểm Duyệt OpenAI</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Quét nội dung tin nhắn, báo cáo và phân loại tự động vào các tab mức độ vi phạm.
                      </p>
                      <button
                        type="button"
                        onClick={handleStartOpenAiModeration}
                        disabled={isBatchAuditing}
                        className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                      >
                        {isBatchAuditing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang kiểm duyệt...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Kiểm Duyệt</span>
                          </>
                        )}
                      </button>
                      {batchAuditSummary && (
                        <div className="text-[11px] font-mono tabular-nums text-emerald-300 pt-1 border-t border-slate-800">
                          Đã quét {batchAuditSummary.totalScanned} mục · {batchAuditSummary.flaggedCount} vi phạm ({batchAuditSummary.source})
                        </div>
                      )}
                    </div>

                    {/* Chọn đối tượng: Người dùng hoặc Phòng chat */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1.5">
                        Đối tượng phân loại
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => { setViolatorTarget('users'); setSelectedItemId(null); }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            violatorTarget === 'users'
                              ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>Người Dùng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setViolatorTarget('rooms'); setSelectedItemId(null); }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            violatorTarget === 'rooms'
                              ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                          <span>Phòng Chat</span>
                        </button>
                      </div>
                    </div>

                    {/* Các tab mức độ vi phạm */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1">
                        Phân loại mức độ vi phạm
                      </div>
                      {[
                        { key: 'all' as const, label: 'Tất cả vi phạm', count: violatorTarget === 'users' ? countUserSeverity.all : countRoomSeverity.all, textCls: 'text-slate-200', activeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
                        { key: 'light' as const, label: 'Nhẹ (Cảnh cáo)', count: violatorTarget === 'users' ? countUserSeverity.light : countRoomSeverity.light, textCls: 'text-emerald-300', activeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
                        { key: 'medium' as const, label: 'Bình Thường', count: violatorTarget === 'users' ? countUserSeverity.medium : countRoomSeverity.medium, textCls: 'text-amber-300', activeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
                        { key: 'heavy' as const, label: 'Nặng (Tạm khóa)', count: violatorTarget === 'users' ? countUserSeverity.heavy : countRoomSeverity.heavy, textCls: 'text-orange-300', activeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
                        { key: 'critical' as const, label: 'Hết Cứu (Nghiêm trọng)', count: violatorTarget === 'users' ? countUserSeverity.critical : countRoomSeverity.critical, textCls: 'text-rose-300', activeCls: 'bg-rose-500/20 text-rose-300 border-rose-500/50' }
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => { setViolatorFilter(tab.key); setSelectedItemId(null); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                            violatorFilter === tab.key
                              ? `${tab.activeCls} font-semibold shadow-sm`
                              : 'border-transparent text-slate-300 hover:bg-slate-900/80'
                          }`}
                        >
                          <span className={violatorFilter === tab.key ? '' : tab.textCls}>{tab.label}</span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400">
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 px-1 mb-1">
                      Lọc danh sách đang khóa
                    </div>
                    {[
                      { key: 'all' as const, label: 'Tất cả đang khóa', icon: Ban, cls: 'text-rose-400' },
                      { key: 'perm' as const, label: 'Cấm vĩnh viễn', icon: ShieldAlert, cls: 'text-red-400' },
                      { key: 'temp' as const, label: 'Tạm khóa tài khoản', icon: Clock, cls: 'text-amber-400' },
                      { key: 'muted' as const, label: 'Khóa chat / Cảnh cáo', icon: VolumeX, cls: 'text-slate-300' }
                    ].map(f => {
                      const IconComp = f.icon;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => { setBannedFilter(f.key); setSelectedItemId(null); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                            bannedFilter === f.key
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 font-semibold'
                              : 'border-transparent text-slate-300 hover:bg-slate-900/80'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${f.cls} shrink-0`} />
                          <span>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}



            {/* MỤC 5. THÔNG BÁO TOÀN MÁY CHỦ -> Phân loại kênh phát sóng máy chủ */}
            {activeTask === 'broadcast' && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-indigo-400 px-1 uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone className="w-3 h-3 text-indigo-400" />
                  <span>Kênh thông báo máy chủ:</span>
                </div>

                <button
                  type="button"
                  onClick={() => setBroadcastFilter('all')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    broadcastFilter === 'all'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <span>📢 Tất cả thông báo</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                    {broadcasts.length || 2}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastFilter('emergency')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    broadcastFilter === 'emergency'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-semibold text-rose-300">Thông báo khẩn cấp</div>
                    <div className="text-[10px] text-slate-400">Popup trực tiếp mọi thiết bị</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
                    Khẩn
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastFilter('maintenance')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    broadcastFilter === 'maintenance'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-semibold text-amber-300">Bảo trì hệ thống</div>
                    <div className="text-[10px] text-slate-400">Lịch nâng cấp máy chủ</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Bảo trì
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastFilter('news')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    broadcastFilter === 'news'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-semibold text-emerald-300">Tính năng & Tin mới</div>
                    <div className="text-[10px] text-slate-400">Cập nhật ứng dụng</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Tin tức
                  </span>
                </button>
              </div>
            )}

            {/* MỤC 6. BÁO CÁO TỐ CÁO */}
            {activeTask === 'reports' && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-slate-400 px-1 uppercase tracking-wider">
                  Trạng thái đơn tố cáo:
                </div>

                {/* Tất cả */}
                <button
                  type="button"
                  onClick={() => setReportFilter('all')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    reportFilter === 'all'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-rose-400" />
                    <span>Tất cả tố cáo</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {reports.length}
                  </span>
                </button>

                {/* Chờ xử lý */}
                <button
                  type="button"
                  onClick={() => setReportFilter('pending')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    reportFilter === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>⏳ Chờ xử lý</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {reports.filter(r => r.status === 'pending').length}
                  </span>
                </button>

                {/* Đã giải quyết */}
                <button
                  type="button"
                  onClick={() => setReportFilter('resolved')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    reportFilter === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>✅ Đã giải quyết</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    {reports.filter(r => r.status === 'resolved').length}
                  </span>
                </button>

                {/* Đã bỏ qua */}
                <button
                  type="button"
                  onClick={() => setReportFilter('dismissed')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all border ${
                    reportFilter === 'dismissed'
                      ? 'bg-slate-800 text-white border-slate-600 font-semibold'
                      : 'bg-slate-900/60 hover:bg-slate-850 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>✖️ Đã bỏ qua</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {reports.filter(r => r.status === 'dismissed').length}
                  </span>
                </button>
              </div>
            )}

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. KHUNG Ở GIỮA (Danh Sách Bản Ghi hiển thị các mục tương ứng) */}
        {/* ========================================================================= */}
        <section 
          id="datastore-frame-middle"
          className="flex-1 min-w-0 border-b md:border-b-0 border-slate-800 bg-slate-950/20 p-3 sm:p-4 flex flex-col overflow-hidden"
        >
          {activeTask === 'broadcast' ? (
            /* SOẠN THÔNG BÁO TOÀN MÁY CHỦ TRỰC TIẾP TRONG KHUNG GIỮA */
            <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4 overflow-y-auto">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-3">
                <Megaphone className="w-6 h-6 text-indigo-400 shrink-0" />
                <div>
                  <strong className="text-white text-sm block">📢 Soạn Tin Thông Báo Toàn Máy Chủ:</strong>
                  <span>Đẩy tin nhắn thông báo tức thì lên màn hình của tất cả các máy khách đang kết nối đến hệ thống.</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Loại thông báo:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastType('emergency')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        broadcastType === 'emergency' ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      🚨 Khẩn cấp
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastType('maintenance')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        broadcastType === 'maintenance' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      ⚠️ Bảo trì
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastType('news')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        broadcastType === 'news' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      📢 Tin tức
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Tiêu đề thông báo:</label>
                  <input
                    type="text"
                    placeholder="VD: Cập nhật hệ thống hoặc Cảnh báo bảo mật..."
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Nội dung chi tiết thông điệp:</label>
                  <textarea
                    rows={5}
                    placeholder="Nhập nội dung cần thông báo đến toàn bộ người dùng và thiết bị..."
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {broadcastStatus && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{broadcastStatus}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  disabled={!broadcastTitle.trim() || !broadcastMsg.trim()}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Phát Thông Báo Toàn Máy Chủ Ngay</span>
                </button>
              </div>
            </div>
          ) : activeTask === 'rooms_users' && roomsUsersSubTab === 'rooms' && selectedItemId && selectedItemData ? (
            /* GIAO DIỆN PHÒNG CHAT TRỰC TIẾP DÀNH CHO DEV (LIVE STREAM & CÁC TAB CHI TIẾT) */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header của phòng chat trong DataStore */}
              <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-800/80 shrink-0 bg-slate-900/40 p-2.5 rounded-2xl mb-2">
                {/* HÀNG 1: Breadcrumb + Icon + Tên phòng & Badges + Live Console & Nút Xóa Phòng */}
                <div className="flex items-center justify-between gap-3 w-full min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95 shrink-0 border border-slate-700/70 shadow-sm"
                      title="Quay lại danh sách phòng"
                    >
                      <ChevronLeft className="w-4 h-4 text-emerald-400" />
                    </button>

                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm relative border border-white/10 overflow-hidden"
                        style={{ backgroundColor: (selectedItemData as any).avatarColor || '#10b981' }}
                      >
                        {(selectedItemData as any).avatar ? (
                          <img src={(selectedItemData as any).avatar} alt={(selectedItemData as any).name} className="w-full h-full object-cover" />
                        ) : (selectedItemData as any).id === 'public-relay-lounge' ? (
                          <img src={DEFAULT_GLOBAL_LOUNGE_AVATAR} alt="Đại Sảnh Toàn Cầu" className="w-full h-full object-cover" />
                        ) : (
                          <span>{((selectedItemData as any).name || 'P').charAt(0).toUpperCase()}</span>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-900 ${
                            (selectedItemData as any).isPrivate ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {(selectedItemData as any).isPrivate ? <Lock className="w-2 h-2" /> : <Globe className="w-2 h-2" />}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-100 truncate">
                            {(selectedItemData as any).name}
                          </span>
                          <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                            (selectedItemData as any).isPrivate 
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' 
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          }`}>
                            {(selectedItemData as any).isPrivate ? 'Private' : 'Public'}
                          </span>
                          {(selectedItemData as any).violationSeverity === 'light' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              🟢 Vi phạm: Nhẹ
                            </span>
                          )}
                          {(selectedItemData as any).violationSeverity === 'medium' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              🟡 Vi phạm: Bình Thường
                            </span>
                          )}
                          {(selectedItemData as any).violationSeverity === 'heavy' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              🟠 Vi phạm: Nặng
                            </span>
                          )}
                          {(selectedItemData as any).violationSeverity === 'critical' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600/20 text-red-300 border border-red-500/40 animate-pulse">
                              🔴 Vi phạm: Hết Cứu
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate flex items-center gap-2">
                          <span>Mã: <strong className="text-emerald-400">#{(selectedItemData as any).code}</strong></span>
                          <span className="text-slate-600">•</span>
                          <span>Tạo bởi: {(selectedItemData as any).createdByName || 'Hệ thống'}</span>
                          {(selectedItemData as any).violationReason && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-amber-400">{(selectedItemData as any).violationReason}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nhóm nút bên phải: Live Console badge + Xóa Phòng */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live Console</span>
                    </div>

                    {(selectedItemData as any).id !== 'public-relay-lounge' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom((selectedItemData as any).id)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Xóa vĩnh viễn phòng này"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">Xóa Phòng</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* HÀNG 2: THANH SEGMENTED CONTROL GỌN GÀNG, ĐỒNG BỘ */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setRoomDetailsTab('chat')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'chat'
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomDetailsTab('users')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'users'
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Thành Viên</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700/60 font-mono text-slate-300">
                      {roomUsersList.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomDetailsTab('messages');
                      setAuditFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'messages' && auditFilter === 'all'
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                    title="Xem toàn bộ tổng số tin nhắn lưu trữ kiểm toán"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Tin Nhắn</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700/60 font-mono text-slate-300">
                      {roomMessages.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomDetailsTab('messages');
                      setAuditFilter('deleted');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'messages' && auditFilter === 'deleted'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900'
                    }`}
                    title="Xem danh sách tin nhắn mà Client đã xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Đã Xóa</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 font-mono text-amber-300">
                      {roomMessagesDeletedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomDetailsTab('messages');
                      setAuditFilter('warned');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'messages' && auditFilter === 'warned'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900'
                    }`}
                    title="Xem danh sách tin nhắn bị cảnh cáo vi phạm"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cảnh Báo</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/30 font-mono text-rose-300">
                      {roomMessagesWarnedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomDetailsTab('images')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      roomDetailsTab === 'images'
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Hình Ảnh</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700/60 font-mono text-slate-300">
                      {roomImagesList.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* TAB 1: LIVE CHAT */}
              {roomDetailsTab === 'chat' && (
                <>
                  {/* Danh sách tin nhắn phòng chat hiển thị dạng Bong Bóng Khí Chuẩn Hình 2 (Không che từ cấm) */}
              <div 
                ref={messagesScrollRef}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800"
              >
                {roomMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/80 rounded-2xl bg-slate-900/20 text-slate-400">
                    <MessageSquare className="w-10 h-10 text-slate-600 mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-slate-300">Chưa có tin nhắn nào trong phòng này.</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                      Bạn có thể gửi tin nhắn đầu tiên bên dưới với tư cách DEV (Không cần nhập mã PIN để vào phòng).
                    </p>
                  </div>
                ) : (
                  roomMessages.map((msg) => {
                    const isDevMsg = msg.isDevMessage || isDevUser(msg.senderEmail) || (msg.senderName && msg.senderName.includes('DEV'));
                    const isWarned = !!(msg.hasProfanity || msg.hasWarning || msg.isReported);
                    const isDeleted = !!(msg.deletedBySender || msg.isDeletedBySender);

                    return (
                      <div
                        key={msg.id}
                        className={`chat-bubble-item flex flex-col ${isDevMsg ? 'items-end' : 'items-start'} group w-full`}
                      >
                        {/* THÔNG TIN NGƯỜI GỬI PHÍA TRÊN BONG BÓNG (KHỚP 100% CẤU TRÚC HÌNH 2) */}
                        {isDevMsg ? (
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400 justify-end flex-wrap">
                            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-emerald-500 p-0.5 flex items-center justify-center shadow-sm">
                              <Crown className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
                            </div>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice });
                              }}
                              className="font-extrabold text-xs bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent truncate cursor-pointer hover:underline"
                            >
                              {msg.senderName}
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-0.5">
                              👑 DEV CHÍNH CHỦ
                            </span>
                            {msg.senderDevice && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-mono truncate max-w-[140px]">{msg.senderDevice}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-slate-500 font-mono">
                              {formatMessageTime(msg.createdAt, msg.timestamp)}
                            </span>

                            {isWarned && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span>Cảnh cáo</span>
                              </span>
                            )}

                            {isDeleted && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <Trash2 className="w-2.5 h-2.5 text-amber-400" />
                                <span>Client đã xóa</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400 flex-wrap">
                            {(() => {
                              const matchedSender = evaluatedUsers.find(eu => eu.uid === msg.senderId || (msg.senderEmail && eu.email?.toLowerCase() === msg.senderEmail.toLowerCase()));
                              const resolvedAvatar = msg.senderAvatar || matchedSender?.customAvatarUrl || matchedSender?.avatarUrl || matchedSender?.photoURL;
                              const resolvedColor = msg.senderAvatarColor || matchedSender?.avatarColor || '#334155';
                              return (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice });
                                  }}
                                  className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[9px] text-white font-bold shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-400 overflow-hidden"
                                  style={{ backgroundColor: resolvedColor }}
                                  title="Nhấp để chuyển sang xem người dùng này"
                                >
                                  {resolvedAvatar ? (
                                    <img src={resolvedAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                                  ) : (
                                    msg.senderName?.charAt(0).toUpperCase() || 'U'
                                  )}
                                </div>
                              );
                            })()}
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice });
                              }}
                              className="font-semibold text-slate-200 cursor-pointer hover:underline hover:text-emerald-400 transition-colors"
                            >
                              {msg.senderName}
                            </span>
                            {msg.senderDevice && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-mono truncate max-w-[140px]">{msg.senderDevice}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-slate-500 font-mono">
                              {formatMessageTime(msg.createdAt, msg.timestamp)}
                            </span>

                            {isWarned && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span>Cảnh cáo vi phạm</span>
                              </span>
                            )}

                            {isDeleted && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <Trash2 className="w-2.5 h-2.5 text-amber-400" />
                                <span>Client đã xóa</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* BONG BÓNG TIN NHẮN THEO ĐÚNG CẤU TRÚC HÌNH 2 */}
                        <div
                          className={`max-w-[85%] sm:max-w-md md:max-w-xl rounded-2xl px-4 py-2.5 space-y-1.5 shadow-sm text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
                            isDevMsg
                              ? 'rounded-tr-sm bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/50 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10 ring-1 ring-emerald-500/40 text-white'
                              : isWarned
                              ? 'rounded-tl-sm bg-rose-950/30 border-2 border-rose-500 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/50 text-rose-100'
                              : isDeleted
                              ? 'rounded-tl-sm bg-slate-850 text-slate-200 border border-amber-500/40 shadow-sm'
                              : 'rounded-tl-sm bg-slate-800 text-slate-100 border border-slate-700/60 shadow-sm'
                          }`}
                        >
                          {/* Banner Thông điệp từ Nhà Phát Triển (DEV) màu vàng hổ phách khớp chuẩn Hình 2 */}
                          {isDevMsg && (
                            <div className="flex items-center gap-1.5 pb-1 border-b border-amber-500/20 text-[10px] text-amber-300 font-semibold">
                              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>Thông điệp từ Nhà Phát Triển (DEV)</span>
                            </div>
                          )}

                          {/* Nội dung tin nhắn (Trong DataStore hiển thị 100% nội dung gốc rawText không che) */}
                          <div className="select-text font-normal">
                            {unwrapSecureBase64Message(msg.rawText || msg.text || '')}
                          </div>

                          {/* Đính kèm hình ảnh hoặc tệp tin chuẩn Hình 2 */}
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => {
                                const imgSrc = att.data || att.url;
                                const isImg = att.type?.startsWith('image/') || (att.data && att.data.startsWith('data:image')) || (att.url && att.url.includes('/view/'));
                                return isImg && imgSrc ? (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewImage(att.url || att.data)}
                                    className="group relative rounded-xl overflow-hidden border border-slate-700/80 cursor-pointer hover:border-emerald-500/60 transition-all shadow-md bg-slate-950"
                                  >
                                    <img 
                                      src={imgSrc} 
                                      alt={att.name || 'Ảnh đính kèm'} 
                                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover group-hover:scale-105 transition-transform" 
                                    />
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 px-1 py-0.5 text-[8px] text-slate-300 font-mono truncate">
                                      {att.name}
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    key={idx} 
                                    href={att.url || att.data}
                                    download={att.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 hover:border-emerald-500 transition-all group/file shadow-sm"
                                  >
                                    <FileText className="w-4 h-4 text-emerald-400 group-hover/file:scale-110 transition-transform" />
                                    <span className="font-mono text-xs truncate max-w-[180px] font-semibold">{att.name}</span>
                                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover/file:text-emerald-400 ml-auto" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* KHUNG NHẮN TIN TRỰC TIẾP DÀNH CHO DEV - TÍCH HỢP ĐÍNH KÈM TỆP & ẢNH CHUẨN PHÒNG CHAT */}
              <div className="p-2.5 sm:p-3 bg-slate-900/95 border-t border-slate-800 shrink-0 flex flex-col gap-2 rounded-b-2xl">
                {/* Ẩn input chọn tệp & hình ảnh */}
                <input 
                  type="file" 
                  ref={devFileInputRef} 
                  onChange={handleDevFileSelect} 
                  multiple 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={devImageInputRef} 
                  onChange={handleDevFileSelect} 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                />

                {/* Thanh hiển thị danh sách đính kèm đang chờ gửi */}
                {devAttachments.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 px-1">
                    {devAttachments.map((att, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 shrink-0 shadow-sm"
                      >
                        {att.type?.startsWith('image/') ? (
                          <div className="w-5 h-5 rounded overflow-hidden bg-slate-900 shrink-0">
                            <img src={att.data} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <Paperclip className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-mono text-[11px] truncate max-w-[120px]">{att.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({formatFileSize(att.size)})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDevAttachment(idx)}
                          className="w-4 h-4 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDevAttachments([])}
                      className="text-[10px] text-rose-400 hover:underline px-2 py-0.5 shrink-0"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendDevMessage} className="flex items-center gap-2">
                  {/* Nút đính kèm tệp */}
                  <button
                    type="button"
                    onClick={() => devFileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700/70 transition-all active:scale-95 shadow-sm shrink-0"
                    title="Đính kèm tệp tài liệu"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                  </button>

                  {/* Nút gửi ảnh */}
                  <button
                    type="button"
                    onClick={() => devImageInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700/70 transition-all active:scale-95 shadow-sm shrink-0"
                    title="Đính kèm hình ảnh"
                  >
                    <Camera className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                  </button>

                  {/* Ô nhập nội dung tin nhắn có gắn badge DEV trực tiếp */}
                  <div className="flex-1 relative flex items-center">
                    <div className="absolute left-2.5 flex items-center gap-1 pointer-events-none select-none z-10">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> DEV
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Nhắn tin với tư cách DEV (Miễn trừ PIN)..."
                      value={devInputText}
                      onChange={(e) => setDevInputText(e.target.value)}
                      className="w-full pl-20 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors shadow-inner"
                    />
                  </div>

                  {/* Nút Gửi */}
                  <button
                    type="submit"
                    disabled={(!devInputText.trim() && devAttachments.length === 0) || isSendingDevMessage}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Gửi</span>
                  </button>
                </form>
              </div>
            </>
          )}

          {/* TAB 2: DANH SÁCH NGƯỜI DÙNG PHÒNG CHAT */}{/* TAB 2: DANH SÁCH NGƯỜI DÙNG PHÒNG CHAT */}
          {roomDetailsTab === 'users' && (
            <div className="flex-1 overflow-y-auto space-y-2.5 p-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
              {roomUsersList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  Chưa ghi nhận người dùng nào tham gia phòng này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {roomUsersList.map((user) => (
                    <div 
                      key={user.uid} 
                      onClick={() => handleNavigateToUser(user.uid, user)}
                      className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-850 hover:border-emerald-500/50 transition-all group shadow-sm"
                      title="Nhấp để xem chi tiết người dùng này trong tab Những Người Dùng"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 relative group-hover:scale-105 transition-transform overflow-hidden"
                          style={{ backgroundColor: user.avatarColor || '#10b981' }}
                        >
                          {((user as any).customAvatarUrl || (user as any).avatarUrl || (user as any).photoURL) ? (
                            <img src={(user as any).customAvatarUrl || (user as any).avatarUrl || (user as any).photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            user.displayName?.charAt(0).toUpperCase() || 'U'
                          )}
                          {user.onlineStatus?.isOnline && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 absolute -bottom-0.5 -right-0.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs sm:text-sm text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                              {user.displayName}
                            </span>
                            {user.role === 'owner' && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Chủ phòng
                              </span>
                            )}
                            {user.role === 'dev' && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                👑 DEV
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                            {user.deviceName || 'Thiết bị'} • {user.messageCount} tin nhắn
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${user.onlineStatus?.color}`}>
                          {user.onlineStatus?.badgeText}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TOÀN BỘ NỘI DUNG NHẮN / KIỂM TOÁN VỚI 3 TAB (TỔNG TIN NHẮN, SỐ TIN NHẮN ĐÃ XÓA, CẢNH CÁO) */}
          {roomDetailsTab === 'messages' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5 p-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/80">
                {/* 3 Tab Kiểm Toán: Tab 1: Tổng tin nhắn, Tab 2: Số tin nhắn đã xóa, Tab 3: Cảnh cáo */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setAuditFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      auditFilter === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tổng tin nhắn ({roomMessages.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter('deleted')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      auditFilter === 'deleted'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-amber-300'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Số tin nhắn đã xóa ({roomMessagesDeletedCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditFilter('warned')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      auditFilter === 'warned'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-rose-300'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cảnh cáo ({roomMessagesWarnedCount})</span>
                  </button>
                </div>

                <div className="relative flex-1 w-full max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Lọc nội dung kiểm toán..."
                    value={roomMsgSearchQuery}
                    onChange={(e) => setRoomMsgSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 p-2 sm:p-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
                {filteredRoomMessages.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                    Không tìm thấy tin nhắn nào phù hợp với bộ lọc kiểm toán.
                  </div>
                ) : (
                  filteredRoomMessages.map((msg) => {
                    const isDevMsg = msg.isDevMessage || isDevUser(msg.senderEmail) || (msg.senderName && msg.senderName.includes('DEV'));
                    const isMsgDeleted = !!(msg.deletedBySender || msg.isDeletedBySender);
                    const isMsgWarned = !!(msg.hasProfanity || msg.hasWarning || msg.isReported);

                    return (
                      <div 
                        key={msg.id} 
                        className={`chat-bubble-item flex flex-col ${isDevMsg ? 'items-end' : 'items-start'} group w-full`}
                      >
                        {/* THÔNG TIN NGƯỜI GỬI PHÍA TRÊN BONG BÓNG */}
                        {isDevMsg ? (
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400 justify-end flex-wrap">
                            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-emerald-500 p-0.5 flex items-center justify-center shadow-sm">
                              <Crown className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
                            </div>
                            <span 
                              onClick={() => handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice })}
                              className="font-extrabold text-xs bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent truncate cursor-pointer hover:underline"
                            >
                              {msg.senderName}
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                              👑 DEV CHÍNH CHỦ
                            </span>
                            {msg.senderDevice && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-mono truncate max-w-[140px]">{msg.senderDevice}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-slate-500 font-mono">
                              {formatMessageTime(msg.createdAt, msg.timestamp)}
                            </span>

                            {isMsgWarned && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span>Cảnh cáo</span>
                              </span>
                            )}

                            {isMsgDeleted && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <Trash2 className="w-2.5 h-2.5 text-amber-400" />
                                <span>Client đã xóa</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteRoomMessage(msg.id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                              title="Xóa tin nhắn này khỏi phòng hiển thị của Client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400 flex-wrap">
                            <div 
                              onClick={() => handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice })}
                              className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] text-slate-300 font-bold shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-400"
                              title="Nhấp để chuyển sang xem người dùng này"
                            >
                              {msg.senderName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span 
                              onClick={() => handleNavigateToUser(msg.senderId, { displayName: msg.senderName, email: msg.senderEmail, deviceName: msg.senderDevice })}
                              className="font-semibold text-slate-200 cursor-pointer hover:underline hover:text-emerald-400 transition-colors"
                            >
                              {msg.senderName}
                            </span>
                            {msg.senderDevice && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-mono truncate max-w-[140px]">{msg.senderDevice}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-slate-500 font-mono">
                              {formatMessageTime(msg.createdAt, msg.timestamp)}
                            </span>

                            {isMsgWarned && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span>Cảnh cáo</span>
                              </span>
                            )}

                            {isMsgDeleted && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 font-bold ml-1">
                                <Trash2 className="w-2.5 h-2.5 text-amber-400" />
                                <span>Client đã xóa</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteRoomMessage(msg.id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                              title="Xóa tin nhắn này khỏi phòng hiển thị của Client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* BONG BÓNG TIN NHẮN (KHỚP 100% CẤU TRÚC HÌNH 2) */}
                        <div
                          className={`max-w-[85%] sm:max-w-md md:max-w-xl rounded-2xl px-4 py-2.5 space-y-1.5 shadow-sm text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
                            isDevMsg
                              ? 'rounded-tr-sm bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/50 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10 ring-1 ring-emerald-500/40 text-white'
                              : isMsgWarned
                              ? 'rounded-tl-sm bg-rose-950/30 border-2 border-rose-500 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/50 text-rose-100'
                              : isMsgDeleted
                              ? 'rounded-tl-sm bg-slate-850 text-slate-200 border border-amber-500/40 shadow-sm'
                              : 'rounded-tl-sm bg-slate-800 text-slate-100 border border-slate-700/60 shadow-sm'
                          }`}
                        >
                          {isDevMsg && (
                            <div className="flex items-center gap-1.5 pb-1 border-b border-amber-500/20 text-[10px] text-amber-300 font-semibold">
                              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>Thông điệp từ Nhà Phát Triển (DEV)</span>
                            </div>
                          )}

                          {/* Nội dung nguyên bản 100% không che */}
                          <div className="select-text font-normal">
                            {unwrapSecureBase64Message(msg.rawText || msg.text || '')}
                          </div>

                          {/* Đính kèm hình ảnh hoặc tệp tin */}
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => {
                                const imgSrc = att.data || att.url;
                                const isImg = att.type?.startsWith('image/') || (att.data && att.data.startsWith('data:image')) || (att.url && att.url.includes('/view/'));
                                return isImg && imgSrc ? (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewImage(att.url || att.data)}
                                    className="group relative rounded-xl overflow-hidden border border-slate-700/80 cursor-pointer hover:border-emerald-500/60 transition-all shadow-md bg-slate-950"
                                  >
                                    <img 
                                      src={imgSrc} 
                                      alt={att.name || 'Ảnh đính kèm'} 
                                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover group-hover:scale-105 transition-transform" 
                                    />
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 px-1 py-0.5 text-[8px] text-slate-300 font-mono truncate">
                                      {att.name}
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    key={idx} 
                                    href={att.url || att.data}
                                    download={att.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 hover:border-emerald-500 transition-all group/file shadow-sm"
                                  >
                                    <FileText className="w-4 h-4 text-emerald-400 group-hover/file:scale-110 transition-transform" />
                                    <span className="font-mono text-xs truncate max-w-[180px] font-semibold">{att.name}</span>
                                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover/file:text-emerald-400 ml-auto" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HÌNH ẢNH ĐÃ GỬI (LƯU GIỮ VĨNH VIỄN CẢ ẢNH ĐÃ XÓA & 18+) */}
          {roomDetailsTab === 'images' && (
            <div className="flex-1 overflow-y-auto p-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
              {roomImagesList.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                  <ImageIcon className="w-10 h-10 text-slate-600 mb-2" />
                  <span>Chưa có hình ảnh nào được gửi trong phòng này.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {roomImagesList.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setPreviewImage(img.url)}
                      className={`group relative rounded-2xl overflow-hidden border bg-slate-950 cursor-pointer transition-all shadow-md aspect-square ${
                        img.isWarned ? 'border-rose-500/60 hover:border-rose-400 ring-1 ring-rose-500/40' : 'border-slate-800 hover:border-emerald-500'
                      }`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-5 h-5 text-white" />
                      </div>

                      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                        {img.isDeleted && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/90 text-slate-950 font-bold shadow">
                            Client đã xóa
                          </span>
                        )}
                        {img.isWarned && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-600/90 text-white font-bold shadow">
                            Cảnh cáo
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 px-2 py-1 text-[10px] text-slate-300 font-mono flex items-center justify-between">
                        <span className="truncate max-w-[90px]">{img.senderName}</span>
                        <span className="text-slate-500">{formatMessageTime(img.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTask === 'rooms_users' && roomsUsersSubTab === 'users' && selectedItemId && selectedItemData ? (
        /* GIAO DIỆN QUẢN TRỊ NGƯỜI DÙNG TOÀN DIỆN CHO DEV (ĐỒNG BỘ WORKSPACE PHÒNG CHAT) */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header người dùng */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0 gap-2.5 bg-slate-900/40 p-2.5 rounded-2xl mb-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 transition-all active:scale-95 shrink-0 shadow-sm"
                title="Quay lại danh sách người dùng"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-sky-400" />
                <span>Danh Sách Người Dùng</span>
              </button>

              <div className="h-4 w-px bg-slate-800 shrink-0" />

              <div className="min-w-0 flex items-center gap-2.5 flex-1">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm relative border border-white/10 overflow-hidden"
                  style={{ backgroundColor: (selectedItemData as any).avatarColor || '#0284c7' }}
                >
                  {((selectedItemData as any).customAvatarUrl || (selectedItemData as any).avatarUrl || (selectedItemData as any).photoURL) ? (
                    <img src={(selectedItemData as any).customAvatarUrl || (selectedItemData as any).avatarUrl || (selectedItemData as any).photoURL} alt={(selectedItemData as any).displayName} className="w-full h-full object-cover" />
                  ) : (
                    (selectedItemData as any).displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                  {(selectedItemData as any).onlineCheck?.isOnline && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 absolute -bottom-0.5 -right-0.5 animate-pulse" />
                  )}
                </div>

                <div className="truncate min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                      {(selectedItemData as any).displayName}
                    </span>
                    {isDevUser((selectedItemData as any).email) && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>DEV Quản Trị</span>
                      </span>
                    )}
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0 ${(selectedItemData as any).onlineCheck?.color}`}>
                      {(selectedItemData as any).onlineCheck?.badgeText || 'Offline'}
                    </span>
                    {/* Vi phạm nếu có */}
                    {(selectedItemData as any).violationSeverity === 'light' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        🟢 Vi phạm: Nhẹ
                      </span>
                    )}
                    {(selectedItemData as any).violationSeverity === 'medium' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        🟡 Vi phạm: Bình Thường
                      </span>
                    )}
                    {(selectedItemData as any).violationSeverity === 'heavy' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        🟠 Vi phạm: Nặng
                      </span>
                    )}
                    {(selectedItemData as any).violationSeverity === 'critical' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500 animate-pulse">
                        🔴 Hết Cứu
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                    <span className="text-slate-300">{(selectedItemData as any).email || 'Khách vãng lai'}</span>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px]">UID:</span>
                      <span className="text-sky-300 text-[10px] font-mono truncate max-w-[140px] sm:max-w-[200px]">
                        {(selectedItemData as any).uid || (selectedItemData as any).id}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText((selectedItemData as any).uid || (selectedItemData as any).id);
                          setCopiedUid(true);
                          setTimeout(() => setCopiedUid(false), 2000);
                        }}
                        className="text-slate-400 hover:text-white ml-0.5"
                        title="Sao chép UUID người dùng"
                      >
                        {copiedUid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nút hành động nhanh */}
            <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
              {!isDevUser((selectedItemData as any).email) && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser((selectedItemData as any).uid || (selectedItemData as any).id, (selectedItemData as any).displayName, (selectedItemData as any).email)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  title="Xóa tài khoản này khỏi Firestore"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Xóa tài khoản</span>
                </button>
              )}
            </div>
          </div>

          {/* Thanh 2 Tab Người Dùng: Thiết Bị & Hồ Sơ, Nhật Ký Tin Nhắn */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setUserDetailsTab('info')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                userDetailsTab === 'info'
                  ? 'bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Thiết Bị & Hồ Sơ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700/60 text-slate-300 font-mono">
                {userDevicesList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setUserDetailsTab('messages')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                userDetailsTab === 'messages'
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Nhật Ký Tin Nhắn</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700/60 text-slate-300 font-mono">
                {userMessages.length}
              </span>
            </button>
          </div>

          {/* TAB 1: THÔNG TIN VÀ THIẾT BỊ ĐĂNG NHẬP */}
          {userDetailsTab === 'info' && (
            <div className="flex-1 overflow-y-auto space-y-4 p-2 sm:p-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Thẻ tóm tắt thông tin hồ sơ (Thiết Bị & Hồ Sơ) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Họ Tên / Tên đệm / Biệt Danh</div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>{(selectedItemData as any).displayName || 'Người dùng'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Tên Tài Khoản (Username)</div>
                  <div className="text-sm font-semibold text-slate-200 font-mono truncate">
                    {(selectedItemData as any).username || (selectedItemData as any).email?.split('@')[0] || (selectedItemData as any).displayName || 'user'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Ngày / Tháng / Năm Đăng Ký</div>
                  <div className="text-xs font-mono text-emerald-400 font-semibold">
                    {(selectedItemData as any).createdAt ? new Date((selectedItemData as any).createdAt).toLocaleDateString('vi-VN', { dateStyle: 'full' }) : 'Hôm nay / Phiên hiện tại'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Số Điện Thoại (SĐT)</div>
                  <div className="text-sm font-mono text-slate-200">
                    {(selectedItemData as any).phone || (selectedItemData as any).phoneNumber || <span className="text-slate-500 italic">Chưa cập nhật SĐT</span>}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Gmail / Email Liên Kết</div>
                  <div className="text-sm font-semibold text-slate-200 truncate font-mono">
                    {(selectedItemData as any).email || <span className="text-slate-500 italic">Chưa liên kết</span>}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-400 font-medium">Tổng Tin Nhắn Hoạt Động</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {userMessages.length} tin nhắn (qua hệ thống)
                  </div>
                </div>
              </div>

              {/* Bảng danh sách thiết bị đã đăng nhập của người dùng */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-400">
                    <Laptop className="w-4 h-4" />
                    <h4 className="text-xs sm:text-sm font-bold">Danh Sách Thiết Bị Đã Đăng Nhập ({userDevicesList.length})</h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Real-time Device Sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {userDevicesList.map((dev: any) => (
                    <div 
                      key={dev.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-sky-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                          {dev.type === 'mobile' ? <Smartphone className="w-4 h-4" /> : dev.type === 'tablet' ? <Tablet className="w-4 h-4" /> : dev.type === 'tv' ? <Tv className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                            <span>{dev.name}</span>
                            {dev.isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                                Đang dùng
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                            Hoạt động: {dev.lastSeen ? formatMessageTime(dev.lastSeen) : 'Vừa xong'} {dev.ip ? `• IP: ${dev.ip}` : ''}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                        dev.status === 'online' 
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}>
                        {dev.status === 'online' ? '🟢 Online' : '⚪ Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NHẬT KÝ TOÀN BỘ TIN NHẮN CỦA NGƯỜI DÙNG */}
          {userDetailsTab === 'messages' && (
            <div className="flex-1 overflow-y-auto space-y-2.5 p-2 sm:p-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
              {userMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  Người dùng này chưa gửi tin nhắn nào trên toàn bộ hệ thống.
                </div>
              ) : (
                userMessages.map((msg) => {
                  const isMsgWarned = msg.hasWarning || (msg as any).isWarned;
                  const isMsgDeleted = msg.deletedBySender || msg.isDeletedBySender || (msg as any).isDeleted;

                  return (
                    <div 
                      key={msg.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isMsgWarned 
                          ? 'bg-rose-950/20 border-rose-500/40 text-rose-200' 
                          : isMsgDeleted
                          ? 'bg-amber-950/15 border-amber-500/30 text-amber-200'
                          : 'bg-slate-900/70 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">Phòng: #{msg.roomId}</span>
                          <span>•</span>
                          <span>{formatMessageTime(msg.createdAt, msg.timestamp)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isMsgDeleted && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Client đã xóa
                            </span>
                          )}
                          {isMsgWarned && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Đã cảnh cáo
                            </span>
                          )}
                        </div>
                      </div>

                    <div className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
                      {unwrapSecureBase64Message(msg.text || msg.rawText || '') || (msg.fileUrl ? '📁 Đính kèm tập tin/hình ảnh' : 'Tin nhắn trống')}
                    </div>

                    {msg.fileUrl && (
                      <div className="mt-2">
                        {msg.fileType?.startsWith('image/') || msg.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={msg.fileUrl} alt={msg.fileName || 'Ảnh đính kèm'} className="max-h-40 rounded-xl border border-slate-800 object-cover" />
                        ) : (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline flex items-center gap-1">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{msg.fileName || 'Xem tệp đính kèm'}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            </div>
          )}
        </div>
      ) : (
            /* HIỂN THỊ DANH SÁCH BẢN GHI (KHI CHƯA CHỌN PHÒNG HOẶC TÁC VỤ KHÁC) */
            <>
              {/* Header & Thanh tìm kiếm Khung Giữa */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-800/60 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-emerald-400">
                    <FileText className="w-4 h-4 shrink-0" />
                    <h3 className="text-xs sm:text-sm font-bold tracking-wide text-slate-100">
                      {activeTask === 'rooms_users' && roomsUsersSubTab === 'rooms' && `Danh Sách Phòng Chat (${filteredItems.length})`}
                      {activeTask === 'rooms_users' && roomsUsersSubTab === 'users' && `Danh Sách Người Dùng (${filteredItems.length})`}
                      {activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators' && `Vi Phạm & Kiểm Duyệt OpenAI (${filteredItems.length})`}
                      {activeTask === 'violators_banned' && violatorsBannedSubTab === 'banned' && `Danh Sách Đang Bị Khóa (${filteredItems.length})`}
                      {activeTask === 'reports' && `Danh Sách Tố Cáo & Khiếu Nại (${filteredItems.length})`}
                    </h3>
                  </div>

                  {/* Ô tìm kiếm nhanh & nút tác vụ */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {activeTask === 'violators_banned' && (
                      <button
                        type="button"
                        onClick={handleStartOpenAiModeration}
                        disabled={isBatchAuditing}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 whitespace-nowrap cursor-pointer"
                        title="Bắt đầu kiểm duyệt tự động bằng OpenAI Moderation và phân loại vào các tab vi phạm"
                      >
                        {isBatchAuditing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isBatchAuditing ? 'Đang kiểm duyệt...' : 'Kiểm Duyệt'}</span>
                      </button>
                    )}

                    {activeTask === 'rooms_users' && roomsUsersSubTab === 'rooms' && rooms.some(r => r.id !== 'public-relay-lounge') && (
                      <button
                        type="button"
                        onClick={handlePurgeTestRooms}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 whitespace-nowrap"
                        title="Xóa tất cả phòng thử nghiệm / phòng không thật, chỉ giữ lại Đại Sảnh Toàn Cầu"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Dọn phòng test</span>
                      </button>
                    )}

                    {activeTask === 'rooms_users' && roomsUsersSubTab === 'users' && (
                      <button
                        type="button"
                        onClick={handlePurgeTestUsers}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 whitespace-nowrap"
                        title="Dọn dẹp và xóa các tài khoản thử nghiệm / tài khoản không thật khỏi Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Dọn tài khoản test</span>
                      </button>
                    )}

                    <div className="relative min-w-[180px] max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm nhanh..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Thanh chuyển nhanh Phòng Chat / Người Dùng ngay trong header danh sách */}
                {activeTask === 'rooms_users' && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => { setRoomsUsersSubTab('rooms'); setSelectedItemId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          roomsUsersSubTab === 'rooms'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Phòng Chat ({roomsWithViolations.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRoomsUsersSubTab('users'); setSelectedItemId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          roomsUsersSubTab === 'users'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Người Dùng ({evaluatedUsersWithViolations.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Thanh phân loại mức độ vi phạm & chuyển Vi Phạm / Đã Khóa ngay trong danh sách */}
                {activeTask === 'violators_banned' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => { setViolatorsBannedSubTab('violators'); setSelectedItemId(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          violatorsBannedSubTab === 'violators'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Vi Phạm
                      </button>
                      <button
                        type="button"
                        onClick={() => { setViolatorsBannedSubTab('banned'); setSelectedItemId(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          violatorsBannedSubTab === 'banned'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Đã Khóa ({sanctions.filter(s => s.isBanned).length})
                      </button>
                    </div>

                    {violatorsBannedSubTab === 'violators' && (
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none p-1 rounded-xl bg-slate-900/90 border border-slate-800">
                        {[
                          { key: 'all' as const, label: 'Tất cả', count: violatorTarget === 'users' ? countUserSeverity.all : countRoomSeverity.all },
                          { key: 'light' as const, label: 'Nhẹ', count: violatorTarget === 'users' ? countUserSeverity.light : countRoomSeverity.light },
                          { key: 'medium' as const, label: 'Bình Thường', count: violatorTarget === 'users' ? countUserSeverity.medium : countRoomSeverity.medium },
                          { key: 'heavy' as const, label: 'Nặng', count: violatorTarget === 'users' ? countUserSeverity.heavy : countRoomSeverity.heavy },
                          { key: 'critical' as const, label: 'Hết Cứu', count: violatorTarget === 'users' ? countUserSeverity.critical : countRoomSeverity.critical }
                        ].map(sevTab => (
                          <button
                            key={sevTab.key}
                            type="button"
                            onClick={() => { setViolatorFilter(sevTab.key); setSelectedItemId(null); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap tabular-nums ${
                              violatorFilter === sevTab.key
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {sevTab.label} ({sevTab.count})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTask === 'violators_banned' && batchAuditSummary && (
                  <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-amber-500/30 text-xs text-slate-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Kết quả <strong>{batchAuditSummary.source}</strong> lúc {batchAuditSummary.timestamp}: quét{' '}
                        <span className="font-mono tabular-nums text-slate-100">{batchAuditSummary.totalScanned}</span> đối tượng · phát hiện{' '}
                        <span className="font-mono tabular-nums text-amber-300 font-bold">{batchAuditSummary.flaggedCount}</span> vi phạm.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Banner cảnh báo người dùng vi phạm nghiêm trọng nhất - Hiển thị tập trung tại Tab 3 Các Vi Phạm */}
              {activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators' && worstViolatorUser && (
                <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-red-950/50 via-rose-950/40 to-slate-900 border border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-red-300 flex items-center gap-2">
                        <span>⚠️ Người Vi Phạm Nghiêm Trọng Cần Xử Lý:</span>
                        <span className="text-white underline">{worstViolatorUser.displayName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {worstViolatorUser.violationReason || 'Có hành vi vi phạm điều luật cộng đồng mức độ cao'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const targetId = worstViolatorUser.uid || worstViolatorUser.id;
                      setViolatorTarget('users');
                      setSelectedItemId(targetId);
                      fetchViolationDetailsForTarget(targetId, 'users');
                      setShowDetailModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <span>Xem Chi Tiết Vi Phạm &gt;</span>
                  </button>
                </div>
              )}

              {/* Danh sách cuộn của Khung Giữa */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {filteredItems.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/80 rounded-2xl bg-slate-900/20">
                    <Info className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs sm:text-sm text-slate-400">Không tìm thấy bản ghi nào phù hợp bộ lọc.</p>
                  </div>
                ) : (
                  filteredItems.map((item: any) => {
                    const itemId = item.id || item.uid;
                    const isSelected = selectedItemId === itemId;

                    return (
                      <div
                        key={itemId}
                        id={`record-item-${itemId}`}
                        onClick={() => {
                          setSelectedItemId(itemId);
                          if (activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators') {
                            fetchViolationDetailsForTarget(itemId, violatorTarget);
                            setShowDetailModal(true);
                            return;
                          }
                          if (activeTask !== 'rooms_users') {
                            setShowDetailModal(true);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-slate-850 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-md'
                            : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* TH1: HIỂN THỊ PHÒNG CHAT (CÁC PHÒNG CHAT - TAB 1) */}
                        {activeTask === 'rooms_users' && roomsUsersSubTab === 'rooms' && (
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm relative border border-white/10 overflow-hidden"
                                style={{ backgroundColor: item.avatarColor || '#10b981' }}
                              >
                                {item.avatar ? (
                                  <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                                ) : item.id === 'public-relay-lounge' ? (
                                  <img src={DEFAULT_GLOBAL_LOUNGE_AVATAR} alt="Đại Sảnh Toàn Cầu" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(item.name || 'P').charAt(0).toUpperCase()}</span>
                                )}
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 ${
                                    item.isPrivate ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                                  }`}
                                >
                                  {item.isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                    {item.name}
                                  </span>
                                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                                    item.isPrivate ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  }`}>
                                    {item.isPrivate ? 'Private' : 'Public'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                                  Mã: <strong className="text-emerald-400 font-bold">#{item.code}</strong> • Tạo bởi: {item.createdByName || 'Người dùng'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {item.id === 'public-relay-lounge' ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                  🏛️ Mặc định
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoom(item.id);
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors"
                                  title="Xóa vĩnh viễn phòng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className="text-[11px] text-emerald-400 font-medium hidden sm:inline hover:underline">
                                Nhấp để vào chat &gt;
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                          </div>
                        )}

                        {/* TH2: HIỂN THỊ NGƯỜI DÙNG (NHỮNG NGƯỜI DÙNG - TAB 2) */}
                        {activeTask === 'rooms_users' && roomsUsersSubTab === 'users' && (
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Ảnh Avatar người dùng */}
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-inner relative border border-white/10 overflow-hidden"
                                style={{ backgroundColor: item.avatarColor || '#10b981' }}
                              >
                                {(item.customAvatarUrl || item.avatarUrl || item.photoURL) ? (
                                  <img src={item.customAvatarUrl || item.avatarUrl || item.photoURL} alt={item.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  item.displayName?.charAt(0).toUpperCase() || 'U'
                                )}
                                {item.onlineCheck?.isOnline && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 absolute -bottom-0.5 -right-0.5 animate-pulse" />
                                )}
                              </div>

                              {/* Tên, thiết bị & check online thực tế */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                    {item.displayName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                                    ({item.deviceName || 'Thiết bị'})
                                  </span>
                                  {item.email && (
                                    <span className="text-[10px] text-slate-500 font-mono hidden md:inline-block">
                                      {item.email}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${item.onlineCheck?.color}`}>
                                    {item.onlineCheck?.badgeText}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate hidden md:inline-block">
                                    • {item.onlineCheck?.detailText}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-sky-400 font-medium hidden sm:inline hover:underline">
                                Quản lý & Kỷ luật &gt;
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                          </div>
                        )}

                        {/* TH3: HIỂN THỊ CÁC VI PHẠM (CÁC VI PHẠM - TAB 3 TẬP TRUNG) */}
                        {activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators' && (
                          <div className="flex items-center justify-between w-full min-w-0">
                            {violatorTarget === 'users' ? (
                              /* 1. Bản ghi Người Dùng Vi Phạm */
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div 
                                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 border border-amber-500/40 relative shadow-inner overflow-hidden"
                                  style={{ backgroundColor: item.avatarColor || '#f59e0b' }}
                                >
                                  {(item.customAvatarUrl || item.avatarUrl || item.photoURL) ? (
                                    <img src={item.customAvatarUrl || item.avatarUrl || item.photoURL} alt={item.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    item.displayName?.charAt(0).toUpperCase() || 'V'
                                  )}
                                  {item.isWorstViolator && (
                                    <span className="w-3.5 h-3.5 rounded-full bg-red-600 ring-2 ring-slate-900 absolute -bottom-0.5 -right-0.5 flex items-center justify-center text-[9px] text-white font-bold animate-pulse">
                                      !
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                      {item.displayName}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                      Lần vi phạm: {item.violationCount || 1}
                                    </span>

                                    {/* Mức độ vi phạm của người dùng */}
                                    {item.violationSeverity === 'light' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        🟢 Mức độ: Nhẹ
                                      </span>
                                    )}
                                    {item.violationSeverity === 'medium' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        🟡 Mức độ: Bình Thường
                                      </span>
                                    )}
                                    {item.violationSeverity === 'heavy' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        🟠 Mức độ: Nặng
                                      </span>
                                    )}
                                    {item.violationSeverity === 'critical' && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500 animate-pulse">
                                        🔴 Hết Cứu (Tái phạm nghiêm trọng)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-amber-400 font-mono truncate mt-0.5">
                                    Lý do: {item.violationReason || 'Có hành vi vi phạm quy chuẩn cộng đồng'}
                                  </div>
                                  {item.email && (
                                    <div className="text-[10px] text-slate-500 font-mono truncate">
                                      {item.email} {item.deviceName && `• ${item.deviceName}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* 2. Bản ghi Phòng Chat Vi Phạm */
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm relative border border-white/10 overflow-hidden"
                                  style={{ backgroundColor: item.avatarColor || '#10b981' }}
                                >
                                  {item.avatar ? (
                                    <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                                  ) : item.id === 'public-relay-lounge' ? (
                                    <img src={DEFAULT_GLOBAL_LOUNGE_AVATAR} alt="Đại Sảnh Toàn Cầu" className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(item.name || 'P').charAt(0).toUpperCase()}</span>
                                  )}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 ${
                                      item.isPrivate ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                                    }`}
                                  >
                                    {item.isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                      {item.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                      #{item.code}
                                    </span>

                                    {/* Mức độ vi phạm của phòng */}
                                    {item.violationSeverity === 'light' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        🟢 Nhẹ (1 cảnh cáo)
                                      </span>
                                    )}
                                    {item.violationSeverity === 'medium' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        🟡 Bình Thường (2 vi phạm)
                                      </span>
                                    )}
                                    {item.violationSeverity === 'heavy' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        🟠 Nặng (Tạm khóa)
                                      </span>
                                    )}
                                    {item.violationSeverity === 'critical' && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500 animate-pulse">
                                        🔴 Hết Cứu (Khóa vĩnh viễn)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-amber-400 font-mono mt-0.5 truncate">
                                    {item.violationReason || 'Phòng chat có tin nhắn vi phạm hoặc bị người dùng tố cáo'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate">
                                    Tạo bởi: {item.createdByName || 'Người dùng'} {item.isPrivate ? '• Phòng Riêng' : '• Phòng Công Khai'}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-amber-400 font-medium hidden sm:inline hover:underline">
                                Xem chi tiết vi phạm &gt;
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                          </div>
                        )}

                        {/* TH4: HIỂN THỊ NGƯỜI DÙNG ĐÃ BỊ BANNED */}
                        {activeTask === 'violators_banned' && violatorsBannedSubTab === 'banned' && (
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                                <Ban className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs sm:text-sm text-rose-300 truncate">
                                    {item.displayName || 'Người dùng'}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                    {item.lastSanctionType === 'ban_perm' ? 'CẤM VĨNH VIỄN' : 'TẠM KHÓA'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.email || 'Không có email'} • {item.reason || 'Vi phạm nội quy'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnbanUser(item.uid, item.email);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-semibold shrink-0 transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                              title="Gỡ lệnh cấm ngay lập tức"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Gỡ Cấm</span>
                            </button>
                          </div>
                        )}

                        {/* TH6: HIỂN THỊ BÁO CÁO TỐ CÁO */}
                        {activeTask === 'reports' && (
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              item.status === 'pending'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : item.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              <Flag className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                                  Bị tố cáo: {item.senderName}
                                </span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                                  item.status === 'pending'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : item.status === 'resolved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {item.status === 'pending' ? '⏳ Chờ xử lý' : item.status === 'resolved' ? '✅ Đã xử lý' : '✖️ Bỏ qua'}
                                </span>
                              </div>
                              <div className="text-[11px] text-amber-300/90 truncate mt-0.5 font-medium">
                                Lý do: {item.reason}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                Phòng: {item.roomName} • Người báo: {item.reportedByName} • {formatMessageTime(item.createdAt, item.timestamp)}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="shrink-0 text-slate-500 text-xs">
                          {isSelected ? <Check className="w-4 h-4 text-emerald-400" /> : '→'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

      </div>

      {/* MODAL CHI TIẾT & TÁC VỤ KỶ LUẬT (CHỈ MỞ KHI DEV NHẤP CHỌN BẢN GHI KHÔNG PHẢI PHÒNG CHAT HOẶC NGƯỜI DÙNG) */}
      {showDetailModal && selectedItemData && activeTask !== 'rooms_users' && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PanelRight className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Chi Tiết & Tác Vụ Kỷ Luật
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Đóng cửa sổ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {(() => {
                const item = selectedItemData as any;

                if (activeTask === 'reports') {
                  const rep = item as ContentReport;
                  return (
                    <div className="space-y-4">
                      {/* Trạng thái tố cáo */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400 uppercase">Trạng thái đơn:</span>
                          <span className={`text-xs font-mono px-2.5 py-1 rounded-full border font-semibold ${
                            rep.status === 'pending'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : rep.status === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {rep.status === 'pending' ? '⏳ Chờ DEV xử lý' : rep.status === 'resolved' ? '✅ Đã giải quyết' : '✖️ Đã bỏ qua'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                          <div>
                            <span className="text-slate-400">Người bị tố cáo:</span>{' '}
                            <strong className="text-rose-300">{rep.senderName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Thiết bị:</span>{' '}
                            <span className="font-mono text-slate-300">{rep.senderDevice || 'Không rõ'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Người gửi tố cáo:</span>{' '}
                            <span className="font-medium text-emerald-300">{rep.reportedByName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Phòng chat:</span>{' '}
                            <span className="font-mono text-slate-200">{rep.roomName}</span>
                          </div>
                        </div>

                        {/* Lý do */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-1">
                          <div className="text-[11px] text-amber-400 font-mono uppercase">Lý do & Mô tả vi phạm:</div>
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 font-medium">
                            {rep.reason}
                          </div>
                        </div>

                        {/* Bằng chứng */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-1">
                          <div className="text-[11px] text-rose-400 font-mono uppercase flex items-center justify-between">
                            <span>Nội dung tin nhắn gốc (Bằng chứng thô không che):</span>
                            <span className="text-[10px] text-slate-500">raw text</span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 text-xs font-mono text-rose-200 whitespace-pre-wrap break-words">
                            {rep.messageRawText || rep.messageText || '[Không có nội dung văn bản]'}
                          </div>
                        </div>
                      </div>

                      {/* Các tác vụ xử lý */}
                      <div className="space-y-2 pt-2">
                        <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Hành động kỷ luật & Xử lý:</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteReportedMessage(rep.roomId, rep.messageId, rep.id);
                            setShowDetailModal(false);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Xóa Tin Nhắn Vi Phạm Khỏi Phòng</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleBanUserFromReport(rep.senderId, rep.senderName, 3, rep.reason, rep.id);
                              setShowDetailModal(false);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Ban className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ban 3 Ngày</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleBanUserFromReport(rep.senderId, rep.senderName, 'perm', rep.reason, rep.id);
                              setShowDetailModal(false);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-rose-700/30 hover:bg-rose-700/40 text-rose-300 border border-rose-600/50 text-xs font-semibold transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-400" />
                            <span>Ban Vĩnh Viễn</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleResolveReport(rep.id);
                              setShowDetailModal(false);
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã Xử Lý Xong</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDismissReport(rep.id);
                              setShowDetailModal(false);
                            }}
                            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-all"
                          >
                            Bỏ qua
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (activeTask === 'violators_banned' && violatorsBannedSubTab === 'violators') {
                  const targetId = item.id || item.uid;
                  const isRoomTarget = violatorTarget === 'rooms';
                  const incidents = violationIncidentsMap[targetId] || [];
                  const targetAvatar = isRoomTarget
                    ? (item.avatar || (item.id === 'public-relay-lounge' ? DEFAULT_GLOBAL_LOUNGE_AVATAR : ''))
                    : (item.customAvatarUrl || item.avatarUrl || item.photoURL);

                  return (
                    <div className="space-y-4">
                      {/* Header thông tin đối tượng vi phạm */}
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-12 h-12 ${isRoomTarget ? 'rounded-2xl' : 'rounded-full'} flex items-center justify-center font-bold text-sm text-white shrink-0 border border-white/15 overflow-hidden shadow-md`}
                            style={{ backgroundColor: item.avatarColor || '#f59e0b' }}
                          >
                            {targetAvatar ? (
                              <img src={targetAvatar} alt={item.displayName || item.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{(item.displayName || item.name || 'V').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-base text-slate-100 truncate">
                                {item.displayName || item.name}
                              </h4>
                              {isRoomTarget && item.code && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                                  #{item.code}
                                </span>
                              )}
                              {item.violationSeverity === 'light' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  Mức độ: Nhẹ
                                </span>
                              )}
                              {item.violationSeverity === 'medium' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Mức độ: Bình Thường
                                </span>
                              )}
                              {item.violationSeverity === 'heavy' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  Mức độ: Nặng
                                </span>
                              )}
                              {item.violationSeverity === 'critical' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600/30 text-red-200 border border-red-500">
                                  Mức độ: Hết Cứu
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                              {isRoomTarget
                                ? `${item.isPrivate ? 'Phòng Riêng tư' : 'Phòng Công khai'} • Tạo bởi: ${item.createdByName || 'Hệ thống'}`
                                : `${item.email || 'Chưa có email'} ${item.deviceName ? `• Thiết bị: ${item.deviceName}` : ''}`}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                          ID: <span className="text-emerald-400">{targetId}</span>
                        </div>
                      </div>

                      {/* Tóm tắt lý do */}
                      {item.violationReason && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                          <span className="font-bold text-amber-400">Tổng hợp lý do: </span>
                          {item.violationReason}
                        </div>
                      )}

                      {/* Danh sách chi tiết: Ở phòng chat nào, thời điểm nào, trên thiết bị nào */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Chi Tiết Vi Phạm Theo Phòng, Thời Điểm & Thiết Bị ({incidents.length})</span>
                          </span>
                          {isLoadingViolationDetails && (
                            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                              Đang quét bằng chứng...
                            </span>
                          )}
                        </div>

                        {isLoadingViolationDetails && incidents.length === 0 ? (
                          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                            Đang truy xuất lịch sử phòng chat, thời điểm và thiết bị gửi tin...
                          </div>
                        ) : incidents.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
                            <p className="font-semibold text-emerald-300">
                              Không phát hiện tin nhắn ngôn từ vi phạm nào trong các phòng chat.
                            </p>
                            <p className="text-slate-400">
                              Nếu đối tượng vẫn hiển thị do khóa chat thử nghiệm (test) hoặc báo cáo cũ, bạn có thể nhấn nút "Xóa Lịch Sử / Gỡ Vi Phạm Test" bên dưới.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                            {incidents.map((inc) => (
                              <div key={inc.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-slate-400 shrink-0">Phòng:</span>
                                    <span className="font-semibold text-slate-100 truncate">
                                      {inc.roomName}{inc.roomCode ? ` (#${inc.roomCode})` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="text-slate-400 shrink-0">Lúc:</span>
                                    <span className="font-mono text-amber-200 truncate tabular-nums">
                                      {formatMessageTime(inc.createdAt, inc.timestamp) || 'Không rõ'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span className="text-slate-400 shrink-0">Thiết bị:</span>
                                    <span className="font-mono text-sky-300 truncate">
                                      {inc.senderDevice || 'Không rõ thiết bị'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5">
                                  <span>
                                    {isRoomTarget && inc.senderName ? `Người gửi: ${inc.senderName} • ` : ''}
                                    Nguồn:{' '}
                                    <strong className="text-slate-200">
                                      {inc.source === 'openai_moderation'
                                        ? 'OpenAI Moderation'
                                        : inc.source === 'word_filter'
                                        ? 'Bộ lọc từ ngữ'
                                        : inc.source === 'user_report'
                                        ? 'Tố cáo người dùng'
                                        : 'Lệnh kỷ luật'}
                                    </strong>
                                  </span>
                                  <span className="text-amber-300 truncate max-w-[60%]">{inc.reason}</span>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/25 text-xs font-mono text-rose-200 whitespace-pre-wrap break-words">
                                  "{inc.content}"
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Nhóm nút xử lý trực tiếp tại modal */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => handleClearTestViolations(targetId, violatorTarget, item.email, item.displayName || item.name)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Xóa Lịch Sử / Gỡ Vi Phạm Test</span>
                        </button>

                        {!isRoomTarget && (
                          <button
                            type="button"
                            onClick={async () => {
                              const targetUid = item.uid || item.id;
                              const targetEmail = item.email || '';
                              if (targetUid) {
                                try {
                                  const notifId = `warn-${Date.now()}`;
                                  await setDoc(doc(db, 'user_notifications', notifId), {
                                    id: notifId,
                                    targetUid,
                                    targetEmail,
                                    title: '⚠️ CẢNH CÁO TỪ BAN QUẢN TRỊ DEV',
                                    message: 'Tài khoản của bạn đã có hành vi vi phạm tiêu chuẩn cộng đồng. Vui lòng chấm dứt ngay các hành vi vi phạm để tránh bị khóa tài khoản.',
                                    reason: item.violationReason || 'Vi phạm nội quy hệ thống',
                                    createdAt: new Date().toISOString(),
                                    timestamp: Date.now(),
                                    level: 'warn',
                                    read: false
                                  });
                                  alert(`✅ Đã gửi thông báo cảnh cáo chính thức tới tài khoản [${item.displayName || item.name || 'người dùng'}]!`);
                                } catch (err) {
                                  console.error('Error sending warning notification:', err);
                                  alert('Đã gửi thông báo cảnh cáo vi phạm.');
                                }
                              }
                              setShowDetailModal(false);
                            }}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Gửi Cảnh Cáo Vi Phạm</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setShowDetailModal(false);
                            setActiveTask('rooms_users');
                            if (isRoomTarget) {
                              setRoomsUsersSubTab('rooms');
                              setRoomDetailsTab('chat');
                            } else {
                              setRoomsUsersSubTab('users');
                              setUserDetailsTab('info');
                            }
                          }}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{isRoomTarget ? 'Mở Phòng Chat' : 'Mở Hồ Sơ'}</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase text-slate-400">ID Bản Ghi:</span>
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 truncate max-w-[260px]">
                          {item.id || item.uid}
                        </span>
                      </div>

                      <div className="font-bold text-base text-slate-100">
                        {item.name || item.displayName || item.title}
                      </div>

                      {item.onlineCheck && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-1">
                          <div className="text-[11px] text-slate-400 uppercase font-mono">Trạng thái Online thực tế:</div>
                          <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${item.onlineCheck.color}`}>
                            <span className="font-semibold">{item.onlineCheck.badgeText}</span>
                            <span className="text-xs font-mono">{item.onlineCheck.detailText}</span>
                          </div>
                        </div>
                      )}

                      {item.violationReason && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-1">
                          <div className="text-[11px] text-amber-400 uppercase font-mono">Bằng chứng vi phạm:</div>
                          <div className="text-xs text-amber-200/90 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                            {item.violationReason}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Dữ liệu JSON thuộc tính:</span>
                        </span>
                      </div>
                      <pre className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-56 scrollbar-thin scrollbar-thumb-slate-800">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      {activeTask === 'violators_banned' && violatorsBannedSubTab === 'banned' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleUnbanUser(item.uid, item.email);
                            setShowDetailModal(false);
                          }}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Gỡ Ban Tài Khoản Này (Unban)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX XEM ẢNH FULL-SIZE */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Xem ảnh chi tiết (DataStore Image Preview)</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  download="cloudsend-image.png"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Tải ảnh về máy"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Đóng xem ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 flex items-center justify-center bg-black/50 overflow-auto max-h-[80vh]">
              <img src={previewImage} alt="Ảnh phóng to" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Kho 4 Avatar Kênh Lưu Trữ DataStorage */}
      <DataStorageAvatarsModal 
        isOpen={showStorageAvatarsModal} 
        onClose={() => setShowStorageAvatarsModal(false)} 
      />
    </div>
  );
};
