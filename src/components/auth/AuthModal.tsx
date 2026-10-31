import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CloudSendLogo } from '../CloudSendLogo';
import { SilkFabricBackground } from '../SilkFabricBackground';
import { SmoothTypewriter } from '../SmoothTypewriter';
import { CompactWheelDatePicker } from '../CompactWheelDatePicker';
import { 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  LogIn, 
  UserPlus, 
  Info, 
  Loader2, 
  Calendar, 
  CheckCircle2, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  Sliders,
  Check,
  Monitor,
  ExternalLink,
  QrCode,
  KeyRound,
  RefreshCw,
  Copy,
  Smartphone,
  Radio
} from 'lucide-react';
import { createDesktopSyncSession, formatSyncCode, AuthSyncPayload } from '../../utils/authSync';

type ActiveTab = 'sync' | 'account' | 'quick';
type AccountSubMode = 'login' | 'register';
type GenderOption = 'Nam' | 'Nữ' | 'Không Muốn Trả Lời';

interface AuthModalProps {
  onBackToLanding?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onBackToLanding }) => {
  const { 
    loginWithGoogle, 
    loginWithAccount, 
    registerWithAccount, 
    loginAsGuest, 
    loginWithSyncPayload,
    settings 
  } = useAuth();

  const isDesktopApp = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);

  // Default to 'sync' tab on Desktop app (since users often have web open), or 'account' on Web
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (isDesktopApp ? 'sync' : 'account'));
  const [accountSubMode, setAccountSubMode] = useState<AccountSubMode>('login');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [deviceName, setDeviceName] = useState(settings.deviceName || '');

  // UI helpers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
        settings.deviceName || 'Ứng dụng ClSend Desktop',
        async (payload: AuthSyncPayload) => {
          setSyncSuccess(true);
          setInfoNotice(`Đã nhận phiên đăng nhập từ ${payload.authorizedDeviceName || 'Web'}! Đang đồng bộ...`);
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
      setErrorMsg('Vui lòng nhập tên tài khoản.');
      return;
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản.');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithAccount(username.trim(), password);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Tên tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
      } else {
        setErrorMsg(err?.message || 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.');
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
      setErrorMsg('Vui lòng nhập tên tài khoản.');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg('Tên tài khoản phải có ít nhất 3 ký tự.');
      return;
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu tài khoản phải có tối thiểu 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setIsLoading(true);
    try {
      await registerWithAccount({
        username: cleanUsername,
        pass: password,
        dob: dob ? dob.trim() : undefined,
        gender: gender || 'Không Muốn Trả Lời',
        deviceName: deviceName ? deviceName.trim() : undefined
      });
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('Tên tài khoản này đã có người đăng ký. Vui lòng chọn tên khác hoặc chuyển sang Đăng nhập.');
      } else {
        setErrorMsg(err?.message || 'Đã xảy ra lỗi khi tạo tài khoản. Vui lòng thử lại.');
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
      setErrorMsg('Không thể tạo phiên sử dụng nhanh: ' + (err?.message || 'Vui lòng thử lại'));
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
          setInfoNotice('Đã mở trình duyệt hệ thống. Hãy đăng nhập Google trên tab vừa mở, ứng dụng ClSend máy tính sẽ tự động nhận diện và cập nhật tài khoản.');
        } else {
          setErrorMsg('Không tìm thấy cổng cục bộ của ứng dụng desktop. Bạn có thể đăng nhập tức thì bằng Tên tài khoản & Mật khẩu bên dưới.');
        }
      } catch (err: any) {
        setErrorMsg('Không thể mở liên kết trình duyệt: ' + (err?.message || 'Vui lòng thử lại'));
      } finally {
        setIsGoogleLoading(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    resetFormErrors();
    setIsLoading(true);
    setIsGoogleLoading(true);
    
    let timerId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('POPUP_TIMEOUT'));
      }, 30000);
    });

    try {
      await Promise.race([loginWithGoogle(), timeoutPromise]);
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setInfoNotice('Bạn đã đóng cửa sổ đăng nhập Google. Bạn có thể nhấn lại hoặc đăng nhập bằng Tên tài khoản.');
      } else if (code === 'auth/popup-blocked') {
        if (isDesktopApp) {
          setShowBrowserSyncBtn(true);
          setErrorMsg('Cửa sổ đăng nhập chưa mở được. Bạn có thể dùng Tên tài khoản & Mật khẩu hoặc bấm nút Đồng bộ trình duyệt bên dưới.');
        } else {
          setErrorMsg('Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép popup hoặc đăng nhập bằng Tên tài khoản.');
        }
      } else if (code === 'auth/disallowed-useragent' || msg.includes('disallowed_useragent')) {
        if (isDesktopApp) {
          setShowBrowserSyncBtn(true);
          setInfoNotice('Chính sách Google yêu cầu xác thực qua trình duyệt. Hãy bấm nút Đồng bộ bên dưới, hoặc đăng nhập trực tiếp bằng Tên tài khoản & Mật khẩu (nhanh gọn như Zalo / Discord).');
        } else {
          setErrorMsg('Trình duyệt này bị Google hạn chế. Vui lòng đăng nhập bằng Tên tài khoản & Mật khẩu.');
        }
      } else if (msg === 'POPUP_TIMEOUT') {
        if (isDesktopApp) {
          setShowBrowserSyncBtn(true);
          setInfoNotice('Cửa sổ đăng nhập Google đang phản hồi chậm. Bạn có thể đăng nhập bằng Tên tài khoản & Mật khẩu hoặc bấm nút Đồng bộ bên dưới.');
        } else {
          setInfoNotice('Cửa sổ đăng nhập Google đang phản hồi chậm. Bạn có thể bấm Đăng nhập nhanh hoặc dùng Tên tài khoản.');
        }
      } else {
        if (isDesktopApp) setShowBrowserSyncBtn(true);
        setErrorMsg('Đăng nhập Google: ' + (err?.message || 'Vui lòng thử lại hoặc đăng nhập bằng Tên tài khoản'));
      }
    } finally {
      if (timerId) clearTimeout(timerId);
      setIsLoading(false);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-950 text-slate-100 relative overflow-x-hidden overflow-y-auto font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Living Silk Wave Ribbons & Floating Luminescent Starlight Background */}
      <SilkFabricBackground className="fixed inset-0 pointer-events-none -z-10" intensity="normal" showParticles={true} showGrid={true} />

      {/* Decorative top soft glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Main Container */}
      <div className="w-full max-w-md my-auto relative z-10 py-4 sm:py-6 transition-all duration-300">
        
        {/* Back to Landing Page Button */}
        {onBackToLanding && (
          <div className="w-full flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Quay lại trang giới thiệu</span>
            </button>
            <span className="text-[11px] text-slate-500 font-medium">Chưa đăng nhập</span>
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
                "Đồng bộ ghi chú, tệp tin và kho Cloud 24/7",
                "Truyền dữ liệu tốc độ cao tới 250MB qua Relay",
                "Bảo mật đa nền tảng cho Điện thoại & Máy tính",
                "Đăng nhập độc lập không cần rời khỏi ứng dụng"
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
                <span>Ứng dụng ClSend Desktop (Hoạt động độc lập)</span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MAIN CARD WITH 3 FUNCTIONAL TABS */}
        {/* ============================================================ */}
        <div className="w-full bg-slate-900/95 border border-slate-800/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
          
          {/* Top 3-Tab Bar: [ Đồng bộ Web / QR ] [ Tài khoản ] [ Google & Khách ] */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
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
              <span className="truncate">Đồng bộ Web</span>
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
              <span className="truncate">Tài khoản</span>
            </button>

            {/* TAB 3: Google & Khách */}
            <button
              id="tab-btn-quick"
              type="button"
              onClick={() => {
                resetFormErrors();
                setActiveTab('quick');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'quick'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="truncate">Vào nhanh</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
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
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Đồng bộ tài khoản từ Web / Điện thoại</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Nếu bạn đã đăng nhập trên Web, bạn có thể đồng bộ sang ứng dụng máy tính ngay lập tức mà không cần gõ lại mật khẩu!
                </p>
              </div>

              {/* Instructions steps */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <span>Mở trang web ClSend nơi bạn đã đăng nhập.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <span>Bấm nút <strong className="text-emerald-300">[ 🖥️ Đồng bộ Desktop ]</strong> ở góc trên thanh công cụ.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                  <span>Nhập mã 6 chữ số bên dưới để cấp quyền tức thì:</span>
                </div>
              </div>

              {/* The 6-Digit Sync Code Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-emerald-500/40 text-center relative group shadow-inner">
                <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold mb-1">
                  Mã kết nối máy tính của bạn
                </div>

                {isSyncLoading ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Đang tạo mã kết nối...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-white selection:bg-emerald-500">
                      {formatSyncCode(syncCode) || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySyncCode}
                      title="Sao chép mã 6 số"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={initSyncSession}
                      title="Tạo mã mới"
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
                  <span>Đang chờ bạn xác nhận từ Web hoặc Điện thoại...</span>
                </div>
              </div>

              {/* Collapsible QR Code for Phone Camera */}
              {qrDataUrl && (
                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="p-2.5 rounded-2xl bg-white shadow-xl border border-emerald-500/30">
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code đăng nhập nhanh" 
                      className="w-36 h-36 rounded-lg object-contain"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2">
                    Hoặc dùng camera điện thoại quét mã QR để mở trang xác nhận
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: TÀI KHOẢN & MẬT KHẨU (ĐĂNG NHẬP / ĐĂNG KÝ TRỰC TIẾP NHƯ ZALO) */}
          {/* ============================================================ */}
          {activeTab === 'account' && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Switcher: Đăng Nhập vs Đăng Ký */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{accountSubMode === 'login' ? 'Đăng Nhập Tài Khoản' : 'Tạo Tài Khoản Mới'}</span>
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
                    Đăng Nhập
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
                    Đăng Ký
                  </button>
                </div>
              </div>

              {/* Form Đăng Nhập */}
              {accountSubMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Tên tài khoản hoặc Email
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
                        placeholder="Nhập tên tài khoản"
                        className="smooth-input w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Mật khẩu
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
                        placeholder="Nhập mật khẩu"
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
                        <span>Đang xác thực...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Đăng Nhập</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Form Đăng Ký */}
              {accountSubMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      Tên tài khoản mới
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-input-username"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Tối thiểu 3 ký tự"
                        className="smooth-input w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Mật khẩu
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Xác nhận mật khẩu
                      </label>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        className="smooth-input w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Ngày sinh & Giới tính */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Ngày sinh (Tùy chọn)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowWheelDatePicker(true)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-left text-slate-300 hover:text-white flex items-center justify-between"
                      >
                        <span>{dob || 'Chọn ngày sinh'}</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Giới tính (Tùy chọn)
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
                            {opt === 'Không Muốn Trả Lời' ? 'Khác' : opt}
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
                        <span>Đang tạo tài khoản...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Đăng Ký Tài Khoản</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: GOOGLE & ĐĂNG NHẬP NHANH (KHÁCH / GUEST) */}
          {/* ============================================================ */}
          {activeTab === 'quick' && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Truy cập nhanh 1-chạm</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Đăng nhập tài khoản Google để đồng bộ kho Cloud hoặc vào nhanh dạng Khách để nhận và gửi tệp tức thì.
                </p>
              </div>

              {/* Nút 1: Đăng nhập Google */}
              <button
                id="quick-google-btn"
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-100 hover:text-white font-bold text-sm transition-all duration-200 border border-slate-700 hover:border-emerald-500/40 active:scale-[0.99] disabled:opacity-50 shadow-md group cursor-pointer"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Đang kết nối Google...</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                        <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z" />
                        <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                      </svg>
                    </div>
                    <span>Đăng nhập với tài khoản Google</span>
                  </>
                )}
              </button>

              {/* Tùy chọn đồng bộ Google qua trình duyệt khi cần thiết trên Desktop */}
              {showBrowserSyncBtn && isDesktopApp && (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                    <div className="font-semibold text-white">Đồng bộ Google qua trình duyệt máy tính</div>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Bạn có thể đăng nhập Google qua trình duyệt Chrome/Edge hệ thống để ủy quyền an toàn cho ứng dụng máy tính này:
                  </p>
                  <button
                    type="button"
                    onClick={handleDesktopBrowserSync}
                    disabled={isGoogleLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isGoogleLoading ? 'Đang mở trình duyệt...' : 'Mở trình duyệt để đồng bộ tài khoản Google'}</span>
                  </button>
                </div>
              )}

              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                  Hoặc
                </span>
              </div>

              {/* Nút 2: Đăng nhập Khách */}
              <button
                id="quick-guest-btn"
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 font-medium text-xs sm:text-sm transition-all duration-200 border border-slate-800 hover:border-emerald-500/40 active:scale-[0.99] disabled:opacity-50 shadow-md group cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                </div>
                <span>Đăng nhập nhanh (Chế độ Khách / Ẩn danh)</span>
              </button>
            </div>
          )}
        </div>

        {/* Back to landing link */}
        {onBackToLanding && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={onBackToLanding}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-4"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Trở về xem trang giới thiệu & tính năng</span>
            </button>
          </div>
        )}

        {/* Footer info note */}
        <div className="mt-3 text-center text-[11px] text-slate-500">
          ClSend Relay • Mã hóa đầu cuối E2EE • Hoạt động đa nền tảng
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
