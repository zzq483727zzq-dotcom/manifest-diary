import type { ReflectionStructured, ParsedReflection } from './parse-response';

interface StreamState {
  empathy: string;
  structured: ReflectionStructured | null;
}

export class StreamingReflectionParser {
  private buffer = '';
  public state: StreamState = { empathy: '', structured: null };

  append(chunk: string): void {
    this.buffer += chunk;
    this.recompute();
  }

  finalize(): ParsedReflection {
    if (!this.state.structured) {
      throw new Error('Stream ended before structured JSON was complete');
    }
    return {
      empathy: this.state.empathy,
      structured: this.state.structured,
    };
  }

  private recompute(): void {
    // Find JSON start: either an explicit ```json fence, or a \n\n{ separator.
    // Using the literal `{` would be wrong — empathy text can contain `{`.
    const fenceIdx = this.buffer.indexOf('```json');
    let jsonStart = -1;

    if (fenceIdx !== -1) {
      const afterFenceNewline = this.buffer.indexOf('\n', fenceIdx);
      jsonStart = afterFenceNewline === -1 ? fenceIdx + 7 : afterFenceNewline + 1;
      this.state.empathy = this.buffer.slice(0, fenceIdx).trim();
    } else {
      const separatorIdx = this.buffer.indexOf('\n\n{');
      if (separatorIdx === -1) {
        this.state.empathy = this.buffer.trim();
        this.state.structured = null;
        return;
      }
      jsonStart = separatorIdx + 2; // skip the two \n, land on '{'
      this.state.empathy = this.buffer.slice(0, separatorIdx).trim();
    }

    const remaining = this.buffer.slice(jsonStart);
    const candidate = extractJsonCandidate(remaining);
    if (!candidate) {
      this.state.structured = null;
      return;
    }

    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.highlights) &&
        Array.isArray(parsed.cognitive_bugs) &&
        Array.isArray(parsed.tomorrow_script)
      ) {
        this.state.structured = parsed as ReflectionStructured;
      } else {
        this.state.structured = null;
      }
    } catch {
      this.state.structured = null;
    }
  }
}

/**
 * Pull out a balanced `{ ... }` JSON object from text that may have a closing
 * ``` fence or other trailing characters after the JSON. Mirrors the brace-
 * matching logic in parse-response.ts's extractBareJSON, but for an already-
 * trimmed candidate starting near `{`.
 */
function extractJsonCandidate(text: string): string | null {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  // Walk the string tracking string-literal state so braces inside strings
  // don't throw the depth counter off.
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(firstBrace, i + 1);
      }
    }
  }

  // No matching close yet — JSON not complete.
  return null;
}
