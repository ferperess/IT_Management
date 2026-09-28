const { toId } = require('../utils/ids');
const prisma = require('../prisma');
const {
  STATUS_ATIVO_VALIDOS,
  TIPOS_ATIVO_VALIDOS,
  validarDataPassada,
} = require('../validators');

async function listar_ativos(req, res) {
  try {
    const ativos = await prisma.aTIVOS.findMany({ include: { local: true }, orderBy: { nome: 'asc' } });
    res.json(ativos);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao listar ativos.' });
  }
}

async function criar_ativo(req, res) {
  try {
    const { nome, patrimonio, tipo, id_local, data_aquisicao, status } = req.body;
    if (patrimonio !== undefined && typeof patrimonio !== 'string') return res.status(400).json({ erro: 'Patrimônio deve ser um texto.' });
    const statusNormalizado = status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : status;

    if (!nome || !tipo || !id_local) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, tipo, id_local.' });
    }

    // Validação de tipo
    if (!TIPOS_ATIVO_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Valores aceitos: ${TIPOS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (statusNormalizado && !STATUS_ATIVO_VALIDOS.includes(statusNormalizado)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Data de aquisição não pode ser futura
    if (data_aquisicao && !validarDataPassada(data_aquisicao)) {
      return res.status(400).json({ erro: 'A data de aquisição não pode ser uma data futura.' });
    }

    const local = await prisma.lOCAIS.findUnique({ where: { id: toId(id_local) } });
    if (!local || local.status !== 'ATIVO') return res.status(400).json({ erro: 'Selecione um local ativo.' });
    const ativo = await prisma.aTIVOS.create({
      data: {
        nome,
        patrimonio: patrimonio?.trim() || null,
        tipo,
        id_local: local.id,
        data_aquisicao: data_aquisicao ? new Date(data_aquisicao) : null,
        status: statusNormalizado || 'ATIVO',
      },
    });
    res.status(201).json(ativo);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao criar ativo.' });
  }
}

async function atualizar_ativo(req, res) {
  try {
    const { id } = req.params;
    const { nome, patrimonio, tipo, id_local, data_aquisicao, status } = req.body;
    if (patrimonio !== undefined && typeof patrimonio !== 'string') return res.status(400).json({ erro: 'Patrimônio deve ser um texto.' });
    const statusNormalizado = status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : status;

    // Validação de tipo
    if (tipo && !TIPOS_ATIVO_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Valores aceitos: ${TIPOS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (statusNormalizado && !STATUS_ATIVO_VALIDOS.includes(statusNormalizado)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_ATIVO_VALIDOS.join(', ')}.` });
    }

    // Data de aquisição não pode ser futura
    if (data_aquisicao && !validarDataPassada(data_aquisicao)) {
      return res.status(400).json({ erro: 'A data de aquisição não pode ser uma data futura.' });
    }

    const data = { nome, tipo, status: statusNormalizado };
    if (id_local !== undefined) {
      const localId = toId(id_local);
      const atual = await prisma.aTIVOS.findUnique({ where: { id: toId(id) } });
      if (!atual) return res.status(404).json({ erro: 'Ativo não encontrado.' });
      // Um vínculo inativo existente pode ser mantido, mas não atribuído a outro ativo.
      if (atual.id_local !== localId) {
        const local = await prisma.lOCAIS.findUnique({ where: { id: localId } });
        if (!local || local.status !== 'ATIVO') return res.status(400).json({ erro: 'Selecione um local ativo.' });
      }
      data.id_local = localId;
    }
    if (patrimonio !== undefined) data.patrimonio = patrimonio.trim() || null;
    if (data_aquisicao) data.data_aquisicao = new Date(data_aquisicao);
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const ativo = await prisma.aTIVOS.update({ where: { id: toId(id) }, data });
    res.json(ativo);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

async function remover_ativo(req, res) {
  try {
    const id = toId(req.params.id);

    const [chamado, documentacao] = await Promise.all([
      prisma.cHAMADOS.findFirst({ where: { id_ativo: id } }),
      prisma.dOCUMENTACOES.findFirst({ where: { id_ativo: id }, select: { id: true } }),
    ]);

    if (chamado && ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_USUARIO'].includes(chamado.status)) {
      return res.status(400).json({
        erro: `Ativo não pode ser removido pois está vinculado ao chamado #${chamado.id} que ainda está em aberto.`,
      });
    }
    if (chamado || documentacao) return res.status(409).json({ erro: 'Ativo possui vínculos históricos e não pode ser removido. Altere o status para Inativo/Baixado.' });

    await prisma.aTIVOS.delete({ where: { id } });
    res.json({ mensagem: 'Ativo removido.' });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Ativo não encontrado.' });
  }
}

module.exports = { listar: listar_ativos, criar: criar_ativo, atualizar: atualizar_ativo, remover: remover_ativo };
