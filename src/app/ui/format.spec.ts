import { formatAmount, formatPercent } from './format';

describe('formatAmount', () => {
  it('整數加上千分位且不顯示小數', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount(0)).toBe('0');
  });

  it('有小數時顯示到小數第 2 位', () => {
    // 以 USDT 之類的幣別計價時，捨入到整數會失真
    expect(formatAmount(1234.56)).toBe('1,234.56');
    expect(formatAmount(-1200.75)).toBe('-1,200.75');
  });

  it('小數位不足時補零', () => {
    expect(formatAmount(7500.5)).toBe('7,500.50');
  });

  it('超過兩位小數則四捨五入', () => {
    expect(formatAmount(1234.567)).toBe('1,234.57');
  });

  it('浮點運算殘值不會被誤判為有小數', () => {
    // 9800.6 + 1200.75 - 7500.75 之類的算式會留下尾數
    expect(formatAmount(3500.6000000000004)).toBe('3,500.60');
    expect(formatAmount(100.00000000000001)).toBe('100');
  });

  it('負零與近零負值顯示為 0，不顯示 -0', () => {
    expect(formatAmount(-0)).toBe('0');
    expect(formatAmount(-0.004)).toBe('0');
  });

  it('負數保留負號', () => {
    expect(formatAmount(-40000)).toBe('-40,000');
  });

  it('四個彙總數字在有小數時仍能自洽', () => {
    // 舊的整數捨入會讓這組數字在畫面上差 1
    const invested = 1.4;
    const withdrawn = 1.5;
    const position = 1.5;
    const ret = position + withdrawn - invested;

    const n = (s: string) => Number(s.replace(/,/g, ''));
    expect(n(formatAmount(ret))).toBeCloseTo(
      n(formatAmount(position)) + n(formatAmount(withdrawn)) - n(formatAmount(invested)),
      9,
    );
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
