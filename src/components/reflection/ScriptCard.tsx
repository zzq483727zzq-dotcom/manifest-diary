'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { TomorrowStep } from '@/lib/ai/parse-response';

interface ScriptCardProps {
  steps: TomorrowStep[];
  index?: number;
  onChange?: (steps: TomorrowStep[]) => void;
  readOnly?: boolean;
}

export function ScriptCard({ steps, index = 0, onChange, readOnly }: ScriptCardProps) {
  const [localSteps, setLocalSteps] = useState(steps);

  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const updateAction = (idx: number, value: string) => {
    const next = localSteps.map((s, i) => (i === idx ? { ...s, action: value } : s));
    setLocalSteps(next);
    onChange?.(next);
  };

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
        📋 明早无脑脚本
      </h3>
      <ol className="space-y-3">
        {localSteps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                background: 'var(--gold-gradient)',
                color: '#1a120b',
              }}
            >
              {s.step}
            </span>
            {readOnly ? (
              <span
                className="flex-1 leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {s.action}
              </span>
            ) : (
              <input
                type="text"
                value={s.action}
                onChange={(e) => updateAction(i, e.target.value)}
                className="flex-1 bg-transparent border-b focus:outline-none leading-relaxed py-0.5"
                style={{
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold-solid)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
              />
            )}
            <span
              className="text-xs flex-shrink-0"
              style={{ color: 'var(--text-secondary)', opacity: 0.7 }}
            >
              {s.duration_minutes} 分钟
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
