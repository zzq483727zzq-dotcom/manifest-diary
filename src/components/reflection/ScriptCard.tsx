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
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: '#5d4e37',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 className="text-xs tracking-widest uppercase mb-3" style={{ color: '#7d9d7c' }}>
        📋 明早无脑脚本
      </h3>
      <ol className="space-y-3">
        {localSteps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: '#7d9d7c', color: 'white' }}
            >
              {s.step}
            </span>
            {readOnly ? (
              <span className="flex-1 leading-relaxed">{s.action}</span>
            ) : (
              <input
                type="text"
                value={s.action}
                onChange={(e) => updateAction(i, e.target.value)}
                className="flex-1 bg-transparent border-b focus:outline-none focus:border-b-2 leading-relaxed"
                style={{ borderColor: 'rgba(125,157,124,0.3)', color: '#5d4e37' }}
              />
            )}
            <span className="text-xs" style={{ color: '#9b8b75' }}>
              {s.duration_minutes}分钟
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
