const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listar(req, res) {
  const docs = await prisma.dOCUMENTACOES.findMany({
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: { criado_em: 'desc' },
  });
  res.json(docs);
}

async function buscarPorId(req, res) {
  const doc = await prisma.dOCUMENTACOES.findUnique({
    where: { id: Number(req.params.id) },
    include: { responsavel: { select: { nome: true } } },
  });
  if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
  res.json(doc);
}

async function criar(req, res) {
  const { titulo, descricao, link_externo } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título obrigatório.' });
  const doc = await prisma.dOCUMENTACOES.create({
    data: {
      titulo,
      descricao,
      link_externo,
      arquivo_nome: req.file ? req.file.originalname : null,
      id_responsavel: req.usuario.id,
    },
    include: { responsavel: { select: { nome: true } } },
  });
  res.status(201).json(doc);
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { titulo, descricao, link_externo } = req.body;
  const data = { titulo, descricao, link_externo };
  if (req.file) data.arquivo_nome = req.file.originalname;
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  try {
    const doc = await prisma.dOCUMENTACOES.update({ where: { id: Number(id) }, data });
    res.json(doc);
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

async function remover(req, res) {
  try {
    await prisma.dOCUMENTACOES.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Documento removido.' });
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
