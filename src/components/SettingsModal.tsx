import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, getClientDeviceId } from '../context/AuthContext';
import { useLanguage, pickLang, getLocaleTag } from '../context/LanguageContext';
import { auth } from '../firebase/config';
import { 
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
  Cpu, 
  Shuffle, 
  KeyRound, 
  Mail, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Power, 
  ShieldCheck, 
  Camera, 
  Trash2, 
  HardDrive,
  Bell,
  Phone,
  Globe,
  Code2
} from 'lucide-react';
import { LoginSession } from './types';
import { AVATAR_COLORS, getDeviceTypeInfo, generateDefaultDeviceName } from '../utils/device';
import { playReceiveSound } from '../utils/sound';
import { triggerIncomingChatMessageNotification } from '../utils/tabNotification';
import { getPwaStorageEstimate, cleanAllPwaCachesAndBloat, StorageEstimateInfo } from '../utils/pwaStorageCleaner';

import { isDevUser } from '../utils/devModeration';
import { useLocalDevMode } from '../utils/localDevMode';
import { DeveloperModePanel } from './DeveloperModePanel';
import { MobileSettingsView } from './mobile/MobileSettingsView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRules?: () => void;
  onOpenDevConsole?: () => void;
  onOpenDevPage?: () => void;
  showDataChannelAvatars?: boolean;
  forceMobileLayout?: boolean;
}

