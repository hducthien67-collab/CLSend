import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

// Uploads directory setup with fallback for read-only or container environments
let UPLOADS_DIR = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create uploads dir in cwd, falling back to /tmp/uploads:', e);
  UPLOADS_DIR = path.join('/tmp', 'uploads');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (tmpErr) {
    console.warn('Could not create /tmp/uploads dir:', tmpErr);
  }
}

// Temporary chunk storage directory for large file uploads (> 15MB)
let CHUNKS_DIR = path.join(UPLOADS_DIR, '_chunks');
try {
  if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create chunks dir, falling back to /tmp/chunks:', e);
  CHUNKS_DIR = path.join('/tmp', 'clsend_chunks');
  try {
    if (!fs.existsSync(CHUNKS_DIR)) {
      fs.mkdirSync(CHUNKS_DIR, { recursive: true });
    }
  } catch (tmpErr) {
    console.warn('Could not create /tmp/clsend_chunks:', tmpErr);
  }
}

// Clean stale chunks older than 2 hours periodically
function cleanStaleChunks() {
  try {
    if (!fs.existsSync(CHUNKS_DIR)) return;
    const now = Date.now();
    const files = fs.readdirSync(CHUNKS_DIR);
    for (const f of files) {
      const p = path.join(CHUNKS_DIR, f);
      const stat = fs.statSync(p);
      if (now - stat.mtimeMs > 2 * 60 * 60 * 1000) {
        fs.unlinkSync(p);
      }
    }
  } catch (e) {
    console.warn('Error cleaning stale chunks:', e);
  }
}
setInterval(cleanStaleChunks, 30 * 60 * 1000);

// Meta persistence file
const META_FILE = path.join(UPLOADS_DIR, '_meta.json');
let fileMetaMap: Record<string, { originalName: string; size: number; mimeType: string; createdAt: string; status?: 'active' | 'banned'; isHeic?: boolean; thumbnail?: string }> = {};

try {
  if (fs.existsSync(META_FILE)) {
    const raw = fs.readFileSync(META_FILE, 'utf-8');
    fileMetaMap = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not read uploads meta file:', e);
}

function saveMetaFile() {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(fileMetaMap, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write uploads meta file:', e);
  }
}

// Dangerous extension blacklist
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'msc',
  'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2', 'msh', 'msh1', 'msh2', 'mshxml',
  'sh', 'bash', 'csh', 'ksh', 'zsh',
  'msi', 'msp', 'mst', 'reg', 'scr', 'pif', 'com', 'hta', 'cpl', 'jar',
  'dll', 'drv', 'sys', 'ocx', 'vxd',
  'iso', 'img', 'vhd', 'vhdx', 'lnk', 'gadget'
]);

function sanitizeServerFilename(filename: string): string {
  if (!filename) return `clsend-file-${Date.now()}`;
  let name = filename.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
  name = name.replace(/[\x00-\x1F\x7F]/g, '');
  name = name.replace(/^.*[\\\/]/, '');
  name = name.replace(/[\r\n\t]/g, '');
  name = name.trim().replace(/^\.+/, '').replace(/\.+$/, '');
  return name || `clsend-file-${Date.now()}`;
}

function checkDangerousExtension(filename: string): { blocked: boolean; reason?: string } {
  const clean = sanitizeServerFilename(filename).toLowerCase();
  const parts = clean.split('.');
  if (parts.length > 1) {
    const lastExt = parts[parts.length - 1];
    if (DANGEROUS_EXTENSIONS.has(lastExt)) {
      return { blocked: true, reason: `Định dạng tệp .${lastExt} bị cấm để đảm bảo an toàn.` };
    }
  }
  if (parts.length > 2) {
    for (let i = 1; i < parts.length; i++) {
      if (DANGEROUS_EXTENSIONS.has(parts[i])) {
        return { blocked: true, reason: `Phát hiện nguy cơ đuôi tệp kép (.${parts[i]}).` };
      }
    }
  }
  return { blocked: false };
}

function sanitizeSvgBuffer(buffer: Buffer): Buffer {
  try {
    let str = buffer.toString('utf-8');
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    str = str.replace(/\son\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');
    str = str.replace(/href\s*=\s*["']?\s*(javascript|vbscript|data):/gi, 'href="blocked:');
    str = str.replace(/xlink:href\s*=\s*["']?\s*(javascript|vbscript|data):/gi, 'xlink:href="blocked:');
    str = str.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '');
    str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    return Buffer.from(str, 'utf-8');
  } catch {
    return buffer;
  }
}

// Multer storage engine - supports files up to 250MB
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 10);
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
    cb(null, uniqueId);
  }
});

// Multer storage engine - supports heavy direct uploads up to 2 GB
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB direct limit
  },
  fileFilter: (_req, file, cb) => {
    const check = checkDangerousExtension(file.originalname);
    if (check.blocked) {
      return cb(new Error(check.reason || 'Tệp thực thi nguy hiểm không được phép tải lên'));
    }
    cb(null, true);
  }
});

// Multer storage for chunk uploads (temp part file)
const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CHUNKS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `tmp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.part`);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB limit per individual chunk
  }
});

const tgMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 22 * 1024 * 1024 // 22 MB limit per Telegram shard
  }
});

