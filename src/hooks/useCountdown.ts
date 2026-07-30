'use client';

import { useEffect, useState } from 'react';

type CountdownEntity = {
  started_at: string | null;
};

/**
 * 驱动任务或项目倒计时的每秒级 tick。
 * 剩余秒数始终由调用方基于真实时间计算，切后台或刷新页面不会丢失已过时间。
 */
export function useCountdown<T extends CountdownEntity>(
  entity: T,
  remainingSeconds: (entity: T, now: number) => number,
): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!entity.started_at) return;
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000) as unknown as number;
    };
    timer = window.setTimeout(tick, 1000) as unknown as number;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [entity.started_at]);

  return Math.max(0, remainingSeconds(entity, now));
}
