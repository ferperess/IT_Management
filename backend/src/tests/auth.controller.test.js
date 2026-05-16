const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock do prisma
jest.mock('../prisma', () => ({
  uSUARIOS: {
    findUnique: jest.fn(),
  },
}));

const prisma = require('../prisma');
const { login } = require('../controllers/authController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController: login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 400 se email não for fornecido', async () => {
    const req = { body: { senha: '123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Email e senha obrigatórios.' });
  });

  test('deve retornar 400 se senha não for fornecida', async () => {
    const req = { body: { email: 'a@a.com' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Email e senha obrigatórios.' });
  });

  test('deve retornar 401 se usuário não existir', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue(null);
    const req = { body: { email: 'inexistente@a.com', senha: '123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Credenciais inválidas.' });
  });

  test('deve retornar 401 se usuário estiver INATIVO', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({ status: 'INATIVO', senha_hash: 'hash' });
    const req = { body: { email: 'a@a.com', senha: '123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Credenciais inválidas.' });
  });

  test('deve retornar 401 se senha estiver errada', async () => {
    const hash = await bcrypt.hash('senha_correta', 10);
    prisma.uSUARIOS.findUnique.mockResolvedValue({ status: 'ATIVO', senha_hash: hash });
    const req = { body: { email: 'a@a.com', senha: 'senha_errada' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Credenciais inválidas.' });
  });

  test('deve retornar token e dados do usuário com credenciais válidas', async () => {
    const hash = await bcrypt.hash('senha123', 10);
    const usuarioMock = { id: 1, nome: 'Admin', email: 'admin@teste.com', perfil: 'ADMIN', status: 'ATIVO', senha_hash: hash };
    prisma.uSUARIOS.findUnique.mockResolvedValue(usuarioMock);

    const req = { body: { email: 'admin@teste.com', senha: 'senha123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const resposta = res.json.mock.calls[0][0];
    expect(resposta.token).toBeDefined();
    expect(resposta.usuario.email).toBe('admin@teste.com');
    expect(resposta.usuario.perfil).toBe('ADMIN');
  });

  test('deve retornar 500 se o prisma lançar exceção', async () => {
    prisma.uSUARIOS.findUnique.mockRejectedValue(new Error('DB error'));
    const req = { body: { email: 'a@a.com', senha: '123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro interno ao realizar login.' });
  });
});
