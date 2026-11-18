import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Crown,
  Calendar,
  Sparkles,
  Mail,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Check,
  Copy,
  Clock,
  Globe,
  Phone,
  MapPin,
  User as UserIcon,
  BadgeCheck,
  KeyRound,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage, pickLang, getLocaleTag } from '../context/LanguageContext';
import { UserSanction } from '../types';
import {
  applyTierSanction,
  checkUserBanStatus,
  isDevUser,
  isRealEmail,
  removeDevSanction,
  SANCTION_TIERS,
  SanctionTierKey,
} from '../utils/devModeration';

interface ProfileUserInput {
  uid?: string;
  id?: string;
  displayName: string;
  username?: string;
  email?: string;
  linkedEmail?: string;
  phone?: string;
  phoneNumber?: string;
  linkedPhone?: string;
  avatarUrl?: string;
  photoURL?: string;
  customAvatarUrl?: string;
  avatarColor?: string;
  isDev?: boolean;
  isOnline?: boolean;
  deviceName?: string;
  deviceType?: string;
  bannerUrl?: string;
  bio?: string;
  customBio?: string;
  customBadgeText?: string;
  createdAt?: string;
  lastSeen?: string;
  lastActive?: string;
  lastBrowser?: string;
  lastLocation?: string;
  gender?: string;
  dob?: string;
  authProvider?: string;
  googleUid?: string;
  facebookUid?: string;
  githubUid?: string;
  linkedUids?: string[];
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  acceptedRules?: boolean;
  isMe?: boolean;
}

interface UserProfileModalProps {
  user: ProfileUserInput | null;
  anchorPosition?: {
    top: number;
    bottom?: number;
    left: number;
    right?: number;
    width?: number;
    height?: number;
    isRightHalf?: boolean;
    isMe?: boolean;
  } | null;
  onClose: () => void;
}

