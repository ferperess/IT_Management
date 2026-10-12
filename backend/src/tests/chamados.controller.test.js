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
  lOCAIS: {
    findUnique: jest.fn(),
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
    const lista = [{
      id: 1, titulo: 'Problema no PC', status: 'ABERTO', criado_em: new Date(), pausas_sla: [],
      ativo: { id: 10, nome: 'Computador', local: { id: 2, nome: 'Laboratório' } },
    }];
    prisma.cHAMADOS.findMany.mockResolvedValue(lista);
    const req = { usuario: { perfil: 'ADMIN', id: 1n } };
    const res = mockRes();

    await listar(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 1, titulo: 'Problema no PC', ativo: lista[0].ativo, sla: expect.any(Object) }),
    ]));
    expect(prisma.cHAMADOS.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        local: { select: { id: true, nome: true } },
        ativo: { select: { id: true, nome: true, local: { select: { id: true, nome: true } } } },
      }),
    }));
  });

  test('não deve expor prazos nem pausas de SLA para usuário comum', async () => {
    prisma.cHAMADOS.findMany.mockResolvedValue([{
      id: 1, titulo: 'Problema no PC', status: 'ABERTO', criado_em: new Date(),
      prazo_atendimento_em: new Date(), prazo_resolucao_em: new Date(),
      pausas_sla: [{ iniciado_em: new Date(), encerrado_em: null }],
    }]);
    const req = { usuario: { perfil: 'USER', id: 1n } };
    const res = mockRes();

    await listar(req, res);

    const [chamado] = res.json.mock.calls[0][0];
    expect(chamado).not.toHaveProperty('sla');
    expect(chamado).not.toHaveProperty('prazo_atendimento_em');
    expect(chamado).not.toHaveProperty('prazo_resolucao_em');
    expect(chamado).not.toHaveProperty('pausas_sla');
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

  test('não deve expor prazos nem pausas de SLA nos detalhes para usuário comum', async () => {
    prisma.cHAMADOS.findUnique.mockResolvedValue({
      id: 1, id_solicitante: 1n, titulo: 'Problema no PC', status: 'AGUARDANDO_USUARIO', criado_em: new Date(),
      prazo_atendimento_em: new Date(), prazo_resolucao_em: new Date(),
      pausas_sla: [{ iniciado_em: new Date(), encerrado_em: null }],
      documentos_vinculados: [{ documentacao: { id: 2n, titulo: 'Manual', arquivo_nome: 'manual.pdf' } }],
    });
    const req = { params: { id: '1' }, usuario: { perfil: 'USER', id: 1n } };
    const res = mockRes();

    await buscarPorId(req, res);

    const chamado = res.json.mock.calls[0][0];
    expect(chamado).not.toHaveProperty('sla');
    expect(chamado).not.toHaveProperty('prazo_atendimento_em');
    expect(chamado).not.toHaveProperty('prazo_resolucao_em');
    expect(chamado).not.toHaveProperty('pausas_sla');
    expect(chamado).not.toHaveProperty('documentos_vinculados');
  });

  test('perfil intermediário consulta todos os chamados com os dados completos', async () => {
    const chamado = {
      id: 2, titulo: 'Chamado de outra pessoa', status: 'ABERTO', criado_em: new Date(),
      prazo_atendimento_em: new Date(), prazo_resolucao_em: new Date(), pausas_sla: [],
    };
    prisma.cHAMADOS.findMany.mockResolvedValue([chamado]);
    const req = { usuario: { perfil: 'DIRECTOR', id: 9n } };
    const res = mockRes();

    await listar(req, res);

    expect(prisma.cHAMADOS.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(res.json.mock.calls[0][0][0]).toHaveProperty('sla');
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
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'ATIVO' });
  });

  test('deve retornar 400 se titulo não for fornecido', async () => {
    const req = { body: { descricao: 'Sem título' }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: titulo, descricao.' });
  });

  test.each([null, 42, {}])('deve rejeitar título não textual (%p) com 400', async titulo => {
    const req = { body: { titulo, descricao: 'Descrição completa do problema', id_local: '2' }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });

  test('deve rejeitar conteúdo de chamado acima do limite', async () => {
    const req = { body: { titulo: 'x'.repeat(201), descricao: 'Descrição completa do problema', id_local: '2' }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });

  test('deve retornar 400 se descricao não for fornecida', async () => {
    const req = { body: { titulo: 'Problema' }, usuario: { id: 1 } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: titulo, descricao.' });
  });

  test('deve exigir localização', async () => {
    const req = { body: { titulo: 'Problema no PC', descricao: 'Descrição completa do problema' }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Selecione a localização do problema.' });
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });

  test('deve rejeitar localização inativa ou inexistente', async () => {
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'INATIVO' });
    const req = { body: { titulo: 'Problema no PC', descricao: 'Descrição completa do problema', id_local: '2' }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Selecione uma localização ativa.' });
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });

  test('deve criar chamado com dados válidos e prioridade da IA', async () => {
    const solicitante = { id: 1, nome: 'Fer' };
    const chamadoCriado = { id: 1, titulo: 'Problema no PC', descricao: 'PC não liga', status: 'ABERTO', prioridade: 'MEDIA', categoria: 'OUTRO' };
    prisma.uSUARIOS.findUnique.mockResolvedValue(solicitante);
    prisma.cHAMADOS.create.mockResolvedValue(chamadoCriado);
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});

    const req = { body: { titulo: 'Problema no PC', descricao: 'Computador não liga para o usuário', id_local: '2' }, usuario: { id: 1n } };
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
    expect(prisma.cHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id_local: 2n }),
    }));
  });

  test('deve retornar 400 se ativo não existir', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue(null);
    const req = { body: { titulo: 'Problema no PC', descricao: 'Descrição completa do problema', id_local: '2', id_ativo: 99 }, usuario: { id: 1n } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });

  test('deve bloquear USER de vincular ativo ao abrir chamado', async () => {
    prisma.aTIVOS.findUnique.mockClear();
    const req = { body: { titulo: 'Problema no PC', descricao: 'Descrição completa do problema', id_local: '2', id_ativo: 1 }, usuario: { id: 1n, perfil: 'USER' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.aTIVOS.findUnique).not.toHaveBeenCalled();
  });
});

