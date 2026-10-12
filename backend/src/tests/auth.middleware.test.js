jest.mock('../prisma', () => ({ uSUARIOS: { findUnique: jest.fn() } }));
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { autenticar, apenasAdminOuDirector, apenasAdmin, apenasAdminOuUser, SECRET } = require('../middlewares/auth');
const routes = require('../routes');


function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─────────────────────────────────────────
// autenticar
// ─────────────────────────────────────────
describe('Middleware: autenticar', () => {
  beforeEach(() => prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, perfil: 'ADMIN', status: 'ATIVO' }));

  test('deve chamar next() com token válido', async () => {
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario).toBeDefined();
    expect(req.usuario.id).toBe(1n);
    expect(req.usuario.perfil).toBe('ADMIN');
  });

  test('deve retornar 401 sem header Authorization', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token não fornecido.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 401 com token inválido', async () => {
    const req = { headers: { authorization: 'Bearer token_invalido_xpto' } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token inválido ou malformado.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 401 com token expirado', async () => {
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET, { expiresIn: '0s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  test('usa o perfil atual do banco, não o do token', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, perfil: 'USER', status: 'ATIVO' });
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: ['Bearer', token].join(' ') } };
    const next = jest.fn();

    await autenticar(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario.perfil).toBe('USER');
  });

  test('deve retornar 401 para usuário inativo', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, perfil: 'ADMIN', status: 'INATIVO' });
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: ['Bearer', token].join(' ') } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 401 para usuário inexistente', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue(null);
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: ['Bearer', token].join(' ') } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 500 se a consulta ao banco falhar', async () => {
    prisma.uSUARIOS.findUnique.mockRejectedValue(new Error('db'));
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: ['Bearer', token].join(' ') } };
    const res = mockRes();
    const next = jest.fn();

    await autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────
// perfil e compatibilidade
// ─────────────────────────────────────────
describe('Middleware: perfis de acesso', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([['GERAL', 'ADMIN'], ['INTERMEDIARIO', 'DIRECTOR'], ['BAIXO', 'USER'], ['TECNICO', 'DIRECTOR'], ['COMUM', 'USER']])(
    'normaliza token legado %s para %s',
    async (perfilAntigo, perfilNovo) => {
      prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, perfil: perfilAntigo, status: 'ATIVO' });
      const token = jwt.sign({ id: 1, perfil: perfilAntigo }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await autenticar(req, res, next);

      expect(req.usuario.perfil).toBe(perfilNovo);
      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  test('Admin e Director acessam relatórios', () => {
    for (const perfil of ['ADMIN', 'DIRECTOR']) {
      const req = { usuario: { perfil } };
      const next = jest.fn();
      apenasAdminOuDirector(req, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  test('a rota de listagem de ativos exige perfil Admin ou Director', () => {
    const rotaAtivos = routes.stack.find(layer =>
      layer.route?.path === '/ativos' && layer.route.methods.get
    );

    expect(rotaAtivos).toBeDefined();
    expect(rotaAtivos.route.stack.map(({ handle }) => handle)).toEqual([
      autenticar,
      apenasAdminOuDirector,
      expect.any(Function),
    ]);
  });

  test('Baixo não acessa recursos de consulta avançada', () => {
    const req = { usuario: { perfil: 'USER' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdminOuDirector(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Acesso negado. Perfil insuficiente.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────
// apenasGeral e operações de chamado mutáveis
// ─────────────────────────────────────────
describe('Middleware: acesso geral', () => {
  test('deve permitir perfil Geral', () => {
    const req = { usuario: { perfil: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each(['DIRECTOR', 'USER'])('deve bloquear perfil %s de edição', perfil => {
    const req = { usuario: { perfil } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Acesso negado. Apenas administradores.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('somente Geral e Baixo podem confirmar encerramento', () => {
    for (const perfil of ['ADMIN', 'USER']) {
      const next = jest.fn();
      apenasAdminOuUser({ usuario: { perfil } }, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    const res = mockRes();
    const next = jest.fn();
    apenasAdminOuUser({ usuario: { perfil: 'DIRECTOR' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
