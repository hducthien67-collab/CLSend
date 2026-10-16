/**
 * Telegram Cloud Storage Utility
 * Master Storage Engine for CloudSend Web App
 * Powered by @clsend_storage_bot & Channel @ClsendStorage
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

export interface DocumentBotInfo {
  id: string;
  name: string;
  username?: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
  facility: 'main' | 'sub'; // 'main': Cơ sở chính, 'sub': Cơ sở phụ
}

export const MASTER_DOCUMENT_BOTS: DocumentBotInfo[] = [
  {
    id: 'doc-bot-02',
    name: 'Cơ Sở Phụ - Bot 02',
    username: 'CLsendStorage02Bot',
    botToken: '8865945373:AAFJ-kh5_uFIQ7PPA-2AJ5E39kJvuxorGKI',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub'
  },
  {
    id: 'doc-bot-03',
    name: 'Cơ Sở Phụ - Bot 03',
    username: 'CLsendStorage03Bot',
    botToken: '8916004893:AAHcdnUb-uMo8j8wf-6vWbghn_ONR5P9i6I',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub'
  },
  {
    id: 'doc-bot-04',
    name: 'Cơ Sở Phụ - Bot 04',
    username: 'CLsendStorage04Bot',
    botToken: '8861167534:AAFv_l1hBtex4YhZlo6_ZqvMOM6VKKpo-cg',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub'
  },
  {
    id: 'doc-bot-05',
    name: 'Cơ Sở Phụ - Bot 05',
    username: 'CLsendStorage05Bot',
    botToken: '8979371401:AAGtMkSqJrUEcf1s7acpOS9TD2K5CSIqQyQ',
    chatId: '@ClsendStorage',
    enabled: true,
    facility: 'sub'
  }
];

const DOC_BOTS_KEY = 'cloudsend_document_bots';
let docBotRoundRobinIndex = 0;

export function getDocumentBotsConfig(): DocumentBotInfo[] {
  try {
    const raw = localStorage.getItem(DOC_BOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Hydrate or merge with MASTER_DOCUMENT_BOTS
        const merged: DocumentBotInfo[] = [...parsed];
        for (const master of MASTER_DOCUMENT_BOTS) {
          const idx = merged.findIndex(b => b.id === master.id || b.username === master.username);
          if (idx === -1) {
            merged.push(master);
          } else {
            // If token is missing in storage, hydrate with master
            if (!merged[idx].botToken || merged[idx].botToken.trim() === '') {
              merged[idx].botToken = master.botToken;
              merged[idx].chatId = merged[idx].chatId || master.chatId;
              merged[idx].username = master.username;
            }
          }
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('Failed to parse document bots config:', err);
  }
  return MASTER_DOCUMENT_BOTS;
}

export function saveDocumentBotsConfig(bots: DocumentBotInfo[]): void {
  try {
    localStorage.setItem(DOC_BOTS_KEY, JSON.stringify(bots));
  } catch (err) {
    console.warn('Failed to save document bots config:', err);
  }
}

/**
 * Checks if a file is a document based on extension or mime
 */
export function isDocumentFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'epub', 'md', 'json', 'xml'];
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
 * Selects the appropriate bot config based on file type:
 * - Documents: uses one of the 4 document bots from the sub-facility pool
 * - Other files: uses the primary general file bot from main facility
 */
export function getBotForFile(fileName: string, mimeType?: string): TelegramStorageConfig {
  const isDoc = isDocumentFile(fileName, mimeType);
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

export interface TelegramUploadResult {
  fileId: string;
  downloadUrl: string;
  fileSize: number;
  fileName: string;
}

/**
 * Uploads a file to Telegram and retrieves direct download URL.
 * Safely guards against Telegram Bot API's 20MB download limit.
 * Implements intelligent failover across sub-facility doc cluster and main facility bot.
 */
export async function uploadToTelegram(
  file: File, 
  customConfig?: TelegramStorageConfig
): Promise<TelegramUploadResult> {
  // Telegram Bot API getFile has a hard 20MB limit for download URLs
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Tệp vượt quá 20MB - Telegram Bot API không hỗ trợ cấp link tải tệp >20MB.');
  }

  // Determine list of candidate configs to attempt
  const candidateConfigs: TelegramStorageConfig[] = [];

  if (customConfig && customConfig.botToken) {
    candidateConfigs.push(customConfig);
  } else {
    const isDoc = isDocumentFile(file.name, file.type);
    const docBots = getDocumentBotsConfig().filter(b => b.enabled && b.botToken && b.chatId);
    
    if (isDoc && docBots.length > 0) {
      // Rotate starting index for round-robin
      const startIdx = docBotRoundRobinIndex % docBots.length;
      docBotRoundRobinIndex++;
      for (let i = 0; i < docBots.length; i++) {
        const b = docBots[(startIdx + i) % docBots.length];
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }
      // Also fallback to primary bot if all doc bots fail
      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId) {
        candidateConfigs.push(mainConfig);
      }
    } else {
      // General file: use main bot first
      const mainConfig = getTelegramConfig();
      if (mainConfig.botToken && mainConfig.chatId) {
        candidateConfigs.push(mainConfig);
      }
      // Fallback to any enabled doc bots
      for (const b of docBots) {
        candidateConfigs.push({ enabled: true, botToken: b.botToken, chatId: b.chatId });
      }
    }
  }

  if (candidateConfigs.length === 0) {
    throw new Error('Chưa cấu hình Telegram Bot Token hoặc Chat ID.');
  }

  let lastError: any = null;

  for (const config of candidateConfigs) {
    try {
      // 1. Send document to channel
      const formData = new FormData();
      formData.append('chat_id', config.chatId.trim());
      formData.append('document', file);
      formData.append('caption', `📁 CloudSend Storage: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

      const sendRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const sendData = await sendRes.json();
      if (!sendData.ok) {
        throw new Error(sendData.description || 'Lỗi khi gửi tệp lên máy chủ Telegram.');
      }

      const documentObj = sendData.result?.document || sendData.result?.photo?.[sendData.result.photo.length - 1];
      const fileId = documentObj?.file_id;
      if (!fileId) {
        throw new Error('Không nhận được file_id từ Telegram.');
      }

      // 2. Query file path to construct download URL
      const getFileRes = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/getFile?file_id=${fileId}`);
      const getFileData = await getFileRes.json();
      
      let downloadUrl = '';
      if (getFileData.ok && getFileData.result?.file_path) {
        downloadUrl = `https://api.telegram.org/file/bot${config.botToken.trim()}/${getFileData.result.file_path}`;
      }

      if (!downloadUrl) {
        throw new Error('Telegram Bot không thể tạo liên kết tải về cho tệp này.');
      }

      return {
        fileId,
        downloadUrl,
        fileSize: file.size,
        fileName: file.name
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`Thử bot (${config.botToken.slice(0, 8)}...) thất bại, đang thử tiếp:`, err?.message || err);
    }
  }

  throw lastError || new Error('Tất cả các Bot Telegram lưu trữ đều bận hoặc chưa được thêm vào kênh làm Quản trị viên.');
}
