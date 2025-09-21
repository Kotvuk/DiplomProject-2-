const db = require('../config/database');
const { selfAnalysis } = require('../utils/groqKeys');

async function generateReflection(signalId) {
  try {
    const sig = await db.getOne('SELECT * FROM signal_results WHERE id = $1', [signalId]);
    if (!sig || sig.result === 'pending') return;

    const prompt = `Ты дал торговый сигнал:
- Пара: ${sig.pair}
- Направление: ${sig.direction || 'N/A'}
- Цена входа: $${sig.entry_price}
- Take Profit: ${sig.tp_price ? '$' + sig.tp_price : 'не указан'}
- Stop Loss: ${sig.sl_price ? '$' + sig.sl_price : 'не указан'}
- Результат: ${sig.result === 'tp_hit' ? 'TP сработал ✅' : sig.result === 'sl_hit' ? 'SL сработал ❌' : 'Таймаут ⏰'}
- Фактическая цена: ${sig.actual_price ? '$' + sig.actual_price : 'N/A'}

Проанализируй КРАТКО (3-4 предложения):
1. Почему сигнал оказался ${sig.result === 'tp_hit' ? 'верным' : 'ошибочным'}?
2. Какие факторы ты мог не учесть?
3. Что нужно учитывать в будущем для подобных ситуаций?`;

    const data = await selfAnalysis([sig], { signalId });
    const reflection = data?.choices?.[0]?.message?.content || '';

    if (reflection) {
      await db.query(
        'UPDATE signal_results SET ai_reflection = $1 WHERE id = $2',
        [reflection, signalId]
      );
      console.log(` Reflection generated for signal #${signalId}`);
    }
  } catch (e) {
    console.error('Reflection API error:', e.message);
  }
}

async function checkPendingSignals() {
  try {
    const pending = await db.getMany("SELECT * FROM signal_results WHERE result = 'pending'");
    if (pending.length === 0) return;

    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const sig of pending) {
      const currentPrice = priceMap[sig.pair];
      if (!currentPrice) continue;

      let result = null;
      if (sig.direction === 'LONG' || sig.direction === 'long') {
        if (sig.tp_price && currentPrice >= sig.tp_price) result = 'tp_hit';
        else if (sig.sl_price && currentPrice <= sig.sl_price) result = 'sl_hit';
      } else if (sig.direction === 'SHORT' || sig.direction === 'short') {
        if (sig.tp_price && currentPrice <= sig.tp_price) result = 'tp_hit';
        else if (sig.sl_price && currentPrice >= sig.sl_price) result = 'sl_hit';
      }

      if (!result) {
        const created = new Date(sig.created_at).getTime();
        if (Date.now() - created > 24 * 60 * 60 * 1000) result = 'timeout';
      }

      if (result) {
        const score = result === 'tp_hit' ? 100 : result === 'timeout' ? 50 : 0;
        await db.query(
          'UPDATE signal_results SET result = $1, actual_price = $2, accuracy_score = $3, resolved_at = CURRENT_TIMESTAMP WHERE id = $4',
          [result, currentPrice, score, sig.id]
        );
        console.log(`Signal #${sig.id} resolved: ${sig.pair} ${result} (price: $${currentPrice})`);
        generateReflection(sig.id).catch(e => console.error('Reflection error:', e.message));
      }
    }
  } catch (e) {
    console.error('Signal check error:', e.message);
  }
}

module.exports = { checkPendingSignals, generateReflection };
