const prisma = require('../prisma');
const {
  STATUS_ATIVO_VALIDOS,
  TIPOS_ATIVO_VALIDOS,
  validarDataPassada,
} = require('../validators');

async function listar_ativos(req, res) {
  try {
    const ativos = await prisma.aTIVOS.findMany({ orderBy: { nome: 'asc' } });
    res.json(ativos);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar ativos.' });
  }
}

async function criar_ativo(req, res) {
  try {
    const { nome, tipo, localizacao, data_aquisicao, status } = req.body;

    if (!nome || !tipo || !localizacao) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, tipo, localizacao.' });
    }

    // Validação de tipo
    if (!TIPOS_ATIVO_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Valores aceitos: ${TIPOS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (status && !STATUS_ATIVO_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Data de aquisição não pode ser futura
    if (data_aquisicao && !validarDataPassada(data_aquisicao)) {
      return res.status(400).json({ erro: 'A data de aquisição não pode ser uma data futura.' });
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

async function atualizar_ativo(req, res) {
  try {
    const { id } = req.params;
    const { nome, tipo, localizacao, data_aquisicao, status } = req.body;

    // Validação de tipo
    if (tipo && !TIPOS_ATIVO_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Valores aceitos: ${TIPOS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (status && !STATUS_ATIVO_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Data de aquisição não pode ser futura
    if (data_aquisicao && !validarDataPassada(data_aquisicao)) {
      return res.status(400).json({ erro: 'A data de aquisição não pode ser uma data futura.' });
    }

    const data = { nome, tipo, localizacao, status };
    if (data_aquisicao) data.data_aquisicao = new Date(data_aquisicao);
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const ativo = await prisma.aTIVOS.update({ where: { id: Number(id) }, data });
    res.json(ativo);
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

async function remover_ativo(req, res) {
  try {
    const id = Number(req.params.id);

    // Impede remoção de ativo vinculado a chamado aberto ou em andamento
    const chamadoAberto = await prisma.cHAMADOS.findFirst({
      where: {
        id_ativo: id,
        status: { in: ['ABERTO', 'EM_ANDAMENTO'] },
      },
    });

    if (chamadoAberto) {
      return res.status(400).json({
        erro: `Ativo não pode ser removido pois está vinculado ao chamado #${chamadoAberto.id} que ainda está em aberto.`,
      });
    }

    await prisma.aTIVOS.delete({ where: { id } });
    res.json({ mensagem: 'Ativo removido.' });
  } catch {
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

module.exports = { listar: listar_ativos, criar: criar_ativo, atualizar: atualizar_ativo, remover: remover_ativo };
