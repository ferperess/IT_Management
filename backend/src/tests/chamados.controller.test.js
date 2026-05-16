jest.mock('../prisma', () => ({
  cHAMADOS: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  aTIVOS: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  uSUARIOS: {
    findUnique: jest.fn(),
  },
  hISTORICO_CHAMADOS: {
    create: jest.fn(),
  },
}));

jest.mock('../services/apiService', () => ({
  classificarPrioridade: jest.fn().mockResolvedValue('MEDIA'),
}));

const prisma = require('../prisma');
const { listar, buscarPorId, criar, atualizar, dashboard } = require('../controllers/chamadosController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('chamadosController: listar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar lista de chamados', async () => {
    const lista = [{ id: 1, titulo: 'Problema no PC' }];
    prisma.cHAMADOS.findMany.mockResolvedValue(lista);
    const req = {};
    const res = mockRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(lista);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.cHAMADOS.findMany.mockRejectedValue(new Error('DB error'));
    const req = {};
    const res = mockRes();

    await listar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao listar chamados.' });
  });
});

describe('chamadosController: buscarPorId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar chamado pelo ID', async () => {
    const chamado = { id: 1, titulo: 'Problema no PC' };
    prisma.cHAMADOS.findUnique.mockResolvedValue(chamado);
    const req = { params: { id: '1' } };
    const res = mockRes();

    await buscarPorId(req, res);

    expect(res.json).toHaveBeenCalledWith(chamado);
  });

  test('deve retornar 404 se não encontrar', async () => {
    prisma.cHAMADOS.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' } };
    const res = mockRes();

    await buscarPorId(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Chamado não encontrado.' });
  });
});

describe('chamadosController: criar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 400 se titulo não for fornecido', async () => {
    const req = { body: { descricao: 'Sem título' }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: titulo, descricao.' });
  });

  test('deve retornar 400 se descricao não for fornecida', async () => {
    const req = { body: { titulo: 'Problema' }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: titulo, descricao.' });
  });

  test('deve criar chamado com dados válidos e prioridade da IA', async () => {
    const solicitante = { id: 1, nome: 'Fer' };
    const chamadoCriado = { id: 1, titulo: 'Problema no PC', descricao: 'PC não liga', prioridade: 'MEDIA' };
    prisma.uSUARIOS.findUnique.mockResolvedValue(solicitante);
    prisma.cHAMADOS.create.mockResolvedValue(chamadoCriado);
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});

    const req = { body: { titulo: 'Problema no PC', descricao: 'PC não liga' }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(chamadoCriado);
  });

  test('deve retornar 400 se ativo não existir', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue(null);
    const req = { body: { titulo: 'Problema', descricao: 'Desc', id_ativo: 99 }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });
});

describe('chamadosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 404 se chamado não existir', async () => {
    prisma.cHAMADOS.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' }, body: { status: 'CONCLUIDO' }, usuario: { id: 1 } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Chamado não encontrado.' });
  });

  test('deve atualizar chamado com dados válidos', async () => {
    const chamadoExistente = { id: 1, status: 'ABERTO' };
    const chamadoAtualizado = { id: 1, status: 'CONCLUIDO' };
    prisma.cHAMADOS.findUnique.mockResolvedValue(chamadoExistente);
    prisma.cHAMADOS.update.mockResolvedValue(chamadoAtualizado);
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});

    const req = { params: { id: '1' }, body: { status: 'CONCLUIDO' }, usuario: { id: 1 } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(chamadoAtualizado);
  });
});

describe('chamadosController: dashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar contagens do dashboard', async () => {
    prisma.cHAMADOS.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10);
    prisma.aTIVOS.count.mockResolvedValue(20);

    const req = {};
    const res = mockRes();

    await dashboard(req, res);

    expect(res.json).toHaveBeenCalledWith({ abertos: 5, andamento: 3, concluidos: 10, totalAtivos: 20 });
  });
});
