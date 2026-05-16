jest.mock('../prisma', () => ({
  aTIVOS: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../prisma');
const { listar, criar, atualizar, remover } = require('../controllers/ativosController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ativosController: listar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar lista de ativos', async () => {
    const lista = [{ id: 1, nome: 'Notebook', tipo: 'COMPUTADOR' }];
    prisma.aTIVOS.findMany.mockResolvedValue(lista);
    const req = {};
    const res = mockRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(lista);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.aTIVOS.findMany.mockRejectedValue(new Error('DB error'));
    const req = {};
    const res = mockRes();

    await listar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao listar ativos.' });
  });
});

describe('ativosController: criar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 400 se campos obrigatórios faltarem', async () => {
    const req = { body: { nome: 'Notebook' } }; // faltam tipo e localizacao
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: nome, tipo, localizacao.' });
  });

  test('deve criar ativo com dados válidos', async () => {
    const novoAtivo = { id: 1, nome: 'Notebook', tipo: 'COMPUTADOR', localizacao: 'Sala 1', status: 'ATIVO' };
    prisma.aTIVOS.create.mockResolvedValue(novoAtivo);
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', localizacao: 'Sala 1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(novoAtivo);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.aTIVOS.create.mockRejectedValue(new Error('DB error'));
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', localizacao: 'Sala 1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao criar ativo.' });
  });
});

describe('ativosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve atualizar ativo com dados válidos', async () => {
    const ativoAtualizado = { id: 1, nome: 'Notebook Atualizado', tipo: 'COMPUTADOR', localizacao: 'Sala 2', status: 'ATIVO' };
    prisma.aTIVOS.update.mockResolvedValue(ativoAtualizado);
    const req = { params: { id: '1' }, body: { nome: 'Notebook Atualizado', localizacao: 'Sala 2' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(ativoAtualizado);
  });

  test('deve retornar 404 se ativo não existir', async () => {
    prisma.aTIVOS.update.mockRejectedValue(new Error('not found'));
    const req = { params: { id: '999' }, body: { nome: 'X' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });
});

describe('ativosController: remover', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve remover ativo com sucesso', async () => {
    prisma.aTIVOS.delete.mockResolvedValue({});
    const req = { params: { id: '1' } };
    const res = mockRes();

    await remover(req, res);

    expect(res.json).toHaveBeenCalledWith({ mensagem: 'Ativo removido.' });
  });

  test('deve retornar 404 se ativo não existir', async () => {
    prisma.aTIVOS.delete.mockRejectedValue(new Error('not found'));
    const req = { params: { id: '999' } };
    const res = mockRes();

    await remover(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });
});
