import { describe, expect, it } from 'vitest';
import { buildDashboardSummary } from '@/lib/life/aggregate';
import type { LifeLog } from '@/types/life';

const log = (overrides: Partial<LifeLog>): LifeLog => ({
  id: crypto.randomUUID(), user_id: 'u', entry_date: '2026-07-18', type: 'focus', start_at: null, end_at: null,
  value: 75, unit: 'minutes', content: null, metadata: {}, created_at: '2026-07-18T09:00:00Z', ...overrides,
});

describe('buildDashboardSummary', () => {
  it('aggregates today metrics and streak', () => {
    const result = buildDashboardSummary([
      log({ entry_date: '2026-07-17', type: 'mood', value: 3, unit: 'score' }),
      log({ entry_date: '2026-07-18', type: 'focus' }),
      log({ entry_date: '2026-07-18', type: 'sleep', value: 7, unit: 'hours' }),
    ], '2026-07-18');
    expect(result.today.focusMinutes).toBe(75);
    expect(result.today.sleepHours).toBe(7);
    expect(result.achievements.recordingStreak).toBe(2);
  });

  it('returns seven points and empty values without data', () => {
    const result = buildDashboardSummary([], '2026-07-18');
    expect(result.trend).toHaveLength(7);
    expect(result.today.focusMinutes).toBeNull();
    expect(result.today.completionRate).toBe(0);
  });
});