describe('chamadosController: dados de ativo para USER', () => {
  test('buscarPorId não expõe o ativo ao solicitante USER', async () => {
    prisma.cHAMADOS.findUnique.mockResolvedValue({ id: 1n, id_solicitante: 1n, ativo: { id: 5n, nome: 'PC', local: { id: 1n, nome: 'Lab' } }, pausas_sla: [], documentos_vinculados: [], historico: [] });
    const res = mockRes();

    await buscarPorId({ params: { id: '1' }, usuario: { perfil: 'USER', id: 1n } }, res);

    expect(res.json.mock.calls[0][0]).not.toHaveProperty('ativo');
  });
});

describe('opção de confirmação na abertura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'ATIVO' });
    prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 1n, nome: 'Solicitante' });
    prisma.cHAMADOS.create.mockResolvedValue({ id: 1n, status: 'ABERTO' });
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});
  });
  test.each([true, false, undefined])('persiste checkbox %s com padrão desmarcado', async exige_confirmacao => {
    const res = mockRes();
    await criar({ body: { titulo: 'Problema no PC', descricao: 'Computador não liga', id_local: '2', exige_confirmacao }, usuario: { id: 1n } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.cHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id_local: 2n, exige_confirmacao: exige_confirmacao ?? false }) }));
  });
  test('não converte texto false em verdadeiro', async () => {
    const res = mockRes();
    await criar({ body: { titulo: 'Problema no PC', descricao: 'Computador não liga', id_local: '2', exige_confirmacao: 'false' }, usuario: { id: 1n } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });
});

describe('abertura em nome de outra pessoa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'ATIVO' });
    prisma.uSUARIOS.findUnique.mockImplementation(async ({ where }) => where.id === 1n
      ? { id: 1n, nome: 'Admin Ana', status: 'ATIVO' }
      : where.id === 2n ? { id: 2n, nome: 'Bruno', status: 'ATIVO' } : null);
    prisma.cHAMADOS.create.mockResolvedValue({ id: 10n, status: 'ABERTO' });
    prisma.hISTORICO_CHAMADOS.create.mockResolvedValue({});
  });
  const request = (perfil, extra = {}) => ({ usuario: { id: 1n, perfil }, body: { titulo: 'Computador parado', descricao: 'Computador não inicia o sistema', id_local: '2', id_solicitante: '2', ...extra } });
  test('admin registra destinatário e autor autenticado, inclusive no histórico', async () => {
    const res = mockRes();
    await criar(request('ADMIN', { id_aberto_por: '999' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.cHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id_local: 2n, id_solicitante: 2n, id_aberto_por: 1n }) }));
    expect(prisma.hISTORICO_CHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id_usuario: 1n, comentario: 'Chamado aberto por Admin Ana em nome de Bruno.' }) }));
  });
  test.each(['DIRECTOR', 'USER'])('bloqueia perfil %s mesmo enviando solicitante diretamente à API', async perfil => {
    const res = mockRes();
    await criar(request(perfil), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });
  test('recusa solicitante inativo', async () => {
    prisma.uSUARIOS.findUnique.mockResolvedValue({ id: 2n, nome: 'Bruno', status: 'INATIVO' });
    const res = mockRes();
    await criar(request('ADMIN'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });
  test.each(['999', 'abc', null])('recusa solicitante inexistente ou ID inválido: %s', async id_solicitante => {
    const res = mockRes();
    await criar(request('ADMIN', { id_solicitante }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.create).not.toHaveBeenCalled();
  });
  test('abertura comum continua em nome do próprio usuário', async () => {
    const req = request('USER');
    delete req.body.id_solicitante;
    const res = mockRes();
    await criar(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.cHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id_solicitante: 1n, id_aberto_por: 1n }) }));
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

    const req = { params: { id: '1' }, body: { status: 'EM_ANDAMENTO', comentario: 'TV dando imagem novamente' }, usuario: { id: 1n, perfil: 'ADMIN' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1n, status: 'EM_ANDAMENTO', sla: expect.any(Object) }));
    expect(prisma.hISTORICO_CHAMADOS.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ comentario: expect.stringContaining('Comentário: TV dando imagem novamente') }),
    }));
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

  test('deve filtrar dashboard pelo solicitante quando perfil for USER', async () => {
    prisma.cHAMADOS.count.mockResolvedValue(1);
    prisma.aTIVOS.count.mockResolvedValue(20);
    prisma.cHAMADOS.findMany.mockResolvedValue([]);

    const req = { usuario: { perfil: 'USER', id: 7 } };
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
