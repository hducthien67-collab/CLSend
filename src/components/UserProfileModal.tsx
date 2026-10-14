import React from 'react';
import { X, Crown, Shield, Calendar, Sparkles, Mail, Smartphone, Globe } from 'lucide-react';

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
    createdAt?: string;
  } | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose }) => {
  if (!user) return null;

  const initialChar = (user.displayName?.trim().charAt(0) || 'U').toUpperCase();
  const bannerGradient = user.bannerUrl 
    ? `url(${user.bannerUrl})` 
    : 'linear-gradient(to right, #059669, #0d9488, #4f46e5)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="relative w-full max-w-[360px] bg-[#1e1f22] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden animate-scaleUp select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner Area */}
        <div 
          className="h-28 w-full bg-cover bg-center relative"
          style={{ background: bannerGradient }}
        >
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
              {user.bio || 'Thành viên CloudSend đang trực tuyến và sẵn sàng chia sẻ tệp.'}
            </p>

            <div className="space-y-2 pt-1 text-xs text-slate-300">
              {user.email && (
                <div className="flex items-center gap-2.5 truncate">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate text-slate-200">{user.email}</span>
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
    </div>
  );
};
