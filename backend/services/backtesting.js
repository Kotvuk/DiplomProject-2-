const db = require('../config/database');
const { analyzeBacktestResults, reasoningAnalysis } = require('../utils/groqKeys');

const BACKTEST_CONFIG = {
  defaultCapital: 5000,
  defaultPeriod: 90,
  feePercent: 0.1,
  slippagePercent: 0.05,
  maxPositions: 3,
  riskPerTrade: 2,
  defaultStrategies: ['ema_cross', 'rsi_reversal', 'macd_signal', 'bollinger_breakout', 'support_resistance']
};

async function loadHistoricalData(symbol, interval = '1h', days = 90) {
  var limit = calculateKlinesLimit(interval, days);

  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();

    const klines = data.map(k => ({
      timestamp: k[0],
      openTime: new Date(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: new Date(k[6]),
      quoteVolume: parseFloat(k[7]),
      trades: k[8]
    }));

    console.log(` Loaded ${klines.length} klines for ${symbol} ${interval} (${days} days)`);

    return klines;

  } catch (error) {
    console.error('Error loading historical data:', error.message);
    throw error;
  }
}

function calculateKlinesLimit(interval, days) {
  const minutesPerDay = 24 * 60;
  const intervalMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440
  };

  const minutes = intervalMinutes[interval] || 60;
  const klinesPerDay = minutesPerDay / minutes;
  return Math.min(Math.ceil(klinesPerDay * days), 1000);
}

function calculateIndicators(klines, params = {}) {
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);

  return {
    ema9: calculateEMA(closes, 9),
    ema21: calculateEMA(closes, 21),
    ema50: calculateEMA(closes, 50),
    ema200: calculateEMA(closes, 200),
    rsi14: calculateRSI(closes, 14),
    macd: calculateMACD(closes),
    bollinger: calculateBollinger(closes, 20, 2),
    atr14: calculateATR(klines, 14),
    supportResistance: findSupportResistance(highs, lows, closes)
  };
}

function calculateEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);

  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }

  return result;
}

function calculateRSI(closes, period = 14) {
  const result = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return new Array(period + 1).fill(null).concat(result);
}

function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine = [];
  const offset = 26 - 12;

  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signalLine = calculateEMA(macdLine, 9);

  const histogram = [];
  const signalOffset = macdLine.length - signalLine.length;

  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + signalOffset] - signalLine[i]);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

function calculateBollinger(closes, period = 20, stdDev = 2) {
  const result = { upper: [], middle: [], lower: [] };

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    result.middle.push(sma);
    result.upper.push(sma + stdDev * std);
    result.lower.push(sma - stdDev * std);
  }

  return result;
}

