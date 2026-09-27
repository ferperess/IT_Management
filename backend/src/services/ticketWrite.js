const prisma = require('../prisma');
const { toId } = require('../utils/ids');
const { encerrado } = require('./slaService');
function falha(status, message) { return Object.assign(new Error(message), { httpStatus: status }); }

// Serializa transações curtas que alteram chamados ou documentos, inclusive entre
// instâncias da Vercel, impedindo edição indireta durante a conclusão de um chamado.
function escrever(fn) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(731025, 1)`;
    return fn(tx);
  }, { maxWait: 10000, timeout: 15000 });
}
function idsRecebidos(value) {
  let values = value;
  if (typeof values === 'string') { try { values = JSON.parse(values); } catch { throw falha(400, 'A lista de vínculos é inválida.'); } }
  if (!Array.isArray(values) || values.length > 200) throw falha(400, 'Informe uma lista com até 200 vínculos.');
  return [...new Set(values.map(v => toId(v).toString()))].map(BigInt);
}
async function validarChamados(tx, ids) {
  const lista = await tx.cHAMADOS.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
  if (lista.length !== ids.length) throw falha(400, 'Um dos chamados não existe.');
  if (lista.some(c => encerrado(c.status))) throw falha(409, 'Não é permitido alterar vínculos de chamados concluídos ou cancelados.');
}
module.exports = { escrever, falha, idsRecebidos, validarChamados };
