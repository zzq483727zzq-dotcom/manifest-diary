'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface ScriptStepRowProps {
  scriptId: string;
  stepIdx: number;
  step: number;
  action: string;
  durationMin: number;
  initiallyDone: boolean;
}

export function ScriptStepRow({
  scriptId,
  stepIdx,
  step,
  action,
  durationMin,
  initiallyDone,
}: ScriptStepRowProps) {
  const [done, setDone] = useState(initiallyDone);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    const next = !done;
    setDone(next);
    setPending(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/steps/${stepIdx}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: next }),
      });
      if (!res.ok) {
        setDone(!next);
      }
    } catch {
      setDone(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.button
      onClick={toggle}
      disabled={pending}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-opacity"
      style={{
        backgroundColor: 'var(--bg-card)',
        opacity: done ? 0.5 : 1,
        boxShadow: 'var(--shadow-soft)',
        color: '#5d4e37',
      }}
    >
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all"
        style={{
          background: done ? '#7d9d7c' : 'transparent',
          color: done ? 'white' : '#7d9d7c',
          borderColor: '#7d9d7c',
          borderWidth: 2,
        }}
      >
        {done ? '✓' : step}
      </span>
      <span className={`flex-1 ${done ? 'line-through' : ''}`}>{action}</span>
      <span className="text-xs" style={{ color: '#9b8b75' }}>
        {durationMin} 分钟
      </span>
    </motion.button>
  );
}