const MAX_VERCEL_SLICE_BYTES = 2 * 1024 * 1024; // 2 MB per response stays safely under Vercel's 4.5 MB payload ceiling

interface CachedUrlEntry {
  url: string;
  fileSize?: number;
  expiresAt: number;
}

interface ShardEntry {
  index?: number;
  start: number;
  end: number;
  size: number;
  fileId: string;
  botToken: string;
}

interface ManifestData {
  schema?: string;
  name?: string;
  size: number;
  type?: string;
  chunkSize?: number;
  shards: ShardEntry[];
}

const fileUrlCache = new Map<string, CachedUrlEntry>();
const manifestCache = new Map<string, ManifestData>();

function resolveMimeType(fileName: string, fallback = 'application/octet-stream'): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'avi') return 'video/x-msvideo';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg' || ext === 'opus') return 'audio/ogg';
  if (ext === 'm4a' || ext === 'aac') return 'audio/aac';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'zip') return 'application/zip';
  if (ext === 'pdf') return 'application/pdf';
  return fallback;
}

async function resolveTelegramUrl(
  fileId: string,
  botToken: string,
  forceRefresh = false
): Promise<{ url: string; fileSize?: number } | null> {
  if (!fileId || !botToken) return null;
  const cacheKey = `${botToken}:${fileId}`;
  if (!forceRefresh) {
    const hit = fileUrlCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return { url: hit.url, fileSize: hit.fileSize };
    }
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const data: any = await res.json();
    if (data?.ok && data?.result?.file_path) {
      const url = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
      const fileSize = typeof data.result.file_size === 'number' ? data.result.file_size : undefined;
      if (fileUrlCache.size > 400) fileUrlCache.clear();
      fileUrlCache.set(cacheKey, {
        url,
        fileSize,
        expiresAt: Date.now() + 45 * 60 * 1000
      });
      return { url, fileSize };
    }
  } catch (err) {
    console.warn('Telegram getFile resolve error:', err);
  }
  return null;
}

function parseRangeHeader(
  rangeHeader: string | undefined,
  totalSize: number,
  maxWindow = MAX_VERCEL_SLICE_BYTES
): { valid: boolean; start: number; end: number; hadRange: boolean } {
  if (!rangeHeader) {
    const end = totalSize > 0 ? Math.min(totalSize - 1, maxWindow - 1) : 0;
    return { valid: true, start: 0, end, hadRange: false };
  }
  const m = rangeHeader.replace(/bytes=/i, '').trim().match(/^(\d*)-(\d*)$/);
  if (!m) return { valid: false, start: 0, end: 0, hadRange: true };

  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : totalSize - 1;

  if (!m[1] && m[2]) {
    const suffixLen = parseInt(m[2], 10);
    start = Math.max(0, totalSize - suffixLen);
    end = totalSize - 1;
  }

  if (isNaN(start) || start < 0 || start >= totalSize) {
    return { valid: false, start: 0, end: 0, hadRange: true };
  }
  if (isNaN(end) || end >= totalSize) {
    end = totalSize - 1;
  }
  if (end < start) {
    return { valid: false, start: 0, end: 0, hadRange: true };
  }

  if (end - start + 1 > maxWindow) {
    end = start + maxWindow - 1;
  }
  return { valid: true, start, end, hadRange: true };
}