function calculateATR(klines, period = 14) {
  var trueRanges = [];

  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    var prevClose = klines[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  var atr = [];
  let atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr.push(atrValue);

  for (let i = period; i < trueRanges.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
    atr.push(atrValue);
  }

  return atr;
}

function findSupportResistance(highs, lows, closes) {
  const levels = [];
  const lookback = 20;

  for (let i = lookback; i < closes.length - lookback; i++) {
    const leftHighs = highs.slice(i - lookback, i);
    const rightHighs = highs.slice(i + 1, i + lookback + 1);
    const leftLows = lows.slice(i - lookback, i);
    const rightLows = lows.slice(i + 1, i + lookback + 1);

    if (highs[i] >= Math.max(...leftHighs) && highs[i] >= Math.max(...rightHighs)) {
      levels.push({ type: 'resistance', price: highs[i], index: i, strength: 1 });
    }

    if (lows[i] <= Math.min(...leftLows) && lows[i] <= Math.min(...rightLows)) {
      levels.push({ type: 'support', price: lows[i], index: i, strength: 1 });
    }
  }

  const clustered = clusterLevels(levels, closes.length);

  return clustered;
}

function clusterLevels(levels, totalBars) {
  const tolerance = 0.02;
  const clusters = [];

  for (const level of levels) {
    let found = false;

    for (const cluster of clusters) {
      if (Math.abs(cluster.price - level.price) / cluster.price < tolerance) {
        cluster.strength++;
        cluster.price = (cluster.price + level.price) / 2;
        found = true;
        break;
      }
    }

    if (!found) {
      clusters.push({ ...level });
    }
  }

  return clusters
    .filter(c => c.strength >= 2)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
}

const STRATEGIES = {

    ema_cross: {
    name: 'EMA Crossover',
    description: 'Быстрая EMA пересекает медленную EMA',
    params: { fastPeriod: 9, slowPeriod: 21 },

    generateSignals(klines, indicators, params = {}) {
      const signals = [];
      const fastEma = indicators.ema9;
      const slowEma = indicators.ema21;
      const atr = indicators.atr14;

      const offset = 21;

      for (let i = 2; i < fastEma.length; i++) {
        const prevFast = fastEma[i - 1];
        var prevSlow = slowEma[i - 1];
        const currFast = fastEma[i];
        const currSlow = slowEma[i];
        const atrValue = atr[i - offset + 14] || 0;

        if (prevFast <= prevSlow && currFast > currSlow) {
          signals.push({
            index: i,
            type: 'BUY',
            price: klines[i + offset - fastEma.length]?.close || klines[i].close,
            reason: 'EMA9 пересекла EMA21 снизу вверх',
            stopLoss: klines[i + offset - fastEma.length]?.close - atrValue * 2,
            takeProfit: klines[i + offset - fastEma.length]?.close + atrValue * 3
          });
        }

        if (prevFast >= prevSlow && currFast < currSlow) {
          signals.push({
            index: i,
            type: 'SELL',
            price: klines[i + offset - fastEma.length]?.close || klines[i].close,
            reason: 'EMA9 пересекла EMA21 сверху вниз',
            stopLoss: klines[i + offset - fastEma.length]?.close + atrValue * 2,
            takeProfit: klines[i + offset - fastEma.length]?.close - atrValue * 3
          });
        }
      }

      return signals;
    }
  },

    rsi_reversal: {
    name: 'RSI Reversal',
    description: 'RSI выходит из зон перекупленности/перепроданности',
    params: { period: 14, oversold: 30, overbought: 70 },

    generateSignals(klines, indicators, params = {}) {
      const signals = [];
      const rsi = indicators.rsi14;
      const oversold = params.oversold || 30;
      const overbought = params.overbought || 70;
      const atr = indicators.atr14;

      for (let i = 2; i < rsi.length; i++) {
        if (rsi[i] === null || rsi[i-1] === null) continue;

        const atrValue = atr[i - 14] || 0;

        if (rsi[i - 1] < oversold && rsi[i] >= oversold) {
          signals.push({
            index: i + 15,
            type: 'BUY',
            price: klines[i + 15]?.close,
            reason: `RSI (${rsi[i].toFixed(1)}) вышел из зоны перепроданности`,
            stopLoss: klines[i + 15]?.close - atrValue * 2,
            takeProfit: klines[i + 15]?.close + atrValue * 3,
            confidence: rsi[i] < 40 ? 80 : 60
          });
        }

        if (rsi[i - 1] > overbought && rsi[i] <= overbought) {
          signals.push({
            index: i + 15,
            type: 'SELL',
            price: klines[i + 15]?.close,
            reason: `RSI (${rsi[i].toFixed(1)}) вышел из зоны перекупленности`,
            stopLoss: klines[i + 15]?.close + atrValue * 2,
            takeProfit: klines[i + 15]?.close - atrValue * 3,
            confidence: rsi[i] > 60 ? 80 : 60
          });
        }
      }

      return signals;
    }
  },

    macd_signal: {
    name: 'MACD Signal',
    description: 'MACD пересекает сигнальную линию',
    params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },

    generateSignals(klines, indicators, params = {}) {
      const signals = [];
      const { macd, signal, histogram } = indicators.macd;
      const atr = indicators.atr14;

      for (let i = 1; i < histogram.length; i++) {
        const atrValue = atr[i + 8] || 0;
        const klineIndex = i + 34;

        if (histogram[i - 1] < 0 && histogram[i] >= 0) {
          signals.push({
            index: klineIndex,
            type: 'BUY',
            price: klines[klineIndex]?.close,
            reason: 'MACD пересёк сигнальную линию снизу вверх',
            stopLoss: klines[klineIndex]?.close - atrValue * 2,
            takeProfit: klines[klineIndex]?.close + atrValue * 3,
            confidence: macd[i] > 0 ? 75 : 65
          });
        }

        if (histogram[i - 1] > 0 && histogram[i] <= 0) {
          signals.push({
            index: klineIndex,
            type: 'SELL',
            price: klines[klineIndex]?.close,
            reason: 'MACD пересёк сигнальную линию сверху вниз',
            stopLoss: klines[klineIndex]?.close + atrValue * 2,
            takeProfit: klines[klineIndex]?.close - atrValue * 3,
            confidence: macd[i] < 0 ? 75 : 65
          });
        }
      }

      return signals;
    }
  },

    bollinger_breakout: {
    name: 'Bollinger Breakout',
    description: 'Пробой ценой полос Боллинджера',
    params: { period: 20, stdDev: 2 },

    generateSignals(klines, indicators, params = {}) {
      const signals = [];
      const { upper, middle, lower } = indicators.bollinger;
      const atr = indicators.atr14;

      const offset = 20;

      for (let i = 1; i < upper.length; i++) {
        const klineIndex = i + offset - 1;
        const close = klines[klineIndex]?.close;
        const atrValue = atr[klineIndex - 14] || 0;

        if (!close) continue;

        if (close > upper[i] && klines[klineIndex - 1]?.close <= upper[i - 1]) {
          signals.push({
            index: klineIndex,
            type: 'BUY',
            price: close,
            reason: `Пробой верхней полосы Боллинджера (${upper[i].toFixed(2)})`,
            stopLoss: middle[i],
            takeProfit: close + atrValue * 3,
            confidence: 70
          });
        }

        if (close < lower[i] && klines[klineIndex - 1]?.close >= lower[i - 1]) {
          signals.push({
            index: klineIndex,
            type: 'SELL',
            price: close,
            reason: `Пробой нижней полосы Боллинджера (${lower[i].toFixed(2)})`,
            stopLoss: middle[i],
            takeProfit: close - atrValue * 3,
            confidence: 70
          });
        }
      }

      return signals;
    }
  },

    support_resistance: {
    name: 'Support/Resistance',
    description: 'Отскок от уровней поддержки/сопротивления',
    params: { lookback: 20, tolerance: 0.02 },

    generateSignals(klines, indicators, params = {}) {
      const signals = [];
      const levels = indicators.supportResistance;
      const atr = indicators.atr14;
      const tolerance = params.tolerance || 0.02;

      for (let i = 50; i < klines.length; i++) {
        const close = klines[i].close;
        const low = klines[i].low;
        const high = klines[i].high;
        const atrValue = atr[i - 14] || 0;

        for (const level of levels) {
          const diff = Math.abs(close - level.price) / level.price;

          if (diff < tolerance) {

            if (level.type === 'support' && low <= level.price * 1.01) {
              signals.push({
                index: i,
                type: 'BUY',
                price: close,
                reason: `Отскок от поддержки $${level.price.toFixed(2)} (сила: ${level.strength})`,
                stopLoss: level.price * 0.98,
                takeProfit: close + atrValue * 3,
                confidence: 60 + level.strength * 5
              });
            }

            if (level.type === 'resistance' && high >= level.price * 0.99) {
              signals.push({
                index: i,
                type: 'SELL',
                price: close,
                reason: `Отскок от сопротивления $${level.price.toFixed(2)} (сила: ${level.strength})`,
                stopLoss: level.price * 1.02,
                takeProfit: close - atrValue * 3,
                confidence: 60 + level.strength * 5
              });
            }
          }
        }
      }

      return deduplicateSignals(signals);
    }
  }
};

