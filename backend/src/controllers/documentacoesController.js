const { toId } = require('../utils/ids');
const prisma = require('../prisma');
const validator = require('validator');

const include = {
  responsavel: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true } },
  chamado: { select: { id: true, titulo: true } },
};

// Seleciona todos os campos EXCETO arquivo_dados para listagem (evita trafegar binário desnecessário)
const selectSemDados = {
  id: true,
  titulo: true,
  descricao: true,
  link_externo: true,
  arquivo_nome: true,
  arquivo_mime: true,
  criado_em: true,
  id_responsavel: true,
  id_ativo: true,
  id_chamado: true,
  responsavel: { select: { id: true, nome: true } },
  ativo: { select: { id: true, nome: true } },
  chamado: { select: { id: true, titulo: true } },
};

async function listar_documentacoes(req, res) {
  try {
    const docs = await prisma.dOCUMENTACOES.findMany({
      select: selectSemDados,
      orderBy: { criado_em: 'desc' },
    });
    res.json(docs);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao listar documentações.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const doc = await prisma.dOCUMENTACOES.findUnique({
      where: { id: toId(req.params.id) },
      select: selectSemDados,
    });
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    res.json(doc);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao buscar documento.' });
  }
}

async function download(req, res) {
  try {
    const doc = await prisma.dOCUMENTACOES.findUnique({
      where: { id: toId(req.params.id) },
      select: { arquivo_nome: true, arquivo_mime: true, arquivo_dados: true },
    });

    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (!doc.arquivo_dados) return res.status(404).json({ erro: 'Este documento não possui arquivo anexo.' });

    res.setHeader('Content-Type', doc.arquivo_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.arquivo_nome)}"`);
    res.send(doc.arquivo_dados);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao baixar arquivo.' });
  }
}

async function criar_documentacao(req, res) {
  try {
    let { titulo, descricao, link_externo, id_ativo, id_chamado } = req.body;

    titulo = validator.escape(validator.trim(titulo || ''));
    descricao = validator.escape(validator.trim(descricao || ''));

    if (!titulo) return res.status(400).json({ erro: 'Título obrigatório.' });

    if (link_externo && !validator.isURL(link_externo, { protocols: ['http', 'https'], require_protocol: true })) {
      return res.status(400).json({ erro: 'URL externa inválida.' });
    }

    let arquivo_nome = null;
    let arquivo_mime = null;
    let arquivo_dados = null;

    if (req.file) {
      const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido (apenas PDF, JPG, PNG, DOC/DOCX).' });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ erro: 'Arquivo muito grande. Limite de 5MB.' });
      }
      arquivo_nome = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      arquivo_mime = req.file.mimetype;
      arquivo_dados = req.file.buffer;
    }

    if (id_ativo) {
      const ativo = await prisma.aTIVOS.findUnique({ where: { id: toId(id_ativo) } });
      if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
    }

    if (id_chamado) {
      const chamado = await prisma.cHAMADOS.findUnique({ where: { id: toId(id_chamado) } });
      if (!chamado) return res.status(400).json({ erro: 'Chamado não encontrado.' });
    }

    const doc = await prisma.dOCUMENTACOES.create({
      data: {
        titulo,
        descricao,
        link_externo,
        arquivo_nome,
        arquivo_mime,
        arquivo_dados,
        id_responsavel: req.usuario.id,
        id_ativo: id_ativo ? toId(id_ativo) : null,
        id_chamado: id_chamado ? toId(id_chamado) : null,
      },
      select: selectSemDados,
    });
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao criar documento.' });
  }
}

async function atualizar_documentacao(req, res) {
  try {
    const { id } = req.params;
    let { titulo, descricao, link_externo, id_ativo, id_chamado } = req.body;

    if (titulo) titulo = validator.escape(validator.trim(titulo));
    if (descricao) descricao = validator.escape(validator.trim(descricao));

    if (link_externo && !validator.isURL(link_externo, { protocols: ['http', 'https'], require_protocol: true })) {
      return res.status(400).json({ erro: 'URL externa inválida.' });
    }

    const data = { titulo, descricao, link_externo };

    if (req.file) {
      const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido.' });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ erro: 'Arquivo muito grande. Limite de 5MB.' });
      }
      data.arquivo_nome = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      data.arquivo_mime = req.file.mimetype;
      data.arquivo_dados = req.file.buffer;
    }

    if (id_ativo !== undefined) {
      if (id_ativo) {
        const ativo = await prisma.aTIVOS.findUnique({ where: { id: toId(id_ativo) } });
        if (!ativo) return res.status(400).json({ erro: 'Ativo não encontrado.' });
      }
      data.id_ativo = id_ativo ? toId(id_ativo) : null;
    }

    if (id_chamado !== undefined) {
      if (id_chamado) {
        const chamado = await prisma.cHAMADOS.findUnique({ where: { id: toId(id_chamado) } });
        if (!chamado) return res.status(400).json({ erro: 'Chamado não encontrado.' });
      }
      data.id_chamado = id_chamado ? toId(id_chamado) : null;
    }

    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const doc = await prisma.dOCUMENTACOES.update({
      where: { id: toId(id) },
      data,
      select: selectSemDados,
    });
    res.json(doc);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

async function remover_documentacao(req, res) {
  try {
    await prisma.dOCUMENTACOES.delete({ where: { id: toId(req.params.id) } });
    res.json({ mensagem: 'Documento removido.' });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Documento não encontrado.' });
  }
}

module.exports = {
  listar: listar_documentacoes,
  buscarPorId,
  download,
  criar: criar_documentacao,
  atualizar: atualizar_documentacao,
  remover: remover_documentacao,
};
