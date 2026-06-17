export interface Highlight {
  fact: string;
  why_it_counts: string;
}

export interface CognitiveBug {
  type: 'catastrophizing' | 'all_or_nothing' | 'should_statements' | 'mind_reading' | 'personalization' | 'discounting_positive';
  user_quote: string;
  reframe: string;
}

export interface TomorrowStep {
  step: number;
  action: string;
  duration_minutes: number;
}

export interface ReflectionStructured {
  highlights: Highlight[];
  cognitive_bugs: CognitiveBug[];
  tomorrow_script: TomorrowStep[];
}

export interface ParsedReflection {
  empathy: string;
  structured: ReflectionStructured;
}

export function parseAIResponse(raw: string): ParsedReflection {
  // Try to find JSON in the response — it may or may not be wrapped in ```json
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const jsonCandidate = jsonMatch
    ? jsonMatch[1].trim()
    : extractBareJSON(raw);

  if (!jsonCandidate) {
    throw new Error('AI response contains no valid JSON');
  }

  const structured: ReflectionStructured = JSON.parse(jsonCandidate);

  // Extract empathy text (everything before the JSON)
  const jsonStartIndex = jsonMatch
    ? raw.indexOf('```json')
    : raw.indexOf('{');
  const empathy = raw.slice(0, jsonStartIndex).trim();

  return { empathy, structured };
}

function extractBareJSON(text: string): string | null {
  // Find the first '{' and try to parse from there
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  const candidate = text.slice(firstBrace);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Try to find the end of the JSON by matching braces
    let depth = 0;
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) {
        const sub = text.slice(firstBrace, i + 1);
        try {
          JSON.parse(sub);
          return sub;
        } catch {
          break;
        }
      }
    }
    return null;
  }
}
