'use client';

import { motion } from 'framer-motion';
import type { CognitiveBug } from '@/lib/ai/parse-response';

interface BugCardProps {
  bugs: CognitiveBug[];
  index?: number;
}

export function BugCard({ bugs, index = 0 }: BugCardProps) {
  if (bugs.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="rounded-3xl p-6 glow-border"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-meta mb-3 text-gold" style={{ letterSpacing: '0.2em' }}>
        🔍 心理 Bug 诊断
      </h3>
      <ul className="space-y-4">
        {bugs.map((b, i) => (
          <li key={i}>
            <p
              className="font-ai text-sm italic"
              style={{ color: 'var(--text-secondary)', opacity: 0.85 }}
            >
              「{b.user_quote}」
            </p>
            <p className="mt-2" style={{ color: 'var(--text-primary)' }}>
              {b.reframe}
            </p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
