const { comSla, calcularSla, prazosIniciais, encerrado } = require('../services/slaService');
const { escrever, falha, idsRecebidos } = require('../services/ticketWrite');
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
  aberto_por: { select: { id: true, nome: true } },
  solicitante: { select: { id: true, nome: true } },
  local: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true, local: { select: { id: true, nome: true } } } },
  tecnico: { select: { id: true, nome: true } },
  pausas_sla: { orderBy: { iniciado_em: 'asc' } },
  documentos_vinculados: { include: { documentacao: { select: { id: true, titulo: true, descricao: true, arquivo_nome: true, link_externo: true } } } },
  historico: { include: { usuario: { select: { nome: true } } }, orderBy: { criado_em: 'asc' } },
};

function apresentarChamado(chamado, usuario) {
  const resposta = comSla(chamado);
  if (usuario?.perfil !== 'USER') return resposta;
  delete resposta.sla;
  delete resposta.prazo_atendimento_em;
  delete resposta.prazo_resolucao_em;
  delete resposta.pausas_sla;
  delete resposta.documentos_vinculados;
  delete resposta.ativo;
  return resposta;
}

async function listar_chamados(req, res) {
  try {
    const { perfil, id } = req.usuario;
    const where = perfil === 'USER' ? { id_solicitante: id } : {};
    const chamados = await prisma.cHAMADOS.findMany({ where, include: { aberto_por: include.aberto_por, solicitante: include.solicitante, local: include.local, ativo: include.ativo, tecnico: include.tecnico, pausas_sla: include.pausas_sla }, orderBy: { criado_em: 'desc' } });
    res.json(chamados.map(chamado => apresentarChamado(chamado, req.usuario)));
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao listar chamados.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const c = await prisma.cHAMADOS.findUnique({ where: { id: toId(req.params.id) }, include });
    if (!c) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil === 'USER' && c.id_solicitante !== req.usuario.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }
    res.json(apresentarChamado(c, req.usuario));
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao buscar chamado.' });
  }
}

