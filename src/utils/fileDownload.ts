/**
 * Universal, integrity-verified safe file download utility.
 * Supports:
 * - Multi-Range (HTTP 206) parallel assembly (works seamlessly across Vercel 2.5MB serverless caps)
 * - Automatic ClSend Telegram Manifest v2 shard expansion & verification
 * - HTML / JSON error response detection (never saves broken HTML/manifest JSON as a media/zip file)
 * - Direct browser streaming for huge Express files (> 80MB) after verified HEAD probe
 * - IndexedDB instant offline cache with automatic corruption validation
 */

import { isSafeDownloadUrl, sanitizeFilename } from './fileSecurity';
import { getFileBlobLocally, storeFileBlobLocally } from './idbStorage';
import { pickActiveLang } from '../context/LanguageContext';

// Global toast listener registry for download feedback
type DownloadToastCallback = (msg: { text: string; type: 'info' | 'success' | 'error' }) => void;
const downloadToastListeners: Set<DownloadToastCallback> = new Set();

export function registerDownloadToast(cb: DownloadToastCallback): () => void {
  downloadToastListeners.add(cb);
  return () => downloadToastListeners.delete(cb);
}

function notifyDownload(text: string, type: 'info' | 'success' | 'error' = 'info') {
  downloadToastListeners.forEach((cb) => {
    try {
      cb({ text, type });
    } catch {}
  });
}

export type ErrorChatInfo = {
  fileName: string;
  errorMessage: string;
  diagnosticInfo?: { blobType: string; blobSize: number };
  onRetry?: () => void;
  onDirectCDN?: () => void;
};

const errorChatListeners: Set<(info: ErrorChatInfo) => void> = new Set();

export function registerErrorChatListener(cb: (info: ErrorChatInfo) => void): () => void {
  errorChatListeners.add(cb);
  return () => errorChatListeners.delete(cb);
}

