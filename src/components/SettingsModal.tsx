import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, getClientDeviceId } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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
  Bell
} from 'lucide-react';
import { LoginSession } from './types';
import { AVATAR_COLORS, getDeviceTypeInfo, generateDefaultDeviceName } from '../utils/device';
import { playReceiveSound } from '../utils/sound';
import { triggerIncomingChatMessageNotification } from '../utils/tabNotification';
import { getPwaStorageEstimate, cleanAllPwaCachesAndBloat, StorageEstimateInfo } from '../utils/pwaStorageCleaner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRules?: () => void;
  onOpenDevConsole?: () => void;
  onOpenDevPage?: () => void;
  showDataChannelAvatars?: boolean;
}

type SettingsTab = 'account' | 'appearance' | 'notifications';

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onOpenRules, 
  onOpenDevConsole,
  onOpenDevPage,
}) => {
  const { 
    currentUser, 
    userProfile, 
    settings, 
    updateSettings, 
    logout,
    changePassword,
    updateDisplayName,
    sendEmailVerificationCode,
    verifyEmailCodeAndLink,
    getLoginSessions,
    logoutSession,
    logoutAllDevices,
  } = useAuth();
  const { t, currentLang } = useLanguage();
  
  // Tab Management
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Device & Preference Form States
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [autoAccept, setAutoAccept] = useState(settings.autoAccept);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  
  // Profile & Appearance Form States
  const [avatarColor, setAvatarColor] = useState(settings.avatarColor);
  const [customBadgeText, setCustomBadgeText] = useState<string>(settings.customBadgeText || 'Thành viên ClSend');
  const [customBio, setCustomBio] = useState<string>(settings.customBio || 'Sẵn sàng truyền nhận dữ liệu tốc độ cao.');
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
      setCustomBadgeText(settings.customBadgeText || 'Thành viên ClSend');
      setCustomBio(settings.customBio || 'Sẵn sàng truyền nhận dữ liệu tốc độ cao.');
      setCustomAvatarUrl(settings.customAvatarUrl);
      setCustomBannerUrl(settings.bannerUrl);
      setEditDisplayName(currentUser?.displayName || userProfile?.displayName || '');
      setLinkEmailInput(isLinkedEmail ? (currentUser?.email || userProfile?.linkedEmail || '') : '');
      getPwaStorageEstimate().then(setStorageInfo).catch(() => {});
    }
  }, [isOpen, settings, currentUser, userProfile, isLinkedEmail]);

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
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP...)');
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
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP...)');
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
      setStorageCleanSuccess(`Đã giải phóng ${freedMb > 0 ? freedMb + ' MB' : 'toàn bộ'} bộ nhớ đệm.`);
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
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Mật khẩu xác nhận mới không khớp.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Đổi mật khẩu tài khoản thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.');
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

  const formatSessionTime = (isoString?: string) => {
    if (!isoString) return currentLang === 'en' ? 'Just now' : 'Vừa xong';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(currentLang === 'en' ? 'en-US' : 'vi-VN', {
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

  const displayName = currentUser?.displayName || userProfile?.displayName || 'Đức Thiện';
  const displayUsername = rawUsername || 'hducthien';
  const displayAvatar = customAvatarUrl || currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Main Settings Frame Modal: Taller vertically (h-[86vh], min-h-[640px]) with fixed height so it doesn't jump when switching tabs */}
      <div 
        id="settings-modal-card"
        className="relative w-full max-w-5xl h-[86vh] min-h-[640px] max-h-[86vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 flex flex-col md:flex-row overflow-hidden z-10"
      >
        
        {/* NÚT THOÁT Ở TRÊN GÓC PHẢI */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span>Thoát</span>
          <X className="w-4 h-4" />
        </button>

        {/* CỘT BÊN TRÁI (SIDEBAR) */}
        <aside className="w-full md:w-72 bg-slate-950 p-5 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0 h-full">
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
                <span>Tài khoản & Thiết bị</span>
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
                <span>Hồ sơ & Giao diện</span>
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
                <span>Thông báo & Bảo mật</span>
              </button>
            </nav>
          </div>

          {/* Footer inside sidebar with Save button */}
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            {savedSuccess && (
              <span className="text-emerald-400 font-bold text-[11px] animate-in fade-in flex items-center gap-1 justify-center">
                <Check className="w-3.5 h-3.5" /> Đã lưu thành công
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
              <span>Lưu cài đặt</span>
            </button>
          </div>
        </aside>

        {/* NỘI DUNG TƯƠNG ỨNG CỦA 3 TAB PHÍA BÊN PHẢI (Fixed height container with internal scroll) */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar space-y-5 h-full">
          
          {/* TAB 1: TÀI KHOẢN & THIẾT BỊ */}
          {activeTab === 'account' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>Cài đặt Tài khoản & Thiết bị</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Quản lý tên thiết bị, mã ghép nối và tùy chọn truyền tệp.</p>
              </div>

              {/* Tên Thiết Bị */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">Tên thiết bị trong mạng</label>
                  <button
                    type="button"
                    onClick={handleRandomizeDeviceName}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Tên ngẫu nhiên</span>
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
                    <div className="text-[10px] text-slate-400 font-medium">Mã Ghép Nối PIN</div>
                    <div className="text-xs font-mono font-black text-emerald-400 tracking-wider mt-0.5">#{pairingCode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPairingCode}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedPairingCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Chép</span>
                  </button>
                </div>
              </div>

              {/* Tùy chọn hoạt động */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-white">Tự động chấp nhận nhận tệp</div>
                    <div className="text-[10px] text-slate-400">Lưu trực tiếp tệp gửi tới mà không cần bấm thủ công</div>
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
                      <span>Âm thanh thông báo</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Phát âm chuông khi có tin nhắn hoặc tệp đến</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => playReceiveSound()}
                      className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      Thử chuông
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
                    <div className="text-xs font-bold text-white">Bộ nhớ đệm PWA ({storageInfo ? `${storageInfo.usageMb} MB` : 'Đang đo...'})</div>
                    <div className="text-[10px] text-slate-400">Dọn dẹp tệp đệm tạm để giải phóng dung lượng máy</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCleanStorage}
                  disabled={isCleaningStorage}
                  className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dọn dẹp</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: HỒ SƠ & GIAO DIỆN */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>Cài đặt Hồ sơ & Giao diện</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Tùy chỉnh ảnh đại diện, ảnh bìa và thẻ thông tin cá nhân.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Cột trái: Form chỉnh sửa */}
                <div className="md:col-span-7 space-y-3.5">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-white">Tên hiển thị</label>
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
                      <span className="text-xs font-bold text-white">Ảnh Đại Diện (Avatar)</span>
                      <div className="flex items-center gap-1.5">
                        <input type="file" ref={avatarFileInputRef} onChange={handleAvatarFileUpload} accept="image/*" className="hidden" />
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Tải ảnh</span>
                        </button>
                        {customAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => { setCustomAvatarUrl(undefined); updateSettings({ customAvatarUrl: undefined }); }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-semibold"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400">Màu nhanh:</span>
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
                      <span className="text-xs font-bold text-white">Ảnh Bìa Thẻ (Banner)</span>
                      <input type="file" ref={bannerFileInputRef} onChange={handleBannerFileUpload} accept="image/*" className="hidden" />
                      <button
                        type="button"
                        onClick={() => bannerFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Tải ảnh bìa</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Huy hiệu</label>
                      <input
                        type="text"
                        value={customBadgeText}
                        onChange={(e) => setCustomBadgeText(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Tiểu sử</label>
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
                      Xem Trước Thẻ Hồ Sơ
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
                  <span>Cài đặt Thông báo & Bảo mật tài khoản</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Quản lý mật khẩu, xác thực Gmail OTP và phiên đăng nhập.</p>
              </div>

              {/* Đổi mật khẩu */}
              {!isGoogleUser && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-white">Đổi Mật Khẩu</h3>
                  {passwordError && <div className="p-2 rounded bg-rose-500/10 text-rose-300 text-xs">{passwordError}</div>}
                  {passwordSuccess && <div className="p-2 rounded bg-emerald-500/10 text-emerald-300 text-xs">{passwordSuccess}</div>}
                  
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Mật khẩu cũ" className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                      <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Nhập lại mới" className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button type="submit" disabled={isUpdatingPassword} className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                        Đổi mật khẩu
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Phiên đăng nhập */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">Thiết bị đang đăng nhập ({sessions.length})</h3>
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
                          <div className="text-[10px] text-slate-400">{sess.location || 'Việt Nam'} • {formatSessionTime(sess.loginAt)}</div>
                        </div>
                      </div>
                      {sess.isCurrent ? (
                        <span className="text-[10px] text-emerald-400 font-bold">Máy này</span>
                      ) : (
                        <button type="button" onClick={() => handleLogoutSession(sess.id)} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px]">
                          Đăng xuất
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Đăng xuất */}
              <div className="bg-slate-950/60 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">Đăng xuất tài khoản</div>
                  <div className="text-[10px] text-slate-400">Kết thúc phiên làm việc hiện tại trên thiết bị này</div>
                </div>
                <button type="button" onClick={handleDirectLogout} className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

            </div>
          )}

        </main>

      </div>
    </div>
  );
};
