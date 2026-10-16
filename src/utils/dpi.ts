import { isSmartTv } from './device';

export type DpiScaleMode = 'auto' | 'compact' | 'standard' | 'large' | 'xlarge';

export interface DeviceDpiInfo {
  pixelRatio: number;
  estimatedDpi: number;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  effectiveScale: number;
  isHighDpi: boolean;
  isTv: boolean;
}

export function isHighDpiDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const dpr = window.devicePixelRatio || 1;
  return dpr >= 1.75;
}

export function getDeviceDpiInfo(mode: DpiScaleMode = 'auto'): DeviceDpiInfo {
  if (typeof window === 'undefined') {
    return {
      pixelRatio: 1,
      estimatedDpi: 96,
      screenWidth: 1920,
      screenHeight: 1080,
      windowWidth: 1920,
      windowHeight: 1080,
      effectiveScale: 1,
      isHighDpi: false,
      isTv: false,
    };
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const estimatedDpi = Math.round(pixelRatio * 96);
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const isTv = isSmartTv();
  const isHighDpi = pixelRatio >= 1.75;

  let effectiveScale = 1.0;
  switch (mode) {
    case 'compact':
      effectiveScale = 0.90;
      break;
    case 'standard':
      effectiveScale = 1.0;
      break;
    case 'large':
      effectiveScale = 1.10;
      break;
    case 'xlarge':
      effectiveScale = 1.25;
      break;
    case 'auto':
    default:
      if (isTv) {
        // Smart TV automatic DPI calibration: keep crisp 100% scale without overflowing 10-foot viewport
        effectiveScale = 1.0;
      } else if (windowWidth <= 380 && pixelRatio >= 2.5) {
        // High density compact smartphones (iPhone mini, compact Galaxy): avoid cutoffs
        effectiveScale = 0.95;
      } else if (windowWidth >= 2560 && pixelRatio <= 1.25) {
        // High-res desktop monitor
        effectiveScale = 1.05;
      } else {
        effectiveScale = 1.0;
      }
      break;
  }

  return {
    pixelRatio,
    estimatedDpi,
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    effectiveScale,
    isHighDpi,
    isTv,
  };
}

/**
 * Automatically calibrates and applies DPI styles, CSS custom properties,
 * and adaptive classes on the root element. Runs automatically on every screen change.
 */
export function autoCalibrateAndApplyDpi(mode: DpiScaleMode = 'auto'): DeviceDpiInfo {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return getDeviceDpiInfo(mode);
  }

  const info = getDeviceDpiInfo(mode);
  const docEl = document.documentElement;

  // Set CSS custom variables for dynamic layout scaling
  docEl.style.setProperty('--device-pixel-ratio', info.pixelRatio.toString());
  docEl.style.setProperty('--app-scale', info.effectiveScale.toString());
  docEl.style.setProperty('--viewport-width', `${info.windowWidth}px`);
  docEl.style.setProperty('--viewport-height', `${info.windowHeight}px`);

  // Ensure stable base font size (16px) to maintain rem integrity across all browsers
  docEl.style.fontSize = '16px';

  // Automatic high DPI class
  if (info.isHighDpi) {
    docEl.classList.add('high-dpi-device');
  } else {
    docEl.classList.remove('high-dpi-device');
  }

  // Automatic Smart TV mode (LG WebOS, Samsung Tizen, Android TV, Sony, etc.)
  if (info.isTv) {
    docEl.classList.add('tv-mode');
  } else {
    docEl.classList.remove('tv-mode');
  }

  return info;
}

export function applyDpiScale(mode: DpiScaleMode = 'auto') {
  autoCalibrateAndApplyDpi(mode);
}
