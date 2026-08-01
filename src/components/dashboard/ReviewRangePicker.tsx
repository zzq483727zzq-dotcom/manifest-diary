'use client';

import type { ReviewRange } from '@/types/project';

export type ReviewRangePreset = 'today' | 'week' | 'month' | 'custom';

export function ReviewRangePicker({
  preset,
  value,
  onPresetChange,
  onRangeChange,
}: {
  preset: ReviewRangePreset;
  value: ReviewRange;
  onPresetChange: (preset: ReviewRangePreset) => void;
  onRangeChange: (range: ReviewRange) => void;
}) {
  const presets: Array<{ value: ReviewRangePreset; label: string }> = [
    { value: 'today', label: '今天' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'custom', label: '自定义' },
  ];

  function updateDate(key: keyof ReviewRange, next: string) {
    const nextRange = { ...value, [key]: next };
    onRangeChange(
      nextRange.start <= nextRange.end
        ? nextRange
        : key === 'start'
          ? { start: next, end: next }
          : { start: next, end: next },
    );
  }

  return (
    <div className="review-range-picker" aria-label="复盘范围">
      <div className="review-range-presets" role="group" aria-label="预设范围">
        {presets.map((item) => (
          <button
            key={item.value}
            className={`review-range-preset${preset === item.value ? ' active' : ''}`}
            type="button"
            aria-pressed={preset === item.value}
            onClick={() => onPresetChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="review-custom-dates">
          <label>
            <span>开始日期</span>
            <input
              type="date"
              value={value.start}
              max={value.end}
              onChange={(event) => updateDate('start', event.target.value)}
            />
          </label>
          <span className="review-date-separator" aria-hidden>至</span>
          <label>
            <span>结束日期</span>
            <input
              type="date"
              value={value.end}
              min={value.start}
              onChange={(event) => updateDate('end', event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
