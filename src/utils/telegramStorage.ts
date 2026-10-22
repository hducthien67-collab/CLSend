/**
 * Telegram Cloud Storage Utility
 * Master Storage Engine for CloudSend Web App
 * Powered by @clsend_storage_bot, Sub-facility Cluster (Bot 02-05) & Audio Bots Cluster & Channel @ClsendStorage
 * Full Support for Audio Streaming (sendAudio), Video Streaming (sendVideo), Documents (sendDocument), Photos, and General Files.
 */

export interface TelegramStorageConfig {
  enabled: boolean;
  botToken: string;
  chatId: string; // Private channel or group chat ID (e.g. -100xxxxxxxxxx or @channel_name)
}

/**
 * =========================================================================
 * MASTER TELEGRAM CONFIG (CẤU HÌNH TRỰC TIẾP TRONG CODE CHO TOÀN BỘ WEB)
 * =========================================================================
 */
export const MASTER_TELEGRAM_CONFIG: TelegramStorageConfig = {
  enabled: true,
  botToken: '8981117370:AAFyTRr8_7TJXRmwpvvzXvWLiOVFWQst9A0',
  chatId: '@ClsendStorage'
};

const STORAGE_KEY = 'cloudsend_telegram_config';

export function getTelegramConfig(): TelegramStorageConfig {
  // Always use Master Config if configured in code
  if (MASTER_TELEGRAM_CONFIG.botToken && MASTER_TELEGRAM_CONFIG.chatId) {
    return MASTER_TELEGRAM_CONFIG;
  }

  // Fallback to local storage if user customized in settings
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.botToken && parsed.chatId) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse telegram storage config:', err);
  }

  return MASTER_TELEGRAM_CONFIG;
}

export function saveTelegramConfig(config: TelegramStorageConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save telegram storage config:', err);
  }
}

export type BotSupportedTypes = 'all' | 'video' | 'audio' | 'document' | 'image';

export interface StorageBotInfo {
  id: string;
  name: string;
  username?: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
  facility: 'main' | 'sub'; // 'main': Cơ sở chính, 'sub': Cơ sở phụ
  supportedTypes?: BotSupportedTypes; // Loại tệp hỗ trợ: audio, video, document hoặc all
  description?: string;
}

// Backward-compatible type aliases
export type DocumentBotInfo = StorageBotInfo;
export type VideoBotInfo = StorageBotInfo;
export type AudioBotInfo = StorageBotInfo;

/**
 * MASTER BOTS CLUSTER (Tất cả bot đều trực tuyến & hỗ trợ tải tệp Âm thanh/Sound + Video + Tài liệu)
 */
export const MASTER_BOTS_CLUSTER: StorageBotInfo[] = [
  {
    id: 'master-bot-01',
    name: 'Cơ Sở Chính - Master Storage Bot',
    username: 'clsend_storage_bot',
    botToken: '8981117370:AAFyTRr8_7TJXRmwpvvzXvWLiOVFWQst9A0',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'main',
    supportedTypes: 'all',
    description: 'Điều phối viên máy chủ chính, hỗ trợ tất cả định dạng'
  },
  {
    id: 'bot-02',
    name: 'Cơ Sở Phụ - Bot 02 (Video & Doc)',
    username: 'CLsendStorage02Bot',
    botToken: '8865945373:AAFJ-kh5_uFIQ7PPA-2AJ5E39kJvuxorGKI',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'all',
    description: 'Chuyên trách tải video streaming và tài liệu'
  },
  {
    id: 'bot-03',
    name: 'Cơ Sở Phụ - Bot 03 (Video & Doc)',
    username: 'CLsendStorage03Bot',
    botToken: '8916004893:AAHcdnUb-uMo8j8wf-6vWbghn_ONR5P9i6I',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'all',
    description: 'Chuyên trách tải video streaming và tài liệu'
  },
  {
    id: 'bot-04',
    name: 'Cơ Sở Phụ - Bot 04 (Video & Doc)',
    username: 'CLsendStorage04Bot',
    botToken: '8861167534:AAFv_l1hBtex4YhZlo6_ZqvMOM6VKKpo-cg',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'all',
    description: 'Cân bằng tải cụm tài liệu & đa phương tiện'
  },
  {
    id: 'bot-05',
    name: 'Cơ Sở Phụ - Bot 05 (Video & Doc)',
    username: 'CLsendStorage05Bot',
    botToken: '8979371401:AAGtMkSqJrUEcf1s7acpOS9TD2K5CSIqQyQ',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'all',
    description: 'Cân bằng tải cụm tài liệu & đa phương tiện'
  }
];

