'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReflectionInput } from '@/components/reflection/ReflectionInput';
import { EmpathyBubble } from '@/components/reflection/EmpathyBubble';
import { HighlightCard } from '@/components/reflection/HighlightCard';
import { BugCard } from '@/components/reflection/BugCard';
import { ScriptCard } from '@/components/reflection/ScriptCard';
import { StreamingReflectionParser } from '@/lib/ai/streaming-parser';
import type { ReflectionStructured, TomorrowStep } from '@/lib/ai/parse-response';

interface JournalEntryLite {
  entry_date: string;
  ai_structured: ReflectionStructured | null;
}

export default function ReflectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'editing' | 'saving'>('idle');
  const [empathy, setEmpathy] = useState('');
  const [structured, setStructured] = useState<ReflectionStructured | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [inputMethod, setInputMethod] = useState<'voice' | 'text' | 'mixed'>('text');
  const [error, setError] = useState<string | null>(null);

  const runReflect = async (text: string, method: 'voice' | 'text' | 'mixed') => {
    setRawInput(text);
    setInputMethod(method);
    setPhase('streaming');
    setError(null);
    setEmpathy('');
    setStructured(null);

    const parser = new StreamingReflectionParser();

    // Best-effort: fetch the last 3 entries and summarize them as recent
    // context. This is nice-to-have memory for the AI; never block on it.
    let recentContext: string | undefined;
    try {
      const histRes = await fetch('/api/journal');
      if (histRes.ok) {
        const { entries } = (await histRes.json()) as { entries?: JournalEntryLite[] };
        const last3: JournalEntryLite[] = (entries ?? []).slice(0, 3).map((e) => ({
          entry_date: e.entry_date,
          ai_structured: e.ai_structured,
        }));
        if (last3.length > 0) {
          const { summarizeRecentEntries } = await import('@/lib/ai/recent-context');
          const summary = summarizeRecentEntries(last3);
          if (summary) recentContext = summary;
        }
      }
    } catch {
      // Recent context is optional — silently skip on failure.
    }

    try {
      const res = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: text, recentContext }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body && typeof body === 'object' && 'error' in body && body.error) ||
            `API error: ${res.status}`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Persistent line buffer so `data: {...}` lines split across reads are
      // re-assembled rather than dropped.
      let lineBuffer = '';
      let streamError: string | null = null;

      const handleLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6).trim();
        if (data === '' || data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            parser.append(parsed.content);
            setEmpathy(parser.state.empathy);
            setStructured(parser.state.structured);
          }
          if (parsed.error) {
            streamError = String(parsed.error);
          }
        } catch {
          // Malformed JSON inside `data:` — skip silently.
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        // The last element may be incomplete; keep it for the next read.
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) handleLine(line);
      }
      // Flush trailing tail (server may emit a final line without trailing \n).
      lineBuffer += decoder.decode();
      if (lineBuffer.length > 0) handleLine(lineBuffer);

      if (streamError) {
        // Surface the upstream error but keep any partial empathy visible so
        // the user can retry without losing context.
        setError(streamError);
        setPhase('idle');
        return;
      }

      // After the stream ends, decide what UI state to show.
      // Don't blindly switch to 'editing' — that strands the user with no
      // cards visible but a Save button that silently no-ops.
      if (parser.state.structured) {
        setPhase('editing');
        return;
      }

      // No structured JSON. Try a final parse via finalize() in case the
      // buffer holds a recoverable form; if it throws, surface a friendly
      // error and preserve any empathy text we already received.
      try {
        parser.finalize();
        setPhase('editing');
      } catch {
        setError('AI 回答不完整，请重新试一次');
        setPhase('idle');
      }
    } catch (err) {
      // Network or non-2xx error. Preserve whatever empathy the parser had
      // received so far so the user sees we got *something* back.
      const partial = parser.state.empathy;
      if (partial) setEmpathy(partial);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('idle');
    }
  };

  const handleSubmit = async (text: string, method: 'voice' | 'text' | 'mixed') => {
    await runReflect(text, method);
  };

  const handleRetry = () => {
    if (!rawInput) return;
    void runReflect(rawInput, inputMethod);
  };

  const handleSave = async () => {
    if (!structured) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput,
          inputMethod,
          aiResponse: empathy,
          aiStructured: structured,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Save failed');
      }

      router.push('/?saved=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setPhase('editing');
    }
  };

  const updateScript = (steps: TomorrowStep[]) => {
    if (!structured) return;
    setStructured({ ...structured, tomorrow_script: steps });
  };

  // Show the retry affordance only when we're back at idle, have a saved
  // input to retry against, and either an error or a stranded empathy.
  const showRetry = phase === 'idle' && rawInput.length > 0 && (error !== null || empathy.length > 0);

  return (
    <div className="space-y-6">
      <header className="text-center pt-4">
        <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
          今夜，先深呼吸
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          说也行，写也行——它会接住你
        </p>
      </header>

      {phase === 'idle' && !showRetry && <ReflectionInput onSubmit={handleSubmit} />}

      {error && (
        <p className="text-sm text-center" style={{ color: 'var(--accent-rose)' }}>
          {error}
        </p>
      )}

      {phase !== 'idle' && (
        <div className="space-y-4">
          {empathy && <EmpathyBubble text={empathy} isStreaming={phase === 'streaming'} />}
          {structured && (
            <>
              <HighlightCard highlights={structured.highlights} index={0} />
              <BugCard bugs={structured.cognitive_bugs} index={1} />
              <ScriptCard
                steps={structured.tomorrow_script}
                index={2}
                onChange={updateScript}
                readOnly={phase !== 'editing'}
              />
            </>
          )}

          {phase === 'editing' && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setPhase('idle');
                  setEmpathy('');
                  setStructured(null);
                  setRawInput('');
                  setError(null);
                }}
                className="flex-1 py-3 rounded-full"
                style={{
                  borderColor: 'var(--border)',
                  borderWidth: 1,
                  color: 'var(--text-secondary)',
                }}
              >
                重新写
              </button>
              <button
                onClick={handleSave}
                className="flex-[2] py-3 rounded-full font-medium"
                style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
              >
                ✨ 保存今晚的复盘
              </button>
            </div>
          )}
          {phase === 'saving' && (
            <p className="text-center" style={{ color: 'var(--text-secondary)' }}>
              正在保存...
            </p>
          )}
        </div>
      )}

      {showRetry && (
        <div className="space-y-4">
          {empathy && <EmpathyBubble text={empathy} isStreaming={false} />}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setPhase('idle');
                setEmpathy('');
                setStructured(null);
                setRawInput('');
                setError(null);
              }}
              className="flex-1 py-3 rounded-full"
              style={{
                borderColor: 'var(--border)',
                borderWidth: 1,
                color: 'var(--text-secondary)',
              }}
            >
              重新写
            </button>
            <button
              onClick={handleRetry}
              className="flex-[2] py-3 rounded-full font-medium"
              style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
            >
              重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
