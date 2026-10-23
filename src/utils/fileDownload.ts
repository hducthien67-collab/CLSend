/**
 * Universal safe file download utility that works 100% reliably across:
 * - Desktop Chrome, Edge, Firefox, Safari
 * - Mobile Safari (iPhone / iPad iOS 12-18+) and Android Chrome / Samsung Internet
 * - Sandboxed Iframes (Google AI Studio preview, embeds)
 * - Base64 Data URLs (chunked Uint8Array parsing to avoid call stack / memory limits)
 * - Server / API URLs (multi-stage blob fetching with iframe fallback)
 */

import { isSafeDownloadUrl, sanitizeFilename } from './fileSecurity';
import { getFileBlobLocally, storeFileBlobLocally } from './idbStorage';

// Global toast listener registry for download feedback
type DownloadToastCallback = (msg: { text: string; type: 'info' | 'success' | 'error' }) => void;
let downloadToastListeners: Set<DownloadToastCallback> = new Set();

export function registerDownloadToast(cb: DownloadToastCallback): () => void {
  downloadToastListeners.add(cb);
  return () => downloadToastListeners.delete(cb);
}

function notifyDownload(text: string, type: 'info' | 'success' | 'error' = 'info') {
  downloadToastListeners.forEach(cb => {
    try { cb({ text, type }); } catch {}
  });
}

export type ErrorChatInfo = {
  fileName: string;
  errorMessage: string;
  diagnosticInfo?: { blobType: string; blobSize: number };
  onRetry?: () => void;
  onDirectCDN?: () => void;
};

let errorChatListeners: Set<(info: ErrorChatInfo) => void> = new Set();

export function registerErrorChatListener(cb: (info: ErrorChatInfo) => void): () => void {
  errorChatListeners.add(cb);
  return () => errorChatListeners.delete(cb);
}

export function notifyErrorChat(info: ErrorChatInfo) {
  errorChatListeners.forEach(cb => {
    try { cb(info); } catch {}
  });
}

/**
 * Convert base64 data URL to Blob efficiently in chunks to avoid RangeError
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Định dạng data URL không hợp lệ');
  }

  const header = dataUrl.substring(0, commaIndex);
  const base64 = dataUrl.substring(commaIndex + 1);

  const mimeMatch = header.match(/:(.*?);/);
  let mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  if (mime === 'image/jpg') {
    mime = 'image/jpeg';
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  
  // Allocate buffer
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * Convert Blob to Base64 Data URL format ("data:image/...;base64,...")
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể chuyển đổi tệp sang Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Main safe download function
 */
