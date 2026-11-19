import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, pickLang } from '../../context/LanguageContext';
import { CloudSendLogo } from '../CloudSendLogo';
import { SilkFabricBackground } from '../SilkFabricBackground';
import { SmoothTypewriter } from '../SmoothTypewriter';
import { CompactWheelDatePicker } from '../CompactWheelDatePicker';
import { 
  Sparkles, 
  Lock, 
  User, 
  AlertCircle, 
  LogIn, 
  UserPlus, 
  Info, 
  Loader2, 
  Calendar, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  Check,
  Monitor,
  ExternalLink,
  QrCode,
  KeyRound,
  RefreshCw,
  Copy,
  Smartphone
} from 'lucide-react';
import { createDesktopSyncSession, formatSyncCode, AuthSyncPayload } from '../../utils/authSync';

type ActiveTab = 'sync' | 'account';
type AccountSubMode = 'login' | 'register';
type GenderOption = 'Nam' | 'Nữ' | 'Không Muốn Trả Lời';

interface AuthModalProps {
  onBackToLanding?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onBackToLanding }) => {
  const { 
    loginWithGoogle,
    loginWithFacebook,
    loginWithGithub,
    pendingCredentialLink,
    confirmPendingCredentialLink,
    clearPendingCredentialLink,
    loginWithAccount, 
    registerWithAccount, 
    loginAsGuest, 
    loginWithSyncPayload,
    settings 
  } = useAuth();
  const { currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);

  const isDesktopApp = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);

  // Default to 'sync' tab on Desktop app (since users often have web open), or 'account' on Web
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (isDesktopApp ? 'sync' : 'account'));
  const [accountSubMode, setAccountSubMode] = useState<AccountSubMode>('login');

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [deviceName] = useState(settings.deviceName || '');

  // UI helpers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeSocialLoading, setActiveSocialLoading] = useState<'google' | 'facebook' | 'github' | null>(null);
  const [showBrowserSyncBtn, setShowBrowserSyncBtn] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync session states (Web to Desktop)
  const [syncCode, setSyncCode] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const syncCleanupRef = useRef<(() => void) | null>(null);

  // Date Picker Wheel Modal
  const [showWheelDatePicker, setShowWheelDatePicker] = useState(false);

  const resetFormErrors = () => {
    setErrorMsg(null);
    setInfoNotice(null);
    setShowBrowserSyncBtn(false);
    setShowWheelDatePicker(false);
    clearPendingCredentialLink();
  };

  const handleConfirmCredentialLink = async (existingProvider: 'google' | 'facebook' | 'github') => {
    setErrorMsg(null);
    setInfoNotice(null);
    setIsLoading(true);
    setActiveSocialLoading(existingProvider);
    try {
      await confirmPendingCredentialLink(existingProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setInfoNotice(
          pick(
            'Bạn đã đóng cửa sổ xác nhận liên kết. Hãy bấm lại nút bên dưới để gộp tài khoản.',
            'You closed the link confirmation window. Click below again to link your accounts.',
            '您关闭了账号关联窗口，请再次点击下方按钮完成关联。'
          )
        );
      } else {
        setErrorMsg(
          err?.message ||
            pick(
              'Không thể liên kết tài khoản lúc này. Vui lòng thử lại.',
              'Unable to link accounts right now. Please try again.',
              '暂时无法关联账号，请重试。'
            )
        );
      }
    } finally {
      setIsLoading(false);
      setActiveSocialLoading(null);
    }
  };

  // Start or restart a Desktop Auth Sync session
  const initSyncSession = async () => {
    if (syncCleanupRef.current) {
      syncCleanupRef.current();
      syncCleanupRef.current = null;
    }

    setIsSyncLoading(true);
    setSyncSuccess(false);

    try {
      const session = await createDesktopSyncSession(
        settings.deviceName || pick('Ứng dụng ClSend Desktop', 'ClSend Desktop App', 'ClSend 桌面应用'),
        async (payload: AuthSyncPayload) => {
          setSyncSuccess(true);
          setInfoNotice(
            pick(
              'Đã nhận phiên đăng nhập từ {name}! Đang đồng bộ...',
              'Received login session from {name}! Syncing...',
              '已收到来自 {name} 的登录会话！正在同步...'
            ).replace('{name}', payload.authorizedDeviceName || 'Web')
          );
          try {
            await loginWithSyncPayload(payload);
          } catch (err: any) {
            console.warn('Sync login apply notice:', err);
          }
        },
        (err) => {
          console.warn('Sync session error:', err);
        }
      );

      setSyncCode(session.code);
      setQrDataUrl(session.qrDataUrl);
      syncCleanupRef.current = session.cancel;
    } catch (err: any) {
      console.warn('Failed to start sync session:', err);
    } finally {
      setIsSyncLoading(false);
    }
  };

  // Generate sync code when on 'sync' tab
  useEffect(() => {
    if (activeTab === 'sync') {
      initSyncSession();
    } else {
      if (syncCleanupRef.current) {
        syncCleanupRef.current();
        syncCleanupRef.current = null;
      }
    }

    return () => {
      if (syncCleanupRef.current) {
        syncCleanupRef.current();
        syncCleanupRef.current = null;
      }
    };
  }, [activeTab]);

  const handleCopySyncCode = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormErrors();

    if (!username.trim()) {
      setErrorMsg(pick('Vui lòng nhập tên tài khoản.', 'Please enter your username.', '请输入用户名。'));
      return;
    }

    if (!password) {
      setErrorMsg(pick('Vui lòng nhập mật khẩu tài khoản.', 'Please enter your account password.', '请输入账号密码。'));
      return;
    }

    setIsLoading(true);
    try {
      await loginWithAccount(username.trim(), password);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg(pick('Tên tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.', 'Incorrect username or password. Please check again.', '用户名或密码不正确，请检查后重试。'));
      } else {
        setErrorMsg(err?.message || pick('Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.', 'An error occurred while signing in. Please try again.', '登录时发生错误，请重试。'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormErrors();

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg(pick('Vui lòng nhập tên tài khoản.', 'Please enter your username.', '请输入用户名。'));
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg(pick('Tên tài khoản phải có ít nhất 3 ký tự.', 'Username must be at least 3 characters.', '用户名至少需要 3 个字符。'));
      return;
    }

    if (!password) {
      setErrorMsg(pick('Vui lòng nhập mật khẩu tài khoản.', 'Please enter your account password.', '请输入账号密码。'));
      return;
    }

    if (password.length < 6) {
      setErrorMsg(pick('Mật khẩu tài khoản phải có tối thiểu 6 ký tự.', 'Password must be at least 6 characters.', '账号密码至少需要 6 个字符。'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(pick('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.', 'Confirm password does not match. Please check again.', '两次输入的密码不一致，请检查。'));
      return;
    }

    setIsLoading(true);
    try {
      await registerWithAccount({
        username: cleanUsername,
        pass: password,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        dob: dob ? dob.trim() : undefined,
        gender: gender || 'Không Muốn Trả Lời',
        deviceName: deviceName ? deviceName.trim() : undefined
      });
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg(pick('Tên tài khoản này đã có người đăng ký. Vui lòng chọn tên khác hoặc chuyển sang Đăng nhập.', 'This username is already taken. Please choose another name or switch to Sign In.', '该用户名已被注册，请选择其他名称或切换到登录。'));
      } else {
        setErrorMsg(err?.message || pick('Đã xảy ra lỗi khi tạo tài khoản. Vui lòng thử lại.', 'An error occurred while creating your account. Please try again.', '创建账号时发生错误，请重试。'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    resetFormErrors();
    setIsLoading(true);
    try {
      await loginAsGuest(username.trim() || deviceName.trim() || undefined, deviceName.trim() || undefined);
    } catch (err: any) {
      setErrorMsg(
        pick('Không thể tạo phiên sử dụng nhanh: {err}', 'Could not create quick session: {err}', '无法创建快速会话：{err}').replace(
          '{err}',
          err?.message || pick('Vui lòng thử lại', 'Please try again', '请重试')
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesktopBrowserSync = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.isElectron) {
      setIsGoogleLoading(true);
      try {
        const port = await (window as any).electronAPI.getDesktopPort();
        if (port) {
          (window as any).electronAPI.openGoogleLogin(port);
          setInfoNotice(pick(
            'Đã mở trình duyệt hệ thống. Hãy đăng nhập Google trên tab vừa mở, ứng dụng ClSend máy tính sẽ tự động nhận diện và cập nhật tài khoản.',
            'System browser opened. Please sign in with Google in the newly opened tab; ClSend Desktop will automatically detect and update your account.',
            '已打开系统浏览器。请在新打开的标签页中登录 Google，ClSend 桌面端将自动识别并同步账号。'
          ));
        } else {
          setErrorMsg(pick(
            'Không tìm thấy cổng cục bộ của ứng dụng desktop. Bạn có thể đăng nhập tức thì bằng Tên tài khoản & Mật khẩu bên dưới.',
            'Desktop local port not found. You can sign in immediately using Username & Password below.',
            '未找到桌面应用本地端口。您可以直接在下方使用用户名和密码登录。'
          ));
        }
      } catch (err: any) {
        setErrorMsg(
          pick('Không thể mở liên kết trình duyệt: {err}', 'Could not open browser link: {err}', '无法打开浏览器链接：{err}').replace(
            '{err}',
            err?.message || pick('Vui lòng thử lại', 'Please try again', '请重试')
          )
        );
      } finally {
        setIsGoogleLoading(false);
      }
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'github') => {
    resetFormErrors();
    setIsLoading(true);
    setIsGoogleLoading(provider === 'google');
    setActiveSocialLoading(provider);

    const providerLabel = provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'GitHub';
    let timerId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('POPUP_TIMEOUT'));
      }, 30000);
    });

    try {
      const action =
        provider === 'google'
          ? loginWithGoogle()
          : provider === 'facebook'
          ? loginWithFacebook()
          : loginWithGithub();
      await Promise.race([action, timeoutPromise]);
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setInfoNotice(pick(
          `Bạn đã đóng cửa sổ đăng nhập ${providerLabel}. Bạn có thể nhấn lại hoặc chọn phương thức khác.`,
          `You closed the ${providerLabel} sign-in window. You can try again or choose another method.`,
          `您已关闭 ${providerLabel} 登录窗口。可以重试或选择其他登录方式。`
        ));
      } else if (code === 'auth/account-exists-with-different-credential') {
        const conflictMail = err?.customData?.email ? ` (${err.customData.email})` : '';
        setErrorMsg(pick(
          `Email${conflictMail} của tài khoản ${providerLabel} này trùng với tài khoản Google/tài khoản khác đã đăng ký trước đó trên hệ thống. Bấm nút bên dưới để xác nhận bằng Google và gộp 2 phương thức vào chung 1 tài khoản ClSend!`,
          `The email${conflictMail} on this ${providerLabel} account is already used by another sign-in method (such as Google). Click below to sign in with your existing method and link ${providerLabel} automatically.`,
          `该 ${providerLabel} 账号的邮箱${conflictMail}已通过其他方式（如 Google）注册。点击下方按钮登录原账号即可自动关联 ${providerLabel}。`
        ));
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg(pick(
          `Phương thức ${providerLabel} chưa được kích hoạt trong Firebase Console (Authentication → Sign-in method). Quản trị viên cần bật nhà cung cấp này trước khi sử dụng.`,
          `${providerLabel} sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Please enable this provider first.`,
          `Firebase 控制台中尚未启用 ${providerLabel} 登录（Authentication → Sign-in method），请先开启该登录方式。`
        ));
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(pick(
          `Tên miền hiện tại chưa được cấp phép trong Firebase Console → Authentication → Settings → Authorized domains.`,
          `This domain is not authorized yet in Firebase Console → Authentication → Settings → Authorized domains.`,
          `当前域名尚未添加到 Firebase Console → Authentication → Settings → Authorized domains。`
        ));
      } else if (code === 'auth/popup-blocked') {
        if (isDesktopApp && provider === 'google') {
          setShowBrowserSyncBtn(true);
        }
        setErrorMsg(pick(
          'Trình duyệt đã chặn cửa sổ popup đăng nhập. Vui lòng cho phép popup hoặc đăng nhập bằng Tên tài khoản / SĐT.',
          'Browser blocked the sign-in popup. Please allow popups or sign in using Username / Phone.',
          '浏览器拦截了登录弹窗。请允许弹窗或使用用户名/手机号登录。'
        ));
      } else if (code === 'auth/disallowed-useragent' || msg.includes('disallowed_useragent')) {
        if (isDesktopApp && provider === 'google') {
          setShowBrowserSyncBtn(true);
        }
        setInfoNotice(pick(
          `Chính sách ${providerLabel} yêu cầu xác thực qua trình duyệt hệ thống. Bạn có thể đăng nhập bằng Tên tài khoản & Mật khẩu hoặc SĐT OTP.`,
          `${providerLabel} requires a standard system browser. You can sign in using Username & Password or Phone OTP.`,
          `${providerLabel} 需要标准浏览器环境。您可以改用用户名密码或手机号验证码登录。`
        ));
      } else if (msg === 'POPUP_TIMEOUT') {
        if (isDesktopApp && provider === 'google') setShowBrowserSyncBtn(true);
        setInfoNotice(pick(
          `Cửa sổ đăng nhập ${providerLabel} đang phản hồi chậm. Bạn có thể thử lại hoặc dùng SĐT / Tài khoản.`,
          `${providerLabel} sign-in window is responding slowly. Try again or use Phone / Username.`,
          `${providerLabel} 登录窗口响应较慢。请重试或改用手机号/账号登录。`
        ));
      } else {
        if (isDesktopApp && provider === 'google') setShowBrowserSyncBtn(true);
        setErrorMsg(
          pick(`Đăng nhập ${providerLabel}: {err}`, `${providerLabel} Sign In: {err}`, `${providerLabel} 登录：{err}`).replace(
            '{err}',
            err?.message || pick('Vui lòng thử lại hoặc chọn phương thức khác', 'Please try again or choose another method', '请重试或选择其他方式')
          )
        );
      }
    } finally {
      if (timerId) clearTimeout(timerId);
      setIsLoading(false);
      setIsGoogleLoading(false);
      setActiveSocialLoading(null);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center px-3 py-4 sm:p-6 bg-slate-950 text-slate-100 relative z-0 overflow-x-hidden overflow-y-auto font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Living Silk Wave Ribbons & Floating Luminescent Starlight Background */}
      <SilkFabricBackground className="fixed inset-0 pointer-events-none -z-10" intensity="normal" showParticles={true} showGrid={true} />

      {/* Decorative top soft glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Main Container */}
      <div className="w-full max-w-md my-auto relative z-10 py-2 sm:py-4 shrink-0 transition-all duration-300">
        
        {/* Back to Landing Page Button */}
        {onBackToLanding && (
          <div className="w-full flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>{pick('Quay lại trang giới thiệu', 'Back to landing page', '返回介绍页面')}</span>
            </button>
            <span className="text-[11px] text-slate-500 font-medium">{pick('Chưa đăng nhập', 'Not signed in', '未登录')}</span>
          </div>
        )}

        {/* Header with App Logo & Title */}
        <div className="text-center mb-5 flex flex-col items-center">
          <div className="relative group mb-2.5">
            <div className="absolute -inset-2.5 bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-emerald-600/30 rounded-3xl blur-lg opacity-70 group-hover:opacity-100 transition duration-500" />
            <div className="relative inline-flex items-center justify-center shadow-2xl rounded-2xl bg-slate-900 border border-emerald-500/40 p-1.5 transform group-hover:scale-105 transition-transform duration-300">
              <CloudSendLogo className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl" size={72} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>CloudSend Relay</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              v2.5
            </span>
          </h1>
          
          {/* Smooth Typewriter tagline */}
          <div className="mt-1.5 min-h-[22px] flex items-center justify-center">
            <SmoothTypewriter
              texts={[
                pick("Đồng bộ ghi chú, tệp tin và kho Cloud 24/7", "Sync notes, files, and Cloud Drive 24/7", "全天候同步笔记、文件与云端网盘"),
                pick("Truyền dữ liệu tốc độ cao tới 250MB qua Relay", "High-speed data transfer up to 250MB via Relay", "通过中继实现高达 250MB 的高速数据传输"),
                pick("Bảo mật đa nền tảng cho Điện thoại & Máy tính", "Cross-platform security for Mobile & Desktop", "支持手机与电脑的多平台安全传输"),
                pick("Đăng nhập độc lập không cần rời khỏi ứng dụng", "Standalone sign-in without leaving the app", "独立登录，无需离开应用")
              ]}
              typingSpeed={40}
              deletingSpeed={20}
              pauseDuration={2600}
              className="text-slate-300 text-xs sm:text-sm text-center leading-relaxed font-normal"
              cursorClassName="text-emerald-400"
            />
          </div>

          {/* Desktop App Recognition Badge */}
          {isDesktopApp && (
            <div className="mt-2.5 flex items-center justify-center animate-in fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold shadow-inner">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>{pick('Ứng dụng ClSend Desktop (Hoạt động độc lập)', 'ClSend Desktop App (Standalone)', 'ClSend 桌面应用（独立运行）')}</span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MAIN CARD WITH 2 FUNCTIONAL TABS */}
        {/* ============================================================ */}
        <div className="w-full bg-slate-900/95 border border-slate-800/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          
          {/* Top 2-Tab Bar: [ Đồng bộ Web / QR ] [ Tài khoản ] */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            {/* TAB 1: Đồng bộ Web / QR */}
            <button
              id="tab-btn-sync"
              type="button"
              onClick={() => {
                resetFormErrors();
                setActiveTab('sync');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{pick('Đồng bộ Web', 'Web Sync', '网页同步')}</span>
            </button>

            {/* TAB 2: Tài khoản & Mật khẩu */}
            <button
              id="tab-btn-account"
              type="button"
              onClick={() => {
                resetFormErrors();
                setActiveTab('account');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{pick('Tài khoản', 'Account', '账号密码')}</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1 leading-relaxed">{errorMsg}</div>
              </div>
              {pendingCredentialLink && (
                <div className="pl-6 flex flex-wrap gap-2">
                  {pendingCredentialLink.providerLabel !== 'Google' && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleConfirmCredentialLink('google')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-[11px] font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {activeSocialLoading === 'google' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>
                        {pick(
                          `Đăng nhập Google & Gộp ${pendingCredentialLink.providerLabel}`,
                          `Sign in Google & Link ${pendingCredentialLink.providerLabel}`,
                          `登录 Google 并关联 ${pendingCredentialLink.providerLabel}`
                        )}
                      </span>
                    </button>
                  )}
                  {pendingCredentialLink.providerLabel !== 'GitHub' && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleConfirmCredentialLink('github')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {activeSocialLoading === 'github' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogIn className="w-3.5 h-3.5 text-slate-300" />
                      )}
                      <span>
                        {pick(
                          `Gộp qua GitHub`,
                          `Link via GitHub`,
                          `通过 GitHub 关联`
                        )}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Friendly Info Alert */}
          {infoNotice && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
              <div className="flex-1 leading-relaxed">{infoNotice}</div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 1: ĐỒNG BỘ TỨC THÌ TỪ WEB SANG DESKTOP (MÃ 6 SỐ & QR CODE) */}
          {/* ============================================================ */}
          {activeTab === 'sync' && (
            <div className="space-y-4 animate-tab-switch">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>{pick('Đồng bộ tài khoản từ Web / Điện thoại', 'Sync account from Web / Mobile', '从网页 / 手机同步账号')}</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  {pick(
                    'Nếu bạn đã đăng nhập trên Web, bạn có thể đồng bộ sang ứng dụng máy tính ngay lập tức mà không cần gõ lại mật khẩu!',
                    'If you are already signed in on Web, you can sync to the Desktop app instantly without re-entering your password!',
                    '如果您已在网页端登录，无需重新输入密码即可立即同步至桌面应用！'
                  )}
                </p>
              </div>

              {/* Instructions steps */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <span>{pick('Mở trang web ClSend nơi bạn đã đăng nhập.', 'Open the ClSend website where you are already signed in.', '打开您已登录的 ClSend 网页端。')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <span>{pick('Bấm nút [ Đồng bộ Desktop ] ở góc trên thanh công cụ.', 'Click the [ Desktop Sync ] button on the top toolbar.', '点击顶部工具栏中的 [ 桌面同步 ] 按钮。')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                  <span>{pick('Nhập mã 6 chữ số bên dưới để cấp quyền tức thì:', 'Enter the 6-digit code below to authorize instantly:', '输入下方 6 位数字代码以立即授权：')}</span>
                </div>
              </div>

              {/* The 6-Digit Sync Code Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-emerald-500/40 text-center relative group shadow-inner">
                <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold mb-1">
                  {pick('Mã kết nối máy tính của bạn', 'Your desktop connection code', '您的桌面连接代码')}
                </div>

                {isSyncLoading ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{pick('Đang tạo mã kết nối...', 'Generating connection code...', '正在生成连接代码...')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-white selection:bg-emerald-500">
                      {formatSyncCode(syncCode) || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySyncCode}
                      title={pick('Sao chép mã 6 số', 'Copy 6-digit code', '复制 6 位代码')}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={initSyncSession}
                      title={pick('Tạo mã mới', 'Generate new code', '生成新代码')}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Pulsating Radar Status */}
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>{pick('Đang chờ bạn xác nhận từ Web hoặc Điện thoại...', 'Waiting for confirmation from Web or Mobile...', '正在等待您在网页或手机端确认...')}</span>
                </div>
              </div>

              {/* Collapsible QR Code for Phone Camera */}
              {qrDataUrl && (
                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="p-2.5 rounded-2xl bg-white shadow-xl border border-emerald-500/30">
                    <img 
                      src={qrDataUrl} 
                      alt={pick('QR Code đăng nhập nhanh', 'Quick Sign-In QR Code', '快速登录二维码')} 
                      className="w-36 h-36 rounded-lg object-contain"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">
                    {pick('Hoặc dùng camera điện thoại quét mã QR để mở trang xác nhận', 'Or scan this QR code with your phone camera to open the confirmation page', '或使用手机相机扫描二维码打开确认页面')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: TÀI KHOẢN & MẬT KHẨU (ĐĂNG NHẬP / ĐĂNG KÝ TRỰC TIẾP NHƯ ZALO) */}
          {/* ============================================================ */}
          {activeTab === 'account' && (
            <div className="space-y-4 animate-tab-switch">
              
              {/* Switcher: Đăng Nhập vs Đăng Ký */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{accountSubMode === 'login' ? pick('Đăng Nhập Tài Khoản', 'Sign In to Account', '登录账号') : pick('Tạo Tài Khoản Mới', 'Create New Account', '创建新账号')}</span>
                </div>
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormErrors();
                      setAccountSubMode('login');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      accountSubMode === 'login'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pick('Đăng Nhập', 'Sign In', '登录')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetFormErrors();
                      setAccountSubMode('register');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      accountSubMode === 'register'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pick('Đăng Ký', 'Sign Up', '注册')}
                  </button>
                </div>
              </div>

              {/* Form Đăng Nhập */}
              {accountSubMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      {pick('Tên tài khoản, Email hoặc SĐT', 'Username, Email or Phone', '用户名、邮箱或手机号')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-login-username"
                        type="text"
                        required
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={pick('Nhập tên tài khoản, email hoặc SĐT', 'Enter username, email or phone', '输入用户名、邮箱或手机号')}
                        className="smooth-input w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      {pick('Mật khẩu', 'Password', '密码')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={pick('Nhập mật khẩu', 'Enter password', '输入密码')}
                        className="smooth-input w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="submit-login-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/50 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 border border-emerald-400/30 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{pick('Đang xác thực...', 'Authenticating...', '正在验证...')}</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{pick('Đăng Nhập', 'Sign In', '登录')}</span>
                      </>
                    )}
                  </button>

                  {/* Quick multi-provider strip */}
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 border-t border-slate-800" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono whitespace-nowrap">
                        {pick('Hoặc đăng nhập bằng', 'Or continue with', '或通过以下方式登录')}
                      </span>
                      <div className="flex-1 border-t border-slate-800" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSocialLogin('google')}
                        disabled={isLoading}
                        title="Google"
                        className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {activeSocialLoading === 'google' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z" />
                            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                          </svg>
                        )}
                        <span className="text-[10px] font-semibold text-slate-300">Google</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSocialLogin('facebook')}
                        disabled={isLoading}
                        title="Facebook"
                        className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-[#1877F2]/15 border border-slate-800 hover:border-[#1877F2]/60 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {activeSocialLoading === 'facebook' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#1877F2]" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                          </svg>
                        )}
                        <span className="text-[10px] font-semibold text-slate-300">Facebook</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSocialLogin('github')}
                        disabled={isLoading}
                        title="GitHub"
                        className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-500 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {activeSocialLoading === 'github' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                          </svg>
                        )}
                        <span className="text-[10px] font-semibold text-slate-300">GitHub</span>
                      </button>
                    </div>

                    {/* Bar button: Đăng nhập bằng tài khoản khách */}
                    <button
                      id="quick-guest-btn"
                      type="button"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 font-semibold text-xs transition-all duration-200 border border-slate-800 hover:border-emerald-500/40 active:scale-[0.99] disabled:opacity-50 shadow-sm group cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span>{pick('Đăng nhập bằng tài khoản khách', 'Sign in with Guest account', '使用访客账号登录')}</span>
                    </button>

                    {/* Tùy chọn đồng bộ Google qua trình duyệt khi cần thiết trên Desktop */}
                    {showBrowserSyncBtn && isDesktopApp && (
                      <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                          <div className="font-semibold text-white">{pick('Đồng bộ Google qua trình duyệt máy tính', 'Sync Google via Desktop Browser', '通过桌面浏览器同步 Google')}</div>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {pick(
                            'Bạn có thể đăng nhập Google qua trình duyệt Chrome/Edge hệ thống để ủy quyền an toàn cho ứng dụng máy tính này:',
                            'You can sign in to Google via your system Chrome/Edge browser to securely authorize this desktop app:',
                            '您可以通过系统 Chrome/Edge 浏览器登录 Google，以安全授权此桌面应用：'
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={handleDesktopBrowserSync}
                          disabled={isGoogleLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{isGoogleLoading ? pick('Đang mở trình duyệt...', 'Opening browser...', '正在打开浏览器...') : pick('Mở trình duyệt để đồng bộ tài khoản Google', 'Open browser to sync Google account', '打开浏览器以同步 Google 账号')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              )}

              {/* Form Đăng Ký */}
              {accountSubMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      {pick('Tên tài khoản mới', 'New username', '新用户名')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-input-username"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={pick('Tối thiểu 3 ký tự', 'At least 3 characters', '至少 3 个字符')}
                        className="smooth-input w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Mật khẩu', 'Password', '密码')}
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={pick('Tối thiểu 6 ký tự', 'At least 6 characters', '至少 6 个字符')}
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Xác nhận mật khẩu', 'Confirm password', '确认密码')}
                      </label>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={pick('Nhập lại mật khẩu', 'Re-enter password', '再次输入密码')}
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Email & Số điện thoại liên kết (Tùy chọn) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Email (Tùy chọn)', 'Email (Optional)', '邮箱（可选）')}
                      </label>
                      <input
                        id="reg-input-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Số điện thoại (Tùy chọn)', 'Phone Number (Optional)', '手机号（可选）')}
                      </label>
                      <input
                        id="reg-input-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xx xxx xxx"
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Ngày sinh & Giới tính */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Ngày sinh (Tùy chọn)', 'Date of Birth (Optional)', '出生日期（可选）')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowWheelDatePicker(true)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-left text-slate-300 hover:text-white flex items-center justify-between"
                      >
                        <span>{dob || pick('Chọn ngày sinh', 'Select date of birth', '选择出生日期')}</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        {pick('Giới tính (Tùy chọn)', 'Gender (Optional)', '性别（可选）')}
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['Nam', 'Nữ', 'Không Muốn Trả Lời'] as GenderOption[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setGender(opt)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-semibold border transition-all ${
                              gender === opt
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {opt === 'Nam'
                              ? pick('Nam', 'Male', '男')
                              : opt === 'Nữ'
                              ? pick('Nữ', 'Female', '女')
                              : pick('Khác', 'Other', '其他')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    id="submit-register-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/50 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 border border-emerald-400/30 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{pick('Đang tạo tài khoản...', 'Creating account...', '正在创建账号...')}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>{pick('Đăng Ký Tài Khoản', 'Create Account', '注册账号')}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="mt-4 text-center text-[11px] text-slate-500">
          {pick('ClSend Relay • Mã hóa đầu cuối E2EE • Hoạt động đa nền tảng', 'ClSend Relay • End-to-End Encrypted E2EE • Cross-Platform', 'ClSend Relay • E2EE 端到端加密 • 多平台支持')}
        </div>
      </div>

      {/* Date Picker Wheel Modal */}
      {showWheelDatePicker && (
        <CompactWheelDatePicker
          value={dob}
          onClose={() => setShowWheelDatePicker(false)}
          onSave={(selected: string) => {
            setDob(selected);
            setShowWheelDatePicker(false);
          }}
        />
      )}
    </div>
  );
};