export function notifyErrorChat(info: ErrorChatInfo) {
  errorChatListeners.forEach((cb) => {
    try {
      cb(info);
    } catch {}
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error(pickActiveLang('Định dạng data URL không hợp lệ', 'Invalid data URL format', '无效的 Data URL 格式'));
  }

  const header = dataUrl.substring(0, commaIndex);
  const rawBase64 = dataUrl.substring(commaIndex + 1).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = rawBase64 + '='.repeat((4 - (rawBase64.length % 4)) % 4);
  const mimeMatch = header.match(/:(.*?);/);
  let mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  if (mime === 'image/jpg') mime = 'image/jpeg';

  const binaryString = atob(paddedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function isHtmlOrMarkupFilename(name: string): boolean {
  const lower = (name || '').toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.svg') || lower.endsWith('.xml');
}

function isJsonFilename(name: string): boolean {
  return (name || '').toLowerCase().endsWith('.json');
}

function resolveDownloadMime(fileName: string, serverContentType?: string | null): string {
  const ct = (serverContentType || '').split(';')[0].trim().toLowerCase();
  if (ct && ct !== 'application/octet-stream' && ct !== 'text/html' && ct !== 'application/json') {
    return ct;
  }
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'avi') return 'video/x-msvideo';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg' || ext === 'opus') return 'audio/ogg';
  if (ext === 'm4a' || ext === 'aac') return 'audio/mp4';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'zip') return 'application/zip';
  return ct || 'application/octet-stream';
}

function parseContentRangeHeader(header: string | null): { start: number; end: number; total: number } | null {
  if (!header) return null;
  const m = header.match(/bytes\s+(\d+)-(\d+)\/(\d+)/i);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  const total = parseInt(m[3], 10);
  if (isNaN(start) || isNaN(end) || isNaN(total) || total <= 0 || end < start) return null;
  return { start, end, total };
}

/**
 * Inspect first bytes of a Blob/ArrayBuffer to detect masquerading HTML error pages,
 * JSON API errors, or raw Telegram manifest JSONs.
 */
async function inspectDownloadedPayload(
  blob: Blob,
  targetFileName: string
): Promise<{
  kind: 'valid' | 'html_error' | 'json_error' | 'tg_manifest';
  errorMessage?: string;
  manifest?: any;
}> {
  if (blob.size === 0) {
    return { kind: 'html_error', errorMessage: pickActiveLang('Tệp tải về rỗng (0 bytes).', 'Downloaded file is empty (0 bytes).', '下载的文件为空（0 字节）。') };
  }

  const headSize = Math.min(blob.size, 2048);
  const headText = await blob.slice(0, headSize).text().catch(() => '');
  const trimmed = headText.trimStart();

  if (
    !isHtmlOrMarkupFilename(targetFileName) &&
    (blob.type.includes('text/html') ||
      /^<!doctype\s+html/i.test(trimmed) ||
      /^<html[\s>]/i.test(trimmed) ||
      trimmed.includes('Cannot GET /api') ||
      trimmed.includes('404 Not Found') ||
      trimmed.includes('Tệp không tồn tại'))
  ) {
    return { kind: 'html_error', errorMessage: 'FILE_NOT_FOUND_ON_SERVER' };
  }

  if (trimmed.startsWith('{') && blob.size <= 1024 * 1024) {
    const fullText = blob.size <= headSize ? headText : await blob.text().catch(() => '');
    try {
      const parsed = JSON.parse(fullText);
      if (
        parsed &&
        ((parsed.schema === 'clsend_tg_manifest_v2' || Array.isArray(parsed.shards)) &&
          Array.isArray(parsed.shards) &&
          parsed.shards.length > 0) ||
        (parsed && parsed.totalParts && Array.isArray(parsed.parts) && parsed.parts.length > 0)
      ) {
        return { kind: 'tg_manifest', manifest: parsed };
      }
      if (!isJsonFilename(targetFileName) && (parsed?.success === false || parsed?.ok === false || parsed?.error)) {
        return {
          kind: 'json_error',
          errorMessage: parsed?.message || parsed?.error || pickActiveLang('Máy chủ từ chối yêu cầu tải tệp.', 'The server rejected the download request.', '服务器拒绝了文件下载请求。')
        };
      }
    } catch {
      // Not valid JSON, treat as regular binary
    }
  }

  return { kind: 'valid' };
}

function normalizeDownloadSourceUrl(source: string, safeFileName: string): {
  fetchUrl: string;
  telegramOriginalUrl: string;
  cacheKey: string;
} {
  let resolvedSource = source.trim();
  let telegramOriginalUrl = '';

  if (resolvedSource.startsWith('https://api.telegram.org/file/bot')) {
    telegramOriginalUrl = resolvedSource;
    resolvedSource = `/api/telegram/download?url=${encodeURIComponent(resolvedSource)}&name=${encodeURIComponent(safeFileName)}`;
  } else if (resolvedSource.includes('api.telegram.org/file/bot')) {
    try {
      const match = resolvedSource.match(/url=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith('https://api.telegram.org/file/bot')) {
          telegramOriginalUrl = decoded;
        }
      }
    } catch {}
  }

  // Rewrite inline /view URLs to attachment /download URLs so original untouched binary is saved
  if (resolvedSource.includes('/api/files/view/')) {
    const idPart = resolvedSource.split('/api/files/view/')[1]?.split('?')[0];
    if (idPart) {
      resolvedSource = `/api/files/download/${idPart}?name=${encodeURIComponent(safeFileName)}`;
    }
  }

  // Strip &inline=true or &view=true on Telegram proxy URLs so server delivers raw original file as attachment
  if (resolvedSource.includes('/api/telegram/download')) {
    try {
      const u = new URL(resolvedSource, window.location.origin);
      u.searchParams.delete('inline');
      u.searchParams.delete('view');
      if (!u.searchParams.get('name') && safeFileName) {
        u.searchParams.set('name', safeFileName);
      }
      resolvedSource = `${u.pathname}${u.search}`;
    } catch {}
  }

  let cacheKey = '';
  try {
    const u = new URL(resolvedSource, window.location.origin);
    if (u.pathname.includes('/api/files/download/')) {
      cacheKey = u.pathname.split('/api/files/download/')[1] || '';
    } else if (u.pathname.includes('/api/telegram/download')) {
      cacheKey = u.searchParams.get('fileId') || '';
    } else if (telegramOriginalUrl) {
      cacheKey = telegramOriginalUrl.split('/').pop()?.split('?')[0] || '';
    }
  } catch {}

  const fetchUrl = resolvedSource.startsWith('/')
    ? `${window.location.origin}${resolvedSource}`
    : resolvedSource;

  return { fetchUrl, telegramOriginalUrl, cacheKey };
}

