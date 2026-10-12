jest.mock('../prisma', () => ({ uSUARIOS: { findUnique: jest.fn() } }));
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { autenticar, apenasAdminOuDirector, apenasAdmin, apenasAdminOuUser, SECRET } = require('../middlewares/auth');
const routes = require('../routes');
const { tokenVersion } = require('../utils/tokenVersion');
const mockPasswordHash = 'test-password-hash';
const mockCsrfToken = 'test-csrf-token';
const makeToken = (claims = {}, options) => jwt.sign({
  id: 1,
  perfil: 'ADMIN',
  cv: tokenVersion(mockPasswordHash, SECRET),
  csrf: mockCsrfToken,
  ...claims,
}, SECRET, options);
const requestWithToken = (token, method = 'GET', csrf = mockCsrfToken) => ({
  method,
  headers: {
    cookie: `sgti_session=${token}`,
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  },
});


function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─────────────────────────────────────────
describe('Middleware: autenticar', () => {
  beforeEach(() => prisma.uSUARIOS.findUnique.mockResolvedValue({
    id: 1n, nome: 'Admin', email: 'admin@example.com', perfil: 'ADMIN', status: 'ATIVO', senha_hash: mockPasswordHash,
  }));

  test('authenticates a valid cookie-based session', async () => {
    const req = requestWithToken(makeToken());
    const next = jest.fn();
    await autenticar(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario.id).toBe(1n);
    expect(req.usuario.perfil).toBe('ADMIN');
  });

  test('rejects missing session cookies and Authorization Bearer', async () => {
    for (const headers of [{}, { authorization: 'Bearer token' }]) {
      const res = mockRes();
      const next = jest.fn();
      await autenticar({ method: 'GET', headers }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ erro: 'Sessão não fornecida.' });
      expect(next).not.toHaveBeenCalled();
    }
  });

  test('rejeita cookie malformado ou expirado', async () => {
    for (const token of ['invalid-cookie-token', makeToken({}, { expiresIn: '0s' })]) {
      const res = mockRes();
      const next = jest.fn();
      await autenticar(requestWithToken(token), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
  });

  test('uses the current database profile instead of the JWT profile', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({
      id: 1n, nome: 'Usuario', email: 'user@example.com', perfil: 'USER', status: 'ATIVO', senha_hash: mockPasswordHash,
    });
    const req = requestWithToken(makeToken());
    const next = jest.fn();
    await autenticar(req, mockRes(), next);
    expect(req.usuario.perfil).toBe('USER');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['INATIVO', { id: 1n, nome: 'Admin', email: 'admin@example.com', perfil: 'ADMIN', status: 'INATIVO', senha_hash: mockPasswordHash }],
    ['inexistente', null],
  ])('rejects %s users', async (_description, usuario) => {
    prisma.uSUARIOS.findUnique.mockResolvedValue(usuario);
    const res = mockRes();
    const next = jest.fn();
    await autenticar(requestWithToken(makeToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('retorna 500 se a consulta ao banco falhar', async () => {
    prisma.uSUARIOS.findUnique.mockRejectedValue(new Error('db'));
    const res = mockRes();
    const next = jest.fn();
    await autenticar(requestWithToken(makeToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('revokes the session when the stored password hash changes', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({
      id: 1n, nome: 'Admin', email: 'admin@example.com', perfil: 'ADMIN', status: 'ATIVO', senha_hash: 'new-password-hash',
    });
    const res = mockRes();
    const next = jest.fn();
    await autenticar(requestWithToken(makeToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Sessão inválida. Faça login novamente.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('requires a valid CSRF token for write methods', async () => {
    const res = mockRes();
    const next = jest.fn();
    await autenticar(requestWithToken(makeToken(), 'POST', null), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token de proteção CSRF inválido.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// perfil e compatibilidade
// ─────────────────────────────────────────
describe('Middleware: perfis de acesso', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([['GERAL', 'ADMIN'], ['INTERMEDIARIO', 'DIRECTOR'], ['BAIXO', 'USER'], ['TECNICO', 'DIRECTOR'], ['COMUM', 'USER']])(
    'normaliza token legado %s para %s',
    async (perfilAntigo, perfilNovo) => {
      prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, perfil: perfilAntigo, status: 'ATIVO', senha_hash: mockPasswordHash });
      const token = makeToken({ perfil: perfilAntigo });
      const req = requestWithToken(token);
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

  test('rotas de upload autorizam Admin antes de iniciar o Multer', () => {
    const rotaDocumentacao = routes.stack.find(layer =>
      layer.route?.path === '/documentacoes' && layer.route.methods.post
    );
    const handlers = rotaDocumentacao.route.stack.map(({ handle }) => handle);
    expect(handlers.slice(0, 2)).toEqual([autenticar, apenasAdmin]);
    expect(handlers[3].length).toBe(4);
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
