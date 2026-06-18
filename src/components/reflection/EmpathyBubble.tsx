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
      className="glow-border relative p-5 rounded-3xl"
      style={{
        backgroundColor: 'var(--bg-card-glow)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {text}
        {isStreaming && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-2 h-4 ml-1 align-middle"
            style={{ background: 'var(--accent)' }}
          />
        )}
      </p>
    </motion.div>
  );
}
