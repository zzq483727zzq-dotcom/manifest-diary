export function computeEntryDate(now: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;

  const y = parseInt(get('year'));
  const m = parseInt(get('month'));
  const d = parseInt(get('day'));
  const h = parseInt(get('hour'));

  if (h < 5) {
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().split('T')[0];
  }
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function computeScheduledFor(entryDate: string): string {
  const [y, m, d] = entryDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split('T')[0];
}

export function formatDateZh(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export const APP_TIMEZONE = 'Asia/Shanghai';