function deduplicateSignals(signals, minGap = 5) {
  const result = [];
  const sorted = [...signals].sort((a, b) => a.index - b.index);

  for (const signal of sorted) {
    const lastSignal = result[result.length - 1];
    if (!lastSignal || signal.index - lastSignal.index >= minGap) {
      result.push(signal);
    }
  }

  return result;
}

async function runBacktest(options) {
  const {
    symbol = 'BTCUSDT',
    interval = '1h',
    days = 90,
    strategyName = 'ema_cross',
    capital = BACKTEST_CONFIG.defaultCapital,
    leverage = 1,
    riskPerTrade = BACKTEST_CONFIG.riskPerTrade,
    userId = null
  } = options;

  console.log(`
Starting backtest: ${strategyName} on ${symbol} ${interval} (${days} days)`);

  const klines = await loadHistoricalData(symbol, interval, days);

  const indicators = calculateIndicators(klines);

  const strategy = STRATEGIES[strategyName];
  if (!strategy) {
    throw new Error(`Unknown strategy: ${strategyName}`);
  }

  const signals = strategy.generateSignals(klines, indicators, options.params || {});
  console.log(` Generated ${signals.length} signals`);

  const trades = simulateTrades(klines, signals, {
    capital,
    leverage,
    riskPerTrade,
    feePercent: BACKTEST_CONFIG.feePercent,
    slippagePercent: BACKTEST_CONFIG.slippagePercent,
    maxPositions: BACKTEST_CONFIG.maxPositions
  });

  const metrics = calculateMetrics(trades, capital);

  const result = {
    id: `bt_${Date.now()}`,
    symbol,
    interval,
    days,
    strategy: strategyName,
    strategyName: strategy.name,
    capital,
    leverage,
    signalsCount: signals.length,
    tradesCount: trades.length,
    trades,
    metrics,
    klines: klines.slice(-100),
    indicators: {
      ema9: indicators.ema9.slice(-100),
      ema21: indicators.ema21.slice(-100),
      rsi14: indicators.rsi14.slice(-100)
    },
    createdAt: new Date().toISOString()
  };

  if (userId) {
    await saveBacktestResult(result, userId);
  }

  console.log(` Backtest complete: Win Rate ${metrics.winRate.toFixed(1)}%, ROI ${metrics.roi.toFixed(1)}%`);

  return result;
}

