import { DeviceType } from '../types';
import { LanguageCode, pickLang, pickActiveLang } from '../context/LanguageContext';

export function isSmartTv(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isTvUA = /(smart-tv|smarttv|googletv|appletv|android tv|hbbtv|pov_tv|netcast|webos|web0s|tizen|viera|bravia|sonydtv|roku|firetv|aftt|aftm|aftb|afts|hisense|philipstv|toshibatv|mi tv|mitv|tcl|crkey|chromecast|large-screen|\btv\b|lgbrowser|lg browser|lg-smarttv|webappmanager)/i.test(ua);
  
  const isTvQuery = new URLSearchParams(window.location.search).get('tv') === '1' || 
                    new URLSearchParams(window.location.search).get('tv') === 'true' ||
                    new URLSearchParams(window.location.search).get('mode') === 'tv';

  if (isTvUA || isTvQuery) {
    try {
      localStorage.setItem('cloudsend_tv_mode', 'true');
    } catch {}
    return true;
  }

  // If not a TV, clean up any erroneous legacy flag
  try {
    localStorage.removeItem('cloudsend_tv_mode');
  } catch {}

  return false;
}

export function getRecommendedTvDpi(): number {
  if (typeof window === 'undefined') return 1.4;
  const width = typeof window.screen !== 'undefined' ? window.screen.width : window.innerWidth;
  // For 4K TV (width >= 2560), recommended zoom is 1.75
  if (width >= 2560) return 1.75;
  // For standard Full HD 1080p TV (1920x1080), recommended zoom is 1.4 - 1.5
  if (width >= 1800) return 1.4;
  // For 720p or smaller TV
  return 1.25;
}

export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenW = typeof window.screen !== 'undefined' ? window.screen.width : window.innerWidth;
  const screenH = typeof window.screen !== 'undefined' ? window.screen.height : window.innerHeight;
  const minDim = Math.min(screenW, screenH);
  const maxDim = Math.max(screenW, screenH);

  // 0. Smart TV Detection (Samsung Tizen, LG WebOS, Android TV, Google TV, Apple TV, Fire TV, Roku, Sony, etc.)
  if (isSmartTv()) {
    return 'tv';
  }

  // 1. Tablet Detection (iPad, Android Tablet, Kindle, etc.)
  const isTabletUA = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);
  const isIPadOS = /macintosh|mac os x/i.test(ua) && maxTouchPoints > 1;
  const isTabletDimensions = maxTouchPoints > 0 && minDim >= 600 && maxDim <= 1366;
  
  if (isTabletUA || isIPadOS || isTabletDimensions) {
    return 'tablet';
  }

  // 2. Mobile Smartphone Detection
  const isMobileUA = /mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(ua);
  const isMobileDimensions = maxTouchPoints > 0 && minDim < 600;
  
  if (isMobileUA || isMobileDimensions) {
    return 'mobile';
  }

  // 3. Laptop vs Desktop
  // MacBooks / MacOS (since iPads are already caught above)
  if (/macintosh|mac os x/i.test(ua)) {
    return 'laptop';
  }

  // Laptops running Windows / Linux / ChromeOS:
  // Laptops usually have screens <= 1536px (13" to 15.6") or devicePixelRatio >= 1.25 (typical 125%-150% scaling)
  // or battery API present
  const isLikelyLaptopScreen = (maxDim <= 1600 && window.devicePixelRatio >= 1.2) || 
                               (window.innerWidth <= 1536 && maxTouchPoints <= 1);
  if (isLikelyLaptopScreen) {
    return 'laptop';
  }

  return 'desktop';
}

