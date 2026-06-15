"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
      } else {
        window.location.href = "/";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("注册成功！请检查邮箱确认链接。");
      }
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-xl font-light text-center mb-2">
          {isLogin ? "欢迎回来 ✨" : "开始你的显化之旅"}
        </h2>

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-4 py-3 rounded-lg bg-white/10 border border-white/20
                     placeholder:text-white/40 text-white focus:outline-none
                     focus:border-amber-400/50 transition-colors"
        />

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="px-4 py-3 rounded-lg bg-white/10 border border-white/20
                     placeholder:text-white/40 text-white focus:outline-none
                     focus:border-amber-400/50 transition-colors"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-3 rounded-lg bg-gradient-to-r from-amber-400 to-pink-400
                     text-slate-900 font-medium hover:opacity-90 transition-opacity
                     disabled:opacity-50"
        >
          {loading ? "..." : isLogin ? "登录" : "注册"}
        </button>

        {message && (
          <p className="text-sm text-center text-amber-300">{message}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage(null);
          }}
          className="text-sm text-white/50 hover:text-white/70 transition-colors text-center"
        >
          {isLogin ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </form>
    </div>
  );
}
