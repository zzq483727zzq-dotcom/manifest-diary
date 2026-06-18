import { describe, it, expect } from 'vitest';
import { summarizeRecentEntries } from '@/lib/ai/recent-context';

describe('summarizeRecentEntries', () => {
  it('returns empty string for no entries', () => {
    expect(summarizeRecentEntries([])).toBe('');
  });

  it('summarizes 3 recent entries with date and key facts', () => {
    const entries = [
      {
        entry_date: '2026-06-13',
        ai_structured: {
          highlights: [{ fact: '跑了 3km', why_it_counts: '' }],
          cognitive_bugs: [],
          tomorrow_script: [],
        },
      },
      {
        entry_date: '2026-06-14',
        ai_structured: {
          highlights: [{ fact: '看了书', why_it_counts: '' }],
          cognitive_bugs: [{ type: 'all_or_nothing' as const, user_quote: '我废了', reframe: '' }],
          tomorrow_script: [],
        },
      },
    ];

    const result = summarizeRecentEntries(entries);
    expect(result).toContain('2026-06-13');
    expect(result).toContain('跑了 3km');
    expect(result).toContain('2026-06-14');
    expect(result).toContain('看了书');
    expect(result).toContain('all_or_nothing');
  });
});