export function getDeviceTypeInfo(type: DeviceType, lang: LanguageCode | string = 'vi'): {
  type: DeviceType;
  label: string;
  subLabel: string;
  description: string;
} {
  const p = (vi: string, en: string, zh: string) => pickLang(lang, vi, en, zh);
  switch (type) {
    case 'mobile':
      return {
        type: 'mobile',
        label: p('Điện thoại (Mobile)', 'Mobile (Smartphone)', '手机 (Mobile)'),
        subLabel: p('Thiết bị di động thông minh', 'Smart mobile device', '智能移动设备'),
        description: p('Được tự động nhận diện theo phần cứng điện thoại', 'Auto-detected based on mobile phone hardware', '根据手机硬件自动识别')
      };
    case 'tablet':
      return {
        type: 'tablet',
        label: p('Máy tính bảng (Tablet)', 'Tablet (iPad / Pad)', '平板电脑 (Tablet)'),
        subLabel: p('Thiết bị màn hình phẳng', 'Flat-screen tablet device', '平板触控设备'),
        description: p('Được tự động nhận diện theo phần cứng iPad / Máy tính bảng', 'Auto-detected based on iPad / Tablet hardware', '根据 iPad / 平板硬件自动识别')
      };
    case 'laptop':
      return {
        type: 'laptop',
        label: p('Laptop (Máy tính xách tay)', 'Laptop (Notebook PC)', '笔记本电脑 (Laptop)'),
        subLabel: p('Máy tính xách tay', 'Portable laptop computer', '便携式笔记本电脑'),
        description: p('Được tự động nhận diện theo màn hình & phần cứng Laptop', 'Auto-detected based on laptop display & hardware', '根据笔记本屏幕与硬件自动识别')
      };
    case 'tv':
      return {
        type: 'tv',
        label: p('Smart TV (Truyền hình thông minh)', 'Smart TV (Living Room)', '智能电视 (Smart TV)'),
        subLabel: p('Tivi thông minh (Tizen / WebOS / Android TV)', 'Smart Television (Tizen / WebOS / Android TV)', '智能电视 (Tizen / WebOS / Android TV)'),
        description: p('Được tối ưu giao diện màn hình lớn, phóng to DPI chống mỏi mắt và tự động nhận file', 'Optimized for large TV display, high DPI and auto file reception', '已针对电视大屏优化显示、高 DPI 缩放与自动接收文件')
      };
    case 'desktop':
    default:
      return {
        type: 'desktop',
        label: p('PC (Máy tính để bàn)', 'PC (Desktop Computer)', '台式电脑 (PC)'),
        subLabel: p('Máy tính bàn cố định', 'Fixed desktop computer', '桌面固定电脑'),
        description: p('Được tự động nhận diện theo cấu hình máy tính để bàn', 'Auto-detected based on desktop computer configuration', '根据台式电脑配置自动识别')
      };
  }
}

export function generateDefaultDeviceName(type: DeviceType): string {
  const adjectives = [
    pickActiveLang('Bạc Hà', 'Mint', '薄荷'),
    pickActiveLang('Biển Xanh', 'Ocean', '碧海'),
    pickActiveLang('Hổ Phách', 'Amber', '琥珀'),
    pickActiveLang('Ngọc Bích', 'Jade', '翡翠'),
    pickActiveLang('Sao Băng', 'Meteor', '流星'),
    pickActiveLang('Tia Chớp', 'Spark', '闪电'),
    pickActiveLang('Bình Minh', 'Dawn', '晨曦'),
    pickActiveLang('Đêm Trăng', 'Moonlight', '月夜')
  ];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const typeMap: Record<DeviceType, string> = {
    laptop: 'Laptop',
    desktop: 'PC',
    mobile: pickActiveLang('Điện Thoại', 'Phone', '手机'),
    tablet: 'Tablet',
    tv: 'Smart TV'
  };
  return `${typeMap[type] || pickActiveLang('Thiết Bị', 'Device', '设备')} ${randomAdj}`;
}

export const AVATAR_COLORS = [
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#14B8A6', // Teal
];

export function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function detectBrowserInfo(): string {
  if (typeof window === 'undefined' || !navigator) return pickActiveLang('Thiết bị', 'Device', '设备');
  const ua = navigator.userAgent;
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenW = typeof window.screen !== 'undefined' ? window.screen.width : window.innerWidth;
  const screenH = typeof window.screen !== 'undefined' ? window.screen.height : window.innerHeight;
  const minDim = Math.min(screenW, screenH);

  // 1. Smart TV
  if (isSmartTv() || /tizen|web0s|smarttv|googletv|appletv/i.test(ua)) {
    return 'Smart TV';
  }

  // 2. iPad / Tablet
  if (/ipad/i.test(ua) || (/macintosh|mac os x/i.test(ua) && maxTouchPoints > 1) || (maxTouchPoints > 0 && minDim >= 600 && minDim <= 1024)) {
    return 'iPad';
  }

  // 3. iPhone
  if (/iphone|ipod/i.test(ua)) {
    return 'iPhone (Mobile)';
  }

  // 4. Android (Mobile vs Tablet)
  if (/android/i.test(ua)) {
    if (/mobile/i.test(ua) || minDim < 600) {
      return 'Android (Mobile)';
    }
    return 'Android Tablet';
  }

  // 5. Windows
  if (/windows nt 10\.0/i.test(ua)) {
    return 'Windows 10/11';
  }
  if (/windows/i.test(ua)) {
    return 'Windows';
  }

  // 6. MacBook / macOS
  if (/macintosh|mac os x/i.test(ua)) {
    return 'MacBook / macOS';
  }

  // 7. Linux
  if (/linux/i.test(ua)) {
    return 'Linux PC';
  }

  return pickActiveLang('Thiết bị', 'Device', '设备');
}

