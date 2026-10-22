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

/**
 * CẤU HÌNH 4 CƠ SỞ DỮ LIỆU TỆP RIÊNG BIỆT (CHANNELS)
 * Phân chia luồng lưu trữ theo từng loại tệp: Âm Thanh, Video, Hình Ảnh, Tài Liệu
 */
export interface FacilityChannelsConfig {
  audio: string;    // Cơ Sở 1: Âm Thanh
  video: string;    // Cơ Sở 2: Video & Phim Ảnh
  image: string;    // Cơ Sở 3: Hình Ảnh
  document: string; // Cơ Sở 4: Tài Liệu & Nén
  default: string;  // Kênh tổng dự phòng
}

export const DEFAULT_FACILITY_CHANNELS: FacilityChannelsConfig = {
  audio: '@CLSSSound',
  video: '@CLSSVideo',
  image: '@CLSSImages',
  document: '@ClsendStorage',
  default: '@ClsendStorage'
};

const FACILITY_CHANNELS_KEY = 'cloudsend_facility_channels';

export function getFacilityChannels(): FacilityChannelsConfig {
  try {
    const raw = localStorage.getItem(FACILITY_CHANNELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FACILITY_CHANNELS, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to parse facility channels:', err);
  }
  return DEFAULT_FACILITY_CHANNELS;
}

export function saveFacilityChannels(channels: Partial<FacilityChannelsConfig>): void {
  try {
    const current = getFacilityChannels();
    const updated = { ...current, ...channels };
    localStorage.setItem(FACILITY_CHANNELS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save facility channels:', err);
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
  facility: 'main' | 'sub';
  supportedTypes?: BotSupportedTypes;
  description?: string;
}

// Backward-compatible type aliases
export type DocumentBotInfo = StorageBotInfo;
export type VideoBotInfo = StorageBotInfo;
export type AudioBotInfo = StorageBotInfo;

/**
 * MASTER BOTS CLUSTER (20 Bot cho 4 Cơ Sở Dữ Liệu Tệp)
 * - Tương ứng với 4 kênh: @ClsendStorage, @CLSSImages, @CLSSVideo, @CLSSSound
 */
export const MASTER_BOTS_CLUSTER: StorageBotInfo[] = [
  // --- 1. CƠ SỞ TỆP & TÀI LIỆU (@ClsendStorage) ---
  {
    id: 'master-bot-01',
    name: 'Cơ Sở Tệp - Bot 01',
    username: 'clsend_storage_bot',
    botToken: '8981117370:AAFyTRr8_7TJXRmwpvvzXvWLiOVFWQst9A0',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'main',
    supportedTypes: 'document',
    description: 'Cơ Sở Tệp & Tài Liệu - Bot chính'
  },
  {
    id: 'bot-02',
    name: 'Cơ Sở Tệp - Bot 02',
    username: 'CLsendStorage02Bot',
    botToken: '8865945373:AAFJ-kh5_uFlQ7PPA-2AJ5E39kJvuxorGKI',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'document',
    description: 'Cơ Sở Tệp & Tài Liệu - Bot 02'
  },
  {
    id: 'bot-03',
    name: 'Cơ Sở Tệp - Bot 03',
    username: 'CLsendStorage03Bot',
    botToken: '8916004893:AAHcdnUb-uMo8j8wf-6vWbghn_ONR5P9i6I',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'document',
    description: 'Cơ Sở Tệp & Tài Liệu - Bot 03'
  },
  {
    id: 'bot-04',
    name: 'Cơ Sở Tệp - Bot 04',
    username: 'CLsendStorage04Bot',
    botToken: '8861167534:AAFv_I1hBtex4YhZlo6_ZqvMOM6VKKpo-cg',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'document',
    description: 'Cơ Sở Tệp & Tài Liệu - Bot 04'
  },
  {
    id: 'bot-05',
    name: 'Cơ Sở Tệp - Bot 05',
    username: 'CLsendStorage05Bot',
    botToken: '8979371401:AAGtMkSqJrUEcf1s7acpOS9TD2K5CSIqQyQ',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'document',
    description: 'Cơ Sở Tệp & Tài Liệu - Bot 05'
  },

  // --- 2. CƠ SỞ HÌNH ẢNH (@CLSSImages) ---
  {
    id: 'bot-06',
    name: 'Cơ Sở Hình Ảnh - Bot 01',
    username: 'CLSendStorageImages01Bot',
    botToken: '8604013559:AAFFGF319kHmtDE-WHujtyYzA3O5O-y6npk',
    chatId: '@CLSSImages',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'image',
    description: 'Cơ Sở Hình Ảnh - Bot 01'
  },
  {
    id: 'bot-07',
    name: 'Cơ Sở Hình Ảnh - Bot 02',
    username: 'CLSendStorageImages02Bot',
    botToken: '8814406635:AAH-RLh5zysbOIS0eRxo0SwowODTpKrvJOo',
    chatId: '@CLSSImages',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'image',
    description: 'Cơ Sở Hình Ảnh - Bot 02'
  },
  {
    id: 'bot-08',
    name: 'Cơ Sở Hình Ảnh - Bot 03',
    username: 'CLSendStorageImages03Bot',
    botToken: '8325319018:AAEgCy6oQKCBObJ4K1psiX5oJjpI8L4gxK4',
    chatId: '@CLSSImages',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'image',
    description: 'Cơ Sở Hình Ảnh - Bot 03'
  },
  {
    id: 'bot-09',
    name: 'Cơ Sở Hình Ảnh - Bot 04',
    username: 'CLSendStorageImages04Bot',
    botToken: '8916441240:AAHK7okMFenaan5PuIpMQ9L0UoG75nECd5Y',
    chatId: '@CLSSImages',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'image',
    description: 'Cơ Sở Hình Ảnh - Bot 04'
  },
  {
    id: 'bot-10',
    name: 'Cơ Sở Hình Ảnh - Bot 05',
    username: 'CLSendStorageImages05Bot',
    botToken: '8960716268:AAHSr3vYPcUaWok_L69S4qNx3T7FPFXCUmg',
    chatId: '@CLSSImages',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'image',
    description: 'Cơ Sở Hình Ảnh - Bot 05'
  },

  // --- 3. CƠ SỞ VIDEO (@CLSSVideo) ---
  {
    id: 'bot-11',
    name: 'Cơ Sở Video - Bot 01',
    username: 'CLSendStorageVideo01Bot',
    botToken: '8723278230:AAFNgOwsETRD0V2AZWjOxB804qYnDgSTVCA',
    chatId: '@CLSSVideo',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'video',
    description: 'Cơ Sở Video - Bot 01'
  },
  {
    id: 'bot-12',
    name: 'Cơ Sở Video - Bot 02',
    username: 'CLSendStorageVideo02Bot',
    botToken: '8865581783:AAES5O8dQ0wnKG-24lUNzoSlo3M_MWh3anY',
    chatId: '@CLSSVideo',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'video',
    description: 'Cơ Sở Video - Bot 02'
  },
  {
    id: 'bot-13',
    name: 'Cơ Sở Video - Bot 03',
    username: 'CLSendStorageVideo03Bot',
    botToken: '8824325576:AAGev7fxc4hS6orcqbOw03naP-0Tmk7BBeo',
    chatId: '@CLSSVideo',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'video',
    description: 'Cơ Sở Video - Bot 03'
  },
  {
    id: 'bot-14',
    name: 'Cơ Sở Video - Bot 04',
    username: 'CLSendStorageVideo04Bot',
    botToken: '8965972564:AAHrxAgdKJdxupywAlI87zxvGqkuhb1BaVQ',
    chatId: '@CLSSVideo',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'video',
    description: 'Cơ Sở Video - Bot 04'
  },
  {
    id: 'bot-15',
    name: 'Cơ Sở Video - Bot 05',
    username: 'CLSendStorageVideo05Bot',
    botToken: '8775626995:AAGmiBqh7fsSeBhx3qyb3RA4U0sghXaKOfk',
    chatId: '@CLSSVideo',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'video',
    description: 'Cơ Sở Video - Bot 05'
  },

  // --- 4. CƠ SỞ ÂM THANH (@CLSSSound) ---
  {
    id: 'bot-16',
    name: 'Cơ Sở Âm Thanh - Bot 01',
    username: 'CLSendStorageSound01Bot',
    botToken: '8684241811:AAH2cautwZ4RUCjfev1n8HJXX_HJVy-MrBs',
    chatId: '@CLSSSound',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'audio',
    description: 'Cơ Sở Âm Thanh - Bot 01'
  },
  {
    id: 'bot-17',
    name: 'Cơ Sở Âm Thanh - Bot 02',
    username: 'CLSendStorageSound02Bot',
    botToken: '8860706681:AAGuyXe9wVdfdfRPW5QeU8CRUJWPX_WaM4Q',
    chatId: '@CLSSSound',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'audio',
    description: 'Cơ Sở Âm Thanh - Bot 02'
  },
  {
    id: 'bot-18',
    name: 'Cơ Sở Âm Thanh - Bot 03',
    username: 'CLSendStorageSound03Bot',
    botToken: '8783207618:AAGwR1MT3v2uadtwWrsU1JCk_6MgRAGH_A0',
    chatId: '@CLSSSound',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'audio',
    description: 'Cơ Sở Âm Thanh - Bot 03'
  },
  {
    id: 'bot-19',
    name: 'Cơ Sở Âm Thanh - Bot 04',
    username: 'CLSendStorageSound04Bot',
    botToken: '8603369577:AAHEXYTeTztwomVH91zRM0pyxCPQR1QidSQ',
    chatId: '@CLSSSound',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'audio',
    description: 'Cơ Sở Âm Thanh - Bot 04'
  },
  {
    id: 'bot-20',
    name: 'Cơ Sở Âm Thanh - Bot 05',
    username: 'CLSendStorageSound05Bot',
    botToken: '8993081888:AAEYHdNDFKEBeMDzAbm9NztKSi9BPBUcvVE',
    chatId: '@CLSSSound',
    enabled: true,
    facility: 'sub',
    supportedTypes: 'audio',
    description: 'Cơ Sở Âm Thanh - Bot 05'
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
let imageBotRoundRobinIndex = 0;
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
            // Keep master name updated to standardized 'Cơ Sở Dữ Liệu Tệp - Bot XX'
            if (master.name && !merged[idx].id.startsWith('custom-bot')) {
              merged[idx].name = master.name;
            }
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
 * Checks if a file is an image based on extension or mime
 */
export function isImageFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const imgExts = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif',
    'heic', 'heif', 'avif', 'psd', 'ai', 'raw', 'cr2', 'nef'
  ];
  if (imgExts.includes(ext)) return true;
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) return true;
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
  const isImg = isImageFile(fileName, mimeType);

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

  if (isImg) {
    const imgBots = getAllBotsConfig().filter(b => b.enabled && b.botToken && b.chatId && (b.supportedTypes === 'image' || b.supportedTypes === 'all'));
    if (imgBots.length > 0) {
      const bot = imgBots[imageBotRoundRobinIndex % imgBots.length];
      imageBotRoundRobinIndex++;
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
export function buildTelegramDownloadUrl(fileId: string, botToken: string, fileName: string, inline: boolean = true): string {
  if (!fileId || !botToken) return '';
  return `/api/telegram/download?fileId=${encodeURIComponent(fileId)}&botToken=${encodeURIComponent(botToken)}&name=${encodeURIComponent(fileName)}${inline ? '&inline=true' : ''}`;
}

export interface TelegramUploadResult {
  fileId: string;
  botToken?: string;
  downloadUrl: string;
  viewUrl: string;
  rawTelegramUrl: string;
  fileSize: number;
  fileName: string;
  isAudio?: boolean;
  isVideo?: boolean;
  isImage?: boolean;
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
  const isImg = isImageFile(file.name, file.type);

  // Determine list of candidate configs to attempt
  const candidateConfigs: TelegramStorageConfig[] = [];

  if (customConfig && customConfig.botToken) {
    candidateConfigs.push(customConfig);
  } else {
    const allBots = getAllBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);
    const facilityChannels = getFacilityChannels();

    // Determine target facility channel based on file category
    let targetFacilityChatId = facilityChannels.default || '@ClsendStorage';
    if (isAud) {
      targetFacilityChatId = facilityChannels.audio || targetFacilityChatId;
    } else if (isVid) {
      targetFacilityChatId = facilityChannels.video || targetFacilityChatId;
    } else if (isImg) {
      targetFacilityChatId = facilityChannels.image || targetFacilityChatId;
    } else if (isDoc) {
      targetFacilityChatId = facilityChannels.document || targetFacilityChatId;
    }

    if (isAud) {
      // Prioritize audio-capable bots in round-robin order
      const audioBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'audio');
      const startIdx = audioBotRoundRobinIndex % (audioBots.length || 1);
      audioBotRoundRobinIndex++;

      for (let i = 0; i < audioBots.length; i++) {
        const b = audioBots[(startIdx + i) % audioBots.length];
        const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
      }

      // Add other active bots as fallback
      for (const b of allBots) {
        if (!candidateConfigs.some(c => c.botToken === b.botToken)) {
          const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
          candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
        }
      }
    } else if (isVid) {
      // Prioritize video-capable bots in round-robin order
      const videoBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'video');
      const startIdx = videoBotRoundRobinIndex % (videoBots.length || 1);
      videoBotRoundRobinIndex++;

      for (let i = 0; i < videoBots.length; i++) {
        const b = videoBots[(startIdx + i) % videoBots.length];
        const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
      }

      // Add main config as fallback
      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push({ enabled: true, botToken: mainConfig.botToken, chatId: targetFacilityChatId });
      }
    } else if (isImg) {
      // Prioritize image-capable bots in round-robin order
      const imageBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'image');
      const startIdx = imageBotRoundRobinIndex % (imageBots.length || 1);
      imageBotRoundRobinIndex++;

      for (let i = 0; i < imageBots.length; i++) {
        const b = imageBots[(startIdx + i) % imageBots.length];
        const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
      }

      // Add other active bots as fallback
      for (const b of allBots) {
        if (!candidateConfigs.some(c => c.botToken === b.botToken)) {
          const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
          candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
        }
      }
    } else if (isDoc) {
      // Prioritize document bots
      const docBots = allBots.filter(b => !b.supportedTypes || b.supportedTypes === 'all' || b.supportedTypes === 'document');
      const startIdx = docBotRoundRobinIndex % (docBots.length || 1);
      docBotRoundRobinIndex++;

      for (let i = 0; i < docBots.length; i++) {
        const b = docBots[(startIdx + i) % docBots.length];
        const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
      }

      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push({ enabled: true, botToken: mainConfig.botToken, chatId: targetFacilityChatId });
      }
    } else {
      // General file: use round-robin across all active bots
      const startIdx = generalBotRoundRobinIndex % (allBots.length || 1);
      generalBotRoundRobinIndex++;

      for (let i = 0; i < allBots.length; i++) {
        const b = allBots[(startIdx + i) % allBots.length];
        const effectiveChat = (b.chatId && b.chatId !== '@ClsendStorage') ? b.chatId : targetFacilityChatId;
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: effectiveChat });
      }

      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId && !candidateConfigs.some(c => c.botToken === mainConfig.botToken)) {
        candidateConfigs.push({ enabled: true, botToken: mainConfig.botToken, chatId: targetFacilityChatId });
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
        const icon = isAud ? '🎵' : isVid ? '🎬' : isImg ? '🖼️' : isDoc ? '📄' : '📁';
        formData.append('caption', `${icon} CloudSend Storage: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

        let sendRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendDocument`, {
          method: 'POST',
          body: formData
        });

        let sendData = await sendRes.json();
        // Fallback: If sending to a specific facility channel failed (e.g., chat not found / bot not admin yet),
        // automatically fallback to master channel @ClsendStorage to ensure 100% upload success!
        if (!sendData.ok && config.chatId !== '@ClsendStorage') {
          console.warn(`Gửi vào kênh ${config.chatId} chưa thành công (${sendData.description}), đang lưu tạm vào kênh tổng @ClsendStorage...`);
          const fallbackForm = new FormData();
          fallbackForm.append('chat_id', '@ClsendStorage');
          fallbackForm.append('document', file);
          fallbackForm.append('caption', `${icon} CloudSend Storage: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
          const fallbackRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendDocument`, {
            method: 'POST',
            body: fallbackForm
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.ok) {
            sendData = fallbackData;
          }
        }

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

      // Create streaming proxy URL that binds the EXACT botToken and fileId to ensure:
      // 1. Correct bot gets the file (Lỗi 1 fixed)
      // 2. Link can be refreshed on-the-fly when expired after 1 hour (Lỗi 4 fixed)
      const downloadProxyUrl = `/api/telegram/download?fileId=${encodeURIComponent(fileId)}&botToken=${encodeURIComponent(config.botToken.trim())}&name=${encodeURIComponent(file.name)}&url=${encodeURIComponent(rawTelegramUrl)}`;
      const viewProxyUrl = `/api/telegram/download?fileId=${encodeURIComponent(fileId)}&botToken=${encodeURIComponent(config.botToken.trim())}&name=${encodeURIComponent(file.name)}&url=${encodeURIComponent(rawTelegramUrl)}&inline=true`;

      return {
        fileId,
        botToken: config.botToken.trim(),
        downloadUrl: downloadProxyUrl,
        viewUrl: viewProxyUrl,
        rawTelegramUrl,
        fileSize: file.size,
        fileName: file.name,
        isAudio: isAud,
        isVideo: isVid,
        isImage: isImg,
        mimeType: file.type
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`Thử bot (${config.botToken.slice(0, 8)}...) thất bại, đang chuyển tiếp bot khác:`, err?.message || err);
    }
  }

  throw lastError || new Error('Tất cả các Bot Telegram lưu trữ đều bận hoặc chưa được thêm vào kênh làm Quản trị viên.');
}

/**
 * Tiện ích cập nhật nhanh hàng loạt Token cho 20 Bot thuộc 4 Cơ Sở Dữ Liệu Tệp
 * Hỗ trợ truyền mảng token theo thứ tự hoặc đối tượng { 'bot-06': 'token...' }
 */
export function updateBotsTokens(tokens: { [idOrIndex: string]: string } | string[]): void {
  const all = getAllBotsConfig();
  if (Array.isArray(tokens)) {
    tokens.forEach((tok, index) => {
      if (all[index] && tok && tok.trim()) {
        all[index].botToken = tok.trim();
        all[index].enabled = true;
      }
    });
  } else {
    Object.entries(tokens).forEach(([key, tok]) => {
      if (!tok || !tok.trim()) return;
      const bot = all.find(b => b.id === key || b.name.toLowerCase().includes(key.toLowerCase()));
      if (bot) {
        bot.botToken = tok.trim();
        bot.enabled = true;
      }
    });
  }
  saveAllBotsConfig(all);
}
