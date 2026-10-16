import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Navigation, Loader2, Sparkles, X, Check } from 'lucide-react';
import { startRealtimeGpsTracking, stopRealtimeGpsTracking, getCurrentGpsLocation, registerGpsListener, GpsLocationInfo } from '../utils/gpsTracker';
import { fetchSpecificLocation } from '../utils/device';

interface GpsLocationBadgeProps {
  compact?: boolean;
}

export const GpsLocationBadge: React.FC<GpsLocationBadgeProps> = ({ compact = false }) => {
  const [gpsInfo, setGpsInfo] = useState<GpsLocationInfo | null>(getCurrentGpsLocation());
  const [fallbackLocation, setFallbackLocation] = useState<string>('Đang xác định khu vực...');
  const [isTracking, setIsTracking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecificLocation().then((loc) => {
      if (loc) setFallbackLocation(loc);
    }).catch(() => {});

    const unregister = registerGpsListener((loc) => {
      if (loc) {
        setGpsInfo(loc);
        setIsTracking(true);
      }
    });

    startRealtimeGpsTracking().then(() => {
      const current = getCurrentGpsLocation();
      if (current) {
        setGpsInfo(current);
        setIsTracking(true);
      }
    }).catch(() => {});

    return () => unregister();
  }, []);

  const handleToggleTracking = async () => {
    if (isTracking) {
      stopRealtimeGpsTracking();
      setIsTracking(false);
      setStatusMsg('Đã dừng định vị GPS thời gian thực.');
    } else {
      setStatusMsg('Đang yêu cầu quyền truy cập GPS thời gian thực...');
      await startRealtimeGpsTracking();
      setIsTracking(true);
      setStatusMsg('Đã bật định vị GPS thời gian thực thành công!');
    }
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const currentArea = gpsInfo?.address || fallbackLocation;

  return (
    <>
      {/* Navbar Badge Button */}
      {compact ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-emerald-400 transition-all shadow-sm shrink-0 relative cursor-pointer active:scale-95"
          title={`Vị trí: ${currentArea} (Bấm để xem chi tiết)`}
        >
          <MapPin className="w-3.5 h-3.5" />
          {isTracking && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs text-slate-200 transition-all shadow-sm group cursor-pointer shrink-0 max-w-[200px]"
          title="Bấm để xem thông tin định vị GPS thời gian thực"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform animate-bounce" />
            {isTracking && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <span className="truncate font-medium">{currentArea}</span>
        </button>
      )}

      {/* Detailed Modal (Rendered via Portal to break out of sticky header backdrop-blur trap) */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 touch-manipulation overscroll-contain"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-700/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Navigation className={`w-5 h-5 ${isTracking ? 'animate-spin text-emerald-400' : ''}`} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Định Vị GPS Thời Gian Thực</h3>
                  <p className="text-[11px] text-slate-400">Theo dõi tọa độ và khu vực hiện tại của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{statusMsg}</span>
              </div>
            )}

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Khu vực / Địa chỉ:</span>
                <span className="font-semibold text-emerald-300 text-right max-w-[200px] truncate">{currentArea}</span>
              </div>
              {gpsInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Vĩ độ (Latitude):</span>
                    <span className="font-mono text-slate-200">{gpsInfo.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Kinh độ (Longitude):</span>
                    <span className="font-mono text-slate-200">{gpsInfo.longitude.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Độ chính xác (Accuracy):</span>
                    <span className="font-mono text-slate-200">±{Math.round(gpsInfo.accuracy)} mét</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-400 py-2 leading-relaxed">
                  Đang quét tọa độ GPS chính xác từ thiết bị... Bạn hãy cấp quyền truy cập vị trí khi trình duyệt hỏi nhé.
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleToggleTracking}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] ${
                  isTracking
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 border border-rose-400/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 border border-emerald-400/30'
                }`}
              >
                <Navigation className={`w-4 h-4 ${isTracking ? 'animate-pulse' : ''}`} />
                <span>{isTracking ? 'Đang bật GPS Thời Gian Thực (Bấm để tắt)' : 'Kích Hoạt Lại GPS Thời Gian Thực'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-medium text-xs transition-colors"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
};
