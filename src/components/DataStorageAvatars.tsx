import React, { useState, useRef } from 'react';
import { 
  Download, 
  Image as ImageIcon, 
  FileText, 
  Video, 
  Music, 
  Sparkles, 
  Check, 
  ExternalLink, 
  Copy, 
  Database,
  Layers,
  X,
  ShieldCheck,
  Radio
} from 'lucide-react';

export interface StorageFacilityAvatar {
  id: 'photos' | 'docs' | 'video' | 'audio';
  name: string;
  channel: string;
  title: string;
  subtitle: string;
  accentColor: string;
  badgeType: 'image' | 'document' | 'video' | 'audio';
  themeClass: string;
  botNames: string[];
}

export const STORAGE_FACILITIES: StorageFacilityAvatar[] = [
  {
    id: 'photos',
    name: 'Cơ Sở Hình Ảnh (Photos)',
    channel: '@CLSSImages',
    title: 'CLSend • Hình Ảnh',
    subtitle: 'Chuyên trách hình ảnh, album ảnh gốc & đồ họa',
    accentColor: '#10b981',
    badgeType: 'image',
    themeClass: 'from-emerald-500 via-teal-500 to-cyan-500',
    botNames: ['Bot 01', 'Bot 02', 'Bot 03', 'Bot 04', 'Bot 05']
  },
  {
    id: 'docs',
    name: 'Cơ Sở Tệp & Tài Liệu (Docs)',
    channel: '@ClsendStorage',
    title: 'CLSend • Tệp & Tài Liệu',
    subtitle: 'Chuyên trách tệp nén, PDF, Word, Excel, mã nguồn & file dữ liệu',
    accentColor: '#f59e0b',
    badgeType: 'document',
    themeClass: 'from-amber-500 via-orange-500 to-yellow-500',
    botNames: ['Bot 01', 'Bot 02', 'Bot 03', 'Bot 04', 'Bot 05']
  },
  {
    id: 'video',
    name: 'Cơ Sở Video & Phim (Media)',
    channel: '@CLSSVideo',
    title: 'CLSend • Video Media',
    subtitle: 'Chuyên trách video clip, phim HD, quay màn hình & animation',
    accentColor: '#f43f5e',
    badgeType: 'video',
    themeClass: 'from-rose-500 via-pink-500 to-purple-600',
    botNames: ['Bot 01', 'Bot 02', 'Bot 03', 'Bot 04', 'Bot 05']
  },
  {
    id: 'audio',
    name: 'Cơ Sở Âm Thanh (Audio)',
    channel: '@CLSSSound',
    title: 'CLSend • Âm Thanh',
    subtitle: 'Chuyên trách bản thu âm thanh, nhạc chuông, podcast & lossless FLAC/MP3',
    accentColor: '#8b5cf6',
    badgeType: 'audio',
    themeClass: 'from-violet-500 via-indigo-500 to-sky-500',
    botNames: ['Bot 01', 'Bot 02', 'Bot 03', 'Bot 04', 'Bot 05']
  }
];

/**
 * Hàm sinh chuỗi SVG chuẩn sắc nét 512x512 cho từng Cơ Sở Dữ Liệu
 */
