'use client';

import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/types/project';
import { mutate } from '@/lib/store/useStore';
import {
  finishTimer,
  pauseTimer,
  setTargetMinutes,
  startTimer,
  stopTimer,
  taskElapsedSeconds,
} from '@/lib/store/repository';
import { useCountdown } from '@/hooks/useCountdown';

function padTwo(n: number) {
  return String(n).padStart(2, '0');
}

/** 把秒数格式化成 mm:ss（不足一小时）或 h:mm:ss。 */
function fmtSec(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${padTwo(m)}:${padTwo(sec)}` : `${padTwo(m)}:${padTwo(sec)}`;
}

/**
 * 任务的倒计时器：设定目标时长，点开始实时倒数，可暂停/停止。
 * 到 0 响铃 + 自动把这段时间写为一条耗时记录（finishTimer），不改任务状态。
 * 专注时长用 started_at + elapsed_seconds 实时算，刷新页面/关页不丢秒。
 */
export function CountdownTimer({ task, readOnly }: { task: Task; readOnly?: boolean }) {
  const remaining = useCountdown(task);
  const running = Boolean(task.started_at);
  const hasRun = (task.elapsed_seconds ?? 0) > 0 || running;
  const elapsed = taskElapsedSeconds(task);
  const [target, setTarget] = useState<string>(String(task.target_minutes || 25));
  // 确保用户在跑倒计时的过程中目标值也保持同步（任务对象换了）。
  useEffect(() => {
    setTarget(String(task.target_minutes || 25));
  }, [task.target_minutes]);

  // 防止到点被 tick 重复触发多次。
  const finishedRef = useRef(false);
  useEffect(() => {
    // 任务对象变化（重新开始一轮）后重置去重闸。
    finishedRef.current = false;
  }, [task.started_at, task.elapsed_seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining > 0) return; // 还没到 0
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      // 响铃
      chime();
      // 自动落账 + 计时归零，状态不变
      mutate((draft) => {
        finishTimer(draft, task.id);
      });
    } catch {
      // 落账失败也不反复触发（闸已关）
    }
  }, [running, remaining, task.id]);

  function applyTarget() {
    const n = Number(target);
    if (!Number.isFinite(n) || n < 1 || n > 600) return;
    if (n === task.target_minutes) return;
    mutate((draft) => setTargetMinutes(draft, task.id, Math.floor(n)));
  }

  if (readOnly) {
    return (
      <div className="cd cd-ro" aria-label="倒计时（只读）">
        <div className="cd-time">{fmtSec(remaining)}</div>
        <div className="cd-sub">目标 {task.target_minutes || 25} 分钟 · 累计专注 {fmtSec(elapsed)}</div>
      </div>
    );
  }

  return (
    <div className={`cd${running ? ' is-running' : ''}${remaining === 0 && running ? ' is-due' : ''}`}>
      <div className="cd-head">
        <div className="cd-time" aria-live="polite">{fmtSec(remaining)}</div>
        <div className="cd-sub">
          目标{' '}
          <input
            type="number"
            className="cd-target-input"
            min={1}
            max={600}
            value={target}
            disabled={running}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={applyTarget}
          />
          分钟
          <span className="cd-elapsed"> · 已专注 {fmtSec(elapsed)}</span>
        </div>
      </div>
      <div className="cd-actions">
        {running ? (
          <button type="button" className="primary-button" onClick={() => mutate((d) => pauseTimer(d, task.id))}>
            暂停
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              // 继续/开始：若有累计 elapsed 且没超过目标，按 started_at 重新起算；
              // 若已到 0（上一轮完成且 elapsed 已被 finish 清零），直接开始新一轮。
              mutate((d) => startTimer(d, task.id));
            }}
          >
            {hasRun ? '继续' : '开始'}
          </button>
        )}
        <button
          type="button"
          className="pb-ghost"
          disabled={!hasRun}
          onClick={() => {
            if (!hasRun) return;
            if (!window.confirm('停止并把已计时写成一条耗时记录吗？')) return;
            try {
              mutate((d) => { stopTimer(d, task.id); });
            } catch {
              // silent
            }
          }}
        >
          停止并记录
        </button>
      </div>
    </div>
  );
}

/** 到点提示音 + 浏览器通知。 */
function chime() {
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      osc.start();
      osc.stop(ctx.currentTime + 0.75);
      osc.onended = () => ctx.close().catch(() => {});
    }
  } catch {
    // Web Audio 不可用就静默
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('倒计时完成', { body: '这段时间已记入耗时，可以休息一下。' });
    }
  } catch {
    // silent
  }
}
