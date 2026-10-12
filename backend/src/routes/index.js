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
const upload = multer({ storage: multer.memoryStorage() });

router.post('/auth/login', authCtrl.login);
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
router.post('/documentacoes', autenticar, apenasAdmin, upload.single('arquivo'), docsCtrl.criar);
router.put('/documentacoes/:id', autenticar, apenasAdmin, upload.single('arquivo'), docsCtrl.atualizar);
router.delete('/documentacoes/:id', autenticar, apenasAdmin, docsCtrl.remover);

module.exports = router;
