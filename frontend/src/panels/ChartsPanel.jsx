import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createChart } from 'lightweight-charts';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
const TIMEFRAMES = ['1m','5m','15m','1h','4h','1d','1w'];
const CHART_TYPE_IDS = ['Candlestick', 'Line', 'Bars'];
const CHART_TYPE_KEYS = { Candlestick: 'candles', Line: 'line', Bars: 'bars' };

const DRAWING_TOOLS = [
  { id: 'hline', icon: '━', label: 'horizontalLine' },
  { id: 'trendline', icon: '╱', label: 'trendLine' },
  { id: 'fib', icon: '🔢', label: 'fibonacci' },
];

const INDICATORS = [
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'bb', label: 'bollingerBands' },
  { id: 'ema20', label: 'EMA 20' },
  { id: 'ema50', label: 'EMA 50' },
  { id: 'ema200', label: 'EMA 200' },
];

const DEFAULT_TOOL_STYLES = { color: '#3b82f6', lineWidth: 2, dashStyle: 'solid' };

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 16, marginBottom: 12 },
  btn: (active) => ({
    padding: '6px 14px', borderRadius: 6, border: '1px solid ' + (active ? theme.accent : theme.border),
    background: active ? theme.accent + '33' : 'transparent', color: active ? theme.accent : theme.textSecondary,
    cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 500, transition: 'all 0.15s'
  }),
  sel: { background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: "'Inter',sans-serif" },
  toolsSidebar: {
    width: 48, background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12,
    display: 'flex', flexDirection: 'column', gap: 4, padding: 6, alignItems: 'center',
  },
  toolBtn: (active) => ({
    width: 36, height: 36, borderRadius: 8, border: '1px solid ' + (active ? theme.accent : 'transparent'),
    background: active ? theme.accent + '33' : 'transparent', color: active ? theme.accent : theme.textSecondary,
    cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  }),
  indicatorDropdown: {
    position: 'absolute', top: '100%', left: 0, zIndex: 20, background: theme.cardBg,
    border: '1px solid ' + theme.border, borderRadius: 8, padding: 8, minWidth: 200,
    boxShadow: theme.shadow,
  },
  indicatorItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, color: active ? theme.accent : theme.text,
    background: active ? theme.accent + '1A' : 'transparent', transition: 'all 0.15s',
  }),
  fullscreenBtn: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid ' + theme.border,
    background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: 16,
    transition: 'all 0.15s',
  },
  colorPicker: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid ' + theme.border, cursor: 'pointer',
    padding: 0, overflow: 'hidden',
  },
  styleSelect: {
    background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border,
    borderRadius: 6, padding: '4px 8px', fontSize: 12,
  },
});

function computeEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [];
  let prev = data[0]?.close || 0;
  for (const d of data) {
    prev = d.close * k + prev * (1 - k);
    ema.push({ time: d.time, value: prev });
  }
  return ema;
}

function computeRSI(data, period = 14) {
  const rsi = [];
  let gains = 0, losses = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (i <= period) {
      if (diff > 0) gains += diff; else losses -= diff;
      if (i === period) {
        gains /= period; losses /= period;
        const rs = losses === 0 ? 100 : gains / losses;
        rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
      }
    } else {
      gains = (gains * (period - 1) + (diff > 0 ? diff : 0)) / period;
      losses = (losses * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
    }
  }
  return rsi;
}

function computeBB(data, period = 20, mult = 2) {
  const upper = [], lower = [], mid = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, d) => s + d.close, 0) / period;
    const std = Math.sqrt(slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period);
    mid.push({ time: data[i].time, value: avg });
    upper.push({ time: data[i].time, value: avg + mult * std });
    lower.push({ time: data[i].time, value: avg - mult * std });
  }
  return { upper, lower, mid };
}

function computeMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);

  const emaCalc = (arr, period) => {
    const k = 2 / (period + 1);
    const result = [];
    let prev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = 0; i < arr.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      if (i === period - 1) { result.push(prev); continue; }
      prev = arr[i] * k + prev * (1 - k);
      result.push(prev);
    }
    return result;
  };

  const ema12 = emaCalc(closes, fastPeriod);
  const ema26 = emaCalc(closes, slowPeriod);

  const macdLine = [];
  const macdValues = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      const v = ema12[i] - ema26[i];
      macdLine.push({ time: times[i], value: v });
      macdValues.push(v);
    }
  }

  const signalLine = [];
  if (macdValues.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sig = macdValues.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
    for (let i = 0; i < macdValues.length; i++) {
      if (i < signalPeriod - 1) continue;
      if (i === signalPeriod - 1) { signalLine.push({ time: macdLine[i].time, value: sig }); continue; }
      sig = macdValues[i] * k + sig * (1 - k);
      signalLine.push({ time: macdLine[i].time, value: sig });
    }
  }

  const histogram = [];
  const signalMap = {};
  signalLine.forEach(s => { signalMap[s.time] = s.value; });
  macdLine.forEach(m => {
    const sig = signalMap[m.time];
    if (sig !== undefined) {
      const val = m.value - sig;
      histogram.push({ time: m.time, value: val, color: val >= 0 ? '#22c55e88' : '#ef444488' });
    }
  });

  return { macdLine, signalLine, histogram };
}

