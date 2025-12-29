const { calcEMA, calcEMASeries, calcRSI, calcRSISeries, calcMACD, calcMACDSeries, calcBollingerBands, calcBollingerSeries, calcIndicators } = require('./setup');

describe('calcEMA', () => {
  test('returns null when data length < period', () => {
    expect(calcEMA([1, 2, 3], 9)).toBeNull();
    expect(calcEMA([], 5)).toBeNull();
  });

  test('EMA with exact period length equals SMA', () => {
    const closes = [10, 20, 30, 40, 50];
    expect(calcEMA(closes, 5)).toBe(30);
  });

  test('EMA period 9 on rising data', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = calcEMA(closes, 9);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(100);
  });

  test('EMA period 200', () => {
    const closes = Array.from({ length: 250 }, (_, i) => 40000 + i * 10);
    const result = calcEMA(closes, 200);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(40000);
  });
});

describe('calcEMASeries', () => {
  test('returns array of correct length', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const series = calcEMASeries(closes, 5);
    expect(series).toHaveLength(20);
    expect(series[3]).toBeNull();
    expect(series[4]).not.toBeNull();
  });
});

describe('calcRSI', () => {
  test('returns null for insufficient data', () => {
    expect(calcRSI([1, 2, 3], 14)).toBeNull();
  });

  test('returns 100 for all gains', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(calcRSI(closes, 14)).toBe(100);
  });

  test('returns low value for all losses', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    expect(calcRSI(closes, 14)).toBeLessThan(5);
  });

  test('mixed data returns value between 0 and 100', () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    const result = calcRSI(closes, 14);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });
});

describe('calcRSISeries', () => {
  test('returns array with nulls at start', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const series = calcRSISeries(closes, 14);
    expect(series.length).toBeGreaterThan(0);

    expect(series[0]).toBeNull();
    expect(series[13]).toBeNull();
    expect(series[14]).not.toBeNull();
  });
});

describe('calcMACD', () => {
  test('returns null for insufficient data', () => {
    expect(calcMACD(Array.from({ length: 20 }, (_, i) => 100 + i))).toBeNull();
  });

  test('calculates MACD with signal line for sufficient data', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i + Math.sin(i) * 5);
    const result = calcMACD(closes);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('histogram');
  });

  test('MACD positive for strong uptrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    expect(calcMACD(closes).macd).toBeGreaterThan(0);
  });

  test('MACD negative for strong downtrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    expect(calcMACD(closes).macd).toBeLessThan(0);
  });
});

describe('calcMACDSeries', () => {
  test('returns macdLine, signalLine, histogramLine', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = calcMACDSeries(closes);
    expect(result).toHaveProperty('macdLine');
    expect(result).toHaveProperty('signalLine');
    expect(result).toHaveProperty('histogramLine');
    expect(result.macdLine.length).toBe(50);
  });
});

describe('calcBollingerBands', () => {
  test('returns null for insufficient data', () => {
    expect(calcBollingerBands([1, 2, 3], 20)).toBeNull();
  });

  test('calculates bands correctly', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = calcBollingerBands(closes);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('upper');
    expect(result).toHaveProperty('middle');
    expect(result).toHaveProperty('lower');
    expect(result).toHaveProperty('bandwidth');
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  test('flat data has tight bands', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    const result = calcBollingerBands(closes);
    expect(result.upper).toBeCloseTo(100, 2);
    expect(result.lower).toBeCloseTo(100, 2);
    expect(result.bandwidth).toBeCloseTo(0, 2);
  });
});

describe('calcBollingerSeries', () => {
  test('returns upper, middle, lower arrays', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = calcBollingerSeries(closes);
    expect(result.upper.length).toBe(11);
    expect(result.middle.length).toBe(11);
    expect(result.lower.length).toBe(11);
  });
});

describe('calcIndicators', () => {
  test('handles empty klines', () => {
    const result = calcIndicators([]);
    expect(result.rsi14).toBeNull();
    expect(result.macd).toBeNull();
    expect(result.bollinger).toBeNull();
  });

  test('calculates all indicators with 250+ klines', () => {
    const klines = Array.from({ length: 250 }, (_, i) => [
      Date.now() - (250 - i) * 3600000,
      String(40000 + i * 10),
      String(40100 + i * 10),
      String(39900 + i * 10),
      String(40050 + i * 10),
      String(1000 + i),
    ]);
    const result = calcIndicators(klines);
    expect(result.rsi14).not.toBeNull();
    expect(result.ema9).not.toBeNull();
    expect(result.ema200).not.toBeNull();
    expect(result.macd).not.toBeNull();
    expect(result.bollinger).not.toBeNull();
    expect(result.bollinger).toHaveProperty('upper');
    expect(result.bollinger).toHaveProperty('middle');
    expect(result.bollinger).toHaveProperty('lower');
  });
});
