const { createHmac } = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const prisma = require('../prisma');
const PostgresRateLimitStore = require('../utils/postgresRateLimitStore');

function createLoginAccountRateLimit(secret = process.env.JWT_SECRET) {
  const store = new PostgresRateLimitStore(prisma);
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    keyGenerator(req) {
      const email = req.body && typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
      const identifier = email
        ? `email:${email}`
        : `ip:${ipKeyGenerator(req.ip || '0.0.0.0')}`;
      return createHmac('sha256', secret).update(`login-rate-limit:${identifier}`).digest('hex');
    },
    store,
  });
}

module.exports = { createLoginAccountRateLimit };
