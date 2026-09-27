jest.mock('../prisma', () => ({
  uSUARIOS: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../prisma');
const { listar, buscarPorId, criar, atualizar, inativar } = require('../controllers/usuariosController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('usuariosController: listar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar lista de usuários', async () => {
    const lista = [{ id: 1, nome: 'João' }];
    prisma.uSUARIOS.findMany.mockResolvedValue(lista);
    const req = { query: {} };
    const res = mockRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(lista);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.uSUARIOS.findMany.mockRejectedValue(new Error('DB error'));
    const req = { query: {} };
    const res = mockRes();

    await listar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao listar usuários.' });
  });
});

describe('usuariosController: buscarPorId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar usuário pelo ID', async () => {
    const usuario = { id: 1, nome: 'Maria' };
    prisma.uSUARIOS.findUnique.mockResolvedValue(usuario);
    const req = { params: { id: '1' } };
    const res = mockRes();

    await buscarPorId(req, res);

    expect(res.json).toHaveBeenCalledWith(usuario);
  });

  test('deve retornar 404 se não encontrar', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' } };
    const res = mockRes();

    await buscarPorId(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Usuário não encontrado.' });
  });
});

describe('usuariosController: criar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 400 se campos obrigatórios faltarem', async () => {
    const req = { body: { nome: 'Sem email' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: nome, email, username, senha.' });
  });

  test('deve criar usuário com dados válidos', async () => {
    const novoUsuario = { id: 1, nome: 'Fer', email: 'fer@teste.com', username: 'fer', perfil: 'COMUM', status: 'ATIVO' };
    prisma.uSUARIOS.create.mockResolvedValue(novoUsuario);
    const req = { body: { nome: 'Fer', email: 'fer@teste.com', username: 'fer', senha: '123456' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(novoUsuario);
  });

  test('deve retornar 409 se email ou username já existir', async () => {
    prisma.uSUARIOS.create.mockRejectedValue({ code: 'P2002' });
    const req = { body: { nome: 'Fer', email: 'existente@teste.com', username: 'fer', senha: '123456' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Email ou username já em uso.' });
  });
});

describe('usuariosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve atualizar usuário com dados válidos', async () => {
    const atualizado = { id: 1, nome: 'Novo Nome', email: 'novo@teste.com', username: 'novo', perfil: 'COMUM', status: 'ATIVO' };
    prisma.uSUARIOS.update.mockResolvedValue(atualizado);
    const req = { params: { id: '1' }, body: { nome: 'Novo Nome', email: 'novo@teste.com', username: 'novo' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(atualizado);
  });

  test('deve retornar 404 se usuário não existir', async () => {
    prisma.uSUARIOS.update.mockRejectedValue({ code: 'P2025' });
    const req = { params: { id: '999' }, body: { nome: 'X' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Usuário não encontrado.' });
  });
});

describe('usuariosController: inativar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve inativar usuário com sucesso', async () => {
    prisma.uSUARIOS.update.mockResolvedValue({});
    const req = { params: { id: '1' }, usuario: { id: 2n } };
    const res = mockRes();

    await inativar(req, res);

    expect(res.json).toHaveBeenCalledWith({ mensagem: 'Usuário inativado.' });
  });

  test('deve retornar 404 se usuário não existir', async () => {
    const erro = new Error('not found'); erro.code = 'P2025';
    prisma.uSUARIOS.update.mockRejectedValue(erro);
    const req = { params: { id: '999' }, usuario: { id: 2n } };
    const res = mockRes();

    await inativar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Usuário não encontrado.' });
  });
});
