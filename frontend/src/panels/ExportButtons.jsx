import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';

export default function ExportButtons({ type = 'trades', status }) {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);

  const btnStyle = {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid ' + theme.border,
    background: 'transparent',
    color: theme.textSecondary,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "'Inter',sans-serif",
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const query = status ? `?status=${status}` : '';
      const url = `/api/export/${type}/pdf${query}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 8, marginLeft: 12 }}>
      <motion.button
        style={btnStyle}
        onClick={handleExport}
        whileHover={{ scale: 1.05, borderColor: theme.accent }}
        whileTap={{ scale: 0.95 }}
        disabled={exporting}
      >
        {exporting ? '...' : 'PDF'}
      </motion.button>
    </div>
  );
}
