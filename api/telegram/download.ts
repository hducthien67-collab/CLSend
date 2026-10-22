export default async function handler(req: any, res: any) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let fileUrl = (req.query.url as string) || '';
    const fileId = (req.query.fileId as string) || '';
    const botToken = (req.query.botToken as string) || '';
    const originalName = ((req.query.name as string) || 'telegram-file').replace(/[\\\/]/g, '').trim();
    const isInline = req.query.inline === 'true' || req.query.view === 'true';

    // Extract effective bot token: either from query param or from fileUrl
    let effectiveBotToken = (botToken || '').trim();
    if (!effectiveBotToken && fileUrl) {
      const tokenMatch = fileUrl.match(/\/file\/bot([^/]+)\//);
      if (tokenMatch && tokenMatch[1]) {
        effectiveBotToken = tokenMatch[1];
      }
    }

    // If fileId and effectiveBotToken are provided instead of full url, fetch file_path from Telegram
    if (!fileUrl && fileId && effectiveBotToken) {
      const getFileRes = await fetch(`https://api.telegram.org/bot${effectiveBotToken}/getFile?file_id=${fileId}`);
      const getFileData: any = await getFileRes.json();
      if (getFileData.ok && getFileData.result?.file_path) {
        fileUrl = `https://api.telegram.org/file/bot${effectiveBotToken}/${getFileData.result.file_path}`;
      }
    }

    if (!fileUrl || !fileUrl.startsWith('https://api.telegram.org/file/bot')) {
      return res.status(400).json({ success: false, error: 'URL Telegram không hợp lệ' });
    }

    // Forward range request if present
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers['range'] = req.headers.range;
    }

    let upstreamRes = await fetch(fileUrl, { headers });

    // If the URL returned 404 (Telegram expired link after 1 hour)
    // AND we have fileId + effectiveBotToken, refresh it automatically with the exact bot!
    if (!upstreamRes.ok && upstreamRes.status === 404 && fileId && effectiveBotToken) {
      try {
        const refreshRes = await fetch(`https://api.telegram.org/bot${effectiveBotToken}/getFile?file_id=${fileId}`);
        const refreshData: any = await refreshRes.json();
        if (refreshData.ok && refreshData.result?.file_path) {
          fileUrl = `https://api.telegram.org/file/bot${effectiveBotToken}/${refreshData.result.file_path}`;
          upstreamRes = await fetch(fileUrl, { headers });
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh expired Telegram link on Vercel:', refreshErr);
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: upstreamRes.status === 404 ? 'telegram_link_expired' : 'telegram_fetch_failed',
        message: upstreamRes.status === 404 
          ? 'Đường dẫn Telegram tạm thời đã hết hạn sau 60 phút.' 
          : 'Không thể lấy tệp từ máy chủ Telegram.'
      });
    }

    let mimeType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) {
      mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : `audio/${ext}`;
    } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
      mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : `video/${ext}`;
    } else if (ext === 'zip') {
      mimeType = 'application/zip';
    } else if (ext === 'pdf') {
      mimeType = 'application/pdf';
    }

    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const safeAscii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    const dispositionType = isInline ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${safeAscii || 'file'}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );

    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Vercel Telegram download proxy error:', err);
    return res.status(500).send('Lỗi khi tải tệp từ Telegram.');
  }
}
