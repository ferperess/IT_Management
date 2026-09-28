jest.mock('../prisma', () => ({
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
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
  classificarChamado: jest.fn().mockResolvedValue({ prioridade: 'MEDIA', categoria: 'OUTRO' }),
}));

const prisma = require('../prisma');
const { listar, buscarPorId, criar, atualizar, dashboard } = require('../controllers/chamadosController');
prisma.$transaction.mockImplementation(fn => fn(prisma));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('chamadosController: listar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar lista de chamados', async () => {
    const lista = [{ id: 1, titulo: 'Problema no PC', status: 'ABERTO', criado_em: new Date(), pausas_sla: [] }];
    prisma.cHAMADOS.findMany.mockResolvedValue(lista);
    const req = { usuario: { perfil: 'ADMIN', id: 1n } };
    const res = mockRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 1, titulo: 'Problema no PC', sla: expect.any(Object) }),
    ]));
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
    const chamado = { id: 1, titulo: 'Problema no PC', status: 'ABERTO', criado_em: new Date(), pausas_sla: [] };
    prisma.cHAMADOS.findUnique.mockResolvedValue(chamado);
    const req = { params: { id: '1' }, usuario: { perfil: 'ADMIN', id: 1n } };
    const res = mockRes();

    await buscarPorId(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, titulo: 'Problema no PC', sla: expect.any(Object) }));
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
    const chamadoCriado = { id: 1, titulo: 'Problema no PC', descricao: 'PC não liga', status: 'ABERTO', prioridade: 'MEDIA', categoria: 'OUTRO' };
    prisma.uSUARIOS.findUnique.mockResolvedValue(solicitante);
    prisma.cHAMADOS.create.mockResolvedValue(chamadoCriado);
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});

    const req = { body: { titulo: 'Problema no PC', descricao: 'Computador não liga para o usuário' }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ...chamadoCriado,
      prioridade: 'MEDIA',
      categoria: 'OUTRO',
      aviso: null,
      sla: expect.any(Object),
      historico: [expect.any(Object)],
    }));
  });

  test('deve retornar 400 se ativo não existir', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue(null);
    const req = { body: { titulo: 'Problema no PC', descricao: 'Descrição completa do problema', id_ativo: 99 }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });
});

describe('opção de confirmação na abertura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, nome: 'Solicitante' });
    prisma.cHAMADOS.create.mockResolvedValue({ id: 1n, status: 'ABERTO' });
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});
  });
  test.each([true, false, undefined])('persiste checkbox %s com padrão desmarcado', async exige_confirmacao => {
    const res = mockRes();
    await criar({ body: { titulo: 'Problema no PC', descricao: 'Computador não liga', exige_confirmacao }, usuario: { id: 1n } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.cHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ exige_confirmacao: exige_confirmacao ?? false }) }));
  });
  test('não converte texto false em verdadeiro', async () => {
    const res = mockRes();
    await criar({ body: { titulo: 'Problema no PC', descricao: 'Computador não liga', exige_confirmacao: 'false' }, usuario: { id: 1n } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });
});

describe('chamadosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar 404 se chamado não existir', async () => {
    prisma.cHAMADOS.findUnique.mockResolvedValue(null);
    const req = { params: { id: '999' }, body: { status: 'CONCLUIDO' }, usuario: { id: 1n, perfil: 'ADMIN' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Chamado não encontrado.' });
  });

  test('deve atualizar chamado com dados válidos', async () => {
    const chamadoExistente = { id: 1n, status: 'ABERTO', prioridade: 'MEDIA', criado_em: new Date(), pausas_sla: [], documentos_vinculados: [] };
    const chamadoAtualizado = { ...chamadoExistente, status: 'EM_ANDAMENTO', atendimento_iniciado_em: new Date() };
    prisma.cHAMADOS.findUnique.mockResolvedValueOnce(chamadoExistente).mockResolvedValueOnce(chamadoAtualizado);
    prisma.cHAMADOS.update.mockResolvedValue(chamadoAtualizado);
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});

    const req = { params: { id: '1' }, body: { status: 'EM_ANDAMENTO' }, usuario: { id: 1n, perfil: 'ADMIN' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1n, status: 'EM_ANDAMENTO', sla: expect.any(Object) }));
  });
});

describe('chamadosController: dashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve retornar contagens do dashboard', async () => {
    prisma.cHAMADOS.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2);
    prisma.aTIVOS.count.mockResolvedValue(20);
    prisma.cHAMADOS.findMany.mockResolvedValue([
      {
        status: 'CONCLUIDO',
        criado_em: new Date('2026-09-20T00:00:00Z'),
        atendimento_iniciado_em: new Date('2026-09-20T04:00:00Z'),
        concluido_em: new Date('2026-09-20T11:00:00Z'),
        pausas_sla: [{ iniciado_em: new Date('2026-09-20T05:00:00Z'), encerrado_em: new Date('2026-09-20T06:00:00Z') }],
      },
      { status: 'ABERTO', criado_em: new Date('2026-09-20T00:00:00Z'), atendimento_iniciado_em: null, concluido_em: null, pausas_sla: [] },
    ]);

    const req = { usuario: { perfil: 'ADMIN', id: 1 } };
    const res = mockRes();

    await dashboard(req, res);

    expect(res.json).toHaveBeenCalledWith({
      abertos: 5,
      andamento: 3,
      concluidos: 10,
      totalAtivos: 20,
      aguardando: 2,
      tempoMedioAtendimentoHoras: 4,
      tempoMedioResolucaoHoras: 10,
    });
  });

  test('deve filtrar dashboard pelo solicitante quando perfil for COMUM', async () => {
    prisma.cHAMADOS.count.mockResolvedValue(1);
    prisma.aTIVOS.count.mockResolvedValue(20);
    prisma.cHAMADOS.findMany.mockResolvedValue([]);

    const req = { usuario: { perfil: 'COMUM', id: 7 } };
    const res = mockRes();

    await dashboard(req, res);

    for (const chamada of prisma.cHAMADOS.count.mock.calls) {
      expect(chamada[0].where.id_solicitante).toBe(7);
    }
    expect(prisma.cHAMADOS.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id_solicitante: 7 } }));
    expect(res.json).toHaveBeenCalledWith({
      abertos: 1,
      andamento: 1,
      concluidos: 1,
      totalAtivos: 20,
      aguardando: 1,
      tempoMedioAtendimentoHoras: null,
      tempoMedioResolucaoHoras: null,
    });
  });
});
