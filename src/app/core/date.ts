const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' → 距 1970-01-01 的天數。一律走 UTC，不碰本地時區 */
export function toEpochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** 格式須為 'YYYY-MM-DD'，且該日期真實存在（擋掉 2025-02-29、2024-04-31） */
export function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d
  );
}
