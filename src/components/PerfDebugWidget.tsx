import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Trash2, Activity } from 'lucide-react';
import { useLanguage, getLocaleTag } from '../context/LanguageContext';

interface LogItem {
  id: string;
  time: string;
  target: string;
  latency: number;
}

const STORAGE_KEY_LOGS = 'clsend_perf_debug_logs_v2';
const STORAGE_KEY_EXPANDED = 'clsend_perf_debug_expanded_v2';
const STORAGE_KEY_VISIBLE = 'clsend_perf_debug_visible_v2';

const PerfDebugWidgetComponent: React.FC = () => {
  const { t, currentLang } = useLanguage();
  const localeRef = useRef<string>(getLocaleTag(currentLang));
  localeRef.current = getLocaleTag(currentLang);

  const [logs, setLogs] = useState<LogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      return saved ? JSON.parse(saved).slice(0, 50) : [];
    } catch {
      return [];
    }
  });

  const [latency, setLatency] = useState<number>(0);
  const [avgLatency, setAvgLatency] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      if (saved) {
        const arr: LogItem[] = JSON.parse(saved);
        if (arr.length > 0) {
          return Math.round(arr.reduce((sum, item) => sum + item.latency, 0) / arr.length);
        }
      }
    } catch {}
    return 0;
  });

  const [fps, setFps] = useState<number>(60);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VISIBLE);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_EXPANDED) === 'true';
    } catch {
      return false;
    }
  });

  const [copied, setCopied] = useState<boolean>(false);

  // Debounced log persistence so localStorage I/O never blocks click-to-paint
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
      } catch (e) {
        console.warn('Debug log persistence warning:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [logs]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;
      if (targetEl && targetEl.closest('#perf-debug-widget-root')) {
        return;
      }

      const clickDispatchTime = e.timeStamp > 0 ? e.timeStamp : performance.now();

      let targetName = 'unknown';
      if (targetEl) {
        if (targetEl.id) {
          targetName = `#${targetEl.id}`;
        } else {
          const btn = targetEl.closest('button');
          if (btn) {
            const btnText = (btn.innerText || btn.getAttribute('title') || btn.getAttribute('aria-label') || '').trim().slice(0, 16);
            targetName = btnText ? `[${btnText}]` : (btn.id ? `#${btn.id}` : 'button');
          } else {
            targetName = targetEl.tagName.toLowerCase();
          }
        }
      }

      requestAnimationFrame(() => {
        const nextPaintTime = performance.now();
        const totalLatency = Math.max(1, Math.round(nextPaintTime - clickDispatchTime));

        setLatency(totalLatency);

        const nowStr = new Date().toLocaleTimeString(localeRef.current, {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });

        const newLogItem: LogItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          time: nowStr,
          target: targetName,
          latency: totalLatency
        };

        setLogs(prev => {
          const updated = [newLogItem, ...prev.slice(0, 49)];
          const sum = updated.reduce((acc, curr) => acc + curr.latency, 0);
          setAvgLatency(Math.round(sum / updated.length));
          return updated;
        });
      });
    };

    window.addEventListener('click', handleClick, { passive: true, capture: true });

    let animId: number;
    let lastFpsUpdate = performance.now();
    let frameCount = 0;

    const measureFps = (now: number) => {
      frameCount++;
      if (now - lastFpsUpdate >= 800) {
        const calculatedFps = Math.min(120, Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        setFps((prev) => (Math.abs(calculatedFps - prev) >= 2 ? calculatedFps : prev));
        frameCount = 0;
        lastFpsUpdate = now;
      }
      animId = requestAnimationFrame(measureFps);
    };
    animId = requestAnimationFrame(measureFps);

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleToggleVisible = (val: boolean) => {
    setIsVisible(val);
    try {
      localStorage.setItem(STORAGE_KEY_VISIBLE, String(val));
    } catch {}
  };

  const handleToggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_EXPANDED, String(next));
      } catch {}
      return next;
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
    setAvgLatency(0);
    setLatency(0);
    try {
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch {}
  };

  const handleCopyLogs = () => {
    const report = [
      `=== CLSEND PERF DEBUG REPORT ===`,
      `FPS: ${fps}`,
      `Avg Latency: ${avgLatency} ms`,
      `Last Latency: ${latency} ms`,
      `Total Logged Clicks: ${logs.length}`,
      `--- CLICK HISTORY (PERSISTENT) ---`,
      ...logs.map(l => `[${l.time}] Target: ${l.target} - Latency: ${l.latency}ms`)
    ].join('\n');

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const getLatencyColor = (ms: number) => {
    if (ms <= 50) return 'text-emerald-400';
    if (ms <= 100) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getFpsColor = (f: number) => {
    if (f >= 55) return 'text-emerald-400';
    if (f >= 45) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (!isVisible) {
    return (
      <button
        id="perf-debug-reopen-btn"
        type="button"
        onClick={() => handleToggleVisible(true)}
        className="fixed bottom-2 left-2 z-[9999] bg-black text-emerald-400 px-2 py-1 text-[10px] font-mono border border-emerald-500/50 rounded shadow-md cursor-pointer hover:bg-slate-900 flex items-center gap-1"
      >
        <Activity className="w-3 h-3" />
        <span>[{t('perf.log_btn').replace('{count}', String(logs.length))}]</span>
      </button>
    );
  }

  return (
    <div
      id="perf-debug-widget-root"
      className="fixed bottom-2 left-2 z-[9999] bg-black/95 text-emerald-400 p-2.5 font-mono text-[11px] border border-emerald-500/50 rounded-lg shadow-2xl space-y-2 select-none pointer-events-auto w-80 max-w-[calc(100vw-1rem)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-white text-[11px]">{t('perf.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="text-emerald-300 hover:text-white px-1.5 py-0.5 text-[10px] bg-emerald-950/80 border border-emerald-500/40 rounded flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? t('perf.copied') : t('perf.copy')}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleExpanded}
            className="text-emerald-300 hover:text-white px-1.5 py-0.5 text-[10px] bg-slate-800 rounded cursor-pointer"
          >
            {isExpanded ? t('perf.collapse') : t('perf.log_btn').replace('{count}', String(logs.length))}
          </button>
          <button
            type="button"
            onClick={() => handleToggleVisible(false)}
            className="text-slate-400 hover:text-white px-1 text-[10px] cursor-pointer"
          >
            [{t('perf.hide')}]
          </button>
        </div>
      </div>

      <div className="space-y-0.5 text-[10px]">
        <div>{t('perf.last_latency')} <strong className={getLatencyColor(latency)}>{latency} ms</strong></div>
        <div>{t('perf.avg_latency').replace('{count}', String(logs.length))} <strong className={getLatencyColor(avgLatency)}>{avgLatency} ms</strong></div>
        <div>{t('perf.fps')} <strong className={getFpsColor(fps)}>{fps} FPS</strong></div>
      </div>

      {isExpanded && (
        <div className="space-y-1 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <span>{t('perf.history_title')}</span>
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>{t('perf.clear')}</span>
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-[10px] scrollbar-thin">
            {logs.map(log => (
              <div key={log.id} className="p-1 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-1">
                <span className="text-slate-400 text-[9px]">{log.time}</span>
                <span className="text-cyan-300 truncate max-w-[130px]" title={log.target}>{log.target}</span>
                <span className={`font-bold shrink-0 ${getLatencyColor(log.latency)}`}>{log.latency}ms</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-500 text-center py-2 italic text-[10px]">{t('perf.empty')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PerfDebugWidget = React.memo(PerfDebugWidgetComponent);
