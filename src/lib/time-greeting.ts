/**
 * 四档时间系统：白天复盘不再强行变黑。
 *  06:00–11:00 → morning   晨间花园
 *  11:00–18:00 → day       白天柔和花园
 *  18:00–21:00 → evening   黄昏过渡
 *  21:00–06:00 → night     深夜暖光
 */
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

export function getGreeting(now: Date = new Date()): string {
  switch (getTimeOfDay(now)) {
    case 'morning':
      return '早安';
    case 'day':
      return '午后好';
    case 'evening':
      return '黄昏好';
    case 'night':
      return '夜深了';
  }
}

/**
 * 将四档时间映射到实际主题。
 * evening（18–21）归入 garden，与 autoTheme「06:00–21:00 garden」保持一致；
 * 深夜 21:00–06:00 归入 night。
 */
export function themeForTime(t: TimeOfDay): 'garden' | 'night' {
  return t === 'night' ? 'night' : 'garden';
}
