const { toId } = require('../utils/ids');
const prisma = require('../prisma');

async function listar(req, res) {
  try {
    const categorias = await prisma.cATEGORIA_DOC.findMany({ where: { status: 'ATIVO' }, orderBy: { nome: 'asc' } });
    res.json(categorias);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar categorias.' });
  }
}

async function criar(req, res) {
  try {
    const { nome } = req.body || {};
    if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da categoria.' });
    const nomeLimpo = nome.trim();
    const existente = await prisma.cATEGORIA_DOC.findFirst({ where: { nome: { equals: nomeLimpo, mode: 'insensitive' } } });
    if (existente) {
      return res.status(409).json({ erro: existente.status === 'ATIVO' ? 'Esta categoria já está cadastrada.' : 'Esta categoria já existe, porém está inativa.' });
    }
    const categoria = await prisma.cATEGORIA_DOC.create({ data: { nome: nomeLimpo } });
    res.status(201).json(categoria);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Esta categoria já está cadastrada.' });
    res.status(500).json({ erro: 'Erro ao cadastrar categoria.' });
  }
}

async function inativar(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ erro: 'Selecione ao menos uma categoria.' });
    const lista = ids.map(toId);
    await prisma.cATEGORIA_DOC.updateMany({ where: { id: { in: lista } }, data: { status: 'INATIVO' } });
    res.json({ mensagem: 'Categorias inativadas.' });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao inativar categorias.' });
  }
}

module.exports = { listar, criar, inativar };
