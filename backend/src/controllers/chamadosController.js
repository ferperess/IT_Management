const { toId } = require('../utils/ids');
const prisma = require('../prisma');
const { classificarChamado } = require('../services/apiService');
const {
  STATUS_CHAMADO_VALIDOS,
  PRIORIDADES_VALIDAS,
  CATEGORIAS_VALIDAS,
  validarTransicaoStatus,
} = require('../validators');

const include = {
  solicitante: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true } },
  tecnico: { select: { id: true, nome: true } },
  historico: { include: { usuario: { select: { nome: true } } }, orderBy: { criado_em: 'asc' } },
};

async function listar_chamados(req, res) {
  try {
    const { perfil, id } = req.usuario;
    const where = perfil === 'COMUM' ? { id_solicitante: id } : {};
    const chamados = await prisma.cHAMADOS.findMany({ where, include, orderBy: { criado_em: 'desc' } });
    res.json(chamados);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao listar chamados.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const c = await prisma.cHAMADOS.findUnique({ where: { id: toId(req.params.id) }, include });
    if (!c) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil === 'COMUM' && c.id_solicitante !== req.usuario.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }
    res.json(c);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao buscar chamado.' });
  }
}

async function criar_chamado(req, res) {
  try {
    const { titulo, descricao, id_ativo } = req.body;
    const id_solicitante = req.usuario.id;

    if (!titulo || !descricao) {
      return res.status(400).json({ erro: 'Campos obrigatórios: titulo, descricao.' });
    }
    if (titulo.trim().length < 5) {
      return res.status(400).json({ erro: 'O título deve ter no mínimo 5 caracteres.' });
    }
    if (descricao.trim().length < 10) {
      return res.status(400).json({ erro: 'A descrição deve ter no mínimo 10 caracteres.' });
    }

    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: toId(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
      if (ativo.status === 'MANUTENCAO') {
        return res.status(400).json({ erro: 'O ativo selecionado está em manutenção e não pode ser vinculado a um novo chamado.' });
      }
    }

    const solicitante = await prisma.uSUARIOS.findUnique({ where: { id: id_solicitante } });
    if (!solicitante) return res.status(400).json({ erro: 'Solicitante inválido.' });

    let prioridade = 'MEDIA';
    let categoria = 'OUTRO';
    let aviso = null;
    try {
      const classificacao = await classificarChamado(titulo, descricao);
      prioridade = classificacao.prioridade;
      categoria = classificacao.categoria;
    } catch (iaErr) {
      aviso = 'Classificação automática indisponível. Prioridade Média e categoria Outro são provisórias e precisam de revisão pela equipe técnica.';
      console.warn('[classificacao] Revisão manual necessária:', iaErr.code || 'ERRO_INTERNO');
    }

    const chamado = await prisma.cHAMADOS.create({
      data: { titulo, descricao, prioridade, categoria, id_solicitante, id_ativo: id_ativo ? toId(id_ativo) : null },
      include,
    });

    const historicoAbertura = await prisma.hISTORICO_CHAMADOS.create({
      data: {
        id_chamado: chamado.id,
        id_usuario: id_solicitante,
        comentario: `Chamado aberto por ${solicitante.nome}.${aviso ? ` ${aviso}` : ''}`,
        status_novo: 'ABERTO',
      },
      include: { usuario: { select: { nome: true } } },
    });

    // O aviso também fica no histórico persistido, disponível após recarregar.
    res.status(201).json({
      ...chamado,
      historico: [...(chamado.historico || []), historicoAbertura],
      aviso,
    });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao criar chamado.' });
  }
}

