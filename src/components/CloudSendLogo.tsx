import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface CloudSendLogoProps {
  className?: string;
  size?: number;
  showRays?: boolean;
  showVerifiedShield?: boolean;
}

/**
 * Logo chính thức của CLSend (Phiên bản Nâng Cấp Tinh Tế & Hiện Đại):
 * - Thiết kế khí động học siêu tốc kết hợp cánh origami công nghệ cao (Supersonic Aero Wing)
 * - Tông màu Ngọc Lục Bảo (Emerald) phối Lam Ngọc Điện Quang (Teal/Cyan) và Bạc Hà (Mint)
 * - Hiệu ứng phản chiếu ánh sáng lụa (Silk Luster Sheen) cùng viền thủy tinh mờ (Cyber Glassmorphism)
 * - Nền mây chìm đa tầng biểu trưng cho hạ tầng Cloud phân tán bảo mật cao
 */
export const CloudSendLogo: React.FC<CloudSendLogoProps> = ({ 
  className = "w-10 h-10",
  size = 40,
  showRays = true,
  showVerifiedShield = false,
}) => {
  return (
    <div 
      style={{ width: size, height: size }}
      className={`relative group flex items-center justify-center rounded-2xl select-none shrink-0 isolate overflow-hidden ${className}`}
    >
      {/* 1. Vòng hào quang đa sắc phía sau (Glow Aura) */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 blur-sm opacity-50 group-hover:opacity-90 group-hover:blur-md transition-all duration-300 pointer-events-none" />

      {/* 2. Thân Vector SVG Sắc Nét 100% không bị vỡ ảnh ở mọi kích thước */}
      <svg 
        viewBox="0 0 64 64" 
        className="w-full h-full relative z-10 transition-transform duration-300 group-hover:scale-105" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Nền Gradient ngọc lục bảo và lam ngọc */}
          <linearGradient id="csl-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="45%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>

          {/* Dải sáng phản chiếu lụa (Silk Sheen) */}
          <linearGradient id="csl-silk" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
          </linearGradient>

          {/* Gradient Cánh Máy Bay Thân Phải */}
          <linearGradient id="csl-wing-main" x1="16" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0fdf4" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>

          {/* Gradient Cánh Gấp Phản Quang 3D */}
          <linearGradient id="csl-wing-depth" x1="26" y1="36" x2="42" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#99f6e4" />
            <stop offset="50%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>

          {/* Gradient Cạnh Dưới Đậm */}
          <linearGradient id="csl-wing-shadow" x1="24" y1="38" x2="32" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#115e59" />
          </linearGradient>

          {/* Bóng đổ cánh */}
          <filter id="csl-plane-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#022c22" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Khối nền bo góc mềm mại */}
        <rect width="64" height="64" rx="18" fill="url(#csl-bg)" />
        
        {/* Đường viền ánh kim cyber mạ bạc */}
        <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="17.25" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />

        {/* Vệt ánh sáng lụa uốn lượn chéo góc */}
        <path 
          d="M-8 26 Q32 10 72 38 L72 0 L-8 0 Z" 
          fill="url(#csl-silk)" 
          opacity="0.6" 
        />

        {/* Vòm Đám Mây Mạ Bạc Tinh Tế ở Chân Logo */}
        <path 
          d="M12 49 C14 43 21 42 24 46 C27 42 37 42 40 47 C43 44 50 45 52 50 C52 51 48 54 44 54 L18 54 C14 54 11 51 12 49 Z" 
          fill="#ffffff" 
          fillOpacity="0.16" 
        />

        {/* Biểu tượng Máy Bay Truyền Tệp Tốc Độ Cao 3D Origami */}
        <g filter="url(#csl-plane-shadow)">
          {/* Thân Cánh Chính Bay Vút */}
          <path 
            d="M51 13 L17 32.5 C15.4 33.3 15.6 35.4 17.2 36 L28 40 L44 23 L32 41.5 L36 49.5 C36.8 51 38.8 50.8 39.5 49.2 L52.8 15.2 C53.4 13.8 52.2 12.5 51 13 Z" 
            fill="url(#csl-wing-main)" 
          />

          {/* Nếp Gấp Mặt Trong Tạo Độ Nổi Khối */}
          <path 
            d="M28 40 L44 23 L32 41.5 Z" 
            fill="url(#csl-wing-depth)" 
            opacity="0.9"
          />

          {/* Nếp Đuôi Cánh Thấp */}
          <path 
            d="M28 40 L32 41.5 L30 47 C29.5 48 28.2 47.8 28 46.8 L28 40 Z" 
            fill="url(#csl-wing-shadow)" 
          />

          {/* Đèn Định Vị / Tín Hiệu Relay Xanh Ngọc phát sáng ở đầu mũi */}
          <circle cx="51.5" cy="13.5" r="2.2" fill="#34d399" />
          <circle cx="51.5" cy="13.5" r="4" fill="#a7f3d0" opacity="0.4" />
        </g>

        {/* Chấm sáng kim cương tinh tế góc trên trái */}
        <circle cx="10" cy="10" r="1.5" fill="#ffffff" opacity="0.8" />
      </svg>

      {/* 3. Huy hiệu bảo mật góc dưới khi được yêu cầu */}
      {showVerifiedShield && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center shadow-md ring-2 ring-slate-950 z-20">
          <ShieldCheck className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
        </div>
      )}
    </div>
  );
};
