import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, getClientDeviceId } from '../../context/AuthContext';
import { useLanguage, pickLang, getLocaleTag } from '../../context/LanguageContext';
import { auth } from '../../firebase/config';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Laptop,
  Smartphone,
  Monitor,
  Tablet,
  Tv,
  Volume2,
  VolumeX,
  DownloadCloud,
  LogOut,
  User,
  Check,
  Palette,
  RefreshCw,
  Shuffle,
  Mail,
  Copy,
  ShieldCheck,
  Camera,
  Trash2,
  HardDrive,
  Phone,
  Globe,
  KeyRound,
  MonitorSmartphone,
  Database,
  Scale,
  AlertCircle,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { LoginSession } from '../types';
import { AVATAR_COLORS, getDeviceTypeInfo, generateDefaultDeviceName } from '../../utils/device';
import { playReceiveSound } from '../../utils/sound';
import { getPwaStorageEstimate, cleanAllPwaCachesAndBloat, StorageEstimateInfo } from '../../utils/pwaStorageCleaner';
import { isDevUser } from '../../utils/devModeration';
import { useLocalDevMode } from '../../utils/localDevMode';
import { DeveloperModePanel } from '../DeveloperModePanel';

export interface MobileSettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRules?: () => void;
  onOpenDevConsole?: () => void;
  onOpenDevPage?: () => void;
}

