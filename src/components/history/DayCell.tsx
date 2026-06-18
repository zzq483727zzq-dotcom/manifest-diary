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
          background: "rgba(244, 114, 182, 0.25)",
          boxShadow:
            "inset 0 0 0 1px rgba(244, 114, 182, 0.5)",
        }
      : total >= 2
        ? {
            background: "rgba(244, 114, 182, 0.15)",
            boxShadow:
              "inset 0 0 0 1px rgba(244, 114, 182, 0.3)",
          }
        : {
            background: "rgba(244, 114, 182, 0.08)",
            boxShadow:
              "inset 0 0 0 1px rgba(244, 114, 182, 0.2)",
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
        ...(isToday ? { boxShadow: "0 0 0 2px #fbbf24" } : {}),
        ...(hasEntries ? { cursor: "pointer" } : {}),
      }}
    >
      <span className="text-sm font-light">{dayNumber}</span>
      {hasEntries && (
        <div className="absolute bottom-1.5 flex gap-0.5">
          {(aggregate?.journalCount ?? 0) > 0 && (
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "#fbbf24" }}
            />
          )}
          {(aggregate?.manifestCount ?? 0) > 0 && (
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "#f472b6" }}
            />
          )}
        </div>
      )}
    </div>
  );

  return hasEntries ? <Link href={`/history/${date}`}>{inner}</Link> : inner;
}