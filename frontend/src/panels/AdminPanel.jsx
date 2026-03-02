import React, { useState, useEffect } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: (active) => ({
    padding: '6px 14px', borderRadius: 6,
    border: '1px solid ' + (active ? theme.accent : theme.border),
    background: active ? theme.accent + '33' : 'transparent',
    color: active ? theme.accent : theme.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    fontFamily: "'Inter',sans-serif",
  }),
  inputStyle: {
    width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border,
    borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, outline: 'none',
    fontFamily: "'Inter',sans-serif", boxSizing: 'border-box',
  }
});

const AdminPanel = () => {
  const { t } = useLang();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [signals, setSignals] = useState([]);
  const [plans, setPlans] = useState({ Free: {}, Pro: {}, Premium: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    const token = localStorage.getItem('token');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      const statsRes = await fetch('/api/admin/stats', { headers });
      if (statsRes.ok) setStats(await statsRes.json());

      const usersRes = await fetch('/api/admin/users', { headers });
      if (usersRes.ok) setUsers(await usersRes.json());

      const signalsRes = await fetch('/api/admin/signals', { headers });
      if (signalsRes.ok) {
        const data = await signalsRes.json();
        setSignals(data.signals || []);
      }

      const plansRes = await fetch('/api/settings', { headers });
      if (plansRes.ok) {
        const settings = await plansRes.json();
        const planData = { Free: {}, Pro: {}, Premium: {} };
        settings.forEach(setting => {
          if (setting.key.startsWith('plan_')) {
            const planName = setting.key.replace('plan_', '');
            try { planData[planName] = JSON.parse(setting.value); } catch (e) {}
          }
        });
        setPlans(planData);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserPlan = async (userId, newPlan) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan })
      });
      if (res.ok) {
        setUsers(users.map(user => user.id === userId ? { ...user, plan: newPlan } : user));
      } else { alert('Failed to update user plan'); }
    } catch (error) { console.error('Error updating plan:', error); }
  };

  const toggleUserAdmin = async (userId, isAdmin) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: isAdmin ? 1 : 0 })
      });
      if (res.ok) {
        setUsers(users.map(user => user.id === userId ? { ...user, is_admin: isAdmin ? 1 : 0 } : user));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update admin status');
      }
    } catch (error) { console.error('Error updating admin status:', error); }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(user => user.id !== userId));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete user');
      }
    } catch (error) { console.error('Error deleting user:', error); }
  };

  const updatePlanSettings = async (planName, settings) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/plans/${planName}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setPlans({ ...plans, [planName]: settings });
      } else { alert('Failed to update plan settings'); }
    } catch (error) { console.error('Error updating plan:', error); }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40, color: theme.textSecondary }}>
          {t('loading')}...
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, color = '#3b82f6' }) => (
    <div style={{ ...styles.card, textAlign: 'center', marginBottom: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 14, color: theme.textSecondary }}>{title}</div>
    </div>
  );

  const renderStats = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard title={t('adminTotalUsers')} value={stats?.totalUsers || 0} />
        <StatCard title={t('adminFreeUsers')} value={stats?.usersByPlan?.Free || 0} color="#10b981" />
        <StatCard title={t('adminProUsers')} value={stats?.usersByPlan?.Pro || 0} color="#f59e0b" />
        <StatCard title={t('adminPremiumUsers')} value={stats?.usersByPlan?.Premium || 0} color="#8b5cf6" />
        <StatCard title={t('adminTotalTrades')} value={stats?.totalTrades || 0} />
        <StatCard title={t('adminTotalSignals')} value={stats?.totalSignals || 0} />
        <StatCard title={t('adminSignalAccuracy')} value={`${stats?.signalAccuracy || 0}%`} color="#ef4444" />
      </div>
    </div>
  );

  const renderUsers = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder={t('adminSearchUsers')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...styles.inputStyle, width: 300 }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>ID</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('name')}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('email')}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('adminPlan')}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('adminIsAdmin')}</th>
              <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('adminActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{user.id}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{user.name || '-'}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{user.email}</td>
                <td style={{ padding: '12px 8px' }}>
                  <select
                    value={user.plan}
                    onChange={(e) => updateUserPlan(user.id, e.target.value)}
                    style={{ ...styles.inputStyle, width: 100, padding: '6px 8px' }}
                  >
                    <option value="Free">Free</option>
                    <option value="Pro">Pro</option>
                    <option value="Premium">Premium</option>
                  </select>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <button
                    onClick={() => toggleUserAdmin(user.id, !user.is_admin)}
                    style={{
                      ...styles.btn(user.is_admin),
                      border: user.is_admin ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      color: user.is_admin ? '#10b981' : '#a0a0b0',
                      background: user.is_admin ? 'rgba(16,185,129,0.1)' : 'transparent'
                    }}
                  >
                    {user.is_admin ? '✓' : '○'}
                  </button>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <button
                    onClick={() => deleteUser(user.id)}
                    style={{
                      ...styles.btn(false),
                      border: '1px solid #ef4444',
                      color: theme.red,
                      background: 'rgba(239,68,68,0.1)'
                    }}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PlanEditor = ({ planName, planData }) => {
    const [editedPlan, setEditedPlan] = useState(planData);
    return (
      <div style={styles.card}>
        <h3 style={{ color: theme.text, marginBottom: 16, fontSize: 18 }}>{planName}</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: theme.textSecondary }}>{t('adminAiAnalyses')}</label>
            <input type="number" value={editedPlan.aiAnalyses || ''} onChange={(e) => setEditedPlan({ ...editedPlan, aiAnalyses: parseInt(e.target.value) || 0 })} style={styles.inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: theme.textSecondary }}>{t('adminPairs')}</label>
            <input type="number" value={editedPlan.pairs || ''} onChange={(e) => setEditedPlan({ ...editedPlan, pairs: parseInt(e.target.value) || 0 })} style={styles.inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: theme.textSecondary }}>{t('adminRefreshRate')} (sec)</label>
            <input type="number" value={editedPlan.refreshRate || ''} onChange={(e) => setEditedPlan({ ...editedPlan, refreshRate: parseInt(e.target.value) || 30 })} style={styles.inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: theme.textSecondary }}>{t('adminSignals')}</label>
            <input type="number" value={editedPlan.signals || ''} onChange={(e) => setEditedPlan({ ...editedPlan, signals: parseInt(e.target.value) || 0 })} style={styles.inputStyle} />
          </div>
          <button onClick={() => updatePlanSettings(planName, editedPlan)}
            style={{ ...styles.btn(true), marginTop: 8, background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' }}>
            {t('save')}
          </button>
        </div>
      </div>
    );
  };

  const renderPlans = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      {Object.entries(plans).map(([planName, planData]) => (
        <PlanEditor key={planName} planName={planName} planData={planData} />
      ))}
    </div>
  );

  const renderSignals = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>ID</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('pair')}</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('direction')}</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('entry')}</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>{t('result')}</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>Score</th>
            <th style={{ padding: '12px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: 13 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {signals.slice(0, 50).map(signal => (
            <tr key={signal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{signal.id}</td>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{signal.pair}</td>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{signal.direction || '-'}</td>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>${signal.entry_price}</td>
              <td style={{ padding: '12px 8px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12,
                  background: signal.result === 'tp_hit' ? 'rgba(16,185,129,0.2)' :
                    signal.result === 'sl_hit' ? 'rgba(239,68,68,0.2)' :
                      signal.result === 'timeout' ? 'rgba(245,158,11,0.2)' : 'rgba(156,163,175,0.2)',
                  color: signal.result === 'tp_hit' ? '#10b981' :
                    signal.result === 'sl_hit' ? '#ef4444' :
                      signal.result === 'timeout' ? '#f59e0b' : '#9ca3af'
                }}>
                  {signal.result || 'pending'}
                </span>
              </td>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{signal.accuracy_score || '-'}</td>
              <td style={{ padding: '12px 8px', fontSize: 14, color: theme.text }}>{new Date(signal.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{t('adminPanel')}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
        {[
          { id: 'stats', label: t('adminStats') },
          { id: 'users', label: t('adminUsers') },
          { id: 'plans', label: t('adminPlans') },
          { id: 'signals', label: t('adminSignals') }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={styles.btn(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.card}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'plans' && renderPlans()}
        {activeTab === 'signals' && renderSignals()}
      </div>
    </div>
  );
};

export default AdminPanel;
