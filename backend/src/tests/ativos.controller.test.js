jest.mock('../prisma', () => ({
  cHAMADOS: { findFirst: jest.fn() },
  dOCUMENTACOES: { findFirst: jest.fn() },
  lOCAIS: { findUnique: jest.fn(), findMany: jest.fn() },
  aTIVOS: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../prisma');
const { listar, criar, atualizar, remover } = require('../controllers/ativosController');
const { listar: listarLocais } = require('../controllers/locaisController');

beforeEach(() => {
  prisma.lOCAIS.findUnique.mockResolvedValue({ id: 1n, nome: 'Secretaria', status: 'ATIVO' });
  prisma.aTIVOS.findUnique.mockResolvedValue({ id: 1n, id_local: 1n });
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
    const novoAtivo = { id: 1, nome: 'Notebook', tipo: 'COMPUTADOR', id_local: '1', status: 'ATIVO' };
    prisma.aTIVOS.create.mockResolvedValue(novoAtivo);
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', id_local: '1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(novoAtivo);
  });

  test('aceita NOTEBOOK e normaliza o status legado de manutenção', async () => {
    const novoAtivo = { id: 2, nome: 'Notebook', tipo: 'NOTEBOOK', id_local: '1', status: 'MANUTENCAO' };
    prisma.aTIVOS.create.mockResolvedValue(novoAtivo);
    const req = { body: { nome: 'Notebook', tipo: 'NOTEBOOK', id_local: '1', status: 'EM_MANUTENCAO' } };
    const res = mockRes();

    await criar(req, res);

    expect(prisma.aTIVOS.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'NOTEBOOK', status: 'MANUTENCAO' }) });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('deve retornar 500 em erro de banco', async () => {
    prisma.aTIVOS.create.mockRejectedValue(new Error('DB error'));
    const req = { body: { nome: 'Notebook', tipo: 'COMPUTADOR', id_local: '1' } };
    const res = mockRes();

    await criar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao criar ativo.' });
  });
});

describe('ativosController: atualizar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve atualizar ativo com dados válidos', async () => {
    const ativoAtualizado = { id: 1, nome: 'Notebook Atualizado', tipo: 'COMPUTADOR', id_local: '2', status: 'ATIVO' };
    prisma.aTIVOS.update.mockResolvedValue(ativoAtualizado);
    const req = { params: { id: '1' }, body: { nome: 'Notebook Atualizado', id_local: '2' } };
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

describe('patrimônio separado do nome', () => {
  beforeEach(() => jest.clearAllMocks());

  test('preserva zeros à esquerda e grava nome e patrimônio separadamente', async () => {
    prisma.aTIVOS.create.mockResolvedValue({ id: 1n });
    const res = mockRes();
    await criar({ body: { nome: 'Notebook Dell', patrimonio: ' 001234 ', tipo: 'NOTEBOOK', id_local: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.aTIVOS.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nome: 'Notebook Dell', patrimonio: '001234' }) });
  });

  test('permite limpar o patrimônio sem alterar o nome', async () => {
    prisma.aTIVOS.update.mockResolvedValue({ id: 1n });
    await atualizar({ params: { id: '1' }, body: { patrimonio: '' } }, mockRes());
    expect(prisma.aTIVOS.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { patrimonio: null } });
  });

  test('edição antiga não apaga patrimônio quando o campo não é enviado', async () => {
    prisma.aTIVOS.update.mockResolvedValue({ id: 1n });
    await atualizar({ params: { id: '1' }, body: { nome: 'Monitor' } }, mockRes());
    expect(prisma.aTIVOS.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { nome: 'Monitor' } });
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
    await criar({ body: { nome: 'PC', tipo: 'COMPUTADOR', id_local: '2' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.create).not.toHaveBeenCalled();
  });
  test('não permite trocar para local inativo', async () => {
    prisma.lOCAIS.findUnique.mockResolvedValue({ id: 2n, status: 'INATIVO' });
    const res = mockRes();
    await atualizar({ params: { id: '1' }, body: { id_local: '2' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.aTIVOS.update).not.toHaveBeenCalled();
  });
  test('permite manter o local atual após inativação', async () => {
    prisma.aTIVOS.update.mockResolvedValue({ id: 1n });
    const res = mockRes();
    await atualizar({ params: { id: '1' }, body: { nome: 'PC atualizado', id_local: '1' } }, res);
    expect(prisma.aTIVOS.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { nome: 'PC atualizado', id_local: 1n } });
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