export interface ModerationBotInfo {
  id: string;
  name: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
  moderationType: 'spam' | 'nsfw' | 'all';
  description?: string;
}

/**
 * MODERATION BOTS CLUSTER (Không có UI - Cấu hình trực tiếp trong code)
 */
export const MODERATION_BOTS_CLUSTER: ModerationBotInfo[] = [];

/**
 * Parses raw text or JSON file content to extract Telegram Bots and tokens
 */
export function parseBotsFromFileContent(rawText: string, defaultType: BotSupportedTypes = 'audio'): StorageBotInfo[] {
  const bots: StorageBotInfo[] = [];
  const trimmed = rawText.trim();
  if (!trimmed) return bots;

  // 1. Try parsing as JSON first
  try {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : parsed.bots || parsed.data;
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const token = (item.botToken || item.token || item.apiKey || '').trim();
        if (token) {
          bots.push({
            id: item.id || `bot-import-${Date.now()}-${i + 1}`,
            name: item.name || `Bot Âm Thanh ${(i + 1).toString().padStart(2, '0')}`,
            username: item.username || '',
            botToken: token,
            chatId: item.chatId || item.chat_id || '@ClsendStorage',
            enabled: item.enabled ?? true,
            facility: 'sub',
            supportedTypes: item.supportedTypes || defaultType,
            description: item.description || `Bot ${defaultType} nhập từ tệp cấu hình`
          });
        }
      }
      if (bots.length > 0) return bots;
    }
  } catch {
    // Not valid JSON, proceed to line-by-line and regex parsing
  }

  // 2. Regex matching standard Telegram Bot Tokens: (\d{8,11}:[a-zA-Z0-9_-]{35})
  const tokenRegex = /\b(\d{8,11}:[a-zA-Z0-9_-]{35})\b/g;
  const lines = trimmed.split('\n');
  let tokenCount = 1;

  for (const line of lines) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed) continue;

    const matches = lineTrimmed.match(tokenRegex);
    if (matches && matches.length > 0) {
      for (const token of matches) {
        let name = `Bot Âm Thanh ${tokenCount.toString().padStart(2, '0')}`;
        let chatId = '@ClsendStorage';

        // Check if line contains a custom name before separator
        if (lineTrimmed.includes('|') || lineTrimmed.includes(' - ') || lineTrimmed.includes('=')) {
          const parts = lineTrimmed.split(/[|\-=]/);
          const candidateName = parts[0]?.trim();
          if (candidateName && candidateName.length > 2 && !tokenRegex.test(candidateName)) {
            name = candidateName;
          }
        }

        // Check if line contains a chat id (@channel or -100xxx)
        const chatMatch = lineTrimmed.match(/(@[a-zA-Z0-9_]{4,}|-100\d{9,13})/);
        if (chatMatch) {
          chatId = chatMatch[1];
        }

        bots.push({
          id: `bot-import-${Date.now()}-${tokenCount}`,
          name,
          botToken: token.trim(),
          chatId,
          enabled: true,
          facility: 'sub',
          supportedTypes: defaultType,
          description: `Bot Âm Thanh trích xuất từ tệp`
        });
        tokenCount++;
      }
    }
  }

  return bots;
}

// Document bots alias for backward compatibility
export const MASTER_DOCUMENT_BOTS: DocumentBotInfo[] = MASTER_BOTS_CLUSTER.filter(b => b.facility === 'sub');

// Video bots cluster
export const MASTER_VIDEO_BOTS: VideoBotInfo[] = MASTER_BOTS_CLUSTER;

const ALL_BOTS_KEY = 'cloudsend_storage_bots_cluster';
const DOC_BOTS_KEY = 'cloudsend_document_bots';
const VIDEO_BOTS_KEY = 'cloudsend_video_bots';
const AUDIO_BOTS_KEY = 'cloudsend_audio_bots';

let videoBotRoundRobinIndex = 0;
let docBotRoundRobinIndex = 0;
let audioBotRoundRobinIndex = 0;
let generalBotRoundRobinIndex = 0;

/**
 * Retrieve all bots in the cluster, merging stored custom bots with code master bots
 */
