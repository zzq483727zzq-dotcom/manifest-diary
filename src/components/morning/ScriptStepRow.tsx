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
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: done ? 0.45 : 1,
        y: 0,
      }}
      transition={{ duration: 0.4, delay: stepIdx * 0.08 }}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left"
      style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: done ? 'none' : 'var(--shadow-soft)',
        color: 'var(--text-primary)',
        border: done ? '1px solid var(--border-soft)' : '1px solid var(--gold-soft)',
      }}
    >
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all"
        style={{
          background: done ? 'var(--gold-gradient)' : 'transparent',
          color: done ? '#0c1024' : 'var(--gold-bright)',
          border: '1.5px solid var(--gold-solid)',
        }}
      >
        {done ? '✓' : step}
      </span>
      <span className={`flex-1 ${done ? 'line-through' : ''}`} style={{ opacity: done ? 0.6 : 1 }}>
        {action}
      </span>
      <span className="text-xs text-meta">
        {durationMin} 分钟
      </span>
    </motion.button>
  );
}