type SettingsTab = 'account' | 'appearance' | 'notifications' | 'developer';

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onOpenRules, 
  onOpenDevConsole,
  onOpenDevPage,
  forceMobileLayout = false,
}) => {
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsSmallScreen(mq.matches);
    handleChange();
    mq.addEventListener?.('change', handleChange);
    return () => mq.removeEventListener?.('change', handleChange);
  }, []);
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
    sendEmailVerificationCode,
    verifyEmailCodeAndLink,
    getLoginSessions,
    logoutSession,
    logoutAllDevices,
  } = useAuth();
  const { t, currentLang, setLanguage, languages } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);
  
  // Tab Management
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const isDev = isDevUser(currentUser?.email);
  const { canAccessDevTab } = useLocalDevMode(isDev);

  useEffect(() => {
    if (activeTab === 'developer' && !canAccessDevTab) {
      setActiveTab('account');
    }
  }, [activeTab, canAccessDevTab]);

  // Device & Preference Form States
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [autoAccept, setAutoAccept] = useState(settings.autoAccept);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  
  // Profile & Appearance Form States
  const [avatarColor, setAvatarColor] = useState(settings.avatarColor);
  const [customBadgeText, setCustomBadgeText] = useState<string>(settings.customBadgeText || pick('Thành viên ClSend', 'ClSend Member', 'ClSend 成员'));
  const [customBio, setCustomBio] = useState<string>(settings.customBio || pick('Sẵn sàng truyền nhận dữ liệu tốc độ cao.', 'Ready for high-speed file transfer.', '随时准备高速收发文件。'));
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | undefined>(settings.customAvatarUrl);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | undefined>(settings.bannerUrl);
  const [isDraggingAvatarFile, setIsDraggingAvatarFile] = useState(false);
  const [isDraggingBannerFile, setIsDraggingBannerFile] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Account & Security States
  const rawUsername = userProfile?.username || (currentUser?.email?.includes('@cloudsend.local') ? currentUser.email.split('@')[0] : (currentUser?.displayName || ''));
  const [copiedUsername, setCopiedUsername] = useState(false);

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Display Name States
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || userProfile?.displayName || '');
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [displayNameSuccess, setDisplayNameSuccess] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Gmail Verification & Linking
  const isGoogleUser = Boolean(
    auth.currentUser?.providerData?.some((p: any) => p.providerId === 'google.com')
  );
  const isLinkedEmail = Boolean(currentUser?.email && !currentUser.email.includes('@cloudsend.local') && !currentUser.email.startsWith('guest_'));
  const isEmailFullyVerified = Boolean(userProfile?.isEmailVerified || (isLinkedEmail && userProfile?.linkedEmail));
  const [linkEmailInput, setLinkEmailInput] = useState(isLinkedEmail ? (currentUser?.email || userProfile?.linkedEmail || '') : '');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpExpiresTimestamp, setOtpExpiresTimestamp] = useState<number | null>(null);
  const [otpTimeLeftSeconds, setOtpTimeLeftSeconds] = useState<number>(0);
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  const [isEditingLinkedEmail, setIsEditingLinkedEmail] = useState(false);
  const [linkEmailSuccess, setLinkEmailSuccess] = useState<string | null>(null);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [isLinkingEmailDirect, setIsLinkingEmailDirect] = useState(false);

  // Phone Number Linking
  const currentLinkedPhone = userProfile?.phone || userProfile?.linkedPhone || userProfile?.phoneNumber || currentUser?.phone || '';
  const [phoneInput, setPhoneInput] = useState(currentLinkedPhone);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [phoneLinkSuccess, setPhoneLinkSuccess] = useState<string | null>(null);
  const [phoneLinkError, setPhoneLinkError] = useState<string | null>(null);

  // Storage Cache Cleaner State
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [storageCleanSuccess, setStorageCleanSuccess] = useState<string | null>(null);

  // Login Sessions State
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Logout States
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);

  // Pairing Code
  const [copiedPairingCode, setCopiedPairingCode] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(() => {
    return typeof window !== 'undefined' ? getClientDeviceId() : '';
  });

  const pairingCode = useMemo(() => {
    if (!currentDeviceId) return '------';
    return currentDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  }, [currentDeviceId]);

  useEffect(() => {
    if (isOpen) {
      setDeviceName(settings.deviceName);
      setAvatarColor(settings.avatarColor);
      setAutoAccept(settings.autoAccept);
      setSoundEnabled(settings.soundEnabled);
      setCustomBadgeText(settings.customBadgeText || pick('Thành viên ClSend', 'ClSend Member', 'ClSend 成员'));
      setCustomBio(settings.customBio || pick('Sẵn sàng truyền nhận dữ liệu tốc độ cao.', 'Ready for high-speed file transfer.', '随时准备高速收发文件。'));
      setCustomAvatarUrl(settings.customAvatarUrl);
      setCustomBannerUrl(settings.bannerUrl);
      setEditDisplayName(currentUser?.displayName || userProfile?.displayName || '');
      setLinkEmailInput(isLinkedEmail ? (currentUser?.email || userProfile?.linkedEmail || '') : '');
      setPhoneInput(currentLinkedPhone);
      setLinkEmailError(null);
      setLinkEmailSuccess(null);
      setPhoneLinkError(null);
      setPhoneLinkSuccess(null);
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

  const handleLogoutSession = async (sessionId: string) => {
    await logoutSession(sessionId);
    await fetchSessions();
  };

  useEffect(() => {
    if (isOpen && activeTab === 'notifications') {
      fetchSessions();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOtpSent || !otpExpiresTimestamp) return;

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = otpExpiresTimestamp - now;
      const secondsLeft = Math.max(0, Math.floor(diffMs / 1000));
      setOtpTimeLeftSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        setIsOtpExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOtpSent, otpExpiresTimestamp]);

  const formatOtpCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
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
    if (!file.type.startsWith('image/')) {
      setDisplayNameError(pick('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP...)', 'Please select a valid image file (PNG, JPG, WebP...)', '请选择有效的图片文件（PNG、JPG、WebP 等）'));
      return;
    }
    const result = await compressProfileImage(file, 256, 0.85);
    if (result) {
      setCustomAvatarUrl(result);
      updateSettings({ customAvatarUrl: result });
    }
    e.target.value = '';
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setDisplayNameError(pick('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP...)', 'Please select a valid image file (PNG, JPG, WebP...)', '请选择有效的图片文件（PNG、JPG、WebP 等）'));
      return;
    }
    const result = await compressProfileImage(file, 800, 0.82);
    if (result) {
      setCustomBannerUrl(result);
      updateSettings({ bannerUrl: result });
    }
    e.target.value = '';
  };

  const handleCleanStorage = async () => {
    setIsCleaningStorage(true);
    setStorageCleanSuccess(null);
    try {
      const { freedMb } = await cleanAllPwaCachesAndBloat();
      const updated = await getPwaStorageEstimate();
      setStorageInfo(updated);
      setStorageCleanSuccess(
        pick('Đã giải phóng {size} bộ nhớ đệm.', 'Freed {size} of cache storage.', '已释放 {size} 缓存空间。').replace(
          '{size}',
          freedMb > 0 ? `${freedMb} MB` : pick('toàn bộ', 'all', '全部')
        )
      );
      setTimeout(() => setStorageCleanSuccess(null), 3500);
    } catch (e: any) {
      console.warn('Storage clean error:', e);
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleSave = async () => {
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
      bannerUrl: customBannerUrl,
    });
    if (syncedName && (!currentUser?.displayName || currentUser.displayName !== syncedName)) {
      try {
        await updateDisplayName(syncedName);
      } catch {
        // ignore
      }
    }
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedPairingCode(true);
    setTimeout(() => setCopiedPairingCode(false), 2000);
  };

  const handleRegeneratePairingCode = () => {
    const newId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('cloudsend_client_device_id', newId);
    setCurrentDeviceId(newId);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleRandomizeDeviceName = () => {
    const newName = generateDefaultDeviceName(settings.deviceType);
    setDeviceName(newName);
    setEditDisplayName(newName);
  };

  const handleCopyUsername = () => {
    if (rawUsername) {
      navigator.clipboard.writeText(rawUsername);
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 2000);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError(pick('Vui lòng nhập mật khẩu hiện tại.', 'Please enter your current password.', '请输入当前密码。'));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError(pick('Mật khẩu mới phải có ít nhất 6 ký tự.', 'New password must be at least 6 characters.', '新密码至少需要 6 个字符。'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(pick('Mật khẩu xác nhận mới không khớp.', 'New confirm password does not match.', '两次输入的新密码不一致。'));
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(pick('Đổi mật khẩu tài khoản thành công!', 'Password updated successfully!', '账号密码修改成功！'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err?.message || pick('Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.', 'Failed to update password. Please verify your current password.', '无法修改密码，请检查当前密码是否正确。'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDirectLogout = async () => {
    setIsLoggingOut(true);
    onClose();
    await logout();
  };

  const deviceInfo = getDeviceTypeInfo(settings.deviceType, currentLang);

  const renderCurrentDeviceIcon = (sizeClass = 'w-4 h-4') => {
    switch (settings.deviceType) {
      case 'mobile':
        return <Smartphone className={`${sizeClass} text-emerald-400`} />;
      case 'tablet':
        return <Tablet className={`${sizeClass} text-emerald-400`} />;
      case 'desktop':
        return <Monitor className={`${sizeClass} text-emerald-400`} />;
      case 'tv':
        return <Tv className={`${sizeClass} text-emerald-400`} />;
      case 'laptop':
      default:
        return <Laptop className={`${sizeClass} text-emerald-400`} />;
    }
  };

  const renderDeviceIconByType = (type: string, sizeClass = 'w-4 h-4') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className={`${sizeClass} text-emerald-400`} />;
      case 'tablet':
        return <Tablet className={`${sizeClass} text-emerald-400`} />;
      case 'desktop':
        return <Monitor className={`${sizeClass} text-emerald-400`} />;
      case 'tv':
        return <Tv className={`${sizeClass} text-amber-400`} />;
      case 'laptop':
      default:
        return <Laptop className={`${sizeClass} text-emerald-400`} />;
    }
  };

  const handleLinkPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneLinkError(null);
    setPhoneLinkSuccess(null);
    setIsLinkingPhone(true);
    try {
      const saved = await linkPhoneNumber(phoneInput);
      setPhoneInput(saved);
      setPhoneLinkSuccess(pick('Đã liên kết SĐT {val} thành công!', 'Linked phone {val} successfully!', '已成功绑定手机号 {val}！').replace('{val}', saved));
      setTimeout(() => setPhoneLinkSuccess(null), 4000);
    } catch (err: any) {
      setPhoneLinkError(err?.message || pick('Không thể liên kết số điện thoại.', 'Unable to link phone number.', '无法绑定手机号。'));
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
      setLinkEmailSuccess(pick('Đã liên kết Email {val} thành công!', 'Linked Email {val} successfully!', '已成功绑定邮箱 {val}！').replace('{val}', linkEmailInput.trim().toLowerCase()));
      setTimeout(() => setLinkEmailSuccess(null), 4000);
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
        setLinkEmailSuccess(pick('Đã đồng bộ Google ({val}) thành công!', 'Synced Google ({val}) successfully!', '已成功同步 Google ({val})！').replace('{val}', res.email));
        setTimeout(() => setLinkEmailSuccess(null), 4000);
      }
    } catch (err: any) {
      setLinkEmailError(err?.message || pick('Không thể liên kết Google.', 'Unable to link Google account.', '无法绑定 Google 账号。'));
    } finally {
      setIsLinkingEmailDirect(false);
    }
  };

  const formatSessionTime = (isoString?: string) => {
    if (!isoString) return pick('Vừa xong', 'Just now', '刚刚');
    try {
      const d = new Date(isoString);
      return d.toLocaleString(getLocaleTag(currentLang), {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  if (forceMobileLayout || isSmallScreen) {
    return (
      <MobileSettingsView
        isOpen={isOpen}
        onClose={onClose}
        onOpenRules={onOpenRules}
        onOpenDevConsole={onOpenDevConsole}
        onOpenDevPage={onOpenDevPage}
      />
    );
  }

  const displayName = currentUser?.displayName || userProfile?.displayName || pick('Người dùng ClSend', 'ClSend User', 'ClSend 用户');
  const displayUsername = rawUsername || 'hducthien';
  const displayAvatar = customAvatarUrl || currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Main Settings Frame Modal */}
      <div 
        id="settings-modal-card"
        className="relative w-full max-w-5xl h-[86vh] min-h-[480px] md:min-h-[620px] max-h-[90vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row overflow-hidden z-10"
      >
        
        {/* NÚT THOÁT Ở TRÊN GÓC PHẢI */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span>{t('settings.close_btn')}</span>
          <X className="w-4 h-4" />
        </button>

        {/* CỘT BÊN TRÁI (SIDEBAR) */}
        <aside className="w-full md:w-72 bg-slate-950 p-5 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0 md:h-full">
          <div>
            {/* Góc trên trái: Ảnh đại diện + Tên hiển thị & Username đặt SÁT BÊN CẠNH avatar */}
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-sm shrink-0 bg-slate-800"
              />
              <div className="min-w-0 text-left">
                <h3 className="font-semibold text-sm text-white truncate leading-snug">
                  {displayName}
                </h3>
                <p className="text-xs text-slate-400 truncate leading-none mt-0.5 font-mono">
                  @{displayUsername}
                </p>
              </div>
            </div>

            {/* 3 nút chuyển tab ở bên dưới */}
            <nav className="mt-4 space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                  activeTab === 'account'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{t('settings.tab_account')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appearance')}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                  activeTab === 'appearance'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>{t('settings.tab_appearance')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                  activeTab === 'notifications'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>{t('settings.tab_security')}</span>
              </button>

              {canAccessDevTab && (
                <button
                  id="settings-tab-developer"
                  type="button"
                  onClick={() => setActiveTab('developer')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                    activeTab === 'developer'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-emerald-300/90 hover:bg-emerald-500/15 hover:text-emerald-200 border border-emerald-500/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Code2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{pick('Chế độ Nhà phát triển', 'Developer Mode', '开发者模式')}</span>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    activeTab === 'developer' ? 'bg-black/25 text-white' : 'bg-emerald-500/15 text-emerald-300'
                  }`}>
                    {isDev ? 'DEV' : 'LOCAL'}
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* Footer inside sidebar with Save button */}
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            {savedSuccess && (
              <span className="text-emerald-400 font-bold text-[11px] animate-in fade-in flex items-center gap-1 justify-center">
                <Check className="w-3.5 h-3.5" /> {t('settings.save_success_toast')}
              </span>
            )}
            <button
              id="save-settings-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
              <span>{t('settings.save_changes_btn')}</span>
            </button>
          </div>
        </aside>

        {/* NỘI DUNG TƯƠNG ỨNG CỦA 3 TAB PHÍA BÊN PHẢI */}
        <main className="flex-1 min-h-0 p-6 md:p-8 overflow-y-auto no-scrollbar space-y-5">
          
          {/* TAB 1: TÀI KHOẢN & THIẾT BỊ */}
          {activeTab === 'account' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>{pick('Cài đặt Tài khoản & Thiết bị', 'Account & Device Settings', '账号与设备设置')}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{pick('Quản lý tên thiết bị, mã ghép nối và tùy chọn truyền tệp.', 'Manage device name, pairing code and transfer preferences.', '管理设备名称、配对码与传输偏好设置。')}</p>
              </div>

              {/* Tên Thiết Bị */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">{t('settings.device_name_label')}</label>
                  <button
                    type="button"
                    onClick={handleRandomizeDeviceName}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>{pick('Tên ngẫu nhiên', 'Random name', '随机名称')}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDeviceName(val);
                    setEditDisplayName(val);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              {/* Phần cứng & Ghép nối */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    {renderCurrentDeviceIcon('w-4 h-4')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{deviceInfo.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{deviceInfo.description}</div>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">{pick('Mã Ghép Nối PIN', 'Pairing PIN Code', '配对 PIN 码')}</div>
                    <div className="text-xs font-mono font-black text-emerald-400 tracking-wider mt-0.5">#{pairingCode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPairingCode}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedPairingCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPairingCode ? pick('Đã chép', 'Copied', '已复制') : pick('Chép', 'Copy', '复制')}</span>
                  </button>
                </div>
              </div>

              {/* Tùy chọn hoạt động */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-white">{t('settings.auto_accept_title')}</div>
                    <div className="text-[10px] text-slate-400">{t('settings.auto_accept_desc')}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAccept}
                    onChange={(e) => setAutoAccept(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{t('settings.sound_title')}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{t('settings.sound_desc')}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => playReceiveSound()}
                      className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {pick('Thử chuông', 'Test sound', '试听')}
                    </button>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Bộ nhớ đệm PWA */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{pick('Bộ nhớ đệm PWA', 'PWA Cache Storage', 'PWA 缓存空间')} ({storageInfo ? `${storageInfo.usageMb} MB` : pick('Đang đo...', 'Calculating...', '正在检测...')})</div>
                    <div className="text-[10px] text-slate-400">{storageCleanSuccess || pick('Dọn dẹp tệp đệm tạm để giải phóng dung lượng máy', 'Clean temporary caches to free up device storage', '清理临时缓存以释放设备存储空间')}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCleanStorage}
                  disabled={isCleaningStorage}
                  className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{pick('Dọn dẹp', 'Clean', '清理')}</span>
                </button>
              </div>

              {/* Ngôn ngữ giao diện / Language */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">{t('settings.language')}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{t('settings.language_desc')}</span>
                </div>
                <div translate="no" className="notranslate grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentLang === lang.code
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span className="truncate">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: HỒ SƠ & GIAO DIỆN */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>{pick('Cài đặt Hồ sơ & Giao diện', 'Profile & Appearance Settings', '个人资料与外观设置')}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{pick('Tùy chỉnh ảnh đại diện, ảnh bìa và thẻ thông tin cá nhân.', 'Customize avatar, banner image, and personal profile card.', '自定义头像、横幅图片和个人资料卡。')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Cột trái: Form chỉnh sửa */}
                <div className="md:col-span-7 space-y-3.5">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-white">{pick('Tên hiển thị', 'Display Name', '显示名称')}</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={editDisplayName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditDisplayName(val);
                        setDeviceName(val);
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{pick('Ảnh Đại Diện (Avatar)', 'Avatar Image', '头像图片')}</span>
                      <div className="flex items-center gap-1.5">
                        <input type="file" ref={avatarFileInputRef} onChange={handleAvatarFileUpload} accept="image/*" className="hidden" />
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{pick('Tải ảnh', 'Upload image', '上传头像')}</span>
                        </button>
                        {customAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => { setCustomAvatarUrl(undefined); updateSettings({ customAvatarUrl: undefined }); }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-semibold"
                          >
                            {pick('Xóa', 'Remove', '移除')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400">{pick('Màu nhanh:', 'Quick colors:', '快捷颜色：')}</span>
                      {AVATAR_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setAvatarColor(col)}
                          className={`w-6 h-6 rounded-md transition-all ${avatarColor === col ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{pick('Ảnh Bìa Thẻ (Banner)', 'Profile Banner Image', '个人资料横幅')}</span>
                      <input type="file" ref={bannerFileInputRef} onChange={handleBannerFileUpload} accept="image/*" className="hidden" />
                      <button
                        type="button"
                        onClick={() => bannerFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>{pick('Tải ảnh bìa', 'Upload banner', '上传横幅')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">{pick('Huy hiệu', 'Badge', '徽章')}</label>
                      <input
                        type="text"
                        value={customBadgeText}
                        onChange={(e) => setCustomBadgeText(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">{pick('Tiểu sử', 'Bio', '个人简介')}</label>
                      <textarea
                        rows={2}
                        value={customBio}
                        onChange={(e) => setCustomBio(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Cột phải: Xem trước thẻ Profile Discord style */}
                <div className="md:col-span-5 flex flex-col">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 h-full">
                    <div className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
                      {pick('Xem Trước Thẻ Hồ Sơ', 'Profile Card Preview', '个人资料卡预览')}
                    </div>

                    <div className="my-auto py-2">
                      <div className="w-full bg-[#1e1f22] text-slate-100 rounded-2xl shadow-xl border border-slate-800 overflow-hidden relative">
                        <div 
                          className="h-24 w-full bg-cover bg-center relative"
                          style={{ background: customBannerUrl ? `url(${customBannerUrl}) center/cover no-repeat` : 'linear-gradient(to right, #059669, #0d9488)' }}
                        >
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-xs rounded-full text-[9.5px] text-amber-300 font-bold">
                            {customBadgeText || 'ClSend'}
                          </span>
                        </div>
                        <div className="px-3.5 pb-3.5 pt-8 relative bg-[#1e1f22]">
                          <div className="absolute -top-7 left-3.5">
                            {customAvatarUrl ? (
                              <img src={customAvatarUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover ring-3 ring-[#1e1f22] shadow-lg" />
                            ) : (
                              <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg ring-3 ring-[#1e1f22] shadow-lg" style={{ backgroundColor: avatarColor }}>
                                {(editDisplayName || 'U')[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white truncate">{editDisplayName || displayName}</h4>
                          <p className="text-[10.5px] text-slate-400 font-medium">@{displayUsername}</p>
                          <div className="my-2 h-px w-full bg-slate-800" />
                          <p className="text-[11px] text-slate-300 italic">"{customBio}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: THÔNG BÁO & BẢO MẬT */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span>{pick('Cài đặt Thông báo & Bảo mật tài khoản', 'Notifications & Account Security', '通知与账号安全设置')}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{pick('Quản lý mật khẩu, liên kết Email / Số điện thoại và phiên đăng nhập.', 'Manage password, linked Email / Phone number and login sessions.', '管理密码、绑定的邮箱/手机号及登录会话。')}</p>
              </div>

              {/* Liên kết Số điện thoại & Email đồng bộ bảo mật */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Số điện thoại */}
                <form onSubmit={handleLinkPhoneSubmit} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pick('Số điện thoại liên kết', 'Linked Phone Number', '绑定手机号')}</span>
                    </h3>
                    {currentLinkedPhone && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                        {pick('Đã lưu', 'Saved', '已绑定')}
                      </span>
                    )}
                  </div>
                  {phoneLinkError && <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">{phoneLinkError}</div>}
                  {phoneLinkSuccess && <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">{phoneLinkSuccess}</div>}
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="09xx xxx xxx / +84..."
                      className="flex-1 min-w-0 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isLinkingPhone}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isLinkingPhone ? '...' : pick('Lưu SĐT', 'Save', '保存')}
                    </button>
                  </div>
                </form>

                {/* Email / Google */}
                <form onSubmit={handleLinkEmailSubmit} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400" />
                      <span>{pick('Email / Gmail liên kết', 'Linked Email / Gmail', '绑定邮箱 / Gmail')}</span>
                    </h3>
                    {isLinkedEmail && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                        {pick('Đã liên kết', 'Linked', '已绑定')}
                      </span>
                    )}
                  </div>
                  {linkEmailError && <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">{linkEmailError}</div>}
                  {linkEmailSuccess && <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">{linkEmailSuccess}</div>}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={linkEmailInput}
                      onChange={(e) => setLinkEmailInput(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="flex-1 min-w-0 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isLinkingEmailDirect}
                      className="px-3 py-1.5 rounded-lg bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/30 text-sky-300 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isLinkingEmailDirect ? '...' : pick('Lưu Email', 'Save', '保存')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleLinkGoogleSubmit}
                    disabled={isLinkingEmailDirect}
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    {pick('Đồng bộ trực tiếp với tài khoản Google', 'Sync directly with Google account', '直接同步 Google 账号')}
                  </button>
                </form>
              </div>

              {/* Đổi mật khẩu */}
              {!isGoogleUser && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-white">{pick('Đổi Mật Khẩu', 'Change Password', '修改密码')}</h3>
                  {passwordError && <div className="p-2 rounded bg-rose-500/10 text-rose-300 text-xs">{passwordError}</div>}
                  {passwordSuccess && <div className="p-2 rounded bg-emerald-500/10 text-emerald-300 text-xs">{passwordSuccess}</div>}
                  
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={pick('Mật khẩu cũ', 'Current password', '当前密码')} className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={pick('Mật khẩu mới', 'New password', '新密码')} className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                      <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder={pick('Nhập lại mới', 'Confirm new', '确认新密码')} className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button type="submit" disabled={isUpdatingPassword} className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                        {pick('Đổi mật khẩu', 'Update password', '更新密码')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Phiên đăng nhập */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">{pick('Thiết bị đang đăng nhập ({n})', 'Signed-in Devices ({n})', '已登录设备 ({n})').replace('{n}', String(sessions.length))}</h3>
                  <button type="button" onClick={fetchSessions} className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {sessions.map((sess) => (
                    <div key={sess.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderDeviceIconByType(sess.deviceType || 'laptop', 'w-4 h-4')}
                        <div>
                          <div className="text-xs font-bold text-white">{sess.deviceName}</div>
                          <div className="text-[10px] text-slate-400">{sess.location || pick('Việt Nam', 'Unknown Location', '未知位置')} • {formatSessionTime(sess.loginAt)}</div>
                        </div>
                      </div>
                      {sess.isCurrent ? (
                        <span className="text-[10px] text-emerald-400 font-bold">{pick('Máy này', 'This device', '本机')}</span>
                      ) : (
                        <button type="button" onClick={() => handleLogoutSession(sess.id)} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px]">
                          {t('nav.logout')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Đăng xuất */}
              <div className="bg-slate-950/60 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">{pick('Đăng xuất tài khoản', 'Log Out Account', '退出账号登录')}</div>
                  <div className="text-[10px] text-slate-400">{pick('Kết thúc phiên làm việc hiện tại trên thiết bị này', 'End the current session on this device', '结束此设备上的当前登录会话')}</div>
                </div>
                <button type="button" onClick={handleDirectLogout} className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 4 (ẨN): CHẾ ĐỘ NHÀ PHÁT TRIỂN CỤC BỘ */}
          {activeTab === 'developer' && canAccessDevTab && (
            <DeveloperModePanel
              isDev={isDev}
              onAfterLock={() => setActiveTab('account')}
            />
          )}

        </main>

      </div>
    </div>
  );
};
