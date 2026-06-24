'use client';

import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="text-center py-16 space-y-6 animate-fade-in">
      <div
        className="mx-auto w-16 h-16 rounded-full flex items-center justify-center breathe"
        style={{
          background: 'var(--gold-soft)',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        <span style={{ fontSize: '1.8rem' }}>🌙</span>
      </div>
      <div className="space-y-2">
        <p
          className="font-serif text-lg"
          style={{ color: 'var(--text-primary)' }}
        >
          今夜还没写下什么
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          把今天倒在这里，它替你接着
        </p>
      </div>
      <Link
        href="/reflect"
        className="inline-block px-7 py-3 rounded-full font-medium ceremonial-tap glow-border"
        style={{
          background: 'var(--gold-gradient)',
          color: '#1a1208',
          boxShadow: '0 0 20px rgba(212,175,55,0.35)',
        }}
      >
        ✨ 现在写一段
      </Link>
    </div>
  );
}