/**
 * Fetches a full verified binary Blob from any URL, transparently stitching HTTP 206
 * Range slices (e.g. Vercel's 2MB proxy cap) and expanding Telegram manifests if returned raw.
 */
export async function fetchVerifiedBlobFromUrl(
  url: string,
  targetFileName: string,
  expectedTotalHint?: number
): Promise<Blob> {
  const firstRes = await fetch(url, {
    method: 'GET',
    headers: { Accept: '*/*' },
    cache: 'no-cache'
  });

  if (!firstRes.ok && firstRes.status !== 206) {
    let errMsg = pickActiveLang('Máy chủ trả về mã HTTP {status}', 'Server returned HTTP {status}', '服务器返回 HTTP {status}').replace('{status}', String(firstRes.status));
    try {
      const ct = firstRes.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await firstRes.json();
        errMsg = j?.message || j?.error || errMsg;
      }
    } catch {}
    if (firstRes.status === 404) {
      throw new Error('FILE_NOT_FOUND_ON_SERVER');
    }
    throw new Error(errMsg);
  }

  // Case A: Server returned HTTP 206 Partial Content (e.g. Vercel 2.5MB window)
  if (firstRes.status === 206) {
    const rangeMeta = parseContentRangeHeader(firstRes.headers.get('content-range'));
    const firstBuf = await firstRes.arrayBuffer();
    if (!rangeMeta) {
      throw new Error(pickActiveLang('Phản hồi 206 thiếu thông tin Content-Range.', '206 response is missing Content-Range header.', '206 响应缺少 Content-Range 信息。'));
    }

    const totalSize = rangeMeta.total;
    const firstEnd = rangeMeta.start + firstBuf.byteLength - 1;
    const sliceWindow = Math.max(512 * 1024, firstBuf.byteLength);
    const mime = resolveDownloadMime(targetFileName, firstRes.headers.get('content-type'));

    // Check first chunk isn't secretly HTML
    const firstProbe = await inspectDownloadedPayload(new Blob([firstBuf], { type: mime }), targetFileName);
    if (firstProbe.kind === 'html_error') {
      throw new Error(firstProbe.errorMessage || 'FILE_NOT_FOUND_ON_SERVER');
    }
    if (firstProbe.kind === 'json_error') {
      throw new Error(firstProbe.errorMessage || pickActiveLang('Lỗi tải tệp.', 'File download error.', '文件下载出错。'));
    }
    if (firstProbe.kind === 'tg_manifest' && firstProbe.manifest) {
      return await downloadTelegramManifestBlob(firstProbe.manifest, targetFileName);
    }

    if (firstEnd >= totalSize - 1 && rangeMeta.start === 0) {
      return new Blob([firstBuf], { type: mime });
    }

    // Build remaining byte ranges starting after firstEnd
    const windows: Array<{ start: number; end: number }> = [];
    let cursor = firstEnd + 1;
    while (cursor < totalSize) {
      const wEnd = Math.min(totalSize - 1, cursor + sliceWindow - 1);
      windows.push({ start: cursor, end: wEnd });
      cursor = wEnd + 1;
    }

    const collected: ArrayBuffer[] = new Array(windows.length + 1);
    collected[0] = firstBuf;

    let nextIdx = 0;
    const CONCURRENCY = Math.min(3, Math.max(1, windows.length));

    const runSliceWorker = async () => {
      while (nextIdx < windows.length) {
        const idx = nextIdx++;
        const win = windows[idx];
        const expectedBytes = win.end - win.start + 1;
        let lastErr: any = null;

        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const sliceRes = await fetch(url, {
              method: 'GET',
              headers: {
                Accept: '*/*',
                Range: `bytes=${win.start}-${win.end}`
              },
              cache: 'no-cache'
            });
            if (!sliceRes.ok && sliceRes.status !== 206) {
              throw new Error(`HTTP ${sliceRes.status}`);
            }
            const ab = await sliceRes.arrayBuffer();
            if (sliceRes.status === 200 && ab.byteLength >= win.end + 1) {
              collected[idx + 1] = ab.slice(win.start, win.end + 1);
            } else if (ab.byteLength !== expectedBytes) {
              // If server returned more or less, verify range match
              const subRange = parseContentRangeHeader(sliceRes.headers.get('content-range'));
              if (subRange && ab.byteLength === subRange.end - subRange.start + 1 && ab.byteLength > 0 && subRange.start === win.start) {
                collected[idx + 1] = ab;
              } else {
                throw new Error(`Incomplete slice (${ab.byteLength}/${expectedBytes})`);
              }
            } else {
              collected[idx + 1] = ab;
            }
            lastErr = null;
            break;
          } catch (e: any) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }

        if (lastErr) {
          throw lastErr;
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => runSliceWorker()));

    const fullBlob = new Blob(collected, { type: mime });
    if (fullBlob.size !== totalSize) {
      throw new Error(
        pickActiveLang('Tệp tải về không đủ dung lượng ({loaded}/{total} bytes).', 'Downloaded file is incomplete ({loaded}/{total} bytes).', '下载的文件大小不完整（{loaded}/{total} 字节）。')
          .replace('{loaded}', String(fullBlob.size))
          .replace('{total}', String(totalSize))
      );
    }
    return fullBlob;
  }

  // Case B: Server returned HTTP 200 OK
  const expectedLen = Number(firstRes.headers.get('content-length') || expectedTotalHint || 0);
  const blob = await firstRes.blob();

  const inspection = await inspectDownloadedPayload(blob, targetFileName);
  if (inspection.kind === 'html_error') {
    throw new Error(inspection.errorMessage || 'FILE_NOT_FOUND_ON_SERVER');
  }
  if (inspection.kind === 'json_error') {
    throw new Error(inspection.errorMessage || pickActiveLang('Lỗi khi tải tệp.', 'Error downloading file.', '下载文件时出错。'));
  }
  if (inspection.kind === 'tg_manifest' && inspection.manifest) {
    return await downloadTelegramManifestBlob(inspection.manifest, targetFileName);
  }

  if (expectedLen > 0 && blob.size < expectedLen) {
    throw new Error(
      pickActiveLang('Đường truyền bị ngắt giữa chừng ({loaded}/{total} bytes). Vui lòng tải lại.', 'Connection interrupted ({loaded}/{total} bytes). Please download again.', '传输中途中断（{loaded}/{total} 字节），请重新下载。')
        .replace('{loaded}', String(blob.size))
        .replace('{total}', String(expectedLen))
    );
  }

  const finalMime = resolveDownloadMime(targetFileName, blob.type || firstRes.headers.get('content-type'));
  return blob.type === finalMime ? blob : new Blob([blob], { type: finalMime });
}

