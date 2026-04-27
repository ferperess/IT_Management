const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { classificarPrioridade } = require('../services/apiService');

const include = {
  solicitante: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true } },
  tecnico: { select: { id: true, nome: true } },
  historico: { include: { usuario: { select: { nome: true } } }, orderBy: { criado_em: 'asc' } },
};

async function listar(req, res) {
  try {
    const chamados = await prisma.cHAMADOS.findMany({ include, orderBy: { criado_em: 'desc' } });
    res.json(chamados);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar chamados.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const c = await prisma.cHAMADOS.findUnique({ where: { id: Number(req.params.id) }, include });
    if (!c) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    res.json(c);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar chamado.' });
  }
}

async function criar(req, res) {
  try {
    const { titulo, descricao, id_ativo } = req.body;
    const id_solicitante = req.usuario.id;

    if (!titulo || !descricao) {
      return res.status(400).json({ erro: 'Campos obrigatórios: titulo, descricao.' });
    }

    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: Number(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
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

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { status, prioridade, id_tecnico, comentario } = req.body;

    const chamado = await prisma.cHAMADOS.findUnique({ where: { id: Number(id) } });
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });

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

module.exports = { listar, buscarPorId, criar, atualizar, dashboard };