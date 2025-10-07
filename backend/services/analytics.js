const db = require('../config/database');

async function getPnLHistory(userId, period = 'month', limit = 12) {
  const periodFormats = {
    day: "DATE(closed_at)",
    week: "DATE_TRUNC('week', closed_at)",
    month: "DATE_TRUNC('month', closed_at)",
    year: "DATE_TRUNC('year', closed_at)"
  };

  var dateFormat = periodFormats[period] || periodFormats.month;

  const query = `
    SELECT
      ${dateFormat} as period,
      SUM(pnl) as total_pnl,
      COUNT(*) as trades_count,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
      AVG(pnl) as avg_pnl,
      MAX(pnl) as best_trade,
      MIN(pnl) as worst_trade,
      SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
      SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END) as gross_loss
    FROM trades
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND (user_id = $1 OR user_id IS NULL)
    GROUP BY ${dateFormat}
    ORDER BY period DESC
    LIMIT $2
  `;

  const result = await db.getMany(query, [userId, limit]);

  let cumulative = 0;
  const cumulativePnL = result.reverse().map(row => {
    cumulative += parseFloat(row.total_pnl || 0);
    return {
      ...row,
      cumulative_pnl: cumulative,
      win_rate: row.trades_count > 0
        ? ((parseFloat(row.wins) / parseFloat(row.trades_count)) * 100).toFixed(2)
        : 0,
      profit_factor: parseFloat(row.gross_loss) !== 0
        ? (Math.abs(parseFloat(row.gross_profit)) / Math.abs(parseFloat(row.gross_loss))).toFixed(2)
        : '∞'
    };
  });

  return cumulativePnL;
}

async function getDailyPnL(userId, days = 30) {
  const query = `
    SELECT
      DATE(closed_at) as date,
      SUM(pnl) as daily_pnl,
      COUNT(*) as trades
    FROM trades
    WHERE status = 'closed'
      AND closed_at >= CURRENT_DATE - INTERVAL '${days} days'
      AND (user_id = $1 OR user_id IS NULL)
    GROUP BY DATE(closed_at)
    ORDER BY date ASC
  `;

  const result = await db.getMany(query, [userId]);

  const filled = [];
  const resultMap = new Map(result.map(r => [r.date, r]));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const data = resultMap.get(dateStr);

    filled.push({
      date: dateStr,
      daily_pnl: data ? parseFloat(data.daily_pnl) : 0,
      trades: data ? parseInt(data.trades) : 0
    });
  }

  return filled;
}

async function calculateVaR(userId, confidence = 0.95) {

  const query = `
    SELECT
      DATE(closed_at) as date,
      SUM(pnl) as daily_pnl
    FROM trades
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND (user_id = $1 OR user_id IS NULL)
    GROUP BY DATE(closed_at)
    ORDER BY date DESC
    LIMIT 252
  `;

  const result = await db.getMany(query, [userId]);

  if (result.length < 5) {
    return { var: 0, method: 'insufficient_data', message: 'Need at least 5 trading days' };
  }

  const returns = result.map(r => parseFloat(r.daily_pnl)).sort((a, b) => a - b);

  const index = Math.floor((1 - confidence) * returns.length);
  const varValue = Math.abs(returns[index]);

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  const zScore = confidence === 0.99 ? 2.33 : 1.645;
  const parametricVar = zScore * stdDev;

  return {
    historical_var: varValue.toFixed(2),
    parametric_var: parametricVar.toFixed(2),
    confidence: confidence * 100,
    mean_return: mean.toFixed(2),
    std_deviation: stdDev.toFixed(2),
    trading_days: returns.length,
    worst_day: Math.min(...returns).toFixed(2),
    best_day: Math.max(...returns).toFixed(2)
  };
}

