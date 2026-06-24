"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SearchBarProps { initialQuery?: string; }

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/history/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索复盘和显化里的字句…"
        style={{
          width: "100%",
          padding: "10px 48px 10px 16px",
          borderRadius: 9999,
          background: "var(--bg-card-glow)",
          border: "1px solid var(--border-soft)",
          color: "var(--text-primary)",
          fontSize: 14,
          outline: "none",
          transition: "border-color 0.3s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--gold-bright)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-soft)"; }}
      />
      <button
        type="submit"
        disabled={!query.trim()}
        className="ceremonial-tap"
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          padding: "4px 14px",
          borderRadius: 9999,
          fontSize: 12,
          border: "none",
          cursor: query.trim() ? "pointer" : "not-allowed",
          background: "var(--gold-gradient)",
          color: "#1a120b",
          opacity: query.trim() ? 1 : 0.3,
          fontWeight: 500,
        }}
      >
        搜
      </button>
    </form>
  );
}