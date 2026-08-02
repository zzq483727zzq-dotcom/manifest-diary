'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useCountUp — 数字 mount 时从 0 滚到 target，约 0.5s ease-out。
 *
 * - 重放：surface 会在每次 target 变化（换复盘范围、切入页）时重新滚一遍，
 *   给统计页"刚刚算完一段"的反馈。
 * - reduced-motion 用户直接返回终值，不跑 rAF。
 * - 小数：保留传入的 decimals 位（向下截断到整数秒）。
 *
 * 用于治愈系润色里 ReviewSummary/ReviewDetails/TodayDesk 的统计数字。
 */
export function useCountUp(target: number, durationMs = 540): number {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // SSR / reduced-motion 直接落到终值，避免 hydration mismatch 与无谓动画。
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !Number.isFinite(target)) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic：1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return display;
}
