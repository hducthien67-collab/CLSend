import React, { useEffect, useState } from 'react';
import {
  Activity,
  Code2,
  Cpu,
  EyeOff,
  Grid,
  Laptop,
  RefreshCw,
  Terminal,
  Trash2,
  Zap,
  Check,
} from 'lucide-react';
import { useLanguage, pickLang } from '../context/LanguageContext';
import {
  clearLocalDevPerfLogs,
  devConsoleLog,
  useLocalDevMode,
} from '../utils/localDevMode';
import { showGlobalToast } from '../utils/toast';

interface DeveloperModePanelProps {
  isDev: boolean;
  compact?: boolean;
  onAfterLock?: () => void;
}

interface LocalEnvMetrics {
  viewport: string;
  dpr: string;
  online: boolean;
  standalone: boolean;
  webrtc: boolean;
  storageKb: string;
  logCount: number;
}

function readLocalMetrics(): LocalEnvMetrics {
  if (typeof window === 'undefined') {
    return {
      viewport: '—',
      dpr: '1',
      online: true,
      standalone: false,
      webrtc: false,
      storageKb: '0 KB',
      logCount: 0,
    };
  }

  let totalBytes = 0;
  let logCount = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k) || '';
      totalBytes += (k.length + v.length) * 2;
    }
    const rawLogs = localStorage.getItem('clsend_perf_debug_logs_v2');
    if (rawLogs) {
      const parsed = JSON.parse(rawLogs);
      if (Array.isArray(parsed)) logCount = parsed.length;
    }
  } catch {}

  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    Boolean((window.navigator as any).standalone);

  return {
    viewport: `${window.innerWidth} × ${window.innerHeight} px`,
    dpr: `${(window.devicePixelRatio || 1).toFixed(2)}x`,
    online: navigator.onLine,
    standalone,
    webrtc: typeof RTCPeerConnection !== 'undefined',
    storageKb: `${(totalBytes / 1024).toFixed(1)} KB`,
    logCount,
  };
}