async function calculateSharpeRatio(userId, riskFreeRate = 0.04) {
  var query = `
    SELECT
      DATE(closed_at) as date,
      SUM(pnl) as daily_pnl
    FROM trades
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND (user_id = $1 OR user_id IS NULL)
    GROUP BY DATE(closed_at)
    ORDER BY date ASC
  `;

  const result = await db.getMany(query, [userId]);

  if (result.length < 10) {
    return { sharpe_ratio: 0, message: 'Need at least 10 trading days' };
  }

  const returns = result.map(r => parseFloat(r.daily_pnl));
  const meanDaily = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanDaily, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  const annualReturn = meanDaily * 252;
  const annualStdDev = stdDev * Math.sqrt(252);
  const dailyRiskFree = riskFreeRate / 252;

  const sharpe = (annualReturn - riskFreeRate) / annualStdDev;

  const negativeReturns = returns.filter(r => r < 0);
  const downsideDev = Math.sqrt(
    negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / negativeReturns.length
  ) * Math.sqrt(252);

  var sortino = downsideDev > 0
    ? (annualReturn - riskFreeRate) / downsideDev
    : 0;

  const cumulative = [];
  let sum = 0;
  returns.forEach(r => {
    sum += r;
    cumulative.push(sum);
  });

  let maxDrawdown = 0;
  let peak = cumulative[0];
  for (const value of cumulative) {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const calmar = maxDrawdown > 0 ? annualReturn / (maxDrawdown * 100) : 0;

  return {
    sharpe_ratio: isFinite(sharpe) ? sharpe.toFixed(3) : 'N/A',
    sortino_ratio: isFinite(sortino) ? sortino.toFixed(3) : 'N/A',
    calmar_ratio: isFinite(calmar) ? calmar.toFixed(3) : 'N/A',
    annual_return: annualReturn.toFixed(2),
    annual_volatility: (annualStdDev).toFixed(2),
    max_drawdown: (maxDrawdown * 100).toFixed(2),
    trading_days: returns.length,
    interpretation: sharpe > 1 ? 'Good' : sharpe > 0.5 ? 'Acceptable' : 'Poor'
  };
}

async function calculateMaxDrawdown(userId) {
  const query = `
    SELECT
      closed_at,
      pnl,
      SUM(pnl) OVER (ORDER BY closed_at) as cumulative_pnl
    FROM trades
    WHERE status = 'closed'
      AND closed_at IS NOT NULL
      AND (user_id = $1 OR user_id IS NULL)
    ORDER BY closed_at ASC
  `;

  var result = await db.getMany(query, [userId]);

  if (result.length === 0) {
    return { max_drawdown: 0, max_drawdown_pct: 0 };
  }

  let peak = parseFloat(result[0].cumulative_pnl);
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let peakDate = result[0].closed_at;
  let troughDate = result[0].closed_at;
  let currentPeakDate = result[0].closed_at;

  const drawdowns = [];

  for (const row of result) {
    var cumPnl = parseFloat(row.cumulative_pnl);

    if (cumPnl > peak) {
      peak = cumPnl;
      currentPeakDate = row.closed_at;
    }

    const drawdown = peak - cumPnl;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;

    drawdowns.push({
      date: row.closed_at,
      cumulative_pnl: cumPnl,
      drawdown: drawdown,
      drawdown_pct: drawdownPct
    });

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
      peakDate = currentPeakDate;
      troughDate = row.closed_at;
    }
  }

  const lastDrawdown = drawdowns[drawdowns.length - 1];
  const isRecovered = lastDrawdown.drawdown === 0;

  return {
    max_drawdown: maxDrawdown.toFixed(2),
    max_drawdown_pct: maxDrawdownPct.toFixed(2),
    peak_date: peakDate,
    trough_date: troughDate,
    is_recovered: isRecovered,
    current_drawdown: lastDrawdown.drawdown.toFixed(2),
    drawdown_history: drawdowns.slice(-30)
  };
}