async function downloadTelegramManifestBlob(manifest: any, targetFileName: string): Promise<Blob> {
  let shards: any[] = Array.isArray(manifest?.shards) ? manifest.shards : [];
  if (shards.length === 0 && Array.isArray(manifest?.parts) && manifest.parts.length > 0) {
    const total = Number(manifest.size || 0);
    const estChunk = Number(manifest.chunkSize || Math.ceil(total / manifest.parts.length));
    shards = manifest.parts.map((partId: string, idx: number) => ({
      fileId: partId,
      botToken: '',
      size: idx === manifest.parts.length - 1 && total > 0 ? Math.max(0, total - estChunk * idx) : estChunk
    }));
  }
  if (shards.length === 0) {
    throw new Error(pickActiveLang('Cấu trúc tệp chia mảnh không hợp lệ.', 'Invalid sharded file structure.', '无效的分片文件结构。'));
  }
  const shardBlobs: Blob[] = new Array(shards.length);
  let nextIdx = 0;
  const CONCURRENCY = Math.min(3, shards.length);

  const worker = async () => {
    while (nextIdx < shards.length) {
      const idx = nextIdx++;
      const s = shards[idx];
      const shardUrl = `${window.location.origin}/api/telegram/download?fileId=${encodeURIComponent(String(s.fileId || ''))}&botToken=${encodeURIComponent(String(s.botToken || ''))}&name=${encodeURIComponent(`${targetFileName}.part${idx}`)}`;
      shardBlobs[idx] = await fetchVerifiedBlobFromUrl(shardUrl, `${targetFileName}.part${idx}`, Number(s.size) || undefined);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const finalMime = resolveDownloadMime(targetFileName, manifest?.type);
  const assembled = new Blob(shardBlobs, { type: finalMime });
  if (manifest?.size && assembled.size !== Number(manifest.size)) {
    throw new Error(
      pickActiveLang('Tệp ghép thiếu dữ liệu ({loaded}/{total} bytes).', 'Reassembled file is missing data ({loaded}/{total} bytes).', '合并的文件缺少数据（{loaded}/{total} 字节）。')
        .replace('{loaded}', String(assembled.size))
        .replace('{total}', String(manifest.size))
    );
  }
  return assembled;
}

function triggerBrowserSaveHref(href: string, fileName: string, revokeAfterMs = 0) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
    if (revokeAfterMs > 0 && href.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(href);
      } catch {}
    }
  }, Math.max(1500, revokeAfterMs));
}

