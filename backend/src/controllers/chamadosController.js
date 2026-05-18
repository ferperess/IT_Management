const prisma = require('../prisma');
const { classificarPrioridade } = require('../services/apiService');
const {
  STATUS_CHAMADO_VALIDOS,
  PRIORIDADES_VALIDAS,
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

    // Usuário COMUM só vê seus próprios chamados
    const where = perfil === 'COMUM' ? { id_solicitante: id } : {};

    const chamados = await prisma.cHAMADOS.findMany({ where, include, orderBy: { criado_em: 'desc' } });
    res.json(chamados);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar chamados.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const c = await prisma.cHAMADOS.findUnique({ where: { id: Number(req.params.id) }, include });
    if (!c) return res.status(404).json({ erro: 'Chamado não encontrado.' });

    // Usuário COMUM só acessa seus próprios chamados
    if (req.usuario.perfil === 'COMUM' && c.id_solicitante !== req.usuario.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    res.json(c);
  } catch {
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

    // Validação de tamanho mínimo
    if (titulo.trim().length < 5) {
      return res.status(400).json({ erro: 'O título deve ter no mínimo 5 caracteres.' });
    }
    if (descricao.trim().length < 10) {
      return res.status(400).json({ erro: 'A descrição deve ter no mínimo 10 caracteres.' });
    }

    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: Number(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });

      // Ativo em manutenção não pode ser vinculado a novo chamado
      if (ativo.status === 'MANUTENCAO') {
        return res.status(400).json({ erro: 'O ativo selecionado está em manutenção e não pode ser vinculado a um novo chamado.' });
      }
    }

    const solicitante = await prisma.uSUARIOS.findUnique({ where: { id: id_solicitante } });
    if (!solicitante) return res.status(400).json({ erro: 'Solicitante inválido.' });

    let prioridade = 'MEDIA';
    try {
      prioridade = await classificarPrioridade(titulo, descricao);
    } catch (iaErr) {
      console.error('Erro na classificação por IA, usando prioridade padrão:', iaErr.message);
    }

    const chamado = await prisma.cHAMADOS.create({
      data: {
        titulo,
        descricao,
        prioridade,
        id_solicitante,
        id_ativo: id_ativo ? Number(id_ativo) : null,
      },
      include,
    });

    await prisma.hISTORICO_CHAMADOS.create({
      data: {
        id_chamado: chamado.id,
        id_usuario: id_solicitante,
        comentario: `Chamado aberto por ${solicitante.nome}.`,
        status_novo: 'ABERTO',
      },
    });

    res.status(201).json(chamado);
  } catch {
    res.status(500).json({ erro: 'Erro ao criar chamado.' });
  }
}

async function atualizar_chamado(req, res) {
  try {
    const { id } = req.params;
    const { status, prioridade, id_tecnico, comentario } = req.body;

    const chamado = await prisma.cHAMADOS.findUnique({ where: { id: Number(id) } });
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });

    // Validação de status
    if (status) {
      if (!STATUS_CHAMADO_VALIDOS.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_CHAMADO_VALIDOS.join(', ')}.` });
      }

      // Valida se a transição de status é permitida
      if (status !== chamado.status && !validarTransicaoStatus(chamado.status, status)) {
        return res.status(400).json({
          erro: `Transição de status inválida: não é possível mover de "${chamado.status}" para "${status}".`,
        });
      }
    }

    // Validação de prioridade
    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) {
      return res.status(400).json({ erro: `Prioridade inválida. Valores aceitos: ${PRIORIDADES_VALIDAS.join(', ')}.` });
    }

    // Valida se o técnico atribuído existe e tem perfil adequado
    if (id_tecnico) {
      const tecnico = await prisma.uSUARIOS.findUnique({ where: { id: Number(id_tecnico) } });
      if (!tecnico) {
        return res.status(400).json({ erro: 'Técnico não encontrado.' });
      }
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
    if (id_tecnico !== undefined) data.id_tecnico = id_tecnico ? Number(id_tecnico) : null;

    const updated = await prisma.cHAMADOS.update({ where: { id: Number(id) }, data, include });

    if (comentario || status) {
      await prisma.hISTORICO_CHAMADOS.create({
        data: {
          id_chamado: Number(id),
          id_usuario: req.usuario.id,
          comentario: comentario || `Status alterado para ${status}.`,
          status_novo: status || null,
        },
      });
    }

    res.json(updated);
  } catch {
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
  } catch {
    res.status(500).json({ erro: 'Erro ao carregar dashboard.' });
  }
}

module.exports = { listar: listar_chamados, buscarPorId, criar: criar_chamado, atualizar: atualizar_chamado, dashboard };
