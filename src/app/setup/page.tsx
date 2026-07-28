'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/local-auth/setup', {
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
        <div className="auth-brand">Clarity</div>
        <h1>先设置一个本地密码</h1>
        <p>密码只保存在这台设备上，用于保护你的项目与任务数据。</p>
        <form onSubmit={submit}>
          <label className="auth-label">
            本地密码
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoFocus
            />
          </label>
          <button type="submit">创建工作台</button>
        </form>
        {error ? <small>{error}</small> : null}
      </div>
    </main>
  );
}