async function criar_chamado(req, res) {
  try {
    const { titulo, descricao, id_local, id_ativo, exige_confirmacao = false } = req.body;
    if (typeof exige_confirmacao !== 'boolean') return res.status(400).json({ erro: 'Confirmação do solicitante deve ser verdadeiro ou falso.' });
    const id_aberto_por = req.usuario.id;
    let id_solicitante = id_aberto_por;
    if (req.body.id_solicitante !== undefined) {
      if (req.usuario.perfil !== 'ADMIN') return res.status(403).json({ erro: 'Somente administradores podem escolher outro solicitante.' });
      id_solicitante = toId(req.body.id_solicitante);
    }

    if (!titulo || !descricao) {
      return res.status(400).json({ erro: 'Campos obrigatórios: titulo, descricao.' });
    }
    if (titulo.trim().length < 5) {
      return res.status(400).json({ erro: 'O título deve ter no mínimo 5 caracteres.' });
    }
    if (descricao.trim().length < 10) {
      return res.status(400).json({ erro: 'A descrição deve ter no mínimo 10 caracteres.' });
    }
    if (!id_local) return res.status(400).json({ erro: 'Selecione a localização do problema.' });

    const local = await prisma.lOCAIS.findUnique({ where: { id: toId(id_local) } });
    if (!local || local.status !== 'ATIVO') return res.status(400).json({ erro: 'Selecione uma localização ativa.' });

    if (id_ativo) {
      if (req.usuario.perfil === 'USER') return res.status(403).json({ erro: 'Seu perfil não pode vincular um ativo ao chamado.' });
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: toId(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
      if (['MANUTENCAO', 'EM_MANUTENCAO'].includes(ativo.status)) {
        return res.status(400).json({ erro: 'O ativo selecionado está em manutenção e não pode ser vinculado a um novo chamado.' });
      }
    }

    const solicitante = await prisma.uSUARIOS.findUnique({ where: { id: id_solicitante } });
    if (!solicitante) return res.status(400).json({ erro: 'Solicitante inválido.' });
    const emNomeDeOutro = id_solicitante !== id_aberto_por;
    if (emNomeDeOutro && solicitante.status !== 'ATIVO') return res.status(400).json({ erro: 'Selecione um solicitante ativo.' });
    const autor = emNomeDeOutro ? await prisma.uSUARIOS.findUnique({ where: { id: id_aberto_por } }) : solicitante;
    if (!autor) return res.status(400).json({ erro: 'Autor da abertura inválido.' });

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
      data: { titulo, descricao, exige_confirmacao, prioridade, categoria, ...prazosIniciais(prioridade), id_solicitante, id_aberto_por, id_local: local.id, id_ativo: id_ativo ? toId(id_ativo) : null },
      include,
    });

    const historicoAbertura = await prisma.hISTORICO_CHAMADOS.create({
      data: {
        id_chamado: chamado.id,
        id_usuario: id_aberto_por,
        comentario: `Chamado aberto por ${autor.nome}${emNomeDeOutro ? ` em nome de ${solicitante.nome}` : ''}.${aviso ? ` ${aviso}` : ''}`,
        status_novo: 'ABERTO',
      },
      include: { usuario: { select: { nome: true } } },
    });

    // O aviso também fica no histórico persistido, disponível após recarregar.
    res.status(201).json({
      ...apresentarChamado(chamado, req.usuario),
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
    if (req.usuario.perfil !== 'ADMIN') return res.status(403).json({ erro: 'Acesso negado.' });
    const id = toId(req.params.id);
    const { prioridade, categoria, id_tecnico, comentario, ids_documentacoes } = req.body;
    let { status, motivo_espera } = req.body;
    if (comentario !== undefined && typeof comentario !== 'string') throw falha(400, 'Comentário inválido.');
    const updated = await escrever(async tx => {
      const chamado = await tx.cHAMADOS.findUnique({ where: { id }, include });
      if (!chamado) throw falha(404, 'Chamado não encontrado.');
      if (encerrado(chamado.status)) throw falha(409, 'Chamados concluídos ou cancelados são somente leitura e não podem ser alterados.');
      if (status && (!STATUS_CHAMADO_VALIDOS.includes(status) || (status !== chamado.status && !validarTransicaoStatus(chamado.status, status)))) {
        throw falha(400, 'Transição de status inválida. Reabra os detalhes para conferir as etapas disponíveis.');
      }
      const solicitarConfirmacao = status === 'CONCLUIDO' && chamado.exige_confirmacao;
      if (solicitarConfirmacao) {
        status = 'AGUARDANDO_USUARIO';
        motivo_espera = 'Aguardando confirmação do solicitante para encerrar o chamado.';
      }
      if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) throw falha(400, 'Prioridade inválida.');
      if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) throw falha(400, 'Categoria inválida.');
      if (id_tecnico) {
        const tecnico = await tx.uSUARIOS.findUnique({ where: { id: toId(id_tecnico) } });
        if (!tecnico || !['DIRECTOR', 'ADMIN'].includes(tecnico.perfil) || tecnico.status !== 'ATIVO') throw falha(400, 'Selecione um usuário Director ou administrador ativo.');
      }
      const agora = new Date();
      const data = {};
      if (solicitarConfirmacao) data.confirmacao_pendente = true;
      else if (status && status !== chamado.status) data.confirmacao_pendente = false;
      if (status) data.status = status;
      if (prioridade) data.prioridade = prioridade;
      if (categoria) data.categoria = categoria;
      if (id_tecnico !== undefined) data.id_tecnico = id_tecnico ? toId(id_tecnico) : null;
      const mudouStatus = status && status !== chamado.status;
      const eventos = [];
      if (mudouStatus) {
        const nomes = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', AGUARDANDO_USUARIO: 'Aguardando usuário', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
        eventos.push(`Status alterado para ${nomes[status]}.`);
        if (status === 'EM_ANDAMENTO' && chamado.status === 'ABERTO' && !chamado.atendimento_iniciado_em) data.atendimento_iniciado_em = agora;
        if (status === 'AGUARDANDO_USUARIO') {
          if (typeof motivo_espera !== 'string' || !motivo_espera.trim()) throw falha(400, 'Informe o motivo da espera pelo usuário.');
          await tx.pAUSAS_SLA_CHAMADOS.create({ data: { id_chamado: id, id_usuario_inicio: req.usuario.id, iniciado_em: agora, motivo: motivo_espera.trim() } });
          eventos.push(`Motivo da espera: ${motivo_espera.trim()}`);
        }
        if (chamado.status === 'AGUARDANDO_USUARIO') {
          const encerradas = await tx.pAUSAS_SLA_CHAMADOS.updateMany({ where: { id_chamado: id, encerrado_em: null }, data: { encerrado_em: agora, id_usuario_fim: req.usuario.id } });
          if (encerradas.count !== 1) throw falha(409, 'O registro da pausa está inconsistente. Solicite a revisão ao administrador.');
        }
        if (status === 'CONCLUIDO') data.concluido_em = agora;
        if (status === 'CANCELADO') data.cancelado_em = agora;
      }
      if (prioridade && prioridade !== chamado.prioridade) eventos.push('Prioridade alterada. Os prazos de SLA originais foram preservados.');
      if (ids_documentacoes !== undefined) {
        const ids = idsRecebidos(ids_documentacoes);
        const documentos = await tx.dOCUMENTACOES.count({ where: { id: { in: ids } } });
        if (documentos !== ids.length) throw falha(400, 'Uma das documentações não existe.');
        const anteriores = chamado.documentos_vinculados.map(v => v.id_documentacao.toString()).sort();
        if (JSON.stringify(anteriores) !== JSON.stringify(ids.map(String).sort())) {
          await tx.cHAMADOS_DOCUMENTACOES.deleteMany({ where: { id_chamado: id } });
          if (ids.length) await tx.cHAMADOS_DOCUMENTACOES.createMany({ data: ids.map(id_documentacao => ({ id_chamado: id, id_documentacao })) });
          eventos.push('Documentações relacionadas atualizadas.');
        }
      }
      await tx.cHAMADOS.update({ where: { id }, data: { ...data, atualizado_em: agora } });
      if (comentario?.trim()) eventos.push(`Comentário: ${comentario.trim()}`);
      if (!eventos.length) eventos.push('Dados do chamado atualizados.');
      await tx.hISTORICO_CHAMADOS.create({ data: { id_chamado: id, id_usuario: req.usuario.id, comentario: eventos.join('\n'), status_novo: mudouStatus ? status : null } });
      return tx.cHAMADOS.findUnique({ where: { id }, include });
    });
    res.json(apresentarChamado(updated, req.usuario));
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ erro: err.message });
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    if (['P2002', 'P2025'].includes(err.code)) return res.status(409).json({ erro: 'O chamado mudou em outra sessão. Reabra os detalhes.' });
    res.status(500).json({ erro: 'Erro ao atualizar chamado.' });
  }
}

