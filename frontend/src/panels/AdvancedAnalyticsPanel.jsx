import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';

export default function AdvancedAnalyticsPanel() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('pnl');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, riskRes, corrRes, attrRes] = await Promise.all([
        fetch('/api/analytics/dashboard').catch(() => null),
        fetch('/api/analytics/risk/overview').catch(() => null),
        fetch('/api/analytics/correlation').catch(() => null),
        fetch('/api/analytics/attribution').catch(() => null)
      ]);

      if (dashboardRes) {
        const data = await dashboardRes.json();
        setAnalyticsData(data);
      }
      if (riskRes) {
        const data = await riskRes.json();
        setRiskMetrics(data);
      }
      if (corrRes) {
        const data = await corrRes.json();
        setCorrelation(data);
      }
      if (attrRes) {
        const data = await attrRes.json();
        setAttribution(data);
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!chartRef.current || !analyticsData?.daily_pnl) return;

    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    const data = analyticsData.daily_pnl;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    const values = data.map(d => d.daily_pnl);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;

    ctx.strokeStyle = theme === 'dark' ? '#333' : '#eee';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - 2 * padding) * i / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const val = max - range * i / 4;
      ctx.fillStyle = theme === 'dark' ? '#888' : '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText(`$${val.toFixed(0)}`, 5, y + 3);
    }

    const barWidth = (width - 2 * padding) / data.length;

    data.forEach((d, i) => {
      const x = padding + i * barWidth;
      const barHeight = (d.daily_pnl / range) * (height - 2 * padding);
      const y = padding + (height - 2 * padding) * (max - Math.max(0, d.daily_pnl)) / range;

      ctx.fillStyle = d.daily_pnl >= 0
        ? (theme === 'dark' ? '#22c55e' : '#16a34a')
        : (theme === 'dark' ? '#ef4444' : '#dc2626');

      ctx.fillRect(x, y, barWidth - 1, Math.abs(barHeight));
    });

    const zeroY = padding + (height - 2 * padding) * max / range;
    ctx.strokeStyle = theme === 'dark' ? '#666' : '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(width - padding, zeroY);
    ctx.stroke();

  }, [analyticsData, theme]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📊 Advanced Analytics</h2>
        <button
          onClick={loadAnalyticsData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {}
      <div className="flex space-x-2 border-b border-gray-700 pb-2">
        {['pnl', 'risk', 'correlation', 'attribution'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg transition ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab === 'pnl' && '📈 P&L'}
            {tab === 'risk' && '⚠️ Risk Metrics'}
            {tab === 'correlation' && '🔗 Correlation'}
            {tab === 'attribution' && '📊 Attribution'}
          </button>
        ))}
      </div>

      {}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total P&L"
              value={`$${analyticsData?.performance_attribution?.total_pnl || '0'}`}
              color={(analyticsData?.performance_attribution?.total_pnl || 0) >= 0 ? 'green' : 'red'}
            />
            <MetricCard
              title="Trading Days"
              value={analyticsData?.daily_pnl?.length || 0}
            />
            <MetricCard
              title="Best Day"
              value={`$${Math.max(...(analyticsData?.daily_pnl?.map(d => d.daily_pnl) || [0])).toFixed(2)}`}
              color="green"
            />
            <MetricCard
              title="Worst Day"
              value={`$${Math.min(...(analyticsData?.daily_pnl?.map(d => d.daily_pnl) || [0])).toFixed(2)}`}
              color="red"
            />
          </div>

          {}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Daily P&L (Last 30 Days)</h3>
            <canvas
              ref={chartRef}
              width={800}
              height={300}
              className="w-full"
            />
          </div>

          {}
          {analyticsData?.risk_metrics?.drawdown?.drawdown_history && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Drawdown History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="p-2">Date</th>
                      <th className="p-2">Cumulative P&L</th>
                      <th className="p-2">Drawdown</th>
                      <th className="p-2">Drawdown %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.risk_metrics.drawdown.drawdown_history.slice(-10).map((d, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="p-2">{new Date(d.date).toLocaleDateString()}</td>
                        <td className={`p-2 ${d.cumulative_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${d.cumulative_pnl?.toFixed(2)}
                        </td>
                        <td className="p-2 text-red-400">-${d.drawdown?.toFixed(2)}</td>
                        <td className="p-2 text-red-400">{d.drawdown_pct?.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📉 Value at Risk (VaR)</h3>
              {riskMetrics?.var_95 && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">VaR 95%:</span>
                    <span className="font-mono text-red-400">-${riskMetrics.var_95.historical_var}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">VaR 99%:</span>
                    <span className="font-mono text-red-400">-${riskMetrics.var_99?.historical_var || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mean Return:</span>
                    <span className="font-mono">${riskMetrics.var_95.mean_return}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Std Deviation:</span>
                    <span className="font-mono">${riskMetrics.var_95.std_deviation}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    With 95% confidence, daily loss won't exceed ${riskMetrics.var_95.historical_var}
                  </p>
                </div>
              )}
            </div>

            {/* Sharpe Ratio */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📊 Sharpe Ratio</h3>
              {riskMetrics?.sharpe && (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <span className="text-4xl font-bold text-blue-400">
                      {riskMetrics.sharpe.sharpe_ratio}
                    </span>
                    <p className="text-sm text-gray-400 mt-1">{riskMetrics.sharpe.interpretation}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sortino Ratio:</span>
                    <span className="font-mono">{riskMetrics.sharpe.sortino_ratio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Calmar Ratio:</span>
                    <span className="font-mono">{riskMetrics.sharpe.calmar_ratio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Annual Return:</span>
                    <span className="font-mono text-green-400">${riskMetrics.sharpe.annual_return}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Drawdown:</span>
                    <span className="font-mono text-red-400">{riskMetrics.sharpe.max_drawdown}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Max Drawdown */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📉 Max Drawdown</h3>
              {riskMetrics?.drawdown && (
                <div className="space-y-3">
                  <div className="text-center py-4">
                    <span className="text-4xl font-bold text-red-400">
                      {riskMetrics.drawdown.max_drawdown_pct}%
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      ${riskMetrics.drawdown.max_drawdown}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Peak Date:</span>
                    <span className="font-mono text-sm">
                      {riskMetrics.drawdown.peak_date ? new Date(riskMetrics.drawdown.peak_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trough Date:</span>
                    <span className="font-mono text-sm">
                      {riskMetrics.drawdown.trough_date ? new Date(riskMetrics.drawdown.trough_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Recovered:</span>
                    <span className={`font-mono ${riskMetrics.drawdown.is_recovered ? 'text-green-400' : 'text-yellow-400'}`}>
                      {riskMetrics.drawdown.is_recovered ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correlation Tab */}
      {activeTab === 'correlation' && (
        <div className="space-y-6">
          {correlation?.pairs && correlation.pairs.length > 0 ? (
            <>
              {/* Correlation Matrix */}
              <div className="bg-gray-800 rounded-xl p-6 overflow-x-auto">
                <h3 className="text-lg font-semibold mb-4">🔗 Correlation Matrix</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="p-2"></th>
                      {correlation.pairs.map(pair => (
                        <th key={pair} className="p-2 text-center">{pair}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlation.matrix.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{correlation.pairs[i]}</td>
                        {row.map((val, j) => (
                          <td
                            key={j}
                            className="p-2 text-center"
                            style={{
                              backgroundColor: getCorrelationColor(val),
                            }}
                          >
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top Correlations */}
              {correlation.interpretation && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Top Correlations</h3>
                  <div className="space-y-2">
                    {correlation.interpretation.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <span>{item.pair1} ↔ {item.pair2}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${item.correlation > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.correlation}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-gray-600">
                            {item.strength} {item.direction}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
              <p>Need at least 2 trading pairs with closed trades for correlation analysis</p>
            </div>
          )}
        </div>
      )}

      {/* Attribution Tab */}
      {activeTab === 'attribution' && attribution && (
        <div className="space-y-6">
          {/* By Pair */}
          {attribution.by_pair && attribution.by_pair.labels?.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📊 Performance by Pair</h3>
              <div className="space-y-2">
                {attribution.by_pair.labels.map((label, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-20 font-medium">{label}</span>
                    <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
                      <div
                        className={`h-full ${parseFloat(attribution.by_pair.total_pnl[i]) >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.abs(parseFloat(attribution.by_pair.total_pnl[i])) / 10)}%` }}
                      />
                    </div>
                    <span className={`w-20 text-right ${parseFloat(attribution.by_pair.total_pnl[i]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${attribution.by_pair.total_pnl[i]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {attribution.by_pair.win_rates[i]}% WR
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Direction */}
          {attribution.by_direction && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">📈 Long Trades</h3>
                <div className="text-2xl font-bold text-green-400">
                  {attribution.by_direction.labels.includes('long')
                    ? `$${attribution.by_direction.total_pnl[attribution.by_direction.labels.indexOf('long')]}`
                    : '$0'}
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">📉 Short Trades</h3>
                <div className="text-2xl font-bold text-red-400">
                  {attribution.by_direction.labels.includes('short')
                    ? `$${attribution.by_direction.total_pnl[attribution.by_direction.labels.indexOf('short')]}`
                    : '$0'}
                </div>
              </div>
            </div>
          )}

          {/* By Day of Week */}
          {attribution.by_day_of_week && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">📅 Performance by Day</h3>
              <div className="grid grid-cols-7 gap-2">
                {attribution.by_day_of_week.labels.map((day, i) => (
                  <div key={i} className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xs text-gray-400">{day?.slice(0, 3)}</div>
                    <div className={`font-mono ${parseFloat(attribution.by_day_of_week.total_pnl[i]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${attribution.by_day_of_week.total_pnl[i]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {attribution.by_day_of_week.counts[i]} trades
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duration Analysis */}
          {attribution.duration_analysis && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">⏱️ Performance by Duration</h3>
              <div className="grid grid-cols-5 gap-2">
                {attribution.duration_analysis.labels.map((label, i) => (
                  <div key={i} className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className={`font-mono ${parseFloat(attribution.duration_analysis.total_pnl[i]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${attribution.duration_analysis.total_pnl[i]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {attribution.duration_analysis.win_rates[i]}% WR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, color = 'default' }) {
  const colorClasses = {
    green: 'text-green-400',
    red: 'text-red-400',
    default: 'text-white'
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="text-sm text-gray-400">{title}</div>
      <div className={`text-xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

function getCorrelationColor(value) {
  if (value === 1) return 'rgb(59, 130, 246)';
  if (value > 0.7) return 'rgba(34, 197, 94, 0.6)';
  if (value > 0.4) return 'rgba(34, 197, 94, 0.3)';
  if (value > 0) return 'rgba(34, 197, 94, 0.1)';
  if (value > -0.4) return 'rgba(239, 68, 68, 0.1)';
  if (value > -0.7) return 'rgba(239, 68, 68, 0.3)';
  return 'rgba(239, 68, 68, 0.6)';
}
