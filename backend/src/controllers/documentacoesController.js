const { toId } = require('../utils/ids');
const prisma = require('../prisma');
const validator = require('validator');
const { escrever, falha } = require('../services/ticketWrite');
const { encerrado } = require('../services/slaService');

const selectSemDados = {
  id: true, titulo: true, descricao: true, link_externo: true, arquivo_nome: true, arquivo_mime: true,
  criado_em: true, id_responsavel: true, id_ativo: true,
  responsavel: { select: { id: true, nome: true } }, ativo: { select: { id: true, nome: true } },
  chamados_vinculados: { include: { chamado: { select: { id: true, titulo: true, status: true, id_solicitante: true } } } },
};
function apresentar(doc, usuario) {
  const { chamados_vinculados = [], ...campos } = doc;
  return { ...campos,
    bloqueado: chamados_vinculados.some(v => encerrado(v.chamado.status)),
    chamados: chamados_vinculados.filter(v => usuario.perfil !== 'USER' || String(v.chamado.id_solicitante) === String(usuario.id))
      .map(v => ({ id: v.chamado.id, titulo: v.chamado.titulo, status: v.chamado.status })) };
}
function arquivoCorrespondeAoMime(file) {
  const buffer = file.buffer;
  if (!buffer || buffer.length === 0) return false;
  switch (file.mimetype) {
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'application/msword':
      return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from('word/document.xml'));
    default:
      return false;
  }
}
function responderErro(res, err) {
  if (err.httpStatus) return res.status(err.httpStatus).json({ erro: err.message });
  if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
  if (err.code === 'P2025') return res.status(404).json({ erro: 'Documento não encontrado.' });
  return res.status(500).json({ erro: 'Não foi possível concluir a operação com a documentação.' });
}
async function listar(req, res) {
  try { const docs = await prisma.dOCUMENTACOES.findMany({ select: selectSemDados, orderBy: { criado_em: 'desc' } });
    res.json(docs.map(d => apresentar(d, req.usuario)));
  } catch (err) { responderErro(res, err); }
}
async function buscarPorId(req, res) {
  try {
    const doc = await prisma.dOCUMENTACOES.findUnique({ where: { id: toId(req.params.id) }, select: selectSemDados });
    if (!doc) throw falha(404, 'Documento não encontrado.');
    res.json(apresentar(doc, req.usuario));
  } catch (err) { responderErro(res, err); }
}
async function download(req, res) {
  try {
    const doc = await prisma.dOCUMENTACOES.findUnique({ where: { id: toId(req.params.id) }, select: { arquivo_nome: true, arquivo_mime: true, arquivo_dados: true } });
    if (!doc || !doc.arquivo_dados) throw falha(404, 'Arquivo não encontrado.');
    res.setHeader('Content-Type', doc.arquivo_mime || 'application/octet-stream');
    res.attachment(doc.arquivo_nome || 'arquivo');
    res.send(doc.arquivo_dados);
  } catch (err) { responderErro(res, err); }
}
function dadosDocumento(req, novo) {
  const data = {};
  for (const campo of ['titulo', 'descricao', 'link_externo']) {
    if (req.body[campo] !== undefined) {
      if (typeof req.body[campo] !== 'string') throw falha(400, 'Dados do documento inválidos.');
      data[campo] = req.body[campo].trim();
    }
  }
  // React escapa textos na apresentação; preservar o conteúdo sem HTML pré-escapado.
  if ((novo || data.titulo !== undefined) && !data.titulo) throw falha(400, 'Título obrigatório.');
  if (data.link_externo && !validator.isURL(data.link_externo, { protocols: ['http', 'https'], require_protocol: true })) throw falha(400, 'URL externa inválida.');
  if (req.body.id_ativo !== undefined) {
    if (!novo) throw falha(400, 'O ativo relacionado não pode ser alterado durante a edição.');
    data.id_ativo = req.body.id_ativo ? toId(req.body.id_ativo) : null;
  }
  if (req.body.id_chamado !== undefined || req.body.ids_chamados !== undefined) throw falha(400, 'Vincule documentações pela tela do chamado.');
  if (req.file) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(req.file.mimetype)) throw falha(400, 'Tipo de arquivo não permitido (PDF, JPG, PNG ou DOC/DOCX).');
    if (!arquivoCorrespondeAoMime(req.file)) throw falha(400, 'O conteúdo do arquivo não corresponde ao tipo informado.');
    data.arquivo_nome = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    data.arquivo_mime = req.file.mimetype;
    data.arquivo_dados = req.file.buffer;
  }
  return data;
}
async function salvar(req, res, novo) {
  try {
    if (req.usuario.perfil !== 'ADMIN') throw falha(403, 'Acesso negado.');
    const data = dadosDocumento(req, novo);
    const doc = await escrever(async tx => {
      const id = novo ? null : toId(req.params.id);
      const anterior = novo ? null : await tx.dOCUMENTACOES.findUnique({ where: { id }, select: selectSemDados });
      if (!novo && !anterior) throw falha(404, 'Documento não encontrado.');
      const vinculosAntigos = anterior?.chamados_vinculados || [];
      if (vinculosAntigos.some(v => encerrado(v.chamado.status))) throw falha(409, 'Este documento está associado a um chamado encerrado. Cadastre uma nova versão para preservar o histórico.');
      if (data.id_ativo && !await tx.aTIVOS.findUnique({ where: { id: data.id_ativo } })) throw falha(400, 'Ativo não encontrado.');
      const salvo = novo ? await tx.dOCUMENTACOES.create({ data: { ...data, id_responsavel: req.usuario.id } })
        : await tx.dOCUMENTACOES.update({ where: { id }, data });
      for (const vinculo of vinculosAntigos) {
        await tx.hISTORICO_CHAMADOS.create({ data: { id_chamado: vinculo.id_chamado, id_usuario: req.usuario.id, comentario: `Documentação #${salvo.id}: conteúdo atualizado.` } });
      }
      return tx.dOCUMENTACOES.findUnique({ where: { id: salvo.id }, select: selectSemDados });
    });
    res.status(novo ? 201 : 200).json(apresentar(doc, req.usuario));
  } catch (err) { responderErro(res, err); }
}
async function remover(req, res) {
  try {
    if (req.usuario.perfil !== 'ADMIN') throw falha(403, 'Acesso negado.');
    await escrever(async tx => {
      const id = toId(req.params.id);
      const doc = await tx.dOCUMENTACOES.findUnique({ where: { id }, select: selectSemDados });
      if (!doc) throw falha(404, 'Documento não encontrado.');
      if (doc.chamados_vinculados.some(v => encerrado(v.chamado.status))) throw falha(409, 'Não é permitido remover documentação vinculada a um chamado encerrado.');
      for (const v of doc.chamados_vinculados) await tx.hISTORICO_CHAMADOS.create({ data: { id_chamado: v.id_chamado, id_usuario: req.usuario.id, comentario: `Documentação #${id} removida.` } });
      await tx.cHAMADOS_DOCUMENTACOES.deleteMany({ where: { id_documentacao: id } });
      await tx.dOCUMENTACOES.delete({ where: { id } });
    });
    res.json({ mensagem: 'Documento removido.' });
  } catch (err) { responderErro(res, err); }
}
module.exports = { listar, buscarPorId, download, criar: (req, res) => salvar(req, res, true), atualizar: (req, res) => salvar(req, res, false), remover };
