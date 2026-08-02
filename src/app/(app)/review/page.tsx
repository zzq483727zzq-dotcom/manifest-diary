'use client';

import { useEffect, useMemo, useState } from 'react';
import { localDateString, formatMinutes, startOfMonth, endOfMonth, startOfWeek } from '@/lib/project/date';
import { useStore } from '@/lib/store/useStore';
import { getReviewStats } from '@/lib/store/repository';
import { safeStorageGetItem, safeStorageSetItem } from '@/lib/browser/safeStorage';
import { ReviewRangePicker, type ReviewRangePreset } from '@/components/dashboard/ReviewRangePicker';
import { ReviewSummary } from '@/components/dashboard/ReviewSummary';
import { ReviewDetails } from '@/components/dashboard/ReviewDetails';

function getReviewRangeForPreset(
  preset: Exclude<ReviewRangePreset, 'custom'>,
  now = new Date(),
) {
  const today = localDateString(now);
  const current = new Date(`${today}T12:00:00`);
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'week') return { start: startOfWeek(today), end: today };
  return {
    start: startOfMonth(current.getFullYear(), current.getMonth() + 1),
    end: endOfMonth(current.getFullYear(), current.getMonth() + 1),
  };
}

export default function ReviewPage() {
  const db = useStore();
  const [preset, setPreset] = useState<ReviewRangePreset>('week');
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    setRange(getReviewRangeForPreset('week'));
  }, []);

  const stats = useMemo(
    () => range == null ? null : getReviewStats(db, range),
    [db, range],
  );

  function selectPreset(next: ReviewRangePreset) {
    setPreset(next);
    if (next !== 'custom') setRange(getReviewRangeForPreset(next));
  }

  // 周复盘引导：三段引导填空，按「起止日期」分桶存放到 localStorage，
  // 这样切换范围不会串味，回到同一范围也找得到上次写的内容。
  const [notes, setNotes] = useState<Record<JournalKey, string>>({ done: '', stuck: '', next: '' });
  useEffect(() => {
    if (range == null) return;
    const raw = safeStorageGetItem(`clarity-review-journal-${range.start}-${range.end}`);
    if (raw == null) {
      setNotes({ done: '', stuck: '', next: '' });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Record<JournalKey, string>>;
      setNotes({
        done: parsed.done ?? '',
        stuck: parsed.stuck ?? '',
        next: parsed.next ?? '',
      });
    } catch {
      setNotes({ done: '', stuck: '', next: '' });
    }
  }, [range]);

  function persistNote(key: JournalKey, value: string) {
    const next = { ...notes, [key]: value };
    setNotes(next);
    if (range != null) {
      safeStorageSetItem(`clarity-review-journal-${range.start}-${range.end}`, JSON.stringify(next));
    }
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <h1>执行复盘</h1>
        <p>查看一段时间内的执行情况，分析效率与瓶颈。</p>
      </header>

      {range != null && stats != null ? (
        <section className="td-review" aria-label="执行复盘">
          <header className="td-sec-h review-heading" style={{ marginTop: 0 }}>
            <div>
              <h2>复盘范围</h2>
              <p>{stats.range.start} 至 {stats.range.end}</p>
            </div>
            <ReviewRangePicker
              preset={preset}
              value={range}
              onPresetChange={selectPreset}
              onRangeChange={(nextRange) => {
                setPreset('custom');
                setRange(nextRange.start <= nextRange.end ? nextRange : { start: nextRange.end, end: nextRange.end });
              }}
            />
          </header>
          <ReviewSummary stats={stats} />
          <ReviewDetails stats={stats} />

          <section className="review-journal" aria-label="复盘引导">
            <header className="td-sec-h">
              <h2>本段复盘</h2>
              <p>三句填空，理清节奏。内容按当前起止日期保存在本机。</p>
            </header>
            <ReviewJournalField
              label="做完了什么"
              hint={`共完成 ${stats.completedCount} 项任务，专注 ${formatMinutes(stats.actualTaskMinutes)}。`}
              value={notes.done}
              onChange={(v) => persistNote('done', v)}
              placeholder="这一段里真正推进落地的事…"
            />
            <ReviewJournalField
              label="卡在哪里"
              hint={stats.overdueTasks.length > 0 || stats.blockedTasks.length > 0
                ? `${stats.overdueTasks.length} 项逾期 · ${stats.blockedTasks.length} 项阻塞`
                : '没有明显的逾期或阻塞。'}
              value={notes.stuck}
              onChange={(v) => persistNote('stuck', v)}
              placeholder="哪些任务一直推不动、为什么…"
            />
            <ReviewJournalField
              label="下一段怎么改"
              hint="把上一个答案落到下一步动作上。"
              value={notes.next}
              onChange={(v) => persistNote('next', v)}
              placeholder="下一段要优先做什么、要避开什么…"
            />
          </section>
        </section>
      ) : (
        <p className="muted">加载中…</p>
      )}
    </div>
  );
}

type JournalKey = 'done' | 'stuck' | 'next';

function ReviewJournalField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="review-journal-field">
      <span className="review-journal-label">{label}</span>
      <small className="muted">{hint}</small>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={1000}
      />
    </label>
  );
}