function simulateTrades(klines, signals, options) {
  const {
    capital,
    leverage,
    riskPerTrade,
    feePercent,
    slippagePercent,
    maxPositions
  } = options;

  const trades = [];
  let balance = capital;
  let equity = capital;
  let maxEquity = capital;
  let positions = [];
  let tradeId = 1;

  const sortedSignals = [...signals].sort((a, b) => a.index - b.index);

  for (const signal of sortedSignals) {

    if (positions.length >= maxPositions) continue;

    const entryPrice = signal.price * (1 + slippagePercent / 100);
    const direction = signal.type;

    const riskAmount = balance * (riskPerTrade / 100);
    const stopLoss = signal.stopLoss || (direction === 'BUY' ? entryPrice * 0.95 : entryPrice * 1.05);
    const takeProfit = signal.takeProfit || (direction === 'BUY' ? entryPrice * 1.05 : entryPrice * 0.95);

    const slDistance = Math.abs(entryPrice - stopLoss);
    const positionSize = slDistance > 0 ? riskAmount / slDistance : balance / entryPrice / 10;
    const positionValue = positionSize * entryPrice / leverage;

    if (positionValue > balance * 0.95) continue;

    const entryFee = positionValue * (feePercent / 100);
    balance -= positionValue + entryFee;

    const position = {
      id: tradeId++,
      direction,
      entryPrice,
      entryTime: klines[signal.index]?.openTime || new Date(),
      entryIndex: signal.index,
      size: positionSize,
      value: positionValue,
      stopLoss,
      takeProfit,
      reason: signal.reason,
      confidence: signal.confidence || 70
    };

    positions.push(position);

    for (let i = signal.index; i < klines.length; i++) {
      const candle = klines[i];
      let closed = false;
      let exitPrice = null;
      let exitReason = null;

      if (direction === 'BUY') {
        if (candle.low <= stopLoss) {
          exitPrice = stopLoss * (1 - slippagePercent / 100);
          exitReason = 'Stop Loss';
          closed = true;
        } else if (candle.high >= takeProfit) {
          exitPrice = takeProfit * (1 - slippagePercent / 100);
          exitReason = 'Take Profit';
          closed = true;
        }
      } else {
        if (candle.high >= stopLoss) {
          exitPrice = stopLoss * (1 + slippagePercent / 100);
          exitReason = 'Stop Loss';
          closed = true;
        } else if (candle.low <= takeProfit) {
          exitPrice = takeProfit * (1 + slippagePercent / 100);
          exitReason = 'Take Profit';
          closed = true;
        }
      }

      if (closed) {

        const pnl = direction === 'BUY'
          ? (exitPrice - entryPrice) * positionSize
          : (entryPrice - exitPrice) * positionSize;

        const exitFee = positionSize * exitPrice * (feePercent / 100);
        const netPnl = pnl - entryFee - exitFee;

        balance += positionValue + netPnl;
        equity = balance;
        maxEquity = Math.max(maxEquity, equity);

        trades.push({
          ...position,
          exitPrice,
          exitTime: candle.closeTime,
          exitIndex: i,
          exitReason,
          pnl,
          netPnl,
          fees: entryFee + exitFee,
          balance,
          equity,
          returnPct: (netPnl / positionValue) * 100
        });

        positions = positions.filter(p => p.id !== position.id);
        break;
      }
    }
  }

  for (const position of positions) {
    const lastCandle = klines[klines.length - 1];
    const exitPrice = lastCandle.close;
    const pnl = position.direction === 'BUY'
      ? (exitPrice - position.entryPrice) * position.size
      : (position.entryPrice - exitPrice) * position.size;

    const exitFee = position.size * exitPrice * (feePercent / 100);
    const netPnl = pnl - exitFee;

    balance += position.value + netPnl;

    trades.push({
      ...position,
      exitPrice,
      exitTime: lastCandle.closeTime,
      exitIndex: klines.length - 1,
      exitReason: 'End of Backtest',
      pnl,
      netPnl,
      fees: position.value * (feePercent / 100) + exitFee,
      balance,
      equity: balance,
      returnPct: (netPnl / position.value) * 100
    });
  }

  return trades;
}

