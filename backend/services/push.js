const db = require('../config/database');

var VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
var VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

async function saveSubscription(userId, subscription) {
  try {
    const { endpoint, keys } = subscription;

    await db.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = $1,
        p256dh = $3,
        auth = $4,
        created_at = CURRENT_TIMESTAMP
    `, [userId, endpoint, keys?.p256dh, keys?.auth]);

    console.log(`[Push] Subscription saved for user ${userId}`);
    return { success: true };
  } catch (e) {
    console.error('[Push] Save subscription error:', e);
    return { success: false, error: e.message };
  }
}

async function removeSubscription(userId, endpoint) {
  try {
    await db.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    console.log(`[Push] Subscription removed for user ${userId}`);
    return { success: true };
  } catch (e) {
    console.error('[Push] Remove subscription error:', e);
    return { success: false, error: e.message };
  }
}

async function getUserSubscriptions(userId) {
  try {
    const result = await db.getMany(
      'SELECT endpoint, p256dh, auth, created_at FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    return result;
  } catch (e) {
    console.error('[Push] Get subscriptions error:', e);
    return [];
  }
}

async function getAllSubscriptions() {
  try {
    const result = await db.getMany(
      'SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions'
    );
    return result;
  } catch (e) {
    console.error('[Push] Get all subscriptions error:', e);
    return [];
  }
}

async function sendToUser(userId, notification) {
  const subscriptions = await getUserSubscriptions(userId);

  if (subscriptions.length === 0) {
    console.log(`[Push] No subscriptions for user ${userId}`);
    return { sent: 0 };
  }

  let sent = 0;
  const errors = [];

  for (const sub of subscriptions) {
    try {
      await sendPushNotification(sub, notification);
      sent++;
    } catch (e) {
      errors.push({ endpoint: sub.endpoint, error: e.message });

      if (e.statusCode === 410 || e.statusCode === 404) {
        await removeSubscription(userId, sub.endpoint);
      }
    }
  }

  return { sent, errors };
}

async function broadcast(notification) {
  const subscriptions = await getAllSubscriptions();

  let sent = 0;
  const errors = [];

  for (const sub of subscriptions) {
    try {
      await sendPushNotification(sub, notification);
      sent++;
    } catch (e) {
      errors.push({ endpoint: sub.endpoint, error: e.message });

      if (e.statusCode === 410 || e.statusCode === 404) {
        await removeSubscription(sub.user_id, sub.endpoint);
      }
    }
  }

  console.log(`[Push] Broadcast: ${sent}/${subscriptions.length} sent`);
  return { sent, total: subscriptions.length, errors };
}

async function sendPushNotification(subscription, notification) {
  var { endpoint, p256dh, auth } = subscription;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not configured, skipping push to ' + endpoint.slice(0, 50));
    return { success: false, reason: 'no_vapid_keys' };
  }

  try {
    var webPush = require('web-push');
    webPush.setVapidDetails('mailto:support@kotvuk.ai', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webPush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(notification)
    );
    return { success: true };
  } catch (err) {
    console.error('[Push] Send failed:', err.message);
    throw err;
  }
}

const NotificationTemplates = {
  priceAlert(pair, price, condition) {
    return {
      title: `🔔 ${pair} Alert`,
      body: `${pair} is now ${condition} $${price}`,
      icon: '/icons/icon-192.svg',
      tag: `price-${pair}`,
      url: `/?panel=charts&symbol=${pair}`,
      requireInteraction: false
    };
  },

  tradingSignal(pair, direction, entry) {
    return {
      title: `📊 Signal: ${pair}`,
      body: `${direction.toUpperCase()} at $${entry}`,
      icon: '/icons/icon-192.svg',
      tag: `signal-${pair}`,
      url: `/?panel=ai`,
      requireInteraction: true
    };
  },

  botAction(botName, action, result) {
    return {
      title: `🤖 Bot: ${botName}`,
      body: `${action} - ${result}`,
      icon: '/icons/icon-192.svg',
      tag: `bot-${botName}`,
      url: `/?panel=bots`
    };
  },

  sentimentAlert(symbol, score, label) {
    return {
      title: `🧠 Sentiment: ${symbol}`,
      body: `Score: ${score} (${label})`,
      icon: '/icons/icon-192.svg',
      tag: `sentiment-${symbol}`,
      url: `/?panel=sentiment`
    };
  },

  whaleAlert(pair, amount, side) {
    return {
      title: `🐋 Whale Alert: ${pair}`,
      body: `$${(amount / 1000000).toFixed(2)}M ${side}`,
      icon: '/icons/icon-192.svg',
      tag: `whale-${pair}`,
      url: `/?panel=whale`,
      requireInteraction: true
    };
  },

  tradeClosed(pair, pnl) {
    const emoji = pnl >= 0 ? '✅' : '❌';
    return {
      title: `${emoji} Trade Closed: ${pair}`,
      body: `P&L: $${pnl.toFixed(2)}`,
      icon: '/icons/icon-192.svg',
      tag: `trade-${pair}`,
      url: `/?panel=trades`
    };
  }
};

module.exports = {

  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  getAllSubscriptions,

  sendToUser,
  broadcast,
  sendPushNotification,

  NotificationTemplates,

  VAPID_PUBLIC_KEY
};
