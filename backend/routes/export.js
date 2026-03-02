const express = require('express');
const router = express.Router();
const db = require('../config/database');
const PDFDocument = require('pdfkit');

router.get('/trades/pdf', async (req, res) => {
  try {
    const { status } = req.query;

    let trades;
    if (status) {
      trades = await db.getMany(
        'SELECT * FROM trades WHERE status = $1 ORDER BY opened_at DESC',
        [status]
      );
    } else {
      trades = await db.getMany('SELECT * FROM trades ORDER BY opened_at DESC');
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.on('error', (err) => {
      console.error('PDF generation error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=trades_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('KotvukAI — Trades Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC | Total: ${trades.length} trades`, { align: 'center' });
    doc.moveDown(1);

    const closed = trades.filter(t => t.status === 'closed');
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = closed.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length * 100).toFixed(1) : '0.0';

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
    doc.text(`Summary: Total PnL: $${totalPnl.toFixed(2)} | Win Rate: ${winRate}% | Wins: ${wins} | Losses: ${closed.length - wins}`, { align: 'left' });
    doc.moveDown(0.8);

    const colWidths = [35, 70, 50, 55, 70, 65, 65, 65, 65, 50, 95];
    const headers = ['#', 'Pair', 'Dir', 'Qty', 'Entry', 'TP', 'SL', 'Close', 'PnL', 'Status', 'Date'];
    let x = 40;
    const startY = doc.y;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');
    doc.rect(40, startY - 2, colWidths.reduce((a, b) => a + b, 0), 16).fill('#333');
    doc.fillColor('#fff');
    x = 40;
    headers.forEach((h, i) => {
      doc.text(h, x + 3, startY + 2, { width: colWidths[i] - 6, align: 'left' });
      x += colWidths[i];
    });

    doc.moveDown(0.8);
    let y = doc.y;

    doc.fontSize(7).font('Helvetica').fillColor('#000');
    trades.forEach((t, idx) => {
      if (y > 530) {
        doc.addPage();
        y = 40;
      }

      const bg = idx % 2 === 0 ? '#f8f8f8' : '#fff';
      doc.rect(40, y - 2, colWidths.reduce((a, b) => a + b, 0), 14).fill(bg);
      doc.fillColor('#000');

      const row = [
        t.id,
        t.pair,
        t.direction?.toUpperCase(),
        t.quantity,
        `$${t.entry_price}`,
        t.tp ? `$${t.tp}` : '—',
        t.sl ? `$${t.sl}` : '—',
        t.close_price ? `$${t.close_price}` : '—',
        t.pnl !== null ? `$${t.pnl?.toFixed(2)}` : '—',
        t.status,
        new Date(t.opened_at).toISOString().slice(0, 16)
      ];

      x = 40;
      row.forEach((val, i) => {
        if (i === 8 && t.pnl !== null) {
          doc.fillColor(t.pnl >= 0 ? '#16a34a' : '#dc2626');
        } else {
          doc.fillColor('#000');
        }
        doc.text(String(val), x + 3, y + 1, { width: colWidths[i] - 6, align: 'left' });
        x += colWidths[i];
      });

      y += 14;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/pdf', async (req, res) => {
  try {
    const closed = await db.getMany("SELECT * FROM trades WHERE status = 'closed' ORDER BY closed_at DESC");
    const signals = await db.getMany('SELECT * FROM signal_results ORDER BY created_at DESC');

    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = closed.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length * 100) : 0;
    const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
    const best = closed.length > 0 ? Math.max(...closed.map(t => t.pnl || 0)) : 0;
    const worst = closed.length > 0 ? Math.min(...closed.map(t => t.pnl || 0)) : 0;

    const tpHit = signals.filter(s => s.result === 'tp_hit').length;
    const slHit = signals.filter(s => s.result === 'sl_hit').length;
    const signalAcc = signals.length > 0 ? (tpHit / signals.length * 100) : 0;

    const doc = new PDFDocument({ margin: 50 });
    doc.on('error', (err) => {
      console.error('PDF generation error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(22).font('Helvetica-Bold').text('KotvukAI — Analytics Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Trading Performance');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    const stats = [
      ['Total Trades', closed.length],
      ['Total PnL', `$${totalPnl.toFixed(2)}`],
      ['Win Rate', `${winRate.toFixed(1)}%`],
      ['Average PnL', `$${avgPnl.toFixed(2)}`],
      ['Best Trade', `$${best.toFixed(2)}`],
      ['Worst Trade', `$${worst.toFixed(2)}`],
    ];
    stats.forEach(([label, value]) => {
      doc.fillColor('#333').text(`${label}: `, { continued: true }).font('Helvetica-Bold').fillColor('#000').text(String(value));
      doc.font('Helvetica');
    });

    doc.moveDown(1.5);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Signal Performance');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    const signalStats = [
      ['Total Signals', signals.length],
      ['TP Hit', tpHit],
      ['SL Hit', slHit],
      ['Signal Accuracy', `${signalAcc.toFixed(1)}%`],
    ];
    signalStats.forEach(([label, value]) => {
      doc.fillColor('#333').text(`${label}: `, { continued: true }).font('Helvetica-Bold').fillColor('#000').text(String(value));
      doc.font('Helvetica');
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
