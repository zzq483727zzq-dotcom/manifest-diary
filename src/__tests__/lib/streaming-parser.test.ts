import { describe, it, expect } from 'vitest';
import { StreamingReflectionParser } from '@/lib/ai/streaming-parser';

describe('StreamingReflectionParser', () => {
  it('emits empathy text incrementally before JSON arrives', () => {
    const parser = new StreamingReflectionParser();
    const states: { empathy: string; structured: any }[] = [];

    parser.append('凌晨三点');
    states.push({ ...parser.state });
    parser.append('你还能起来洗澡。');
    states.push({ ...parser.state });

    expect(states[0].empathy).toBe('凌晨三点');
    expect(states[0].structured).toBeNull();
    expect(states[1].empathy).toBe('凌晨三点你还能起来洗澡。');
    expect(states[1].structured).toBeNull();
  });

  it('parses structured JSON after empathy text', () => {
    const parser = new StreamingReflectionParser();
    parser.append('凌晨三点你还能起来洗澡。\n\n{');
    parser.append('"highlights":[],"cognitive_bugs":[],');
    parser.append('"tomorrow_script":[{"step":1,"action":"喝水","duration_minutes":1}]}');

    expect(parser.state.empathy).toBe('凌晨三点你还能起来洗澡。');
    expect(parser.state.structured).not.toBeNull();
    expect(parser.state.structured!.tomorrow_script).toHaveLength(1);
    expect(parser.state.structured!.tomorrow_script[0].action).toBe('喝水');
  });

  it('handles JSON wrapped in ```json fences', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯，今天还行。\n\n```json\n');
    parser.append('{"highlights":[],"cognitive_bugs":[],"tomorrow_script":[]}\n```');

    expect(parser.state.empathy).toBe('嗯，今天还行。');
    expect(parser.state.structured).not.toBeNull();
  });

  it('keeps structured null when JSON is incomplete', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。\n\n{"highlights":[');
    expect(parser.state.empathy).toBe('嗯。');
    expect(parser.state.structured).toBeNull();
  });

  it('exposes finalize() to throw on incomplete final state', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。');
    expect(() => parser.finalize()).toThrow();
  });

  it('finalize() returns the full parsed reflection when complete', () => {
    const parser = new StreamingReflectionParser();
    parser.append('嗯。\n\n{"highlights":[],"cognitive_bugs":[],"tomorrow_script":[]}');
    const final = parser.finalize();
    expect(final.empathy).toBe('嗯。');
    expect(final.structured.highlights).toEqual([]);
  });
});