export function openSafeExternalTab(url: string): void {
  if (!url || typeof document === 'undefined') return;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {}
    }, 1000);
  } catch (err) {
    console.warn('Could not open external link:', err);
  }
}

/**
 * Main safe download function
 */
export async function downloadFileSafely(
  source: string,
  fileName: string,
  onProgress?: (status: 'starting' | 'downloading' | 'completed' | 'error') => void,
  fallbackCacheKeys?: string[]
): Promise<boolean> {
  if (!source || !source.trim()) {
    notifyDownload(pickActiveLang('Không tìm thấy nguồn dữ liệu tệp để tải về.', 'No file source found to download.', '未找到可下载的文件来源。'), 'error');
    if (onProgress) onProgress('error');
    return false;
  }

  if (!isSafeDownloadUrl(source)) {
    notifyDownload(pickActiveLang('Liên kết tải về không an toàn và đã bị ClSend chặn.', 'Unsafe download link was blocked by ClSend.', '不安全的下载链接已被 ClSend 拦截。'), 'error');
    if (onProgress) onProgress('error');
    return false;
  }

  const safeFileName = sanitizeFilename(fileName || 'clsend-file');
  if (onProgress) onProgress('starting');
  notifyDownload(
    pickActiveLang('Đang chuẩn bị tải về "{name}"...', 'Preparing to download "{name}"...', '正在准备下载“{name}”...').replace('{name}', safeFileName),
    'info'
  );

  try {
    const { fetchUrl, telegramOriginalUrl, cacheKey } = normalizeDownloadSourceUrl(source, safeFileName);
    const idbCandidates = Array.from(new Set([cacheKey, ...(fallbackCacheKeys || [])].filter(Boolean)));

    // 1. Check IndexedDB cache (verify it is genuinely valid, not previously cached corrupt HTML/manifest)
    for (const candidateKey of idbCandidates) {
      const cachedBlob = await getFileBlobLocally(candidateKey).catch(() => null);
      if (cachedBlob && cachedBlob.size > 0) {
        const check = await inspectDownloadedPayload(cachedBlob, safeFileName);
        if (check.kind === 'valid') {
          const blobUrl = URL.createObjectURL(cachedBlob);
          triggerBrowserSaveHref(blobUrl, safeFileName, 60000);
          if (onProgress) onProgress('completed');
          notifyDownload(
            pickActiveLang('Đã tải về thành công "{name}"!', 'Successfully downloaded "{name}"!', '“{name}”下载成功！').replace('{name}', safeFileName),
            'success'
          );
          return true;
        }
      }
    }

    // 2. Data URL
    if (fetchUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(fetchUrl);
      const blobUrl = URL.createObjectURL(blob);
      triggerBrowserSaveHref(blobUrl, safeFileName, 60000);
      if (onProgress) onProgress('completed');
      notifyDownload(
        pickActiveLang('Đã tải về thành công "{name}"!', 'Successfully downloaded "{name}"!', '“{name}”下载成功！').replace('{name}', safeFileName),
        'success'
      );
      return true;
    }

    // 3. In-memory Blob URL
    if (fetchUrl.startsWith('blob:')) {
      triggerBrowserSaveHref(fetchUrl, safeFileName, 0);
      if (onProgress) onProgress('completed');
      notifyDownload(
        pickActiveLang('Đã tải về thành công "{name}"!', 'Successfully downloaded "{name}"!', '“{name}”下载成功！').replace('{name}', safeFileName),
        'success'
      );
      return true;
    }

    if (onProgress) onProgress('downloading');

    // 4. For huge same-origin files on Express (> 120MB) where HEAD confirms Content-Length
    // and full non-206 download, stream directly via native browser download manager to avoid RAM bloat.
    let headSize = 0;
    try {
      const headRes = await fetch(fetchUrl, { method: 'HEAD', cache: 'no-cache' });
      if (headRes.ok) {
        const headCt = (headRes.headers.get('content-type') || '').toLowerCase();
        if (headCt.includes('text/html') && !isHtmlOrMarkupFilename(safeFileName)) {
          throw new Error('FILE_NOT_FOUND_ON_SERVER');
        }
        headSize = Number(headRes.headers.get('content-length') || 0);
        const isDirectSameOriginExpress =
          fetchUrl.startsWith(window.location.origin) &&
          fetchUrl.includes('/api/files/download/') &&
          headSize > 120 * 1024 * 1024;
        if (isDirectSameOriginExpress) {
          triggerBrowserSaveHref(fetchUrl, safeFileName, 0);
          if (onProgress) onProgress('completed');
          notifyDownload(
            pickActiveLang('Đang tải xuống "{name}"...', 'Downloading "{name}"...', '正在下载“{name}”...').replace('{name}', safeFileName),
            'success'
          );
          return true;
        }
      } else if (headRes.status === 404 && !telegramOriginalUrl) {
        throw new Error('FILE_NOT_FOUND_ON_SERVER');
      }
    } catch (headErr: any) {
      if (headErr?.message === 'FILE_NOT_FOUND_ON_SERVER') {
        throw headErr;
      }
    }

    // 5. Verified download (handles full 200, multi-slice 206 Vercel streaming, and manifest shards)
    try {
      const verifiedBlob = await fetchVerifiedBlobFromUrl(fetchUrl, safeFileName, headSize || undefined);

      // Only cache moderately sized files in IndexedDB (<= 40MB) to preserve browser storage quota
      if (cacheKey && verifiedBlob.size <= 40 * 1024 * 1024) {
        storeFileBlobLocally(cacheKey, verifiedBlob).catch(() => {});
      }

      const blobUrl = URL.createObjectURL(verifiedBlob);
      triggerBrowserSaveHref(blobUrl, safeFileName, 60000);
      if (onProgress) onProgress('completed');
      notifyDownload(
        pickActiveLang('Đã tải về thành công "{name}"!', 'Successfully downloaded "{name}"!', '“{name}”下载成功！').replace('{name}', safeFileName),
        'success'
      );
      return true;
    } catch (fetchErr: any) {
      if (fetchErr?.message === 'FILE_NOT_FOUND_ON_SERVER') {
        throw fetchErr;
      }

      // If cross-origin external file URL failed browser CORS fetch, try Express /api/proxy-download then direct save
      const isCrossOriginExternal =
        /^https?:\/\//i.test(fetchUrl) &&
        !fetchUrl.startsWith(window.location.origin) &&
        !telegramOriginalUrl;

      if (isCrossOriginExternal) {
        try {
          const proxyUrl = `${window.location.origin}/api/proxy-download?url=${encodeURIComponent(fetchUrl)}&name=${encodeURIComponent(safeFileName)}`;
          const proxiedBlob = await fetchVerifiedBlobFromUrl(proxyUrl, safeFileName, headSize || undefined);
          if (cacheKey && proxiedBlob.size <= 40 * 1024 * 1024) {
            storeFileBlobLocally(cacheKey, proxiedBlob).catch(() => {});
          }
          const blobUrl = URL.createObjectURL(proxiedBlob);
          triggerBrowserSaveHref(blobUrl, safeFileName, 60000);
          if (onProgress) onProgress('completed');
          notifyDownload(
            pickActiveLang('Đã tải về thành công "{name}"!', 'Successfully downloaded "{name}"!', '“{name}”下载成功！').replace('{name}', safeFileName),
            'success'
          );
          return true;
        } catch {
          // Proxy absent on static hosting -> delegate to native browser download
          triggerBrowserSaveHref(fetchUrl, safeFileName, 0);
          if (onProgress) onProgress('completed');
          notifyDownload(
            pickActiveLang('Đang tải xuống "{name}"...', 'Downloading "{name}"...', '正在下载“{name}”...').replace('{name}', safeFileName),
            'success'
          );
          return true;
        }
      }

      // Only allow raw Telegram CDN direct link fallback if we genuinely extracted a direct api.telegram.org/file/bot URL
      if (telegramOriginalUrl) {
        triggerBrowserSaveHref(telegramOriginalUrl, safeFileName, 0);
        if (onProgress) onProgress('completed');
        notifyDownload(
          pickActiveLang('Đang tải về "{name}" trực tiếp từ Telegram!', 'Downloading "{name}" directly from Telegram!', '正在从 Telegram 直接下载“{name}”！').replace('{name}', safeFileName),
          'success'
        );
        return true;
      }

      throw fetchErr;
    }
  } catch (err: any) {
    if (onProgress) onProgress('error');
    if (err?.message === 'FILE_NOT_FOUND_ON_SERVER') {
      notifyDownload(
        pickActiveLang(
          'Tệp "{name}" không tồn tại trên máy chủ hiện tại (có thể tệp được tải lên ở máy chủ khác hoặc bộ nhớ tạm đã làm mới).',
          'File "{name}" does not exist on the current server (it may have been uploaded to another server or temporary storage was refreshed).',
          '文件“{name}”在当前服务器上不存在（可能上传于其他服务器或临时缓存已刷新）。'
        ).replace('{name}', safeFileName),
        'error'
      );
      return false;
    }

    const msg = err?.message || pickActiveLang('Không thể tải xuống tệp.', 'Unable to download file.', '无法下载文件。');
    notifyDownload(
      pickActiveLang('Lỗi khi tải "{name}": {error}', 'Error downloading "{name}": {error}', '下载“{name}”出错：{error}')
        .replace('{name}', safeFileName)
        .replace('{error}', msg),
      'error'
    );
    return false;
  }
}
