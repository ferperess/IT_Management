const prisma = require('../prisma');

// async function listar
// Correção Smell: async function listar_ativos
async function listar_ativos(req, res) {
  try {
    const ativos = await prisma.aTIVOS.findMany({ orderBy: { nome: 'asc' } });
    res.json(ativos);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar ativos.' });
  }
}

// async function criar
// Correção Smell: async function criar_ativo
async function criar_ativo(req, res) {
  try {
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
  } catch {
    res.status(500).json({ erro: 'Erro ao criar ativo.' });
  }
}

// async function atualizar
// Correção Smell: async function atualizar_ativo
async function atualizar_ativo(req, res) {
  try {
    const { id } = req.params;
    const { nome, tipo, localizacao, data_aquisicao, status } = req.body;
    const data = { nome, tipo, localizacao, status };
    if (data_aquisicao) data.data_aquisicao = new Date(data_aquisicao);
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    const ativo = await prisma.aTIVOS.update({ where: { id: Number(id) }, data });
    res.json(ativo);
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

// async function remover
// Correção Smell: async function remover_ativo
async function remover_ativo(req, res) {
  try {
    await prisma.aTIVOS.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Ativo removido.' });
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

module.exports = { listar: listar_ativos, criar: criar_ativo, atualizar: atualizar_ativo, remover: remover_ativo };