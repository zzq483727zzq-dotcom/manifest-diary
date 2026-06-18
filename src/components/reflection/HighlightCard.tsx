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
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#c9a96e' }}>
        ✦ 今日高光
      </h3>
      {highlights.length === 0 ? (
        <p className="text-sm" style={{ color: '#9b8b75' }}>
          今天能撑过来本身就是一种高光。
        </p>
      ) : (
        <ul className="space-y-3">
          {highlights.map((h, i) => (
            <li key={i}>
              <p className="font-medium">{h.fact}</p>
              <p className="text-sm mt-1" style={{ color: '#9b8b75' }}>
                {h.why_it_counts}
              </p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