// Global cached location variable
let cachedSpecificLocation: string | null = typeof window !== 'undefined' ? localStorage.getItem('cloudsend_cached_location') : null;
let cachedDetailedLocation: DetailedLocation | null = typeof window !== 'undefined' ? (() => {
  try {
    const raw = localStorage.getItem('cloudsend_detailed_location');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})() : null;

export interface DetailedLocation {
  location: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  isGps?: boolean;
}

export async function fetchDetailedLocation(): Promise<DetailedLocation> {
  // Check cached
  if (cachedDetailedLocation && cachedDetailedLocation.latitude && cachedDetailedLocation.longitude) {
    return cachedDetailedLocation;
  }

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/auth/detect-location', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.location) {
        const detail: DetailedLocation = {
          location: data.location,
          latitude: typeof data.latitude === 'number' ? data.latitude : 12.6800,
          longitude: typeof data.longitude === 'number' ? data.longitude : 108.0383,
          city: data.city,
          region: data.region,
          country: data.country || pickActiveLang('Việt Nam', 'Vietnam', '越南'),
          isGps: false
        };
        cachedSpecificLocation = data.location;
        cachedDetailedLocation = detail;
        try {
          localStorage.setItem('cloudsend_cached_location', data.location);
          localStorage.setItem('cloudsend_detailed_location', JSON.stringify(detail));
        } catch {}
        return detail;
      }
    }
  } catch {}

  // 2. Try direct ipwho.is client-side
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const city = data.city || '';
        const region = data.region || '';
        const country = data.country || pickActiveLang('Việt Nam', 'Vietnam', '越南');
        const loc = city && region && city !== region ? `${city}, ${region}, ${country}` : city ? `${city}, ${country}` : country;
        const detail: DetailedLocation = {
          location: loc,
          latitude: typeof data.latitude === 'number' ? data.latitude : 12.6800,
          longitude: typeof data.longitude === 'number' ? data.longitude : 108.0383,
          city,
          region,
          country,
          isGps: false
        };
        cachedSpecificLocation = loc;
        cachedDetailedLocation = detail;
        try {
          localStorage.setItem('cloudsend_cached_location', loc);
          localStorage.setItem('cloudsend_detailed_location', JSON.stringify(detail));
        } catch {}
        return detail;
      }
    }
  } catch {}

  // 3. Fallback
  const fallbackLoc = detectLocationInfo();
  const fallbackDetail: DetailedLocation = {
    location: fallbackLoc,
    latitude: 12.6800,
    longitude: 108.0383,
    country: pickActiveLang('Việt Nam', 'Vietnam', '越南'),
    isGps: false
  };
  return fallbackDetail;
}

export async function fetchSpecificLocation(): Promise<string> {
  if (cachedSpecificLocation && cachedSpecificLocation !== 'Đang xác định...') {
    return cachedSpecificLocation;
  }

  const detailed = await fetchDetailedLocation();
  return detailed.location;
}

export function detectLocationInfo(): string {
  if (cachedSpecificLocation) return cachedSpecificLocation;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return pickActiveLang('Việt Nam', 'Vietnam', '越南');
    if (tz.includes('Ho_Chi_Minh') || tz.includes('Saigon')) {
      return pickActiveLang('TP. Hồ Chí Minh, Việt Nam', 'Ho Chi Minh City, Vietnam', '越南胡志明市');
    }
    if (tz.includes('Hanoi')) {
      return pickActiveLang('Hà Nội, Việt Nam', 'Hanoi, Vietnam', '越南河内');
    }
    if (tz.includes('Bangkok')) {
      return pickActiveLang('Hà Nội / TP.HCM, Việt Nam', 'Hanoi / HCMC, Vietnam', '越南河内 / 胡志明市');
    }
    if (tz.includes('Tokyo')) return pickActiveLang('Tokyo, Nhật Bản', 'Tokyo, Japan', '日本东京');
    if (tz.includes('Seoul')) return pickActiveLang('Seoul, Hàn Quốc', 'Seoul, South Korea', '韩国首尔');
    if (tz.includes('Singapore')) return 'Singapore';
    if (tz.includes('London')) return pickActiveLang('London, Vương Quốc Anh', 'London, United Kingdom', '英国伦敦');
    if (tz.includes('New_York') || tz.includes('America')) return pickActiveLang('Hoa Kỳ (US Region)', 'United States (US Region)', '美国区域');
    return tz.replace(/_/g, ' ');
  } catch {
    return pickActiveLang('Việt Nam', 'Vietnam', '越南');
  }
}

// Auto-trigger background location resolution on module load
if (typeof window !== 'undefined') {
  fetchSpecificLocation().catch(() => {});
}

