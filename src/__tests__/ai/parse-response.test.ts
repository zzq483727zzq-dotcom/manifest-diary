import { describe, it, expect } from 'vitest';
import { parseAIResponse, type ReflectionStructured } from '@/lib/ai/parse-response';

describe('parseAIResponse', () => {
  it('parses a valid reflection response with text + JSON', () => {
    const raw = `凌晨三点你还能起来洗澡，这本身就很厉害。

{
  "highlights": [
    {
      "fact": "凌晨三点起来洗了澡",
      "why_it_counts": "低谷期能照顾自己身体，是真正的力量"
    }
  ],
  "cognitive_bugs": [
    {
      "type": "all_or_nothing",
      "user_quote": "我今天又废了",
      "reframe": "你洗了澡、还找朋友聊了天，这不叫废了，叫扛着痛还在走"
    }
  ],
  "tomorrow_script": [
    {
      "step": 1,
      "action": "喝一口床头的水",
      "duration_minutes": 1
    },
    {
      "step": 2,
      "action": "走到窗边拉开窗帘",
      "duration_minutes": 1
    },
    {
      "step": 3,
      "action": "坐到书桌前打开电脑",
      "duration_minutes": 2
    }
  ]
}`;

    const result = parseAIResponse(raw);
    expect(result.empathy).toBe('凌晨三点你还能起来洗澡，这本身就很厉害。');
    expect(result.structured.highlights).toHaveLength(1);
    expect(result.structured.highlights[0].fact).toBe('凌晨三点起来洗了澡');
    expect(result.structured.cognitive_bugs).toHaveLength(1);
    expect(result.structured.cognitive_bugs[0].type).toBe('all_or_nothing');
    expect(result.structured.tomorrow_script).toHaveLength(3);
    expect(result.structured.tomorrow_script[0].step).toBe(1);
  });

  it('parses response with no cognitive bugs', () => {
    const raw = `嗯，今天过得还行。

{
  "highlights": [],
  "cognitive_bugs": [],
  "tomorrow_script": [
    {
      "step": 1,
      "action": "喝一杯温水",
      "duration_minutes": 1
    }
  ]
}`;

    const result = parseAIResponse(raw);
    expect(result.empathy).toBe('嗯，今天过得还行。');
    expect(result.structured.highlights).toHaveLength(0);
    expect(result.structured.cognitive_bugs).toHaveLength(0);
    expect(result.structured.tomorrow_script).toHaveLength(1);
  });

  it('handles JSON wrapped in markdown code block', () => {
    const raw = `说真的，你今天做的比你想的多。

\`\`\`json
{
  "highlights": [],
  "cognitive_bugs": [],
  "tomorrow_script": [
    {
      "step": 1,
      "action": "坐起来伸个懒腰",
      "duration_minutes": 1
    }
  ]
}
\`\`\``;

    const result = parseAIResponse(raw);
    expect(result.empathy).toBe('说真的，你今天做的比你想的多。');
    expect(result.structured.tomorrow_script).toHaveLength(1);
  });

  it('throws on response with no JSON', () => {
    const raw = '今天没什么好说的。';
    expect(() => parseAIResponse(raw)).toThrow('AI response contains no valid JSON');
  });

  it('throws on invalid JSON', () => {
    const raw = `嗯。

{ invalid json }`;

    expect(() => parseAIResponse(raw)).toThrow();
  });
});
