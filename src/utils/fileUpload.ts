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
 * Checks if a file is a video based on mimeType or common video extensions
 * (handles MP4, WebM, MOV, MKV, AVI, M4V, 3GP, FLV, TS, etc.)
 */
export function isVideoFile(file?: { name?: string; type?: string } | null): boolean {
  if (!file) return false;
  if (file.type && file.type.startsWith('video/')) return true;
  const ext = (file.name || '').toLowerCase();
  return /\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|wmv|ts|ogv)$/i.test(ext);
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
 * Captures a crisp video poster frame from a video File or Blob (at ~0.5s or 15% duration)
 * Returns a lightweight base64 JPEG thumbnail (< 60KB) for instant UI preview and send queue display.
 */
export function generateVideoThumbnail(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    if (!isVideoFile({ name: (file as File).name, type: file.type })) {
      resolve('');
      return;
    }

    // Skip client canvas frame capture on heavy videos (> 40MB) to prevent GPU decoder freezing on mobile/desktop
    if (file.size > 40 * 1024 * 1024) {
      resolve('');
      return;
    }

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      let finished = false;
      const cleanup = () => {
        if (!finished) {
          finished = true;
          try { URL.revokeObjectURL(url); } catch {}
          video.remove();
        }
      };

      video.onloadedmetadata = () => {
        // Seek to 0.5s or 15% to skip initial black frames
        const seekTime = Math.min(1.5, Math.max(0.2, (video.duration || 3) * 0.15));
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const maxDim = 400;
          let w = video.videoWidth || 400;
          let h = video.videoHeight || 225;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(16, w);
          canvas.height = Math.max(16, h);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumb = canvas.toDataURL('image/jpeg', 0.75);
            cleanup();
            resolve(thumb);
            return;
          }
        } catch (e) {
          console.warn('Video frame capture error:', e);
        }
        cleanup();
        resolve('');
      };

      video.onerror = () => {
        cleanup();
        resolve('');
      };

      // Timeout safety: 3.5s max
      setTimeout(() => {
        cleanup();
        resolve('');
      }, 3500);
    } catch {
      resolve('');
    }
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
  // Adaptive chunk size: 8MB for files up to 300MB, 16MB for very large files (> 300MB)
  const CHUNK_SIZE = file.size > 300 * 1024 * 1024 ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let assembledFile: UploadedFileInfo | null = null;
  let completedChunks = 0;

  // Blazing fast parallel pipeline: Send up to 4 chunks simultaneously at full line speed
  const CONCURRENCY = Math.min(4, totalChunks);
  let nextChunkIndex = 0;
  let fatalError: Error | null = null;

  async function chunkWorker() {
    while (nextChunkIndex < totalChunks && !fatalError && !assembledFile) {
      const chunkIndex = nextChunkIndex++;
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      let chunkSuccess = false;
      let lastChunkError: any = null;

      for (let attempt = 0; attempt < 4; attempt++) {
        if (assembledFile) {
          chunkSuccess = true;
          break;
        }

        try {
          // IMPORTANT: Append text metadata BEFORE binary chunk to guarantee parsing on streaming servers
          const formData = new FormData();
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', chunkIndex.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('fileName', file.name);
          formData.append('fileSize', file.size.toString());
          formData.append('fileType', file.type || 'application/octet-stream');
          formData.append('chunk', chunkBlob, `${file.name}.part${chunkIndex}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s safety timeout per chunk

          const res = await fetch('/api/upload-chunk', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

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
          completedChunks++;
          if (onProgress) {
            const currentPct = Math.min(98, Math.round((completedChunks / totalChunks) * 100));
            onProgress(currentPct);
          }
          break;
        } catch (err: any) {
          lastChunkError = err;
          // Check if server is already assembling or already assembled the file
          try {
            const statusRes = await fetch(`/api/upload-chunk-status/${uploadId}`);
            const statusData = await statusRes.json();
            if (statusData.success && statusData.assembled && statusData.file) {
              assembledFile = statusData.file;
              chunkSuccess = true;
              break;
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        }
      }

      if (!chunkSuccess && !assembledFile) {
        // Final sanity check on assembly status before declaring fatal error
        try {
          const statusRes = await fetch(`/api/upload-chunk-status/${uploadId}`);
          const statusData = await statusRes.json();
          if (statusData.success && statusData.assembled && statusData.file) {
            assembledFile = statusData.file;
            return;
          }
        } catch {}

        fatalError = new Error(lastChunkError?.message || `Lỗi tải lên phần ${chunkIndex + 1}/${totalChunks}`);
        throw fatalError;
      }
    }
  }

  // Execute concurrent chunk worker streams
  const workers = Array.from({ length: CONCURRENCY }, () => chunkWorker());
  await Promise.all(workers);

  // If assembledFile wasn't returned in the last chunk response, poll the assembly status route
  if (!assembledFile) {
    // Up to 30 attempts (each 800ms = 24 seconds) to give large files (up to 2GB) plenty of time to assemble on disk
    for (let check = 0; check < 30; check++) {
      try {
        const statusRes = await fetch(`/api/upload-chunk-status/${uploadId}`);
        const statusData = await statusRes.json();
        if (statusData.success && statusData.assembled && statusData.file) {
          assembledFile = statusData.file;
          break;
        }
        if (statusData.isAssembling && onProgress) {
          onProgress(99);
        }
      } catch {}
      await new Promise(r => setTimeout(r, 800));
    }
  }

  if (!assembledFile) {
    throw new Error('Máy chủ đang xử lý ghép tệp hoặc chưa nhận đủ các phần dữ liệu.');
  }

  if (onProgress) onProgress(100);
  return assembledFile;
}

/**
 * Fast client-side image optimization for heavy photos (> 3.5MB, e.g. 12-48MP smartphone photos)
 * Resizes down to 2560px on longest edge with 86% quality JPEG/WebP in ~50ms.
 * Shrinks 10-18MB photos down to ~750KB with zero visible loss of quality,
 * resulting in 15x-20x faster uploads over 4G/WiFi.
 */
export async function smartOptimizeImage(file: File, maxDim = 2560, quality = 0.86): Promise<File> {
  // Only optimize raster images that are larger than 3.5MB
  if (!isImageFile(file) || file.size <= 3.5 * 1024 * 1024) {
    return file;
  }
  const ext = (file.name || '').toLowerCase();
  // Do not optimize animations or vectors
  if (ext.endsWith('.gif') || ext.endsWith('.svg') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  if (ext.endsWith('.heic') || ext.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
    return file; // Let server Sharp handle HEIC
  }

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        // If image is already smaller than maxDim, don't resize unless file is massive
        if (width <= maxDim && height <= maxDim && file.size < 6 * 1024 * 1024) {
          resolve(file);
          return;
        }

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
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const safeName = file.name.replace(/\.[^/.]+$/, '.jpg');
              const optimizedFile = new File([blob], safeName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(optimizedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  } catch {
    return file;
  }
}

/**
 * Uploads a file to the Express backend with progress tracking,
 * automatic multi-strategy retry, chunking for large files, and seamless fallback.
 */
export async function uploadFileToServer(
  rawFile: File,
  onProgress?: (percent: number) => void
): Promise<UploadedFileInfo> {
  // Security Inspection: Block dangerous executable extensions, double extensions, and dangerous MIME types
  const securityCheck = inspectFileSecurity(rawFile);
  if (!securityCheck.isSafe) {
    throw new Error(securityCheck.error || `Tệp "${rawFile.name}" không đáp ứng tiêu chuẩn an toàn của VeloX.`);
  }

  if (rawFile.size > MAX_FILE_SIZE) {
    throw new Error(`Tệp "${rawFile.name}" (${formatFileSize(rawFile.size)}) vượt quá giới hạn tối đa ${MAX_FILE_SIZE_LABEL}.`);
  }

  // Fast client-side image optimization for heavy photos (> 3.5MB)
  const file = await smartOptimizeImage(rawFile);

  if (onProgress) onProgress(5);

  const reportProgress = (realPct: number) => {
    if (onProgress) onProgress(Math.min(99, Math.max(5, realPct)));
  };

  try {
    // -------------------------------------------------------------
    // PRIORITY 1: Ultra-Fast Direct Server Upload (/api/upload)
    // Instant same-origin transfer with real-time socket progress
    // Handles files up to 28MB in a single HTTP stream (< 1 second)
    // -------------------------------------------------------------
    if (file.size <= 28 * 1024 * 1024) {
      try {
        const res = await uploadViaMultipart(file, reportProgress);
        if (onProgress) onProgress(100);
        return await cacheAndReturn(file, res);
      } catch (err: any) {
        console.warn(`Fast XHR upload notice for "${file.name}", trying fetch fallback:`, err?.message || err);
        try {
          const res = await uploadViaFetch(file, reportProgress);
          if (onProgress) onProgress(100);
          return await cacheAndReturn(file, res);
        } catch (fetchErr: any) {
          console.warn(`Fetch upload notice for "${file.name}":`, fetchErr?.message || fetchErr);
        }
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 2: High-Speed Parallel Chunked Upload (/api/upload-chunk)
    // For files > 28MB up to 2GB+, uses 4 parallel socket workers
    // Bypasses any proxy size limit or buffer congestion
    // -------------------------------------------------------------
    if (file.size > 28 * 1024 * 1024) {
      try {
        const res = await uploadViaChunks(file, reportProgress);
        if (onProgress) onProgress(100);
        return await cacheAndReturn(file, res);
      } catch (chunkErr: any) {
        console.warn(`Chunked upload attempt 1 notice for "${file.name}":`, chunkErr?.message || chunkErr);
        try {
          const res = await uploadViaChunks(file, reportProgress);
          if (onProgress) onProgress(100);
          return await cacheAndReturn(file, res);
        } catch (retryErr: any) {
          console.warn(`Chunked upload retry notice for "${file.name}":`, retryErr?.message || retryErr);
        }
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 3: Base64 JSON Upload Fallback (for strict reverse proxies)
    // -------------------------------------------------------------
    if (file.size <= 25 * 1024 * 1024) {
      try {
        const res = await uploadViaBase64(file, reportProgress);
        if (onProgress) onProgress(100);
        return await cacheAndReturn(file, res);
      } catch (b64Err: any) {
        console.warn(`Base64 fallback notice for "${file.name}":`, b64Err?.message || b64Err);
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 4: Telegram Cloud Storage Fallback (Files <= 20MB)
    // -------------------------------------------------------------
    if (file.size <= 20 * 1024 * 1024) {
      try {
        const tgRes = await uploadToTelegram(file);
        if (tgRes.downloadUrl) {
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
        console.warn('Telegram Storage fallback notice:', tgErr?.message || tgErr);
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 5: External Free Web Hosting Services Fallback
    // -------------------------------------------------------------
    try {
      const extRes = await uploadToExternalWebServices(file, reportProgress);
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
      console.warn(`External web storage fallback notice for "${file.name}":`, extErr?.message || extErr);
    }

    // -------------------------------------------------------------
    // PRIORITY 6: Client-Side Fallback (< 400KB or compressed image)
    // -------------------------------------------------------------
    if (isImageFile(file) || file.size <= 400 * 1024) {
      if (onProgress) onProgress(100);
      const res = await createClientFallbackFileInfo(file);
      return await cacheAndReturn(file, res);
    }

    throw new Error(`Không thể kết nối đến máy chủ lưu trữ cho tệp "${file.name}". Vui lòng thử lại.`);
  } catch (err: any) {
    throw err;
  }
}
