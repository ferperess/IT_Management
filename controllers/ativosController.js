const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listar(req, res) {
  const ativos = await prisma.aTIVOS.findMany({ orderBy: { nome: 'asc' } });
  res.json(ativos);
}

async function criar(req, res) {
  const { nome, tipo, localizacao, data_aquisicao, status } = req.body;
  if (!nome || !tipo || !localizacao) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, tipo, localizacao.' });
  }
  const ativo = await prisma.aTIVOS.create({
    data: {
      nome,
      tipo,
      localizacao,
      data_aquisicao: data_aquisicao ? new Date(data_aquisicao) : null,
      status: status || 'ATIVO',
    },
  });
  res.status(201).json(ativo);
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, tipo, localizacao, data_aquisicao, status } = req.body;
  const data = { nome, tipo, localizacao, status };
  if (data_aquisicao) data.data_aquisicao = new Date(data_aquisicao);
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

  try {
    const ativo = await prisma.aTIVOS.update({ where: { id: Number(id) }, data });
    res.json(ativo);
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

async function remover(req, res) {
  const { id } = req.params;
  try {
    await prisma.aTIVOS.delete({ where: { id: Number(id) } });
    res.json({ mensagem: 'Ativo removido.' });
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

module.exports = { listar, criar, atualizar, remover };
