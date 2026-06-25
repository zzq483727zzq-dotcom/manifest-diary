import Link from "next/link";
import type { DailyAggregate } from "@/lib/supabase/history";

interface DayCellProps {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  aggregate?: DailyAggregate;
}

export function DayCell({
  date,
  dayNumber,
  isCurrentMonth,
  isToday,
  aggregate,
}: DayCellProps) {
  const total =
    (aggregate?.journalCount ?? 0) + (aggregate?.manifestCount ?? 0);
  const hasEntries = total > 0;

  const densityStyle = !hasEntries
    ? {}
    : total >= 4
      ? {
          background: "rgba(245, 215, 122, 0.22)",
          boxShadow:
            "inset 0 0 0 1px rgba(212, 175, 55, 0.55)",
        }
      : total >= 2
        ? {
            background: "rgba(212, 175, 55, 0.14)",
            boxShadow:
              "inset 0 0 0 1px rgba(212, 175, 55, 0.35)",
          }
        : {
            background: "rgba(212, 175, 55, 0.08)",
            boxShadow:
              "inset 0 0 0 1px rgba(212, 175, 55, 0.22)",
          };

  const inner = (
    <div
      className="relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-150"
      style={{
        ...densityStyle,
        color: isCurrentMonth
          ? "var(--text-primary)"
          : "var(--text-secondary)",
        opacity: hasEntries ? 1 : 0.5,
        ...(isToday ? { boxShadow: "0 0 0 2px var(--gold-bright)" } : {}),
        ...(hasEntries ? { cursor: "pointer" } : {}),
      }}
    >
      <span className="text-sm font-light">{dayNumber}</span>
      {hasEntries && (
        <div className="absolute bottom-1.5 flex gap-0.5">
          {(aggregate?.journalCount ?? 0) > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full border"
              style={{
                borderColor: "var(--gold-bright)",
                background: "transparent",
              }}
              title="复盘"
            />
          )}
          {(aggregate?.manifestCount ?? 0) > 0 && (
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "var(--gold-solid)" }}
            />
          )}
        </div>
      )}
    </div>
  );

  return hasEntries ? <Link href={`/history/${date}`}>{inner}</Link> : inner;
}