async function getCorrelationMatrix(userId) {

  const query = `
    SELECT
      pair,
      DATE(closed_at) as date,
      SUM(pnl) as daily_pnl
    FROM trades
    WHERE status = 'closed'
      AND closed_at >= CURRENT_DATE - INTERVAL '90 days'
      AND (user_id = $1 OR user_id IS NULL)
    GROUP BY pair, DATE(closed_at)
    ORDER BY pair, date
  `;

  const result = await db.getMany(query, [userId]);

  if (result.length === 0) {
    return { pairs: [], matrix: [] };
  }

  const pairData = {};
  for (const row of result) {
    if (!pairData[row.pair]) {
      pairData[row.pair] = [];
    }
    pairData[row.pair].push({
      date: row.date,
      pnl: parseFloat(row.daily_pnl)
    });
  }

  const pairs = Object.keys(pairData);

  if (pairs.length < 2) {
    return { pairs, matrix: [[1]], message: 'Need at least 2 pairs for correlation' };
  }

  const matrix = [];

  for (let i = 0; i < pairs.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < pairs.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const corr = calculateCorrelation(pairData[pairs[i]], pairData[pairs[j]]);
        matrix[i][j] = isNaN(corr) ? 0 : corr;
      }
    }
  }

  return {
    pairs,
    matrix,
    period: '90 days',
    interpretation: interpretCorrelation(matrix, pairs)
  };
}

function calculateCorrelation(data1, data2) {

  const map1 = new Map(data1.map(d => [d.date, d.pnl]));
  const map2 = new Map(data2.map(d => [d.date, d.pnl]));

  const commonDates = [...map1.keys()].filter(d => map2.has(d));

  if (commonDates.length < 5) return 0;

  const x = commonDates.map(d => map1.get(d));
  const y = commonDates.map(d => map2.get(d));

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

function interpretCorrelation(matrix, pairs) {
  const interpretations = [];

  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const corr = matrix[i][j];
      let strength;

      if (Math.abs(corr) > 0.7) strength = 'Strong';
      else if (Math.abs(corr) > 0.4) strength = 'Moderate';
      else if (Math.abs(corr) > 0.2) strength = 'Weak';
      else strength = 'Very weak';

      interpretations.push({
        pair1: pairs[i],
        pair2: pairs[j],
        correlation: corr.toFixed(3),
        direction: corr > 0 ? 'Positive' : 'Negative',
        strength
      });
    }
  }

  return interpretations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

async function getPerformanceAttribution(userId) {
  const baseQuery = `
    SELECT
      pair,
      direction,
      EXTRACT(HOUR FROM opened_at) as hour,
      EXTRACT(DOW FROM opened_at) as day_of_week,
      pnl,
      entry_amount,
      closed_at - opened_at as duration
    FROM trades
    WHERE status = 'closed'
      AND (user_id = $1 OR user_id IS NULL)
  `;

  const trades = await db.getMany(baseQuery, [userId]);

  if (trades.length === 0) {
    return { message: 'No closed trades found' };
  }

  const byPair = groupAndAnalyze(trades, 'pair');

  const byDirection = groupAndAnalyze(trades, 'direction');

  const byHour = groupAndAnalyze(trades, 'hour');

  const byDayOfWeek = groupAndAnalyze(trades, 'day_of_week');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  byDayOfWeek.labels = byDayOfWeek.labels.map(d => dayNames[parseInt(d)] || d);

  const durationAnalysis = analyzeDuration(trades);

  const sizeAnalysis = analyzeBySize(trades);

  return {
    by_pair: byPair,
    by_direction: byDirection,
    by_hour: byHour,
    by_day_of_week: byDayOfWeek,
    duration_analysis: durationAnalysis,
    size_analysis: sizeAnalysis,
    total_trades: trades.length,
    total_pnl: trades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0).toFixed(2)
  };
}