export const DeveloperModePanel: React.FC<DeveloperModePanelProps> = ({
  isDev,
  compact = false,
  onAfterLock,
}) => {
  const { currentLang } = useLanguage();
  const pick = (vi: string, en: string, zh: string) => pickLang(currentLang, vi, en, zh);
  const { unlocked, isDebugLogActive, settings, updateSettings, lock } = useLocalDevMode(isDev);
  const [metrics, setMetrics] = useState<LocalEnvMetrics>(() => readLocalMetrics());
  const [clearedLocal, setClearedLocal] = useState(false);

  const refreshMetrics = () => {
    setMetrics(readLocalMetrics());
  };

  useEffect(() => {
    refreshMetrics();
    const onResize = () => refreshMetrics();
    window.addEventListener('resize', onResize);
    window.addEventListener('online', onResize);
    window.addEventListener('offline', onResize);
    window.addEventListener('clsend-local-dev-change', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('online', onResize);
      window.removeEventListener('offline', onResize);
      window.removeEventListener('clsend-local-dev-change', onResize);
    };
  }, []);

  const handleToggleDebugLog = () => {
    const next = !isDebugLogActive;
    if (next) {
      try {
        localStorage.setItem('clsend_perf_debug_visible_v2', 'true');
      } catch {}
    }
    updateSettings({ debugLogEnabled: next });
    devConsoleLog('DebugLog', next ? 'Enabled locally' : 'Disabled locally');
    showGlobalToast(
      next
        ? pick('Đã bật Debug Log trên thiết bị này.', 'Debug Log enabled on this device.', '已在此设备上启用调试日志。')
        : pick('Đã tắt Debug Log.', 'Debug Log disabled.', '已关闭调试日志。'),
      'info'
    );
  };

  const handleClearLogs = () => {
    clearLocalDevPerfLogs();
    refreshMetrics();
    setClearedLocal(true);
    setTimeout(() => setClearedLocal(false), 1800);
    showGlobalToast(
      pick('Đã xóa toàn bộ lịch sử Debug Log cục bộ.', 'Cleared all local Debug Log history.', '已清空本地调试日志记录。'),
      'success'
    );
  };

  const handleShowDebugWidget = () => {
    try {
      localStorage.setItem('clsend_perf_debug_visible_v2', 'true');
      localStorage.setItem('clsend_perf_debug_expanded_v2', 'true');
    } catch {}
    updateSettings({ debugLogEnabled: true });
    showGlobalToast(
      pick('Đã hiển thị cửa sổ Debug Log ở góc dưới trái.', 'Debug Log panel is now visible at bottom-left.', '调试日志面板已显示在左下角。'),
      'info'
    );
  };

  const handleLockDevMode = () => {
    lock();
    showGlobalToast(
      pick('Đã tắt và ẩn tab Chế độ Nhà phát triển.', 'Developer Mode turned off and hidden.', '已关闭并隐藏开发者模式标签页。'),
      'info'
    );
    onAfterLock?.();
  };

  const renderSwitch = (checked: boolean, onToggle: () => void, ariaLabel: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className="min-w-[48px] min-h-[36px] flex items-center justify-end cursor-pointer shrink-0"
    >
      <span
        className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {!compact && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>{pick('Chế độ Nhà phát triển (Cục bộ)', 'Developer Mode (Local)', '开发者模式（本地）')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {pick(
                'Các tùy chỉnh chẩn đoán và hiển thị chỉ áp dụng trên trình duyệt/máy này.',
                'Diagnostic and UI tweaks that apply strictly to this local browser/device.',
                '仅适用于当前本地浏览器/设备的诊断与界面调试选项。'
              )}
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
            {isDev ? 'DEV' : 'LOCAL'}
          </span>
        </div>
      )}

      {/* Banner badge on compact/mobile */}
      {compact && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 flex items-start gap-2.5">
          <Code2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            {pick(
              'Tùy chỉnh kỹ thuật cục bộ trên thiết bị này. Không ảnh hưởng tài khoản khác.',
              'Local technical controls for this device only. Does not affect other accounts.',
              '仅适用于当前设备的本地技术设置，不会影响其他账号。'
            )}
          </p>
        </div>
      )}

      {/* 1. Debug Log & FPS Monitor */}
      <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>{pick('Debug Log & Đo hiệu năng FPS', 'Debug Log & FPS Monitor', '调试日志与 FPS 监控')}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {metrics.logCount} logs
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {pick(
                  'Theo dõi độ trễ thao tác (ms), FPS thời gian thực và lịch sử click cục bộ.',
                  'Track UI interaction latency (ms), live FPS, and local click history.',
                  '实时追踪交互延迟（ms）、FPS 与本地点击日志。'
                )}
              </div>
            </div>
          </div>
          {renderSwitch(
            isDebugLogActive,
            handleToggleDebugLog,
            pick('Bật tắt Debug Log', 'Toggle Debug Log', '切换调试日志')
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleShowDebugWidget}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{pick('Mở bảng Debug Log', 'Open Debug Log panel', '打开调试日志面板')}</span>
          </button>
          <button
            type="button"
            onClick={handleClearLogs}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {clearedLocal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{clearedLocal ? pick('Đã xóa', 'Cleared', '已清空') : pick('Xóa lịch sử Log', 'Clear Log history', '清空日志历史')}</span>
          </button>
        </div>
      </div>

      {/* 2. Local Performance & Visual Inspection Toggles */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-white">
                {pick('Giảm chuyển động & Hiệu ứng nền', 'Reduce Motion & Background Effects', '减少动画与背景特效')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {pick(
                  'Tắt animation nặng giúp máy yếu chạy mượt hơn và tiết kiệm pin.',
                  'Disable heavy CSS animations on this device for smoother performance.',
                  '在此设备上关闭高负载动画以提升流畅度并省电。'
                )}
              </div>
            </div>
          </div>
          {renderSwitch(
            settings.reduceMotion,
            () => updateSettings({ reduceMotion: !settings.reduceMotion }),
            pick('Giảm chuyển động', 'Reduce Motion', '减少动画')
          )}
        </div>

        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0">
              <Grid className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-white">
                {pick('Khung viền gỡ lỗi bố cục (Layout Outlines)', 'Show Layout Debug Outlines', '显示布局调试边框')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {pick(
                  'Hiển thị đường nét đứt quanh các khối giao diện để kiểm tra khoảng trống.',
                  'Draw subtle dashed outlines around UI containers to inspect spacing.',
                  '在界面容器周围绘制虚线边框以检查间距与对齐。'
                )}
              </div>
            </div>
          </div>
          {renderSwitch(
            settings.layoutOutlines,
            () => updateSettings({ layoutOutlines: !settings.layoutOutlines }),
            pick('Khung viền gỡ lỗi', 'Layout Outlines', '布局调试边框')
          )}
        </div>

        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-white">
                {pick('Nhật ký chẩn đoán Console (DevTools)', 'Verbose Console Diagnostics', '详细控制台诊断日志')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {pick(
                  'In thông tin trạng thái cục bộ ra Console trình duyệt khi kiểm thử.',
                  'Output local state diagnostics to the browser DevTools console.',
                  '测试时在浏览器开发者控制台中输出本地诊断日志。'
                )}
              </div>
            </div>
          </div>
          {renderSwitch(
            settings.verboseConsoleLogs,
            () => updateSettings({ verboseConsoleLogs: !settings.verboseConsoleLogs }),
            pick('Nhật ký Console chi tiết', 'Verbose Console Logs', '详细控制台日志')
          )}
        </div>
      </div>

      {/* 3. Live Local Device Diagnostics */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span>{pick('Thông số máy cục bộ', 'Local Device Diagnostics', '本地设备诊断信息')}</span>
          </div>
          <button
            type="button"
            onClick={refreshMetrics}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title={pick('Làm mới', 'Refresh', '刷新')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">{pick('Khung hình', 'Viewport', '视口尺寸')}</div>
            <div className="font-mono font-bold text-white mt-0.5">{metrics.viewport}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">{pick('Mật độ điểm ảnh', 'Pixel Ratio', '像素比')}</div>
            <div className="font-mono font-bold text-white mt-0.5">{metrics.dpr}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">{pick('Mạng cục bộ', 'Network', '网络状态')}</div>
            <div className={`font-mono font-bold mt-0.5 ${metrics.online ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.online ? 'Online' : 'Offline'}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">PWA Standalone</div>
            <div className="font-mono font-bold text-white mt-0.5">
              {metrics.standalone ? pick('Có (App)', 'Yes (App)', '是（应用）') : pick('Web Tab', 'Web Tab', '网页标签')}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">WebRTC P2P</div>
            <div className={`font-mono font-bold mt-0.5 ${metrics.webrtc ? 'text-emerald-400' : 'text-amber-400'}`}>
              {metrics.webrtc ? pick('Hỗ trợ', 'Supported', '支持') : pick('Không', 'Unsupported', '不支持')}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400">LocalStorage</div>
            <div className="font-mono font-bold text-white mt-0.5">{metrics.storageKb}</div>
          </div>
        </div>
      </div>

      {/* 4. Hide / Disable Developer Mode (for non-DEV unlocked locally via 7 taps) */}
      {!isDev && unlocked && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Laptop className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {pick('Ẩn Chế độ Nhà phát triển', 'Hide Developer Mode', '隐藏开发者模式')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {pick(
                  'Tắt Debug Log, khôi phục hiệu ứng mặc định và ẩn tab này (nhấn logo 7 lần để mở lại).',
                  'Turn off Debug Log, restore default effects, and hide this tab (tap logo 7 times to reopen).',
                  '关闭调试日志、恢复默认动效并隐藏此标签页（连点 Logo 7 次可重新开启）。'
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLockDevMode}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{pick('Tắt & Ẩn', 'Turn off', '关闭并隐藏')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