async function responderConfirmacao(req, res) {
  try {
    const id = toId(req.params.id);
    const { confirmar } = req.body;
    if (typeof confirmar !== 'boolean') throw falha(400, 'Informe se deseja confirmar ou rejeitar o encerramento.');
    const updated = await escrever(async tx => {
      const chamado = await tx.cHAMADOS.findUnique({ where: { id }, include });
      if (!chamado) throw falha(404, 'Chamado não encontrado.');
      if (chamado.id_solicitante !== req.usuario.id) throw falha(403, 'Somente o solicitante pode responder à confirmação.');
      if (!chamado.exige_confirmacao || !chamado.confirmacao_pendente || chamado.status !== 'AGUARDANDO_USUARIO') throw falha(409, 'Este chamado não aguarda confirmação de encerramento.');
      const agora = new Date();
      const pausas = await tx.pAUSAS_SLA_CHAMADOS.updateMany({ where: { id_chamado: id, encerrado_em: null }, data: { encerrado_em: agora, id_usuario_fim: req.usuario.id } });
      if (pausas.count !== 1) throw falha(409, 'O registro da pausa está inconsistente. Solicite a revisão ao administrador.');
      const status = confirmar ? 'CONCLUIDO' : 'EM_ANDAMENTO';
      await tx.cHAMADOS.update({ where: { id }, data: { status, confirmacao_pendente: false, concluido_em: confirmar ? agora : null, atualizado_em: agora } });
      await tx.hISTORICO_CHAMADOS.create({ data: { id_chamado: id, id_usuario: req.usuario.id, status_novo: status, comentario: confirmar ? 'Encerramento confirmado pelo solicitante.' : 'Encerramento rejeitado pelo solicitante. Atendimento retomado.' } });
      return tx.cHAMADOS.findUnique({ where: { id }, include });
    });
    res.json(apresentarChamado(updated, req.usuario));
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ erro: err.message });
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao responder à confirmação.' });
  }
}

