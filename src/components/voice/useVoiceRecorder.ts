'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export interface VoiceRecorderState {
  isRecording: boolean;
  finalTranscript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

export interface VoiceRecorderControls {
  start: () => void;
  stop: () => void;
  clear: () => void;
}

export function useVoiceRecorder(lang = 'zh-CN'): VoiceRecorderState & VoiceRecorderControls {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isManuallyStopped = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const createRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;       // 关键 1：不要在停顿时自动结束
    rec.interimResults = true;   // 关键 2：边说边显示
    rec.lang = lang;
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('当前浏览器不支持语音识别');
      return;
    }

    setError(null);
    isManuallyStopped.current = false;

    const rec = createRecognition();
    if (!rec) {
      setError('无法初始化语音识别');
      return;
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalDelta = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalDelta += transcript;
        else interim += transcript;
      }
      if (finalDelta) {
        setFinalTranscript((prev) => prev + finalDelta);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (event: Event) => {
      const err = (event as unknown as { error?: string }).error || 'unknown';
      if (err !== 'no-speech' && err !== 'aborted') {
        setError(`录音错误：${err}`);
      }
    };

    rec.onend = () => {
      // 关键 3：心跳保活——浏览器会自动断开 continuous 会话，这里自动重连
      if (!isManuallyStopped.current) {
        try {
          rec.start();
        } catch {
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
        setInterimTranscript('');
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      setError(`启动失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [createRecognition, isSupported]);

  const stop = useCallback(() => {
    isManuallyStopped.current = true;
    recognitionRef.current?.stop();
  }, []);

  const clear = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      isManuallyStopped.current = true;
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isRecording,
    finalTranscript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    clear,
  };
}