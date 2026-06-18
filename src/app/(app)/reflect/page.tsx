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

export default function ReflectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'editing' | 'saving'>('idle');
  const [empathy, setEmpathy] = useState('');
  const [structured, setStructured] = useState<ReflectionStructured | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [inputMethod, setInputMethod] = useState<'voice' | 'text' | 'mixed'>('text');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (text: string, method: 'voice' | 'text' | 'mixed') => {
    setRawInput(text);
    setInputMethod(method);
    setPhase('streaming');
    setError(null);
    setEmpathy('');
    setStructured(null);

    const parser = new StreamingReflectionParser();

    try {
      const res = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              parser.append(parsed.content);
              setEmpathy(parser.state.empathy);
              setStructured(parser.state.structured);
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch {
            // ignore malformed SSE noise
          }
        }
      }

      setPhase('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('idle');
    }
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

      {phase === 'idle' && <ReflectionInput onSubmit={handleSubmit} />}

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

      {error && (
        <p className="text-sm text-center" style={{ color: 'var(--accent-rose)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
