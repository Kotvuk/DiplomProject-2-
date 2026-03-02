function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return +ema.toFixed(6);
}

function calcEMASeries(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const series = new Array(period - 1).fill(null);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  series.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    series.push(ema);
  }
  return series;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function calcRSISeries(closes, period = 14) {
  if (closes.length < period + 1) return [];
  const series = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  series.push(+(100 - 100 / (1 + rs0)).toFixed(2));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    series.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }
  return series;
}

function calcMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema12 = calcEMASeries(closes, fastPeriod);
  const ema26 = calcEMASeries(closes, slowPeriod);

  if (ema12.length === 0 || ema26.length === 0) return null;

  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(+(ema12[i] - ema26[i]).toFixed(6));
    } else {
      macdLine.push(null);
    }
  }

  const validMacd = macdLine.filter(v => v !== null);
  if (validMacd.length < signalPeriod) {
    return { macd: validMacd[validMacd.length - 1] || 0, signal: 0, histogram: validMacd[validMacd.length - 1] || 0 };
  }

  const k = 2 / (signalPeriod + 1);
  let signal = validMacd.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
  for (let i = signalPeriod; i < validMacd.length; i++) {
    signal = validMacd[i] * k + signal * (1 - k);
  }

  const lastMacd = validMacd[validMacd.length - 1];
  const histogram = +(lastMacd - signal).toFixed(6);

  return { macd: +lastMacd.toFixed(6), signal: +signal.toFixed(6), histogram };
}

function calcMACDSeries(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema12 = calcEMASeries(closes, fastPeriod);
  const ema26 = calcEMASeries(closes, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(+(ema12[i] - ema26[i]).toFixed(6));
    } else {
      macdLine.push(null);
    }
  }

  const validIndices = [];
  const validValues = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      validIndices.push(i);
      validValues.push(macdLine[i]);
    }
  }

  const signalLine = new Array(closes.length).fill(null);
  const histogramLine = new Array(closes.length).fill(null);

  if (validValues.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sig = validValues.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
    signalLine[validIndices[signalPeriod - 1]] = +sig.toFixed(6);
    histogramLine[validIndices[signalPeriod - 1]] = +(validValues[signalPeriod - 1] - sig).toFixed(6);

    for (let i = signalPeriod; i < validValues.length; i++) {
      sig = validValues[i] * k + sig * (1 - k);
      signalLine[validIndices[i]] = +sig.toFixed(6);
      histogramLine[validIndices[i]] = +(validValues[i] - sig).toFixed(6);
    }
  }

  return { macdLine, signalLine, histogramLine };
}

function calcBollingerBands(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const avg = slice.reduce((s, v) => s + v, 0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
  return {
    upper: +(avg + multiplier * std).toFixed(6),
    middle: +avg.toFixed(6),
    lower: +(avg - multiplier * std).toFixed(6),
    bandwidth: +((2 * multiplier * std / avg) * 100).toFixed(4)
  };
}

function calcBollingerSeries(closes, period = 20, multiplier = 2) {
  const upper = [], middle = [], lower = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, v) => s + v, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
    upper.push({ index: i, value: +(avg + multiplier * std).toFixed(6) });
    middle.push({ index: i, value: +avg.toFixed(6) });
    lower.push({ index: i, value: +(avg - multiplier * std).toFixed(6) });
  }
  return { upper, middle, lower };
}

function calcIndicators(klines) {
  const closes = klines.map(k => +k[4]);
  return {
    rsi14: calcRSI(closes, 14),
    ema9: calcEMA(closes, 9),
    ema21: calcEMA(closes, 21),
    ema50: calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    macd: calcMACD(closes),
    bollinger: calcBollingerBands(closes),
    lastClose: closes[closes.length - 1]
  };
}

module.exports = {
  calcEMA, calcEMASeries,
  calcRSI, calcRSISeries,
  calcMACD, calcMACDSeries,
  calcBollingerBands, calcBollingerSeries,
  calcIndicators
};