async function dashboard(req, res) {
  try {
    const { perfil, id } = req.usuario;
    const filtroSolicitante = perfil === 'USER' ? { id_solicitante: id } : {};
    const [abertos, andamento, concluidos, totalAtivos, aguardando, chamadosSla] = await Promise.all([
      prisma.cHAMADOS.count({ where: { status: 'ABERTO', ...filtroSolicitante } }),
      prisma.cHAMADOS.count({ where: { status: 'EM_ANDAMENTO', ...filtroSolicitante } }),
      prisma.cHAMADOS.count({ where: { status: 'CONCLUIDO', ...filtroSolicitante } }),
      prisma.aTIVOS.count(),
      prisma.cHAMADOS.count({ where: { status: 'AGUARDANDO_USUARIO', ...filtroSolicitante } }),
      prisma.cHAMADOS.findMany({
        where: filtroSolicitante,
        select: { status: true, criado_em: true, atendimento_iniciado_em: true, concluido_em: true, pausas_sla: true },
      }),
    ]);
    const horasAteAtendimento = chamadosSla
      .filter(c => c.atendimento_iniciado_em)
      .map(c => (+new Date(c.atendimento_iniciado_em) - +new Date(c.criado_em)) / 3600000)
      .filter(horas => Number.isFinite(horas) && horas >= 0);
    const horasAteResolucao = chamadosSla
      .filter(c => c.status === 'CONCLUIDO' && c.concluido_em)
      .map(c => calcularSla(c).tempo_resolucao_horas)
      .filter(Number.isFinite);
    const mediaHoras = valores => valores.length
      ? Math.round(valores.reduce((soma, valor) => soma + valor, 0) / valores.length * 10) / 10
      : null;
    res.json({
      abertos,
      andamento,
      concluidos,
      totalAtivos,
      aguardando,
      tempoMedioAtendimentoHoras: mediaHoras(horasAteAtendimento),
      tempoMedioResolucaoHoras: mediaHoras(horasAteResolucao),
    });
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
        concluido_em: true,
      },
    });

    const temposPorTecnico = {};
    concluidos.forEach(c => {
      if (!c.concluido_em) return; // Registros legados podem não ter essa data.
      const key = c.id_tecnico;
      const diff = (new Date(c.concluido_em) - new Date(c.criado_em)) / (1000 * 60 * 60);
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

    const paraSla = await prisma.cHAMADOS.findMany({ where, select: { status: true, criado_em: true, prazo_atendimento_em: true, atendimento_iniciado_em: true, prazo_resolucao_em: true, concluido_em: true, cancelado_em: true, pausas_sla: true } });
    const sla = { cumpridos: 0, violados: 0, atrasados: 0, no_prazo: 0, pausados: 0, sem_prazo: 0, sem_registro: 0, cancelados: 0 };
    const chave = { CUMPRIDO: 'cumpridos', VIOLADO: 'violados', ATRASADO: 'atrasados', NO_PRAZO: 'no_prazo', PAUSADO: 'pausados', NAO_DEFINIDO: 'sem_prazo', SEM_REGISTRO: 'sem_registro', CANCELADO: 'cancelados' };
    for (const c of paraSla) sla[chave[calcularSla(c).resolucao.situacao]]++;
    res.json({
      sla,
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

module.exports = { listar: listar_chamados, buscarPorId, criar: criar_chamado, atualizar: atualizar_chamado, responderConfirmacao, dashboard, relatorios };
