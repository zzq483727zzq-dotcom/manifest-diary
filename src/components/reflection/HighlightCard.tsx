'use client';

import { motion } from 'framer-motion';
import type { Highlight } from '@/lib/ai/parse-response';

interface HighlightCardProps {
  highlights: Highlight[];
  index?: number;
}

export function HighlightCard({ highlights, index = 0 }: HighlightCardProps) {
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
      <h3
        className="text-meta mb-3 text-gold"
        style={{ letterSpacing: '0.2em' }}
      >
        ✦ 今日高光
      </h3>
      {highlights.length === 0 ? (
        <p
          className="font-ai text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          今天能撑过来本身就是一种高光。
        </p>
      ) : (
        <ul className="space-y-3">
          {highlights.map((h, i) => (
            <li key={i}>
              <p
                className="font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {h.fact}
              </p>
              <p
                className="text-sm mt-1.5 font-ai"
                style={{
                  color: 'var(--text-secondary)',
                  opacity: 0.82,
                }}
              >
                {h.why_it_counts}
              </p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