function calculateMetrics(trades, initialCapital) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      roi: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      avgWin: 0,
      avgLoss: 0,
      avgReturn: 0,
      maxWin: 0,
      maxLoss: 0,
      avgHoldingTime: 0
    };
  }

  const wins = trades.filter(t => t.netPnl > 0);
  const losses = trades.filter(t => t.netPnl <= 0);

  const totalWins = wins.reduce((sum, t) => sum + t.netPnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0));

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  let maxEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const trade of trades) {
    maxEquity = Math.max(maxEquity, trade.equity);
    const drawdown = maxEquity - trade.equity;
    const drawdownPct = (drawdown / maxEquity) * 100;

    if (drawdownPct > maxDrawdownPct) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
    }
  }

  const returns = trades.map(t => t.returnPct);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  const holdingTimes = trades.map(t => {
    const entry = new Date(t.entryTime).getTime();
    const exit = new Date(t.exitTime).getTime();
    return (exit - entry) / (1000 * 60 * 60);
  });
  const avgHoldingTime = holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length;

  const finalBalance = trades[trades.length - 1]?.balance || initialCapital;

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: (wins.length / trades.length) * 100,
    roi: ((finalBalance - initialCapital) / initialCapital) * 100,
    profitFactor: Math.min(profitFactor, 99.99),
    maxDrawdown: maxDrawdownPct,
    sharpeRatio: sharpeRatio.toFixed(2),
    avgWin: wins.length > 0 ? totalWins / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
    avgReturn,
    maxWin: wins.length > 0 ? Math.max(...wins.map(t => t.netPnl)) : 0,
    maxLoss: losses.length > 0 ? Math.min(...losses.map(t => t.netPnl)) : 0,
    totalFees: trades.reduce((sum, t) => sum + t.fees, 0),
    avgHoldingTime: avgHoldingTime.toFixed(1),
    finalBalance,
    maxEquity,
    returns: returns.slice(-50)
  };
}

