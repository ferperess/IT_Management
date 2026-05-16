const jwt = require('jsonwebtoken');

// Mock do módulo de auth antes de importar
jest.mock('../middlewares/auth', () => {
  const jwt = require('jsonwebtoken');
  const SECRET = 'jwt_secret_para_testes';

  function autenticar(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ erro: 'Token não fornecido.' });
    const token = auth.split(' ')[1];
    try {
      req.usuario = jwt.verify(token, SECRET);
      next();
    } catch {
      res.status(401).json({ erro: 'Token inválido.' });
    }
  }

  function apenasAdminOuTecnico(req, res, next) {
    if (!['ADMIN', 'TECNICO'].includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso negado. Perfil insuficiente.' });
    }
    next();
  }

  function apenasAdmin(req, res, next) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ erro: 'Acesso negado. Apenas administradores.' });
    }
    next();
  }

  return { autenticar, apenasAdminOuTecnico, apenasAdmin, SECRET };
});

const { autenticar, apenasAdminOuTecnico, apenasAdmin } = require('../middlewares/auth');

const SECRET = 'jwt_secret_para_testes';

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
  test('deve chamar next() com token válido', () => {
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    autenticar(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario).toBeDefined();
    expect(req.usuario.id).toBe(1);
  });

  test('deve retornar 401 sem header Authorization', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token não fornecido.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 401 com token inválido', () => {
    const req = { headers: { authorization: 'Bearer token_invalido_xpto' } };
    const res = mockRes();
    const next = jest.fn();

    autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token inválido.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deve retornar 401 com token expirado', () => {
    const token = jwt.sign({ id: 1, perfil: 'ADMIN' }, SECRET, { expiresIn: '0s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    autenticar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────
// apenasAdminOuTecnico
// ─────────────────────────────────────────
describe('Middleware: apenasAdminOuTecnico', () => {
  test('deve permitir perfil ADMIN', () => {
    const req = { usuario: { perfil: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdminOuTecnico(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('deve permitir perfil TECNICO', () => {
    const req = { usuario: { perfil: 'TECNICO' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdminOuTecnico(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('deve bloquear perfil COMUM', () => {
    const req = { usuario: { perfil: 'COMUM' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdminOuTecnico(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Acesso negado. Perfil insuficiente.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────
// apenasAdmin
// ─────────────────────────────────────────
describe('Middleware: apenasAdmin', () => {
  test('deve permitir perfil ADMIN', () => {
    const req = { usuario: { perfil: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('deve bloquear perfil TECNICO', () => {
    const req = { usuario: { perfil: 'TECNICO' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Acesso negado. Apenas administradores.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('deve bloquear perfil COMUM', () => {
    const req = { usuario: { perfil: 'COMUM' } };
    const res = mockRes();
    const next = jest.fn();

    apenasAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
