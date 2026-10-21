jest.mock('../prisma', () => ({
  cHAMADOS: { findFirst: jest.fn() },
  dOCUMENTACOES: { findFirst: jest.fn() },
  lOCAIS: { findUnique: jest.fn(), findMany: jest.fn() },
  aTIVOS: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  hISTORICO_ATIVOS: { findMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require('../prisma');
const { listar, criar, atualizar, historico, remover } = require('../controllers/ativosController');
const { listar: listarLocais } = require('../controllers/locaisController');

beforeEach(() => {
  prisma.aTIVOS.findFirst.mockResolvedValue(null);
  prisma.lOCAIS.findUnique.mockResolvedValue({ id: 1n, nome: 'Secretaria', status: 'ATIVO' });
  prisma.aTIVOS.findUnique.mockResolvedValue({
    id: 1n, id_local: 1n, status: 'ATIVO', local: { id: 1n, nome: 'Secretaria' },
  });
  prisma.$transaction.mockImplementation(callback => callback(prisma));
});

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
    expect(res.json).toHaveBeenCalledWith({ erro: 'Campos obrigatórios: nome, tipo, id_local.' });
  });

  test('deve criar ativo com dados válidos', async () => {
    const novoAtivo = { id: 1, nome: 'Notebook', tipo: 'COMPUTADOR', patrimonio: '001234', id_local: '1', status: 'ATIVO' };
    prisma.aTIVOS.create.mockResolvedValue(novoAtivo);
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', patrimonio: '001234', id_local: '1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(novoAtivo);
  });

  test('aceita NOTEBOOK e normaliza o status legado de manutenção', async () => {
    const novoAtivo = { id: 2, nome: 'Notebook', tipo: 'NOTEBOOK', patrimonio: '001234', id_local: '1', status: 'MANUTENCAO' };
    prisma.aTIVOS.create.mockResolvedValue(novoAtivo);
    const req = { body: { nome: 'Notebook', tipo: 'NOTEBOOK', patrimonio: '001234', id_local: '1', status: 'EM_MANUTENCAO' } };
    const res = mockRes();

    await criar(req, res);

    expect(prisma.aTIVOS.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'NOTEBOOK', status: 'MANUTENCAO' }) });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.aTIVOS.create.mockRejectedValue(new Error('DB error'));
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', patrimonio: '001234', id_local: '1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao criar ativo.' });
  });
});

describe('validação de patrimônio', () => {
  beforeEach(() => jest.clearAllMocks());
  const body = { nome: 'PC novo', tipo: 'COMPUTADOR', id_local: '1', patrimonio: ' 001234 ' };
  test.each([undefined, '', '   '])('patrimônio obrigatório: %s', async patrimonio => {
    const res = mockRes();
    await criar({ body: { ...body, patrimonio } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Patrimônio é obrigatório.' });
    expect(prisma.aTIVOS.create).not.toHaveBeenCalled();
  });
  test('informa nome do ativo que já possui o patrimônio e não grava', async () => {
    prisma.aTIVOS.findFirst.mockResolvedValue({ nome: 'Monitor Secretaria', patrimonio: '001234' });
    const res = mockRes();
    await criar({ body }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo Monitor Secretaria já possui o patrimônio 001234' });
    expect(prisma.aTIVOS.findFirst).toHaveBeenCalledWith({ where: { patrimonio: '001234' }, select: { nome: true, patrimonio: true } });
    expect(prisma.aTIVOS.create).not.toHaveBeenCalled();
  });
  test('trata conflito de cadastros simultâneos retornado pelo índice único', async () => {
    prisma.aTIVOS.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ nome: 'Outro PC', patrimonio: '001234' });
    prisma.aTIVOS.create.mockRejectedValue({ code: 'P2002' });
    const res = mockRes();
    await criar({ body }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo Outro PC já possui o patrimônio 001234' });
  });
});

describe('ativosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('atualiza status e registra o evento com o usuário responsável', async () => {
    const ativoAtualizado = { id: 1n, nome: 'Notebook', status: 'MANUTENCAO' };
    prisma.aTIVOS.update.mockResolvedValue(ativoAtualizado);
    const req = { params: { id: '1' }, usuario: { id: 2n }, body: { status: 'MANUTENCAO' } };
    const res = mockRes();

    await atualizar(req, res);

    expect(res.json).toHaveBeenCalledWith(ativoAtualizado);
    expect(prisma.aTIVOS.update).toHaveBeenCalledWith({
      where: { id: 1n }, data: { status: 'MANUTENCAO' }, include: { local: true },
    });
    expect(prisma.hISTORICO_ATIVOS.create).toHaveBeenCalledWith({
      data: { id_ativo: 1n, id_usuario: 2n, comentario: 'Status alterado de ATIVO para MANUTENCAO.' },
    });
  });

  test('rejeita atualizações de campos além de status e localização', async () => {
    const res = mockRes();
    await atualizar({ params: { id: '1' }, body: { nome: 'Outro nome' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Somente status e localização podem ser alterados.' });
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
  });

  test('retorna 404 se o ativo não existir', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await atualizar({ params: { id: '999' }, usuario: { id: 2n }, body: { status: 'INATIVO' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Ativo não encontrado.' });
  });

  test('não cria evento para alterações sem mudança efetiva', async () => {
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { status: 'ATIVO', id_local: '1' } }, res);
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
    expect(prisma.hISTORICO_ATIVOS.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ATIVO' }));
  });

  test('rejeita status inválido', async () => {
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { status: 'QUEBRADO' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
  });

  test('retorna erro interno se a gravação do histórico falhar e reverte a alteração', async () => {
    prisma.hISTORICO_ATIVOS.create.mockRejectedValue(new Error('DB error'));
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { status: 'INATIVO' } }, res);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao atualizar ativo.' });
  });
});

describe('ativosController: histórico', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retorna eventos em ordem decrescente com o nome do usuário', async () => {
    const eventos = [{ id: 3n, comentario: 'Status alterado.', usuario: { nome: 'Técnico' } }];
    prisma.hISTORICO_ATIVOS.findMany.mockResolvedValue(eventos);
    const res = mockRes();
    await historico({ params: { id: '1' } }, res);
    expect(prisma.hISTORICO_ATIVOS.findMany).toHaveBeenCalledWith({
      where: { id_ativo: 1n },
      include: { usuario: { select: { nome: true } } },
      orderBy: { criado_em: 'desc' },
    });
    expect(res.json).toHaveBeenCalledWith(eventos);
  });

  test('retorna 404 ao solicitar histórico de ativo inexistente', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await historico({ params: { id: '999' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.hISTORICO_ATIVOS.findMany).not.toHaveBeenCalled();
  });
});