async function saveBacktestResult(result, userId) {
  try {
    await db.query(
      `INSERT INTO backtest_results
       (id, user_id, symbol, interval, days, strategy, strategy_name, capital, leverage,
        signals_count, trades_count, metrics, trades, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
        metrics = EXCLUDED.metrics,
        trades = EXCLUDED.trades`,
      [
        result.id,
        userId,
        result.symbol,
        result.interval,
        result.days,
        result.strategy,
        result.strategyName,
        result.capital,
        result.leverage,
        result.signalsCount,
        result.tradesCount,
        JSON.stringify(result.metrics),
        JSON.stringify(result.trades)
      ]
    );

    console.log(` Backtest result saved: ${result.id}`);

  } catch (error) {
    console.error('Error saving backtest result:', error.message);
  }
}

async function getBacktestHistory(userId, limit = 20) {
  const results = await db.getMany(
    `SELECT id, symbol, interval, days, strategy, strategy_name, capital, leverage,
            signals_count, trades_count, metrics, created_at
     FROM backtest_results
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return results.map(r => ({
    ...r,
    metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics || '{}') : (r.metrics || {})
  }));
}

async function getAIBacktestAnalysis(result) {
  try {
    const analysis = await analyzeBacktestResults({
      strategy: result.strategyName,
      symbol: result.symbol,
      interval: result.interval,
      period: `${result.days} days`,
      metrics: result.metrics,
      sampleTrades: result.trades.slice(0, 10)
    });

    return analysis?.choices?.[0]?.message?.content || null;

  } catch (error) {
    console.error('AI analysis error:', error.message);
    return null;
  }
}

async function optimizeStrategy(strategyName, symbol, interval, days, paramRanges) {
  const results = [];
  const baseParams = STRATEGIES[strategyName]?.params || {};

  const combinations = generateParamCombinations(paramRanges || baseParams);

  console.log(` Optimizing ${strategyName}: ${combinations.length} combinations`);

  for (const params of combinations.slice(0, 20)) {
    try {
      const result = await runBacktest({
        symbol,
        interval,
        days,
        strategyName,
        params
      });

      results.push({
        params,
        winRate: result.metrics.winRate,
        roi: result.metrics.roi,
        profitFactor: result.metrics.profitFactor,
        sharpeRatio: result.metrics.sharpeRatio
      });

    } catch (error) {
      console.error('Optimization error:', error.message);
    }
  }

  results.sort((a, b) => parseFloat(b.sharpeRatio) - parseFloat(a.sharpeRatio));

  return {
    bestParams: results[0]?.params,
    bestResult: results[0],
    allResults: results
  };
}

function generateParamCombinations(ranges) {
  const combinations = [{}];

  for (const [key, values] of Object.entries(ranges)) {
    if (!Array.isArray(values)) continue;

    const newCombinations = [];
    for (const combo of combinations) {
      for (const value of values) {
        newCombinations.push({ ...combo, [key]: value });
      }
    }
    combinations.length = 0;
    combinations.push(...newCombinations);
  }

  return combinations;
}

module.exports = {

  BACKTEST_CONFIG,
  STRATEGIES,

  runBacktest,
  loadHistoricalData,
  calculateIndicators,
  simulateTrades,
  calculateMetrics,

  saveBacktestResult,
  getBacktestHistory,

  getAIBacktestAnalysis,

  optimizeStrategy,

  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollinger,
  calculateATR,
  findSupportResistance
};