type MobileSettingsScreen =
  | 'hub'
  | 'device'
  | 'profile'
  | 'language'
  | 'security'
  | 'sessions'
  | 'developer';

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  isOpen,
  onClose,
  onOpenRules,
  onOpenDevConsole,
  onOpenDevPage
}) => {
  const {
    currentUser,
    userProfile,
    settings,
    updateSettings,
    logout,
    changePassword,
    updateDisplayName,
    linkEmail,
    linkPhoneNumber,
    linkWithGoogleAccount,
    getLoginSessions,
    logoutSession,
    logoutAllDevices
  } = useAuth();
  const { t, currentLang, setLanguage, languages } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);
  const isDev = isDevUser(currentUser?.email);
  const { canAccessDevTab } = useLocalDevMode(isDev);

  const [screen, setScreen] = useState<MobileSettingsScreen>('hub');

  useEffect(() => {
    if (screen === 'developer' && !canAccessDevTab) {
      setScreen('hub');
    }
  }, [screen, canAccessDevTab]);

  // Form states
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [autoAccept, setAutoAccept] = useState(settings.autoAccept);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [avatarColor, setAvatarColor] = useState(settings.avatarColor);
  const [customBadgeText, setCustomBadgeText] = useState<string>(settings.customBadgeText || pick('Thành viên ClSend', 'ClSend Member', 'ClSend 成员'));
  const [customBio, setCustomBio] = useState<string>(settings.customBio || pick('Sẵn sàng truyền nhận dữ liệu tốc độ cao.', 'Ready for high-speed data transfer.', '随时准备高速收发数据。'));
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(settings.customAvatarUrl);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | undefined>(settings.bannerUrl);

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Account & Username
  const rawUsername =
    userProfile?.username ||
    (currentUser?.email?.includes('@cloudsend.local')
      ? currentUser.email.split('@')[0]
      : currentUser?.displayName || '');
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || userProfile?.displayName || '');

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Email / Google Linking
  const isGoogleUser = Boolean(
    auth.currentUser?.providerData?.some((p: any) => p.providerId === 'google.com')
  );
  const isLinkedEmail = Boolean(
    currentUser?.email && !currentUser.email.includes('@cloudsend.local') && !currentUser.email.startsWith('guest_')
  );
  const [linkEmailInput, setLinkEmailInput] = useState(
    isLinkedEmail ? currentUser?.email || userProfile?.linkedEmail || '' : ''
  );
  const [linkEmailSuccess, setLinkEmailSuccess] = useState<string | null>(null);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [isLinkingEmailDirect, setIsLinkingEmailDirect] = useState(false);

  // Phone Linking
  const currentLinkedPhone =
    userProfile?.phone || userProfile?.linkedPhone || userProfile?.phoneNumber || currentUser?.phone || '';
  const [phoneInput, setPhoneInput] = useState(currentLinkedPhone);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [phoneLinkSuccess, setPhoneLinkSuccess] = useState<string | null>(null);
  const [phoneLinkError, setPhoneLinkError] = useState<string | null>(null);

  // Storage
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Pairing Code
  const [copiedPairingCode, setCopiedPairingCode] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(() =>
    typeof window !== 'undefined' ? getClientDeviceId() : ''
  );

  const pairingCode = useMemo(() => {
    if (!currentDeviceId) return '------';
    return currentDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  }, [currentDeviceId]);

  const showQuickToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2400);
  };

  useEffect(() => {
    if (isOpen) {
      setScreen('hub');
      setDeviceName(settings.deviceName);
      setAvatarColor(settings.avatarColor);
      setAutoAccept(settings.autoAccept);
      setSoundEnabled(settings.soundEnabled);
      setCustomBadgeText(settings.customBadgeText || pick('Thành viên ClSend', 'ClSend Member', 'ClSend 成员'));
      setCustomBio(settings.customBio || pick('Sẵn sàng truyền nhận dữ liệu tốc độ cao.', 'Ready for high-speed data transfer.', '随时准备高速收发数据。'));
      setCustomAvatarUrl(settings.customAvatarUrl);
      setCustomBannerUrl(settings.bannerUrl);
      setEditDisplayName(currentUser?.displayName || userProfile?.displayName || '');
      setLinkEmailInput(isLinkedEmail ? currentUser?.email || userProfile?.linkedEmail || '' : '');
      setPhoneInput(currentLinkedPhone);
      setLinkEmailError(null);
      setLinkEmailSuccess(null);
      setPhoneLinkError(null);
      setPhoneLinkSuccess(null);
      setPasswordError(null);
      setPasswordSuccess(null);
      setShowLogoutAllConfirm(false);
      getPwaStorageEstimate().then(setStorageInfo).catch(() => {});
    }
  }, [isOpen, settings, currentUser, userProfile, isLinkedEmail, currentLinkedPhone]);

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const list = await getLoginSessions();
      setSessions(list);
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen && screen === 'sessions') {
      fetchSessions();
    }
  }, [isOpen, screen]);

  const compressProfileImage = (file: File, maxDim: number, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawData = e.target?.result as string;
        if (!rawData) {
          resolve('');
          return;
        }
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(rawData);
          }
        };
        img.onerror = () => resolve(rawData);
        img.src = rawData;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const result = await compressProfileImage(file, 256, 0.85);
    if (result) {
      setCustomAvatarUrl(result);
      await updateSettings({ customAvatarUrl: result });
      showQuickToast(t('settings.save_success_toast'));
    }
    e.target.value = '';
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const result = await compressProfileImage(file, 800, 0.82);
    if (result) {
      setCustomBannerUrl(result);
      await updateSettings({ bannerUrl: result });
      showQuickToast(t('settings.save_success_toast'));
    }
    e.target.value = '';
  };

  const handleToggleAutoAccept = async () => {
    const next = !autoAccept;
    setAutoAccept(next);
    await updateSettings({ autoAccept: next });
    showQuickToast(t('settings.save_success_toast'));
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    await updateSettings({ soundEnabled: next });
    if (next) playReceiveSound();
    showQuickToast(t('settings.save_success_toast'));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const syncedName = (deviceName || editDisplayName || settings.deviceName).trim();
    await updateSettings({
      deviceName: syncedName,
      avatarColor,
      autoAccept,
      soundEnabled,
      customBadgeText: customBadgeText.trim(),
      customBio: customBio.trim(),
      customAvatarUrl,
      bannerUrl: customBannerUrl
    });
    if (syncedName && (!currentUser?.displayName || currentUser.displayName !== syncedName)) {
      try {
        await updateDisplayName(syncedName);
      } catch {}
    }
    setIsSaving(false);
    showQuickToast(t('settings.save_success_toast'));
  };

  const handleCleanStorage = async () => {
    setIsCleaningStorage(true);
    try {
      const { freedMb } = await cleanAllPwaCachesAndBloat();
      const updated = await getPwaStorageEstimate();
      setStorageInfo(updated);
      showQuickToast(
        pick(
          'Đã dọn {amount}',
          'Freed {amount}',
          '已清理 {amount}'
        ).replace('{amount}', freedMb > 0 ? `${freedMb} MB` : pick('bộ nhớ đệm', 'cache', '缓存'))
      );
    } catch {
      // ignore
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedPairingCode(true);
    setTimeout(() => setCopiedPairingCode(false), 1800);
  };

  const handleRegeneratePairingCode = () => {
    const newId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('cloudsend_client_device_id', newId);
    setCurrentDeviceId(newId);
    showQuickToast(pick('Đã tạo mã ghép mới', 'Generated new pairing PIN', '已生成新配对码'));
  };

  const handleCopyUsername = () => {
    if (!rawUsername) return;
    navigator.clipboard.writeText(rawUsername);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 1800);
  };

  const handleLinkPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneLinkError(null);
    setPhoneLinkSuccess(null);
    setIsLinkingPhone(true);
    try {
      const saved = await linkPhoneNumber(phoneInput);
      setPhoneInput(saved);
      setPhoneLinkSuccess(pick('Đã liên kết {val}!', 'Linked {val}!', '已绑定 {val}！').replace('{val}', saved));
    } catch (err: any) {
      setPhoneLinkError(err?.message || pick('Không thể liên kết SĐT.', 'Unable to link phone.', '无法绑定手机号。'));
    } finally {
      setIsLinkingPhone(false);
    }
  };

  const handleLinkEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkEmailError(null);
    setLinkEmailSuccess(null);
    setIsLinkingEmailDirect(true);
    try {
      await linkEmail(linkEmailInput);
      setLinkEmailSuccess(
        pick('Đã liên kết {val}!', 'Linked {val}!', '已绑定 {val}！').replace('{val}', linkEmailInput.trim().toLowerCase())
      );
    } catch (err: any) {
      setLinkEmailError(err?.message || pick('Không thể liên kết Email.', 'Unable to link email.', '无法绑定邮箱。'));
    } finally {
      setIsLinkingEmailDirect(false);
    }
  };

  const handleLinkGoogleSubmit = async () => {
    setLinkEmailError(null);
    setLinkEmailSuccess(null);
    setIsLinkingEmailDirect(true);
    try {
      const res = await linkWithGoogleAccount();
      if (res?.email) {
        setLinkEmailInput(res.email);
        setLinkEmailSuccess(pick('Đã đồng bộ {val}!', 'Synced {val}!', '已同步 {val}！').replace('{val}', res.email));
      }
    } catch (err: any) {
      setLinkEmailError(err?.message || pick('Không thể đồng bộ Google.', 'Unable to sync Google.', '无法同步 Google。'));
    } finally {
      setIsLinkingEmailDirect(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword) {
      setPasswordError(pick('Vui lòng nhập mật khẩu cũ.', 'Enter current password.', '请输入当前密码。'));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError(pick('Mật khẩu mới tối thiểu 6 ký tự.', 'New password min 6 chars.', '新密码至少 6 个字符。'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(pick('Mật khẩu xác nhận không khớp.', 'Passwords do not match.', '两次密码不一致。'));
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(pick('Đổi mật khẩu thành công!', 'Password updated!', '密码修改成功！'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || pick('Không thể đổi mật khẩu.', 'Could not update password.', '无法修改密码。'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDirectLogout = async () => {
    setIsLoggingOut(true);
    onClose();
    await logout();
  };

  const handleLogoutAllConfirm = async () => {
    setIsLoggingOutAll(true);
    try {
      await logoutAllDevices();
      onClose();
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  if (!isOpen) return null;

  const deviceInfo = getDeviceTypeInfo(settings.deviceType, currentLang);
  const displayName = editDisplayName || currentUser?.displayName || userProfile?.displayName || settings.deviceName || 'ClSend';
  const displayUsername = rawUsername || 'user';
  const displayAvatar =
    customAvatarUrl ||
    currentUser?.photoURL ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
  const activeLanguageObj = languages.find((l) => l.code === currentLang) || languages[0];

  const renderDeviceIcon = (type: string, sizeClass = 'w-5 h-5') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className={`${sizeClass} text-emerald-400`} />;
      case 'tablet':
        return <Tablet className={`${sizeClass} text-emerald-400`} />;
      case 'desktop':
        return <Monitor className={`${sizeClass} text-sky-400`} />;
      case 'tv':
        return <Tv className={`${sizeClass} text-amber-400`} />;
      case 'laptop':
      default:
        return <Laptop className={`${sizeClass} text-emerald-400`} />;
    }
  };

  const formatSessionTime = (isoString?: string) => {
    if (!isoString) return pick('Vừa xong', 'Just now', '刚刚');
    try {
      return new Date(isoString).toLocaleString(getLocaleTag(currentLang), {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const screenTitles: Record<MobileSettingsScreen, string> = {
    hub: t('nav.mobile_settings', 'Cài đặt'),
    device: t('settings.tab_device', 'Thiết Bị & Mạng'),
    profile: t('settings.tab_design', 'Hồ Sơ & Giao Diện'),
    language: t('settings.language', 'Ngôn ngữ giao diện'),
    security: t('settings.tab_account', 'Tài Khoản & Bảo Mật'),
    sessions: t('settings.sessions_title', 'Thiết bị đang đăng nhập').replace(/^\d+\.\s*/, ''),
    developer: pick('Chế độ Nhà phát triển', 'Developer Mode', '开发者模式')
  };

  return (
    <div
      id="mobile-settings-frame"
      className="fixed inset-0 z-50 bg-[#0b0f19] text-slate-100 flex flex-col w-full h-[100dvh] overflow-hidden animate-in fade-in duration-150"
    >
      {/* Mobile Top App Bar (~54px compact sticky header) */}
      <header className="shrink-0 h-[54px] px-2 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between safe-top safe-left safe-right">
        <button
          type="button"
          onClick={() => {
            if (screen === 'hub') {
              onClose();
            } else {
              setScreen('hub');
            }
          }}
          className="min-w-[44px] min-h-[44px] px-2 flex items-center justify-start gap-1 text-slate-300 hover:text-white active:scale-95 transition-transform cursor-pointer"
          aria-label={screen === 'hub' ? t('settings.close_btn', 'Đóng') : 'Back'}
        >
          {screen === 'hub' ? (
            <X className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">
                {pick('Cài đặt', 'Settings', '设置')}
              </span>
            </>
          )}
        </button>

        <h1 className="text-sm font-bold text-white truncate px-2 text-center">
          {screenTitles[screen]}
        </h1>

        {screen === 'device' || screen === 'profile' ? (
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-end text-xs font-bold text-emerald-400 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : pick('Lưu', 'Save', '保存')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] px-2 flex items-center justify-end text-slate-400 hover:text-white active:scale-95 transition-transform cursor-pointer"
            aria-label={t('settings.close_btn', 'Đóng')}
          >
            {screen !== 'hub' ? <X className="w-5 h-5" /> : <span className="w-5" />}
          </button>
        )}
      </header>

      {/* Floating Feedback Toast */}
      {savedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-bold shadow-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* Scrollable Viewport Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 space-y-5"
        style={{ paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 24px))' }}
      >
        <div className="max-w-lg mx-auto w-full space-y-5">
          {/* ======================= HUB SCREEN ======================= */}
          {screen === 'hub' && (
            <>
              {/* Profile Summary Card */}
              <button
                type="button"
                onClick={() => setScreen('profile')}
                className="w-full text-left rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div
                  className="h-14 w-full bg-cover bg-center opacity-85"
                  style={{
                    background: customBannerUrl
                      ? `url(${customBannerUrl}) center/cover no-repeat`
                      : 'linear-gradient(120deg, rgba(16,185,129,0.42), rgba(14,165,233,0.32))'
                  }}
                />
                <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-3 relative">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-14 h-14 -mt-7 rounded-full object-cover ring-4 ring-[#131926] bg-slate-800 shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-base font-bold text-white truncate">{displayName}</div>
                      <div className="text-xs text-slate-400 truncate font-mono mt-0.5">
                        @{displayUsername} · {customBadgeText || 'ClSend'}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-[44px] min-h-[44px] flex items-center justify-end text-slate-400 shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </button>

              {/* 2-Column Mobile Stat & Utility Tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col justify-between gap-2">
                  <div className="text-[11px] font-medium text-slate-400">
                    {pick('Mã Ghép PIN', 'Pairing PIN', '配对码')}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base font-mono font-black text-emerald-400 tracking-wider">
                      #{pairingCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPairingCode}
                      className="min-w-[44px] min-h-[44px] -my-2 -mr-2 rounded-xl flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-transform cursor-pointer"
                      aria-label={t('settings.copy', 'Sao chép')}
                    >
                      {copiedPairingCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col justify-between gap-2">
                  <div className="text-[11px] font-medium text-slate-400">
                    {pick('Bộ nhớ đệm', 'Cache Usage', '缓存占用')}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base font-bold text-white tabular-nums">
                      {storageInfo ? `${storageInfo.usageMb} MB` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCleanStorage}
                      disabled={isCleaningStorage}
                      className="min-w-[44px] min-h-[44px] -my-2 -mr-2 px-2.5 rounded-xl flex items-center justify-center text-xs font-bold text-teal-400 hover:bg-teal-500/10 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                    >
                      {isCleaningStorage ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Group 1: Device & Transfer Controls */}
              <div className="space-y-1.5">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('settings.tab_device', 'Thiết Bị & Mạng')}
                </div>
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setScreen('device')}
                    className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                        {renderDeviceIcon(settings.deviceType, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{deviceName || displayName}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {deviceInfo.label} · #{pairingCode}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>

                  {/* Native iOS-style Switch: Auto-Accept */}
                  <div className="min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0">
                        <DownloadCloud className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {t('settings.quick_save', 'Tự động nhận tệp')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {t('settings.auto_accept_desc', 'Lưu trực tiếp tệp gửi tới mà không cần bấm')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoAccept}
                      onClick={handleToggleAutoAccept}
                      className="min-w-[52px] min-h-[44px] flex items-center justify-end cursor-pointer shrink-0"
                    >
                      <span
                        className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                          autoAccept ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            autoAccept ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                  </div>

                  {/* Native iOS-style Switch: Notification Sound */}
                  <div className="min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                        {soundEnabled ? (
                          <Volume2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {t('settings.sound_notif', 'Âm thanh thông báo')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {t('settings.sound_notif_desc', 'Chuông nhẹ khi gửi/nhận tệp & tin nhắn')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => playReceiveSound()}
                      className="min-h-[44px] px-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white active:bg-slate-800 shrink-0 cursor-pointer"
                    >
                      {t('settings.test_sound', 'Thử')}
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={handleToggleSound}
                      className="min-w-[52px] min-h-[44px] flex items-center justify-end cursor-pointer shrink-0"
                    >
                      <span
                        className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                          soundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            soundEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Group 2: Personalization & Language */}
              <div className="space-y-1.5">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('settings.tab_design', 'Hồ Sơ & Giao Diện')}
                </div>
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setScreen('profile')}
                    className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                        <Palette className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {pick('Avatar, Ảnh bìa & Thẻ cá nhân', 'Avatar, Banner & Profile Card', '头像、横幅与个人名片')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{customBio}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen('language')}
                    className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{t('settings.language', 'Ngôn ngữ')}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {activeLanguageObj.flag} {activeLanguageObj.name}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Group 3: Account Security & Sessions */}
              <div className="space-y-1.5">
                <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('settings.tab_account', 'Tài Khoản & Bảo Mật')}
                </div>
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setScreen('security')}
                    className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {pick('Liên kết SĐT, Email & Mật khẩu', 'Phone, Email & Password', '绑定手机、邮箱与密码')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {[
                            currentLinkedPhone || pick('Chưa có SĐT', 'No phone', '未绑定手机'),
                            isLinkedEmail ? currentUser?.email : pick('Chưa có Email', 'No email', '未绑定邮箱')
                          ].join(' · ')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen('sessions')}
                    className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                        <MonitorSmartphone className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {pick('Thiết bị đang đăng nhập', 'Active Sessions', '已登录设备')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {t('settings.sessions_desc', 'Theo dõi thiết bị và đăng xuất từ xa')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Group 4: Community Rules & DEV Tools */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                {onOpenRules && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRules();
                    }}
                    className="w-full min-h-[56px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                        <Scale className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {t('settings.view_rules', 'Nội Quy & Điều Khoản')}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                )}

                {isDev && (onOpenDevPage || onOpenDevConsole) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenDevPage) onOpenDevPage();
                      else if (onOpenDevConsole) onOpenDevConsole();
                    }}
                    className="w-full min-h-[56px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-amber-300">
                          {t('settings.open_datastore', 'DEV DataStore')}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {pick('Quản trị dữ liệu & kiểm duyệt', 'Admin & moderation tools', '数据与审核管理')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                  </button>
                )}

                {canAccessDevTab && (
                  <button
                    id="mobile-settings-dev-mode-btn"
                    type="button"
                    onClick={() => setScreen('developer')}
                    className="w-full min-h-[56px] px-4 py-2.5 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                          <span>{pick('Chế độ Nhà phát triển', 'Developer Mode', '开发者模式')}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                            {isDev ? 'DEV' : 'LOCAL'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {pick('Debug Log, hiệu năng & cài đặt máy cục bộ', 'Debug Log, performance & local device tweaks', '调试日志、性能与本地设备设置')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  </button>
                )}
              </div>

              {/* Logout CTA */}
              <button
                type="button"
                onClick={handleDirectLogout}
                disabled={isLoggingOut}
                className="w-full h-12 rounded-2xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/35 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('settings.logout_this_btn', 'Đăng xuất tài khoản')}</span>
              </button>
            </>
          )}

          {/* ======================= DEVICE SUB-PAGE ======================= */}
          {screen === 'device' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t('settings.device_name_label', 'Tên thiết bị hiển thị')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = generateDefaultDeviceName(settings.deviceType);
                      setDeviceName(nextName);
                      setEditDisplayName(nextName);
                    }}
                    className="min-h-[36px] px-2.5 rounded-xl bg-slate-800 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>{t('settings.random_name', 'Ngẫu nhiên')}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => {
                    setDeviceName(e.target.value);
                    setEditDisplayName(e.target.value);
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    {renderDeviceIcon(settings.deviceType, 'w-5 h-5')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{deviceInfo.label}</div>
                    <div className="text-xs text-slate-400">{deviceInfo.description}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400">{t('settings.pairing_code_label', 'Mã Ghép Nối PIN')}</div>
                    <div className="text-lg font-mono font-black text-emerald-400 tracking-widest mt-0.5">
                      #{pairingCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegeneratePairingCode}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center active:scale-95 cursor-pointer"
                      title={t('settings.refresh_pairing_code', 'Đổi mã mới')}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPairingCode}
                      className="min-h-[44px] px-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      {copiedPairingCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedPairingCode ? t('settings.copied', 'Đã chép') : t('settings.copy', 'Chép')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">
                    {pick('Bộ nhớ đệm PWA', 'PWA Cache Storage', 'PWA 缓存')}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {storageInfo ? `${storageInfo.usageMb} MB` : '—'} ·{' '}
                    {pick('Dọn dẹp tệp đệm tạm', 'Clean cached blobs', '清理临时缓存')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCleanStorage}
                  disabled={isCleaningStorage}
                  className="min-h-[44px] px-4 rounded-xl bg-teal-600/25 border border-teal-500/35 text-teal-300 text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{pick('Dọn dẹp', 'Clean', '清理')}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                <span>{t('settings.save_changes_btn', 'Lưu thay đổi')}</span>
              </button>
            </div>
          )}

          {/* ======================= PROFILE SUB-PAGE ======================= */}
          {screen === 'profile' && (
            <div className="space-y-4">
              {/* Live Profile Card Preview */}
              <div className="w-full bg-[#1e1f22] text-slate-100 rounded-3xl shadow-xl border border-slate-800 overflow-hidden">
                <div
                  className="h-24 w-full bg-cover bg-center relative"
                  style={{
                    background: customBannerUrl
                      ? `url(${customBannerUrl}) center/cover no-repeat`
                      : 'linear-gradient(to right, #059669, #0d9488)'
                  }}
                />
                <div className="px-4 pb-4 pt-9 relative">
                  <div className="absolute -top-8 left-4">
                    {customAvatarUrl ? (
                      <img
                        src={customAvatarUrl}
                        alt="Avatar"
                        className="w-16 h-16 rounded-full object-cover ring-4 ring-[#1e1f22] shadow-lg"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xl ring-4 ring-[#1e1f22] shadow-lg"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {(editDisplayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-white truncate">{editDisplayName || displayName}</h4>
                    <span className="text-xs text-amber-300 font-semibold truncate max-w-[140px]">
                      {customBadgeText || 'ClSend'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">@{displayUsername}</p>
                  <div className="my-2.5 h-px w-full bg-slate-800" />
                  <p className="text-xs text-slate-300 italic">{customBio}</p>
                </div>
              </div>

              {/* Avatar & Banner Upload Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="file"
                  ref={avatarFileInputRef}
                  onChange={handleAvatarFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="min-h-[48px] px-3 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('settings.upload_photo', 'Đổi Avatar')}</span>
                </button>

                <input
                  type="file"
                  ref={bannerFileInputRef}
                  onChange={handleBannerFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bannerFileInputRef.current?.click()}
                  className="min-h-[48px] px-3 rounded-2xl bg-slate-900 border border-slate-800 text-sky-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('settings.change_banner', 'Đổi ảnh bìa')}</span>
                </button>
              </div>

              {(customAvatarUrl || customBannerUrl) && (
                <div className="flex items-center gap-2">
                  {customAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAvatarUrl(undefined);
                        updateSettings({ customAvatarUrl: undefined });
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold cursor-pointer"
                    >
                      {t('settings.delete_photo', 'Xóa Avatar')}
                    </button>
                  )}
                  {customBannerUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomBannerUrl(undefined);
                        updateSettings({ bannerUrl: undefined });
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold cursor-pointer"
                    >
                      {t('settings.delete_banner', 'Xóa ảnh bìa')}
                    </button>
                  )}
                </div>
              )}

              {/* Avatar Color Swatches */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-300">{t('settings.default_color', 'Màu mặc định')}</div>
                <div className="flex items-center gap-3 flex-wrap">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAvatarColor(col)}
                      className={`w-10 h-10 rounded-full transition-transform cursor-pointer ${
                        avatarColor === col ? 'ring-2 ring-white scale-110' : 'opacity-75'
                      }`}
                      style={{ backgroundColor: col }}
                      aria-label={col}
                    />
                  ))}
                </div>
              </div>

              {/* Editable Profile Fields */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {pick('Tên hiển thị', 'Display Name', '显示名称')}
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={editDisplayName}
                    onChange={(e) => {
                      setEditDisplayName(e.target.value);
                      setDeviceName(e.target.value);
                    }}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {t('settings.badge_label', 'Huy hiệu hiển thị')}
                  </label>
                  <input
                    type="text"
                    value={customBadgeText}
                    onChange={(e) => setCustomBadgeText(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {t('settings.bio_label', 'Tiểu sử / Lời chào')}
                  </label>
                  <textarea
                    rows={3}
                    value={customBio}
                    onChange={(e) => setCustomBio(e.target.value)}
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white resize-none outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                <span>{t('settings.save_changes_btn', 'Lưu thay đổi')}</span>
              </button>
            </div>
          )}

          {/* ======================= LANGUAGE SUB-PAGE ======================= */}
          {screen === 'language' && (
            <div translate="no" className="notranslate rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
              {languages.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      showQuickToast(`${lang.flag} ${lang.name}`);
                    }}
                    className={`w-full min-h-[54px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-500/15' : 'active:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{lang.flag}</span>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                          {lang.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{lang.label}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ======================= SECURITY SUB-PAGE ======================= */}
          {screen === 'security' && (
            <div className="space-y-4">
              {/* Username Card */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">{pick('Tên tài khoản', 'Username', '用户名')}</div>
                  <div className="text-sm font-mono font-bold text-white truncate mt-0.5">@{displayUsername}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUsername}
                  className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                >
                  {copiedUsername ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUsername ? t('settings.copied', 'Đã chép') : t('settings.copy', 'Chép')}</span>
                </button>
              </div>

              {/* Phone Linking */}
              <form onSubmit={handleLinkPhoneSubmit} className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>{pick('Số điện thoại liên kết', 'Linked Phone', '绑定手机号')}</span>
                  </div>
                  {currentLinkedPhone && (
                    <span className="text-xs font-semibold text-emerald-400">
                      {pick('Đã lưu', 'Saved', '已绑定')}
                    </span>
                  )}
                </div>
                {phoneLinkError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{phoneLinkError}</span>
                  </div>
                )}
                {phoneLinkSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{phoneLinkSuccess}</span>
                  </div>
                )}
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="09xx xxx xxx / +84..."
                  className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isLinkingPhone}
                  className="w-full h-11 rounded-xl bg-emerald-600/25 border border-emerald-500/35 text-emerald-300 text-xs font-bold active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
                >
                  {isLinkingPhone ? '...' : pick('Lưu Số Điện Thoại', 'Save Phone Number', '保存手机号')}
                </button>
              </form>

              {/* Email & Google Sync */}
              <form onSubmit={handleLinkEmailSubmit} className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Mail className="w-4 h-4 text-sky-400" />
                    <span>{pick('Email / Gmail liên kết', 'Linked Email / Gmail', '绑定邮箱 / Gmail')}</span>
                  </div>
                  {isLinkedEmail && (
                    <span className="text-xs font-semibold text-sky-400">
                      {pick('Đã liên kết', 'Linked', '已绑定')}
                    </span>
                  )}
                </div>
                {linkEmailError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{linkEmailError}</span>
                  </div>
                )}
                {linkEmailSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{linkEmailSuccess}</span>
                  </div>
                )}
                <input
                  type="email"
                  value={linkEmailInput}
                  onChange={(e) => setLinkEmailInput(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isLinkingEmailDirect}
                  className="w-full h-11 rounded-xl bg-sky-600/25 border border-sky-500/35 text-sky-300 text-xs font-bold active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
                >
                  {isLinkingEmailDirect ? '...' : pick('Lưu Email Liên Kết', 'Save Linked Email', '保存邮箱')}
                </button>
                <button
                  type="button"
                  onClick={handleLinkGoogleSubmit}
                  disabled={isLinkingEmailDirect}
                  className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
                >
                  {pick('Đồng bộ trực tiếp tài khoản Google', 'Sync with Google Account', '同步 Google 账号')}
                </button>
              </form>

              {/* Change Password */}
              {!isGoogleUser && (
                <form onSubmit={handleChangePasswordSubmit} className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>{pick('Đổi Mật Khẩu', 'Change Password', '修改密码')}</span>
                  </div>
                  {passwordError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-300 text-xs">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs">{passwordSuccess}</div>
                  )}
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={pick('Mật khẩu cũ', 'Current password', '当前密码')}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-amber-500"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={pick('Mật khẩu mới', 'New password', '新密码')}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-amber-500"
                  />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={pick('Nhập lại mật khẩu mới', 'Confirm new password', '确认新密码')}
                    className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full h-11 rounded-xl bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-bold active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
                  >
                    {pick('Cập Nhật Mật Khẩu', 'Update Password', '更新密码')}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ======================= SESSIONS SUB-PAGE ======================= */}
          {screen === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {pick('Thiết bị ({count})', 'Devices ({count})', '设备 ({count})').replace('{count}', String(sessions.length))}
                </div>
                <button
                  type="button"
                  onClick={fetchSessions}
                  disabled={isLoadingSessions}
                  className="min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  <span>{t('settings.refresh', 'Làm mới')}</span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                {sessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    {isLoadingSessions
                      ? pick('Đang tải danh sách thiết bị...', 'Loading sessions...', '加载设备中...')
                      : t('settings.no_sessions', 'Chưa có dữ liệu phiên.')}
                  </div>
                ) : (
                  sessions.map((sess) => (
                    <div key={sess.id} className="min-h-[64px] px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          {renderDeviceIcon(sess.deviceType || 'laptop', 'w-4 h-4')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{sess.deviceName}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {sess.location || pick('Không rõ vị trí', 'Unknown location', '未知位置')} · {formatSessionTime(sess.loginAt)}
                          </div>
                        </div>
                      </div>
                      {sess.isCurrent ? (
                        <span className="text-xs font-bold text-emerald-400 shrink-0">
                          {t('settings.current_device', 'Máy này')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await logoutSession(sess.id);
                            await fetchSessions();
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold shrink-0 cursor-pointer"
                        >
                          {t('settings.logout_session', 'Đăng xuất')}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {!showLogoutAllConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowLogoutAllConfirm(true)}
                  className="w-full h-12 rounded-2xl bg-rose-600/15 border border-rose-500/35 text-rose-300 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('settings.logout_all_btn', 'Đăng xuất tất cả thiết bị')}</span>
                </button>
              ) : (
                <div className="rounded-2xl bg-rose-950/50 border border-rose-500/40 p-4 space-y-3">
                  <div className="text-xs text-rose-200 leading-relaxed">
                    {t(
                      'settings.logout_all_confirm_desc',
                      'Toàn bộ các phiên làm việc trên các máy khác sẽ bị đăng xuất ngay lập tức.'
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowLogoutAllConfirm(false)}
                      className="h-11 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      {t('settings.cancel_btn', 'Hủy')}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoutAllConfirm}
                      disabled={isLoggingOutAll}
                      className="h-11 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isLoggingOutAll ? '...' : t('settings.logout_all_btn', 'Xác nhận')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================= DEVELOPER MODE SUB-PAGE ======================= */}
          {screen === 'developer' && canAccessDevTab && (
            <DeveloperModePanel
              isDev={isDev}
              compact
              onAfterLock={() => setScreen('hub')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
