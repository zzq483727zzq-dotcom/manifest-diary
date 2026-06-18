import type { DayDetail } from "@/lib/supabase/history";

interface ReflectionStructured {
  highlights?: Array<{ fact: string; why_it_counts: string }>;
  cognitive_bugs?: Array<{ user_quote: string; reframe: string }>;
  tomorrow_script?: Array<{ step: number; action: string; duration_minutes: number }>;
}

interface DayDetailViewProps { detail: DayDetail; }

const CATEGORY_LABELS: Record<string, string> = {
  self: "🌱 自我", relationship: "💞 关系", career: "🎯 事业",
  health: "🌿 身心", abundance: "✨ 丰盛", other: "🌙 其他",
};

export function DayDetailView({ detail }: DayDetailViewProps) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const hasContent = detail.journalEntries.length > 0 || detail.manifestEntries.length > 0;

  return (
    <div className="space-y-8">
      {!hasContent && <p className="text-center py-12" style={{ color: "var(--text-secondary)" }}>这一天没有留下文字。</p>}

      {detail.journalEntries.map((j) => {
        const struct = (j.ai_structured ?? {}) as ReflectionStructured;
        return (
          <article key={j.id} className="space-y-4 p-5 md:p-6 rounded-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <header className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>🌙 复盘 · {formatTime(j.created_at)}</span>
            </header>
            <div className="space-y-1 text-sm italic" style={{ color: "var(--text-secondary)" }}>
              <p>{j.raw_input}</p>
            </div>
            {j.ai_response && (
              <div className="p-4 rounded-xl" style={{ background: "#fefce8", color: "#1e293b" }}>
                <p className="text-sm leading-relaxed">{j.ai_response}</p>
              </div>
            )}
            {struct.highlights && struct.highlights.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "#c9a96e" }}>✨ 今日高光</h3>
                <ul className="space-y-2">
                  {struct.highlights.map((h, i) => (
                    <li key={i} className="text-sm" style={{ color: "var(--text-primary)" }}>
                      <strong>{h.fact}</strong>
                      <span className="block mt-0.5" style={{ color: "var(--text-secondary)" }}>{h.why_it_counts}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {struct.cognitive_bugs && struct.cognitive_bugs.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "#d4956a" }}>🔍 心理 Bug</h3>
                <ul className="space-y-3">
                  {struct.cognitive_bugs.map((b, i) => (
                    <li key={i} className="text-sm">
                      <p className="italic" style={{ color: "var(--text-secondary)" }}>「{b.user_quote}」</p>
                      <p className="mt-1" style={{ color: "var(--text-primary)" }}>{b.reframe}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {struct.tomorrow_script && struct.tomorrow_script.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "#7d9d7c" }}>📋 明日脚本</h3>
                <ol className="space-y-1.5">
                  {struct.tomorrow_script.map((s) => (
                    <li key={s.step} className="text-sm flex gap-3" style={{ color: "var(--text-primary)" }}>
                      <span className="font-mono" style={{ color: "#7d9d7c" }}>{s.step}.</span>
                      <span>{s.action}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>· {s.duration_minutes}min</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>
        );
      })}

      {detail.manifestEntries.map((m) => (
        <article key={m.id} className="space-y-3 p-5 md:p-6 rounded-2xl" style={{ background: "rgba(49,46,129,0.2)", border: "1px solid rgba(244,114,182,0.3)" }}>
          <header className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{CATEGORY_LABELS[m.category] ?? m.category} · {formatTime(m.created_at)}</span>
          </header>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{m.intention}</p>
          {m.ai_echo && (
            <p className="text-sm leading-relaxed italic border-l-2 pl-3" style={{ color: "#fbcfe8", borderColor: "rgba(244,114,182,0.4)" }}>
              {m.ai_echo}
            </p>
          )}
          {m.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {m.keywords.map((k, i) => (
                <span key={i} className="px-2.5 py-0.5 text-xs rounded-full" style={{ background: "rgba(244,114,182,0.15)", color: "#fbcfe8" }}>
                  {k}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}