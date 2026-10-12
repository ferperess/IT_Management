jest.mock('../prisma', () => ({
  $transaction: jest.fn(), $executeRaw: jest.fn(),
  dOCUMENTACOES: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  cHAMADOS: { findMany: jest.fn() }, cHAMADOS_DOCUMENTACOES: { createMany: jest.fn(), deleteMany: jest.fn() }, hISTORICO_CHAMADOS: { create: jest.fn() },
}));
const prisma = require('../prisma');
const ctrl = require('../controllers/documentacoesController');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const req = body => ({ body, params: { id: '7' }, usuario: { id: 2n, perfil: 'ADMIN' } });
let doc;
beforeEach(() => {
  jest.clearAllMocks();
  doc = { id: 7n, titulo: 'Manual', chamados_vinculados: [] };
  prisma.$transaction.mockImplementation(cb => cb(prisma));
  prisma.dOCUMENTACOES.create.mockResolvedValue(doc);
  prisma.dOCUMENTACOES.update.mockResolvedValue(doc);
  prisma.dOCUMENTACOES.findUnique.mockImplementation(async () => doc);
  prisma.cHAMADOS.findMany.mockImplementation(async ({ where }) => where.id.in.map(id => ({ id, status: 'ABERTO' })));
});
test.each([
  { id_chamado: '2' },
  { ids_chamados: '["2"]' },
])('rejeita vínculos com chamados enviados pela documentação', async vinculo => {
  const r = response(); await ctrl.criar(req({ titulo: 'Manual', ...vinculo }), r);
  expect(r.status).toHaveBeenCalledWith(400);
  expect(prisma.dOCUMENTACOES.create).not.toHaveBeenCalled();
  expect(prisma.cHAMADOS_DOCUMENTACOES.createMany).not.toHaveBeenCalled();
});
test('editar documento preserva os vínculos gerenciados pelo chamado', async () => {
  doc.chamados_vinculados = [{ id_chamado: 2n, chamado: { id: 2n, status: 'ABERTO' } }];
  const r = response(); await ctrl.atualizar(req({ titulo: 'Manual atualizado' }), r);
  expect(r.status).toHaveBeenCalledWith(200);
  expect(prisma.dOCUMENTACOES.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { titulo: 'Manual atualizado' } });
  expect(prisma.cHAMADOS_DOCUMENTACOES.deleteMany).not.toHaveBeenCalled();
  expect(prisma.cHAMADOS_DOCUMENTACOES.createMany).not.toHaveBeenCalled();
  expect(prisma.hISTORICO_CHAMADOS.create).toHaveBeenCalledWith({ data: { id_chamado: 2n, id_usuario: 2n, comentario: 'Documentação #7: conteúdo atualizado.' } });
});
test('não permite alterar o ativo relacionado durante a edição', async () => {
  const r = response(); await ctrl.atualizar(req({ id_ativo: '9' }), r);
  expect(r.status).toHaveBeenCalledWith(400);
  expect(r.json).toHaveBeenCalledWith({ erro: 'O ativo relacionado não pode ser alterado durante a edição.' });
  expect(prisma.dOCUMENTACOES.update).not.toHaveBeenCalled();
});
test.each(['CONCLUIDO', 'CANCELADO'])('não edita nem exclui documento de chamado %s', async status => {
  doc.chamados_vinculados = [{ id_chamado: 1n, chamado: { id: 1n, status } }];
  const a = response(); await ctrl.atualizar(req({ titulo: 'Alterado' }), a); expect(a.status).toHaveBeenCalledWith(409);
  const d = response(); await ctrl.remover(req({}), d); expect(d.status).toHaveBeenCalledWith(409);
  expect(prisma.dOCUMENTACOES.update).not.toHaveBeenCalled(); expect(prisma.dOCUMENTACOES.delete).not.toHaveBeenCalled();
});
test('remove vínculos antes de excluir documento usado por chamados abertos', async () => {
  doc.chamados_vinculados = [{ id_chamado: 1n, chamado: { id: 1n, status: 'ABERTO' } }];
  await ctrl.remover(req({}), response());
  expect(prisma.cHAMADOS_DOCUMENTACOES.deleteMany).toHaveBeenCalledWith({ where: { id_documentacao: 7n } });
  expect(prisma.dOCUMENTACOES.delete).toHaveBeenCalledWith({ where: { id: 7n } });
});
test('não expõe dados de chamados de outro solicitante ao usuário comum', async () => {
  doc.chamados_vinculados = [{ chamado: { id: 1n, titulo: 'Meu chamado', id_solicitante: 2n, status: 'ABERTO' } }, { chamado: { id: 3n, titulo: 'Privado', id_solicitante: 4n, status: 'ABERTO' } }];
  prisma.dOCUMENTACOES.findMany.mockResolvedValue([doc]);
  const r = response(); await ctrl.listar({ usuario: { id: 2n, perfil: 'USER' } }, r);
  expect(r.json.mock.calls[0][0][0].chamados).toEqual([{ id: 1n, titulo: 'Meu chamado', status: 'ABERTO' }]);
});
