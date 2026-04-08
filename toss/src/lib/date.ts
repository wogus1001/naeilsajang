const DAY_MS = 24 * 60 * 60 * 1000;

export function getTodayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDateKey(dateKey: string, diffDays: number): string {
  const next = parseDateKey(dateKey);
  next.setDate(next.getDate() + diffDays);
  return getTodayKey(next);
}

export function isWithinRecentDays(dateKey: string, days: number): boolean {
  const today = parseDateKey(getTodayKey()).getTime();
  const target = parseDateKey(dateKey).getTime();
  const diff = Math.floor((today - target) / DAY_MS);
  return diff >= 0 && diff < days;
}

export function formatDisplayDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(parseDateKey(dateKey));
}

export function formatDisplayTime(isoString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

export function formatLongToday(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
}
