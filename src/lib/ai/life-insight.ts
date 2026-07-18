import type { DashboardSummary } from '@/types/life';

export interface LifeInsight { summary: string; suggestions: [string, string]; confidence: 'low' | 'medium' | 'high'; }

export function buildLifeInsightInput(summary: DashboardSummary, windowDays: number) {
  return { windowDays, coverageDays: summary.coverageDays, today: summary.today, trend: summary.trend.map(({ date, sleepHours, focusMinutes, energy, recorded }) => ({ date, sleepHours, focusMinutes, energy, recorded })) };
}

export function fallbackLifeInsight(summary: DashboardSummary): LifeInsight {
  if (summary.coverageDays < 3) return { summary: '现在还在收集你的生活样本。先从一个最容易坚持的记录开始。', suggestions: ['今晚记下睡眠时长', '明天完成一次 25 分钟专注'], confidence: 'low' };
  return { summary: summary.achievements.focusHours > 3 ? '这周你已经为重要的事留出了稳定的注意力。继续保持轻量、连续的节奏。' : '你的记录正在变得清晰，下一步可以优先守住一段不被打扰的专注时间。', suggestions: ['固定一个最容易开始的专注时段', '睡前用一句话记录今天的能量'], confidence: 'medium' };
}

export function parseLifeInsight(value: unknown, fallback: LifeInsight): LifeInsight {
  if (!value || typeof value !== 'object') return fallback;
  const item = value as Record<string, unknown>; const suggestions = item.suggestions;
  if (typeof item.summary !== 'string' || !Array.isArray(suggestions) || suggestions.length < 2) return fallback;
  const summary = item.summary.slice(0, 180); const clean = suggestions.slice(0, 2).map((suggestion) => String(suggestion).slice(0, 120)) as [string, string];
  if (/诊断|治愈|一定是|因果/.test(summary + clean.join(''))) return fallback;
  return { summary, suggestions: clean, confidence: item.confidence === 'high' ? 'high' : item.confidence === 'medium' ? 'medium' : 'low' };
}
