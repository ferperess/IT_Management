const express = require('express');
const multer = require('multer');
const { autenticar, apenasAdminOuTecnico, apenasAdmin } = require('../middlewares/auth');
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
router.get('/relatorios', autenticar, apenasAdminOuTecnico, chamadosCtrl.relatorios);

router.get('/usuarios', autenticar, apenasAdmin, usuariosCtrl.listar);
router.get('/usuarios/:id', autenticar, apenasAdmin, usuariosCtrl.buscarPorId);
router.post('/usuarios', autenticar, apenasAdmin, usuariosCtrl.criar);
router.put('/usuarios/:id', autenticar, apenasAdmin, usuariosCtrl.atualizar);
router.patch('/usuarios/:id/inativar', autenticar, apenasAdmin, usuariosCtrl.inativar);

router.get('/ativos', autenticar, ativosCtrl.listar);
router.get('/locais', autenticar, locaisCtrl.listar);
router.post('/ativos', autenticar, apenasAdminOuTecnico, ativosCtrl.criar);
router.put('/ativos/:id', autenticar, apenasAdminOuTecnico, ativosCtrl.atualizar);
router.delete('/ativos/:id', autenticar, apenasAdmin, ativosCtrl.remover);

router.get('/chamados', autenticar, chamadosCtrl.listar);
router.get('/chamados/:id', autenticar, chamadosCtrl.buscarPorId);
router.post('/chamados', autenticar, chamadosCtrl.criar);
router.post('/chamados/:id/confirmacao', autenticar, chamadosCtrl.responderConfirmacao);
router.put('/chamados/:id', autenticar, apenasAdminOuTecnico, chamadosCtrl.atualizar);

router.get('/documentacoes', autenticar, docsCtrl.listar);
router.get('/documentacoes/:id', autenticar, docsCtrl.buscarPorId);
router.get('/documentacoes/:id/download', autenticar, docsCtrl.download);
router.post('/documentacoes', autenticar, apenasAdminOuTecnico, upload.single('arquivo'), docsCtrl.criar);
router.put('/documentacoes/:id', autenticar, apenasAdminOuTecnico, upload.single('arquivo'), docsCtrl.atualizar);
router.delete('/documentacoes/:id', autenticar, apenasAdmin, docsCtrl.remover);

module.exports = router;
