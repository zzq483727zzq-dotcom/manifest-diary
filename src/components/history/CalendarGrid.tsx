"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DayCell } from "./DayCell";
import type { DailyAggregate } from "@/lib/supabase/history";

interface CalendarGridProps {
  year: number;
  month: number;
  aggregates: Record<string, DailyAggregate>;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const pad = (n: number) => String(n).padStart(2, "0");

export function CalendarGrid({
  year,
  month,
  aggregates,
}: CalendarGridProps) {
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const lastDay = new Date(year, month, 0).getDate();
    const out: Array<{
      date: string;
      day: number;
      isCurrentMonth: boolean;
    }> = [];

    if (offset > 0) {
      const prevLastDay = new Date(year, month - 1, 0).getDate();
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      for (let i = offset - 1; i >= 0; i--) {
        const d = prevLastDay - i;
        out.push({
          date: `${prevYear}-${pad(prevMonth)}-${pad(d)}`,
          day: d,
          isCurrentMonth: false,
        });
      }
    }
    for (let d = 1; d <= lastDay; d++) {
      out.push({
        date: `${year}-${pad(month)}-${pad(d)}`,
        day: d,
        isCurrentMonth: true,
      });
    }
    while (out.length % 7 !== 0) {
      const idx = out.length - lastDay - offset + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      out.push({
        date: `${nextYear}-${pad(nextMonth)}-${pad(idx)}`,
        day: idx,
        isCurrentMonth: false,
      });
    }
    return out;
  }, [year, month]);

  const prevMonth =
    month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth =
    month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          href={`/history?year=${prevMonth.y}&month=${prevMonth.m}`}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors ceremonial-tap"
          style={{
            color: "var(--text-secondary)",
            background: "var(--bg-card-glow)",
            border: "1px solid var(--border-soft)",
          }}
        >
          ← {prevMonth.y}年{prevMonth.m}月
        </Link>
        <h2
          className="text-lg font-light"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-serif)",
            letterSpacing: "0.06em",
          }}
        >
          {year} · {month}月
        </h2>
        <Link
          href={`/history?year=${nextMonth.y}&month=${nextMonth.m}`}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors ceremonial-tap"
          style={{
            color: "var(--text-secondary)",
            background: "var(--bg-card-glow)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {nextMonth.y}年{nextMonth.m}月 →
        </Link>
      </header>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs pb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <DayCell
            key={cell.date}
            date={cell.date}
            dayNumber={cell.day}
            isCurrentMonth={cell.isCurrentMonth}
            isToday={cell.date === todayIso}
            aggregate={aggregates[cell.date]}
          />
        ))}
      </div>

      <div
        className="flex gap-4 text-xs justify-center pt-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full border"
            style={{
              borderColor: "var(--gold-bright)",
              background: "transparent",
            }}
          />{" "}
          复盘
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--gold-solid)" }}
          />{" "}
          显化
        </span>
      </div>
    </div>
  );
}