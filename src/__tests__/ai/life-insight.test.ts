import { describe, expect, it } from 'vitest';
import { buildLifeInsightInput, fallbackLifeInsight, parseLifeInsight } from '@/lib/ai/life-insight';
import { buildDashboardSummary } from '@/lib/life/aggregate';

describe('life insight', () => {
  const summary = buildDashboardSummary([], '2026-07-18');
  it('only serializes aggregate data', () => { expect(JSON.stringify(buildLifeInsightInput(summary, 7))).not.toContain('user'); });
  it('uses a low confidence fallback with little data', () => { expect(fallbackLifeInsight(summary).confidence).toBe('low'); });
  it('rejects diagnostic language', () => { const fallback = fallbackLifeInsight(summary); expect(parseLifeInsight({ summary: '这是诊断', suggestions: ['a', 'b'], confidence: 'high' }, fallback)).toEqual(fallback); });
});
