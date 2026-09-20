const bcrypt = require('bcryptjs');
const { hashPassword, verifyPassword, needsMigration } = require('../utils/passwords');

test('Argon2id usa parâmetros previstos, salt individual e verifica a senha', async () => {
  const a = await hashPassword('Senha-segura-123');
  const b = await hashPassword('Senha-segura-123');
  expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(a).not.toBe(b);
  expect(await verifyPassword('Senha-segura-123', a)).toBe(true);
  expect(await verifyPassword('incorreta', a)).toBe(false);
  expect(needsMigration('Senha-segura-123', a)).toBe(false);
});

test('bcrypt continua válido e elegível para migração', async () => {
  const stored = await bcrypt.hash('legada123', 10);
  expect(await verifyPassword('legada123', stored)).toBe(true);
  expect(await verifyPassword('errada', stored)).toBe(false);
  expect(needsMigration('legada123', stored)).toBe(true);
});

test('senhas longas distinguem sufixos em Argon2id; bcrypt longo não migra implicitamente', async () => {
  const password = 'á'.repeat(40);
  const stored = await hashPassword(password + 'a');
  expect(await verifyPassword(password + 'b', stored)).toBe(false);
  expect(needsMigration(password, '$2b$10$legado')).toBe(false);
});

test('entradas inválidas não autenticam', async () => {
  expect(await verifyPassword({}, 'hash')).toBe(false);
  expect(await verifyPassword('senha', 'hash-desconhecido')).toBe(false);
  await expect(hashPassword(null)).rejects.toThrow();
});
