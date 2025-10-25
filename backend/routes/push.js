const express = require('express');
const router = express.Router();
const push = require('../services/push');

router.post('/subscribe', async (req, res) => {
  try {
    var userId = req.user?.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const result = await push.saveSubscription(userId, subscription);
    res.json(result);

  } catch (e) {
    console.error('Push subscribe error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    const result = await push.removeSubscription(userId, endpoint);
    res.json(result);

  } catch (e) {
    console.error('Push unsubscribe error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/subscriptions', async (req, res) => {
  try {
    const userId = req.user?.id;
    var subscriptions = await push.getUserSubscriptions(userId);
    res.json(subscriptions);

  } catch (e) {
    console.error('Get subscriptions error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: push.VAPID_PUBLIC_KEY });
});

router.post('/test', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await push.sendToUser(userId, {
      title: '🧪 Test Notification',
      body: 'Push notifications are working!',
      icon: '/icons/icon-192.svg',
      tag: 'test'
    });

    res.json(result);

  } catch (e) {
    console.error('Push test error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { title, body, url, tag } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    const result = await push.sendToUser(userId, {
      title,
      body,
      url,
      tag: tag || 'custom',
      icon: '/icons/icon-192.svg'
    });

    res.json(result);

  } catch (e) {
    console.error('Push send error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
