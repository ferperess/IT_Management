const prisma = require('../prisma');
const validator = require('validator');

const include = {
  responsavel: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true } },
  chamado: { select: { id: true, titulo: true } },
};

async function listar_documentacoes(req, res) {
  try {
    const docs = await prisma.dOCUMENTACOES.findMany({
      include,
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
      include,
    });
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    res.json(doc);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar documento.' });
  }
}

async function criar_documentacao(req, res) {
  try {
    let { titulo, descricao, link_externo, id_ativo, id_chamado } = req.body;
    
    // Sanitização Básica
    titulo = validator.escape(validator.trim(titulo || ''));
    descricao = validator.escape(validator.trim(descricao || ''));
    
    if (!titulo) return res.status(400).json({ erro: 'Título obrigatório.' });

    // Validação de URL
    if (link_externo && !validator.isURL(link_externo, { protocols: ['http', 'https'], require_protocol: true })) {
      return res.status(400).json({ erro: 'URL externa inválida.' });
    }

    // Validação de Arquivo (MIME Type e Tamanho se houver)
    if (req.file) {
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido (apenas PDF, JPG, PNG, DOC/DOCX).' });
      }
      if (req.file.size > 5 * 1024 * 1024) { // 5MB
        return res.status(400).json({ erro: 'Arquivo muito grande. Limite de 5MB.' });
      }
    }

    // Valida ativo se fornecido
    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: Number(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
    }

    // Valida chamado se fornecido
    if (id_chamado) {
      const chamado = await prisma.cHAMADOS.findUnique({ where: { id: Number(id_chamado) } });
      if (!chamado) return res.status(400).json({ erro: 'Chamado não encontrado.' });
    }

    const doc = await prisma.dOCUMENTACOES.create({
      data: {
        titulo,
        descricao,
        link_externo,
        arquivo_nome: req.file ? req.file.originalname : null,
        id_responsavel: req.usuario.id,
        id_ativo: id_ativo ? Number(id_ativo) : null,
        id_chamado: id_chamado ? Number(id_chamado) : null,
      },
      include,
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ erro: 'Erro ao criar documento.' });
  }
}

async function atualizar_documentacao(req, res) {
  try {
    const { id } = req.params;
    let { titulo, descricao, link_externo, id_ativo, id_chamado } = req.body;

    // Sanitização Básica
    if (titulo) titulo = validator.escape(validator.trim(titulo));
    if (descricao) descricao = validator.escape(validator.trim(descricao));

    // Validação de URL
    if (link_externo && !validator.isURL(link_externo, { protocols: ['http', 'https'], require_protocol: true })) {
      return res.status(400).json({ erro: 'URL externa inválida.' });
    }

    // Validação de Arquivo
    if (req.file) {
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido.' });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ erro: 'Arquivo muito grande. Limite de 5MB.' });
      }
    }

    // Valida ativo se fornecido
    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: Number(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
    }

    // Valida chamado se fornecido
    if (id_chamado) {
      const chamado = await prisma.cHAMADOS.findUnique({ where: { id: Number(id_chamado) } });
      if (!chamado) return res.status(400).json({ erro: 'Chamado não encontrado.' });
    }

    const data = { titulo, descricao, link_externo };
    if (req.file) data.arquivo_nome = req.file.originalname;
    data.id_ativo = id_ativo ? Number(id_ativo) : null;
    data.id_chamado = id_chamado ? Number(id_chamado) : null;
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const doc = await prisma.dOCUMENTACOES.update({
      where: { id: Number(id) },
      data,
      include,
    });
    res.json(doc);
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

async function remover_documentacao(req, res) {
  try {
    await prisma.dOCUMENTACOES.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Documento removido.' });
  } catch {
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

module.exports = {
  listar: listar_documentacoes,
  buscarPorId,
  criar: criar_documentacao,
  atualizar: atualizar_documentacao,
  remover: remover_documentacao,
};
