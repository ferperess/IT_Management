jest.mock('../prisma', () => ({
  $transaction: jest.fn(),
  lOGIN_RATE_LIMITS: {
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const prisma = require('../prisma');
const PostgresRateLimitStore = require('../utils/postgresRateLimitStore');

describe('PostgresRateLimitStore', () => {
  let store;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(callback => callback(prisma));
    prisma.lOGIN_RATE_LIMITS.deleteMany.mockResolvedValue({ count: 0 });
    store = new PostgresRateLimitStore(prisma);
    store.init({ windowMs: 15 * 60 * 1000 });
  });

  test('persists a counter and returns the reset time expected by express-rate-limit', async () => {
    const resetAt = new Date(Date.now() + 15 * 60 * 1000);
    prisma.lOGIN_RATE_LIMITS.upsert.mockResolvedValue({ hits: 1, reset_at: resetAt });

    await expect(store.increment('email-hmac')).resolves.toEqual({ totalHits: 1, resetTime: resetAt });
    expect(prisma.lOGIN_RATE_LIMITS.upsert).toHaveBeenCalledWith({
      where: { key: 'email-hmac' },
      create: { key: 'email-hmac', hits: 1, reset_at: expect.any(Date) },
      update: { hits: { increment: 1 } },
      select: { hits: true, reset_at: true },
    });
  });

  test('decrements successful attempts and can reset a key', async () => {
    await store.decrement('email-hmac');
    expect(prisma.lOGIN_RATE_LIMITS.updateMany).toHaveBeenCalledWith({
      where: { key: 'email-hmac', hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
    await store.resetKey('email-hmac');
    expect(prisma.lOGIN_RATE_LIMITS.deleteMany).toHaveBeenCalledWith({ where: { key: 'email-hmac' } });
  });

  test('ignores expired buckets and deletes them', async () => {
    const expiredAt = new Date(Date.now() - 1000);
    prisma.lOGIN_RATE_LIMITS.findUnique.mockResolvedValue({ hits: 10, reset_at: expiredAt });

    await expect(store.get('email-hmac')).resolves.toBeUndefined();
    expect(prisma.lOGIN_RATE_LIMITS.deleteMany).toHaveBeenCalledWith({
      where: { key: 'email-hmac', reset_at: expiredAt },
    });
  });
});
