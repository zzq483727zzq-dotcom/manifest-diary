'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LifeLogType } from '@/types/life';

const options: Array<[LifeLogType, string]> = [['sleep', '睡眠'], ['focus', '专注'], ['mood', '能量'], ['exercise', '运动'], ['journal', '日记']];

export function QuickLogSheet() {
  const [open, setOpen] = useState(false); const [type, setType] = useState<LifeLogType>('focus'); const [value, setValue] = useState(''); const [content, setContent] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); const response = await fetch('/api/life-logs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, value: value || null, content: content || null }) }); const body = await response.json(); setSaving(false); if (!response.ok) { setError(body.error ?? '保存失败'); return; } setOpen(false); setValue(''); setContent(''); router.refresh(); }
  return <><button className="quick-log-button" onClick={() => setOpen(true)}><span>＋</span> 快速记录</button>{open && <div className="sheet-backdrop" onMouseDown={() => setOpen(false)}><section className="quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-log-title" onMouseDown={(event) => event.stopPropagation()}><button className="sheet-close" onClick={() => setOpen(false)} aria-label="关闭">×</button><div className="eyebrow">现在，给自己留一分钟</div><h2 id="quick-log-title">记录一件刚刚发生的事</h2><div className="log-types">{options.map(([key, label]) => <button key={key} className={type === key ? 'selected' : ''} onClick={() => setType(key)}>{label}</button>)}</div><form onSubmit={submit}><label>{type === 'journal' ? '写下此刻' : type === 'mood' ? '能量评分（1–5）' : type === 'sleep' ? '睡眠时长（小时）' : type === 'focus' ? '专注时长（分钟）' : '运动时长（分钟）'}<input autoFocus type={type === 'journal' ? 'text' : 'number'} min={type === 'mood' ? 1 : 0} max={type === 'mood' ? 5 : undefined} value={type === 'journal' ? content : value} onChange={(event) => type === 'journal' ? setContent(event.target.value) : setValue(event.target.value)} placeholder={type === 'journal' ? '一句话也可以' : '0'} /></label>{error && <p className="form-error">{error}</p>}<button className="sheet-submit" disabled={saving}>{saving ? '保存中…' : '保存记录'}</button></form></section></div>}</>;
}
