export type LifeLogType = 'sleep' | 'focus' | 'mood' | 'exercise' | 'journal' | 'manifest';
export type LifeLogUnit = 'minutes' | 'hours' | 'score';

export interface LifeLog {
  id: string;
  user_id: string;
  entry_date: string;
  type: LifeLogType;
  start_at: string | null;
  end_at: string | null;
  value: number | null;
  unit: LifeLogUnit | null;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  sleepHours: number | null;
  focusMinutes: number | null;
  energy: number | null;
  recorded: number;
}

export interface TodayMetrics {
  sleepHours: number | null;
  focusMinutes: number | null;
  energy: number | null;
  completionRate: number;
}

export interface AchievementSummary {
  recordingStreak: number;
  focusHours: number;
  recordedDays: number;
}

export interface DashboardSummary {
  today: TodayMetrics;
  trend: DailyTrendPoint[];
  achievements: AchievementSummary;
  coverageDays: number;
}