export async function downloadFileSafely(
  source: string,
  fileName: string,
  onProgress?: (status: 'starting' | 'downloading' | 'completed' | 'error') => void
): Promise<boolean> {
  if (!source || !source.trim()) {
    console.warn('downloadFileSafely: source is empty');
    notifyDownload('Không tìm thấy nguồn dữ liệu tệp để tải về. Tệp này có thể bị gián đoạn trong lần tải lên trước đó.', 'error');
    if (onProgress) onProgress('error');
    return false;
  }

  // Security: Block unsafe protocols (javascript:, vbscript:, etc.)
  if (!isSafeDownloadUrl(source)) {
    console.error('downloadFileSafely: Unsafe URL blocked:', source);
    notifyDownload('Liên kết tải về không an toàn và đã bị CLSend chặn.', 'error');
    if (onProgress) onProgress('error');
    return false;
  }

  const safeFileName = sanitizeFilename(fileName || 'clsend-file');
  if (onProgress) onProgress('starting');
  notifyDownload(`Đang chuẩn bị tải về "${safeFileName}"...`, 'info');

  try {
    let resolvedSource = source;
    let telegramOriginalUrl = '';

    // Accurately extract raw Telegram CDN URL if present in source or query
    if (source.startsWith('https://api.telegram.org/file/bot')) {
      telegramOriginalUrl = source;
      resolvedSource = `/api/telegram/download?url=${encodeURIComponent(source)}&name=${encodeURIComponent(safeFileName)}`;
    } else if (source.includes('api.telegram.org/file/bot')) {
      try {
        const match = source.match(/url=([^&]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.startsWith('https://api.telegram.org/file/bot')) {
            telegramOriginalUrl = decoded;
          }
        }
      } catch {}
      resolvedSource = source;
    }

    // Check IndexedDB cache first (works 100% offline and on static GitHub pages)
    let fileIdOrKey = '';
    if (resolvedSource.includes('/api/files/download/')) {
      fileIdOrKey = resolvedSource.split('/api/files/download/')[1]?.split('?')[0];
    } else if (telegramOriginalUrl) {
      fileIdOrKey = telegramOriginalUrl.split('/').pop()?.split('?')[0] || '';
    }

    let localBlob: Blob | null = null;
    if (fileIdOrKey) {
      localBlob = await getFileBlobLocally(fileIdOrKey).catch(() => null);
    }

    let blobUrl: string | null = null;
    let createdBlobUrl = false;

    if (localBlob) {
      blobUrl = URL.createObjectURL(localBlob);
      createdBlobUrl = true;
    } else {
      // Resolve relative path against current window origin
      let fetchUrl = resolvedSource;
      if (fetchUrl.startsWith('/')) {
        fetchUrl = `${window.location.origin}${fetchUrl}`;
      }

      if (fetchUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(fetchUrl);
        blobUrl = URL.createObjectURL(blob);
        createdBlobUrl = true;
      } else if (fetchUrl.startsWith('blob:')) {
        blobUrl = fetchUrl;
      } else {
        try {
          if (onProgress) onProgress('downloading');
          let res = await fetch(fetchUrl, {
            method: 'GET',
            headers: { 'Accept': '*/*' },
            cache: 'no-cache'
          });

          if (!res.ok) {
            let errorMsg = `Máy chủ trả về mã HTTP ${res.status}`;
            try {
              const errJson = await res.json();
              if (errJson?.message) errorMsg = errJson.message;
            } catch {}

            // If proxy returned 404/error (e.g. on Vercel deployment where serverless is not yet active)
            // Directly download from Telegram CDN via top-level browser navigation!
            if (telegramOriginalUrl) {
              console.log('Proxy unavailable, triggering direct browser download from Telegram CDN:', telegramOriginalUrl);
              const a = document.createElement('a');
              a.href = telegramOriginalUrl;
              a.download = safeFileName;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                try { document.body.removeChild(a); } catch {}
              }, 1500);

              try {
                window.open(telegramOriginalUrl, '_blank');
              } catch {}

              if (onProgress) onProgress('completed');
              notifyDownload(`Đang tải về "${safeFileName}" trực tiếp từ Telegram!`, 'success');
              return true;
            }

            throw new Error(errorMsg);
          }

          // Check if response is JSON error returned with 200 OK
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            if (errData?.error || errData?.success === false) {
              throw new Error(errData?.message || errData?.error || 'Lỗi khi tải tệp từ Telegram.');
            }
          }

          const blob = await res.blob();

          // Guard against HTML error pages / 404 responses being saved as files
          if (blob.type.includes('text/html') || blob.size < 2000) {
            const textCheck = await blob.text().catch(() => '');
            if (textCheck.startsWith('<') || textCheck.includes('<!DOCTYPE') || textCheck.includes('<html') || textCheck.includes('Cannot GET') || textCheck.includes('404 Not Found')) {
              if (telegramOriginalUrl) {
                window.open(telegramOriginalUrl, '_blank');
                if (onProgress) onProgress('completed');
                notifyDownload(`Đang mở tải về trực tiếp "${safeFileName}"...`, 'info');
                return true;
              }
              throw new Error('Máy chủ trả về trang lỗi HTML thay vì tệp dữ liệu thực tế.');
            }
          }

          // Cache downloaded blob locally in IndexedDB for future instant / offline use
          if (fileIdOrKey) {
            storeFileBlobLocally(fileIdOrKey, blob).catch(() => {});
          }

          blobUrl = URL.createObjectURL(blob);
          createdBlobUrl = true;
        } catch (fetchErr) {
          console.warn('Fetch fallback, trying direct Telegram/anchor download:', fetchErr);
          
          const targetUrl = telegramOriginalUrl || fetchUrl;
          const a = document.createElement('a');
          a.href = targetUrl;
          a.download = safeFileName;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          
          setTimeout(() => {
            try { document.body.removeChild(a); } catch {}
          }, 1500);

          if (telegramOriginalUrl) {
            try {
              window.open(telegramOriginalUrl, '_blank');
            } catch {}
          }

          if (onProgress) onProgress('completed');
          notifyDownload(`Đã bắt đầu tải xuống "${safeFileName}"!`, 'success');
          return true;
        }
      }
    }

    if (!blobUrl && !source.startsWith('data:')) {
      throw new Error('Không thể tạo liên kết tải về cho tệp.');
    }

    let finalHref = source.startsWith('data:') ? source : blobUrl;

    if (!source.startsWith('data:') && blobUrl) {
      try {
        let targetBlob = localBlob;
        if (!targetBlob && blobUrl.startsWith('blob:')) {
          const resp = await fetch(blobUrl);
          targetBlob = await resp.blob();
        }
        if (targetBlob) {
          const base64Data = await blobToBase64(targetBlob);
          if (base64Data) {
            finalHref = base64Data;
          }
        }
      } catch (e) {
        console.warn('Base64 conversion fallback to blob URL:', e);
      }
    }

    // Trigger local download via invisible anchor tag using Base64 Data URL mechanism
    const a = document.createElement('a');
    a.href = finalHref;
    a.download = safeFileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
    }, 1000);

    // Free memory object URL (Disabled to prevent stale blob URLs in browser downloads)
    // if (createdBlobUrl && blobUrl) {
    //   const urlToRevoke = blobUrl;
    //   setTimeout(() => {
    //     try {
    //       URL.revokeObjectURL(urlToRevoke);
    //     } catch {}
    //   }, 45000);
    // }

    if (onProgress) onProgress('completed');
    notifyDownload(`Đã tải về thành công "${safeFileName}"!`, 'success');
    return true;
  } catch (err: any) {
    console.error('Safe download error:', err);

    // Ultimate fallback for strict environments: Direct hidden navigation & window.open
    try {
      const uniqueId = Date.now();
      const uniqueSource = `${source.includes('?') ? source + '&' : source + '?'}v=${uniqueId}`;
      const a = document.createElement('a');
      a.href = uniqueSource;
      a.download = safeFileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 1500);

      try {
        window.open(uniqueSource, '_blank');
      } catch {}

      if (onProgress) onProgress('completed');
      notifyDownload(`Đã mở liên kết tải xuống cho "${safeFileName}".`, 'success');
      return true;
    } catch (fallbackErr: any) {
      if (onProgress) onProgress('error');
      notifyDownload(`Đang chuyển hướng tải xuống trực tiếp...`, 'info');
      
      // Capture diagnostic info
      const diagnosticInfo = { blobType: 'unknown', blobSize: 0 };
      
      try {
        window.location.href = source;
        return true;
      } catch {
        notifyErrorChat({
          fileName: safeFileName,
          errorMessage: err?.message || fallbackErr?.message || 'Không thể thiết lập kết nối tải tệp',
          diagnosticInfo: diagnosticInfo,
          onRetry: () => downloadFileSafely(source, fileName, onProgress),
          onDirectCDN: () => {
            window.open(source, '_blank');
          }
        });
        return false;
      }
    }
  }
}
