'use client';
import { useState } from 'react';

export function LifeInsightCard({ coverageDays }: { coverageDays: number }) {
  const [state, setState] = useState<{ summary: string; suggestions: string[] } | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function generate() { setLoading(true); setError(''); const response = await fetch('/api/life-insight', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ windowDays: 7 }) }); const body = await response.json(); setLoading(false); if (!response.ok) { setError(body.error ?? '暂时无法生成'); return; } setState(body.insight); }
  return <aside className="life-card insight-card"><div className="insight-orb">✦</div><div className="eyebrow">AI 状态摘要 · 最近 7 天</div><h2>{state?.summary ?? (coverageDays < 3 ? '再记录几天，我就能看见你的节奏。' : '你的状态正在形成一条可读的线。')}</h2><p>{state ? state.suggestions.map((item) => <span key={item} className="insight-suggestion">↳ {item}</span>) : '我会从睡眠、专注和能量的变化里，帮你找出值得保留的模式。'}</p>{error && <p>{error}</p>}<button className="insight-action" onClick={generate} disabled={loading}>{loading ? '分析中…' : '生成本周洞察 →'}</button><span className="insight-confidence">数据覆盖 {coverageDays} / 7 天 · 描述性分析</span></aside>;
}
