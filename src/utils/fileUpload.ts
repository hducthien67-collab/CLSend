import { inspectFileSecurity, sanitizeFilename } from './fileSecurity';
import { getTelegramConfig, uploadToTelegram } from './telegramStorage';
import { storeFileBlobLocally } from './idbStorage';
import { uploadToExternalWebServices } from './externalStorage';

async function cacheAndReturn(file: File, fileInfo: UploadedFileInfo): Promise<UploadedFileInfo> {
  try {
    const url = fileInfo.url || '';
    let fileId = '';
    if (url.includes('/api/files/download/')) {
      fileId = url.split('/api/files/download/')[1]?.split('?')[0];
    } else if (fileInfo.id) {
      fileId = fileInfo.id;
    }
    if (fileId) {
      await storeFileBlobLocally(fileId, file);
    }
  } catch (e) {
    console.warn('IDB caching warning:', e);
  }
  return fileInfo;
}

export interface UploadedFileInfo {
  id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  url: string;
  viewUrl: string;
  thumbnail?: string;
  isHeic?: boolean;
}

// 10 GB limit for high-speed local & cloud transfers (unlimited feel)
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '10 GB';

/**
 * Checks if a file is an image based on mimeType or common extensions
 * (handles phone camera photos, iPhone HEIC/HEIF, RAW, etc.)
 */
export function isImageFile(file?: { name?: string; type?: string } | null): boolean {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|dng|raw|svg|avif)$/i.test(ext);
}

/**
 * Formats file size in readable units
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Creates a fast lightweight base64 thumbnail for images (for immediate chat/card preview)
 * Safely handles HEIC and phone photos without corrupting base64.
 */
export function generateImageThumbnail(file: File, maxDim: number = 480, quality: number = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!isImageFile(file)) {
      resolve('');
      return;
    }

    const lowerName = file.name.toLowerCase();
    // Native browser Image() cannot decode HEIC/HEIF; let the server thumbnail handle it
    if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawData = e.target?.result as string;
      if (!rawData || !rawData.startsWith('data:image/')) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', quality);
          resolve(thumb);
        } else {
          resolve('');
        }
      };
      img.onerror = () => {
        resolve('');
      };
      img.src = rawData;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image to a high quality yet lightweight Base64 string (< 700KB)
 * for seamless direct transfer fallback when server proxy is unreachable.
 */
