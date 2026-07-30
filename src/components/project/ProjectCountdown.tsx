'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import { mutate } from '@/lib/store/useStore';
import {
  finishProjectTimer,
  pauseProjectTimer,
  projectElapsedSeconds,
  projectRemainingSeconds,
  setProjectTargetMinutes,
  startProjectTimer,
  stopProjectTimer,
} from '@/lib/store/repository';
import { useCountdown } from '@/hooks/useCountdown';

function padTwo(value: number) {
  return String(value).padStart(2, '0');
}

function formatSeconds(total: number) {
  const seconds = Math.max(0, Math.floor(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${padTwo(minutes)}:${padTwo(remainder)}`
    : `${padTwo(minutes)}:${padTwo(remainder)}`;
}

/** 项目整体专注倒计时；项目投入与任务投入分开记录。 */
export function ProjectCountdown({ project, readOnly }: { project: Project; readOnly?: boolean }) {
  const remaining = useCountdown(project, projectRemainingSeconds);
  const running = Boolean(project.started_at);
  const hasRun = (project.elapsed_seconds ?? 0) > 0 || running;
  const elapsed = projectElapsedSeconds(project);
  const [target, setTarget] = useState(String(project.target_minutes || 25));
  const finishedRef = useRef(false);

  useEffect(() => {
    setTarget(String(project.target_minutes || 25));
  }, [project.target_minutes]);

  useEffect(() => {
    finishedRef.current = false;
  }, [project.started_at, project.elapsed_seconds]);

  useEffect(() => {
    if (!running || remaining > 0 || finishedRef.current) return;
    finishedRef.current = true;
    try {
      mutate((draft) => {
        finishProjectTimer(draft, project.id);
      });
    } catch {
      // A failed persistence operation must not retry every tick.
    }
  }, [project.id, remaining, running]);

  function applyTarget() {
    const minutes = Number(target);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) return;
    if (Math.floor(minutes) === project.target_minutes) return;
    mutate((draft) => setProjectTargetMinutes(draft, project.id, Math.floor(minutes)));
  }

  if (readOnly) {
    return (
      <div className="cd cd-ro project-cd" aria-label="项目整体倒计时（只读）">
        <div className="cd-time">{formatSeconds(remaining)}</div>
        <div className="cd-sub">项目目标 {project.target_minutes || 25} 分钟 · 已专注 {formatSeconds(elapsed)}</div>
      </div>
    );
  }

  return (
    <div
      className={`cd project-cd${running ? ' is-running' : ''}${remaining === 0 && running ? ' is-due' : ''}`}
    >      <div className="cd-head">
        <div className="cd-label">项目整体专注</div>
        <div className="cd-time" aria-live="polite">
          {formatSeconds(remaining)}
        </div>
        <div className="cd-sub">
          目标{' '}
          <input
            type="number"
            className="cd-target-input"
            min={1}
            max={600}
            value={target}
            disabled={running}
            onChange={(event) => setTarget(event.target.value)}
            onBlur={applyTarget}
          />{' '}
          分钟 · 已专注 {formatSeconds(elapsed)}
        </div>
      </div>
      <div className="cd-actions">
        {running ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => mutate((draft) => pauseProjectTimer(draft, project.id))}
          >
            暂停
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => mutate((draft) => startProjectTimer(draft, project.id))}
          >
            {hasRun ? '继续' : '开始'}
          </button>
        )}
        <button
          type="button"
          className="pb-ghost"
          disabled={!hasRun}
          onClick={() => {
            if (!hasRun || !window.confirm('停止并保存项目专注时间吗？')) return;
            try {
              mutate((draft) => {
                stopProjectTimer(draft, project.id);
              });
            } catch {
              // silent
            }
          }}
        >
          停止并保存
        </button>
      </div>
    </div>
  );
}
