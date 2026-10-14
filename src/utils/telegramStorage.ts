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

export interface TelegramUploadResult {
  fileId: string;
  downloadUrl: string;
  fileSize: number;
  fileName: string;
}

/**
 * Uploads a file to Telegram Private Channel and retrieves direct download URL
 */
export async function uploadToTelegram(
  file: File, 
  customConfig?: TelegramStorageConfig
): Promise<TelegramUploadResult> {
  const config = customConfig || getTelegramConfig();
  if (!config.botToken || !config.chatId) {
    throw new Error('Chưa cấu hình Telegram Bot Token hoặc Chat ID.');
  }

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

  return {
    fileId,
    downloadUrl,
    fileSize: file.size,
    fileName: file.name
  };
}
