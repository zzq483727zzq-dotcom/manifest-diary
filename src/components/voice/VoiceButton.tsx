'use client';

import { motion } from 'framer-motion';

interface VoiceButtonProps {
  isRecording: boolean;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({ isRecording, isSupported, onStart, onStop }: VoiceButtonProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        title="当前浏览器不支持语音识别"
        className="w-12 h-12 rounded-full flex items-center justify-center opacity-30 cursor-not-allowed"
        style={{ borderColor: 'var(--border)', borderWidth: 1 }}
      >
        🎤
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={isRecording ? onStop : onStart}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 rounded-full flex items-center justify-center relative"
      style={{
        background: isRecording ? 'var(--accent-rose-gold)' : 'transparent',
        borderColor: 'var(--border)',
        borderWidth: 1,
      }}
      title={isRecording ? '点击停止录音（说多久都行）' : '点击开始语音输入（不会因停顿断开）'}
    >
      <span className="text-xl">{isRecording ? '⏸' : '🎤'}</span>
      {isRecording && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--accent-rose-gold)' }}
          animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}