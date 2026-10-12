jest.mock('../prisma', () => {
  const records = new Map();
  const prisma = {
    $transaction: jest.fn(callback => callback(prisma)),
    lOGIN_RATE_LIMITS: {
      findUnique: jest.fn(async ({ where }) => records.get(where.key) || null),
      deleteMany: jest.fn(async ({ where } = {}) => {
        let count = 0;
        for (const [key, value] of records) {
          const keyMatches = where?.key === undefined || key === where.key;
          const expiry = where?.reset_at;
          const expiryMatches = !expiry
            || (expiry.lte ? value.reset_at <= expiry.lte : value.reset_at.getTime() === expiry.getTime());
          if (keyMatches && expiryMatches) {
            records.delete(key);
            count += 1;
          }
        }
        return { count };
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const value = records.get(where.key);
        if (value) value.hits += update.hits.increment;
        else records.set(where.key, { hits: create.hits, reset_at: create.reset_at });
        return records.get(where.key);
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const value = records.get(where.key);
        if (value && value.hits > where.hits.gt) value.hits += data.hits.decrement;
        return { count: value ? 1 : 0 };
      }),
    },
  };
  prisma.__records = records;
  return prisma;
});

const express = require('express');
const prisma = require('../prisma');
const { createLoginAccountRateLimit } = require('../middlewares/loginAccountRateLimit');

describe('login account rate limit', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(createLoginAccountRateLimit());
    app.post('/login', (req, res) => {
      res.status(req.body.password === 'correct' ? 200 : 401).json({});
    });
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/login`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  test('shares a 15-minute account bucket across email case variants and stores only HMAC keys', async () => {
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ' Person@example.com ', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
    }
    const tenth = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@EXAMPLE.com', password: 'wrong' }),
    });
    expect(tenth.status).toBe(401);

    const blocked = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com', password: 'correct' }),
    });
    expect(blocked.status).toBe(429);
    expect([...prisma.__records.keys()]).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
    expect([...prisma.__records.keys()][0]).not.toContain('person');
  });
});
