const jwt = require('jsonwebtoken');
const { autenticar, apenasAdminOuDirector, apenasAdmin, apenasAdminOuUser, SECRET } = require('../middlewares/auth');


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
    expect(req.usuario.id).toBe(1n);
    expect(req.usuario.perfil).toBe('ADMIN');
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
    expect(res.json).toHaveBeenCalledWith({ erro: 'Token inválido ou malformado.' });
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
// perfil e compatibilidade dos tokens emitidos antes da migração
// ─────────────────────────────────────────
describe('Middleware: perfis de acesso', () => {
  test.each([['GERAL', 'ADMIN'], ['INTERMEDIARIO', 'DIRECTOR'], ['BAIXO', 'USER'], ['TECNICO', 'DIRECTOR'], ['COMUM', 'USER']])(
    'normaliza token legado %s para %s',
    (perfilAntigo, perfilNovo) => {
      const token = jwt.sign({ id: 1, perfil: perfilAntigo }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      autenticar(req, res, next);

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
