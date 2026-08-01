import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TodayDesk, getReviewRangeForPreset } from '@/components/project/TodayDesk';
import {
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from '@/lib/browser/safeStorage';

describe('TodayDesk execution review', () => {
  it('defers date-dependent review markup until after the static render', () => {
    const markup = renderToStaticMarkup(
      <TodayDesk
        groups={{ overdue: [], dueToday: [], highSoon: [], inProgress: [] }}
        stats={{
          completedThisWeek: 0,
          createdOrOpenThisWeek: 0,
          completionRate: 0,
          minutesThisWeek: 0,
          activeProjects: 0,
        }}
        projects={[]}
      />,
    );

    expect(markup).not.toContain('aria-label="执行复盘"');
    expect(markup).not.toContain('2026-07-27 至 2026-08-01');
    expect(markup).not.toContain('id="review-details-content"');
  });

  it('derives presets from the date at selection time', () => {
    expect(getReviewRangeForPreset('week', new Date('2026-08-02T23:59:00'))).toEqual({
      start: '2026-07-27',
      end: '2026-08-02',
    });
    expect(getReviewRangeForPreset('week', new Date('2026-08-03T00:01:00'))).toEqual({
      start: '2026-08-03',
      end: '2026-08-03',
    });
    expect(getReviewRangeForPreset('month', new Date('2026-08-03T00:01:00'))).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
  });

  it('continues without browser storage when storage access throws', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };

    expect(safeStorageGetItem('review-range', unavailableStorage)).toBeNull();
    expect(() => safeStorageSetItem('review-range', 'week', unavailableStorage)).not.toThrow();
    expect(() => safeStorageRemoveItem('review-range', unavailableStorage)).not.toThrow();
  });
});
