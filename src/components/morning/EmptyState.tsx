'use client';

import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="text-center py-12 space-y-4">
      <p style={{ color: 'var(--text-secondary)' }}>
        昨晚没写复盘，今天没有为你准备的脚本。
      </p>
      <Link
        href="/reflect"
        className="inline-block px-6 py-3 rounded-full font-medium"
        style={{ background: 'var(--accent-rose-gold)', color: '#1a1a2e' }}
      >
        ✨ 现在写一段
      </Link>
    </div>
  );
}