async function atualizar_chamado(req, res) {
  try {
    const { id } = req.params;
    const { status, prioridade, categoria, id_tecnico, comentario } = req.body;

    const chamado = await prisma.cHAMADOS.findUnique({ where: { id: toId(id) } });
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (['CONCLUIDO', 'CANCELADO'].includes(chamado.status)) {
      return res.status(409).json({ erro: 'Chamados concluídos ou cancelados são somente leitura e não podem ser alterados.' });
    }

    if (status) {
      if (!STATUS_CHAMADO_VALIDOS.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_CHAMADO_VALIDOS.join(', ')}.` });
      }
      if (status !== chamado.status && !validarTransicaoStatus(chamado.status, status)) {
        return res.status(400).json({
          erro: `Transição de status inválida: não é possível mover de "${chamado.status}" para "${status}".`,
        });
      }
    }

    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) {
      return res.status(400).json({ erro: `Prioridade inválida. Valores aceitos: ${PRIORIDADES_VALIDAS.join(', ')}.` });
    }

    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
      return res.status(400).json({ erro: `Categoria inválida. Valores aceitos: ${CATEGORIAS_VALIDAS.join(', ')}.` });
    }

    if (id_tecnico) {
      const tecnico = await prisma.uSUARIOS.findUnique({ where: { id: toId(id_tecnico) } });
      if (!tecnico) return res.status(400).json({ erro: 'Técnico não encontrado.' });
      if (!['TECNICO', 'ADMIN'].includes(tecnico.perfil)) {
        return res.status(400).json({ erro: 'O usuário selecionado não possui perfil de Técnico ou Administrador.' });
      }
      if (tecnico.status === 'INATIVO') {
        return res.status(400).json({ erro: 'Não é possível atribuir um chamado a um usuário inativo.' });
      }
    }

    const data = {};
    if (status) data.status = status;
    if (prioridade) data.prioridade = prioridade;
    if (categoria) data.categoria = categoria;
    if (id_tecnico !== undefined) data.id_tecnico = id_tecnico ? toId(id_tecnico) : null;

    // A condição é conferida também na escrita: protege contra conclusão ou cancelamento
    // em outra sessão entre a leitura inicial e o salvamento. O histórico e
    // a atualização são confirmados juntos, sob o mesmo bloqueio da linha.
    const updated = await prisma.$transaction(async tx => {
      await tx.cHAMADOS.update({
        where: { id: toId(id), status: chamado.status },
        data: { ...data, atualizado_em: new Date() },
      });
      if (comentario || status) {
        await tx.hISTORICO_CHAMADOS.create({
          data: {
            id_chamado: toId(id),
            id_usuario: req.usuario.id,
            comentario: comentario || `Status alterado para ${status}.`,
            status_novo: status || null,
          },
        });
      }
      return tx.cHAMADOS.findUnique({ where: { id: toId(id) }, include });
    });

    res.json(updated);
  } catch (erro) {
    if (erro.code === 'INVALID_ID') return res.status(400).json({ erro: erro.message });
    if (erro.code === 'P2025') {
      return res.status(409).json({ erro: 'O chamado foi alterado em outra sessão. Reabra os detalhes antes de tentar novamente.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar chamado.' });
  }
}

async function dashboard(req, res) {
  try {
    const [abertos, andamento, concluidos, totalAtivos] = await Promise.all([
      prisma.cHAMADOS.count({ where: { status: 'ABERTO' } }),
      prisma.cHAMADOS.count({ where: { status: 'EM_ANDAMENTO' } }),
      prisma.cHAMADOS.count({ where: { status: 'CONCLUIDO' } }),
      prisma.aTIVOS.count(),
    ]);
    res.json({ abertos, andamento, concluidos, totalAtivos });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao carregar dashboard.' });
  }
}

async function relatorios(req, res) {
  try {
    const { dataInicio, dataFim } = req.query;

    const where = {};
    if (dataInicio || dataFim) {
      where.criado_em = {};
      if (dataInicio) where.criado_em.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.criado_em.lte = fim;
      }
    }

    const totalPeriodo = await prisma.cHAMADOS.count({ where });

    const porCategoria = await prisma.cHAMADOS.groupBy({
      by: ['categoria'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const porPrioridade = await prisma.cHAMADOS.groupBy({
      by: ['prioridade'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const porStatus = await prisma.cHAMADOS.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const rankingAtivos = await prisma.cHAMADOS.groupBy({
      by: ['id_ativo'],
      where: { ...where, id_ativo: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const idsAtivos = rankingAtivos.map(r => r.id_ativo);
    const ativos = await prisma.aTIVOS.findMany({
      where: { id: { in: idsAtivos } },
      select: { id: true, nome: true, tipo: true },
    });
    const rankingAtivosComNome = rankingAtivos.map(r => ({
      ...ativos.find(a => a.id === r.id_ativo),
      total_chamados: r._count.id,
    }));

    const concluidos = await prisma.cHAMADOS.findMany({
      where: { ...where, status: 'CONCLUIDO', id_tecnico: { not: null } },
      select: {
        id_tecnico: true,
        tecnico: { select: { nome: true } },
        criado_em: true,
        atualizado_em: true,
      },
    });

    const temposPorTecnico = {};
    concluidos.forEach(c => {
      if (!c.atualizado_em) return; // Registros legados podem não ter essa data.
      const key = c.id_tecnico;
      const diff = (new Date(c.atualizado_em) - new Date(c.criado_em)) / (1000 * 60 * 60);
      if (!temposPorTecnico[key]) {
        temposPorTecnico[key] = { nome: c.tecnico.nome, total: 0, soma: 0 };
      }
      temposPorTecnico[key].total++;
      temposPorTecnico[key].soma += diff;
    });

    const tempoMedioPorTecnico = Object.values(temposPorTecnico).map(t => ({
      tecnico: t.nome,
      chamados_concluidos: t.total,
      tempo_medio_horas: Math.round((t.soma / t.total) * 10) / 10,
    })).sort((a, b) => a.tempo_medio_horas - b.tempo_medio_horas);

    res.json({
      periodo: { dataInicio: dataInicio || null, dataFim: dataFim || null },
      totalPeriodo,
      porCategoria: porCategoria.map(r => ({ categoria: r.categoria, total: r._count.id })),
      porPrioridade: porPrioridade.map(r => ({ prioridade: r.prioridade, total: r._count.id })),
      porStatus: porStatus.map(r => ({ status: r.status, total: r._count.id })),
      rankingAtivos: rankingAtivosComNome,
      tempoMedioPorTecnico,
    });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao gerar relatórios.' });
  }
}

module.exports = { listar: listar_chamados, buscarPorId, criar: criar_chamado, atualizar: atualizar_chamado, dashboard, relatorios };
