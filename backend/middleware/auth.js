const db = require('../config/database');
const { verifyAccessToken } = require('../utils/crypto');

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;

  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(auth.slice(7));

      if (payload && payload.id) {
        req.userId = payload.id;

        const user = await db.getOne(
          'SELECT id, name, email, plan, is_admin, two_factor_enabled FROM users WHERE id = $1',
          [payload.id]
        );

        if (user) {
          req.user = {
            ...user,
            two_factor_enabled: !!user.two_factor_enabled
          };
        }
      }
    } catch (e) {

    }
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlan(...plans) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        error: `This feature requires ${plans.join(' or ')} plan`,
        currentPlan: req.user.plan,
        requiredPlans: plans
      });
    }

    next();
  };
}

module.exports = { authMiddleware, requireAdmin, requireAuth, requirePlan };
