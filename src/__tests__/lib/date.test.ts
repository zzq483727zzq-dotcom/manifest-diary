import { describe, it, expect } from 'vitest';
import { computeEntryDate, computeScheduledFor, formatDateZh } from '@/lib/date';

describe('computeEntryDate', () => {
  it('returns today for normal evening time (e.g. 22:30)', () => {
    const t = new Date('2026-06-15T22:30:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });

  it('returns yesterday for early morning before 5am (e.g. 02:30)', () => {
    const t = new Date('2026-06-16T02:30:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });

  it('returns today for 05:00 sharp', () => {
    const t = new Date('2026-06-16T05:00:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-16');
  });

  it('returns today for 04:59', () => {
    const t = new Date('2026-06-16T04:59:00+08:00');
    expect(computeEntryDate(t, 'Asia/Shanghai')).toBe('2026-06-15');
  });
});

describe('computeScheduledFor', () => {
  it('returns next day for evening reflection', () => {
    const entryDate = '2026-06-15';
    expect(computeScheduledFor(entryDate)).toBe('2026-06-16');
  });

  it('handles month rollover', () => {
    const entryDate = '2026-06-30';
    expect(computeScheduledFor(entryDate)).toBe('2026-07-01');
  });
});

describe('formatDateZh', () => {
  it('formats ISO date as Chinese', () => {
    expect(formatDateZh('2026-06-15')).toBe('2026年6月15日');
  });
});