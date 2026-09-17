const MAX_ID = 9223372036854775807n;
function toId(value) {
  // Números antigos são aceitos somente quando não perderam precisão.
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return invalid();
  if (!['string', 'number', 'bigint'].includes(typeof value)) return invalid();
  const text = String(value);
  if (!/^[0-9]+$/.test(text)) return invalid();
  const id = BigInt(text);
  if (id < 1n || id > MAX_ID) return invalid();
  return id;
}
function invalid() {
  const error = new Error('Identificador inválido. Envie um inteiro positivo como texto.');
  error.code = 'INVALID_ID';
  throw error;
}
function jsonReplacer(key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}
module.exports = { toId, jsonReplacer };