function groupAndAnalyze(trades, field) {
  const groups = {};

  for (const trade of trades) {
    const key = trade[field];
    if (!groups[key]) {
      groups[key] = { pnl: [], wins: 0, total: 0 };
    }
    groups[key].pnl.push(parseFloat(trade.pnl || 0));
    groups[key].total++;
    if (parseFloat(trade.pnl || 0) > 0) groups[key].wins++;
  }

  const labels = Object.keys(groups);
  const pnl = labels.map(k => groups[k].pnl.reduce((a, b) => a + b, 0));
  const winRates = labels.map(k => (groups[k].wins / groups[k].total * 100).toFixed(1));
  const counts = labels.map(k => groups[k].total);
  const avgPnl = labels.map(k => {
    const arr = groups[k].pnl;
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
  });

  return {
    labels,
    total_pnl: pnl.map(p => p.toFixed(2)),
    win_rates: winRates,
    counts,
    avg_pnl: avgPnl,
    best: labels[pnl.indexOf(Math.max(...pnl))],
    worst: labels[pnl.indexOf(Math.min(...pnl))]
  };
}

function analyzeDuration(trades) {
  const bins = {
    '< 1h': { pnl: [], count: 0 },
    '1-4h': { pnl: [], count: 0 },
    '4-24h': { pnl: [], count: 0 },
    '1-7d': { pnl: [], count: 0 },
    '> 7d': { pnl: [], count: 0 }
  };

  for (const trade of trades) {
    if (!trade.duration) continue;

    const hours = parseIntervalToHours(trade.duration);
    const pnl = parseFloat(trade.pnl || 0);

    if (hours < 1) { bins['< 1h'].pnl.push(pnl); bins['< 1h'].count++; }
    else if (hours < 4) { bins['1-4h'].pnl.push(pnl); bins['1-4h'].count++; }
    else if (hours < 24) { bins['4-24h'].pnl.push(pnl); bins['4-24h'].count++; }
    else if (hours < 168) { bins['1-7d'].pnl.push(pnl); bins['1-7d'].count++; }
    else { bins['> 7d'].pnl.push(pnl); bins['> 7d'].count++; }
  }

  return {
    labels: Object.keys(bins),
    total_pnl: Object.values(bins).map(b => b.pnl.reduce((a, c) => a + c, 0).toFixed(2)),
    counts: Object.values(bins).map(b => b.count),
    win_rates: Object.values(bins).map(b => {
      const wins = b.pnl.filter(p => p > 0).length;
      return b.count > 0 ? ((wins / b.count) * 100).toFixed(1) : 0;
    })
  };
}

function parseIntervalToHours(interval) {
  if (!interval) return 0;

  if (typeof interval === 'object') {
    return (interval.days || 0) * 24 + (interval.hours || 0) + (interval.minutes || 0) / 60;
  }

  const match = interval.match(/(\d+)\s*days?\s*(\d+)?/i);
  if (match) {
    return parseInt(match[1]) * 24 + (parseInt(match[2]) || 0);
  }

  return 0;
}

function analyzeBySize(trades) {
  const sizes = trades.map(t => parseFloat(t.entry_amount || 0)).filter(s => s > 0);

  if (sizes.length === 0) return { message: 'No size data available' };

  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

  const bins = {
    'Small (< avg)': { pnl: [], count: 0 },
    'Large (> avg)': { pnl: [], count: 0 }
  };

  for (const trade of trades) {
    const size = parseFloat(trade.entry_amount || 0);
    const pnl = parseFloat(trade.pnl || 0);

    if (size < avgSize) {
      bins['Small (< avg)'].pnl.push(pnl);
      bins['Small (< avg)'].count++;
    } else {
      bins['Large (> avg)'].pnl.push(pnl);
      bins['Large (> avg)'].count++;
    }
  }

  return {
    average_size: avgSize.toFixed(2),
    labels: Object.keys(bins),
    total_pnl: Object.values(bins).map(b => b.pnl.reduce((a, c) => a + c, 0).toFixed(2)),
    counts: Object.values(bins).map(b => b.count),
    win_rates: Object.values(bins).map(b => {
      const wins = b.pnl.filter(p => p > 0).length;
      return b.count > 0 ? ((wins / b.count) * 100).toFixed(1) : 0;
    })
  };
}

module.exports = {

  getPnLHistory,
  getDailyPnL,

  calculateVaR,
  calculateSharpeRatio,
  calculateMaxDrawdown,

  getCorrelationMatrix,

  getPerformanceAttribution
};
