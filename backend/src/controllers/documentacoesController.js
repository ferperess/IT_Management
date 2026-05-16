const prisma = require('../prisma');

// async function listar
// Correção Smell: async function listar_documentacoes
async function listar_documentacoes(req, res) {
  try {
    const docs = await prisma.dOCUMENTACOES.findMany({
      include: { responsavel: { select: { id: true, nome: true } } },
      orderBy: { criado_em: 'desc' },
    });
    res.json(docs);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar documentações.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const doc = await prisma.dOCUMENTACOES.findUnique({
      where: { id: Number(req.params.id) },
      include: { responsavel: { select: { nome: true } } },
    });
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    res.json(doc);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar documento.' });
  }
}

// async function criar
// Correção Smell: async function criar_documentacao
async function criar_documentacao(req, res) {
  try {
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
  } catch {
    res.status(500).json({ erro: 'Erro ao criar documento.' });
  }
}

// async function atualizar
// Correção Smell: async function atualizar_documentacao
async function atualizar_documentacao(req, res) {
  try {
    const { id } = req.params;
    const { titulo, descricao, link_externo } = req.body;
    const data = { titulo, descricao, link_externo };
    if (req.file) data.arquivo_nome = req.file.originalname;
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    const doc = await prisma.dOCUMENTACOES.update({ where: { id: Number(id) }, data });
    res.json(doc);
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

// async function remover
// Correção Smell: async function remover_documentacao
async function remover_documentacao(req, res) {
  try {
    await prisma.dOCUMENTACOES.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Documento removido.' });
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

module.exports = { listar: listar_documentacoes, buscarPorId, criar: criar_documentacao, atualizar: atualizar_documentacao, remover: remover_documentacao };