export function getAllBotsConfig(): StorageBotInfo[] {
  try {
    const raw = localStorage.getItem(ALL_BOTS_KEY) || localStorage.getItem(DOC_BOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged: StorageBotInfo[] = [...parsed];
        for (const master of MASTER_BOTS_CLUSTER) {
          const idx = merged.findIndex(b => b.id === master.id || (b.username && b.username === master.username));
          if (idx === -1) {
            merged.push(master);
          } else {
            // Keep user updates if present, otherwise restore master defaults
            if (master.botToken && (!merged[idx].botToken || merged[idx].botToken.trim() === '')) {
              merged[idx].botToken = master.botToken;
            }
            if (!merged[idx].chatId) {
              merged[idx].chatId = master.chatId;
            }
            if (!merged[idx].supportedTypes) {
              merged[idx].supportedTypes = master.supportedTypes || 'all';
            }
            if (!merged[idx].description && master.description) {
              merged[idx].description = master.description;
            }
          }
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('Failed to parse all bots config:', err);
  }
  return MASTER_BOTS_CLUSTER;
}

export function saveAllBotsConfig(bots: StorageBotInfo[]): void {
  try {
    localStorage.setItem(ALL_BOTS_KEY, JSON.stringify(bots));
    localStorage.setItem(DOC_BOTS_KEY, JSON.stringify(bots));
    localStorage.setItem(VIDEO_BOTS_KEY, JSON.stringify(bots));
    localStorage.setItem(AUDIO_BOTS_KEY, JSON.stringify(bots));
  } catch (err) {
    console.warn('Failed to save bots cluster config:', err);
  }
}

export function getDocumentBotsConfig(): DocumentBotInfo[] {
  const all = getAllBotsConfig();
  return all.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'document');
}

export function saveDocumentBotsConfig(bots: DocumentBotInfo[]): void {
  saveAllBotsConfig(bots);
}

export function getVideoBotsConfig(): VideoBotInfo[] {
  const all = getAllBotsConfig();
  return all.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'video');
}

export function saveVideoBotsConfig(bots: VideoBotInfo[]): void {
  saveAllBotsConfig(bots);
}

export function getAudioBotsConfig(): AudioBotInfo[] {
  const all = getAllBotsConfig();
  return all.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'audio');
}

export function saveAudioBotsConfig(bots: AudioBotInfo[]): void {
  saveAllBotsConfig(bots);
}

/**
 * Checks if a file is an audio/sound file based on extension or mime
 */
export function isAudioFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const audioExts = [
    'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 
    'amr', 'm4r', 'aiff', 'alac', 'mid', 'midi', 'caf', 'ac3'
  ];
  if (audioExts.includes(ext)) return true;
  if (mimeType && (mimeType.toLowerCase().startsWith('audio/') || mimeType.includes('application/ogg'))) {
    return true;
  }
  return false;
}

/**
 * Checks if a file is a video based on extension or mime
 */
export function isVideoFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const videoExts = [
    'mp4', 'mov', 'webm', 'mkv', 'avi', 'flv', 'wmv', '3gp', 'm4v', 
    'ts', 'ogv', 'vob', 'mts', 'm2ts', 'f4v', 'asf', 'rm', 'rmvb'
  ];
  if (videoExts.includes(ext)) return true;
  if (mimeType && mimeType.toLowerCase().startsWith('video/')) return true;
  return false;
}

/**
 * Checks if a file is a document based on extension or mime
 */
export function isDocumentFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const docExts = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 
    'txt', 'rtf', 'odt', 'ods', 'odp', 'epub', 'md', 'json', 'xml'
  ];
  if (docExts.includes(ext)) return true;
  if (mimeType && (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('text/')
  )) return true;
  return false;
}

/**
 * Selects the optimal bot config based on file type:
 * - Audio: loads from audio-capable bots cluster via round-robin
 * - Videos: loads from video-capable bots cluster via round-robin
 * - Documents: loads from document bots cluster via round-robin
 * - Other files: uses general storage bot
 */
export function getBotForFile(fileName: string, mimeType?: string): TelegramStorageConfig {
  const isAud = isAudioFile(fileName, mimeType);
  const isVid = isVideoFile(fileName, mimeType);
  const isDoc = isDocumentFile(fileName, mimeType);

  if (isAud) {
    const audioBots = getAudioBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);
    if (audioBots.length > 0) {
      const bot = audioBots[audioBotRoundRobinIndex % audioBots.length];
      audioBotRoundRobinIndex++;
      return {
        enabled: true,
        botToken: bot.botToken,
        chatId: bot.chatId
      };
    }
  }

  if (isVid) {
    const videoBots = getVideoBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);
    if (videoBots.length > 0) {
      const bot = videoBots[videoBotRoundRobinIndex % videoBots.length];
      videoBotRoundRobinIndex++;
      return {
        enabled: true,
        botToken: bot.botToken,
        chatId: bot.chatId
      };
    }
  }

  if (isDoc) {
    const docBots = getDocumentBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);
    if (docBots.length > 0) {
      const bot = docBots[docBotRoundRobinIndex % docBots.length];
      docBotRoundRobinIndex++;
      return {
        enabled: true,
        botToken: bot.botToken,
        chatId: bot.chatId
      };
    }
  }

  return getTelegramConfig();
}

