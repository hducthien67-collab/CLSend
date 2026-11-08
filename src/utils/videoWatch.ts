/**
 * ClSend Video Watch Utilities
 * Generates direct standalone cinema-mode web player URLs and opens them in native browser tabs
 */

export interface VideoWatchSource {
  url?: string;
  viewUrl?: string;
  name?: string;
  id?: string;
  type?: string;
}

export function isVideoSource(file: { name?: string; type?: string; category?: string }): boolean {
  if (file.category === 'video') return true;
  if (file.type && file.type.startsWith('video/')) return true;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp', 'ts', 'ogv', 'flv', 'wmv'].includes(ext);
}

export function getVideoWebWatchUrl(file: VideoWatchSource): string {
  const nameParam = file.name ? `name=${encodeURIComponent(file.name)}` : '';
  const url = file.viewUrl || file.url || '';

  // 1. If it's a server view route
  if (url.includes('/api/files/view/')) {
    const rawId = url.split('/api/files/view/')[1]?.split('?')[0];
    if (rawId) {
      return `/watch/${encodeURIComponent(rawId)}${nameParam ? `?${nameParam}` : ''}`;
    }
  }

  // 2. If it's a server download route
  if (url.includes('/api/files/download/')) {
    const rawId = url.split('/api/files/download/')[1]?.split('?')[0];
    if (rawId) {
      return `/watch/${encodeURIComponent(rawId)}${nameParam ? `?${nameParam}` : ''}`;
    }
  }

  // 3. If it has a local server filename (e.g. 1762512345_video.mp4)
  const lastSegment = url.split('/').pop()?.split('?')[0];
  if (lastSegment && /^[a-zA-Z0-9_\.-]+\.(mp4|webm|mov|mkv|avi|m4v|3gp|ts)$/i.test(lastSegment)) {
    return `/watch/${encodeURIComponent(lastSegment)}${nameParam ? `?${nameParam}` : ''}`;
  }

  // 4. If an external or blob or custom stream URL is present
  if (url) {
    const joinChar = nameParam ? `?${nameParam}&` : '?';
    return `/watch/stream${joinChar}src=${encodeURIComponent(url)}`;
  }

  // 5. Fallback with id
  return `/watch/${encodeURIComponent(file.id || 'video')}${nameParam ? `?${nameParam}` : ''}`;
}

export function openVideoInWebTab(file: VideoWatchSource): Window | null {
  const watchUrl = getVideoWebWatchUrl(file);
  try {
    return window.open(watchUrl, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('Could not open video tab:', err);
    return null;
  }
}