export function generateFacilitySvgString(facility: StorageFacilityAvatar): string {
  const { id } = facility;

  // Cấu hình màu sắc đặc trưng
  let gradDef = '';
  let mainGraphic = '';
  let badgeGraphic = '';

  if (id === 'photos') {
    gradDef = `
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#022c22" />
        <stop offset="35%" stop-color="#064e3b" />
        <stop offset="70%" stop-color="#0f766e" />
        <stop offset="100%" stop-color="#083344" />
      </linearGradient>
      <linearGradient id="glow-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#34d399" stop-opacity="0.8" />
        <stop offset="50%" stop-color="#14b8a6" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="plate-${id}" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="50%" stop-color="#14b8a6" />
        <stop offset="100%" stop-color="#06b6d4" />
      </linearGradient>
    `;

    // Biểu tượng Máy Ảnh & Cảnh Quan Cực Đẹp ở Trung Tâm
    mainGraphic = `
      <!-- Hexagon / Shield Frame -->
      <g filter="url(#drop-shadow)">
        <rect x="116" y="130" width="280" height="230" rx="36" fill="#042f2e" stroke="url(#plate-${id})" stroke-width="6" />
        <!-- Top Flash / Viewfinder bump -->
        <path d="M210 130 L226 100 L286 100 L302 130 Z" fill="#0f766e" stroke="url(#plate-${id})" stroke-width="5" />
        <circle cx="340" cy="165" r="14" fill="#34d399" opacity="0.9" filter="url(#inner-glow)" />
        
        <!-- Big Aperture Lens with reflections -->
        <circle cx="256" cy="245" r="76" fill="#021f1d" stroke="#14b8a6" stroke-width="7" />
        <circle cx="256" cy="245" r="62" fill="#042f2e" stroke="#34d399" stroke-width="3" stroke-dasharray="14 8" />
        <circle cx="256" cy="245" r="46" fill="url(#plate-${id})" opacity="0.9" />
        
        <!-- Mountain & Sun inside lens -->
        <path d="M224 266 L242 242 L256 256 L276 230 L292 266 Z" fill="#ffffff" opacity="0.95" />
        <circle cx="240" cy="225" r="8" fill="#fef08a" />
        
        <!-- Speed Beam -->
        <path d="M140 180 Q256 160 372 180" stroke="#a7f3d0" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round" />
      </g>
    `;

    // Góc dưới: Custom-drawn Photo Badge với hình ảnh thu nhỏ
    badgeGraphic = `
      <!-- Corner Badge Container -->
      <g transform="translate(320, 320)" filter="url(#badge-shadow)">
        <circle cx="75" cy="75" r="68" fill="#022c22" stroke="#10b981" stroke-width="6" />
        <circle cx="75" cy="75" r="56" fill="url(#plate-${id})" />
        
        <!-- Photo Frame Icon -->
        <g transform="translate(42, 42)">
          <rect x="6" y="8" width="54" height="46" rx="8" fill="#042f2e" stroke="#ffffff" stroke-width="4" />
          <circle cx="20" cy="20" r="5" fill="#fef08a" />
          <path d="M12 46 L24 32 L34 40 L44 28 L54 46 Z" fill="#ffffff" />
        </g>
      </g>
    `;
  } else if (id === 'docs') {
    gradDef = `
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#451a03" />
        <stop offset="35%" stop-color="#78350f" />
        <stop offset="70%" stop-color="#9a3412" />
        <stop offset="100%" stop-color="#1c1917" />
      </linearGradient>
      <linearGradient id="glow-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8" />
        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#ea580c" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="plate-${id}" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="50%" stop-color="#ea580c" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
    `;

    // Biểu tượng Tệp Tin & Kho Lưu Trữ ở Trung Tâm
    mainGraphic = `
      <g filter="url(#drop-shadow)">
        <!-- Stacked Back Document Sheet -->
        <rect x="180" y="96" width="170" height="230" rx="20" fill="#78350f" stroke="#fbbf24" stroke-width="4" opacity="0.7" transform="rotate(8 265 211)" />
        
        <!-- Main Front Document Sheet -->
        <rect x="146" y="116" width="190" height="246" rx="24" fill="#291403" stroke="url(#plate-${id})" stroke-width="6" />
        
        <!-- Folded Corner at top-right -->
        <path d="M286 116 L336 166 L286 166 Z" fill="#f59e0b" />
        <path d="M286 116 L286 166 L336 166" stroke="#fbbf24" stroke-width="4" fill="none" />
        
        <!-- Data lines -->
        <rect x="176" y="190" width="120" height="12" rx="6" fill="#fbbf24" opacity="0.9" />
        <rect x="176" y="218" width="140" height="10" rx="5" fill="#fde68a" opacity="0.75" />
        <rect x="176" y="242" width="130" height="10" rx="5" fill="#fde68a" opacity="0.75" />
        <rect x="176" y="266" width="90" height="10" rx="5" fill="#f59e0b" opacity="0.8" />
        <rect x="176" y="294" width="135" height="14" rx="7" fill="url(#plate-${id})" />
        
        <!-- Hologram Chip Emblem -->
        <rect x="250" y="318" width="56" height="22" rx="6" fill="#451a03" stroke="#fbbf24" stroke-width="2" />
        <circle cx="266" cy="329" r="4" fill="#22c55e" />
        <circle cx="282" cy="329" r="4" fill="#3b82f6" />
      </g>
    `;

    // Góc dưới: Custom-drawn File / Document Badge
    badgeGraphic = `
      <g transform="translate(320, 320)" filter="url(#badge-shadow)">
        <circle cx="75" cy="75" r="68" fill="#451a03" stroke="#f59e0b" stroke-width="6" />
        <circle cx="75" cy="75" r="56" fill="url(#plate-${id})" />
        
        <!-- Document Sheet Badge Icon -->
        <g transform="translate(42, 42)">
          <path d="M12 6 L42 6 L54 18 L54 58 L12 58 Z" fill="#291403" stroke="#ffffff" stroke-width="4" />
          <path d="M42 6 L42 18 L54 18" stroke="#ffffff" stroke-width="3" fill="#fbbf24" />
          <line x1="20" y1="26" x2="38" y2="26" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
          <line x1="20" y1="36" x2="46" y2="36" stroke="#fde68a" stroke-width="3" stroke-linecap="round" />
          <line x1="20" y1="46" x2="40" y2="46" stroke="#fde68a" stroke-width="3" stroke-linecap="round" />
        </g>
      </g>
    `;
  } else if (id === 'video') {
    gradDef = `
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#4c0519" />
        <stop offset="35%" stop-color="#881337" />
        <stop offset="70%" stop-color="#4c1d95" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <linearGradient id="glow-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.8" />
        <stop offset="50%" stop-color="#ec4899" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="plate-${id}" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f43f5e" />
        <stop offset="50%" stop-color="#ec4899" />
        <stop offset="100%" stop-color="#a855f7" />
      </linearGradient>
    `;

    // Biểu tượng Điện Ảnh & Camera Siêu Tốc ở Trung Tâm
    mainGraphic = `
      <g filter="url(#drop-shadow)">
        <!-- Cinema Filmstrip Base -->
        <rect x="110" y="140" width="292" height="210" rx="32" fill="#1e050f" stroke="url(#plate-${id})" stroke-width="6" />
        
        <!-- Film strip holes on top & bottom -->
        <g fill="#f43f5e" opacity="0.85">
          <rect x="130" y="152" width="20" height="14" rx="3" />
          <rect x="165" y="152" width="20" height="14" rx="3" />
          <rect x="200" y="152" width="20" height="14" rx="3" />
          <rect x="235" y="152" width="20" height="14" rx="3" />
          <rect x="270" y="152" width="20" height="14" rx="3" />
          <rect x="305" y="152" width="20" height="14" rx="3" />
          <rect x="340" y="152" width="20" height="14" rx="3" />
          
          <rect x="130" y="324" width="20" height="14" rx="3" />
          <rect x="165" y="324" width="20" height="14" rx="3" />
          <rect x="200" y="324" width="20" height="14" rx="3" />
          <rect x="235" y="324" width="20" height="14" rx="3" />
          <rect x="270" y="324" width="20" height="14" rx="3" />
          <rect x="305" y="324" width="20" height="14" rx="3" />
          <rect x="340" y="324" width="20" height="14" rx="3" />
        </g>
        
        <!-- Center Play Button with Glowing Rings -->
        <circle cx="256" cy="245" r="58" fill="#4c0519" stroke="#f43f5e" stroke-width="5" />
        <circle cx="256" cy="245" r="48" fill="url(#plate-${id})" />
        <!-- Play Triangle -->
        <polygon points="244,222 280,245 244,268" fill="#ffffff" filter="url(#inner-glow)" />
        
        <!-- Neon Cinema Rays -->
        <circle cx="256" cy="245" r="74" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="10 12" opacity="0.6" />
      </g>
    `;

    // Góc dưới: Custom-drawn Video Badge (Clapperboard & Play)
    badgeGraphic = `
      <g transform="translate(320, 320)" filter="url(#badge-shadow)">
        <circle cx="75" cy="75" r="68" fill="#4c0519" stroke="#f43f5e" stroke-width="6" />
        <circle cx="75" cy="75" r="56" fill="url(#plate-${id})" />
        
        <!-- Video Clapperboard Badge Icon -->
        <g transform="translate(42, 42)">
          <rect x="8" y="16" width="50" height="42" rx="6" fill="#1e050f" stroke="#ffffff" stroke-width="4" />
          <!-- Striped Header -->
          <rect x="8" y="10" width="50" height="14" rx="4" fill="#f43f5e" stroke="#ffffff" stroke-width="3" />
          <path d="M16 10 L24 24 M30 10 L38 24 M44 10 L52 24" stroke="#ffffff" stroke-width="3.5" />
          <!-- Small Play Triangle inside -->
          <polygon points="28,28 44,38 28,48" fill="#ffffff" />
        </g>
      </g>
    `;
  } else if (id === 'audio') {
    gradDef = `
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#1e1b4b" />
        <stop offset="35%" stop-color="#312e81" />
        <stop offset="70%" stop-color="#4338ca" />
        <stop offset="100%" stop-color="#082f49" />
      </linearGradient>
      <linearGradient id="glow-${id}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#818cf8" stop-opacity="0.8" />
        <stop offset="50%" stop-color="#6366f1" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="plate-${id}" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="50%" stop-color="#8b5cf6" />
        <stop offset="100%" stop-color="#38bdf8" />
      </linearGradient>
    `;

    // Biểu tượng Đĩa Vinyl & Sóng Âm Thanh ở Trung Tâm
    mainGraphic = `
      <g filter="url(#drop-shadow)">
        <!-- Vinyl Record Disc -->
        <circle cx="256" cy="245" r="110" fill="#0f0e26" stroke="url(#plate-${id})" stroke-width="7" />
        <!-- Groove concentric circles -->
        <circle cx="256" cy="245" r="94" fill="none" stroke="#4338ca" stroke-width="2" opacity="0.6" />
        <circle cx="256" cy="245" r="82" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.4" />
        <circle cx="256" cy="245" r="70" fill="none" stroke="#818cf8" stroke-width="2" opacity="0.6" />
        
        <!-- Vinyl Center Label -->
        <circle cx="256" cy="245" r="46" fill="url(#plate-${id})" />
        <circle cx="256" cy="245" r="14" fill="#0f0e26" stroke="#ffffff" stroke-width="3" />
        
        <!-- Pulsing Equalizer Sound Waves around -->
        <g stroke="#38bdf8" stroke-width="5" stroke-linecap="round">
          <line x1="116" y1="245" x2="116" y2="245" stroke-width="8" stroke="#818cf8" />
          <line x1="90" y1="230" x2="90" y2="260" />
          <line x1="72" y1="210" x2="72" y2="280" />
          <line x1="396" y1="245" x2="396" y2="245" stroke-width="8" stroke="#818cf8" />
          <line x1="422" y1="230" x2="422" y2="260" />
          <line x1="440" y1="210" x2="440" y2="280" />
        </g>
        
        <!-- Sonic Beams / Musical Wave -->
        <path d="M190 150 Q256 120 322 150" stroke="#a5b4fc" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round" />
        <path d="M180 340 Q256 370 332 340" stroke="#38bdf8" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round" />
      </g>
    `;

    // Góc dưới: Custom-drawn Audio Badge (Musical Note & Headphone)
    badgeGraphic = `
      <g transform="translate(320, 320)" filter="url(#badge-shadow)">
        <circle cx="75" cy="75" r="68" fill="#1e1b4b" stroke="#818cf8" stroke-width="6" />
        <circle cx="75" cy="75" r="56" fill="url(#plate-${id})" />
        
        <!-- Audio Musical Double Note Badge Icon -->
        <g transform="translate(42, 42)">
          <!-- Beamed eighth note -->
          <ellipse cx="22" cy="46" rx="8" ry="6" fill="#ffffff" transform="rotate(-20 22 46)" />
          <ellipse cx="46" cy="40" rx="8" ry="6" fill="#ffffff" transform="rotate(-20 46 40)" />
          <line x1="28" y1="44" x2="28" y2="16" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" />
          <line x1="52" y1="38" x2="52" y2="10" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" />
          <polygon points="28,16 52,10 52,18 28,24" fill="#ffffff" />
        </g>
      </g>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    ${gradDef}
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.65" />
    </filter>
    <filter id="badge-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.8" />
    </filter>
    <filter id="inner-glow">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <radialGradient id="cyber-grid" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Base Canvas with Circular Crop / Shield -->
  <rect width="512" height="512" rx="128" fill="url(#bg-${id})" />
  
  <!-- Outer Cyber Glowing Rim -->
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="url(#glow-${id})" stroke-width="6" opacity="0.8" />
  
  <!-- Subtle Circular Mesh / Grid overlay -->
  <circle cx="256" cy="256" r="230" fill="url(#cyber-grid)" />
  <circle cx="256" cy="256" r="210" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8 12" opacity="0.25" />

  <!-- Cloud Infrastructure Arc at Top -->
  <g opacity="0.2" fill="#ffffff">
    <path d="M160 84 C180 60 230 60 256 76 C280 60 330 60 352 84 C380 90 396 120 380 144 L132 144 C116 120 132 90 160 84 Z" />
  </g>

  <!-- Brand Typography Header in Avatar -->
  <text x="256" y="78" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="4" text-anchor="middle" opacity="0.95">
    CLSEND CLUSTER
  </text>
  <text x="256" y="104" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="${facility.accentColor}" letter-spacing="2" text-anchor="middle" opacity="0.9">
    ${facility.channel.toUpperCase()}
  </text>

  <!-- Main Center Artwork Specific to Facility -->
  ${mainGraphic}

  <!-- Bottom Brand Title -->
  <text x="256" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="800" fill="#ffffff" letter-spacing="1" text-anchor="middle" filter="url(#drop-shadow)">
    ${facility.title}
  </text>
  <text x="256" y="468" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#94a3b8" letter-spacing="0.5" text-anchor="middle">
    5 BOTS CLUSTER • DATASTORE RELAY
  </text>

  <!-- Bottom-Right Custom Badge (Hình ảnh, Tệp, Video, Âm thanh vẽ riêng) -->
  ${badgeGraphic}
</svg>`;
}

/**
 * Sinh chuỗi SVG đã lược bỏ filter để vẽ canvas chuẩn 100% không lỗi
 */
export function generatePngSvgString(facility: StorageFacilityAvatar): string {
  let svg = generateFacilitySvgString(facility);
  svg = svg.replace(/<filter[\s\S]*?<\/filter>/gi, '');
  svg = svg.replace(/\sfilter="url\(#.*?\)"/gi, '');
  return svg;
}

/**
 * Tải file SVG về máy người dùng
 */
export function downloadFacilitySvg(facility: StorageFacilityAvatar) {
  const svgContent = generateFacilitySvgString(facility);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Avatar_${facility.id}_${facility.channel.replace('@', '')}_512x512.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Xuất và tải ảnh PNG 512x512 sắc nét cho Telegram Avatar bằng Canvas 2D trực tiếp (100% không lỗi)
 */
export async function downloadFacilityPng(facility: StorageFacilityAvatar): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const { id, accentColor, title, channel } = facility;

  // 1. Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  if (id === 'photos') {
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.35, '#064e3b');
    grad.addColorStop(0.7, '#0f766e');
    grad.addColorStop(1, '#083344');
  } else if (id === 'docs') {
    grad.addColorStop(0, '#451a03');
    grad.addColorStop(0.35, '#78350f');
    grad.addColorStop(0.7, '#9a3412');
    grad.addColorStop(1, '#1c1917');
  } else if (id === 'video') {
    grad.addColorStop(0, '#4c0519');
    grad.addColorStop(0.35, '#881337');
    grad.addColorStop(0.7, '#4c1d95');
    grad.addColorStop(1, '#0f172a');
  } else {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.35, '#312e81');
    grad.addColorStop(0.7, '#4338ca');
    grad.addColorStop(1, '#082f49');
  }

  // Rounded background rect
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, 0, 0, 512, 512, 128);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer rim
  ctx.lineWidth = 6;
  ctx.strokeStyle = accentColor;
  ctx.globalAlpha = 0.8;
  roundRect(ctx, 8, 8, 496, 496, 120);
  ctx.stroke();
  ctx.restore();

  // Header texts
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('CLSEND CLUSTER', 256, 78);

  ctx.fillStyle = accentColor;
  ctx.font = '700 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(channel.toUpperCase(), 256, 104);

  // Center artwork
  if (id === 'photos') {
    ctx.fillStyle = '#042f2e';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    roundRect(ctx, 116, 130, 280, 230, 36);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(210, 130);
    ctx.lineTo(226, 100);
    ctx.lineTo(286, 100);
    ctx.lineTo(302, 130);
    ctx.closePath();
    ctx.fillStyle = '#0f766e';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(256, 245, 76, 0, Math.PI * 2);
    ctx.fillStyle = '#021f1d';
    ctx.fill();
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(256, 245, 46, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(224, 266);
    ctx.lineTo(242, 242);
    ctx.lineTo(256, 256);
    ctx.lineTo(276, 230);
    ctx.lineTo(292, 266);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(240, 225, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  } else if (id === 'docs') {
    ctx.save();
    ctx.translate(256, 211);
    ctx.rotate((8 * Math.PI) / 180);
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    roundRect(ctx, -85, -115, 170, 230, 20);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#291403';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    roundRect(ctx, 146, 116, 190, 246, 24);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(286, 116);
    ctx.lineTo(336, 166);
    ctx.lineTo(286, 166);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    roundRect(ctx, 176, 190, 120, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    roundRect(ctx, 176, 218, 140, 10, 5);
    ctx.fill();
    roundRect(ctx, 176, 242, 130, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, 176, 266, 90, 10, 5);
    ctx.fill();
    ctx.fillStyle = accentColor;
    roundRect(ctx, 176, 294, 135, 14, 7);
    ctx.fill();
  } else if (id === 'video') {
    ctx.fillStyle = '#1e050f';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    roundRect(ctx, 110, 140, 292, 210, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    const holeX = [130, 165, 200, 235, 270, 305, 340];
    holeX.forEach(hx => {
      roundRect(ctx, hx, 152, 20, 14, 3);
      ctx.fill();
      roundRect(ctx, hx, 324, 20, 14, 3);
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(256, 245, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#4c0519';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(256, 245, 48, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(244, 222);
    ctx.lineTo(280, 245);
    ctx.lineTo(244, 268);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(256, 245, 110, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0e26';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4338ca';
    ctx.beginPath(); ctx.arc(256, 245, 94, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#6366f1';
    ctx.beginPath(); ctx.arc(256, 245, 82, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#818cf8';
    ctx.beginPath(); ctx.arc(256, 245, 70, 0, Math.PI * 2); ctx.stroke();

    ctx.beginPath();
    ctx.arc(256, 245, 46, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(256, 245, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0e26';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(90, 230); ctx.lineTo(90, 260);
    ctx.moveTo(72, 210); ctx.lineTo(72, 280);
    ctx.moveTo(422, 230); ctx.lineTo(422, 260);
    ctx.moveTo(440, 210); ctx.lineTo(440, 280);
    ctx.stroke();
  }

  // Bottom brand title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, 256, 440);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('5 BOTS CLUSTER • DATASTORE RELAY', 256, 468);
  ctx.restore();

  // Bottom-right badge circle
  ctx.save();
  ctx.translate(395, 395);
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = id === 'photos' ? '#022c22' : id === 'docs' ? '#451a03' : id === 'video' ? '#4c0519' : '#1e1b4b';
  ctx.stroke();
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate PNG blob'));
        return;
      }
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `Avatar_${facility.id}_${facility.channel.replace('@', '')}_512x512.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
      resolve();
    }, 'image/png');
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Thẻ hiển thị một Avatar cơ sở dữ liệu với nút tải PNG 512 và SVG
 */
export const FacilityAvatarCard: React.FC<{
  facility: StorageFacilityAvatar;
  isCompact?: boolean;
}> = ({ facility, isCompact = false }) => {
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [copiedChannel, setCopiedChannel] = useState(false);

  const handleCopyChannel = () => {
    navigator.clipboard.writeText(facility.channel);
    setCopiedChannel(true);
    setTimeout(() => setCopiedChannel(false), 2000);
  };

  const handleDownloadPng = async () => {
    setDownloadingPng(true);
    try {
      await downloadFacilityPng(facility);
    } catch (e) {
      console.error('Error downloading PNG:', e);
      alert('Không thể tạo ảnh PNG 512px. Vui lòng thử lại.');
    } finally {
      setDownloadingPng(false);
    }
  };

  const getBadgeIcon = () => {
    switch (facility.badgeType) {
      case 'image': return <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      case 'video': return <Video className="w-3.5 h-3.5 text-rose-400" />;
      case 'audio': return <Music className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col justify-between gap-3 shadow-lg hover:border-slate-700 transition-all group">
      {/* Visual Avatar Preview */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-white/10 group-hover:scale-[1.02] transition-transform shadow-inner [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain">
        <div 
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: generateFacilitySvgString(facility) }}
        />
        
        {/* Hover quick badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white flex items-center gap-1 shadow-md">
          {getBadgeIcon()}
          <span>{facility.channel}</span>
        </div>
      </div>

      {/* Info details */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-white truncate">{facility.name}</h4>
          <span 
            className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-md font-bold"
            style={{ 
              backgroundColor: `${facility.accentColor}20`,
              color: facility.accentColor,
              border: `1px solid ${facility.accentColor}40`
            }}
          >
            5 Bots
          </span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-snug line-clamp-2">
          {facility.subtitle}
        </p>
      </div>

      {/* Download action buttons */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloadingPng}
            title="Tải ảnh PNG 512x512 độ phân giải cao chuẩn Telegram"
            className="px-2 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            <span>{downloadingPng ? 'Đang tạo...' : 'PNG 512px'}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadFacilitySvg(facility)}
            title="Tải file vector SVG gốc cực nét"
            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>SVG Vector</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleCopyChannel}
            className="px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white text-[10px] font-mono flex items-center justify-center gap-1 border border-slate-800 transition-colors cursor-pointer"
          >
            {copiedChannel ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedChannel ? 'Đã chép' : facility.channel}</span>
          </button>

          <a
            href={
              facility.id === 'photos' ? 'https://t.me/CLSSImages' :
              facility.id === 'docs' ? 'https://t.me/ClsendStorage' :
              facility.id === 'video' ? 'https://t.me/CLSSVideo' : 'https://t.me/CLSSSound'
            }
            target="_blank"
            rel="noopener noreferrer"
            title={`Mở kênh ${facility.channel} trên Telegram`}
            className="px-2 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 hover:text-sky-200 text-[10px] font-semibold flex items-center justify-center gap-1 border border-sky-500/30 transition-all cursor-pointer"
          >
            <ExternalLink className="w-3 h-3 text-sky-400" />
            <span>Mở Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal Showcase mở trực tiếp từ bên cạnh DataStorage
 */
export const DataStorageAvatarsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [downloadingAll, setDownloadingAll] = useState(false);

  if (!isOpen) return null;

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    for (const fac of STORAGE_FACILITIES) {
      try {
        await downloadFacilityPng(fac);
        // Nhẹ nhàng delay để trình duyệt không chặn pop-up download
        await new Promise(r => setTimeout(r, 450));
      } catch (e) {
        console.error('Error downloading batch:', e);
      }
    }
    setDownloadingAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Kho Ảnh Đại Diện 4 Cơ Sở Dữ Liệu DataStorage
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Dev Certified
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Thiết kế riêng cho 4 kênh Telegram (Hình ảnh, Tệp, Video, Âm thanh) kèm icon vẽ riêng ở góc dưới để dễ phân biệt
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Ảnh xuất ra chuẩn <strong>512x512 PNG</strong> (kích thước vàng làm avatar Channel & Bot Telegram)</span>
          </div>

          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingAll ? 'Đang tải lần lượt...' : 'Tải trọn bộ 4 Avatar (PNG 512px)'}</span>
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-140px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STORAGE_FACILITIES.map((facility) => (
              <FacilityAvatarCard key={facility.id} facility={facility} />
            ))}
          </div>

          {/* Guide note */}
          <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Hướng dẫn gán Avatar lên Telegram</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Nhấn <strong>PNG 512px</strong> ở từng ô để tải ảnh đại diện tương ứng về máy tính hoặc điện thoại.</li>
              <li>Mở Telegram &rarr; Vào Channel tương ứng (<code className="text-emerald-300">@Clsend_Photos</code>, <code className="text-amber-300">@Clsend_Docs</code>, <code className="text-rose-300">@Clsend_Video</code>, <code className="text-indigo-300">@Clsend_Audio</code>).</li>
              <li>Nhấn <strong>Edit Channel &rarr; Set Photo</strong> và chọn ảnh vừa tải về để đồng bộ nhận diện thương hiệu.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
