import { formatAmount, formatPercent } from './format';

describe('formatAmount', () => {
  it('加上千分位且不顯示小數', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount(0)).toBe('0');
  });

  it('四捨五入到整數', () => {
    expect(formatAmount(1234.56)).toBe('1,235');
  });

  it('負數保留負號', () => {
    expect(formatAmount(-40000)).toBe('-40,000');
  });
});

describe('formatPercent', () => {
  it('顯示到小數兩位', () => {
    expect(formatPercent(0.19353321)).toBe('19.35%');
    expect(formatPercent(0.1)).toBe('10.00%');
  });

  it('全損顯示 -100.00%', () => {
    expect(formatPercent(-1)).toBe('-100.00%');
  });

  it('千分位也適用於大數', () => {
    expect(formatPercent(36.78343)).toBe('3,678.34%');
  });

  it('超過夾制閾值時改印上限', () => {
    expect(formatPercent(7.515336e109)).toBe('> 100,000,000%');
    expect(formatPercent(2e6)).toBe('> 100,000,000%');
  });

  it('恰在閾值上不夾制', () => {
    expect(formatPercent(1e6)).toBe('100,000,000.00%');
  });
});
