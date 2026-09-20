const { hash, verify, Algorithm, Version } = require('@node-rs/argon2');
const bcrypt = require('bcryptjs');

// OWASP: Argon2id, 19 MiB, duas iterações e paralelismo 1.
const options = Object.freeze({ algorithm: Algorithm.Argon2id, version: Version.V0x13,
  memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });

async function hashPassword(password) {
  if (typeof password !== 'string' || !password.length) throw new TypeError('Senha inválida.');
  return hash(password, options); // A biblioteca gera um salt aleatório individual.
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('$argon2id$')) return verify(storedHash, password);
  if (/^\$2[ab]\$/.test(storedHash)) return bcrypt.compare(password, storedHash);
  return false;
}

function needsMigration(password, storedHash) {
  // bcrypt considera apenas 72 bytes. Não fixa um sufixo arbitrário durante a migração.
  // Senhas legadas maiores migram quando forem explicitamente alteradas.
  return /^\$2[ab]\$/.test(storedHash) && Buffer.byteLength(password, 'utf8') <= 72;
}

module.exports = { hashPassword, verifyPassword, needsMigration };