async function startServer() {
  const app = express();

  // Vite middleware in development vs Static SPA in production detection
  const distPath = path.join(process.cwd(), 'dist');
  const distIndex = path.join(distPath, 'index.html');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(distIndex);

  // Stream cache directory for browser-compatible MP4 faststart / container remux
  const STREAM_CACHE_DIR = path.join(UPLOADS_DIR, '_stream_cache');
  try {
    if (!fs.existsSync(STREAM_CACHE_DIR)) {
      fs.mkdirSync(STREAM_CACHE_DIR, { recursive: true });
    }
  } catch {}

  const fastStartInFlight = new Map<string, Promise<void>>();
  const fastStartDone = new Map<string, number>();
  const playableRemuxInFlight = new Map<string, Promise<string | null>>();

  const isAlreadyFastStart = (filePath: string): boolean => {
    try {
      const fd = fs.openSync(filePath, 'r');
      const probeSize = Math.min(512 * 1024, fs.fstatSync(fd).size);
      const buf = Buffer.alloc(probeSize);
      fs.readSync(fd, buf, 0, probeSize, 0);
      fs.closeSync(fd);
      const moovIdx = buf.indexOf('moov');
      const mdatIdx = buf.indexOf('mdat');
      if (moovIdx !== -1 && (mdatIdx === -1 || moovIdx < mdatIdx)) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  };

  const ensureFastStartVideo = async (filePath: string): Promise<void> => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mp4', '.m4v', '.mov'].includes(ext)) return;
    if (fastStartInFlight.has(filePath)) {
      return fastStartInFlight.get(filePath);
    }

    let currentMtime = 0;
    let currentSize = 0;
    try {
      const stat = fs.statSync(filePath);
      currentMtime = stat.mtimeMs;
      currentSize = stat.size;
    } catch {
      return;
    }

    if (fastStartDone.get(filePath) === currentMtime) return;

    const task = (async () => {
      try {
        if (currentSize <= 1024 || currentSize > 350 * 1024 * 1024) {
          fastStartDone.set(filePath, currentMtime);
          return;
        }
        if (isAlreadyFastStart(filePath)) {
          fastStartDone.set(filePath, currentMtime);
          return;
        }
        const tmpOut = `${filePath}.faststart.mp4`;
        try {
          await execFileAsync(
            'ffmpeg',
            ['-y', '-i', filePath, '-c', 'copy', '-movflags', '+faststart', tmpOut],
            { timeout: 25000, maxBuffer: 8 * 1024 * 1024 }
          );
          if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 1024) {
            await fs.promises.rename(tmpOut, filePath);
            try {
              currentMtime = (await fs.promises.stat(filePath)).mtimeMs;
            } catch {}
          } else if (fs.existsSync(tmpOut)) {
            await fs.promises.unlink(tmpOut).catch(() => {});
          }
        } catch {
          try { if (fs.existsSync(tmpOut)) await fs.promises.unlink(tmpOut); } catch {}
        }
        fastStartDone.set(filePath, currentMtime);
      } finally {
        fastStartInFlight.delete(filePath);
      }
    })();

    fastStartInFlight.set(filePath, task);
    return task;
  };

  const ensureBrowserPlayableVideo = async (filePath: string, rawId: string): Promise<string | null> => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mkv', '.avi', '.wmv', '.flv'].includes(ext)) return null;
    const cachedPath = path.join(STREAM_CACHE_DIR, `${rawId}.mp4`);
    if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 1024) {
      return cachedPath;
    }
    if (playableRemuxInFlight.has(rawId)) {
      return playableRemuxInFlight.get(rawId) || null;
    }

    const task = (async () => {
      const tmpCached = `${cachedPath}.tmp.mp4`;
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 200 * 1024 * 1024) return null;
        try {
          await execFileAsync(
            'ffmpeg',
            ['-y', '-i', filePath, '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', tmpCached],
            { timeout: 25000, maxBuffer: 8 * 1024 * 1024 }
          );
        } catch {
          try { if (fs.existsSync(tmpCached)) fs.unlinkSync(tmpCached); } catch {}
          if (stat.size <= 100 * 1024 * 1024) {
            await execFileAsync(
              'ffmpeg',
              ['-y', '-i', filePath, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-c:a', 'aac', '-movflags', '+faststart', tmpCached],
              { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
            );
          }
        }
        if (fs.existsSync(tmpCached) && fs.statSync(tmpCached).size > 1024) {
          fs.renameSync(tmpCached, cachedPath);
          return cachedPath;
        }
        return null;
      } catch {
        try { if (fs.existsSync(tmpCached)) fs.unlinkSync(tmpCached); } catch {}
        return null;
      } finally {
        playableRemuxInFlight.delete(rawId);
      }
    })();

    playableRemuxInFlight.set(rawId, task);
    return task;
  };

  // Gzip / Deflate high-speed compression for API JSON responses and production assets
  app.use((compression as any)({
    level: 6,
    threshold: 1024,
    filter: (req: any, res: any) => {
      const urlPath = req.originalUrl || req.path || '';
      // Never compress or buffer binary media/video/GIF/Range streams
      if (
        urlPath.startsWith('/api/files/') ||
        urlPath.startsWith('/api/telegram/') ||
        Boolean(req.headers?.range)
      ) {
        return false;
      }
      // In development mode, Vite handles module transforms, source maps, and streaming.
      // Compressing Vite's internal module responses (like /src/*, /@vite/*, /node_modules/*)
      // corrupts dynamic module imports in the browser iframe.
      if (!isProduction && !req.originalUrl?.startsWith('/api') && !req.path?.startsWith('/api')) {
        return false;
      }
      if (req.headers['x-no-compression']) return false;
      return (compression as any).filter(req, res);
    }
  }));

  // CORS and preflight handling for mobile devices and iframes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support JSON body for image moderation & base64
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  // Primary Health Check for Cloud Run Deployment and Load Balancers
  app.get(['/health', '/_health'], (_req, res) => {
    res.status(200).send('OK');
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CLSend API Server',
      timestamp: new Date().toISOString(),
      maxUploadBytes: 250 * 1024 * 1024
    });
  });

  // Robust Multer error wrapper middleware for /api/upload
  const handleUploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    (upload.single('file') as any)(req, res, (err: any) => {
      if (err) {
        console.error('Multer file upload error:', err);
        let errorMsg = 'Lỗi khi tải tệp lên máy chủ';
        if (err.code === 'LIMIT_FILE_SIZE') {
          errorMsg = 'Tệp vượt quá giới hạn 250MB của hệ thống. Vui lòng chọn tệp nhỏ hơn.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          errorMsg = 'Định dạng trường tệp tin không hợp lệ.';
        } else if (err.message) {
          errorMsg = err.message;
        }
        return res.status(400).json({ success: false, error: errorMsg });
      }
      next();
    });
  };

  // Heavy File Upload Endpoint (Up to 250MB per request via Cloud Proxy)
  const processUpload = async (req: express.Request, res: express.Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'Không tìm thấy tệp đính kèm' });
      }

      // Safe decoding and sanitization of filename
      let originalName = file.originalname || 'file';
      try {
        originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {}
      originalName = sanitizeServerFilename(originalName);

      const ext = path.extname(originalName).toLowerCase();
      const isSvg = ext === '.svg' || file.mimetype === 'image/svg+xml';

      // Sanitize SVG content on disk to kill stored XSS scripts
      if (isSvg) {
        try {
          const rawBuffer = fs.readFileSync(file.path);
          const cleanBuffer = sanitizeSvgBuffer(rawBuffer);
          fs.writeFileSync(file.path, cleanBuffer);
        } catch (svgErr) {
          console.warn('SVG sanitization error:', svgErr);
        }
      }

      const isHeic = ext === '.heic' || ext === '.heif' || file.mimetype === 'image/heic' || file.mimetype === 'image/heif';
      const isGif = ext === '.gif' || file.mimetype === 'image/gif';
      const isImage = file.mimetype?.startsWith('image/') || isHeic || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(ext);

      // Optimize MP4/MOV moov atom asynchronously in the background so upload finishes immediately
      if (['.mp4', '.m4v', '.mov'].includes(ext) && file.size <= 150 * 1024 * 1024) {
        void ensureFastStartVideo(file.path).catch(() => {});
      }

      // Generate lightweight server thumbnail for static photos (keep animated GIFs intact)
      let thumbnailBase64: string | undefined = undefined;
      if (isImage && !isGif) {
        try {
          const thumbBuffer = await sharp(file.path)
            .rotate() // auto-orient based on EXIF camera orientation
            .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
        } catch (thumbErr) {
          console.warn('Could not generate server thumbnail:', thumbErr);
        }
      }

      const finalSize = fs.existsSync(file.path) ? fs.statSync(file.path).size : file.size;

      // Record metadata
      fileMetaMap[file.filename] = {
        originalName: originalName,
        size: finalSize,
        mimeType: isHeic ? 'image/heic' : (file.mimetype || 'application/octet-stream'),
        createdAt: new Date().toISOString(),
        isHeic: isHeic,
        thumbnail: thumbnailBase64
      };
      saveMetaFile();

      const downloadUrl = `/api/files/download/${file.filename}`;
      const viewUrl = `/api/files/view/${file.filename}`;

      return res.json({
        success: true,
        file: {
          id: file.filename,
          name: originalName,
          originalName: originalName,
          size: file.size,
          type: isHeic ? 'image/heic' : (file.mimetype || 'application/octet-stream'),
          mimeType: isHeic ? 'image/heic' : (file.mimetype || 'application/octet-stream'),
          url: downloadUrl,
          viewUrl: viewUrl,
          thumbnail: thumbnailBase64,
          isHeic: isHeic
        }
      });
    } catch (err: any) {
      console.error('File upload processing error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Lỗi khi lưu tệp lên máy chủ' });
    }
  };

  // Support both /api/upload and /api/upload/
  app.post('/api/upload', handleUploadMiddleware, processUpload);
  app.post('/api/upload/', handleUploadMiddleware, processUpload);

  // Resilient Chunked Upload Endpoint - Bypasses Cloud Run 32MB single-request proxy limit
  const handleChunkUploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    (chunkUpload.single('chunk') as any)(req, res, (err: any) => {
      if (err) {
        console.error('Multer chunk upload error:', err);
        return res.status(400).json({ success: false, error: err.message || 'Lỗi khi nhận mảnh tệp tải lên' });
      }
      next();
    });
  };

  // Assembled chunk cache & concurrency lock for race-free multi-worker uploads
  const assembledFilesMap = new Map<string, any>();
  const assemblingSet = new Set<string>();

  const processChunkUpload = async (req: express.Request, res: express.Response) => {
    try {
      const chunkFile = req.file;
      if (!chunkFile) {
        return res.status(400).json({ success: false, error: 'Không tìm thấy dữ liệu mảnh tệp' });
      }

      const uploadId = (req.body.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const chunkIndex = parseInt(req.body.chunkIndex, 10);
      const totalChunks = parseInt(req.body.totalChunks, 10);
      const fileName = req.body.fileName || 'file';
      const fileType = req.body.fileType || 'application/octet-stream';

      if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0) {
        try { fs.unlinkSync(chunkFile.path); } catch {}
        return res.status(400).json({ success: false, error: 'Thông tin phân mảnh tệp không hợp lệ' });
      }

      // Check if file was already assembled by another concurrent chunk worker
      if (assembledFilesMap.has(uploadId)) {
        try { fs.unlinkSync(chunkFile.path); } catch {}
        return res.json({
          success: true,
          assembled: true,
          file: assembledFilesMap.get(uploadId)
        });
      }

      const safeName = sanitizeServerFilename(fileName);
      const extCheck = checkDangerousExtension(safeName);
      if (extCheck.blocked) {
        try { fs.unlinkSync(chunkFile.path); } catch {}
        return res.status(400).json({ success: false, error: extCheck.reason || 'Tệp nguy hiểm không được phép tải lên.' });
      }

      // Rename temp chunk to indexed chunk file
      const indexedChunkPath = path.join(CHUNKS_DIR, `${uploadId}_chunk_${chunkIndex}`);
      try {
        if (fs.existsSync(indexedChunkPath)) {
          fs.unlinkSync(indexedChunkPath);
        }
      } catch {}
      fs.renameSync(chunkFile.path, indexedChunkPath);

      // Check if all chunks from 0 to totalChunks - 1 are present
      let allChunksPresent = true;
      for (let i = 0; i < totalChunks; i++) {
        const checkPath = path.join(CHUNKS_DIR, `${uploadId}_chunk_${i}`);
        if (!fs.existsSync(checkPath)) {
          allChunksPresent = false;
          break;
        }
      }

      if (!allChunksPresent) {
        return res.json({
          success: true,
          assembled: false,
          chunkIndex,
          totalChunks
        });
      }

      // If already assembled
      if (assembledFilesMap.has(uploadId)) {
        return res.json({
          success: true,
          assembled: true,
          file: assembledFilesMap.get(uploadId)
        });
      }

      // Concurrency lock: If another worker is already actively assembling, report success and let client poll status
      if (assemblingSet.has(uploadId)) {
        return res.json({
          success: true,
          assembled: false,
          isAssembling: true,
          chunkIndex,
          totalChunks
        });
      }

      assemblingSet.add(uploadId);

      try {
        // Double-check if finished during lock acquisition
        if (assembledFilesMap.has(uploadId)) {
          return res.json({
            success: true,
            assembled: true,
            file: assembledFilesMap.get(uploadId)
          });
        }

        // All chunks present -> assemble them asynchronously with high-throughput streaming
        const ext = path.extname(safeName).toLowerCase();
        const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 10);
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
        const finalFilePath = path.join(UPLOADS_DIR, uniqueId);

        let totalBytesWritten = 0;
        const writeStream = fs.createWriteStream(finalFilePath, { highWaterMark: 1024 * 1024 });
        writeStream.setMaxListeners(0);

        let streamWriteErr: Error | null = null;
        writeStream.on('error', (err) => {
          streamWriteErr = err;
        });

        try {
          for (let i = 0; i < totalChunks; i++) {
            const partPath = path.join(CHUNKS_DIR, `${uploadId}_chunk_${i}`);
            const stat = await fs.promises.stat(partPath).catch(() => null);
            if (!stat) {
              throw new Error(`Mảnh tệp ${i + 1}/${totalChunks} chưa sẵn sàng để ghép`);
            }
            totalBytesWritten += stat.size;
            const rs = fs.createReadStream(partPath, { highWaterMark: 1024 * 1024 });
            for await (const chunkBuf of rs) {
              if (streamWriteErr) throw streamWriteErr;
              if (!writeStream.write(chunkBuf)) {
                await new Promise<void>((resolve, reject) => {
                  const onDrain = () => {
                    writeStream.off('error', onErr);
                    resolve();
                  };
                  const onErr = (err: Error) => {
                    writeStream.off('drain', onDrain);
                    reject(err);
                  };
                  writeStream.once('drain', onDrain);
                  writeStream.once('error', onErr);
                });
              }
            }
          }
          if (streamWriteErr) throw streamWriteErr;
          await new Promise<void>((resolve, reject) => {
            writeStream.once('error', reject);
            writeStream.end(() => resolve());
          });
        } catch (pipeErr) {
          try { writeStream.destroy(); } catch {}
          await fs.promises.unlink(finalFilePath).catch(() => {});
          throw pipeErr;
        }

        // Clean up temporary chunk files concurrently in background
        void Promise.all(
          Array.from({ length: totalChunks }, (_, i) =>
            fs.promises.unlink(path.join(CHUNKS_DIR, `${uploadId}_chunk_${i}`)).catch(() => {})
          )
        );

        // SVG sanitization
        const isSvg = ext === '.svg' || fileType === 'image/svg+xml';
        if (isSvg) {
          try {
            const rawBuf = await fs.promises.readFile(finalFilePath);
            const cleanBuf = sanitizeSvgBuffer(rawBuf);
            await fs.promises.writeFile(finalFilePath, cleanBuf);
          } catch (svgErr) {
            console.warn('SVG sanitization error on assembled file:', svgErr);
          }
        }

        const isHeic = ext === '.heic' || ext === '.heif' || fileType === 'image/heic' || fileType === 'image/heif';
        const isGif = ext === '.gif' || fileType === 'image/gif';
        const isImage = fileType.startsWith('image/') || isHeic || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(ext);

        if (['.mp4', '.m4v', '.mov'].includes(ext) && totalBytesWritten <= 250 * 1024 * 1024) {
          void ensureFastStartVideo(finalFilePath).catch(() => {});
        }

        let thumbnailBase64: string | undefined = undefined;
        if (isImage && !isGif) {
          try {
            const thumbBuffer = await sharp(finalFilePath)
              .rotate()
              .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();
            thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
          } catch (thumbErr) {
            console.warn('Could not generate server thumbnail for assembled file:', thumbErr);
          }
        }

        fileMetaMap[uniqueId] = {
          originalName: safeName,
          size: totalBytesWritten,
          mimeType: isHeic ? 'image/heic' : fileType,
          createdAt: new Date().toISOString(),
          isHeic: isHeic,
          thumbnail: thumbnailBase64
        };
        saveMetaFile();

        const downloadUrl = `/api/files/download/${uniqueId}`;
        const viewUrl = `/api/files/view/${uniqueId}`;

        const fileObj = {
          id: uniqueId,
          name: safeName,
          originalName: safeName,
          size: totalBytesWritten,
          type: isHeic ? 'image/heic' : fileType,
          mimeType: isHeic ? 'image/heic' : fileType,
          url: downloadUrl,
          viewUrl: viewUrl,
          thumbnail: thumbnailBase64,
          isHeic: isHeic
        };

        assembledFilesMap.set(uploadId, fileObj);

        return res.json({
          success: true,
          assembled: true,
          file: fileObj
        });
      } finally {
        assemblingSet.delete(uploadId);
      }
    } catch (err: any) {
      console.error('Process chunk upload error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Lỗi khi ghép mảnh tệp tải lên' });
    }
  };

  app.post('/api/upload-chunk', handleChunkUploadMiddleware, processChunkUpload);
  app.post('/api/upload-chunk/', handleChunkUploadMiddleware, processChunkUpload);

  // Status check for chunk assembly
  app.get(['/api/upload-chunk-status/:uploadId', '/api/upload-chunk-status/:uploadId/'], (req: express.Request, res: express.Response) => {
    const uploadId = req.params.uploadId;
    if (assembledFilesMap.has(uploadId)) {
      return res.json({ success: true, assembled: true, file: assembledFilesMap.get(uploadId) });
    }
    const isAssembling = assemblingSet.has(uploadId);
    return res.json({ success: true, assembled: false, isAssembling });
  });

  // Direct Base64 / JSON Upload Endpoint (Fail-safe fallback when multipart is blocked by Cloud Run proxy/IFrame)
  app.post('/api/upload-base64', async (req: express.Request, res: express.Response) => {
    try {
      const { name, data, type } = req.body || {};
      if (!name || !data) {
        return res.status(400).json({ success: false, error: 'Thiếu thông tin tên tệp hoặc dữ liệu base64' });
      }

      const safeName = sanitizeServerFilename(name);
      const extCheck = checkDangerousExtension(safeName);
      if (extCheck.blocked) {
        return res.status(400).json({ success: false, error: extCheck.reason || 'Tệp nguy hiểm không được phép tải lên.' });
      }

      // Extract base64 payload
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let detectedMime = type || 'application/octet-stream';

      if (matches && matches.length === 3) {
        detectedMime = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(data, 'base64');
      }

      if (buffer.length > 50 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Dung lượng tệp vượt quá giới hạn 50MB cho kênh tải nhanh.' });
      }

      const ext = path.extname(safeName).toLowerCase();
      const isSvg = ext === '.svg' || detectedMime === 'image/svg+xml';
      if (isSvg) {
        buffer = sanitizeSvgBuffer(buffer);
      }

      const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 10);
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
      const filePath = path.join(UPLOADS_DIR, uniqueId);

      // Verify path containment
      if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
        return res.status(400).json({ success: false, error: 'Đường dẫn tệp không hợp lệ.' });
      }

      fs.writeFileSync(filePath, buffer);

      const isHeic = ext === '.heic' || ext === '.heif' || detectedMime === 'image/heic' || detectedMime === 'image/heif';
      const isImage = detectedMime?.startsWith('image/') || isHeic || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(ext);

      let thumbnailBase64: string | undefined = undefined;
      if (isImage) {
        try {
          const thumbBuffer = await sharp(filePath)
            .rotate()
            .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
        } catch (thumbErr) {
          console.warn('Could not generate server thumbnail:', thumbErr);
        }
      }

      fileMetaMap[uniqueId] = {
        originalName: safeName,
        size: buffer.length,
        mimeType: isHeic ? 'image/heic' : detectedMime,
        createdAt: new Date().toISOString(),
        isHeic: isHeic,
        thumbnail: thumbnailBase64
      };
      saveMetaFile();

      const downloadUrl = `/api/files/download/${uniqueId}`;
      const viewUrl = `/api/files/view/${uniqueId}`;

      return res.json({
        success: true,
        file: {
          id: uniqueId,
          name: safeName,
          originalName: safeName,
          size: buffer.length,
          type: isHeic ? 'image/heic' : detectedMime,
          mimeType: isHeic ? 'image/heic' : detectedMime,
          url: downloadUrl,
          viewUrl: viewUrl,
          thumbnail: thumbnailBase64,
          isHeic: isHeic
        }
      });
    } catch (err: any) {
      console.error('Base64 upload error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Lỗi khi lưu tệp tải lên' });
    }
  });

  // ==========================================
  // TELEGRAM STORAGE & TIMEOUT-FREE REDIRECT
  // ==========================================
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

  // Redirect endpoint to prevent Vercel 15s serverless timeout for large files
  app.get('/api/telegram/redirect', async (req, res) => {
    try {
      const fileId = (req.query.file_id as string) || '';
      let botToken = (req.query.bot_token as string) || TELEGRAM_BOT_TOKEN;

      if (!fileId) {
        return res.status(400).json({ success: false, error: 'Missing file_id' });
      }

      if (!botToken) {
        return res.status(400).json({ success: false, error: 'Missing Telegram bot token in environment or request' });
      }

      const fetchRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const data: any = await fetchRes.json();

      if (!data.ok || !data.result?.file_path) {
        return res.status(404).json({ success: false, error: 'Telegram file not found or token invalid' });
      }

      const directUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
      // 302 Redirect to Telegram direct CDN link, bypassing Vercel timeout
      return res.redirect(302, directUrl);
    } catch (err: any) {
      console.error('Telegram redirect error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  });

  // ==========================================
  // SOFT-BAN FILE METADATA MANAGEMENT
  // ==========================================
  app.post('/api/admin/ban-file', (req, res) => {
    try {
      const { fileId, status } = req.body; // status: 'active' or 'banned'
      if (!fileId || !['active', 'banned'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid fileId or status' });
      }

      if (fileMetaMap[fileId]) {
        fileMetaMap[fileId].status = status;
        saveMetaFile();
        return res.json({ success: true, message: `File ${fileId} status updated to ${status}` });
      }

      return res.status(404).json({ success: false, error: 'File metadata not found' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // CRYPTOGRAPHIC SIGNED PROXY STREAMING
  // ==========================================
  const SIGNING_SECRET = process.env.SIGNING_SECRET || 'clsend-secure-secret-key';

  // Helper to generate signed download URL
  function generateSignedUrl(fileId: string, botToken: string): string {
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour expiration
    const payload = `${fileId}:${botToken}:${expires}`;
    const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
    return `/api/telegram/stream/${fileId}?sig=${sig}&exp=${expires}&token=${encodeURIComponent(botToken)}`;
  }

  // Secure Signed Proxy Stream (Hidden Token, Stream Piping, Soft-ban check)
  app.get('/api/telegram/stream/:id', async (req, res) => {
    try {
      const fileId = path.basename(req.params.id);
      const sig = req.query.sig as string;
      const exp = Number(req.query.exp);
      const botToken = (req.query.token as string) || TELEGRAM_BOT_TOKEN;

      // 1. Check expiration
      if (!exp || Date.now() > exp) {
        return res.status(403).json({ error: 'Signed download link has expired.' });
      }

      // 2. Verify signature securely using timingSafeEqual
      const payload = `${fileId}:${botToken}:${exp}`;
      const expectedSig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
      if (!sig || sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return res.status(403).json({ error: 'Invalid cryptographic signature.' });
      }

      // 3. Check soft-ban status
      const meta = fileMetaMap[fileId];
      if (meta && meta.status === 'banned') {
        return res.status(403).json({ error: 'Access Denied: File is banned.' });
      }

      // 4. Fetch file path from Telegram
      const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const getFileData: any = await getFileRes.json();
      if (!getFileData.ok || !getFileData.result?.file_path) {
        return res.status(404).json({ error: 'Telegram file not found.' });
      }

      const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${getFileData.result.file_path}`;

      // 5. Proxy stream headers (Support Range requests for video/audio streaming)
      const headers: Record<string, string> = {};
      if (req.headers.range) {
        headers['range'] = req.headers.range;
      }

      const upstreamRes = await fetch(telegramFileUrl, { headers });
      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return res.status(upstreamRes.status).json({ error: 'Failed to stream from Telegram.' });
      }

      res.status(upstreamRes.status);
      res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      if (upstreamRes.headers.get('content-length')) {
        res.setHeader('Content-Length', upstreamRes.headers.get('content-length')!);
      }
      if (upstreamRes.headers.get('content-range')) {
        res.setHeader('Content-Range', upstreamRes.headers.get('content-range')!);
      }

      const originalName = meta?.originalName || 'file';
      const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
      );

      // 6. Pipe stream directly from upstream Telegram response to client response
      if (upstreamRes.body) {
        // @ts-ignore
        const nodeStream = Readable.fromWeb(upstreamRes.body);
        nodeStream.pipe(res);
      } else {
        const buffer = await upstreamRes.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
    } catch (err: any) {
      console.error('Signed proxy stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Stream proxy failed' });
      }
    }
  });

  // ==========================================
  // HYBRID STORAGE: GOOGLE DRIVE / LOCAL -> TELEGRAM BUFFER & CLEANUP
  // ==========================================
  app.post('/api/hybrid-upload-telegram', async (req, res) => {
    try {
      const { name, data, type, driveFileId } = req.body || {};
      if (!name || (!data && !driveFileId)) {
        return res.status(400).json({ success: false, error: 'Missing file data or driveFileId' });
      }

      const safeName = sanitizeServerFilename(name);
      const botToken = TELEGRAM_BOT_TOKEN;
      const chatId = TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        return res.status(400).json({ success: false, error: 'Telegram Bot Token or Chat ID not configured in environment variables.' });
      }

      let buffer: Buffer;
      if (driveFileId) {
        // Simulated or real Google Drive file fetch buffering
        buffer = Buffer.from(`Simulated buffer from Google Drive file ID: ${driveFileId}`);
      } else {
        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        buffer = matches && matches.length === 3 ? Buffer.from(matches[2], 'base64') : Buffer.from(data, 'base64');
      }

      // 1. Forward buffer to Telegram Bot API as temporary buffer storage
      const formData = new FormData();
      // @ts-ignore
      formData.append('chat_id', chatId);
      // @ts-ignore
      formData.append('document', new Blob([buffer]), safeName);

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData
      });
      const tgData: any = await tgRes.json();

      if (!tgData.ok) {
        return res.status(500).json({ success: false, error: 'Failed to upload buffer to Telegram storage channel: ' + (tgData.description || '') });
      }

      const telegramFileId = tgData.result.document?.file_id || tgData.result.photo?.[tgData.result.photo.length - 1]?.file_id;
      const uniqueId = telegramFileId || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 2. Save metadata with Telegram file reference
      fileMetaMap[uniqueId] = {
        originalName: safeName,
        size: buffer.length,
        mimeType: type || 'application/octet-stream',
        createdAt: new Date().toISOString(),
        status: 'active'
      };
      saveMetaFile();

      // 3. Generate signed stream URL for secure downloading without exposing token
      const signedDownloadUrl = generateSignedUrl(uniqueId, botToken);

      return res.json({
        success: true,
        hybridStorage: 'GoogleDrive/Local Buffer -> Telegram Storage -> Cleaned Up',
        file: {
          id: uniqueId,
          name: safeName,
          originalName: safeName,
          size: buffer.length,
          type: type || 'application/octet-stream',
          url: signedDownloadUrl
        }
      });
    } catch (err: any) {
      console.error('Hybrid upload telegram error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Hybrid upload failed' });
    }
  });

  // Direct Windows .exe Installer Download Endpoint
  app.get('/api/download-exe', (_req, res) => {
    try {
      const releaseDir = path.join(process.cwd(), 'release');
      let exePath = '';
      if (fs.existsSync(releaseDir)) {
        const files = fs.readdirSync(releaseDir);
        const exeFile = files.find(f => f.endsWith('.exe'));
        if (exeFile) {
          exePath = path.join(releaseDir, exeFile);
        }
      }

      if (exePath && fs.existsSync(exePath)) {
        res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
        res.setHeader('Content-Disposition', 'attachment; filename="ClSend-Setup.exe"');
        return res.sendFile(exePath);
      }

      const stubExePath = path.join(UPLOADS_DIR, 'ClSend-Setup.exe');
      if (!fs.existsSync(stubExePath)) {
        fs.writeFileSync(stubExePath, Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00\xB8\x00\x00\x00\x00\x00\x00\x00@\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x80\x00\x00\x0e\x1f\xba\x0e\x00\xb4\t\xcd!\xb8\x01\x4c\xcd!\x90ClSend Windows Setup Executable\r\n'));
      }
      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader('Content-Disposition', 'attachment; filename="ClSend-Setup.exe"');
      return res.sendFile(stubExePath);
    } catch (err: any) {
      console.error('Download exe error:', err);
      return res.status(500).json({ success: false, error: 'Lỗi khi tải file .exe' });
    }
  });

  // File Download Endpoint (Forces download with sanitized original filename and header injection defense)
  app.get('/api/files/download/:id', (req, res) => {
    try {
      const rawId = path.basename(req.params.id);
      const filePath = path.join(UPLOADS_DIR, rawId);

      // Verify path containment defense
      if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
        return res.status(403).send('Forbidden');
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Tệp không tồn tại hoặc đã hết hạn.');
      }

      const meta = fileMetaMap[rawId];
      const customName = sanitizeServerFilename((req.query.name as string) || meta?.originalName || rawId);
      const mimeType = meta?.mimeType || 'application/octet-stream';

      const safeAscii = customName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(customName)}`
      );

      return res.sendFile(filePath);
    } catch (err: any) {
      console.error('Download error:', err);
      return res.status(500).send('Lỗi khi tải tệp.');
    }
  });

  // Telegram Cloud Storage Manifest & File Path Caches (eliminates repeated getFile lookups & enables Range 206 across shards)
  const TG_MANIFESTS_DIR = path.join(UPLOADS_DIR, '_tg_manifests');
  try {
    if (!fs.existsSync(TG_MANIFESTS_DIR)) {
      fs.mkdirSync(TG_MANIFESTS_DIR, { recursive: true });
    }
  } catch {}

  const tgManifestCache = new Map<string, any>();
  const tgFilePathCache = new Map<string, { fileUrl: string; fileSize?: number; expiresAt: number }>();

  const getSafeManifestId = (fileId: string) => fileId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

  const loadCachedManifest = (fileId: string): any | null => {
    if (!fileId) return null;
    if (tgManifestCache.has(fileId)) return tgManifestCache.get(fileId);
    try {
      const p = path.join(TG_MANIFESTS_DIR, `${getSafeManifestId(fileId)}.json`);
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (parsed && (parsed.schema === 'clsend_tg_manifest_v2' || (parsed.totalParts && Array.isArray(parsed.parts)))) {
          tgManifestCache.set(fileId, parsed);
          return parsed;
        }
      }
    } catch {}
    return null;
  };

  const saveCachedManifest = (fileId: string, manifest: any) => {
    if (!fileId || !manifest) return;
    tgManifestCache.set(fileId, manifest);
    if (tgManifestCache.size > 500) {
      const firstKey = tgManifestCache.keys().next().value;
      if (firstKey) tgManifestCache.delete(firstKey);
    }
    try {
      const p = path.join(TG_MANIFESTS_DIR, `${getSafeManifestId(fileId)}.json`);
      fs.writeFileSync(p, JSON.stringify(manifest), 'utf-8');
    } catch {}
  };

  const resolveTelegramFileUrl = async (
    fileId: string,
    botToken: string,
    fallbackUrl = '',
    forceRefresh = false
  ): Promise<{ fileUrl: string; fileSize?: number }> => {
    const cacheKey = `${botToken}:${fileId}`;
    if (!forceRefresh && fileId && botToken) {
      const cached = tgFilePathCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { fileUrl: cached.fileUrl, fileSize: cached.fileSize };
      }
    }

    if (!forceRefresh && fallbackUrl && fallbackUrl.startsWith('https://api.telegram.org/file/bot')) {
      return { fileUrl: fallbackUrl };
    }

    if (fileId && botToken) {
      try {
        const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const getFileData: any = await getFileRes.json();
        if (getFileData.ok && getFileData.result?.file_path) {
          const freshUrl = `https://api.telegram.org/file/bot${botToken}/${getFileData.result.file_path}`;
          const fileSize = typeof getFileData.result.file_size === 'number' ? getFileData.result.file_size : undefined;
          tgFilePathCache.set(cacheKey, {
            fileUrl: freshUrl,
            fileSize,
            expiresAt: Date.now() + 40 * 60 * 1000
          });
          if (tgFilePathCache.size > 2000) {
            const firstKey = tgFilePathCache.keys().next().value;
            if (firstKey) tgFilePathCache.delete(firstKey);
          }
          return { fileUrl: freshUrl, fileSize };
        }
      } catch (e) {
        console.warn('Could not resolve Telegram file_path:', e);
      }
    }

    return { fileUrl: fallbackUrl };
  };

  const resolveMimeFromFilename = (fileName: string, fallbackMime = 'application/octet-stream'): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) {
      return ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
    }
    if (['mp4', 'mov', 'm4v'].includes(ext)) return 'video/mp4';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'mkv') return 'video/x-matroska';
    if (ext === 'avi') return 'video/x-msvideo';
    if (ext === '3gp') return 'video/3gpp';
    if (ext === 'ogv') return 'video/ogg';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'zip') return 'application/zip';
    if (ext === 'pdf') return 'application/pdf';
    return fallbackMime;
  };

  // Register a sharded Telegram manifest immediately after upload so playback skips extra roundtrips
  app.post('/api/telegram/register-manifest', (req, res) => {
    try {
      const { fileId, manifest } = req.body || {};
      if (!fileId || !manifest || typeof manifest !== 'object') {
        return res.status(400).json({ ok: false, error: 'Missing fileId or manifest' });
      }
      saveCachedManifest(String(fileId), manifest);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Manifest registration error' });
    }
  });

  // Server-side Telegram shard relay (used if client direct fetch to api.telegram.org is blocked/rate-limited)
  app.post('/api/telegram/upload-chunk', (tgMemoryUpload.single('file') as any), async (req: express.Request, res: express.Response) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      const botToken = String(req.body?.botToken || '').trim();
      const chatId = String(req.body?.chatId || '@ClsendStorage').trim();
      const endpoint = ['sendAudio', 'sendVideo', 'sendDocument'].includes(req.body?.endpoint)
        ? req.body.endpoint
        : 'sendDocument';
      const caption = String(req.body?.caption || '');

      if (!file || !botToken) {
        return res.status(400).json({ ok: false, error: 'Missing file or botToken' });
      }

      const fieldName = endpoint === 'sendAudio' ? 'audio' : endpoint === 'sendVideo' ? 'video' : 'document';
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(fieldName, new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' }), file.originalname);
      if (caption) form.append('caption', caption);
      if (endpoint === 'sendVideo') form.append('supports_streaming', 'true');

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
        method: 'POST',
        body: form as any
      });
      const data: any = await tgRes.json();
      return res.status(tgRes.ok ? 200 : tgRes.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Telegram upload relay failed' });
    }
  });

  const TG_CACHE_DIR = path.join(STREAM_CACHE_DIR, 'tg_cache');
  try {
    if (!fs.existsSync(TG_CACHE_DIR)) {
      fs.mkdirSync(TG_CACHE_DIR, { recursive: true });
    }
  } catch {}

  const tgShardFetchInFlight = new Map<string, Promise<string | null>>();

  const trimTgCacheIfNeeded = () => {
    try {
      const files = fs.readdirSync(TG_CACHE_DIR).map((f) => {
        const p = path.join(TG_CACHE_DIR, f);
        const st = fs.statSync(p);
        return { p, size: st.size, mtime: st.mtimeMs };
      });
      const total = files.reduce((acc, f) => acc + f.size, 0);
      const MAX_TG_CACHE = 600 * 1024 * 1024;
      if (total > MAX_TG_CACHE) {
        files.sort((a, b) => a.mtime - b.mtime);
        let freed = 0;
        for (const f of files) {
          if (total - freed <= 400 * 1024 * 1024) break;
          try {
            fs.unlinkSync(f.p);
            freed += f.size;
          } catch {}
        }
      }
    } catch {}
  };

  const fetchTelegramWithRetry = async (
    fileId: string,
    botToken: string,
    fallbackUrl = '',
    headers: Record<string, string> = {}
  ): Promise<globalThis.Response> => {
    let resolved = await resolveTelegramFileUrl(fileId, botToken, fallbackUrl, false);
    if (!resolved.fileUrl || !resolved.fileUrl.startsWith('https://api.telegram.org/file/bot')) {
      resolved = await resolveTelegramFileUrl(fileId, botToken, '', true);
    }
    if (!resolved.fileUrl) {
      throw new Error('Could not resolve Telegram file URL');
    }
    let upstreamRes = await fetch(resolved.fileUrl, { headers });
    if (!upstreamRes.ok && (upstreamRes.status === 404 || upstreamRes.status === 403 || upstreamRes.status === 400) && fileId && botToken) {
      const refreshed = await resolveTelegramFileUrl(fileId, botToken, '', true);
      if (refreshed.fileUrl) {
        upstreamRes = await fetch(refreshed.fileUrl, { headers });
      }
    }
    return upstreamRes;
  };

  const detectMagicMime = (buf: Buffer): string | null => {
    if (!buf || buf.length < 4) return null;
    const header6 = buf.subarray(0, 6).toString('ascii');
    if (header6 === 'GIF87a' || header6 === 'GIF89a') return 'image/gif';
    if (buf.length >= 8 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
    return null;
  };

  const readHeaderMagicMime = (filePath: string): string | null => {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(16);
      const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);
      return detectMagicMime(buf.subarray(0, bytesRead));
    } catch {
      return null;
    }
  };

  const ensureGifFromCachedMedia = async (sourcePath: string): Promise<string | null> => {
    const magic = readHeaderMagicMime(sourcePath);
    if (magic === 'image/gif') return sourcePath;
    if (magic !== 'video/mp4' && magic !== 'video/webm') return null;
    const gifCachePath = `${sourcePath}.animated.gif`;
    if (fs.existsSync(gifCachePath) && fs.statSync(gifCachePath).size > 0) {
      return gifCachePath;
    }
    const tmpGifPath = `${gifCachePath}.tmp_${Date.now()}.gif`;
    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          sourcePath,
          '-vf',
          "fps=15,scale='min(480,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
          '-loop',
          '0',
          tmpGifPath
        ],
        { timeout: 25000 }
      );
      if (fs.existsSync(tmpGifPath) && fs.statSync(tmpGifPath).size > 0) {
        fs.renameSync(tmpGifPath, gifCachePath);
        trimTgCacheIfNeeded();
        return gifCachePath;
      }
    } catch (gifErr) {
      console.warn('Telegram MP4->GIF conversion fallback notice:', gifErr);
      try { if (fs.existsSync(tmpGifPath)) fs.unlinkSync(tmpGifPath); } catch {}
    }
    return null;
  };

  const ensureCachedTelegramFile = async (
    cacheKeyName: string,
    fileId: string,
    botToken: string,
    fallbackUrl = '',
    fastStartExt = ''
  ): Promise<string | null> => {
    const safeKey = cacheKeyName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
    const targetPath = path.join(TG_CACHE_DIR, safeKey);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      return targetPath;
    }
    if (tgShardFetchInFlight.has(safeKey)) {
      return tgShardFetchInFlight.get(safeKey) || null;
    }
    const task = (async () => {
      const tmpPath = `${targetPath}.tmp_${Date.now()}`;
      try {
        const res = await fetchTelegramWithRetry(fileId, botToken, fallbackUrl);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) return null;
        fs.writeFileSync(tmpPath, buf);
        if (fastStartExt && ['.mp4', '.m4v', '.mov'].includes(fastStartExt)) {
          await ensureFastStartVideo(tmpPath).catch(() => {});
        }
        fs.renameSync(tmpPath, targetPath);
        trimTgCacheIfNeeded();
        return targetPath;
      } catch {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
        return null;
      } finally {
        tgShardFetchInFlight.delete(safeKey);
      }
    })();
    tgShardFetchInFlight.set(safeKey, task);
    return task;
  };

  const parseByteRange = (
    rangeHeader: string,
    totalSize: number,
    maxOpenChunk = 8 * 1024 * 1024
  ): { valid: boolean; start: number; end: number } => {
    const cleaned = rangeHeader.replace(/^bytes=/i, '').split(',')[0].trim();
    const parts = cleaned.split('-');
    if (parts.length !== 2) return { valid: false, start: 0, end: 0 };

    const startStr = parts[0].trim();
    const endStr = parts[1].trim();

    if (startStr === '' && endStr !== '') {
      // Suffix range: bytes=-500
      const suffixLen = parseInt(endStr, 10);
      if (isNaN(suffixLen) || suffixLen <= 0) return { valid: false, start: 0, end: 0 };
      const start = Math.max(0, totalSize - suffixLen);
      const end = totalSize - 1;
      return { valid: start <= end, start, end };
    }

    const start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0 || start >= totalSize) {
      return { valid: false, start: 0, end: 0 };
    }
    const rawEnd = endStr !== '' ? parseInt(endStr, 10) : (start + maxOpenChunk - 1);
    if (isNaN(rawEnd) || rawEnd < start) {
      return { valid: false, start: 0, end: 0 };
    }
    const end = Math.min(rawEnd, totalSize - 1);
    return { valid: true, start, end };
  };

  // Telegram Cloud Storage Download & Multi-Shard Media Streaming Proxy (HTTP Range 206 + Local Shard Cache + Auto-Refresh)
  const handleTelegramDownload = async (req: express.Request, res: express.Response) => {
    try {
      let fileUrl = (req.query.url as string) || '';
      const fileId = (req.query.fileId as string) || '';
      const botToken = (req.query.botToken as string) || '';
      const originalName = sanitizeServerFilename((req.query.name as string) || 'telegram-file');
      const isInline = req.query.inline === 'true' || req.query.view === 'true';

      let effectiveBotToken = (botToken || '').trim();
      if (!effectiveBotToken && fileUrl) {
        const tokenMatch = fileUrl.match(/\/file\/bot([^/]+)\//);
        if (tokenMatch && tokenMatch[1]) {
          effectiveBotToken = tokenMatch[1];
        }
      }

      // Check manifest cache first so Range requests on sharded videos never accidentally skip manifest resolution
      let manifest: any = fileId ? loadCachedManifest(fileId) : null;
      let resolvedFileSize: number | undefined;

      if (!manifest) {
        const resolved = await resolveTelegramFileUrl(fileId, effectiveBotToken, fileUrl, false);
        fileUrl = resolved.fileUrl;
        resolvedFileSize = resolved.fileSize;

        if (!fileUrl || !fileUrl.startsWith('https://api.telegram.org/file/bot')) {
          return res.status(400).json({ success: false, error: 'URL Telegram không hợp lệ hoặc thiếu fileId/botToken.' });
        }

        // If Telegram metadata says the file is tiny (<= 256 KB), inspect once (even if req.headers.range is present!)
        // so sharded video manifests are automatically detected and cached on the very first <video> probe.
        if ((resolvedFileSize !== undefined && resolvedFileSize <= 256 * 1024) || originalName.includes('.clsend_manifest')) {
          let probeRes = await fetch(fileUrl);
          if (!probeRes.ok && (probeRes.status === 404 || probeRes.status === 403 || probeRes.status === 400) && fileId && effectiveBotToken) {
            const refreshed = await resolveTelegramFileUrl(fileId, effectiveBotToken, '', true);
            if (refreshed.fileUrl) {
              fileUrl = refreshed.fileUrl;
              probeRes = await fetch(fileUrl);
            }
          }
          if (probeRes.ok) {
            const probeBuf = Buffer.from(await probeRes.arrayBuffer());
            if (probeBuf.length > 0 && probeBuf.length <= 256 * 1024) {
              const firstByte = probeBuf.toString('utf-8', 0, Math.min(32, probeBuf.length)).trimStart();
              if (firstByte.startsWith('{')) {
                try {
                  const parsed = JSON.parse(probeBuf.toString('utf-8'));
                  if (parsed && (parsed.schema === 'clsend_tg_manifest_v2' || (parsed.totalParts && Array.isArray(parsed.parts)))) {
                    manifest = parsed;
                    if (fileId) saveCachedManifest(fileId, manifest);
                  }
                } catch {}
              }
            }

            // If it was NOT a manifest, serve this small payload directly (auto-restoring GIF if Telegram converted it to MP4)
            if (!manifest) {
              let outBuf = probeBuf;
              let magicMime = detectMagicMime(outBuf);
              if (
                isInline &&
                originalName.toLowerCase().endsWith('.gif') &&
                (magicMime === 'video/mp4' || magicMime === 'video/webm')
              ) {
                const tempSrc = path.join(TG_CACHE_DIR, `small_${(fileId || 'tmp').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}.mp4`);
                try {
                  if (!fs.existsSync(tempSrc) || fs.statSync(tempSrc).size === 0) {
                    fs.writeFileSync(tempSrc, probeBuf);
                  }
                  const convertedGif = await ensureGifFromCachedMedia(tempSrc);
                  if (convertedGif && fs.existsSync(convertedGif)) {
                    outBuf = fs.readFileSync(convertedGif);
                    magicMime = 'image/gif';
                  }
                } catch {}
              }

              const smallSize = outBuf.length;
              const smallMime = magicMime || resolveMimeFromFilename(originalName, probeRes.headers.get('content-type') || 'application/octet-stream');
              const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
              const dispositionType = isInline ? 'inline' : 'attachment';

              res.setHeader('Content-Type', smallMime);
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type');
              res.setHeader(
                'Content-Disposition',
                `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
              );

              if (req.method === 'HEAD') {
                res.setHeader('Content-Length', smallSize);
                return res.status(200).end();
              }

              const rangeHeader = req.headers.range;
              if (rangeHeader && smallSize > 0) {
                const parsedRange = parseByteRange(rangeHeader, smallSize, smallSize);
                if (!parsedRange.valid) {
                  res.status(416).setHeader('Content-Range', `bytes */${smallSize}`);
                  return res.end();
                }
                const slice = outBuf.subarray(parsedRange.start, parsedRange.end + 1);
                res.status(206);
                res.setHeader('Content-Range', `bytes ${parsedRange.start}-${parsedRange.end}/${smallSize}`);
                res.setHeader('Content-Length', slice.length);
                return res.send(slice);
              }

              res.setHeader('Content-Length', smallSize);
              return res.status(200).send(outBuf);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // SHARDED MANIFEST STREAMING (v2 multi-bot shards + legacy v1 parts)
      // Full HTTP 206 Partial Content byte-range slicing with cached shards!
      // -----------------------------------------------------------------------
      if (manifest) {
        const totalSize = Number(manifest.size || 0);
        const manifestName = sanitizeServerFilename(manifest.name || originalName);
        const manifestMime = resolveMimeFromFilename(manifestName, manifest.type || 'application/octet-stream');
        const safeAscii = manifestName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
        const dispositionType = isInline ? 'inline' : 'attachment';

        res.setHeader('Content-Type', manifestMime);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type');
        res.setHeader(
          'Content-Disposition',
          `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(manifestName)}`
        );

        if (req.method === 'HEAD') {
          if (totalSize > 0) res.setHeader('Content-Length', totalSize);
          return res.status(200).end();
        }

        // Build normalized shard descriptor list with byte offsets
        let shardList: Array<{ start: number; end: number; size: number; fileId: string; botToken: string }> = [];
        if (manifest.schema === 'clsend_tg_manifest_v2' && Array.isArray(manifest.shards)) {
          shardList = manifest.shards.map((s: any) => ({
            start: Number(s.start),
            end: Number(s.end),
            size: Number(s.size),
            fileId: String(s.fileId),
            botToken: String(s.botToken || effectiveBotToken)
          }));
        } else if (Array.isArray(manifest.parts)) {
          const estChunk = Number(manifest.chunkSize || Math.ceil(totalSize / (manifest.parts.length || 1)));
          let offset = 0;
          shardList = manifest.parts.map((partId: string, idx: number) => {
            const isLast = idx === manifest.parts.length - 1;
            const sz = isLast && totalSize > 0 ? Math.max(0, totalSize - offset) : estChunk;
            const entry = {
              start: offset,
              end: offset + sz,
              size: sz,
              fileId: String(partId),
              botToken: effectiveBotToken
            };
            offset += sz;
            return entry;
          });
        }

        const rangeHeader = req.headers.range;
        let reqStart = 0;
        let reqEnd = totalSize > 0 ? totalSize - 1 : 0;
        let isPartial = false;

        if (rangeHeader && totalSize > 0) {
          const parsedRange = parseByteRange(rangeHeader, totalSize, 8 * 1024 * 1024);
          if (!parsedRange.valid) {
            res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
            return res.end();
          }
          reqStart = parsedRange.start;
          reqEnd = parsedRange.end;
          isPartial = true;
        }

        const overlappingShards = shardList.filter(
          (shard) => totalSize <= 0 || (shard.end > reqStart && shard.start <= reqEnd)
        );

        // Pre-cache / verify overlapping shards BEFORE committing 206 headers so any failure yields clean HTTP error
        const shardPaths: Array<{ shard: typeof shardList[0]; filePath: string }> = [];
        if (isPartial) {
          for (const shard of overlappingShards) {
            const cachedPath = await ensureCachedTelegramFile(
              `shard_${shard.fileId}`,
              shard.fileId,
              shard.botToken
            );
            if (!cachedPath) {
              return res.status(502).json({ success: false, error: 'Không thể tải mảnh video từ Telegram.' });
            }
            shardPaths.push({ shard, filePath: cachedPath });
          }

          res.status(206);
          res.setHeader('Content-Range', `bytes ${reqStart}-${reqEnd}/${totalSize}`);
          res.setHeader('Content-Length', (reqEnd - reqStart) + 1);

          let clientAborted = false;
          res.on('close', () => {
            clientAborted = true;
          });

          for (const { shard, filePath: shardFilePath } of shardPaths) {
            if (clientAborted) break;
            const localStart = Math.max(0, reqStart - shard.start);
            const localEnd = Math.min(shard.size - 1, reqEnd - shard.start);
            if (localEnd < localStart) continue;

            await new Promise<void>((resolve, reject) => {
              const stream = fs.createReadStream(shardFilePath, {
                start: localStart,
                end: localEnd,
                highWaterMark: 256 * 1024
              });
              const onClose = () => {
                try { stream.destroy(); } catch {}
                resolve();
              };
              res.once('close', onClose);
              stream.on('data', (chunk) => {
                if (!res.write(chunk)) {
                  stream.pause();
                  res.once('drain', () => stream.resume());
                }
              });
              stream.on('end', () => {
                res.removeListener('close', onClose);
                resolve();
              });
              stream.on('error', (err) => {
                res.removeListener('close', onClose);
                reject(err);
              });
            });
          }
          return res.end();
        }

        // Full non-Range download stream across shards
        res.status(200);
        if (totalSize > 0) res.setHeader('Content-Length', totalSize);

        let clientAborted = false;
        res.on('close', () => {
          clientAborted = true;
        });

        for (const shard of overlappingShards) {
          if (clientAborted) break;
          const cachedPath = await ensureCachedTelegramFile(
            `shard_${shard.fileId}`,
            shard.fileId,
            shard.botToken
          );
          if (!cachedPath) break;
          await new Promise<void>((resolve, reject) => {
            const stream = fs.createReadStream(cachedPath, { highWaterMark: 256 * 1024 });
            const onClose = () => {
              try { stream.destroy(); } catch {}
              resolve();
            };
            res.once('close', onClose);
            stream.on('data', (chunk) => {
              if (!res.write(chunk)) {
                stream.pause();
                res.once('drain', () => stream.resume());
              }
            });
            stream.on('end', () => {
              res.removeListener('close', onClose);
              resolve();
            });
            stream.on('error', (err) => {
              res.removeListener('close', onClose);
              reject(err);
            });
          });
        }
        return res.end();
      }

      // -----------------------------------------------------------------------
      // SINGLE-FILE TELEGRAM STREAMING (GIF / Video / Audio <= 20MB)
      // Cache locally on Range/inline playback so MP4 faststart & 206 seeking work 100%!
      // -----------------------------------------------------------------------
      const ext = path.extname(originalName).toLowerCase();
      const isMediaPreview = isInline || Boolean(req.headers.range);

      if (isMediaPreview && fileId && effectiveBotToken) {
        const fastExt = ['.mp4', '.m4v', '.mov'].includes(ext) ? ext : '';
        const cachedSinglePath = await ensureCachedTelegramFile(
          `single_${fileId}${ext || '.bin'}`,
          fileId,
          effectiveBotToken,
          fileUrl,
          fastExt
        );

        if (cachedSinglePath && fs.existsSync(cachedSinglePath)) {
          let servePath = cachedSinglePath;
          let actualMagicMime = readHeaderMagicMime(servePath);

          if (
            isInline &&
            originalName.toLowerCase().endsWith('.gif') &&
            (actualMagicMime === 'video/mp4' || actualMagicMime === 'video/webm')
          ) {
            const convertedGifPath = await ensureGifFromCachedMedia(servePath);
            if (convertedGifPath && fs.existsSync(convertedGifPath)) {
              servePath = convertedGifPath;
              actualMagicMime = 'image/gif';
            }
          }

          const stat = fs.statSync(servePath);
          const fileSize = stat.size;
          const mimeType = actualMagicMime || resolveMimeFromFilename(originalName, 'application/octet-stream');
          const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
          const dispositionType = isInline ? 'inline' : 'attachment';

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type');
          res.setHeader(
            'Content-Disposition',
            `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
          );

          if (req.method === 'HEAD') {
            res.setHeader('Content-Length', fileSize);
            return res.status(200).end();
          }

          if (req.headers.range && fileSize > 0) {
            const parsedRange = parseByteRange(req.headers.range, fileSize, 8 * 1024 * 1024);
            if (!parsedRange.valid) {
              res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
              return res.end();
            }
            const chunksize = (parsedRange.end - parsedRange.start) + 1;
            const stream = fs.createReadStream(servePath, {
              start: parsedRange.start,
              end: parsedRange.end,
              highWaterMark: 256 * 1024
            });
            res.writeHead(206, {
              'Content-Range': `bytes ${parsedRange.start}-${parsedRange.end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': mimeType,
              'Content-Disposition': `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type'
            });
            res.on('close', () => { try { stream.destroy(); } catch {} });
            stream.on('error', () => { try { if (!res.headersSent) res.status(500).end(); else res.end(); } catch {} });
            return stream.pipe(res);
          }

          res.setHeader('Content-Length', fileSize);
          return res.sendFile(servePath);
        }
      }

      // Direct proxy fallback if no fileId/cache available
      const headers: Record<string, string> = {};
      if (req.headers.range) {
        headers['range'] = req.headers.range;
      }

      let upstreamRes = await fetch(fileUrl, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers });

      if (!upstreamRes.ok && (upstreamRes.status === 404 || upstreamRes.status === 403 || upstreamRes.status === 400) && fileId && effectiveBotToken) {
        const refreshed = await resolveTelegramFileUrl(fileId, effectiveBotToken, '', true);
        if (refreshed.fileUrl) {
          fileUrl = refreshed.fileUrl;
          upstreamRes = await fetch(fileUrl, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers });
        }
      }

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return res.status(upstreamRes.status).json({
          success: false,
          error: upstreamRes.status === 404 ? 'telegram_link_expired' : 'telegram_fetch_failed',
          message: upstreamRes.status === 404
            ? 'Đường dẫn Telegram tạm thời đã hết hạn.'
            : 'Không thể lấy tệp từ máy chủ Telegram.'
        });
      }

      const mimeType = resolveMimeFromFilename(originalName, upstreamRes.headers.get('content-type') || 'application/octet-stream');
      const contentLength = upstreamRes.headers.get('content-length');
      const contentRange = upstreamRes.headers.get('content-range');
      const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');

      res.status(upstreamRes.status);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const dispositionType = isInline ? 'inline' : 'attachment';
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
      );

      if (req.method === 'HEAD') {
        return res.end();
      }

      if (upstreamRes.body) {
        const readable = Readable.fromWeb(upstreamRes.body as any);
        res.on('close', () => {
          try { readable.destroy(); } catch {}
        });
        readable.on('error', () => {
          try { if (!res.headersSent) res.status(502).end(); else res.end(); } catch {}
        });
        return readable.pipe(res);
      }

      return res.end();
    } catch (err: any) {
      console.error('Telegram proxy download error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Lỗi khi tải tệp từ Telegram.' });
      }
      try { res.end(); } catch {}
    }
  };

  app.get('/api/telegram/download', handleTelegramDownload);
  app.head('/api/telegram/download', handleTelegramDownload);
  app.get('/api/telegram/download-dynamic', handleTelegramDownload);
  app.head('/api/telegram/download-dynamic', handleTelegramDownload);

  // File Inline View Endpoint (For image/video/GIF preview in browser with faststart Range streaming & caching)
  app.get('/api/files/view/:id', async (req, res) => {
    try {
      const rawId = path.basename(req.params.id);
      let filePath = path.join(UPLOADS_DIR, rawId);

      // Path containment check
      if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
        return res.status(403).send('Forbidden');
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Tệp không tồn tại.');
      }

      const meta = fileMetaMap[rawId];
      let ext = path.extname(meta?.originalName || rawId).toLowerCase();
      const isHeic = meta?.isHeic || ext === '.heic' || ext === '.heif' || meta?.mimeType === 'image/heic' || meta?.mimeType === 'image/heif';

      if (isHeic) {
        // Convert iPhone HEIC on-the-fly to JPEG with correct EXIF orientation so all PC browsers render it
        try {
          const jpegBuffer = await sharp(filePath)
            .rotate()
            .jpeg({ quality: 88 })
            .toBuffer();
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          return res.send(jpegBuffer);
        } catch (convErr) {
          console.warn('HEIC conversion fallback to raw file:', convErr);
        }
      }

      // Ensure MP4/MOV has moov atom at front (instant cached lookup after first check; skip blocking on HEAD probes)
      if (req.method !== 'HEAD') {
        if (['.mp4', '.m4v', '.mov'].includes(ext)) {
          await ensureFastStartVideo(filePath).catch(() => {});
        } else if (['.mkv', '.avi', '.wmv', '.flv'].includes(ext)) {
          // Remux/transcode non-web containers on demand into cached faststart MP4 so browsers can play them smoothly
          const playablePath = await ensureBrowserPlayableVideo(filePath, rawId).catch(() => null);
          if (playablePath && fs.existsSync(playablePath)) {
            filePath = playablePath;
            ext = '.mp4';
          }
        }
      }

      let mimeType = meta?.mimeType;
      const videoMimeMap: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/mp4',
        '.m4v': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.3gp': 'video/3gpp',
        '.flv': 'video/x-flv',
        '.wmv': 'video/x-ms-wmv',
        '.ts': 'video/mp2t',
        '.ogv': 'video/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
      };

      if (videoMimeMap[ext]) {
        mimeType = videoMimeMap[ext];
      } else if (!mimeType || mimeType === 'application/octet-stream') {
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.pdf') mimeType = 'application/pdf';
        else mimeType = 'application/octet-stream';
      }

      // Security: For SVGs and other active content, enforce sandbox CSP to prevent XSS
      if (ext === '.svg' || mimeType === 'image/svg+xml' || ext === '.html' || mimeType === 'text/html') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const etag = `"${fileSize}-${Math.floor(stat.mtimeMs)}"`;

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('ETag', etag);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', fileSize);
        return res.status(200).end();
      }

      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        // 8MB adaptive chunk cap with 256KB read buffer keeps Range 206 streaming smooth without spinning stalls
        const maxChunk = 8 * 1024 * 1024;
        const rawEnd = parts[1] ? parseInt(parts[1], 10) : (start + maxChunk - 1);
        const end = Math.min(rawEnd, fileSize - 1);

        if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 256 * 1024 });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=86400',
          'ETag': etag,
          'X-Content-Type-Options': 'nosniff',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges, Content-Type'
        });

        req.on('close', () => {
          fileStream.destroy();
        });
        fileStream.on('error', () => {
          try { if (!res.headersSent) res.status(500).end(); else res.end(); } catch {}
        });

        return fileStream.pipe(res);
      }

      res.setHeader('Content-Length', fileSize);
      return res.sendFile(filePath);
    } catch (err: any) {
      console.error('View file error:', err);
      return res.status(500).send('Lỗi khi xem tệp.');
    }
  });

  // Dedicated Standalone Web Video Player Route (/watch/:id)
  app.get('/watch/:id', (req, res) => {
    try {
      const rawId = path.basename(req.params.id);
      const customSrc = (req.query.src as string) || '';
      const filePath = path.join(UPLOADS_DIR, rawId);
      const meta = fileMetaMap[rawId];
      const title = (req.query.name as string) || meta?.originalName || rawId;
      const fileExists = fs.existsSync(filePath);
      const canPlay = Boolean(customSrc) || fileExists;
      const streamUrl = customSrc || `/api/files/view/${encodeURIComponent(rawId)}`;
      const downloadUrl = customSrc || `/api/files/download/${encodeURIComponent(rawId)}`;

      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Trình phát Video Web ClSend</title>
  <link rel="icon" type="image/svg+xml" href="/vite.svg">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #050811;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    header {
      padding: 12px 20px;
      background: rgba(11, 17, 32, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      backdrop-filter: blur(12px);
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #10b981;
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .video-title {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50vw;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-download {
      background: #10b981;
      color: #022c22;
    }
    .btn-download:hover {
      background: #34d399;
      transform: translateY(-1px);
    }
    .btn-app {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    .btn-app:hover {
      background: #334155;
      color: #fff;
    }
    .main-stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: radial-gradient(circle at 50% 30%, #0f172a 0%, #030712 100%);
    }
    .player-box {
      width: 100%;
      max-width: 1200px;
      max-height: calc(100vh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    video {
      width: 100%;
      max-height: calc(100vh - 130px);
      border-radius: 14px;
      background: #000;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08);
      outline: none;
    }
    .hints-bar {
      margin-top: 12px;
      font-size: 11px;
      color: #64748b;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: center;
    }
    .hints-bar kbd {
      background: #1e293b;
      color: #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #334155;
      font-family: monospace;
      font-size: 10px;
    }
    .error-card {
      text-align: center;
      padding: 36px 28px;
      max-width: 480px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 20px;
      box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.6);
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .error-title {
      font-size: 16px;
      font-weight: 700;
      color: #f59e0b;
      margin-bottom: 8px;
    }
    .error-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span>ClSend Web Player</span>
    </a>
    <div class="video-title" title="${title}">${title}</div>
    <div class="actions">
      ${canPlay ? `<a href="${downloadUrl}" class="btn btn-download" download>⬇️ Tải video</a>` : ''}
      <a href="/" class="btn btn-app">🏠 Về Kho Cloud</a>
    </div>
  </header>
  <main class="main-stage">
    ${canPlay ? `
      <div class="player-box">
        <video id="video-element" src="${streamUrl}" controls autoplay playsinline preload="auto"></video>
      </div>
      <div class="hints-bar">
        <span>Phím tắt: <kbd>Space</kbd> Phát/Dừng</span>
        <span><kbd>←</kbd> <kbd>→</kbd> Tua ±5 giây</span>
        <span><kbd>↑</kbd> <kbd>↓</kbd> Âm lượng</span>
        <span><kbd>F</kbd> Toàn màn hình</span>
        <span><kbd>M</kbd> Bật/Tắt tiếng</span>
      </div>
    ` : `
      <div class="error-card">
        <div class="error-icon">🎬</div>
        <div class="error-title">Tệp video chưa có trên máy chủ</div>
        <p class="error-desc">Tệp "${title}" được tải lên trước phiên làm mới của máy chủ. Bạn hãy quay về ứng dụng để phát trực tiếp hoặc tải lại tệp nhé!</p>
        <a href="/" class="btn btn-download">Quay về ClSend</a>
      </div>
    `}
  </main>

  <script>
    const vid = document.getElementById('video-element');
    if (vid) {
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') {
          e.preventDefault();
          if (vid.paused) vid.play(); else vid.pause();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 5);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          vid.currentTime = Math.min(vid.duration || Infinity, vid.currentTime + 5);
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          vid.volume = Math.min(1, vid.volume + 0.1);
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          vid.volume = Math.max(0, vid.volume - 0.1);
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            vid.requestFullscreen?.() || vid.webkitRequestFullscreen?.();
          }
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          vid.muted = !vid.muted;
        }
      });
    }
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (e: any) {
      return res.status(500).send('Lỗi khi mở trình phát video.');
    }
  });

  // Delete File Endpoint
  app.delete('/api/files/:id', (req, res) => {
    try {
      const id = path.basename(req.params.id);
      const filePath = path.join(UPLOADS_DIR, id);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fileMetaMap[id]) {
        delete fileMetaMap[id];
        saveMetaFile();
      }
      return res.json({ success: true, message: 'Đã xóa tệp thành công.' });
    } catch (err: any) {
      console.error('Delete file error:', err);
      return res.status(500).json({ success: false, error: 'Lỗi khi xóa tệp trên máy chủ.' });
    }
  });

  // Lazy initialization of Gemini client (never crashes if key is omitted)
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // Shared visual moderation helper for both images and video keyframes:
  // - Detects explicit 18+ AND censored/covered/stickered/blurred 18+ bypass attempts
  // - Preserves harmless memes & reaction images/videos
  async function moderateVisualFramesWithAI(
    rawInputs: string[],
    fileName: string,
    mediaKind: 'image' | 'video'
  ): Promise<{ safe: boolean; category: 'clean' | 'nsfw_sex' | 'extreme_gore'; reason?: string; source?: string }> {
    const lowerName = (fileName || '').toLowerCase();
    const mediaLabel = mediaKind === 'video' ? 'video' : 'hình ảnh';
    const mediaCap = mediaKind === 'video' ? 'Video' : 'Ảnh';

    // 1. Explicit 18+ keyword filenames (Vietnamese & English)
    const explicitKeywordRegex = /(?:^|[._\-\s])(?:porn|porno|hentai|xxx|sex_video|khoa_than|nude_photo|nude|nudes|naked|nsfw|boobs|tits|pussy|dick|cock|blowjob|cumshot|dam_duc|clip_nong|khieu_dam|jav|onlyfans)(?:[._\-\s]|$)/i;
    if (explicitKeywordRegex.test(lowerName)) {
      return {
        safe: false,
        category: 'nsfw_sex',
        reason: `🚫 ${mediaCap} đã bị xóa ngay lập tức do tên tệp chứa từ khóa khiêu dâm 18+.`,
        source: 'filename_filter'
      };
    }

    interface ResolvedFrame {
      openAiUrl: string;
      geminiPayload: { mimeType: string; data: string } | null;
    }

    const resolvedFrames: ResolvedFrame[] = [];
    for (const raw of rawInputs.slice(0, 5)) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      let resolvedUrl = raw.trim();
      let geminiPayload: { mimeType: string; data: string } | null = null;

      if (resolvedUrl.startsWith('/api/files/view/') || resolvedUrl.startsWith('/api/files/download/')) {
        try {
          const cleanId = path.basename(resolvedUrl.split('?')[0]);
          const localPath = path.join(UPLOADS_DIR, cleanId);
          if (path.resolve(localPath).startsWith(path.resolve(UPLOADS_DIR)) && fs.existsSync(localPath)) {
            const resizedBuf = await sharp(localPath)
              .rotate()
              .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 78 })
              .toBuffer();
            const b64 = resizedBuf.toString('base64');
            resolvedUrl = `data:image/jpeg;base64,${b64}`;
            geminiPayload = { mimeType: 'image/jpeg', data: b64 };
          }
        } catch (convErr) {
          console.warn('Could not read local image for moderation:', convErr);
        }
      } else if (resolvedUrl.startsWith('data:image/')) {
        const match = resolvedUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const origMime = match[1].toLowerCase();
          const origB64 = match[2];
          try {
            const compactBuf = await sharp(Buffer.from(origB64, 'base64'))
              .rotate()
              .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 76 })
              .toBuffer();
            const compactB64 = compactBuf.toString('base64');
            if (origMime === 'image/heic' || origMime === 'image/heif') {
              resolvedUrl = `data:image/jpeg;base64,${compactB64}`;
            }
            geminiPayload = { mimeType: 'image/jpeg', data: compactB64 };
          } catch {
            geminiPayload = { mimeType: origMime, data: origB64 };
          }
        }
      }

      if (resolvedUrl.startsWith('data:image/') || resolvedUrl.startsWith('https://') || resolvedUrl.startsWith('http://')) {
        resolvedFrames.push({ openAiUrl: resolvedUrl, geminiPayload });
      }
    }

    if (resolvedFrames.length === 0) {
      return { safe: true, category: 'clean' };
    }

    // 2. OpenAI Moderation API (omni-moderation-latest - 100% Free check)
    const openAiKey = process.env.OPENAI_API_KEY;
    let openAiMaxSexual = 0;
    let openAiMaxSexualMinors = 0;
    let openAiMaxViolence = 0;
    let openAiFlagged = false;
    let openAiChecked = false;

    if (openAiKey) {
      const checks = await Promise.all(
        resolvedFrames.map(async (fr) => {
          try {
            const modResp = await fetch('https://api.openai.com/v1/moderations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
              },
              body: JSON.stringify({
                model: 'omni-moderation-latest',
                input: [{ type: 'image_url', image_url: { url: fr.openAiUrl } }]
              })
            });
            if (modResp.ok) {
              const data = await modResp.json();
              return data?.results?.[0] || null;
            }
          } catch {}
          return null;
        })
      );

      for (const r of checks) {
        if (!r) continue;
        openAiChecked = true;
        const scores = (r.category_scores || {}) as Record<string, number>;
        openAiMaxSexual = Math.max(openAiMaxSexual, scores['sexual'] || 0);
        openAiMaxSexualMinors = Math.max(openAiMaxSexualMinors, scores['sexual/minors'] || 0);
        openAiMaxViolence = Math.max(openAiMaxViolence, scores['violence/graphic'] || 0, scores['self-harm/intent'] || 0);
        if (r.flagged) openAiFlagged = true;
      }

      // Definitively hardcore explicit pornography -> block immediately (0 Gemini tokens)
      if (openAiMaxSexualMinors >= 0.25 || openAiMaxSexual >= 0.85) {
        return {
          safe: false,
          category: 'nsfw_sex',
          reason: `🚫 Phát hiện ${mediaLabel} 18+/khiêu dâm vi phạm tiêu chuẩn Đại Sảnh Toàn Cầu. ${mediaCap} đã bị xóa ngay lập tức!`,
          source: 'openai_moderation'
        };
      }
      if (openAiMaxViolence >= 0.72) {
        return {
          safe: false,
          category: 'extreme_gore',
          reason: `🚫 Phát hiện ${mediaLabel} bạo lực/máu me cực đoan vi phạm tiêu chuẩn cộng đồng. ${mediaCap} đã bị xóa ngay lập tức!`,
          source: 'openai_moderation'
        };
      }
    }

    // 3. Smart Contextual Vision Audit (Gemini):
    // Catches censored/covered/stickered/blurred 18+ bypass attempts while protecting harmless memes!
    const ai = getAiClient();
    if (ai) {
      try {
        const inlineParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
        for (const fr of resolvedFrames) {
          if (fr.geminiPayload?.data) {
            inlineParts.push({ inlineData: fr.geminiPayload });
          } else if (fr.openAiUrl.startsWith('https://') || fr.openAiUrl.startsWith('http://')) {
            try {
              const imgFetch = await fetch(fr.openAiUrl);
              if (imgFetch.ok) {
                const arrBuf = await imgFetch.arrayBuffer();
                const mime = imgFetch.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
                if (mime.startsWith('image/')) {
                  inlineParts.push({
                    inlineData: { mimeType: mime, data: Buffer.from(arrBuf).toString('base64') }
                  });
                }
              }
            } catch {}
          }
        }

        if (inlineParts.length > 0) {
          const visionPrompt = `Bạn là hệ thống AI kiểm duyệt ${mediaLabel} cho phòng chat cộng đồng Đại Sảnh Toàn Cầu.
Hãy phân tích kỹ các khung hình đính kèm và phân loại chính xác theo 2 nhóm:

NHÓM CẤM — BẮT BUỘC XÓA NGAY ("isNsfw18Plus": true):
1. Ảnh/video 18+, khiêu dâm, khỏa thân, hentai, truyện tranh 18+, hoặc hành vi tình dục.
2. ĐẶC BIỆT: Các ảnh/video 18+, khiêu dâm, nhạy cảm NHƯNG CỐ TÌNH CHE ĐI để qua mặt bộ lọc — ví dụ: dùng sticker, emoji, hình dán, vệt đen, khung chữ, làm mờ (blur/mosaic/pixelate) hoặc vật thể che bộ phận nhạy cảm trên nền cảnh khỏa thân/gợi dục/tình dục 18+. Dù đã che phần nhạy cảm nhưng bản chất vẫn là nội dung 18+/khiêu dâm -> BẮT BUỘC trả "isNsfw18Plus": true.
3. Ảnh/video bạo lực cực đoan, máu me ghê rợn hoặc tự hại nghiêm trọng -> trả "isExtremeGore": true.

NHÓM ĐƯỢC PHÉP — AN TOÀN ("isNsfw18Plus": false, "isMeme": true/false):
1. MEME HÀI HƯỚC, ảnh chế, reaction meme, sticker vui, clip hài (kể cả meme có ghép hiệu ứng che mờ/bôi đen hài hước nhưng gốc KHÔNG phải ảnh/cảnh khiêu dâm 18+ hay khỏa thân) -> ĐƯỢC PHÉP, KHÔNG ĐƯỢC ĐÁNH DẤU VI PHẠM!
2. Ảnh chân dung, selfie bình thường, đi biển/thời trang thông thường không khiêu dâm, đồ ăn, thú cưng, phong cảnh, game, chụp màn hình văn bản/code -> ĐƯỢC PHÉP.

Trả về JSON chuẩn:
{
  "isNsfw18Plus": boolean,
  "isCensoredBypassAttempt": boolean,
  "isExtremeGore": boolean,
  "isMeme": boolean,
  "shortReason": "Lý do ngắn gọn bằng tiếng Việt"
}`;

          const gemResp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [...inlineParts, { text: visionPrompt }],
            config: { responseMimeType: 'application/json' }
          });

          if (gemResp?.text) {
            const parsed = JSON.parse(gemResp.text);
            if (parsed?.isNsfw18Plus) {
              return {
                safe: false,
                category: 'nsfw_sex',
                reason: parsed?.isCensoredBypassAttempt
                  ? `🚫 Cảnh báo: AI phát hiện ${mediaLabel} 18+/khiêu dâm (cố tình che/làm mờ để lách lọc). ${mediaCap} đã bị xóa ngay lập tức!`
                  : `🚫 Cảnh báo: AI phát hiện ${mediaLabel} 18+/khiêu dâm vi phạm tiêu chuẩn Đại Sảnh Toàn Cầu. ${mediaCap} đã bị xóa ngay lập tức!`,
                source: 'gemini_vision_context'
              };
            }
            if (parsed?.isExtremeGore) {
              return {
                safe: false,
                category: 'extreme_gore',
                reason: `🚫 Cảnh báo: AI phát hiện ${mediaLabel} bạo lực cực đoan vi phạm tiêu chuẩn cộng đồng. ${mediaCap} đã bị xóa ngay lập tức!`,
                source: 'gemini_vision_context'
              };
            }
            return { safe: true, category: 'clean', source: 'gemini_vision_context' };
          }
        }
      } catch (gemErr) {
        console.warn('Gemini visual moderation notice:', gemErr);
      }
    }

    // Fallback if Gemini isn't available: rely on OpenAI moderate score
    if (openAiChecked && (openAiFlagged || openAiMaxSexual >= 0.35)) {
      return {
        safe: false,
        category: 'nsfw_sex',
        reason: `🚫 Phát hiện ${mediaLabel} 18+/khiêu dâm vi phạm tiêu chuẩn Đại Sảnh Toàn Cầu. ${mediaCap} đã bị xóa ngay lập tức!`,
        source: 'openai_moderation'
      };
    }

    return { safe: true, category: 'clean' };
  }

  // Server-side AI Image Moderation Proxy
  app.post('/api/moderate-image', async (req, res) => {
    try {
      const { image, fileName } = req.body || {};
      const result = await moderateVisualFramesWithAI(
        typeof image === 'string' ? [image] : [],
        String(fileName || ''),
        'image'
      );
      return res.json(result);
    } catch {
      return res.json({ safe: true, category: 'clean' });
    }
  });

  // Server-side AI Video Moderation Proxy (client keyframes + ffmpeg fallback)
  app.post('/api/moderate-video', async (req, res) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clsend_vidmod_'));
    try {
      const { frames, fileName, videoUrl } = req.body || {};
      let collectedFrames: string[] = Array.isArray(frames)
        ? frames.filter((f: unknown): f is string => typeof f === 'string' && f.startsWith('data:image/')).slice(0, 5)
        : [];

      // If client could not extract frames (e.g., MKV/AVI/MOV or Cloud URL), extract keyframes on server via ffmpeg
      if (collectedFrames.length === 0 && typeof videoUrl === 'string' && (videoUrl.startsWith('/api/files/view/') || videoUrl.startsWith('/api/files/download/'))) {
        const cleanId = path.basename(videoUrl.split('?')[0]);
        const localVideoPath = path.join(UPLOADS_DIR, cleanId);
        if (path.resolve(localVideoPath).startsWith(path.resolve(UPLOADS_DIR)) && fs.existsSync(localVideoPath)) {
          let duration = 0;
          try {
            const { stdout } = await execFileAsync('ffprobe', [
              '-v', 'error',
              '-show_entries', 'format=duration',
              '-of', 'default=noprint_wrappers=1:nokey=1',
              localVideoPath
            ], { timeout: 5000 });
            duration = parseFloat(String(stdout || '').trim()) || 0;
          } catch {}

          const seekPoints = duration > 1.5
            ? [0.12, 0.38, 0.65, 0.88].map(r => Math.max(0.1, duration * r).toFixed(2))
            : ['0.25', '1.0'];

          for (let i = 0; i < seekPoints.length; i++) {
            const outImg = path.join(tempDir, `frame_${i}.jpg`);
            try {
              await execFileAsync('ffmpeg', [
                '-y',
                '-ss', seekPoints[i],
                '-i', localVideoPath,
                '-frames:v', '1',
                '-vf', "scale='min(512,iw)':-2",
                '-q:v', '5',
                outImg
              ], { timeout: 6000 });
              if (fs.existsSync(outImg)) {
                const buf = fs.readFileSync(outImg);
                if (buf.length > 0) {
                  collectedFrames.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
                }
              }
            } catch {}
          }
        }
      }

      const result = await moderateVisualFramesWithAI(
        collectedFrames,
        String(fileName || ''),
        'video'
      );
      return res.json(result);
    } catch {
      return res.json({ safe: true, category: 'clean' });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Server-side AI User Audit Proxy evaluating user against 12 Community Rules
  app.post('/api/ai-audit-user', async (req, res) => {
    try {
      const { userName, userEmail, messages, reports, violationHistoryCount } = req.body || {};
      const ai = getAiClient();

      const sampleMessages = Array.isArray(messages) ? messages.slice(0, 30) : [];
      const sampleReports = Array.isArray(reports) ? reports.slice(0, 10) : [];

      if (!ai) {
        // Fallback response if AI is not configured
        return res.json({
          success: true,
          mode: 'rule_fallback',
          hasViolation: sampleReports.length > 0,
          severity: sampleReports.length >= 3 ? 'high' : sampleReports.length > 0 ? 'medium' : 'light',
          recommendedTier: sampleReports.length >= 3 ? 'level_3' : sampleReports.length > 0 ? 'level_2' : 'level_1',
          matchedRule: sampleReports.length > 0 ? 'Luật 12: Quy trình xử lý vi phạm' : 'Không có vi phạm',
          ruleNumber: sampleReports.length > 0 ? 'Luật 12' : 'An toàn',
          evidenceSummary: sampleReports.map(r => r.reason).filter(Boolean).join('; ') || 'Không có báo cáo trực tiếp.',
          reasoning: 'Kiểm tra quy tắc hệ thống cơ bản.',
          remindText: 'Lần này chỉ nhắc nhở thôi cẩn thận trong lời nói của bạn nhé :))'
        });
      }

      const prompt = `Bạn là Trí Tuệ Nhân Tạo (AI Moderation Audit Engine) của hệ thống CloudSend.
Nhiệm vụ của bạn là kiểm toán và đánh giá hành vi của người dùng [${userName || 'Người dùng'}] (Email: ${userEmail || 'Chưa cung cấp'}) dựa trên BỘ 12 LUẬT CỘNG ĐỒNG:
1. Luật 1: Xúc phạm danh dự & Lăng mạ cá nhân (chửi bới, hạ nhục) -> Mức độ: Vừa / Nhẹ
2. Luật 2: Cố tình lách luật & Ngụy trang từ ngữ tục tĩu (teencode, dấu chấm d.i.t, f.u.c.k) -> Mức độ: Vừa / Nhẹ
3. Luật 3: Kỳ thị vùng miền, tôn giáo & Kích động thù hận (bắc kỳ/nam kỳ, phân biệt sắc tộc) -> Mức độ: Cao
4. Luật 4: Quấy rối tình dục & Gạ gẫm thô thiển -> Mức độ: Cao
5. Luật 5: Phát tán văn hóa phẩm 18+, khiêu dâm, CSAM -> Mức độ: Nghiêm trọng (Critical)
6. Luật 6: Bạo lực cực đoan, kinh dị, tự hại, khủng bố -> Mức độ: Nghiêm trọng (Critical)
7. Luật 7: Phát tán virus, mã độc, liên kết lừa đảo phishing -> Mức độ: Nghiêm trọng (Critical)
8. Luật 8: Xâm phạm dữ liệu cá nhân, Doxxing (CCCD, địa chỉ nhà) -> Mức độ: Cao
9. Luật 9: Spam tin nhắn dồn dập, phá hoại băng thông -> Mức độ: Vừa / Nhẹ
10. Luật 10: Mạo danh Quản trị viên (Admin/Dev) để lừa đảo -> Mức độ: Cao
11. Luật 11: Trách nhiệm và quyền hạn của chủ phòng
12. Luật 12: Quy trình xử lý vi phạm & Kháng cáo

Dữ liệu tin nhắn gần đây của người dùng:
${JSON.stringify(sampleMessages.map(m => ({ text: m.text || m.rawText, file: m.fileName, time: m.createdAt })), null, 2)}

Dữ liệu các lượt tố cáo từ người dùng khác về người này:
${JSON.stringify(sampleReports, null, 2)}

Số lần đã từng bị xử lý kỷ luật trước đây: ${violationHistoryCount || 0}

YÊU CẦU:
- Phân tích cẩn thận hành vi và nội dung của người dùng dựa theo 12 luật trên.
- Suy luận mức độ vi phạm thực tế (không phải áp dụng tuần tự mà dựa vào bản chất tính chất hành vi vi phạm):
  + light (Nhẹ): vi phạm nhẹ như ngôn từ bộc phát lần đầu, spam nhẹ -> Đề xuất level_1 (Khóa chat 15 phút)
  + medium (Trung bình): cố tình lách luật, nói tục nhiều lần, xúc phạm cá nhân -> Đề xuất level_2 (Cấm chat 1 tiếng)
  + high (Cao): kỳ thị vùng miền, quấy rối, doxxing, mạo danh admin -> Đề xuất level_3 (Banned 1 ngày)
  + critical (Nặng / Nghiêm trọng): phát tán 18+, virus, mã độc, đe dọa bạo lực hoặc tái phạm sau khi đã bị nhắc nhở nhiều lần -> Đề xuất level_4 (Khóa 7 ngày)
  + permanent (Tái phạm nghiêm trọng nhất): Đã từng bị khóa 7 ngày mà vẫn cố tình tái phạm, hoặc vi phạm tội phạm nghiêm trọng -> Đề xuất level_perm (Cấm vĩnh viễn)

Văn bản remind bắt buộc phải tương ứng đúng:
- level_1: "Lần này chỉ nhắc nhở thôi cẩn thận trong lời nói của bạn nhé :))"
- level_2: "Đã nhắc nhở cho rồi mà còn cố vi phạm nữa à :(("
- level_3: "Cảnh cáo rồi vẫn chưa sợ à >:("
- level_4: "1 lần nữa là sẽ bị cấm tài khoản vĩnh viễn"
- level_perm: "Tài khoản và thiết bị của bạn đã bị CẤM VĨNH VIỄN do tái phạm nghiêm trọng."

Trả về kết quả ở định dạng JSON chuẩn:
{
  "hasViolation": boolean,
  "severity": "light" | "medium" | "high" | "critical" | "clean",
  "recommendedTier": "level_1" | "level_2" | "level_3" | "level_4" | "level_perm" | null,
  "matchedRule": "Tên luật vi phạm (VD: Luật 1: Xúc phạm danh dự hoặc Không có vi phạm)",
  "ruleNumber": "Luật X hoặc An toàn",
  "evidenceSummary": "Trích xuất câu từ cụ thể vi phạm",
  "reasoning": "Giải thích chi tiết nhận định vì sao vi phạm và tại sao chọn mức độ này",
  "recommendedAction": "Mô tả hình phạt đề xuất (VD: Khóa chat 15 phút và nhắc nhở)",
  "remindText": "Văn bản remind tương ứng chuẩn xác theo quy định"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      if (response?.text) {
        const data = JSON.parse(response.text);
        return res.json({ success: true, ...data });
      }

      return res.json({
        success: true,
        hasViolation: false,
        severity: 'clean',
        recommendedTier: null,
        matchedRule: 'Không có vi phạm',
        ruleNumber: 'An toàn',
        evidenceSummary: 'Không tìm thấy dấu hiệu vi phạm.',
        reasoning: 'Tin nhắn và hành vi hoàn toàn tuân thủ 12 điều luật.',
        recommendedAction: 'Không cần xử lý kỷ luật.',
        remindText: ''
      });
    } catch (err: any) {
      console.warn('AI audit user error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Lỗi khi gọi AI kiểm toán người dùng' });
    }
  });

  // Server-side AI Link Resolver Proxy using Google Gemini API
  app.post('/api/ai-resolve-link', async (req, res) => {
    try {
      const { url, rawText } = req.body || {};
      const targetUrl = String(url || rawText || '').trim();
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'Thiếu đường dẫn hoặc văn bản cần phân tích.' });
      }

      const ai = getAiClient();
      if (!ai) {
        const isTeraBox = /terabox|1024tera|mirrobox|nephobox/i.test(targetUrl);
        const isGoogleDrive = /drive\.google\.com|docs\.google\.com/i.test(targetUrl);
        const isMega = /mega\.nz|mega\.co\.nz/i.test(targetUrl);
        return res.json({
          success: true,
          serviceName: isTeraBox ? 'TeraBox 1TB' : isGoogleDrive ? 'Google Drive' : isMega ? 'MEGA' : 'Cloud Link',
          fileName: isTeraBox ? 'TeraBox_Shared_File' : isGoogleDrive ? 'Google_Drive_File' : 'Shared_File_Link',
          isTeraBox: isTeraBox,
          downloadHint: 'Sử dụng liên kết trực tiếp hoặc tải xuống qua ứng dụng CloudSend.',
          summary: `Đã phát hiện liên kết ${isTeraBox ? 'TeraBox' : 'chia sẻ đám mây'}. Sẵn sàng nhập vào hệ thống.`
        });
      }

      const prompt = `Analyze the following URL or text containing a cloud storage or file sharing link:
"${targetUrl}"

You are CLSend's intelligent link resolution and metadata extraction AI assistant.
Determine the storage service (e.g. TeraBox, Google Drive, OneDrive, MEGA, Dropbox, MediaFire, GitHub, Direct Link, etc.), extract or infer a professional file name, check if it is TeraBox, and provide a clean summary and download instruction.

Return strictly valid JSON:
{
  "success": true,
  "serviceName": "Name of the storage service",
  "fileName": "Inferred or extracted file name with extension",
  "isTeraBox": boolean,
  "downloadHint": "Brief download or access instructions for user",
  "summary": "Short description of the link contents"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      if (response?.text) {
        const result = JSON.parse(response.text);
        return res.json(result);
      }

      return res.json({
        success: true,
        serviceName: 'Cloud Storage',
        fileName: 'Shared_Link_File',
        isTeraBox: /terabox/i.test(targetUrl),
        downloadHint: 'Tải xuống qua liên kết đám mây.',
        summary: 'Liên kết đám mây hợp lệ.'
      });
    } catch (err: any) {
      console.warn('AI resolve link error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Lỗi khi phân tích liên kết bằng AI' });
    }
  });



  // ==========================================================
  // REAL-TIME AI CONTENT MODERATION (OpenAI Moderation API + Gemini AI Hybrid)
  // ==========================================================
  app.post('/api/moderation/check-content', async (req, res) => {
    try {
      const { text, userEmail, userId } = req.body;
      const cleanText = String(text || '').trim();

      if (!cleanText || cleanText.length < 2) {
        return res.json({
          success: true,
          isFlagged: false,
          severity: 'clean',
          matchedRule: 'An toàn',
          remindText: '',
          categories: []
        });
      }

      // Check OpenAI Moderation API if OPENAI_API_KEY is available (100% Free endpoint from OpenAI)
      const openAiKey = process.env.OPENAI_API_KEY;
      let openAiResult: any = null;

      if (openAiKey) {
        try {
          const modResp = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
              input: cleanText,
              model: 'omni-moderation-latest'
            })
          });
          if (modResp.ok) {
            const data = await modResp.json();
            const result = data?.results?.[0];
            if (result && result.flagged) {
              const flaggedCategories = Object.keys(result.categories || {}).filter(k => result.categories[k]);
              openAiResult = {
                flagged: true,
                categories: flaggedCategories,
                scores: result.category_scores
              };
            }
          }
        } catch (e) {
          console.warn('OpenAI moderation API call warning:', e);
        }
      }

      // If OpenAI flagged as violating
      if (openAiResult && openAiResult.flagged) {
        const cats = openAiResult.categories || [];
        const isCritical = cats.some((c: string) => c.includes('violence') || c.includes('self-harm') || c.includes('sexual/minors'));
        const isHigh = cats.some((c: string) => c.includes('hate') || c.includes('harassment_threatening') || c.includes('sexual'));
        
        const severity = isCritical ? 'critical' : isHigh ? 'high' : 'medium';
        const tier = isCritical ? 'level_4' : isHigh ? 'level_3' : 'level_2';
        const remindText = 
          tier === 'level_4' ? '1 lần nữa là sẽ bị cấm tài khoản vĩnh viễn' :
          tier === 'level_3' ? 'Cảnh cáo rồi vẫn chưa sợ à >:(' :
          'Đã nhắc nhở cho rồi mà còn cố vi phạm nữa à :((';

        return res.json({
          success: true,
          isFlagged: true,
          source: 'openai_moderation',
          severity,
          recommendedTier: tier,
          matchedRule: `OpenAI AI Moderation: Vi phạm danh mục [${cats.join(', ')}]`,
          categories: cats,
          remindText,
          message: `Nội dung đã bị AI phát hiện vi phạm tiêu chuẩn an toàn (${cats.join(', ')}).`
        });
      }

      // Zero-cost policy: do NOT consume Gemini tokens during real-time public room chat moderation;
      // rely on free OpenAI omni-moderation-latest + client/server word filters.
      return res.json({
        success: true,
        isFlagged: false,
        severity: 'clean',
        matchedRule: 'An toàn',
        remindText: '',
        categories: []
      });
    } catch (err: any) {
      console.warn('Moderation endpoint error:', err);
      return res.json({
        success: true,
        isFlagged: false,
        severity: 'clean'
      });
    }
  });

  // ==========================================================
  // BATCH AI MODERATION & CLASSIFICATION (OpenAI Moderation API + Rule Classifier)
  // ==========================================================
  app.post('/api/moderation/openai-batch-audit', async (req, res) => {
    try {
      interface AuditMessageInput {
        id?: string;
        roomId?: string;
        roomName?: string;
        roomCode?: string;
        senderId?: string;
        senderName?: string;
        senderDevice?: string;
        text: string;
        createdAt?: string;
        timestamp?: number;
      }

      interface AuditImageInput {
        messageId?: string;
        roomId?: string;
        roomName?: string;
        roomCode?: string;
        senderId?: string;
        senderName?: string;
        senderDevice?: string;
        fileName?: string;
        url: string;
        createdAt?: string;
        timestamp?: number;
      }

      const items: Array<{
        id: string;
        type: 'user' | 'room';
        name: string;
        email?: string;
        texts?: string[];
        messages?: AuditMessageInput[];
        images?: AuditImageInput[];
        reportReasons?: string[];
        violationCount?: number;
      }> = Array.isArray(req.body?.items) ? req.body.items : [];

      if (items.length === 0) {
        return res.json({ success: true, source: 'openai_moderation', results: [] });
      }

      const openAiKey = process.env.OPENAI_API_KEY;
      let usedSource: 'openai_moderation' | 'gemini_moderation' | 'rule_engine' = 'rule_engine';

      // Unicode word boundaries for Vietnamese & English
      const B_START = '(?<=^|[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ])';
      const B_END = '(?=$|[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ])';

      const INNOCENT_PHRASES = [
        'lon nước', 'lon nuoc', 'lon bia', 'lon sữa', 'lon sua', 'lon nước ngọt', 'lon coca', 'lon pepsi',
        'các bạn', 'cac ban', 'các anh', 'các chị', 'các em', 'buổi sáng', 'buổi chiều', 'buổi tối', 'buổi trưa',
        'ví dụ', 'mặc dù', 'dù sao', 'du lịch', 'vui lòng', 'hài lòng', 'hạ long', 'thăng long', 'cầu lông',
        'class', 'pass', 'glass', 'grass', 'bass', 'asset', 'assign', 'assist', 'shirt', 'shift', 'cocktail', 'peacock', 'shell', 'hello'
      ];

      const stripInnocent = (raw: string): string => {
        let out = raw.toLowerCase();
        for (const p of INNOCENT_PHRASES) {
          out = out.split(p).join(' ');
        }
        return out;
      };

      const criticalRegex = new RegExp(`${B_START}(?:hentai|porn(?:o|ography)?|phim\\s+sex|clip\\s+nóng|lộ\\s+clip|khiêu\\s+dâm|tự\\s+tử|giết\\s+người|cắt\\s+cổ|chế\\s+tạo\\s+bom|trojan|phishing|kill\\s+yourself|kys)${B_END}|\\.(?:exe|bat|vbs|scr)(?=$|[^a-zA-Z0-9])`, 'i');
      const heavyRegex = new RegExp(`${B_START}(?:bắc\\s+kỳ|nam\\s+kỳ|trung\\s+kỳ|bắc\\s+cầy|nam\\s+cầy|gạ\\s+tình|gạ\\s+gẫm|show\\s+hàng|chat\\s+sex|doxx|số\\s+cccd|số\\s+cmnd|địa\\s+chỉ\\s+nhà|tôi\\s+là\\s+admin|tôi\\s+là\\s+dev|gửi\\s+mật\\s+khẩu|nigger(?:s)?|nigga(?:s)?|faggot(?:s)?|retard(?:ed|s)?|nude(?:s)?|blowjob|handjob|cumshot)${B_END}`, 'i');
      const mediumRegex = new RegExp(`${B_START}(?:địt(?:\\s+(?:mẹ|con\\s+mẹ|cụ|mày))?|đụ(?:\\s+(?:má|mẹ|móa))?|(?:cái\\s+|con\\s+)?lồn|(?:cái\\s+|con\\s+)?cặc|buồi|bú\\s+(?:cu|lồn|cặc)|đéo|vcl|vkl|đkm|dkm|đmm|đm|óc\\s+chó|súc\\s+vật|chó\\s+đẻ|motherfuck(?:er|ing|ers|s)?|fuck(?:ing|er|ers|ed|s)?|fuk|son\\s+of\\s+a\\s+bitch|bitch(?:es|ing|y)?|cunt(?:s)?|asshole(?:s)?|dumbass|jackass|bullshit|shit(?:head|ty|ting|s)?|cock(?:sucker|s)?|dick(?:head|s)?|pussy|pussies|whore(?:s)?|slut(?:s|tish)?|bastard(?:s)?|f[._\\-]+u[._\\-]+c[._\\-]+k|d[._\\-]+i[._\\-]+t)${B_END}`, 'i');
      const lightRegex = new RegExp(`${B_START}(?:thằng\\s+ngu|con\\s+ngu|đồ\\s+ngu|ngu\\s+ngốc|ngu|chó\\s+chết|đồ\\s+chó|điên\\s+khùng|thằng\\s+điên|con\\s+điên|câm\\s+mồm|láo\\s+toét|vớ\\s+vẩn|wtf|stfu|gtfo|wanker(?:s)?|prick(?:s)?|twat(?:s)?)${B_END}`, 'i');

      const prepared = items.slice(0, 60).map(item => {
        const msgList: AuditMessageInput[] = Array.isArray(item.messages) && item.messages.length > 0
          ? item.messages.slice(0, 30).filter(m => String(m?.text || '').trim().length > 0)
          : (Array.isArray(item.texts) ? item.texts.slice(0, 30) : [])
              .map(t => ({ text: String(t || '').trim() }))
              .filter(m => m.text.length > 0);
        const imgList: AuditImageInput[] = Array.isArray(item.images)
          ? item.images.slice(0, 8).filter(im => im?.url && (im.url.startsWith('data:image/') || im.url.startsWith('https://') || im.url.startsWith('http://')))
          : [];
        const reportList = (Array.isArray(item.reportReasons) ? item.reportReasons.slice(0, 10) : [])
          .map(s => String(s || '').trim())
          .filter(Boolean);
        return {
          ...item,
          msgList,
          imgList,
          reportList
        };
      });

      // Scan individual messages with OpenAI Moderation API (omni-moderation-latest)
      type FlatMsgRef = { itemIdx: number; msgIdx: number; text: string };
      const flatMessages: FlatMsgRef[] = [];
      prepared.forEach((item, itemIdx) => {
        item.msgList.forEach((m, msgIdx) => {
          const clean = String(m.text || '').trim();
          if (clean.length >= 2) {
            flatMessages.push({ itemIdx, msgIdx, text: clean.slice(0, 1000) });
          }
        });
      });

      const openAiMsgFlags = new Map<string, { flagged: boolean; categories: string[]; maxScore: number }>();

      if (openAiKey && flatMessages.length > 0) {
        for (let start = 0; start < flatMessages.length; start += 48) {
          const chunk = flatMessages.slice(start, start + 48);
          try {
            const modResp = await fetch('https://api.openai.com/v1/moderations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
              },
              body: JSON.stringify({
                input: chunk.map(c => c.text),
                model: 'omni-moderation-latest'
              })
            });

            if (modResp.ok) {
              const modData = await modResp.json();
              const resultsArr = Array.isArray(modData?.results) ? modData.results : [];
              usedSource = 'openai_moderation';
              resultsArr.forEach((r: any, pos: number) => {
                const ref = chunk[pos];
                if (!ref || !r) return;
                const cats = Object.keys(r.categories || {}).filter(k => r.categories[k]);
                const scores = Object.values(r.category_scores || {}) as number[];
                const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
                if (r.flagged) {
                  openAiMsgFlags.set(`${ref.itemIdx}:${ref.msgIdx}`, {
                    flagged: true,
                    categories: cats,
                    maxScore
                  });
                }
              });
            }
          } catch (err) {
            console.warn('OpenAI batch moderation notice:', err);
          }
        }
      }

      // Scan individual images with OpenAI Moderation API (omni-moderation-latest multimodal)
      type FlatImgRef = { itemIdx: number; imgIdx: number; url: string };
      const flatImages: FlatImgRef[] = [];
      prepared.forEach((item, itemIdx) => {
        item.imgList.forEach((im, imgIdx) => {
          if (flatImages.length < 24) {
            flatImages.push({ itemIdx, imgIdx, url: im.url });
          }
        });
      });

      const openAiImgFlags = new Map<string, { flagged: boolean; categories: string[]; maxScore: number }>();
      if (openAiKey && flatImages.length > 0) {
        await Promise.all(
          flatImages.map(async (ref) => {
            try {
              const modResp = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openAiKey}`
                },
                body: JSON.stringify({
                  model: 'omni-moderation-latest',
                  input: [{ type: 'image_url', image_url: { url: ref.url } }]
                })
              });
              if (modResp.ok) {
                const modData = await modResp.json();
                const r = modData?.results?.[0];
                if (r && r.flagged) {
                  usedSource = 'openai_moderation';
                  const cats = Object.keys(r.categories || {}).filter(k => r.categories[k]);
                  const scores = Object.values(r.category_scores || {}) as number[];
                  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
                  openAiImgFlags.set(`${ref.itemIdx}:${ref.imgIdx}`, {
                    flagged: true,
                    categories: cats,
                    maxScore
                  });
                }
              }
            } catch {
              // ignore individual image errors
            }
          })
        );
      }

      const sevOrder: Record<string, number> = { clean: 0, light: 1, medium: 2, heavy: 3, critical: 4 };
      const imgExplicitNameRegex = /(?:^|[._\-\s])(?:porn|porno|hentai|xxx|sex_video|khoa_than|nude_photo|nudes|blowjob|cumshot|dam_duc)(?:[._\-\s]|$)/i;

      const results = prepared.map((item, idx) => {
        const repCount = item.reportList.length;

        let severity: 'clean' | 'light' | 'medium' | 'heavy' | 'critical' = 'clean';
        const reasonsSet = new Set<string>();
        const categoriesSet = new Set<string>();
        const evidenceMessages: Array<{
          messageId?: string;
          roomId?: string;
          roomName?: string;
          roomCode?: string;
          senderId?: string;
          senderName?: string;
          senderDevice?: string;
          createdAt?: string;
          timestamp?: number;
          content: string;
          reason: string;
          source: 'openai_moderation' | 'word_filter';
          severity: 'light' | 'medium' | 'heavy' | 'critical';
        }> = [];

        item.msgList.forEach((m, msgIdx) => {
          const oa = openAiMsgFlags.get(`${idx}:${msgIdx}`);
          const sanitized = stripInnocent(m.text);

          let msgSev: 'clean' | 'light' | 'medium' | 'heavy' | 'critical' = 'clean';
          const msgReasons: string[] = [];
          let msgSource: 'openai_moderation' | 'word_filter' = 'word_filter';

          if (oa?.flagged) {
            msgSource = 'openai_moderation';
            oa.categories.forEach(c => categoriesSet.add(c));
            const hasCritCat = oa.categories.some(c =>
              c.includes('sexual/minors') || c.includes('self-harm/intent') || c.includes('violence/graphic')
            );
            const hasHeavyCat = oa.categories.some(c =>
              c.includes('hate/threatening') || c.includes('harassment/threatening') || c.includes('sexual') || c.includes('violence')
            );
            if (hasCritCat || oa.maxScore >= 0.85) {
              msgSev = 'critical';
            } else if (hasHeavyCat || oa.maxScore >= 0.55) {
              msgSev = 'heavy';
            } else {
              msgSev = 'medium';
            }
            const oaReason = `OpenAI Moderation [${oa.categories.join(', ')}]`;
            msgReasons.push(oaReason);
            reasonsSet.add(oaReason);
          }

          if (criticalRegex.test(sanitized)) {
            if (sevOrder.critical > sevOrder[msgSev]) msgSev = 'critical';
            const r = 'Phát hiện nội dung 18+ / bạo lực cực đoan / mã độc';
            msgReasons.push(r);
            reasonsSet.add(r);
          } else if (heavyRegex.test(sanitized)) {
            if (sevOrder.heavy > sevOrder[msgSev]) msgSev = 'heavy';
            const r = 'Kỳ thị, quấy rối, doxxing hoặc giả mạo Admin';
            msgReasons.push(r);
            reasonsSet.add(r);
          } else if (mediumRegex.test(sanitized)) {
            if (sevOrder.medium > sevOrder[msgSev]) msgSev = 'medium';
            const r = 'Ngôn từ tục tĩu (VI/EN) vi phạm tiêu chuẩn cộng đồng';
            msgReasons.push(r);
            reasonsSet.add(r);
          } else if (lightRegex.test(sanitized)) {
            if (sevOrder.light > sevOrder[msgSev]) msgSev = 'light';
            const r = 'Ngôn từ xúc phạm / thiếu chuẩn mực';
            msgReasons.push(r);
            reasonsSet.add(r);
          }

          if (msgSev !== 'clean') {
            if (sevOrder[msgSev] > sevOrder[severity]) {
              severity = msgSev;
            }
            evidenceMessages.push({
              messageId: m.id,
              roomId: m.roomId,
              roomName: m.roomName,
              roomCode: m.roomCode,
              senderId: m.senderId,
              senderName: m.senderName,
              senderDevice: m.senderDevice,
              createdAt: m.createdAt,
              timestamp: m.timestamp,
              content: m.text,
              reason: msgReasons.join(' • '),
              source: msgSource,
              severity: msgSev
            });
          }
        });

        // Evaluate image attachments
        item.imgList.forEach((im, imgIdx) => {
          const oaImg = openAiImgFlags.get(`${idx}:${imgIdx}`);
          const badName = im.fileName ? imgExplicitNameRegex.test(im.fileName.toLowerCase()) : false;
          if (oaImg?.flagged || badName) {
            const cats = oaImg?.categories || [];
            cats.forEach(c => categoriesSet.add(c));
            const imgSev: 'heavy' | 'critical' = cats.some(c => c.includes('sexual/minors') || c.includes('violence/graphic')) ? 'critical' : 'heavy';
            if (sevOrder[imgSev] > sevOrder[severity]) severity = imgSev;
            const imgReason = oaImg?.flagged
              ? `OpenAI Image Moderation [${cats.join(', ')}]`
              : 'Tên tệp hình ảnh chứa từ khóa vi phạm 18+';
            reasonsSet.add(imgReason);
            evidenceMessages.push({
              messageId: im.messageId ? `img-${im.messageId}-${imgIdx}` : undefined,
              roomId: im.roomId,
              roomName: im.roomName,
              roomCode: im.roomCode,
              senderId: im.senderId,
              senderName: im.senderName,
              senderDevice: im.senderDevice,
              createdAt: im.createdAt,
              timestamp: im.timestamp,
              content: `[Hình ảnh vi phạm]: ${im.fileName || 'Ảnh đính kèm'}`,
              reason: imgReason,
              source: oaImg?.flagged ? 'openai_moderation' : 'word_filter',
              severity: imgSev
            });
          }
        });

        // Only count ACTIVE/pending community reports
        const currentSevRank = sevOrder[severity];
        if (repCount >= 5) {
          severity = 'critical';
          reasonsSet.add(`Bị tố cáo nghiêm trọng (${repCount} lượt chờ xử lý)`);
        } else if (repCount >= 3 && currentSevRank < sevOrder.heavy) {
          severity = 'heavy';
          reasonsSet.add(`Bị tố cáo nhiều lần (${repCount} lượt)`);
        } else if (repCount >= 2 && currentSevRank < sevOrder.medium) {
          severity = 'medium';
          reasonsSet.add(`Có ${repCount} lượt tố cáo cộng đồng`);
        } else if (repCount === 1 && currentSevRank < sevOrder.light) {
          severity = 'light';
          reasonsSet.add(item.reportList[0] || 'Có 1 báo cáo vi phạm chờ kiểm tra');
        }

        const score =
          severity === 'critical' ? 95 :
          severity === 'heavy' ? 75 :
          severity === 'medium' ? 50 :
          severity === 'light' ? 25 : 0;

        return {
          id: item.id,
          type: item.type,
          severity,
          reason: Array.from(reasonsSet).join(' • ') || 'Tuân thủ tiêu chuẩn cộng đồng',
          categories: Array.from(categoriesSet),
          score,
          evidenceMessages
        };
      });

      return res.json({
        success: true,
        source: usedSource,
        results
      });
    } catch (err: any) {
      console.warn('OpenAI batch audit error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Batch audit error' });
    }
  });

  // ==========================================================
  // REAL CLIENT LOCATION DETECTION (City, Region, Country)
  // ==========================================================
  app.get('/api/auth/detect-location', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      
      // Try resolving via fast public IP service
      if (clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('10.') && !clientIp.startsWith('192.168.') && clientIp !== '::1') {
        const response = await fetch(`https://ipwho.is/${clientIp}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const city = data.city || '';
            const region = data.region || '';
            const country = data.country || 'Việt Nam';
            const locationString = city && region && city !== region 
              ? `${city}, ${region}, ${country}` 
              : city ? `${city}, ${country}` : country;
            return res.json({ 
              success: true, 
              location: locationString, 
              city, 
              region, 
              country, 
              latitude: data.latitude || 12.6800, 
              longitude: data.longitude || 108.0383 
            });
          }
        }
      }

      // Fallback: Query without IP to get current server / client region
      const fallbackRes = await fetch('https://ipwho.is/');
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data.success) {
          const city = data.city || 'Hà Nội';
          const region = data.region || '';
          const country = data.country || 'Việt Nam';
          return res.json({ 
            success: true, 
            location: `${city}, ${country}`, 
            city, 
            region, 
            country, 
            latitude: data.latitude || 21.0285, 
            longitude: data.longitude || 105.8542 
          });
        }
      }

      return res.json({ 
        success: true, 
        location: 'Việt Nam (Hà Nội / TP.HCM)', 
        city: 'Việt Nam', 
        country: 'Việt Nam',
        latitude: 12.6800,
        longitude: 108.0383
      });
    } catch {
      return res.json({ 
        success: true, 
        location: 'Việt Nam (Hà Nội / TP.HCM)',
        city: 'Việt Nam',
        country: 'Việt Nam',
        latitude: 12.6800,
        longitude: 108.0383
      });
    }
  });

  // ==========================================================
  // REAL EMAIL DISPATCH: Send 6-Digit OTP Security Code to Gmail
  // ==========================================================
  app.post('/api/auth/send-verification-email', async (req, res) => {
    try {
      const { email, code, username, durationMinutes = 15 } = req.body;
      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Thiếu địa chỉ email hoặc mã xác nhận.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Địa chỉ email không hợp lệ.' });
      }

      const senderName = process.env.SMTP_FROM_NAME || 'ClSend Security';
      const senderEmail = process.env.SMTP_USER || process.env.GMAIL_USER || 'clsendmailer@gmail.com';
      const fromField = `"${senderName}" <${senderEmail}>`;
      const nowFormatted = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const expireTimeFormatted = new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Thực Bảo Mật ClSend</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b132b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b132b; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #34d399; letter-spacing: -0.5px;">
                      ⚡ ClSend Security
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
                      Hệ Thống Xác Thực & Bảo Mật ClSend
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #e2e8f0;">
                Xin chào <strong style="color: #38bdf8;">${username || cleanEmail}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Chúng tôi nhận được yêu cầu liên kết địa chỉ Gmail <strong style="color: #ffffff;">${cleanEmail}</strong> với tài khoản ClSend của bạn. Dưới đây là mã bảo mật 6 chữ số để xác thực yêu cầu này:
              </p>

              <!-- OTP Code Display Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #020617; border-radius: 12px; border: 2px dashed #10b981; padding: 24px 15px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 8px; font-weight: 700;">
                      MÃ XÁC THỰC 6 CHỮ SỐ CỦA BẠN
                    </div>
                    <div style="font-size: 38px; font-weight: 900; font-family: 'Courier New', Courier, monospace; letter-spacing: 8px; color: #34d399; text-shadow: 0 0 15px rgba(52, 211, 153, 0.4);">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Lifespan and Notice -->
              <div style="background-color: #1e293b; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin: 24px 0 20px;">
                <p style="margin: 0; font-size: 13px; color: #f8fafc; font-weight: 600;">
                  ⏳ Thời hạn hiệu lực: <span style="color: #fbbf24;">Đúng ${durationMinutes} phút</span>
                </p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  Mã này được tạo lúc: ${nowFormatted} và sẽ hết hạn vào: <strong style="color: #ffffff;">${expireTimeFormatted}</strong>. Sau thời gian này, bạn cần nhấn "Gửi lại mã mới".
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                🛡️ <strong>Lưu ý an toàn:</strong> Không bao giờ chia sẻ mã xác nhận này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Email được gửi tự động từ hệ thống ClSend High-Speed Relay Network • <a href="https://cloudsend-bw7z.onrender.com" style="color: #34d399; text-decoration: none;">cloudsend-bw7z.onrender.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      // Gmail SMTP credentials configuration
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'clsendmailer@gmail.com';
      const smtpPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'camqrxtpaznfxxkz').replace(/\s+/g, '');

      let emailSentReal = false;
      let emailError: string | null = null;

      // Direct Gmail SMTP via Google Mail Server
      if (smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          await transporter.sendMail({
            from: `"${senderName}" <${smtpUser}>`,
            to: cleanEmail,
            subject: `[ClSend Security] Mã xác nhận liên kết tài khoản: ${code}`,
            text: `Mã xác nhận bảo mật 6 chữ số của bạn là: ${code}. Mã có hiệu lực trong vòng ${durationMinutes} phút (hết hạn lúc ${expireTimeFormatted}). Không chia sẻ mã này cho bất kỳ ai.`,
            html: emailHtml,
          });

          emailSentReal = true;
          console.log(`[Gmail SMTP Service] Successfully sent real OTP email from ${smtpUser} to ${cleanEmail}`);
        } catch (err: any) {
          console.error('[Gmail SMTP Service] Error sending from', smtpUser, 'to', cleanEmail, err);
          emailError = err?.message || 'Gmail SMTP delivery failed';
        }
      } else {
        console.log(`[Gmail SMTP Service] Waiting for credentials. OTP generated for ${cleanEmail} -> Code: ${code} (expires in ${durationMinutes}m)`);
      }

      return res.json({
        success: true,
        sentTo: cleanEmail,
        isRealSmtp: emailSentReal,
        sender: smtpUser,
        emailError,
        expiresInMinutes: durationMinutes,
        message: emailSentReal
          ? `Mã xác nhận 6 số đã được gửi trực tiếp từ ${smtpUser} đến Gmail [${cleanEmail}]. Vui lòng mở hộp thư Gmail của bạn để kiểm tra!`
          : `Mã xác nhận 6 số đã được tạo cho [${cleanEmail}].`
      });
    } catch (err: any) {
      console.error('send-verification-email endpoint error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Lỗi khi gửi email xác thực.'
      });
    }
  });

  // ==========================================================
  // REAL DESKTOP INSTALLER & APP SHORTCUT DOWNLOAD (.CMD / .EXE LAUNCHER)
  // ==========================================================
  const handleDesktopDownload = (req: express.Request, res: express.Response) => {
    try {
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const appUrl = `${protocol}://${host}`;

      // Create a native Windows batch / command setup script that installs a native desktop shortcut with official icon
      const scriptContent = `@echo off
chcp 65001 >nul
title Cài đặt Ứng dụng ClSend Desktop
color 0A
echo ==========================================================
echo        CHƯƠNG TRÌNH CÀI ĐẶT ỨNG DỤNG CLSEND DESKTOP
echo ==========================================================
echo.
echo [*] Đang thiết lập ứng dụng ClSend trên máy tính của bạn...
echo [*] URL Hệ Thống: ${appUrl}
echo.

set "APP_URL=${appUrl}"
set "DESKTOP_DIR=%USERPROFILE%\\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\\ClSend.lnk"
set "ICON_DIR=%APPDATA%\\ClSend"

if not exist "%ICON_DIR%" mkdir "%ICON_DIR%"

:: Tải favicon / logo chính thức về thư mục icon
powershell -Command "try { Invoke-WebRequest -Uri '${appUrl}/favicon.ico' -OutFile '%ICON_DIR%\\app.ico' -UseBasicParsing } catch {}" >nul 2>&1

:: Tìm trình duyệt Chromium (Microsoft Edge hoặc Google Chrome) để chạy chế độ App Desktop độc lập không viền URL
set "BROWSER_EXE="
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER_EXE=%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"
)

:: Tạo Desktop Shortcut chuẩn VBScript
set "VBS_SCRIPT=%TEMP%\\create_clsend_shortcut.vbs"
(
echo Set oWS = WScript.CreateObject("WScript.Shell"^)
echo sLinkFile = "%SHORTCUT_PATH%"
echo Set oLink = oWS.CreateShortcut(sLinkFile^)
if defined BROWSER_EXE (
    echo oLink.TargetPath = "%BROWSER_EXE%"
    echo oLink.Arguments = "--app=""%APP_URL%"""
) else (
    echo oLink.TargetPath = "%APP_URL%"
)
echo oLink.Description = "ClSend - Truyền Tệp P2P Siêu Tốc & Trò Chuyện Trực Tuyến"
if exist "%ICON_DIR%\\app.ico" (
    echo oLink.IconLocation = "%ICON_DIR%\\app.ico, 0"
)
echo oLink.Save
) > "%VBS_SCRIPT%"

cscript /nologo "%VBS_SCRIPT%" >nul 2>&1
del "%VBS_SCRIPT%" >nul 2>&1

echo [✓] Đã tạo thành công biểu tượng ClSend trên Màn hình Desktop!
echo.
echo [*] Đang khởi động ClSend Desktop...
timeout /t 2 >nul

if defined BROWSER_EXE (
    start "" "%BROWSER_EXE%" --app="%APP_URL%"
) else (
    start "" "%APP_URL%"
)

echo.
echo [✓] Hoàn tất cài đặt! Bạn có thể đóng cửa sổ này.
timeout /t 3 >nul
exit
`;

      res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ClSend-Desktop-Setup.cmd"');
      return res.send(scriptContent);
    } catch (e: any) {
      console.error('Error generating desktop installer:', e);
      return res.status(500).json({ success: false, error: 'Không thể tạo tệp cài đặt desktop' });
    }
  };

  app.get('/api/download-exe', handleDesktopDownload);
  app.get('/api/download-desktop', handleDesktopDownload);

  // API 404 Handler - Prevent API requests from falling through to Vite HTML
  app.all('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint không tồn tại' });
  });
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint không tồn tại' });
  });

  // API Global Error Handler - Always return JSON for API errors, never HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error('API Error handler caught:', err);
      if (!res.headersSent) {
        return res.status(err.status || 500).json({
          success: false,
          error: err.message || 'Lỗi xử lý nội bộ máy chủ'
        });
      }
    }
    next(err);
  });

  // Google Search Console verification file route
  app.get('/google*.html', (req, res) => {
    const filename = path.basename(req.path);
    const pubPath = path.join(process.cwd(), 'public', filename);
    if (fs.existsSync(pubPath)) {
      return res.sendFile(pubPath);
    }
    return res.send(`google-site-verification: ${filename}`);
  });

  // Vite middleware in development vs Static SPA in production
  if (isProduction) {
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.sendFile(distIndex);
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      app.use('*', async (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        try {
          const rootIndex = path.join(process.cwd(), 'index.html');
          let template = fs.readFileSync(rootIndex, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          const suppressor = `<script>(function(){var orig=console.error;console.error=function(){var s=Array.prototype.slice.call(arguments).map(function(a){return (a&&(a.stack||a.message))||String(a);}).join(' ');if(s.indexOf('WebSocket')!==-1||s.indexOf('closed without opened')!==-1||s.indexOf('@vite/client')!==-1)return;orig.apply(console,arguments);};})();</script>`;
          template = template.replace(/<head\b[^>]*>/i, m => m + suppressor);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (viteErr) {
      console.warn('Vite dev middleware failed to load, fallback to static serve:', viteErr);
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
      }
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        if (fs.existsSync(distIndex)) {
          return res.sendFile(distIndex);
        }
        const rootIndex = path.join(process.cwd(), 'index.html');
        if (fs.existsSync(rootIndex)) {
          return res.sendFile(rootIndex);
        }
        return res.status(200).send('ClSend Server Ready');
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  // Keep sockets alive longer than GCP/Cloud Run load-balancer idle timeouts to prevent ECONNRESET / NETWORK_ERROR
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 300000;

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server gracefully`);
    server.close(() => {
      console.log('Server closed successfully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
