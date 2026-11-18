import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Code2, Copy, Download, Image as ImageIcon, ShieldCheck, Square } from 'lucide-react';
import { pickActiveLang } from '../context/LanguageContext';

interface CloudSendLogoProps {
  className?: string;
  size?: number;
  showRays?: boolean;
  showVerifiedShield?: boolean;
  disableContextMenu?: boolean;
}

/**
 * Logo chính thức của CLSend (Phiên bản Nâng Cấp Tinh Tế & Hiện Đại):
 * - Thiết kế khí động học siêu tốc kết hợp cánh origami công nghệ cao (Supersonic Aero Wing)
 * - Tông màu Ngọc Lục Bảo (Emerald) phối Lam Ngọc Điện Quang (Teal/Cyan) và Bạc Hà (Mint)
 * - Hiệu ứng phản chiếu ánh sáng lụa (Silk Luster Sheen) cùng viền thủy tinh mờ (Cyber Glassmorphism)
 * - Nền mây chìm đa tầng biểu trưng cho hạ tầng Cloud phân tán bảo mật cao
 * - Hỗ trợ nhấn chuột phải để tải về dưới dạng PNG 1024x1024 (bo góc / vuông nền kín) hoặc SVG Vector gốc
 */
export const CloudSendLogo: React.FC<CloudSendLogoProps> = ({
  className = 'w-10 h-10',
  size = 40,
  showVerifiedShield = false,
  disableContextMenu = false,
}) => {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const ids = {
    bg: `csl-bg-${uid}`,
    silk: `csl-silk-${uid}`,
    wingMain: `csl-wing-main-${uid}`,
    wingDepth: `csl-wing-depth-${uid}`,
    wingShadow: `csl-wing-shadow-${uid}`,
    planeShadow: `csl-plane-shadow-${uid}`,
  };

  useEffect(() => {
    if (!menuPos) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuPos(null);
      }
    };
    const handleScrollOrResize = () => {
      setMenuPos(null);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [menuPos]);

  const buildStandaloneSvgMarkup = (options?: { square?: boolean; pixelSize?: number }): string => {
    if (!svgRef.current) return '';
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const exportSize = options?.pixelSize ?? 1024;

    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(exportSize));
    clone.setAttribute('height', String(exportSize));
    clone.setAttribute('viewBox', '0 0 64 64');

    if (options?.square) {
      const rects = clone.querySelectorAll('rect');
      rects.forEach((rect) => {
        rect.setAttribute('rx', '0');
      });
    }

    const serializer = new XMLSerializer();
    let markup = serializer.serializeToString(clone);
    if (!markup.startsWith('<?xml')) {
      markup = `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
    }
    return markup;
  };

  const triggerDownload = (href: string, filename: string, revokeObjectUrl = false) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {}
      if (revokeObjectUrl && href.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(href);
        } catch {}
      }
    }, 1500);
  };

  const handleDownloadSvg = () => {
    const markup = buildStandaloneSvgMarkup({ pixelSize: 512 });
    if (!markup) return;
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'clsend-icon.svg', true);
    setMenuPos(null);
  };

  const handleDownloadPng = async (square: boolean, pixelSize = 1024) => {
    const modeKey = square ? 'png-square' : 'png-rounded';
    setIsExporting(modeKey);
    try {
      const markup = buildStandaloneSvgMarkup({ square, pixelSize });
      if (!markup) throw new Error('SVG unavailable');

      const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Failed to load SVG into image'));
          image.src = svgUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = pixelSize;
        canvas.height = pixelSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.clearRect(0, 0, pixelSize, pixelSize);
        ctx.drawImage(img, 0, 0, pixelSize, pixelSize);

        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0)
        );
        if (!pngBlob) throw new Error('PNG encoding failed');

        const pngUrl = URL.createObjectURL(pngBlob);
        const filename = square
          ? `clsend-icon-square-${pixelSize}x${pixelSize}.png`
          : `clsend-icon-${pixelSize}x${pixelSize}.png`;
        triggerDownload(pngUrl, filename, true);
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    } catch {
      triggerDownload(
        square ? '/maskable-icon-512x512.png' : '/pwa-512x512.png',
        square ? 'clsend-icon-square-512x512.png' : 'clsend-icon-512x512.png',
        false
      );
    } finally {
      setIsExporting(null);
      setMenuPos(null);
    }
  };

  const handleCopySvg = async () => {
    const markup = buildStandaloneSvgMarkup({ pixelSize: 512 });
    if (!markup) return;
    try {
      await navigator.clipboard.writeText(markup);
      setCopiedSvg(true);
      setTimeout(() => {
        setCopiedSvg(false);
        setMenuPos(null);
      }, 900);
    } catch {
      setMenuPos(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableContextMenu) return;
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 264;
    const menuHeight = 232;
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);

    setCopiedSvg(false);
    setMenuPos({
      x: Math.min(Math.max(margin, e.clientX), maxX),
      y: Math.min(Math.max(margin, e.clientY), maxY),
    });
  };

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        style={{ width: size, height: size }}
        title={
          disableContextMenu
            ? undefined
            : pickActiveLang(
                'Nhấn chuột phải để tải biểu tượng ClSend',
                'Right-click to download ClSend icon',
                '右键点击下载 ClSend 图标'
              )
        }
        className={`relative group flex items-center justify-center rounded-2xl select-none shrink-0 isolate overflow-hidden ${className}`}
      >
        {/* 1. Vòng hào quang đa sắc phía sau (Glow Aura) */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 blur-sm opacity-50 group-hover:opacity-90 group-hover:blur-md transition-all duration-300 pointer-events-none" />

        {/* 2. Thân Vector SVG Sắc Nét 100% không bị vỡ ảnh ở mọi kích thước */}
        <svg
          ref={svgRef}
          viewBox="0 0 64 64"
          className="w-full h-full relative z-10 transition-transform duration-300 group-hover:scale-105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Nền Gradient ngọc lục bảo và lam ngọc */}
            <linearGradient id={ids.bg} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="45%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>

            {/* Dải sáng phản chiếu lụa (Silk Sheen) */}
            <linearGradient id={ids.silk} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="70%" stopColor="#34d399" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
            </linearGradient>

            {/* Gradient Cánh Máy Bay Thân Phải */}
            <linearGradient id={ids.wingMain} x1="16" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#ccfbf1" />
            </linearGradient>

            {/* Gradient Cánh Gấp Phản Quang 3D */}
            <linearGradient id={ids.wingDepth} x1="26" y1="36" x2="42" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#99f6e4" />
              <stop offset="50%" stopColor="#5eead4" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>

            {/* Gradient Cạnh Dưới Đậm */}
            <linearGradient id={ids.wingShadow} x1="24" y1="38" x2="32" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#115e59" />
            </linearGradient>

            {/* Bóng đổ cánh */}
            <filter id={ids.planeShadow} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#022c22" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Khối nền bo góc mềm mại */}
          <rect width="64" height="64" rx="18" fill={`url(#${ids.bg})`} />

          {/* Đường viền ánh kim cyber mạ bạc */}
          <rect
            x="0.75"
            y="0.75"
            width="62.5"
            height="62.5"
            rx="17.25"
            stroke="#ffffff"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />

          {/* Vệt ánh sáng lụa uốn lượn chéo góc */}
          <path d="M-8 26 Q32 10 72 38 L72 0 L-8 0 Z" fill={`url(#${ids.silk})`} opacity="0.6" />

          {/* Vòm Đám Mây Mạ Bạc Tinh Tế ở Chân Logo */}
          <path
            d="M12 49 C14 43 21 42 24 46 C27 42 37 42 40 47 C43 44 50 45 52 50 C52 51 48 54 44 54 L18 54 C14 54 11 51 12 49 Z"
            fill="#ffffff"
            fillOpacity="0.16"
          />

          {/* Biểu tượng Máy Bay Truyền Tệp Tốc Độ Cao 3D Origami */}
          <g filter={`url(#${ids.planeShadow})`}>
            {/* Thân Cánh Chính Bay Vút */}
            <path
              d="M51 13 L17 32.5 C15.4 33.3 15.6 35.4 17.2 36 L28 40 L44 23 L32 41.5 L36 49.5 C36.8 51 38.8 50.8 39.5 49.2 L52.8 15.2 C53.4 13.8 52.2 12.5 51 13 Z"
              fill={`url(#${ids.wingMain})`}
            />

            {/* Nếp Gấp Mặt Trong Tạo Độ Nổi Khối */}
            <path d="M28 40 L44 23 L32 41.5 Z" fill={`url(#${ids.wingDepth})`} opacity="0.9" />

            {/* Nếp Đuôi Cánh Thấp */}
            <path
              d="M28 40 L32 41.5 L30 47 C29.5 48 28.2 47.8 28 46.8 L28 40 Z"
              fill={`url(#${ids.wingShadow})`}
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

      {menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{ top: menuPos.y, left: menuPos.x, width: 264 }}
            className="fixed z-[9999] rounded-2xl border border-emerald-500/30 bg-slate-950/95 p-1.5 text-slate-100 shadow-2xl shadow-black/70 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-white/10 mb-1">
              <CloudSendLogo size={24} className="w-6 h-6 rounded-lg" disableContextMenu />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {pickActiveLang('Tải Biểu Tượng ClSend', 'Download ClSend Icon', '下载 ClSend 图标')}
                </div>
                <div className="text-[10px] text-emerald-400/90">
                  {pickActiveLang('Bộ nhận diện chất lượng cao', 'High-res Brand Asset', '高清品牌图标')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadPng(false, 1024)}
              disabled={isExporting !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium text-slate-100 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 truncate">
                {pickActiveLang('Tải PNG (1024×1024 Bo góc)', 'Download PNG (1024×1024)', '下载 PNG (1024×1024 圆角)')}
              </span>
              <Download className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPng(true, 1024)}
              disabled={isExporting !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium text-slate-100 hover:bg-teal-500/15 hover:text-teal-300 transition-colors disabled:opacity-50"
            >
              <Square className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="flex-1 truncate">
                {pickActiveLang('Tải PNG Vuông (1024×1024)', 'Download Square PNG (1024px)', '下载方形 PNG (1024×1024)')}
              </span>
              <Download className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={isExporting !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium text-slate-100 hover:bg-cyan-500/15 hover:text-cyan-300 transition-colors disabled:opacity-50"
            >
              <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="flex-1 truncate">
                {pickActiveLang('Tải SVG (Vector gốc)', 'Download SVG (Vector)', '下载 SVG (矢量原图)')}
              </span>
              <Download className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            <div className="my-1 border-t border-white/10" />

            <button
              type="button"
              onClick={handleCopySvg}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
            >
              {copiedSvg ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="flex-1 truncate">
                {copiedSvg
                  ? pickActiveLang('Đã sao chép mã SVG!', 'Copied SVG code!', '已复制 SVG 代码！')
                  : pickActiveLang('Sao chép mã SVG', 'Copy SVG markup', '复制 SVG 代码')}
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