async function fetchTelegramByteSlice(
  fileId: string,
  botToken: string,
  fallbackUrl: string,
  localStart: number,
  localEnd: number
): Promise<Buffer> {
  let targetUrl = fallbackUrl;
  if (!targetUrl && fileId && botToken) {
    const resolved = await resolveTelegramUrl(fileId, botToken, false);
    if (resolved?.url) targetUrl = resolved.url;
  }
  if (!targetUrl) {
    throw new Error('Could not resolve Telegram shard URL');
  }

  const headers: Record<string, string> = {
    Range: `bytes=${localStart}-${localEnd}`
  };
  let res = await fetch(targetUrl, { headers });
  if (!res.ok && res.status !== 206 && (res.status === 404 || res.status === 403 || res.status === 400) && fileId && botToken) {
    const refreshed = await resolveTelegramUrl(fileId, botToken, true);
    if (refreshed?.url) {
      targetUrl = refreshed.url;
      res = await fetch(targetUrl, { headers });
    }
  }
  if (!res.ok && res.status !== 206) {
    throw new Error(`Telegram shard fetch HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (res.status === 206) {
    return buf;
  }
  // If upstream returned full 200 instead of 206, slice exact requested bytes
  return buf.subarray(localStart, Math.min(buf.length, localEnd + 1));
}

async function tryLoadManifest(
  fileId: string,
  botToken: string,
  fileUrl: string,
  knownFileSize?: number
): Promise<ManifestData | null> {
  if (fileId && manifestCache.has(fileId)) {
    return manifestCache.get(fileId)!;
  }
  // Manifest JSON files are tiny (~1KB - 256KB). Avoid downloading large files when probing.
  if (knownFileSize !== undefined && knownFileSize > 512 * 1024) {
    return null;
  }
  try {
    const headBytes = await fetchTelegramByteSlice(fileId, botToken, fileUrl, 0, 262143);
    const trimmed = headBytes.toString('utf-8').trimStart();
    if (!trimmed.startsWith('{') || (!trimmed.includes('clsend_tg_manifest') && !trimmed.includes('"shards"') && !trimmed.includes('"parts"'))) {
      return null;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Manifest larger than 256KB — fetch full JSON once
      let fullUrl = fileUrl;
      if (!fullUrl && fileId && botToken) {
        fullUrl = (await resolveTelegramUrl(fileId, botToken, false))?.url || '';
      }
      if (!fullUrl) return null;
      const fullRes = await fetch(fullUrl);
      if (!fullRes.ok) return null;
      parsed = JSON.parse(await fullRes.text());
    }

    let normalizedShards: ShardEntry[] = [];
    if (parsed && Array.isArray(parsed.shards) && parsed.shards.length > 0) {
      normalizedShards = parsed.shards.map((s: any, idx: number) => ({
        index: typeof s.index === 'number' ? s.index : idx,
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        size: Number(s.size) || Math.max(0, (Number(s.end) || 0) - (Number(s.start) || 0)),
        fileId: String(s.fileId || ''),
        botToken: String(s.botToken || botToken)
      }));
    } else if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) {
      const totalSizeNum = Number(parsed.size) || 0;
      const estChunk = Number(parsed.chunkSize || Math.ceil(totalSizeNum / parsed.parts.length));
      let offset = 0;
      normalizedShards = parsed.parts.map((partId: string, idx: number) => {
        const isLast = idx === parsed.parts.length - 1;
        const sz = isLast && totalSizeNum > 0 ? Math.max(0, totalSizeNum - offset) : estChunk;
        const entry: ShardEntry = {
          index: idx,
          start: offset,
          end: offset + sz,
          size: sz,
          fileId: String(partId),
          botToken
        };
        offset += sz;
        return entry;
      });
    }

    if (normalizedShards.length > 0) {
      const normalized: ManifestData = {
        schema: parsed.schema || 'clsend_tg_manifest_v2',
        name: parsed.name,
        size: Number(parsed.size) || normalizedShards.reduce((acc, s) => acc + (Number(s.size) || 0), 0),
        type: parsed.type,
        chunkSize: Number(parsed.chunkSize) || 0,
        shards: normalizedShards
      };
      if (fileId) {
        if (manifestCache.size > 100) manifestCache.clear();
        manifestCache.set(fileId, normalized);
      }
      return normalized;
    }
  } catch {
    // Not a manifest JSON
  }
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, Content-Length, Content-Range, Accept-Ranges, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let fileUrl = (req.query.url as string) || '';
    const fileId = (req.query.fileId as string) || '';
    const botToken = (req.query.botToken as string) || '';
    const originalName = ((req.query.name as string) || 'telegram-file').replace(/[\\\/]/g, '').trim();
    const isInline = req.query.inline === 'true' || req.query.view === 'true';

    let effectiveBotToken = (botToken || '').trim();
    if (!effectiveBotToken && fileUrl) {
      const tokenMatch = fileUrl.match(/\/file\/bot([^/]+)\//);
      if (tokenMatch && tokenMatch[1]) {
        effectiveBotToken = tokenMatch[1];
      }
    }

    let knownFileSize: number | undefined;
    if (!fileUrl && fileId && effectiveBotToken) {
      const resolved = await resolveTelegramUrl(fileId, effectiveBotToken, false);
      if (resolved) {
        fileUrl = resolved.url;
        knownFileSize = resolved.fileSize;
      }
    }

    if (!fileUrl || !fileUrl.startsWith('https://api.telegram.org/file/bot')) {
      return res.status(400).json({ success: false, error: 'URL Telegram không hợp lệ' });
    }

    const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    const dispositionType = isInline ? 'inline' : 'attachment';

    // -------------------------------------------------------------------------
    // 1. Check if this fileId is a ClSend Multi-Shard Manifest (Video/GIF > 12MB)
    // -------------------------------------------------------------------------
    const manifest = await tryLoadManifest(fileId, effectiveBotToken, fileUrl, knownFileSize);
    if (manifest) {
      const totalSize = manifest.size;
      const mimeType = resolveMimeType(originalName || manifest.name || '', manifest.type || 'video/mp4');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
      );

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', totalSize);
        return res.status(200).end();
      }

      const rangeInfo = parseRangeHeader(req.headers.range, totalSize, MAX_VERCEL_SLICE_BYTES);
      if (!rangeInfo.valid) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
        return res.end();
      }

      const { start: reqStart, end: rawReqEnd } = rangeInfo;
      const firstShard = manifest.shards.find((s) => s.end > reqStart && s.start <= rawReqEnd);
      if (!firstShard) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
        return res.end();
      }

      // Strictly touch ONLY 1 shard per Vercel serverless invocation to stay safely under memory/10s timeout caps
      const clampedEnd = Math.min(rawReqEnd, firstShard.end - 1);
      const localStart = Math.max(0, reqStart - firstShard.start);
      const localEnd = Math.min(firstShard.size - 1, clampedEnd - firstShard.start);
      const sliceBuf = await fetchTelegramByteSlice(firstShard.fileId, firstShard.botToken, '', localStart, localEnd);

      const actualEnd = reqStart + sliceBuf.length - 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${reqStart}-${actualEnd}/${totalSize}`);
      res.setHeader('Content-Length', sliceBuf.length);
      return res.send(sliceBuf);
    }

    // -------------------------------------------------------------------------
    // 2. Single Telegram File (<= 20MB): Stream via 2.5MB Range slices on Vercel
    // -------------------------------------------------------------------------
    if (req.method === 'HEAD') {
      let headRes = await fetch(fileUrl, { method: 'HEAD' });
      if (!headRes.ok && fileId && effectiveBotToken) {
        const refreshed = await resolveTelegramUrl(fileId, effectiveBotToken, true);
        if (refreshed?.url) {
          fileUrl = refreshed.url;
          headRes = await fetch(fileUrl, { method: 'HEAD' });
        }
      }
      const len = headRes.headers.get('content-length') || (knownFileSize ? String(knownFileSize) : '');
      const mime = resolveMimeType(originalName, headRes.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Content-Type', mime);
      res.setHeader('Accept-Ranges', 'bytes');
      if (len) res.setHeader('Content-Length', len);
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
      );
      return res.status(200).end();
    }

    const totalKnown = knownFileSize || 0;
    const shouldSliceForVercel =
      Boolean(req.headers.range) ||
      totalKnown === 0 ||
      totalKnown > MAX_VERCEL_SLICE_BYTES;

    let requestedStart = 0;
    let requestedEnd = MAX_VERCEL_SLICE_BYTES - 1;

    const upstreamHeaders: Record<string, string> = {};
    if (req.headers.range && totalKnown > 0) {
      const r = parseRangeHeader(req.headers.range, totalKnown, MAX_VERCEL_SLICE_BYTES);
      if (!r.valid) {
        res.status(416).setHeader('Content-Range', `bytes */${totalKnown}`);
        return res.end();
      }
      requestedStart = r.start;
      requestedEnd = r.end;
      upstreamHeaders['range'] = `bytes=${r.start}-${r.end}`;
    } else if (req.headers.range) {
      // Rewrite open-ended "bytes=0-" to bounded slice so Vercel never exceeds 4.5MB limit
      const m = String(req.headers.range).replace(/bytes=/i, '').trim().match(/^(\d+)-(\d*)$/);
      if (m) {
        const s = parseInt(m[1], 10);
        const rawEnd = m[2] ? parseInt(m[2], 10) : s + MAX_VERCEL_SLICE_BYTES - 1;
        const boundedEnd = Math.min(rawEnd, s + MAX_VERCEL_SLICE_BYTES - 1);
        requestedStart = s;
        requestedEnd = boundedEnd;
        upstreamHeaders['range'] = `bytes=${s}-${boundedEnd}`;
      } else {
        upstreamHeaders['range'] = String(req.headers.range);
      }
    } else if (shouldSliceForVercel) {
      upstreamHeaders['range'] = `bytes=0-${MAX_VERCEL_SLICE_BYTES - 1}`;
    }

    let upstreamRes = await fetch(fileUrl, { headers: upstreamHeaders });
    if (!upstreamRes.ok && upstreamRes.status === 404 && fileId && effectiveBotToken) {
      const refreshed = await resolveTelegramUrl(fileId, effectiveBotToken, true);
      if (refreshed?.url) {
        fileUrl = refreshed.url;
        upstreamRes = await fetch(fileUrl, { headers: upstreamHeaders });
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: upstreamRes.status === 404 ? 'telegram_link_expired' : 'telegram_fetch_failed',
        message:
          upstreamRes.status === 404
            ? 'Đường dẫn Telegram tạm thời đã hết hạn sau 60 phút.'
            : 'Không thể lấy tệp từ máy chủ Telegram.'
      });
    }

    const mimeType = resolveMimeType(
      originalName,
      upstreamRes.headers.get('content-type') || 'application/octet-stream'
    );
    const fullBuf = Buffer.from(await upstreamRes.arrayBuffer());

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );

    if (upstreamRes.status === 206 && fullBuf.length <= MAX_VERCEL_SLICE_BYTES + 4096) {
      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Content-Length', fullBuf.length);
      return res.status(206).send(fullBuf);
    }

    const totalLen = fullBuf.length;
    if (totalLen > MAX_VERCEL_SLICE_BYTES || Boolean(req.headers.range)) {
      const sliceStart = Math.min(requestedStart, Math.max(0, totalLen - 1));
      const sliceEnd = Math.min(totalLen - 1, requestedEnd, sliceStart + MAX_VERCEL_SLICE_BYTES - 1);
      const outSlice = fullBuf.subarray(sliceStart, sliceEnd + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${sliceStart}-${sliceEnd}/${totalLen}`);
      res.setHeader('Content-Length', outSlice.length);
      return res.send(outSlice);
    }

    res.setHeader('Content-Length', totalLen);
    return res.status(200).send(fullBuf);
  } catch (err: any) {
    console.error('Vercel Telegram download proxy error:', err);
    return res.status(500).send('Lỗi khi tải tệp từ Telegram.');
  }
}
