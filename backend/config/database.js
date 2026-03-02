const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.log(`[DB] Slow query (${duration}ms):`, text.slice(0, 100));
  }

  return result;
}

async function getOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function getMany(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

async function insert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const text = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await query(text, values);
  return result.rows[0];
}

async function update(table, data, whereClause, whereParams = []) {
  const columns = Object.keys(data);
  const values = Object.values(data);

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const whereIndex = values.length + 1;
  const whereParamsIndexed = whereParams.map((p, i) => `$${whereIndex + i}`);

  const text = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
    RETURNING *
  `;

  const result = await query(text, [...values, ...whereParams]);
  return result.rows;
}

async function deleteRows(table, whereClause, whereParams = []) {
  const text = `DELETE FROM ${table} WHERE ${whereClause}`;
  const result = await query(text, whereParams);
  return result.rowCount;
}

async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback({
      query: async (text, params) => client.query(text, params),
      getOne: async (text, params) => {
        const result = await client.query(text, params);
        return result.rows[0] || null;
      },
      getMany: async (text, params) => {
        const result = await client.query(text, params);
        return result.rows;
      }
    });

    await client.query('COMMIT');
    return result;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initializeDatabase() {
  console.log('[DB] initializing database...');

  try {

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        password_hash TEXT,
        plan TEXT DEFAULT 'Free',
        is_admin INTEGER DEFAULT 0,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        two_factor_backup_codes TEXT,
        two_factor_verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS signals (
        id SERIAL PRIMARY KEY,
        pair TEXT,
        type TEXT,
        entry REAL,
        tp REAL,
        sl REAL,
        reason TEXT,
        accuracy REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE,
        value TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        pair TEXT NOT NULL,
        direction TEXT NOT NULL,
        quantity REAL NOT NULL,
        entry_price REAL NOT NULL,
        entry_amount REAL,
        tp REAL,
        sl REAL,
        close_price REAL,
        pnl REAL,
        status TEXT DEFAULT 'open',
        user_id INTEGER REFERENCES users(id),
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      )
    `);

    await query(`
      ALTER TABLE trades ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'
    `).catch(() => {});

    await query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        pair TEXT NOT NULL,
        condition TEXT NOT NULL,
        value REAL NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'active',
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        triggered_at TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        pair TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pair, user_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS drawings (
        id SERIAL PRIMARY KEY,
        pair TEXT,
        data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS signal_results (
        id SERIAL PRIMARY KEY,
        signal_id INTEGER,
        pair TEXT NOT NULL,
        direction TEXT,
        entry_price REAL,
        tp_price REAL,
        sl_price REAL,
        actual_price REAL,
        result TEXT DEFAULT 'pending',
        confidence REAL,
        coin_score INTEGER,
        accuracy_score REAL,
        ai_analysis TEXT,
        ai_reflection TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        days INTEGER,
        strategy TEXT NOT NULL,
        strategy_name TEXT,
        capital REAL,
        leverage REAL DEFAULT 1,
        signals_count INTEGER DEFAULT 0,
        trades_count INTEGER DEFAULT 0,
        metrics JSONB,
        trades JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS trading_bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        strategy TEXT NOT NULL,
        params JSONB,
        capital REAL DEFAULT 5000,
        leverage REAL DEFAULT 1,
        status TEXT DEFAULT 'stopped',
        total_trades INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0,
        roi REAL DEFAULT 0,
        last_run TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sentiment_history (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        score INTEGER,
        label TEXT,
        fear_greed_index INTEGER,
        source TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT NOT NULL,
        metrics JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_telegram (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        chat_id BIGINT,
        notifications_enabled BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT,
        auth TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_signal_results_created_at ON signal_results(created_at)`);

    const plans = {
      Free: { name: 'Free', price: 'бесплатно', indicators: 3, aiAnalyses: 5, charts: true, pairs: 3, signals: 5, refreshRate: 30 },
      Pro: { name: 'Pro', price: '$29/мес', indicators: 'все', aiAnalyses: 50, charts: true, pairs: 10, signals: 50, refreshRate: 10, alerts: true, whyButton: true, whale: true },
      Premium: { name: 'Premium', price: '$99/мес', indicators: 'все', aiAnalyses: -1, charts: true, pairs: 10, signals: -1, refreshRate: 5, alerts: true, whale: true, ai: true, realtimeAI: true, prioritySupport: true }
    };

    for (const [k, v] of Object.entries(plans)) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [`plan_${k}`, JSON.stringify(v)]
      );
    }

    const adminResult = await getOne('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
    if (parseInt(adminResult.count) === 0) {
      const firstUser = await getOne('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
      if (firstUser) {
        await query('UPDATE users SET is_admin = 1 WHERE id = $1', [firstUser.id]);
        console.log(`Made user #${firstUser.id} admin (first registered)`);
      }
    }

    console.log('[DB] database initialized');

  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
}

initializeDatabase().catch(console.error);

module.exports = {
  query,
  getOne,
  getMany,
  insert,
  update,
  deleteRows,
  transaction,
  pool,
  initializeDatabase
};