const DEV_PROFILE_TIER_OPTIONS: Array<{
  key: SanctionTierKey;
  labelVi: string;
  labelEn: string;
  labelZh: string;
  tone: 'amber' | 'orange' | 'rose' | 'red';
}> = [
  { key: 'lock_15m', labelVi: 'Khóa chat 15 phút', labelEn: '15m Chat Lock', labelZh: '禁言 15 分钟', tone: 'amber' },
  { key: 'lock_1h', labelVi: 'Khóa chat 1 giờ', labelEn: '1h Chat Lock', labelZh: '禁言 1 小时', tone: 'amber' },
  { key: 'ban_1d', labelVi: 'Tạm ban 1 ngày', labelEn: '1-Day Ban', labelZh: '封禁 1 天', tone: 'orange' },
  { key: 'ban_3d', labelVi: 'Tạm ban 3 ngày', labelEn: '3-Day Ban', labelZh: '封禁 3 天', tone: 'orange' },
  { key: 'ban_7d', labelVi: 'Tạm ban 7 ngày', labelEn: '7-Day Ban', labelZh: '封禁 7 天', tone: 'rose' },
  { key: 'ban_6m', labelVi: 'Tạm ban 6 tháng', labelEn: '6-Month Ban', labelZh: '封禁 6 个月', tone: 'rose' },
  { key: 'level_perm', labelVi: 'Cấm vĩnh viễn', labelEn: 'Permanent Ban', labelZh: '永久封禁', tone: 'red' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, anchorPosition, onClose }) => {
  const { currentLang } = useLanguage();
  const { currentUser } = useAuth();
  const pick = <T,>(vi: T, en: T, zh?: T) => pickLang(currentLang, vi, en, zh);

  const modalRef = useRef<HTMLDivElement>(null);

  const [liveUserDoc, setLiveUserDoc] = useState<Record<string, any> | null>(null);
  const [livePresenceDoc, setLivePresenceDoc] = useState<Record<string, any> | null>(null);
  const [liveSanction, setLiveSanction] = useState<UserSanction | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // DEV-only manual moderation state
  const [showDevModPanel, setShowDevModPanel] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SanctionTierKey>('ban_3d');
  const [banReason, setBanReason] = useState('');
  const [confirmPendingAction, setConfirmPendingAction] = useState<'ban' | 'unban' | null>(null);
  const [isSubmittingMod, setIsSubmittingMod] = useState(false);
  const [modFeedback, setModFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isCurrentDev = isDevUser(currentUser?.email);
  const targetUid = (user?.uid || user?.id || '').trim();
  const shouldRender = Boolean(user && !user.isMe && (!currentUser?.uid || targetUid !== currentUser.uid));

  // Reset transient state when switching target user
  useEffect(() => {
    setLiveUserDoc(null);
    setLivePresenceDoc(null);
    setLiveSanction(null);
    setAvatarLoadFailed(false);
    setCopiedUid(false);
    setShowDevModPanel(false);
    setConfirmPendingAction(null);
    setBanReason('');
    setModFeedback(null);
  }, [targetUid]);

  // 1. Live Firestore subscription for user profile + presence
  useEffect(() => {
    if (!shouldRender || !targetUid) return;

    const unsubUser = onSnapshot(
      doc(db, 'users', targetUid),
      (snap) => {
        if (snap.exists()) {
          setLiveUserDoc(snap.data() as Record<string, any>);
        }
      },
      (err) => {
        console.warn('UserProfileModal user listener error:', err);
      }
    );

    const unsubPresence = onSnapshot(
      doc(db, 'presence', targetUid),
      (snap) => {
        if (snap.exists()) {
          setLivePresenceDoc(snap.data() as Record<string, any>);
        }
      },
      (err) => {
        console.warn('UserProfileModal presence listener error:', err);
      }
    );

    return () => {
      unsubUser();
      unsubPresence();
    };
  }, [shouldRender, targetUid]);

  // Merged profile fields (live Firestore overrides stale chat metadata)
  const mergedUser = useMemo(() => {
    if (!user) return null;
    const u = liveUserDoc || {};
    const p = livePresenceDoc || {};

    const resolvedEmail = u.linkedEmail || u.email || user.linkedEmail || user.email || '';
    const resolvedPhone =
      u.phone ||
      u.linkedPhone ||
      u.phoneNumber ||
      user.phone ||
      user.linkedPhone ||
      user.phoneNumber ||
      '';
    const resolvedAvatar =
      u.customAvatarUrl ||
      u.avatarUrl ||
      u.photoURL ||
      p.customAvatarUrl ||
      user.customAvatarUrl ||
      user.avatarUrl ||
      user.photoURL ||
      '';
    const lastSeenRaw = p.lastSeen || u.lastSeen || u.lastActive || user.lastSeen || user.lastActive || '';
    const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
    const isPresenceFresh = Boolean(lastSeenMs && Date.now() - lastSeenMs <= 3 * 60 * 1000 && p.status !== 'offline');
    const isOnline = Boolean(p.status ? isPresenceFresh : user.isOnline || isPresenceFresh);

    return {
      ...user,
      ...u,
      uid: targetUid,
      displayName: u.displayName || p.displayName || user.displayName || pick('Thành viên', 'Member', '成员'),
      username: u.username || user.username || '',
      email: resolvedEmail,
      linkedEmail: u.linkedEmail || user.linkedEmail || '',
      phone: resolvedPhone,
      avatarUrl: resolvedAvatar,
      avatarColor: u.avatarColor || p.avatarColor || user.avatarColor || '#10b981',
      bannerUrl: u.bannerUrl || p.bannerUrl || user.bannerUrl || '',
      customBio: u.customBio || u.bio || p.customBio || user.customBio || user.bio || '',
      customBadgeText: u.customBadgeText || p.customBadgeText || user.customBadgeText || '',
      deviceName: p.deviceName || u.deviceName || user.deviceName || '',
      deviceType: p.deviceType || u.deviceType || user.deviceType || '',
      createdAt: u.createdAt || user.createdAt || '',
      lastSeen: lastSeenRaw,
      isOnline,
      isDev: Boolean(user.isDev || isDevUser(resolvedEmail)),
      authProvider: u.authProvider || user.authProvider,
      googleUid: u.googleUid || user.googleUid,
      facebookUid: u.facebookUid || user.facebookUid,
      githubUid: u.githubUid || user.githubUid,
      linkedUids: Array.isArray(u.linkedUids) ? u.linkedUids : user.linkedUids || [],
      isEmailVerified: Boolean(u.isEmailVerified || user.isEmailVerified),
      isPhoneVerified: Boolean(u.isPhoneVerified || user.isPhoneVerified),
      acceptedRules: Boolean(u.acceptedRules || user.acceptedRules),
      gender: u.gender || user.gender || '',
      dob: u.dob || user.dob || '',
      lastBrowser: u.lastBrowser || user.lastBrowser || '',
      lastLocation: u.lastLocation || user.lastLocation || '',
    };
  }, [user, liveUserDoc, livePresenceDoc, targetUid, currentLang]);

  // 2. DEV-only live sanction check & subscription
  const refreshSanctionStatus = async () => {
    if (!isCurrentDev || !targetUid || !mergedUser) return;
    try {
      const status = await checkUserBanStatus(mergedUser.email, targetUid, {
        phone: mergedUser.phone,
        linkedEmail: mergedUser.linkedEmail,
        linkedUids: mergedUser.linkedUids,
      });
      if (status.isBanned || status.isChatLocked) {
        setLiveSanction(status.sanction || null);
      } else {
        setLiveSanction(null);
      }
    } catch (err) {
      console.warn('Check user sanction status error:', err);
    }
  };

  useEffect(() => {
    if (!shouldRender || !isCurrentDev || !targetUid) return;

    const unsubSanction = onSnapshot(
      doc(db, 'sanctions', targetUid),
      (snap) => {
        if (snap.exists()) {
          const s = snap.data() as UserSanction;
          const now = Date.now();
          const activeBan = Boolean(s.isBanned && (!s.banExpiresAt || new Date(s.banExpiresAt).getTime() > now));
          const activeLock = Boolean(s.isChatLocked && (!s.chatLockExpiresAt || new Date(s.chatLockExpiresAt).getTime() > now));
          if (activeBan || activeLock) {
            setLiveSanction(s);
            return;
          }
        }
        refreshSanctionStatus();
      },
      (err) => {
        console.warn('UserProfileModal sanction listener error:', err);
      }
    );

    refreshSanctionStatus();
    return () => unsubSanction();
  }, [shouldRender, isCurrentDev, targetUid, mergedUser?.email, mergedUser?.phone]);

  // 3. Click Outside Handler
  useEffect(() => {
    if (!shouldRender) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [shouldRender, onClose]);

  // 4. Escape Key Handler
  useEffect(() => {
    if (!shouldRender) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, onClose]);

  // 5. Close on viewport resize (allow scrolling inside modal itself)
  useEffect(() => {
    if (!shouldRender) return;
    const handleScroll = (e: Event) => {
      if (modalRef.current && e.target instanceof Node && modalRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };
    const handleResize = () => onClose();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [shouldRender, onClose]);

  // 6. Smart Boundary & Drift Adjuster
  const computePosition = (measuredHeight = 460, measuredWidth = 348) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    if (!anchorPosition) {
      return {
        top: Math.max(12, Math.round((vh - measuredHeight) / 2)),
        left: Math.max(12, Math.round((vw - measuredWidth) / 2)),
        arrowSide: 'top' as 'top' | 'left',
        arrowPos: 16,
        centered: true,
      };
    }

    const avatarBottom = anchorPosition.bottom ?? (anchorPosition.top + (anchorPosition.height ?? 28));
    const avatarRight = anchorPosition.right ?? (anchorPosition.left + (anchorPosition.width ?? 28));

    const idealTop = avatarBottom + 4;
    const idealLeft = avatarRight + 2;

    let finalLeft = idealLeft;
    if (finalLeft + measuredWidth > vw - 12) {
      finalLeft = vw - measuredWidth - 12;
    }
    if (finalLeft < 12) {
      finalLeft = 12;
    }

    const bottomLimit = vh - 12;
    const overflowDelta = Math.max(0, idealTop + measuredHeight - bottomLimit);
    let finalTop = idealTop - overflowDelta;
    if (finalTop < 12) {
      finalTop = 12;
    }

    const relX = avatarRight - finalLeft;
    const relY = avatarBottom - finalTop;

    let arrowSide: 'top' | 'left' = 'top';
    let arrowPos = 12;

    if (relY <= 14 && relX >= -4) {
      arrowSide = 'top';
      arrowPos = Math.max(8, Math.min(Math.max(8, relX + 6), measuredWidth - 28));
    } else {
      arrowSide = 'left';
      arrowPos = Math.max(10, Math.min(Math.max(10, relY - 7), measuredHeight - 32));
    }

    return {
      top: Math.round(finalTop),
      left: Math.round(finalLeft),
      arrowSide,
      arrowPos: Math.round(arrowPos),
      centered: false,
    };
  };

  const [coords, setCoords] = useState(() => computePosition());

  useLayoutEffect(() => {
    if (!shouldRender) return;
    const modalEl = modalRef.current;
    if (modalEl) {
      setCoords(computePosition(modalEl.offsetHeight, modalEl.offsetWidth));
    }
  }, [shouldRender, anchorPosition, liveUserDoc, livePresenceDoc, liveSanction, showDevModPanel, confirmPendingAction, modFeedback]);

  if (!shouldRender || !mergedUser) return null;
  if (typeof document === 'undefined') return null;

  const initialChar = (mergedUser.displayName?.trim().charAt(0) || 'U').toUpperCase();
  const bannerGradient = mergedUser.bannerUrl
    ? `url(${mergedUser.bannerUrl}) center/cover no-repeat`
    : 'linear-gradient(to right, #059669, #0d9488, #4f46e5)';

  const cleanBio = (mergedUser.customBio || '').replace(/^\$+\s*/, '').replace(/\$/g, '').trim();
  const handleText = (mergedUser.username || mergedUser.displayName || 'user')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '');

  const resolveProviderBadge = () => {
    const raw = mergedUser.authProvider;
    const emailLower = String(mergedUser.email || '').toLowerCase();
    if (raw === 'google' || mergedUser.googleUid) {
      return { label: 'Google', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
    if (raw === 'facebook' || mergedUser.facebookUid) {
      return { label: 'Facebook', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
    if (raw === 'github' || mergedUser.githubUid) {
      return { label: 'GitHub', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' };
    }
    if (raw === 'phone' || emailLower.endsWith('@phone.cloudsend.local')) {
      return { label: pick('SĐT OTP', 'Phone OTP', '手机验证码'), cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    }
    if (raw === 'guest' || targetUid.startsWith('guest_')) {
      return { label: pick('Khách', 'Guest', '访客'), cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
    }
    return { label: pick('Tài khoản ClSend', 'ClSend Account', 'ClSend 账号'), cls: 'bg-teal-500/15 text-teal-300 border-teal-500/30' };
  };

  const providerBadge = resolveProviderBadge();
  const targetIsDev = Boolean(mergedUser.isDev);
  const canDevModerate = isCurrentDev && !targetIsDev && Boolean(targetUid);

  const sanctionCheckNow = Date.now();
  const isActivelyBanned = Boolean(
    liveSanction?.isBanned &&
      (!liveSanction.banExpiresAt || new Date(liveSanction.banExpiresAt).getTime() > sanctionCheckNow)
  );
  const isActivelyChatLocked = Boolean(
    !isActivelyBanned &&
      liveSanction?.isChatLocked &&
      (!liveSanction.chatLockExpiresAt || new Date(liveSanction.chatLockExpiresAt).getTime() > sanctionCheckNow)
  );
  const hasActiveSanction = isActivelyBanned || isActivelyChatLocked;

  const handleApplyManualBan = async () => {
    if (!canDevModerate || !currentUser?.email) return;
    setIsSubmittingMod(true);
    setModFeedback(null);
    try {
      const tierConfig = SANCTION_TIERS[selectedTier];
      const finalReason = banReason.trim() || tierConfig.label;
      const result = await applyTierSanction({
        targetUid,
        targetEmail: mergedUser.email || '',
        targetPhone: mergedUser.phone || '',
        targetDisplayName: mergedUser.displayName,
        tier: selectedTier,
        customReason: finalReason,
        customRemindText: banReason.trim() ? `${tierConfig.remind} Lý do DEV: ${banReason.trim()}` : tierConfig.remind,
        ruleViolated: 'Xử lý trực tiếp từ Hồ sơ người dùng (DEV)',
        devEmail: currentUser.email,
      });
      setLiveSanction(result);
      setConfirmPendingAction(null);
      setShowDevModPanel(false);
      setBanReason('');
      setModFeedback({
        type: 'success',
        text: pick(
          `Đã áp dụng [${tierConfig.label}] cho ${mergedUser.displayName}.`,
          `Applied [${tierConfig.label}] to ${mergedUser.displayName}.`,
          `已对 ${mergedUser.displayName} 执行 [${tierConfig.label}]。`
        ),
      });
    } catch (err: any) {
      setModFeedback({
        type: 'error',
        text: err?.message || pick('Không thể áp dụng lệnh khóa.', 'Failed to apply sanction.', '无法执行封禁。'),
      });
    } finally {
      setIsSubmittingMod(false);
    }
  };

  const handleManualUnban = async () => {
    if (!canDevModerate) return;
    setIsSubmittingMod(true);
    setModFeedback(null);
    try {
      await removeDevSanction(mergedUser.email || '', targetUid, mergedUser.phone || '');
      setLiveSanction(null);
      setConfirmPendingAction(null);
      setModFeedback({
        type: 'success',
        text: pick(
          `Đã mở khóa hoàn toàn cho tài khoản ${mergedUser.displayName}.`,
          `Unlocked account ${mergedUser.displayName}.`,
          `已完全解除 ${mergedUser.displayName} 的封禁。`
        ),
      });
    } catch (err: any) {
      setModFeedback({
        type: 'error',
        text: err?.message || pick('Không thể mở khóa tài khoản.', 'Failed to unlock account.', '无法解除封禁。'),
      });
    } finally {
      setIsSubmittingMod(false);
    }
  };

  const transformOrigin = coords.centered
    ? 'center center'
    : coords.arrowSide === 'top'
    ? `${coords.arrowPos + 7}px 0px`
    : `0px ${coords.arrowPos + 7}px`;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/35 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="fixed w-[352px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto overflow-x-hidden bg-[#1e1f22] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/90 select-none z-[10000] animate-profile-pop will-change-transform scrollbar-thin scrollbar-thumb-slate-700"
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transformOrigin,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Neo Mũi Tên Chỉ Hướng */}
        {!coords.centered &&
          (coords.arrowSide === 'top' ? (
            <div
              className="absolute -top-1.5 w-3.5 h-3.5 bg-[#1e1f22] border-t border-l border-slate-700/80 rotate-45 z-20 pointer-events-none transition-all duration-75"
              style={{ left: `${coords.arrowPos}px` }}
            />
          ) : (
            <div
              className="absolute -left-1.5 w-3.5 h-3.5 bg-[#1e1f22] border-l border-b border-slate-700/80 rotate-45 z-20 pointer-events-none transition-all duration-75"
              style={{ top: `${coords.arrowPos}px` }}
            />
          ))}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          title={pick('Đóng (Esc)', 'Close (Esc)', '关闭 (Esc)')}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner Area */}
        <div className="h-26 w-full bg-cover bg-center relative rounded-t-2xl overflow-hidden" style={{ background: bannerGradient }}>
          {mergedUser.customBadgeText && (
            <div className="absolute top-3 right-12 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded-full border border-emerald-500/40 text-[10.5px] text-emerald-300 font-bold shadow-md max-w-[140px] truncate">
              {mergedUser.customBadgeText}
            </div>
          )}
          {targetIsDev && (
            <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/50 backdrop-blur-xs rounded-full border border-amber-500/40 flex items-center gap-1 text-[11px] text-amber-300 font-bold">
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{pick('DEV Chính Chủ', 'Verified DEV', '认证 DEV')}</span>
            </div>
          )}
        </div>

        {/* Profile Body with Overlapping Avatar */}
        <div className="px-4 pb-4 pt-11 relative bg-[#1e1f22]">
          {/* Avatar overlapping banner on the left */}
          <div className="absolute -top-10 left-4 z-10">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl ring-4 ring-[#1e1f22] shadow-2xl overflow-hidden relative"
                style={{ backgroundColor: mergedUser.avatarColor || '#10b981' }}
              >
                <span>{initialChar}</span>
                {mergedUser.avatarUrl && !avatarLoadFailed && (
                  <img
                    src={mergedUser.avatarUrl}
                    alt={mergedUser.displayName}
                    onError={() => setAvatarLoadFailed(true)}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                )}
              </div>
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-4 ring-[#1e1f22] ${
                  mergedUser.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
                title={mergedUser.isOnline ? pick('Đang hoạt động', 'Online', '在线') : pick('Ngoại tuyến', 'Offline', '离线')}
              />
            </div>
          </div>

          {/* User Names & Badges */}
          <div className="mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-white tracking-wide truncate max-w-[230px]">
                {mergedUser.displayName}
              </h2>
              {targetIsDev && (
                <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Developer
                </span>
              )}
              {isCurrentDev && isActivelyBanned && (
                <span className="px-1.5 py-0.5 rounded bg-rose-600/25 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                  {pick('Đang Banned', 'Banned', '已封禁')}
                </span>
              )}
              {isCurrentDev && isActivelyChatLocked && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  {pick('Khóa chat', 'Chat Locked', '禁言中')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p className="text-xs text-slate-400 font-medium">@{handleText}</p>
              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold inline-flex items-center gap-1 ${providerBadge.cls}`}>
                <KeyRound className="w-2.5 h-2.5" />
                {providerBadge.label}
              </span>
              {(mergedUser.isEmailVerified || mergedUser.isPhoneVerified) && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold inline-flex items-center gap-0.5">
                  <BadgeCheck className="w-2.5 h-2.5" />
                  {pick('Đã xác thực', 'Verified', '已验证')}
                </span>
              )}
            </div>
          </div>

          <div className="my-3 h-px w-full bg-slate-700/60" />

          {/* General Profile Info */}
          <div className="space-y-3 bg-[#2b2d31]/75 p-3.5 rounded-xl border border-slate-700/40">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {pick('Thông tin thành viên', 'Member Info', '成员信息')}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed italic">
              {cleanBio ||
                pick(
                  'Thành viên CloudSend đang trực tuyến và sẵn sàng chia sẻ tệp.',
                  'CloudSend member online and ready to share files.',
                  'CloudSend 成员在线并准备分享文件。'
                )}
            </p>

            <div className="space-y-2 pt-1 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <Clock className={`w-3.5 h-3.5 shrink-0 ${mergedUser.isOnline ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-slate-300">
                  {mergedUser.isOnline
                    ? pick('Trạng thái: Đang hoạt động', 'Status: Online now', '状态：当前在线')
                    : mergedUser.lastSeen
                    ? `${pick('Hoạt động gần nhất:', 'Last active:', '最近活跃：')} ${new Date(mergedUser.lastSeen).toLocaleString(getLocaleTag(currentLang))}`
                    : pick('Trạng thái: Ngoại tuyến', 'Status: Offline', '状态：离线')}
                </span>
              </div>

              {mergedUser.deviceName && (
                <div className="flex items-center gap-2.5 truncate">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate text-slate-200">
                    {pick('Thiết bị:', 'Device:', '设备：')} {mergedUser.deviceName} ({mergedUser.deviceType || 'Web'})
                  </span>
                </div>
              )}

              {mergedUser.gender && mergedUser.gender !== 'Không Muốn Trả Lời' && (
                <div className="flex items-center gap-2.5">
                  <UserIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="text-slate-200">
                    {pick('Giới tính:', 'Gender:', '性别：')} {mergedUser.gender}
                  </span>
                </div>
              )}

              {targetIsDev && mergedUser.email && (
                <div className="flex items-center gap-2.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate text-amber-300 font-mono text-[11px]">{mergedUser.email}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-300">
                  {pick('Tham gia từ', 'Joined', '加入于')}{' '}
                  {mergedUser.createdAt
                    ? new Date(mergedUser.createdAt).toLocaleDateString(getLocaleTag(currentLang))
                    : pick('Hôm nay', 'Today', '今天')}
                </span>
              </div>

              {!isCurrentDev && !targetIsDev && (
                <div className="flex items-center gap-2.5 text-slate-400 pt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-400">
                    {pick('Email & SĐT cá nhân được bảo mật riêng tư', 'Email & Phone protected privately', '邮箱和手机号已隐私保护')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DEV-ONLY Extended Inspection + Direct Ban/Unban Panel */}
          {isCurrentDev && (
            <div className="mt-3 space-y-2.5 bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{pick('Kiểm Tra Chi Tiết (DEV)', 'DEV Inspection', 'DEV 详情检查')}</span>
                </span>
                {targetUid && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(targetUid);
                      setCopiedUid(true);
                      setTimeout(() => setCopiedUid(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-sky-300 cursor-pointer"
                    title={targetUid}
                  >
                    <span className="truncate max-w-[95px]">{targetUid}</span>
                    {copiedUid ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                )}
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-mono truncate">
                    {isRealEmail(mergedUser.email) ? mergedUser.email : mergedUser.email || pick('Chưa liên kết Email', 'No Email', '未绑定邮箱')}
                  </span>
                </div>

                {mergedUser.phone && (
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="font-mono truncate">{mergedUser.phone}</span>
                  </div>
                )}

                {mergedUser.dob && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{pick('Ngày sinh:', 'DOB:', '生日：')} {mergedUser.dob}</span>
                  </div>
                )}

                {(mergedUser.lastBrowser || mergedUser.lastLocation) && (
                  <div className="flex items-center gap-2 truncate">
                    {mergedUser.lastLocation ? (
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate text-slate-300">
                      {[mergedUser.lastBrowser, mergedUser.lastLocation].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                )}

                {Array.isArray(mergedUser.linkedUids) && mergedUser.linkedUids.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-slate-300">
                      {pick('UID liên kết:', 'Linked UIDs:', '关联 UID：')} {mergedUser.linkedUids.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Current sanction alert for DEV */}
              {hasActiveSanction && liveSanction && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[11px] space-y-1">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      {isActivelyBanned
                        ? liveSanction.lastSanctionType === 'ban_perm'
                          ? pick('Đang bị CẤM VĨNH VIỄN', 'Permanently Banned', '已被永久封禁')
                          : pick('Đang bị TẠM KHÓA tài khoản', 'Temporarily Banned', '账号暂时封禁中')
                        : pick('Đang bị KHÓA CHAT', 'Chat Locked', '禁言中')}
                    </span>
                  </div>
                  {liveSanction.reason && <div className="text-rose-200/90 break-words">{liveSanction.reason}</div>}
                  {(liveSanction.banExpiresAt || liveSanction.chatLockExpiresAt) && (
                    <div className="text-[10px] font-mono text-rose-300/80">
                      {pick('Hết hạn:', 'Expires:', '到期：')}{' '}
                      {new Date((liveSanction.banExpiresAt || liveSanction.chatLockExpiresAt)!).toLocaleString(getLocaleTag(currentLang))}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback banner */}
              {modFeedback && (
                <div
                  className={`p-2 rounded-lg text-[11px] font-medium border ${
                    modFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {modFeedback.text}
                </div>
              )}

              {/* DEV Action Buttons (Only non-DEV targets) */}
              {canDevModerate && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {hasActiveSanction && (
                      confirmPendingAction === 'unban' ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSubmittingMod}
                            onClick={handleManualUnban}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{isSubmittingMod ? pick('Đang mở...', 'Unlocking...', '解除中...') : pick('Xác nhận mở khóa', 'Confirm Unlock', '确认解封')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingMod}
                            onClick={() => setConfirmPendingAction(null)}
                            className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                          >
                            {pick('Hủy', 'Cancel', '取消')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmPendingAction('unban');
                            setShowDevModPanel(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{pick('Mở Khóa (Unban)', 'Unban', '解除封禁')}</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowDevModPanel((prev) => !prev);
                        setConfirmPendingAction(null);
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{pick('Ban / Khóa TK', 'Ban / Lock', '封禁账号')}</span>
                      {showDevModPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {showDevModPanel && (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-2">
                      <div className="text-[10px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{pick('Chọn mức xử phạt thủ công', 'Select Manual Sanction', '选择手动封禁级别')}</span>
                      </div>

                      <select
                        value={selectedTier}
                        onChange={(e) => {
                          setSelectedTier(e.target.value as SanctionTierKey);
                          setConfirmPendingAction(null);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-100 focus:outline-none focus:border-rose-500"
                      >
                        {DEV_PROFILE_TIER_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {pick(opt.labelVi, opt.labelEn, opt.labelZh)}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder={pick('Lý do ban / nhắc nhở (tùy chọn)...', 'Reason / note (optional)...', '封禁原因（可选）...')}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                      />

                      {confirmPendingAction === 'ban' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSubmittingMod}
                            onClick={handleApplyManualBan}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            <span>{isSubmittingMod ? pick('Đang xử lý...', 'Applying...', '处理中...') : pick('Xác nhận Ban ngay', 'Confirm Ban', '确认封禁')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingMod}
                            onClick={() => setConfirmPendingAction(null)}
                            className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                          >
                            {pick('Hủy', 'Cancel', '取消')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmPendingAction('ban')}
                          className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{pick('Áp dụng Ban / Khóa', 'Apply Ban / Lock', '立即封禁')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Badges / Roles footer */}
          <div className="mt-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {pick('Thành viên chính thức', 'Official Member', '正式成员')}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-md"
            >
              {pick('Đóng', 'Close', '关闭')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
