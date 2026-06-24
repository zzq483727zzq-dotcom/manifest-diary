'use client';

import { motion } from 'framer-motion';

interface EmpathyBubbleProps {
  text: string;
  isStreaming?: boolean;
}

export function EmpathyBubble({ text, isStreaming }: EmpathyBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glow-border glow-pulse relative p-6 rounded-3xl"
      style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      <p
        className="font-ai text-base"
        style={{
          color: 'var(--text-primary)',
          lineHeight: 1.85,
          letterSpacing: '0.02em',
        }}
      >
        {text}
        {isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-2 h-4 ml-1 align-middle"
            style={{ background: 'var(--gold-bright)' }}
          />
        )}
      </p>
    </motion.div>
  );
}
