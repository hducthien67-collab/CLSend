/**
 * ClSend Desktop Notification Utility
 * 
 * Supports both:
 * 1. Native Electron IPC notifications (when running inside Electron .exe)
 * 2. Web / PWA Desktop OS notifications (using browser Notification API)
 */

import { pickActiveLang } from '../context/LanguageContext';

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      sendNotification?: (title: string, body: string) => void;
      focusWindow?: () => void;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
    };
  }
}

/**
 * Checks if running inside native Electron desktop app wrapper
 */
export function isElectronApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
}

/**
 * Checks if running in standalone PWA mode on desktop
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Requests desktop notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';

  // If in Electron, permission is always granted natively
  if (isElectronApp()) {
    return 'granted';
  }

  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  return Notification.permission;
}

/**
 * Dispatches a native desktop notification for incoming chat messages
 */
export function sendDesktopMessageNotification({
  senderName,
  text,
  onClick,
}: {
  senderName: string;
  text: string;
  onClick?: () => void;
}) {
  if (typeof window === 'undefined') return;

  const title = pickActiveLang(
    'Tin nhắn mới từ {sender}',
    'New message from {sender}',
    '来自 {sender} 的新消息'
  ).replace('{sender}', senderName);
  const body = text || pickActiveLang('Đã gửi một tin nhắn mới cho bạn', 'Sent you a new message', '给你发送了一条新消息');
  const icon = '/pwa-192x192.png';

  // 1. Electron Native Notification
  if (isElectronApp() && window.electronAPI?.sendNotification) {
    try {
      window.electronAPI.sendNotification(title, body);
    } catch (err) {
      console.warn('Electron notification error:', err);
    }
    return;
  }

  // 2. Browser / PWA OS Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon,
        badge: '/pwa-192x192.png',
        tag: 'clsend-chat-message',
      });

      notification.onclick = () => {
        window.focus();
        if (onClick) {
          onClick();
        }
        notification.close();
      };
    } catch (err) {
      console.warn('Web notification error:', err);
    }
  }
}

/**
 * Dispatches a native desktop notification for incoming file transfers
 */
export function sendDesktopFileNotification({
  fileName,
  fileSize,
  senderName,
  onClick,
}: {
  fileName: string;
  fileSize?: string;
  senderName?: string;
  onClick?: () => void;
}) {
  if (typeof window === 'undefined') return;

  const sender = senderName
    ? pickActiveLang('từ {sender}', 'from {sender}', '来自 {sender}').replace('{sender}', senderName)
    : '';
  const size = fileSize ? ` (${fileSize})` : '';
  const title = pickActiveLang('ClSend - Nhận tệp mới', 'ClSend - New File Received', 'ClSend - 收到新文件');
  const body = (sender
    ? pickActiveLang(
        'Tệp "{name}"{size} sẵn sàng tải về {sender}',
        'File "{name}"{size} is ready to download {sender}',
        '文件 "{name}"{size} 已可下载 ({sender})'
      )
        .replace('{name}', fileName)
        .replace('{size}', size)
        .replace('{sender}', sender)
    : pickActiveLang(
        'Tệp "{name}"{size} sẵn sàng tải về',
        'File "{name}"{size} is ready to download',
        '文件 "{name}"{size} 已可下载'
      )
        .replace('{name}', fileName)
        .replace('{size}', size)
  ).trim();
  const icon = '/pwa-192x192.png';

  if (isElectronApp() && window.electronAPI?.sendNotification) {
    try {
      window.electronAPI.sendNotification(title, body);
    } catch (err) {
      console.warn('Electron notification error:', err);
    }
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon,
        badge: '/pwa-192x192.png',
        tag: 'clsend-file-transfer',
      });

      notification.onclick = () => {
        window.focus();
        if (onClick) {
          onClick();
        }
        notification.close();
      };
    } catch (err) {
      console.warn('Web notification error:', err);
    }
  }
}
