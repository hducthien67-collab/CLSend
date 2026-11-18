import { useCallback, useEffect, useRef, useState } from 'react';
import { pickActiveLang } from '../context/LanguageContext';
import { showGlobalToast } from './toast';

const STORAGE_KEY_DEV_UNLOCKED = 'clsend_local_dev_mode_unlocked_v1';
const STORAGE_KEY_DEV_SETTINGS = 'clsend_local_dev_settings_v1';
const DEV_MODE_CHANGE_EVENT = 'clsend-local-dev-change';

export interface LocalDevSettings {
  /** Undefined until explicitly toggled by user/dev; defaults to true for DEV, false for unlocked non-DEV */
  debugLogEnabled?: boolean;
  verboseConsoleLogs: boolean;
  reduceMotion: boolean;
  layoutOutlines: boolean;
  showDiagnosticsBadge: boolean;
}

const DEFAULT_SETTINGS: LocalDevSettings = {
  debugLogEnabled: undefined,
  verboseConsoleLogs: false,
  reduceMotion: false,
  layoutOutlines: false,
  showDiagnosticsBadge: false,
};

export function isLocalDevModeUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_DEV_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function getLocalDevSettings(): LocalDevSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEV_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      debugLogEnabled:
        typeof parsed?.debugLogEnabled === 'boolean' ? parsed.debugLogEnabled : undefined,
      verboseConsoleLogs: Boolean(parsed?.verboseConsoleLogs),
      reduceMotion: Boolean(parsed?.reduceMotion),
      layoutOutlines: Boolean(parsed?.layoutOutlines),
      showDiagnosticsBadge: Boolean(parsed?.showDiagnosticsBadge),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function resolveDebugLogActive(
  isDevAccount: boolean,
  unlocked: boolean,
  settings: LocalDevSettings
): boolean {
  if (!isDevAccount && !unlocked) return false;
  if (typeof settings.debugLogEnabled === 'boolean') {
    return settings.debugLogEnabled;
  }
  return isDevAccount;
}

export function applyLocalDevDomEffects(
  isDevAccount: boolean,
  unlocked: boolean,
  settings: LocalDevSettings
): void {
  if (typeof document === 'undefined') return;
  const active = isDevAccount || unlocked;
  const root = document.documentElement;

  root.classList.toggle('clsend-reduce-motion', active && settings.reduceMotion);
  root.classList.toggle('clsend-debug-outlines', active && settings.layoutOutlines);

  if (typeof window !== 'undefined') {
    (window as any).__CLSEND_VERBOSE_LOG__ = active && settings.verboseConsoleLogs;
  }
}

function notifyDevModeChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEV_MODE_CHANGE_EVENT));
}

export function unlockLocalDevMode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_DEV_UNLOCKED, 'true');
  } catch {}
  notifyDevModeChanged();
}

export function lockLocalDevMode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_DEV_UNLOCKED);
    const current = getLocalDevSettings();
    localStorage.setItem(
      STORAGE_KEY_DEV_SETTINGS,
      JSON.stringify({
        ...current,
        debugLogEnabled: false,
        reduceMotion: false,
        layoutOutlines: false,
        verboseConsoleLogs: false,
        showDiagnosticsBadge: false,
      })
    );
  } catch {}
  applyLocalDevDomEffects(false, false, DEFAULT_SETTINGS);
  notifyDevModeChanged();
}

export function updateLocalDevSettings(patch: Partial<LocalDevSettings>): LocalDevSettings {
  const next: LocalDevSettings = {
    ...getLocalDevSettings(),
    ...patch,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_DEV_SETTINGS, JSON.stringify(next));
    } catch {}
    if (next.verboseConsoleLogs) {
      console.info('[ClSend DevMode] Local developer settings updated:', next);
    }
  }
  notifyDevModeChanged();
  return next;
}

export function clearLocalDevPerfLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('clsend_perf_debug_logs_v2');
  } catch {}
  notifyDevModeChanged();
}

export function devConsoleLog(tag: string, ...args: unknown[]): void {
  if (typeof window !== 'undefined' && (window as any).__CLSEND_VERBOSE_LOG__) {
    console.info(`[ClSend:${tag}]`, ...args);
  }
}

export function useLocalDevMode(isDevAccount: boolean) {
  const [unlocked, setUnlocked] = useState<boolean>(() => isLocalDevModeUnlocked());
  const [settings, setSettings] = useState<LocalDevSettings>(() => getLocalDevSettings());

  useEffect(() => {
    const sync = () => {
      const nextUnlocked = isLocalDevModeUnlocked();
      const nextSettings = getLocalDevSettings();
      setUnlocked(nextUnlocked);
      setSettings(nextSettings);
      applyLocalDevDomEffects(isDevAccount, nextUnlocked, nextSettings);
    };

    sync();

    window.addEventListener(DEV_MODE_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DEV_MODE_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [isDevAccount]);

  const canAccessDevTab = isDevAccount || unlocked;
  const isDebugLogActive = resolveDebugLogActive(isDevAccount, unlocked, settings);

  return {
    unlocked,
    canAccessDevTab,
    isDebugLogActive,
    settings,
    updateSettings: updateLocalDevSettings,
    unlock: unlockLocalDevMode,
    lock: lockLocalDevMode,
  };
}

const REQUIRED_TAPS = 7;
const TAP_RESET_MS = 2500;

export function useLogoDevUnlock(isDevAccount: boolean) {
  const tapCountRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);

  const handleLogoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current > TAP_RESET_MS) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;

    const alreadyUnlocked = isDevAccount || isLocalDevModeUnlocked();

    if (alreadyUnlocked) {
      if (tapCountRef.current >= REQUIRED_TAPS) {
        tapCountRef.current = 0;
        showGlobalToast(
          pickActiveLang(
            'Chế độ Nhà phát triển đã được kích hoạt trong Cài đặt!',
            'Developer Mode is already active in Settings!',
            '开发者模式已在设置中启用！'
          ),
          'info'
        );
      }
      return;
    }

    const remaining = REQUIRED_TAPS - tapCountRef.current;

    if (remaining <= 0) {
      tapCountRef.current = 0;
      unlockLocalDevMode();
      showGlobalToast(
        pickActiveLang(
          '🛠️ Đã bật Chế độ Nhà phát triển! Mở Cài đặt để xem tab ẩn.',
          '🛠️ Developer Mode unlocked! Open Settings to access the hidden tab.',
          '🛠️ 已开启开发者模式！打开设置即可查看隐藏标签页。'
        ),
        'success'
      );
      return;
    }

    // Subtle countdown only on taps 4, 5, 6 so regular single/double logo clicks stay silent
    if (tapCountRef.current >= 4) {
      showGlobalToast(
        pickActiveLang(
          'Nhấn thêm {n} lần nữa để bật Chế độ Nhà phát triển',
          '{n} more taps to enable Developer Mode',
          '再点击 {n} 次即可开启开发者模式'
        ).replace('{n}', String(remaining)),
        'info'
      );
    }
  }, [isDevAccount]);

  return handleLogoTap;
}
