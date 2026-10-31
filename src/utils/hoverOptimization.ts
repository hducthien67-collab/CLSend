/**
 * Hover-activation & Anti-Lag optimization system (Zalo-style smart idle & hover pre-loading)
 */
import { useState, useCallback, useRef } from 'react';

export function useHoverActivation<T = any>(
  activateFn: () => void | Promise<T>,
  delayMs: number = 100
) {
  const [isActivated, setIsActivated] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (isActivated) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setIsActivated(true);
      try {
        activateFn();
      } catch (err) {
        console.error('Hover activation error:', err);
      }
    }, delayMs);
  }, [activateFn, delayMs, isActivated]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    isActivated,
    bindHover: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
}
