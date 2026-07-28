'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UnlockPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/local-auth/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    router.push('/');
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">CLARITY · 个人项目执行系统</div>
        <h1>欢迎回来</h1>
        <p>输入本地密码，继续推进你的项目。</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="本地密码"
            autoFocus
          />
          <button type="submit">解锁</button>
        </form>
        {error ? <small>{error}</small> : null}
      </div>
    </main>
  );
}
