import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, Calendar, Sparkles, Mail, Smartphone } from 'lucide-react';

interface UserProfileModalProps {
  user: {
    uid?: string;
    id?: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    avatarColor?: string;
    isDev?: boolean;
    deviceName?: string;
    deviceType?: string;
    bannerUrl?: string;
    bio?: string;
    customBio?: string;
    customBadgeText?: string;
    createdAt?: string;
    isMe?: boolean;
  } | null;
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

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, anchorPosition, onClose }) => {
  // UX Filter Logic: Chặn tài khoản chính (Current User), tuyệt đối không mở khung
  if (!user || user.isMe || !anchorPosition) return null;

  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Click Outside Handler
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onClose]);

  // 2. Escape Key Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 3. Scroll & Resize Handler: Clean up and close on scroll to prevent detached floating
  useEffect(() => {
    const handleScrollOrResize = () => {
      onClose();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  // 4. Smart Boundary & Drift Adjuster (Pixel-Perfect Dynamic Nudging, No 180° Flip)
  const computePosition = (measuredHeight = 410, measuredWidth = 320) => {
    if (!anchorPosition) {
      return {
        top: 0,
        left: 0,
        arrowSide: 'top' as 'top' | 'left',
        arrowPos: 16
      };
    }

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const avatarTop = anchorPosition.top;
    const avatarBottom = anchorPosition.bottom ?? (anchorPosition.top + (anchorPosition.height ?? 28));
    const avatarLeft = anchorPosition.left;
    const avatarRight = anchorPosition.right ?? (anchorPosition.left + (anchorPosition.width ?? 28));

    // Mặc định: Khung Profile xuất hiện sát ngay dưới góc phải của ảnh đại diện nhỏ, dịch sang phải thêm một khoảng thoáng
    const idealTop = avatarBottom + 4;
    const idealLeft = avatarRight + 2;

    // Giữ trong khung nhìn chiều ngang (Viewport X clamp)
    let finalLeft = idealLeft;
    if (finalLeft + measuredWidth > vw - 12) {
      finalLeft = vw - measuredWidth - 12;
    }
    if (finalLeft < 12) {
      finalLeft = 12;
    }

    // Xử lý va chạm viền dưới màn hình (Viewport Collision):
    // KHÔNG lật ngược 180 độ. Tính chính xác số pixel bị tràn (Overflow Delta) và trượt (slide) ngược lên vừa đủ
    const bottomLimit = vh - 12;
    const overflowDelta = Math.max(0, (idealTop + measuredHeight) - bottomLimit);
    let finalTop = idealTop - overflowDelta;

    // Chặn mép trên an toàn
    if (finalTop < 12) {
      finalTop = 12;
    }

    // Neo giữ mũi tên (Arrow Anchor):
    // Điểm neo trên avatar: góc phải dưới của icon (avatarRight, avatarBottom)
    const targetAnchorX = avatarRight;
    const targetAnchorY = avatarBottom;

    const relX = targetAnchorX - finalLeft;
    const relY = targetAnchorY - finalTop;

    let arrowSide: 'top' | 'left' = 'top';
    let arrowPos = 12;

    if (relY <= 14 && relX >= -4) {
      // Khung chưa trượt quá avatar: mũi tên ở cạnh trên trỏ thẳng góc phải avatar
      arrowSide = 'top';
      arrowPos = Math.max(8, Math.min(Math.max(8, relX + 6), measuredWidth - 28));
    } else {
      // Khung dịch sang hẳn bên phải hoặc trượt lên: mũi tên chuyển sang cạnh trái trỏ ngang vào avatar
      arrowSide = 'left';
      arrowPos = Math.max(10, Math.min(Math.max(10, relY - 7), measuredHeight - 32));
    }

    return {
      top: Math.round(finalTop),
      left: Math.round(finalLeft),
      arrowSide,
      arrowPos: Math.round(arrowPos)
    };
  };

  const [coords, setCoords] = useState(() => computePosition());

  useLayoutEffect(() => {
    if (!anchorPosition) return;
    const modalEl = modalRef.current;
    if (modalEl) {
      const h = modalEl.offsetHeight;
      const w = modalEl.offsetWidth;
      setCoords(computePosition(h, w));
    }
  }, [anchorPosition]);

  const initialChar = (user.displayName?.trim().charAt(0) || 'U').toUpperCase();
  const bannerGradient = user.bannerUrl 
    ? `url(${user.bannerUrl}) center/cover no-repeat` 
    : 'linear-gradient(to right, #059669, #0d9488, #4f46e5)';

  const rawBio = user.customBio || user.bio || '';
  const cleanBio = rawBio.replace(/^\$+\s*/, '').replace(/\$/g, '').trim();

  // GPU transform-origin dynamic setting based on arrow anchor
  const transformOrigin = coords.arrowSide === 'top'
    ? `${coords.arrowPos + 7}px 0px`
    : `0px ${coords.arrowPos + 7}px`;

  // Render via React Portal directly into document.body to isolate from parent CSS transforms & scroll offsets
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/25 backdrop-blur-[0.5px] transition-opacity animate-in fade-in duration-150" 
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="fixed w-[320px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto bg-[#1e1f22] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/90 overflow-hidden select-none z-[10000] animate-profile-pop will-change-transform"
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transformOrigin,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Neo Mũi Tên Chỉ Hướng: Tự động bám chặt theo avatar mà không biến dạng khi khung trượt lên */}
        {coords.arrowSide === 'top' ? (
          <div 
            className="absolute -top-1.5 w-3.5 h-3.5 bg-[#1e1f22] border-t border-l border-slate-700/80 rotate-45 z-20 pointer-events-none transition-all duration-75"
            style={{ left: `${coords.arrowPos}px` }}
          />
        ) : (
          <div 
            className="absolute -left-1.5 w-3.5 h-3.5 bg-[#1e1f22] border-l border-b border-slate-700/80 rotate-45 z-20 pointer-events-none transition-all duration-75"
            style={{ top: `${coords.arrowPos}px` }}
          />
        )}
        
        {/* Close button */}
        <button
          onClick={onClose}
          title="Đóng (Esc)"
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner Area */}
        <div 
          className="h-28 w-full bg-cover bg-center relative"
          style={{ background: bannerGradient }}
        >
          {user.customBadgeText && (
            <div className="absolute top-3 right-12 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded-full border border-emerald-500/40 text-[10.5px] text-emerald-300 font-bold shadow-md">
              {user.customBadgeText}
            </div>
          )}
          {user.isDev && (
            <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/50 backdrop-blur-xs rounded-full border border-amber-500/40 flex items-center gap-1 text-[11px] text-amber-300 font-bold">
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>DEV Chính Chủ</span>
            </div>
          )}
        </div>
        
        {/* Profile Body with Overlapping Avatar */}
        <div className="px-4 pb-5 pt-12 relative bg-[#1e1f22]">
          {/* Avatar overlapping banner on the left */}
          <div className="absolute -top-10 left-4 z-10">
            <div className="relative">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-[#1e1f22] shadow-2xl bg-[#2b2d31]"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl ring-4 ring-[#1e1f22] shadow-2xl"
                  style={{ backgroundColor: user.avatarColor || '#10b981' }}
                >
                  {initialChar}
                </div>
              )}
              {/* Online indicator dot */}
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-4 ring-[#1e1f22]" title="Đang hoạt động" />
            </div>
          </div>

          {/* User Names & Badges */}
          <div className="mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-white tracking-wide truncate max-w-[240px]">
                {user.displayName}
              </h2>
              {user.isDev && (
                <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Developer
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              @{user.displayName.toLowerCase().replace(/\s+/g, '')}
            </p>
          </div>

          {/* Divider */}
          <div className="my-4 h-px w-full bg-slate-700/60" />

          {/* Information Section */}
          <div className="space-y-3.5 bg-[#2b2d31]/70 p-3.5 rounded-xl border border-slate-700/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Giới thiệu về tôi
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed italic">
              {cleanBio || 'Thành viên CloudSend đang trực tuyến và sẵn sàng chia sẻ tệp.'}
            </p>

            <div className="space-y-2 pt-1 text-xs text-slate-300">
              {user.isDev && user.email ? (
                <div className="flex items-center gap-2.5 truncate">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate text-amber-300 font-mono text-[11px]">{user.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 truncate text-slate-400">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate text-slate-300">Tài khoản bảo mật (Đã ẩn danh tính thật)</span>
                </div>
              )}

              {user.deviceName && (
                <div className="flex items-center gap-2.5 truncate">
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate text-slate-200">Thiết bị: {user.deviceName} ({user.deviceType || 'Web'})</span>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-400">Tham gia CloudSend từ {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay'}</span>
              </div>
            </div>
          </div>

          {/* Badges / Roles footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Thành viên chính thức
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shadow-md"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
