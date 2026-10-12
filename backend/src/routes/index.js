const express = require('express');
const multer = require('multer');
const { autenticar, apenasAdminOuDirector, apenasAdmin, apenasAdminOuUser } = require('../middlewares/auth');
const authCtrl = require('../controllers/authController');
const usuariosCtrl = require('../controllers/usuariosController');
const ativosCtrl = require('../controllers/ativosController');
const locaisCtrl = require('../controllers/locaisController');
const chamadosCtrl = require('../controllers/chamadosController');
const docsCtrl = require('../controllers/documentacoesController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 64 * 1024, parts: 11 },
});
function tratarErroUpload(err, req, res, next) {
  if (!(err instanceof multer.MulterError)) return next(err);
  const tamanhoExcedido = err.code === 'LIMIT_FILE_SIZE';
  return res.status(tamanhoExcedido ? 413 : 400).json({
    erro: tamanhoExcedido ? 'Arquivo muito grande. Limite de 5MB.' : 'Upload inválido.',
  });
}
const uploadDocumento = [upload.single('arquivo'), tratarErroUpload];

router.post('/auth/login', authCtrl.login);
router.get('/auth/session', autenticar, authCtrl.session);
router.post('/auth/logout', autenticar, authCtrl.logout);
router.get('/dashboard', autenticar, chamadosCtrl.dashboard);
router.get('/relatorios', autenticar, apenasAdminOuDirector, chamadosCtrl.relatorios);

router.get('/usuarios', autenticar, apenasAdmin, usuariosCtrl.listar);
router.get('/usuarios/:id', autenticar, apenasAdmin, usuariosCtrl.buscarPorId);
router.post('/usuarios', autenticar, apenasAdmin, usuariosCtrl.criar);
router.put('/usuarios/:id', autenticar, apenasAdmin, usuariosCtrl.atualizar);
router.patch('/usuarios/:id/inativar', autenticar, apenasAdmin, usuariosCtrl.inativar);
router.patch('/usuarios/:id/reativar', autenticar, apenasAdmin, usuariosCtrl.reativar);

router.get('/ativos', autenticar, apenasAdminOuDirector, ativosCtrl.listar);
router.get('/ativos/:id/historico', autenticar, apenasAdminOuDirector, ativosCtrl.historico);
router.get('/locais', autenticar, locaisCtrl.listar);
router.post('/ativos', autenticar, apenasAdmin, ativosCtrl.criar);
router.put('/ativos/:id', autenticar, apenasAdmin, ativosCtrl.atualizar);
router.delete('/ativos/:id', autenticar, apenasAdmin, ativosCtrl.remover);

router.get('/chamados', autenticar, chamadosCtrl.listar);
router.get('/chamados/:id', autenticar, chamadosCtrl.buscarPorId);
router.post('/chamados', autenticar, chamadosCtrl.criar);
router.post('/chamados/:id/confirmacao', autenticar, apenasAdminOuUser, chamadosCtrl.responderConfirmacao);
router.put('/chamados/:id', autenticar, apenasAdmin, chamadosCtrl.atualizar);

router.get('/documentacoes', autenticar, apenasAdminOuDirector, docsCtrl.listar);
router.get('/documentacoes/:id', autenticar, apenasAdminOuDirector, docsCtrl.buscarPorId);
router.get('/documentacoes/:id/download', autenticar, apenasAdminOuDirector, docsCtrl.download);
router.post('/documentacoes', autenticar, apenasAdmin, ...uploadDocumento, docsCtrl.criar);
router.put('/documentacoes/:id', autenticar, apenasAdmin, ...uploadDocumento, docsCtrl.atualizar);
router.delete('/documentacoes/:id', autenticar, apenasAdmin, docsCtrl.remover);

module.exports = router;
