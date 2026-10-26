/**
 * CLSend Tab Notification Utility
 * 
 * Manages browser tab favicon badging and title alerts:
 * 1. Facebook-style vibrant green dot in the corner of the browser favicon
 * 2. Discord-style unread counter prefix in document.title: "({count}) CLSend - ..."
 * 3. Graceful restoration to pristine default favicon and title when viewed
 */

let originalTitle = typeof document !== 'undefined' ? document.title : 'CLSend - Truyền Tệp Siêu Tốc & Phòng Chat Trực Tuyến';
let originalFaviconHref = '/favicon.svg';
let cachedBaseFaviconImage: HTMLImageElement | null = null;
let isImageLoading = false;
let currentBadgeCount = 0;

type UnreadCountListener = (updater: (prev: number) => number) => void;
let unreadCountListeners: Set<UnreadCountListener> = new Set();

export function registerUnreadCountListener(listener: UnreadCountListener) {
  unreadCountListeners.add(listener);
  return () => {
    unreadCountListeners.delete(listener);
  };
}

export function triggerIncomingChatMessageNotification(amount: number = 1) {
  unreadCountListeners.forEach((fn) => {
    try {
      fn((prev) => prev + amount);
    } catch (e) {
      console.warn('Error in unread count listener:', e);
    }
  });
}

// Preload the base favicon SVG image so rendering to canvas is immediate
function preloadBaseFavicon() {
  if (typeof window === 'undefined' || cachedBaseFaviconImage || isImageLoading) return;
  isImageLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = originalFaviconHref;
  img.onload = () => {
    cachedBaseFaviconImage = img;
    isImageLoading = false;
    if (currentBadgeCount > 0) {
      applyBadgeToFavicon(currentBadgeCount);
    }
  };
  img.onerror = () => {
    isImageLoading = false;
  };
}

if (typeof window !== 'undefined') {
  // Capture initial title if already rendered
  if (document.title && !document.title.startsWith('(')) {
    originalTitle = document.title;
  }
  
  // Find initial favicon href
  const initialLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (initialLink && initialLink.href) {
    originalFaviconHref = initialLink.getAttribute('href') || '/favicon.svg';
  }

  // Preload image
  preloadBaseFavicon();
}

/**
 * Creates a canvas and renders the base favicon with a Facebook-style green dot badge
 */
function createBadgedFaviconDataUrl(count: number): string | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Draw base icon if loaded, or draw SVG background
  if (cachedBaseFaviconImage && cachedBaseFaviconImage.complete && cachedBaseFaviconImage.naturalWidth > 0) {
    ctx.drawImage(cachedBaseFaviconImage, 0, 0, 64, 64);
  } else {
    // High-contrast Emerald rounded square fallback representing CloudSend
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 64, 18);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 32, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Facebook-style vibrant green badge in the bottom-right corner
  if (count <= 1) {
    // Classic Facebook active/new message green circular dot
    const centerX = 49;
    const centerY = 49;
    const radius = 10;

    // Dark outline for maximum contrast against any browser tab background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // White separation ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Vibrant green core (Facebook emerald green)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    // Soft specular highlight for glossy finish
    ctx.beginPath();
    ctx.arc(centerX - 3, centerY - 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
  } else {
    // Discord / Facebook hybrid badge with number
    const displayText = count > 99 ? '99+' : String(count);
    const isPill = count > 9;
    const centerX = isPill ? 46 : 48;
    const centerY = 48;
    const width = isPill ? 28 : 22;
    const height = 22;
    const x = centerX - width / 2;
    const y = centerY - height / 2;

    // Dark outline
    ctx.beginPath();
    ctx.roundRect(x - 2.5, y - 2.5, width + 5, height + 5, 11);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // White separation border
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, width + 2, height + 2, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Vibrant green fill
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 9);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    // Number text
    ctx.fillStyle = '#ffffff';
    ctx.font = isPill ? 'bold 11px system-ui, -apple-system, sans-serif' : 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, centerX, centerY + 0.5);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Updates or replaces the <link rel="icon"> tags in <head>
 */
function updateFaviconLink(href: string, type: string) {
  if (typeof document === 'undefined') return;

  const head = document.head || document.getElementsByTagName('head')[0];
  const existingLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");

  if (existingLinks.length > 0) {
    existingLinks.forEach((link) => {
      const newLink = link.cloneNode(true) as HTMLLinkElement;
      newLink.type = type;
      newLink.href = href;
      link.parentNode?.replaceChild(newLink, link);
    });
  } else {
    const newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.type = type;
    newLink.href = href;
    head.appendChild(newLink);
  }
}

function applyBadgeToFavicon(count: number) {
  if (count <= 0) {
    updateFaviconLink(originalFaviconHref, 'image/svg+xml');
    return;
  }

  if (!cachedBaseFaviconImage || !cachedBaseFaviconImage.complete) {
    preloadBaseFavicon();
  }

  const dataUrl = createBadgedFaviconDataUrl(count);
  if (dataUrl) {
    updateFaviconLink(dataUrl, 'image/png');
  }
}

/**
 * Updates browser tab title and favicon with unread notification badge
 * 
 * @param count Number of unread messages (0 to clear)
 */
export function setTabNotificationBadge(count: number) {
  if (typeof window === 'undefined') return;

  currentBadgeCount = Math.max(0, count);

  // 1. Discord-style document.title update: "({count}) CLSend - ..."
  if (currentBadgeCount > 0) {
    const cleanBaseTitle = originalTitle.replace(/^\(\d+\+?\)\s*/, '');
    document.title = `(${currentBadgeCount}) ${cleanBaseTitle}`;
  } else {
    document.title = originalTitle.replace(/^\(\d+\+?\)\s*/, '');
  }

  // 2. Facebook-style green dot favicon badge update
  applyBadgeToFavicon(currentBadgeCount);
}

/**
 * Clears tab badge and reverts favicon and title back to original
 */
export function clearTabNotificationBadge() {
  setTabNotificationBadge(0);
}

/**
 * Gets the current badge count
 */
export function getTabNotificationBadgeCount(): number {
  return currentBadgeCount;
}