/**
 * Test connectivity with Telegram Bot API
 */
export async function testTelegramBot(botToken: string): Promise<{ ok: boolean; username?: string; name?: string; error?: string }> {
  try {
    if (!botToken || !botToken.trim()) {
      return { ok: false, error: 'Chưa nhập Token Bot' };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        ok: true,
        username: data.result.username,
        name: data.result.first_name
      };
    }
    return { ok: false, error: data.description || 'Token không hợp lệ' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Không thể kết nối đến máy chủ Telegram' };
  }
}

/**
 * Converts a direct Telegram CDN file URL into our secure, high-speed, CORS-free streaming proxy URL
 */
export function buildTelegramProxyUrl(rawUrl: string, fileName: string, inline: boolean = true): string {
  if (!rawUrl) return '';
  return `/api/telegram/download?url=${encodeURIComponent(rawUrl)}&name=${encodeURIComponent(fileName)}${inline ? '&inline=true' : ''}`;
}

export interface TelegramUploadResult {
  fileId: string;
  downloadUrl: string;
  viewUrl: string;
  rawTelegramUrl: string;
  fileSize: number;
  fileName: string;
  isAudio?: boolean;
  isVideo?: boolean;
  mimeType?: string;
}

/**
 * Uploads a file (Audio, Video, Document, Image, or General file) to Telegram and retrieves direct download URL.
 * Supports:
 * - Audio streaming & native player tags via /sendAudio API
 * - Video streaming via /sendVideo with supports_streaming=true
 * - Document upload via /sendDocument
 * - Multi-bot failover across Sub-facility cluster (Bot 02-05, Audio Bots) and Main Bot
 * - 20MB limit safeguard (Telegram Bot API download constraint)
 */