export default function ChartsPanel() {
  const { t } = useLang();
  const { theme } = useTheme();

  const [pair, setPair] = useState(() => localStorage.getItem('charts_pair') || 'BTCUSDT');
  const [tf, setTf] = useState(() => localStorage.getItem('charts_timeframe') || '1h');
  const [chartType, setChartType] = useState(() => localStorage.getItem('charts_type') || 'Candlestick');
  const [price, setPrice] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [showIndicators, setShowIndicators] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [multiChart, setMultiChart] = useState(false);
  const [toolStyles, setToolStyles] = useState({});
  const [drawings, setDrawings] = useState([]);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);
  const indicatorSeries = useRef({});
  const candleData = useRef([]);

  const styles = getStyles(theme);

  useEffect(() => { localStorage.setItem('charts_pair', pair); }, [pair]);
  useEffect(() => { localStorage.setItem('charts_timeframe', tf); }, [tf]);
  useEffect(() => { localStorage.setItem('charts_type', chartType); }, [chartType]);

  const toggleIndicator = (id) => {
    setActiveIndicators(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const updateToolStyle = (toolId, key, value) => {
    setToolStyles(prev => ({ ...prev, [toolId]: { ...(prev[toolId] || DEFAULT_TOOL_STYLES), [key]: value } }));
  };

  const getToolStyle = (toolId) => toolStyles[toolId] || DEFAULT_TOOL_STYLES;

  const applyIndicators = useCallback((chart, data) => {

    Object.values(indicatorSeries.current).forEach(s => {
      try { if (Array.isArray(s)) s.forEach(sub => chart.removeSeries(sub)); else chart.removeSeries(s); } catch {}
    });
    indicatorSeries.current = {};

    for (const ind of activeIndicators) {
      const style = getToolStyle(ind);
      if (ind === 'ema20') {
        const s = chart.addLineSeries({ color: style.color || '#f59e0b', lineWidth: style.lineWidth || 1, priceScaleId: 'right' });
        s.setData(computeEMA(data, 20));
        indicatorSeries.current[ind] = s;
      } else if (ind === 'ema50') {
        const s = chart.addLineSeries({ color: style.color || '#8b5cf6', lineWidth: style.lineWidth || 1, priceScaleId: 'right' });
        s.setData(computeEMA(data, 50));
        indicatorSeries.current[ind] = s;
      } else if (ind === 'ema200') {
        const s = chart.addLineSeries({ color: style.color || '#ef4444', lineWidth: style.lineWidth || 1, priceScaleId: 'right' });
        s.setData(computeEMA(data, 200));
        indicatorSeries.current[ind] = s;
      } else if (ind === 'bb') {
        const bb = computeBB(data);
        const upper = chart.addLineSeries({ color: style.color || '#8b5cf666', lineWidth: 1, priceScaleId: 'right' });
        const lower = chart.addLineSeries({ color: style.color || '#8b5cf666', lineWidth: 1, priceScaleId: 'right' });
        const mid = chart.addLineSeries({ color: style.color || '#8b5cf6', lineWidth: 1, lineStyle: 2, priceScaleId: 'right' });
        upper.setData(bb.upper); lower.setData(bb.lower); mid.setData(bb.mid);
        indicatorSeries.current[ind] = [upper, lower, mid];
      } else if (ind === 'rsi') {
        const rsiData = computeRSI(data);
        const s = chart.addLineSeries({ color: style.color || '#eab308', lineWidth: style.lineWidth || 2, priceScaleId: 'rsi', lastValueVisible: true, priceFormat: { type: 'custom', formatter: v => v.toFixed(1) } });
        chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0.02 }, borderVisible: false });
        s.setData(rsiData);
        indicatorSeries.current[ind] = s;
      } else if (ind === 'macd') {
        const macd = computeMACD(data);
        const macdSeries = chart.addLineSeries({ color: style.color || '#3b82f6', lineWidth: 2, priceScaleId: 'macd', lastValueVisible: false });
        const signalSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceScaleId: 'macd', lastValueVisible: false });
        const histSeries = chart.addHistogramSeries({ priceScaleId: 'macd', lastValueVisible: false, priceFormat: { type: 'custom', formatter: v => v.toFixed(4) } });
        chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.85, bottom: 0.02 }, borderVisible: false });
        macdSeries.setData(macd.macdLine);
        signalSeries.setData(macd.signalLine);
        histSeries.setData(macd.histogram);
        indicatorSeries.current[ind] = [macdSeries, signalSeries, histSeries];
      }
    }
  }, [activeIndicators, toolStyles]);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/klines?symbol=${pair}&interval=${tf}&limit=500`);
      const data = await r.json();
      if (!Array.isArray(data)) return;

      const candles = data.map(d => ({ time: d[0] / 1000, open: +d[1], high: +d[2], low: +d[3], close: +d[4] }));
      const volumes = data.map(d => ({ time: d[0] / 1000, value: +d[5], color: +d[4] >= +d[1] ? theme.chartUp + '66' : theme.chartDown + '66' }));
      candleData.current = candles;

      if (candles.length) setPrice(candles[candles.length - 1].close);

      if (!chartInstance.current && chartRef.current) {
        const chart = createChart(chartRef.current, {
          width: chartRef.current.clientWidth, height: isFullscreen ? window.innerHeight - 120 : 500,
          layout: { background: { color: theme.cardBg }, textColor: theme.textSecondary, fontFamily: "'Inter',sans-serif" },
          grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
          crosshair: { mode: 0 },
          timeScale: { borderColor: theme.border, timeVisible: true },
          rightPriceScale: { borderColor: theme.border },
        });
        chartInstance.current = chart;
        const ro = new ResizeObserver(() => { if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth }); });
        ro.observe(chartRef.current);
      }

      const chart = chartInstance.current;
      if (!chart) return;

      chart.applyOptions({
        layout: { background: { color: theme.cardBg }, textColor: theme.textSecondary },
        grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
        timeScale: { borderColor: theme.border },
        rightPriceScale: { borderColor: theme.border },
        height: isFullscreen ? window.innerHeight - 120 : 500,
      });

      if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
      if (volRef.current) { chart.removeSeries(volRef.current); volRef.current = null; }

      if (chartType === 'Line') {
        seriesRef.current = chart.addLineSeries({ color: theme.accent, lineWidth: 2 });
        seriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === 'Bars') {
        seriesRef.current = chart.addBarSeries({ upColor: theme.chartUp, downColor: theme.chartDown });
        seriesRef.current.setData(candles);
      } else {
        seriesRef.current = chart.addCandlestickSeries({ upColor: theme.chartUp, downColor: theme.chartDown, borderUpColor: theme.chartUp, borderDownColor: theme.chartDown, wickUpColor: theme.chartUp, wickDownColor: theme.chartDown });
        seriesRef.current.setData(candles);
      }

      volRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volRef.current.setData(volumes);

      applyIndicators(chart, candles);
      chart.timeScale().fitContent();
    } catch (e) { console.error(e); }
  }, [pair, tf, chartType, theme, isFullscreen, applyIndicators]);

  useEffect(() => {
    if (chartInstance.current) { chartInstance.current.remove(); chartInstance.current = null; seriesRef.current = null; volRef.current = null; indicatorSeries.current = {}; }
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    if (chartInstance.current && candleData.current.length) {
      applyIndicators(chartInstance.current, candleData.current);
    }
  }, [activeIndicators, applyIndicators]);

  const handleDragStart = (e, toolId) => {
    e.dataTransfer.setData('tool', toolId);
  };

  const handleChartDrop = (e) => {
    e.preventDefault();
    const toolId = e.dataTransfer.getData('tool');
    if (toolId && chartInstance.current) {
      const style = getToolStyle(toolId);
      setDrawings(prev => [...prev, { id: Date.now(), tool: toolId, style: { ...style } }]);

    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const containerStyle = isFullscreen ? {
    position: 'fixed', inset: 0, zIndex: 100, background: theme.bg, padding: 16, overflow: 'auto',
  } : {};

  const renderMultiChart = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, height: 'calc(100vh - 200px)' }}>
      {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].map(symbol => (
        <motion.div key={symbol} style={{ ...styles.card, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 8 }}>{symbol.replace('USDT', '/USDT')}</div>
          <div style={{ color: theme.textMuted, fontSize: 12 }}>{t('chartMiniView')}</div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div style={containerStyle}>
      {}
      <motion.div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <select style={styles.sel} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {CHART_TYPE_IDS.map(id => (
            <motion.button key={id} style={styles.btn(chartType === id)} onClick={() => setChartType(id)}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              {t(CHART_TYPE_KEYS[id])}
            </motion.button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMEFRAMES.map(tfv => (
            <motion.button key={tfv} style={styles.btn(tf === tfv)} onClick={() => setTf(tfv)}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              {tfv.toUpperCase()}
            </motion.button>
          ))}
        </div>

        {}
        <div style={{ position: 'relative' }}>
          <motion.button style={styles.btn(showIndicators || activeIndicators.length > 0)}
            onClick={() => setShowIndicators(!showIndicators)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            📈 {t('indicators')} {activeIndicators.length > 0 && `(${activeIndicators.length})`}
          </motion.button>
          <AnimatePresence>
            {showIndicators && (
              <motion.div style={styles.indicatorDropdown}
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                {INDICATORS.map(ind => (
                  <div key={ind.id} style={styles.indicatorItem(activeIndicators.includes(ind.id))}
                    onClick={() => toggleIndicator(ind.id)}>
                    <span style={{ width: 16 }}>{activeIndicators.includes(ind.id) ? '✓' : ''}</span>
                    <span>{ind.label}</span>
                    {activeIndicators.includes(ind.id) && (
                      <input type="color" value={getToolStyle(ind.id).color}
                        onChange={e => updateToolStyle(ind.id, 'color', e.target.value)}
                        style={styles.colorPicker} onClick={e => e.stopPropagation()} />
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {}
        <motion.button style={styles.btn(multiChart)} onClick={() => setMultiChart(!multiChart)}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          ⊞ {t('multiChart')}
        </motion.button>

        {}
        <motion.button style={styles.fullscreenBtn} onClick={toggleFullscreen}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          {isFullscreen ? '⊘' : '⛶'}
        </motion.button>

        {price && <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700, color: theme.text }}>${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
      </motion.div>

      {multiChart ? renderMultiChart() : (
        <div style={{ display: 'flex', gap: 8 }}>
          {}
          <motion.div style={styles.toolsSidebar} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            {DRAWING_TOOLS.map(tool => (
              <motion.button
                key={tool.id}
                style={styles.toolBtn(activeTool === tool.id)}
                onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                draggable
                onDragStart={e => handleDragStart(e, tool.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={t(tool.label)}
              >
                {tool.icon}
              </motion.button>
            ))}
            <div style={{ height: 1, width: '80%', background: theme.border, margin: '4px 0' }} />
            {}
            {activeTool && (
              <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <input type="color" value={getToolStyle(activeTool).color}
                  onChange={e => updateToolStyle(activeTool, 'color', e.target.value)}
                  style={styles.colorPicker} title={t('color')} />
                <select value={getToolStyle(activeTool).lineWidth}
                  onChange={e => updateToolStyle(activeTool, 'lineWidth', +e.target.value)}
                  style={{ ...styles.styleSelect, width: 36, padding: 2, textAlign: 'center' }}>
                  {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </motion.div>
            )}
          </motion.div>

          {}
          <motion.div style={{ ...styles.card, flex: 1 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onDrop={handleChartDrop} onDragOver={e => e.preventDefault()}>
            <div ref={chartRef} style={{ width: '100%' }} />
          </motion.div>
        </div>
      )}

      {}
      {drawings.length > 0 && (
        <motion.div style={{ ...styles.card, padding: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>{t('activeDrawings')} ({drawings.length})</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {drawings.map(d => (
              <span key={d.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                background: theme.inputBg, border: '1px solid ' + theme.border, fontSize: 12, color: theme.textSecondary,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.style.color }} />
                {t(DRAWING_TOOLS.find(tool => tool.id === d.tool)?.label || d.tool)}
                <button onClick={() => setDrawings(prev => prev.filter(x => x.id !== d.id))}
                  style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {}
      {isFullscreen && (
        <motion.button
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 101, ...styles.btn(false), background: theme.cardBg, padding: '8px 16px' }}
          onClick={toggleFullscreen} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          ✕ {t('close')}
        </motion.button>
      )}
    </div>
  );
}
