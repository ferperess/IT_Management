const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

async function listar(req, res) {
  try {
    const { busca } = req.query;
    const where = busca
      ? { OR: [{ nome: { contains: busca } }, { email: { contains: busca } }] }
      : {};
    const usuarios = await prisma.uSUARIOS.findMany({
      where,
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true, criado_em: true },
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const u = await prisma.uSUARIOS.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(u);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar usuário.' });
  }
}

async function criar(req, res) {
  try {
    const { nome, email, username, senha, perfil, status } = req.body;
    if (!nome || !email || !username || !senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, username, senha.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const u = await prisma.uSUARIOS.create({
      data: { nome, email, username, senha_hash: hash, perfil: perfil || 'COMUM', status: status || 'ATIVO' },
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    res.status(201).json(u);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ erro: 'Email ou username já em uso.' });
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
}

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { nome, email, username, senha, perfil, status } = req.body;
    const data = { nome, email, username, perfil, status };
    if (senha) data.senha_hash = await bcrypt.hash(senha, 10);
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const u = await prisma.uSUARIOS.update({
      where: { id: Number(id) },
      data,
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    res.json(u);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (e.code === 'P2002') return res.status(409).json({ erro: 'Email ou username já em uso.' });
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
}

async function inativar(req, res) {
  try {
    await prisma.uSUARIOS.update({ where: { id: Number(req.params.id) }, data: { status: 'INATIVO' } });
    res.json({ mensagem: 'Usuário inativado.' });
  } catch {
    res.status(404).json({ erro: 'Usuário não encontrado.' });
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, inativar };