describe('patrimônio separado do nome', () => {
  beforeEach(() => jest.clearAllMocks());

  test('preserva zeros à esquerda e grava nome e patrimônio separadamente', async () => {
    prisma.aTIVOS.create.mockResolvedValue({ id: 1n });
    const res = mockRes();
    await criar({ body: { nome: 'Notebook Dell', patrimonio: ' 001234 ', tipo: 'NOTEBOOK', id_local: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.aTIVOS.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nome: 'Notebook Dell', patrimonio: '001234' }) });
  });

  test('rejeita patrimônio numérico para evitar perda de zeros', async () => {
    const res = mockRes();
    await criar({ body: { nome: 'Notebook', patrimonio: 123, tipo: 'NOTEBOOK', id_local: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.create).not.toHaveBeenCalled();
  });
});

describe('locais cadastrados no banco', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lista somente locais ativos ordenados pelo nome', async () => {
    const locais = [{ id: 1n, nome: 'Secretaria', status: 'ATIVO' }];
    prisma.lOCAIS.findMany.mockResolvedValue(locais);
    const res = mockRes();
    await listarLocais({}, res);
    expect(prisma.lOCAIS.findMany).toHaveBeenCalledWith({ where: { status: 'ATIVO' }, orderBy: { nome: 'asc' } });
    expect(res.json).toHaveBeenCalledWith(locais);
  });
  test('erro ao consultar locais não vira uma lista vazia', async () => {
    prisma.lOCAIS.findMany.mockRejectedValue(new Error('DB'));
    const res = mockRes();
    await listarLocais({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
  test.each([null, { id: 2n, status: 'INATIVO' }])('impede cadastro em local inexistente ou inativo: %s', async local => {
    prisma.lOCAIS.findUnique.mockResolvedValue(local);
    const res = mockRes();
    await criar({ body: { nome: 'PC', tipo: 'COMPUTADOR', patrimonio: '001234', id_local: '2' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.create).not.toHaveBeenCalled();
  });
  test('não permite trocar para local inativo', async () => {
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'INATIVO' });
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { id_local: '2' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
  });
  test('atualiza para local ativo e registra a mudança no histórico', async () => {
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, nome: 'Laboratório', status: 'ATIVO' });
    prisma.aTIVOS.update.mockResolvedValue({ id: 1n, id_local: 2n, local: { id: 2n, nome: 'Laboratório' } });
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { id_local: '2' } }, res);
    expect(prisma.aTIVOS.update).toHaveBeenCalledWith({
      where: { id: 1n }, data: { id_local: 2n }, include: { local: true },
    });
    expect(prisma.hISTORICO_ATIVOS.create).toHaveBeenCalledWith({
      data: { id_ativo: 1n, id_usuario: 2n, comentario: 'Localização alterada de Secretaria para Laboratório.' },
    });
  });
  test('mantém o local atual após sua inativação sem gerar evento', async () => {
    prisma.aTIVOS.findUnique.mockResolvedValue({
      id: 1n, id_local: 1n, status: 'ATIVO', local: { id: 1n, nome: 'Secretaria', status: 'INATIVO' },
    });
    const res = mockRes();
    await atualizar({ params: { id: '1' }, usuario: { id: 2n }, body: { id_local: '1' } }, res);
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
    expect(prisma.hISTORICO_ATIVOS.create).not.toHaveBeenCalled();
    expect(prisma.lOCAIS.findUnique).not.toHaveBeenCalled();
  });
  test('listagem inclui o local vinculado para refletir renomeações', async () => {
    prisma.aTIVOS.findMany.mockResolvedValue([{ id: 1n, localizacao: 'Nome antigo', local: { id: 1n, nome: 'Nome novo' } }]);
    await listar({}, mockRes());
    expect(prisma.aTIVOS.findMany).toHaveBeenCalledWith({ include: { local: true }, orderBy: { nome: 'asc' } });
  });
});

describe('ativosController: remover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cHAMADOS.findFirst.mockResolvedValue(null);
    prisma.dOCUMENTACOES.findFirst.mockResolvedValue(null);
  });

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

  test('não remove ativo com vínculos históricos', async () => {
    prisma.cHAMADOS.findFirst.mockResolvedValue({ id: 4n, status: 'CONCLUIDO' });
    const req = { params: { id: '1' } };
    const res = mockRes();

    await remover(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.aTIVOS.delete).not.toHaveBeenCalled();
  });
});
