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
    if (!patrimonio?.trim()) return res.status(400).json({ erro: 'Patrimônio é obrigatório.' });
    const patrimonioNormalizado = patrimonio.trim();
    const existente = await prisma.aTIVOS.findFirst({ where: { patrimonio: patrimonioNormalizado }, select: { nome: true, patrimonio: true } });
    if (existente) return res.status(409).json({ erro: `Ativo ${existente.nome} já possui o patrimônio ${existente.patrimonio}` });

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
        patrimonio: patrimonioNormalizado,
        tipo,
        id_local: local.id,
        data_aquisicao: data_aquisicao ? new Date(data_aquisicao) : null,
        status: statusNormalizado || 'ATIVO',
      },
    });
    res.status(201).json(ativo);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    if (err.code === 'P2002') {
      // Uma segunda requisição pode ter gravado o mesmo patrimônio após a consulta.
      try {
        const existente = await prisma.aTIVOS.findFirst({ where: { patrimonio: req.body.patrimonio.trim() }, select: { nome: true, patrimonio: true } });
        if (existente) return res.status(409).json({ erro: `Ativo ${existente.nome} já possui o patrimônio ${existente.patrimonio}` });
      } catch { /* Mantém o erro de conflito mesmo se a consulta falhar. */ }
      return res.status(409).json({ erro: 'Este patrimônio já foi cadastrado. Verifique o número informado.' });
    }
    res.status(500).json({ erro: 'Erro ao criar ativo.' });
  }
}

async function atualizar_ativo(req, res) {
  try {
    const { id } = req.params;
    const permitidos = ['status', 'id_local'];
    const camposRecebidos = Object.keys(req.body || {});
    if (camposRecebidos.some(campo => !permitidos.includes(campo))) {
      return res.status(400).json({ erro: 'Somente status e localização podem ser alterados.' });
    }
    if (!camposRecebidos.length) return res.status(400).json({ erro: 'Informe um status ou uma localização para atualizar.' });

    const { id_local, status } = req.body;
    const statusNormalizado = status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : status;
    if (statusNormalizado !== undefined && !STATUS_ATIVO_VALIDOS.includes(statusNormalizado)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_ATIVO_VALIDOS.join(', ')}.` });
    }

    const ativoId = toId(id);
    const atual = await prisma.aTIVOS.findUnique({ where: { id: ativoId }, include: { local: true } });
    if (!atual) return res.status(404).json({ erro: 'Ativo não encontrado.' });

    const data = {};
    const eventos = [];
    const statusAtual = atual.status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : atual.status;
    if (statusNormalizado !== undefined && statusNormalizado !== statusAtual) {
      data.status = statusNormalizado;
      eventos.push(`Status alterado de ${statusAtual} para ${statusNormalizado}.`);
    }
    if (id_local !== undefined) {
      const localId = toId(id_local);
      if (atual.id_local !== localId) {
        const local = await prisma.lOCAIS.findUnique({ where: { id: localId } });
        if (!local || local.status !== 'ATIVO') return res.status(400).json({ erro: 'Selecione um local ativo.' });
        data.id_local = localId;
        eventos.push(`Localização alterada de ${atual.local?.nome || 'não informada'} para ${local.nome}.`);
      }
    }

    if (!eventos.length) return res.json(atual);

    const ativo = await prisma.$transaction(async tx => {
      const atualizado = await tx.aTIVOS.update({
        where: { id: ativoId },
        data,
        include: { local: true },
      });
      await tx.hISTORICO_ATIVOS.create({
        data: {
          id_ativo: ativoId,
          id_usuario: req.usuario.id,
          comentario: eventos.join('\n'),
        },
      });
      return atualizado;
    });
    res.json(ativo);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao atualizar ativo.' });
  }
}

async function historico_ativo(req, res) {
  try {
    const id = toId(req.params.id);
    const ativo = await prisma.aTIVOS.findUnique({ where: { id }, select: { id: true } });
    if (!ativo) return res.status(404).json({ erro: 'Ativo não encontrado.' });

    const historico = await prisma.hISTORICO_ATIVOS.findMany({
      where: { id_ativo: id },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criado_em: 'desc' },
    });
    res.json(historico);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao buscar histórico do ativo.' });
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

module.exports = { listar: listar_ativos, criar: criar_ativo, atualizar: atualizar_ativo, historico: historico_ativo, remover: remover_ativo };
