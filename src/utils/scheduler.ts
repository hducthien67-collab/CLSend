/**
 * Performance Scheduler & Yielding Utilities
 * Designed to eliminate INP (Interaction to Next Paint) lag
 * by yielding the Main Thread back to the browser compositor.
 */

export async function yieldToMain(): Promise<void> {
  // 1. Native W3C scheduler.yield() (Modern Chromium / Chrome 129+)
  if (typeof window !== 'undefined' && 'scheduler' in window && typeof (window as any).scheduler?.yield === 'function') {
    try {
      await (window as any).scheduler.yield();
      return;
    } catch {
      // Fallback if rejected
    }
  }

  // 2. High-performance MessageChannel fallback (faster than setTimeout 0, avoids 4ms timer clamping)
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }

  // 3. Fallback for older environments
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Throttle high-frequency updates (e.g. file progress, stream chunks) to match display refresh rate (rAF)
 */
export function createRafThrottler<T extends (...args: any[]) => void>(fn: T): T {
  let rafId: number | null = null;
  let latestArgs: any[] | null = null;

  return ((...args: any[]) => {
    latestArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (latestArgs) {
          fn(...latestArgs);
          latestArgs = null;
        }
        rafId = null;
      });
    }
  }) as T;
}
