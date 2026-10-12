class PostgresRateLimitStore {
  constructor(prisma, cleanupIntervalMs = 5 * 60 * 1000) {
    this.prisma = prisma;
    this.windowMs = 15 * 60 * 1000;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.lastCleanupAt = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async get(key) {
    const bucket = await this.prisma.lOGIN_RATE_LIMITS.findUnique({
      where: { key },
      select: { hits: true, reset_at: true },
    });
    if (!bucket) return undefined;
    if (bucket.reset_at <= new Date()) {
      await this.prisma.lOGIN_RATE_LIMITS.deleteMany({ where: { key, reset_at: bucket.reset_at } });
      return undefined;
    }
    return { totalHits: bucket.hits, resetTime: bucket.reset_at };
  }

  async increment(key) {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const shouldCleanup = now.getTime() - this.lastCleanupAt >= this.cleanupIntervalMs;
    const bucket = await this.prisma.$transaction(async tx => {
      await tx.lOGIN_RATE_LIMITS.deleteMany({ where: { key, reset_at: { lte: now } } });
      if (shouldCleanup) {
        await tx.lOGIN_RATE_LIMITS.deleteMany({ where: { reset_at: { lte: now } } });
      }
      return tx.lOGIN_RATE_LIMITS.upsert({
        where: { key },
        create: { key, hits: 1, reset_at: resetAt },
        update: { hits: { increment: 1 } },
        select: { hits: true, reset_at: true },
      });
    });
    if (shouldCleanup) this.lastCleanupAt = now.getTime();
    return { totalHits: bucket.hits, resetTime: bucket.reset_at };
  }

  async decrement(key) {
    await this.prisma.lOGIN_RATE_LIMITS.updateMany({
      where: { key, hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
  }

  async resetKey(key) {
    await this.prisma.lOGIN_RATE_LIMITS.deleteMany({ where: { key } });
  }

  async resetAll() {
    await this.prisma.lOGIN_RATE_LIMITS.deleteMany();
  }

  async shutdown() {}
}

module.exports = PostgresRateLimitStore;
