import { describe, expect, it } from 'vitest';
import { parseLifeLogInput } from '@/lib/life/validation';

describe('parseLifeLogInput', () => {
  it('normalizes focus minutes', () => {
    expect(parseLifeLogInput({ type: 'focus', value: 45 }).unit).toBe('minutes');
  });
  it('rejects invalid mood score', () => {
    expect(() => parseLifeLogInput({ type: 'mood', value: 7 })).toThrow(/1 到 5/);
  });
  it('requires journal content', () => {
    expect(() => parseLifeLogInput({ type: 'journal', content: ' ' })).toThrow(/内容/);
  });
});
