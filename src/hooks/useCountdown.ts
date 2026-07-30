'use client';

import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/types/project';
import { taskRemainingSeconds } from '@/lib/store/repository';

/**
 * 驱动单个任务倒计时的每秒级 tick。
 * - 运行中（task.started_at 非空）时每秒触发一次 re-render 以刷新 mm:ss。
 * - 暂停/未启动时不开定时器，避免空转。
 * - 用 `Date.now()` 真实算剩余，不依赖 tick 精度，切后台被节流也不会丢秒；
 *   到剩余 == 0 由调用方在 tick 内 detect 并处理（finishTimer）。
 */
export function useCountdown(task: Task): number {
  const [now, setNow] = useState(() => Date.now());
  // 用 ref 记上一次剩余，只在剩余真正变化 < 1s 跨越时同步，减少 setState 抖动；这里为简洁每秒都 set。
  useEffect(() => {
    if (!task.started_at) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = window.setTimeout(tick, 1000) as unknown as number;
    };
    raf = window.setTimeout(tick, 1000) as unknown as number;
    return () => {
      if (raf) window.clearTimeout(raf);
    };
  }, [task.started_at]);
  return taskRemainingSeconds(task, now);
}
