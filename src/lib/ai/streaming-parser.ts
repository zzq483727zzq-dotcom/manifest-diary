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
    const fenceIdx = this.buffer.indexOf('```json');
    let jsonStart = -1;

    if (fenceIdx !== -1) {
      jsonStart = this.buffer.indexOf('\n', fenceIdx) + 1;
      this.state.empathy = this.buffer.slice(0, fenceIdx).trim();
    } else {
      const firstBrace = this.buffer.indexOf('{');
      if (firstBrace === -1) {
        this.state.empathy = this.buffer.trim();
        this.state.structured = null;
        return;
      }
      jsonStart = firstBrace;
      this.state.empathy = this.buffer.slice(0, firstBrace).trim();
    }

    const remaining = this.buffer.slice(jsonStart);
    const closingFence = remaining.indexOf('```');
    const candidate = closingFence !== -1
      ? remaining.slice(0, closingFence).trim()
      : remaining.trim();

    try {
      const parsed = JSON.parse(candidate);
      if (
        Array.isArray(parsed.highlights) &&
        Array.isArray(parsed.cognitive_bugs) &&
        Array.isArray(parsed.tomorrow_script)
      ) {
        this.state.structured = parsed as ReflectionStructured;
      }
    } catch {
      this.state.structured = null;
    }
  }
}