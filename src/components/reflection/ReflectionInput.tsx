'use client';

import { useState, useEffect } from 'react';
import { useVoiceRecorder } from '@/components/voice/useVoiceRecorder';
import { VoiceButton } from '@/components/voice/VoiceButton';

interface ReflectionInputProps {
  onSubmit: (text: string, inputMethod: 'voice' | 'text' | 'mixed') => void;
  disabled?: boolean;
}

export function ReflectionInput({ onSubmit, disabled }: ReflectionInputProps) {
  const [text, setText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [usedText, setUsedText] = useState(false);

  const voice = useVoiceRecorder('zh-CN');

  useEffect(() => {
    if (voice.finalTranscript) {
      setText((prev) => {
        const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
        return prev + sep + voice.finalTranscript;
      });
      voice.clear();
      setUsedVoice(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.finalTranscript]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setUsedText(true);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    const method: 'voice' | 'text' | 'mixed' =
      usedVoice && usedText ? 'mixed' : usedVoice ? 'voice' : 'text';
    onSubmit(text, method);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <textarea
          value={text + (voice.interimTranscript ? ` ${voice.interimTranscript}` : '')}
          onChange={handleTextChange}
          placeholder="说一段也行、打字也行——把今天倒在这里。
不用整齐，不用客观，骂自己也行。"
          disabled={disabled}
          rows={10}
          className="w-full p-4 rounded-2xl resize-none focus:outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border)',
            borderWidth: 1,
            fontFamily: 'inherit',
            lineHeight: 1.7,
          }}
        />
        {voice.interimTranscript && (
          <div
            className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-full"
            style={{ background: 'var(--accent-rose-gold)', color: 'var(--bg-primary)' }}
          >
            正在听...
          </div>
        )}
      </div>

      {voice.error && (
        <p className="text-xs" style={{ color: 'var(--accent-rose)' }}>
          {voice.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <VoiceButton
          isRecording={voice.isRecording}
          isSupported={voice.isSupported}
          onStart={voice.start}
          onStop={voice.stop}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="flex-1 py-3 rounded-full font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
        >
          ✨ 让 AI 梳理
        </button>
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
        🎤 长按支持 10+ 分钟连续语音 · 中途沉默不会断开
      </p>
    </div>
  );
}
