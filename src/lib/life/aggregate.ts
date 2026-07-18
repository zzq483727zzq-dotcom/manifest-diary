import type { DashboardSummary, DailyTrendPoint, LifeLog } from '@/types/life';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateRange(today: string, days: number): string[] {
  const end = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) => new Date(end - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10));
}

function minutes(log: LifeLog): number {
  if (log.unit === 'hours' && log.value != null) return log.value * 60;
  if (log.value != null) return log.value;
  if (log.start_at && log.end_at) return Math.max(0, (Date.parse(log.end_at) - Date.parse(log.start_at)) / 60000);
  return 0;
}

export function buildDashboardSummary(logs: LifeLog[], today: string): DashboardSummary {
  const dates = dateRange(today, 7);
  const trend: DailyTrendPoint[] = dates.map((date) => {
    const dayLogs = logs.filter((log) => log.entry_date === date);
    const sleeps = dayLogs.filter((log) => log.type === 'sleep').map((log) => log.unit === 'minutes' ? (log.value ?? 0) / 60 : minutes(log) / 60);
    const focus = dayLogs.filter((log) => log.type === 'focus').reduce((sum, log) => sum + minutes(log), 0);
    const moods = dayLogs.filter((log) => log.type === 'mood').sort((a, b) => a.created_at.localeCompare(b.created_at));
    const recorded = new Set(dayLogs.map((log) => log.type));
    return {
      date,
      label: date.slice(5).replace('-', '/'),
      sleepHours: sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
      focusMinutes: focus || null,
      energy: moods.length ? moods[moods.length - 1].value : null,
      recorded: recorded.size,
    };
  });
  const current = trend[trend.length - 1];
  let streak = 0;
  for (let i = trend.length - 1; i >= 0 && trend[i].recorded > 0; i -= 1) streak += 1;
  return {
    today: { sleepHours: current.sleepHours, focusMinutes: current.focusMinutes, energy: current.energy, completionRate: current.recorded / 4 },
    trend,
    achievements: {
      recordingStreak: streak,
      focusHours: Math.round((trend.reduce((sum, point) => sum + (point.focusMinutes ?? 0), 0) / 60) * 10) / 10,
      recordedDays: trend.filter((point) => point.recorded > 0).length,
    },
    coverageDays: trend.filter((point) => point.recorded > 0).length,
  };
}
