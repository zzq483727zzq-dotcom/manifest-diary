'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase/browser';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = '/';
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(error.message);
      else setMessage('注册成功，请检查邮箱确认链接');
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm mx-auto animate-fade-in">
      {/* 品牌标题区 */}
      <div className="text-center mb-12">
        <div
          className="font-serif text-xs tracking-[0.4em] mb-3 text-gold"
          style={{ fontWeight: 500 }}
        >
          ✦ MANIFEST
        </div>
        <h1
          className="font-serif text-2xl font-light"
          style={{ color: 'var(--text-primary)', letterSpacing: '0.08em' }}
        >
          {isLogin ? '欢迎回来' : '开始你的显化之旅'}
        </h1>
        <p
          className="mt-3 text-xs"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}
        >
          {isLogin ? '让我们继续记录你的内在' : '愿这里成为你内心的回响'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* 邮箱：纯下划线输入 */}
        <div>
          <label
            className="block text-[10px] tracking-[0.25em] mb-2"
            style={{
              color: emailFocused ? 'var(--gold-bright)' : 'var(--text-secondary)',
              transition: 'color 0.3s',
            }}
          >
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            required
            autoComplete="email"
            className="w-full bg-transparent outline-none pb-2"
            style={{
              color: 'var(--text-primary)',
              borderBottom: `1px solid ${emailFocused ? 'var(--gold-solid)' : 'var(--border-soft)'}`,
              transition: 'border-color 0.3s',
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
            }}
          />
        </div>

        <div>
          <label
            className="block text-[10px] tracking-[0.25em] mb-2"
            style={{
              color: pwdFocused ? 'var(--gold-bright)' : 'var(--text-secondary)',
              transition: 'color 0.3s',
            }}
          >
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPwdFocused(true)}
            onBlur={() => setPwdFocused(false)}
            required
            minLength={6}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            className="w-full bg-transparent outline-none pb-2"
            style={{
              color: 'var(--text-primary)',
              borderBottom: `1px solid ${pwdFocused ? 'var(--gold-solid)' : 'var(--border-soft)'}`,
              transition: 'border-color 0.3s',
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
            }}
          />
        </div>

        {/* 金色仪式按钮 */}
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ y: -1.5 }}
          whileTap={{ scale: 0.97 }}
          className="ceremonial-tap relative w-full py-3.5 mt-2 rounded-full font-serif"
          style={{
            background: 'var(--gold-gradient)',
            color: '#1a120b',
            letterSpacing: '0.4em',
            fontSize: '0.9rem',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading
              ? 'none'
              : '0 0 24px rgba(212,175,55,0.25), 0 4px 14px rgba(212,175,55,0.15)',
            transition: 'box-shadow 0.3s, opacity 0.3s',
          }}
        >
          {loading ? '...' : isLogin ? '进 入' : '开 始'}
        </motion.button>

        {/* 错误/成功消息 */}
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs"
            style={{ color: 'var(--gold-bright)', letterSpacing: '0.05em' }}
          >
            {message}
          </motion.p>
        )}

        {/* 切换登录/注册 */}
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage(null);
          }}
          className="mx-auto text-xs hover:opacity-80 transition-opacity"
          style={{
            color: 'var(--text-secondary)',
            letterSpacing: '0.15em',
          }}
        >
          {isLogin ? '还没有账号？  注 册' : '已有账号？  登 录'}
        </button>
      </form>

      {/* 底部诗意小字 */}
      <p
        className="mt-16 text-center text-[10px] font-serif italic"
        style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em', opacity: 0.6 }}
      >
        在这里，每一句都会被温柔接住
      </p>
    </div>
  );
}
