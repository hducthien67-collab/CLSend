import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  Monitor, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  QrCode, 
  ArrowRight, 
  Sparkles,
  ShieldCheck,
  Laptop
} from 'lucide-react';
import { verifySyncCode, authorizeSyncCode } from '../utils/authSync';

interface DesktopSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export const DesktopSyncModal: React.FC<DesktopSyncModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
}) => {
  const { currentUser, userProfile, settings } = useAuth();
  const [syncCode, setSyncCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [targetDeviceInfo, setTargetDeviceInfo] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setSyncCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsLoading(false);
      setTargetDeviceInfo(null);
    }
  }, [isOpen]);

  // Auto-verify code when 6 digits are typed
  useEffect(() => {
    const clean = syncCode.replace(/[^0-9]/g, '');
    if (clean.length === 6 && !successMsg && !isLoading) {
      verifySyncCode(clean).then((res) => {
        if (res.valid && res.data) {
          setErrorMsg(null);
          setTargetDeviceInfo(res.data.desktopDeviceName || 'Ứng dụng ClSend Desktop');
        } else {
          setTargetDeviceInfo(null);
        }
      });
    } else {
      setTargetDeviceInfo(null);
    }
  }, [syncCode, successMsg, isLoading]);

  if (!isOpen) return null;

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = syncCode.replace(/[^0-9]/g, '');
    if (clean.length !== 6) {
      setErrorMsg('Vui lòng nhập đúng mã đồng bộ 6 chữ số hiển thị trên ứng dụng máy tính.');
      return;
    }

    if (!currentUser || !userProfile) {
      setErrorMsg('Bạn chưa đăng nhập tài khoản trên trang web này.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authorizeSyncCode(clean, currentUser, userProfile, settings);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể đồng bộ phiên đăng nhập. Vui lòng kiểm tra lại mã.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">Đồng bộ sang App Desktop</h3>
              <p className="text-xs text-slate-400">Cấp quyền đăng nhập tức thì cho máy tính</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current user badge */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 overflow-hidden shadow-md"
            style={{ backgroundColor: settings.avatarColor || '#10B981' }}
          >
            {(settings.customAvatarUrl || currentUser?.photoURL) ? (
              <img 
                src={settings.customAvatarUrl || currentUser?.photoURL || ''} 
                alt="Avatar" 
                className="w-full h-full object-cover" 
              />
            ) : (
              (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Tài khoản đồng bộ</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white truncate">
              {currentUser?.displayName || userProfile?.displayName || 'Người dùng'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {currentUser?.email || userProfile?.email || 'Đã đăng nhập'}
            </div>
          </div>
        </div>

        {/* Success Screen */}
        {successMsg ? (
          <div className="py-8 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">Đăng nhập máy tính thành công!</h4>
            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              {successMsg} Ứng dụng Desktop của bạn hiện đã được đăng nhập và đồng bộ đầy đủ dữ liệu.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAuthorize} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Nhập Mã đồng bộ 6 chữ số trên ứng dụng máy tính:
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={syncCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSyncCode(val);
                    setErrorMsg(null);
                  }}
                  placeholder="Ví dụ: 824915"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-center text-2xl font-mono tracking-widest text-emerald-300 font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Mở ứng dụng ClSend trên Desktop &gt; chọn tab <strong>Mã đồng bộ / QR</strong> để xem mã 6 số.</span>
              </p>
            </div>

            {targetDeviceInfo && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <Laptop className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Đã phát hiện: <strong>{targetDeviceInfo}</strong></span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || syncCode.replace(/[^0-9]/g, '').length !== 6}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/60 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-emerald-400/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang cấp quyền đăng nhập...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác nhận đăng nhập trên Desktop</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