export function compressImageForDirectTransfer(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    if (!isImageFile(file)) {
      resolve('');
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawData = e.target?.result as string;
      if (!rawData || !rawData.startsWith('data:image/')) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const result = canvas.toDataURL('image/jpeg', quality);
          resolve(result);
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = rawData;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a File object to Base64 string safely
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Fallback upload via JSON/Base64 when multipart form-data is blocked or severed by proxy
 */
async function uploadViaBase64(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  if (onProgress) onProgress(30);
  const base64Data = await fileToBase64(file);
  if (onProgress) onProgress(60);

  const res = await fetch('/api/upload-base64', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      data: base64Data,
      type: file.type || 'application/octet-stream'
    })
  });

  if (onProgress) onProgress(90);

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Tải tệp "${file.name}" thất bại.`);
  }

  const json = await res.json();
  if (!json.success || !json.file) {
    throw new Error(json.error || 'Máy chủ không thể lưu tệp.');
  }

  if (onProgress) onProgress(100);
  return json.file;
}

/**
 * Generates a safe client-side representation of a file (under 600KB)
 * so it never exceeds Firestore document property size limits (1,048,487 bytes).
 */
export async function createClientFallbackFileInfo(file: File): Promise<UploadedFileInfo> {
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const isHeic = ext === 'heic' || ext === 'heif';
  let thumb: string | undefined = undefined;
  let safeDataUrl = '';

  if (isImageFile(file)) {
    // Generate a lightweight thumbnail
    thumb = await generateImageThumbnail(file, 480, 0.75).catch(() => undefined);
    // For direct preview/transfer, compress image to safe size (< 400KB)
    safeDataUrl = await compressImageForDirectTransfer(file, 960, 0.75).catch(() => '');
  } else if (file.size <= 400 * 1024) {
    // Only small non-image files (< 400KB) can be safely embedded as Base64 in Firestore
    safeDataUrl = await fileToBase64(file).catch(() => '');
  }

  return {
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: file.name,
    originalName: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url: safeDataUrl,
    viewUrl: safeDataUrl,
    thumbnail: thumb || (isImageFile(file) ? safeDataUrl : undefined),
    isHeic: isHeic
  };
}

/**
 * Standard fetch upload via multipart/form-data
 */
async function uploadViaFetch(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  if (onProgress) onProgress(20);
  const formData = new FormData();
  formData.append('file', file);

  if (onProgress) onProgress(40);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (onProgress) onProgress(80);
  const rawText = await res.text();

  if (rawText.startsWith('<') || rawText.includes('<!doctype') || rawText.includes('<html')) {
    throw new Error('HTML_RESPONSE');
  }

  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error('INVALID_JSON');
  }

  if (!res.ok || !json.success || !json.file) {
    throw new Error(json?.error || `Lỗi tải tệp (${res.status})`);
  }

  if (onProgress) onProgress(100);
  return json.file;
}

/**
 * Low-level XHR multipart upload attempt
 */
function uploadViaMultipart(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.timeout = 300000; // 5 minutes
    xhr.open('POST', '/api/upload', true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(98, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      const status = xhr.status;
      const rawText = (xhr.responseText || '').trim();
      const contentType = xhr.getResponseHeader('Content-Type') || '';

      if (rawText.startsWith('<') || rawText.startsWith('<!doctype') || contentType.includes('text/html')) {
        reject(new Error('HTML_RESPONSE'));
        return;
      }

      if (status >= 200 && status < 300) {
        try {
          const res = JSON.parse(rawText);
          if (res.success && res.file) {
            if (onProgress) onProgress(100);
            resolve(res.file);
          } else {
            reject(new Error(res.error || 'Tải tệp lên không thành công'));
          }
        } catch {
          reject(new Error('INVALID_JSON'));
        }
      } else {
        let msg = `Lỗi HTTP ${status}`;
        try {
          const errRes = JSON.parse(rawText);
          if (errRes.error) msg = errRes.error;
        } catch {
          if (status === 413) {
            msg = 'Tệp vượt quá kích thước cho phép của hệ thống.';
          }
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('NETWORK_ERROR'));
    };

    xhr.ontimeout = () => {
      reject(new Error('TIMEOUT_ERROR'));
    };

    xhr.onabort = () => {
      reject(new Error('Quá trình tải tệp đã bị hủy.'));
    };

    xhr.send(formData);
  });
}

/**
 * Resilient Chunked Upload (8MB chunks)
 * Completely bypasses Cloud Run 32MB request limits, proxy buffering, and timeouts.
 * Supports auto-retry per chunk for high reliability on mobile and desktop.
 */
export async function uploadViaChunks(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let assembledFile: UploadedFileInfo | null = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    let chunkSuccess = false;
    let lastChunkError: any = null;

    // Retry each chunk up to 3 times on transient network error
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const formData = new FormData();
        formData.append('chunk', chunkBlob, `${file.name}.part${chunkIndex}`);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('fileSize', file.size.toString());
        formData.append('fileType', file.type || 'application/octet-stream');

        const res = await fetch('/api/upload-chunk', {
          method: 'POST',
          body: formData
        });

        const rawText = await res.text();
        if (rawText.startsWith('<') || rawText.includes('<!doctype') || rawText.includes('<html')) {
          throw new Error('HTML_RESPONSE');
        }

        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error('INVALID_JSON');
        }

        if (!res.ok || !data.success) {
          throw new Error(data?.error || `Lỗi tải mảnh HTTP ${res.status}`);
        }

        if (data.assembled && data.file) {
          assembledFile = data.file;
        }

        chunkSuccess = true;
        break;
      } catch (err: any) {
        lastChunkError = err;
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }

    if (!chunkSuccess) {
      throw new Error(lastChunkError?.message || `Lỗi tải lên phần ${chunkIndex + 1}/${totalChunks}`);
    }

    if (onProgress) {
      const currentPct = Math.min(99, Math.round(((chunkIndex + 1) / totalChunks) * 100));
      onProgress(currentPct);
    }
  }

  if (!assembledFile) {
    throw new Error('Máy chủ chưa nhận đủ dữ liệu các phần của tệp.');
  }

  if (onProgress) onProgress(100);
  return assembledFile;
}

/**
 * Uploads a file to the Express backend with progress tracking,
 * automatic multi-strategy retry, chunking for large files, and seamless fallback.
 */
export async function uploadFileToServer(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  // Security Inspection: Block dangerous executable extensions, double extensions, and dangerous MIME types
  const securityCheck = inspectFileSecurity(file);
  if (!securityCheck.isSafe) {
    throw new Error(securityCheck.error || `Tệp "${file.name}" không đáp ứng tiêu chuẩn an toàn của VeloX.`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Tệp "${file.name}" (${formatFileSize(file.size)}) vượt quá giới hạn tối đa ${MAX_FILE_SIZE_LABEL}.`);
  }

  // Smooth interpolated progress ticker
  let targetPct = 5;
  let displayedPct = 5;
  if (onProgress) onProgress(displayedPct);

  const progressInterval = setInterval(() => {
    if (displayedPct < targetPct) {
      displayedPct += 1;
      if (onProgress) onProgress(displayedPct);
    } else if (displayedPct < 90 && targetPct < 90) {
      targetPct += 1; // gradually increase target towards 90%
    }
  }, 30); // 30ms per percent for buttery smooth 1-by-1 increment

  const clearProgressTimer = () => {
    if (progressInterval) clearInterval(progressInterval);
  };

  const reportProgress = (realPct: number) => {
    if (realPct > targetPct) {
      targetPct = Math.min(99, realPct);
    }
  };

  try {
    // Strategy 0: High-speed Telegram Cloud Storage (Files <= 20MB)
    if (file.size <= 20 * 1024 * 1024) {
      try {
        const tgRes = await uploadToTelegram(file);
        if (tgRes.downloadUrl) {
          clearProgressTimer();
          if (onProgress) onProgress(100);
          return await cacheAndReturn(file, {
            id: tgRes.fileId,
            name: file.name,
            originalName: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: tgRes.downloadUrl,
            viewUrl: tgRes.viewUrl || tgRes.downloadUrl,
            thumbnail: isImageFile(file) ? tgRes.downloadUrl : undefined
          });
        }
      } catch (tgErr: any) {
        console.warn('Telegram Storage notice, transferring to high-speed CLSend storage:', tgErr?.message || tgErr);
      }
    }

    // Strategy 1: Chunked Upload (> 15MB)
    if (file.size > 15 * 1024 * 1024) {
      try {
        const res = await uploadViaChunks(file, reportProgress);
        clearProgressTimer();
        if (onProgress) onProgress(100);
        return await cacheAndReturn(file, res);
      } catch (chunkErr: any) {
        console.warn(`Primary chunked upload strategy notice for "${file.name}":`, chunkErr?.message || chunkErr);
      }
    }

    // Strategy 2: Standard Fetch multipart upload
    try {
      const res = await uploadViaFetch(file, reportProgress);
      clearProgressTimer();
      if (onProgress) onProgress(100);
      return await cacheAndReturn(file, res);
    } catch (err: any) {
      console.warn(`Fetch upload strategy notice for "${file.name}":`, err?.message || err);
    }

    // Strategy 3: Fallback to Chunked Upload
    try {
      const res = await uploadViaChunks(file, reportProgress);
      clearProgressTimer();
      if (onProgress) onProgress(100);
      return await cacheAndReturn(file, res);
    } catch (fallbackChunkErr: any) {
      console.warn(`Fallback chunked upload notice for "${file.name}":`, fallbackChunkErr?.message || fallbackChunkErr);
    }

    // Strategy 4: Base64 JSON upload (<= 30MB)
    if (file.size <= 30 * 1024 * 1024) {
      try {
        const res = await uploadViaBase64(file, reportProgress);
        clearProgressTimer();
        if (onProgress) onProgress(100);
        return await cacheAndReturn(file, res);
      } catch (fallbackErr: any) {
        console.warn(`Base64 upload strategy notice for "${file.name}":`, fallbackErr?.message || fallbackErr);
      }
    }

    // Strategy 5: XHR multipart upload
    try {
      const res = await uploadViaMultipart(file, reportProgress);
      clearProgressTimer();
      if (onProgress) onProgress(100);
      return await cacheAndReturn(file, res);
    } catch (xhrErr: any) {
      console.warn(`XHR upload strategy notice for "${file.name}":`, xhrErr?.message || xhrErr);
    }

    // Strategy 5.5: External Free Web Hosting Services
    try {
      const extRes = await uploadToExternalWebServices(file, reportProgress);
      clearProgressTimer();
      if (onProgress) onProgress(100);
      return await cacheAndReturn(file, {
        id: `ext-${Date.now()}`,
        name: extRes.name,
        originalName: extRes.name,
        size: extRes.size,
        type: extRes.type,
        url: extRes.url,
        viewUrl: extRes.url,
        thumbnail: isImageFile(file) ? extRes.url : undefined
      });
    } catch (extErr: any) {
      console.warn(`External web storage strategy notice for "${file.name}":`, extErr?.message || extErr);
    }

    // Strategy 6: Client-side fallback (< 400KB or image)
    if (isImageFile(file) || file.size <= 400 * 1024) {
      clearProgressTimer();
      if (onProgress) onProgress(100);
      const res = await createClientFallbackFileInfo(file);
      return await cacheAndReturn(file, res);
    }

    clearProgressTimer();
    throw new Error(`Không thể kết nối đến máy chủ lưu trữ cho tệp "${file.name}". Vui lòng thử lại.`);
  } catch (err: any) {
    clearProgressTimer();
    throw err;
  }
}