export async function uploadToTelegram(
  file: File, 
  customConfig?: TelegramStorageConfig
): Promise<TelegramUploadResult> {
  // Telegram Bot API supports up to 50MB per file upload. For larger files, use P2P WebRTC direct transfer (unlimited size).
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('Tệp vượt quá 50MB (giới hạn của Telegram Bot API). Vui lòng sử dụng truyền trực tiếp P2P / Local (không giới hạn dung lượng và tốc độ tối đa).');
  }

  const isAud = isAudioFile(file.name, file.type);
  const isVid = isVideoFile(file.name, file.type);
  const isDoc = isDocumentFile(file.name, file.type);

  // Determine list of candidate configs to attempt
  const candidateConfigs: TelegramStorageConfig[] = [];

  if (customConfig && customConfig.botToken) {
    candidateConfigs.push(customConfig);
  } else {
    const allBots = getAllBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);

    if (isAud) {
      // Prioritize audio-capable bots in round-robin order
      const audioBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'audio');
      const startIdx = audioBotRoundRobinIndex % (audioBots.length || 1);
      audioBotRoundRobinIndex++;

      for (let i = 0; i < audioBots.length; i++) {
        const b = audioBots[(startIdx + i) % audioBots.length];
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }

      // Add other active bots as fallback
      for (const b of allBots) {
        if (!candidateConfigs.some(c => c.botToken === b.botToken)) {
          candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
        }
      }
    } else if (isVid) {
      // Prioritize video-capable bots in round-robin order
      const videoBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'video');
      const startIdx = videoBotRoundRobinIndex % (videoBots.length || 1);
      videoBotRoundRobinIndex++;

      for (let i = 0; i < videoBots.length; i++) {
        const b = videoBots[(startIdx + i) % videoBots.length];
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }

      // Add main config as fallback
      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push(mainConfig);
      }
    } else if (isDoc) {
      // Prioritize document bots
      const docBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'document');
      const startIdx = docBotRoundRobinIndex % (docBots.length || 1);
      docBotRoundRobinIndex++;

      for (let i = 0; i < docBots.length; i++) {
        const b = docBots[(startIdx + i) % docBots.length];
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }

      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push(mainConfig);
      }
    } else {
      // General file: use round-robin across all active bots
      const startIdx = generalBotRoundRobinIndex % (allBots.length || 1);
      generalBotRoundRobinIndex++;

      for (let i = 0; i < allBots.length; i++) {
        const b = allBots[(startIdx + i) % allBots.length];
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }

      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push(mainConfig);
      }
    }
  }

  if (candidateConfigs.length === 0) {
    throw new Error('Chưa cấu hình Telegram Bot Token hoặc Chat ID.');
  }

  let lastError: any = null;

  for (const config of candidateConfigs) {
    try {
      let fileId = '';

      // 1. For Audio files, attempt Telegram's native sendAudio endpoint first (enables audio player tags)
      if (isAud) {
        try {
          const audioForm = new FormData();
          audioForm.append('chat_id', config.chatId.trim());
          audioForm.append('audio', file);
          audioForm.append('caption', `🎵 CloudSend Audio: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
          const songTitle = file.name.replace(/\.[^/.]+$/, '');
          audioForm.append('title', songTitle);

          const audioRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendAudio`, {
            method: 'POST',
            body: audioForm
          });

          const audioData = await audioRes.json();
          if (audioData.ok && audioData.result) {
            fileId = audioData.result?.audio?.file_id || 
                     audioData.result?.voice?.file_id || 
                     audioData.result?.document?.file_id;
          }
        } catch (audErr) {
          console.warn('sendAudio endpoint notice, attempting sendDocument fallback:', audErr);
        }
      }

      // 2. For Video files, attempt Telegram's native sendVideo endpoint (enables video streaming & poster)
      if (!fileId && isVid) {
        try {
          const videoForm = new FormData();
          videoForm.append('chat_id', config.chatId.trim());
          videoForm.append('video', file);
          videoForm.append('caption', `🎬 CloudSend Video: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
          videoForm.append('supports_streaming', 'true');

          const videoRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendVideo`, {
            method: 'POST',
            body: videoForm
          });

          const videoData = await videoRes.json();
          if (videoData.ok && videoData.result) {
            fileId = videoData.result?.video?.file_id || 
                     videoData.result?.document?.file_id || 
                     videoData.result?.animation?.file_id;
          }
        } catch (vidErr) {
          console.warn('sendVideo endpoint notice, attempting sendDocument fallback:', vidErr);
        }
      }

      // 3. If sendAudio/sendVideo was skipped or failed, use sendDocument (universal format)
      if (!fileId) {
        const formData = new FormData();
        formData.append('chat_id', config.chatId.trim());
        formData.append('document', file);
        const icon = isAud ? '🎵' : isVid ? '🎬' : isDoc ? '📄' : '📁';
        formData.append('caption', `${icon} CloudSend Storage: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

        const sendRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendDocument`, {
          method: 'POST',
          body: formData
        });

        const sendData = await sendRes.json();
        if (!sendData.ok) {
          throw new Error(sendData.description || 'Lỗi khi gửi tệp lên máy chủ Telegram.');
        }

        const documentObj = sendData.result?.document || 
                            sendData.result?.audio || 
                            sendData.result?.voice || 
                            sendData.result?.video || 
                            sendData.result?.animation || 
                            sendData.result?.photo?.[sendData.result.photo.length - 1];
        fileId = documentObj?.file_id;
      }

      if (!fileId) {
        throw new Error('Không nhận được file_id từ Telegram.');
      }

      // 4. Always fetch file path dynamically at the moment of download to ensure fresh URL
      const getFileRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/getFile?file_id=${fileId}`);
      const getFileData = await getFileRes.json();
      
      let rawTelegramUrl = '';
      if (getFileData.ok && getFileData.result?.file_path) {
        rawTelegramUrl = `https://api.telegram.org/file/bot${config.botToken.trim()}/${getFileData.result.file_path}`;
      }

      if (!rawTelegramUrl) {
        throw new Error('Telegram Bot không thể tạo liên kết tải về cho tệp này.');
      }

      // Create streaming proxy URL. 
      // We encode the rawTelegramUrl so the proxy can re-fetch it if needed.
      const downloadProxyUrl = `/api/telegram/download-dynamic?url=${encodeURIComponent(rawTelegramUrl)}&name=${encodeURIComponent(file.name)}`;
      const viewProxyUrl = `/api/telegram/download-dynamic?url=${encodeURIComponent(rawTelegramUrl)}&name=${encodeURIComponent(file.name)}&inline=true`;

      return {
        fileId,
        downloadUrl: downloadProxyUrl,
        viewUrl: viewProxyUrl,
        rawTelegramUrl,
        fileSize: file.size,
        fileName: file.name,
        isAudio: isAud,
        isVideo: isVid,
        mimeType: file.type
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`Thử bot (${config.botToken.slice(0, 8)}...) thất bại, đang chuyển tiếp bot khác:`, err?.message || err);
    }
  }

  throw lastError || new Error('Tất cả các Bot Telegram lưu trữ đều bận hoặc chưa được thêm vào kênh làm Quản trị viên.');
}
