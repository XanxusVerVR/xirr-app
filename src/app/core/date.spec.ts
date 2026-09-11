import { isValidDateString, toEpochDay } from './date';

describe('toEpochDay', () => {
  it('紀元日為 0', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
  });

  it('不受本地時區影響', () => {
    expect(toEpochDay('2024-01-01')).toBe(19723);
  });

  it('相差整年為 365 或 366 天', () => {
    expect(toEpochDay('2024-12-31') - toEpochDay('2024-01-01')).toBe(365);
    expect(toEpochDay('2025-01-01') - toEpochDay('2024-01-01')).toBe(366);
  });
});

describe('isValidDateString', () => {
  it('接受合法日期', () => {
    expect(isValidDateString('2024-01-01')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
  });

  it('拒絕空字串與格式錯誤', () => {
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('2024-1-1')).toBe(false);
    expect(isValidDateString('2024/01/01')).toBe(false);
  });

  it('拒絕不存在的日期', () => {
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('2024-13-01')).toBe(false);
    expect(isValidDateString('2024-04-31')).toBe(false);
  });
});
