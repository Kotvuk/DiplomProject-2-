const dailyAiUsage = {};

function getAiUsageKey(userId) {
  var today = new Date().toISOString().slice(0, 10);
  return `${userId || 'anon'}_${today}`;
}

function checkAiLimit(req, res) {
  const plan = req.user?.plan || 'Free';
  const limits = { Free: 5, Pro: 50, Premium: -1 };
  const limit = limits[plan];
  if (limit === -1) return true;

  const key = getAiUsageKey(req.userId);
  var used = dailyAiUsage[key] || 0;
  if (used >= limit) {
    res.status(429).json({
      error: 'limit_reached',
      message: plan === 'Free'
        ? 'Вы достигли лимита в 5 AI анализов на бесплатном плане. Перейдите на Pro для 50 анализов в день.'
        : `Вы достигли лимита в ${limit} AI анализов. Перейдите на Premium для безлимитного доступа.`,
      used, limit, plan
    });
    return false;
  }
  dailyAiUsage[key] = used + 1;
  return true;
}

function getAiUsage(userId) {
  const key = getAiUsageKey(userId);
  return dailyAiUsage[key] || 0;
}

module.exports = { checkAiLimit, getAiUsageKey, getAiUsage, dailyAiUsage };
