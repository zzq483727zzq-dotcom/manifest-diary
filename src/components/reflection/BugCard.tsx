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
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#d4956a' }}>
        🔍 心理 Bug 诊断
      </h3>
      <ul className="space-y-4">
        {bugs.map((b, i) => (
          <li key={i}>
            <p className="text-sm italic" style={{ color: '#9b8b75' }}>
              「{b.user_quote}」
            </p>
            <p className="mt-2">{b.reframe}</p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
