jest.mock('../prisma', () => ({
  $transaction: jest.fn(), $executeRaw: jest.fn(),
  cHAMADOS: { findUnique: jest.fn(), update: jest.fn() },
  pAUSAS_SLA_CHAMADOS: { create: jest.fn(), updateMany: jest.fn() },
  hISTORICO_CHAMADOS: { create: jest.fn() },
  dOCUMENTACOES: { count: jest.fn() },
  cHAMADOS_DOCUMENTACOES: { deleteMany: jest.fn(), createMany: jest.fn() },
}));
jest.mock('../services/apiService', () => ({ classificarChamado: jest.fn() }));
const prisma = require('../prisma');
const { atualizar, responderConfirmacao } = require('../controllers/chamadosController');
const { validarTransicaoStatus } = require('../validators');
let row;
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
async function update(body, perfil = 'TECNICO') {
  const response = res();
  await atualizar({ params: { id: '1' }, body, usuario: { id: 2n, perfil } }, response);
  return response;
}
beforeEach(() => {
  jest.clearAllMocks();
  row = { id: 1n, status: 'ABERTO', criado_em: new Date(), atendimento_iniciado_em: null, documentos_vinculados: [], pausas_sla: [] };
  prisma.$transaction.mockImplementation(cb => cb(prisma));
  prisma.cHAMADOS.findUnique.mockImplementation(async () => ({ ...row }));
  prisma.cHAMADOS.update.mockImplementation(async ({ data }) => { Object.assign(row, data); return row; });
  prisma.pAUSAS_SLA_CHAMADOS.updateMany.mockResolvedValue({ count: 1 });
});
test('registra primeiro atendimento e não substitui na retomada', async () => {
  await update({ status: 'EM_ANDAMENTO' });
  const inicio = row.atendimento_iniciado_em;
  expect(inicio).toBeInstanceOf(Date);
  await update({ status: 'AGUARDANDO_USUARIO', motivo_espera: 'Aguardando acesso ao laboratório' });
  expect(prisma.pAUSAS_SLA_CHAMADOS.create).toHaveBeenCalledTimes(1);
  await update({ status: 'EM_ANDAMENTO' });
  expect(row.atendimento_iniciado_em).toBe(inicio);
  expect(prisma.pAUSAS_SLA_CHAMADOS.updateMany).toHaveBeenCalledTimes(1);
});
test('motivo de espera é obrigatório', async () => {
  row.status = 'EM_ANDAMENTO';
  const r = await update({ status: 'AGUARDANDO_USUARIO', motivo_espera: ' ' });
  expect(r.status).toHaveBeenCalledWith(400); expect(prisma.cHAMADOS.update).not.toHaveBeenCalled();
});
test('cancelamento fecha espera na mesma transação', async () => {
  row.status = 'AGUARDANDO_USUARIO';
  await update({ status: 'CANCELADO' });
  expect(row.cancelado_em).toBeInstanceOf(Date);
  expect(prisma.pAUSAS_SLA_CHAMADOS.updateMany).toHaveBeenCalledTimes(1);
});
test('conclusão registra data e comentário da solução', async () => {
  row.status = 'EM_ANDAMENTO';
  await update({ status: 'CONCLUIDO', comentario: 'Rede restabelecida' });
  expect(row.concluido_em).toBeInstanceOf(Date);
  expect(prisma.hISTORICO_CHAMADOS.create.mock.calls[0][0].data.comentario).toContain('Rede restabelecida');
});
test.each(['CONCLUIDO', 'CANCELADO'])('bloqueia toda edição após %s', async status => {
  row.status = status;
  const r = await update({ comentario: 'Alteração', ids_documentacoes: [] });
  expect(r.status).toHaveBeenCalledWith(409); expect(prisma.cHAMADOS.update).not.toHaveBeenCalled(); expect(prisma.cHAMADOS_DOCUMENTACOES.deleteMany).not.toHaveBeenCalled();
});
test('prioridade preserva prazos existentes', async () => {
  const prazo = new Date('2026-09-25T12:00:00Z'); row.prazo_resolucao_em = prazo;
  await update({ prioridade: 'CRITICA' }); expect(row.prazo_resolucao_em).toBe(prazo);
});
test('atualiza vários vínculos e permite limpar todos', async () => {
  prisma.dOCUMENTACOES.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
  await update({ ids_documentacoes: ['10', '11', '10'] });
  expect(prisma.cHAMADOS_DOCUMENTACOES.createMany.mock.calls[0][0].data).toHaveLength(2);
  row.documentos_vinculados = [{ id_documentacao: 10n }];
  await update({ ids_documentacoes: [] });
  expect(prisma.cHAMADOS_DOCUMENTACOES.deleteMany).toHaveBeenCalledTimes(2);
});
test('usuário comum não altera SLA ou vínculos', async () => {
  const r = await update({ status: 'EM_ANDAMENTO' }, 'COMUM'); expect(r.status).toHaveBeenCalledWith(403); expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('transições exigem atendimento antes da espera e retomada antes de concluir', () => {
  expect(validarTransicaoStatus('ABERTO', 'AGUARDANDO_USUARIO')).toBe(false);
  expect(validarTransicaoStatus('AGUARDANDO_USUARIO', 'CONCLUIDO')).toBe(false);
  expect(validarTransicaoStatus('AGUARDANDO_USUARIO', 'EM_ANDAMENTO')).toBe(true);
});

describe('confirmação do solicitante', () => {
  async function responder(confirmar, id = 3n, perfil = 'COMUM') {
    const response = res();
    await responderConfirmacao({ params: { id: '1' }, body: { confirmar }, usuario: { id, perfil } }, response);
    return response;
  }
  beforeEach(() => {
    Object.assign(row, { status: 'EM_ANDAMENTO', exige_confirmacao: true, confirmacao_pendente: false, id_solicitante: 3n });
  });
  test('conclusão técnica solicita confirmação, inicia pausa e não encerra', async () => {
    await update({ status: 'CONCLUIDO', comentario: 'Solução aplicada' });
    expect(row.status).toBe('AGUARDANDO_USUARIO');
    expect(row.confirmacao_pendente).toBe(true);
    expect(row.concluido_em).toBeUndefined();
    expect(prisma.pAUSAS_SLA_CHAMADOS.create).toHaveBeenCalledTimes(1);
    const r = await update({ status: 'CONCLUIDO' });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(row.status).toBe('AGUARDANDO_USUARIO');
  });
  test.each(['COMUM', 'TECNICO', 'ADMIN'])('outro usuário %s não confirma', async perfil => {
    await update({ status: 'CONCLUIDO' });
    const r = await responder(true, 9n, perfil);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(row.status).toBe('AGUARDANDO_USUARIO');
  });
  test('solicitante confirma e encerra pausa, repetição é recusada', async () => {
    await update({ status: 'CONCLUIDO' });
    await responder(true);
    expect(row.status).toBe('CONCLUIDO');
    expect(row.confirmacao_pendente).toBe(false);
    expect(row.concluido_em).toBeInstanceOf(Date);
    expect(prisma.pAUSAS_SLA_CHAMADOS.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.hISTORICO_CHAMADOS.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ id_usuario: 3n, status_novo: 'CONCLUIDO' }) });
    const r = await responder(true);
    expect(r.status).toHaveBeenCalledWith(409);
  });
  test('rejeição retoma atendimento e exige nova confirmação na próxima conclusão', async () => {
    await update({ status: 'CONCLUIDO' });
    await responder(false);
    expect(row.status).toBe('EM_ANDAMENTO');
    expect(row.confirmacao_pendente).toBe(false);
    expect(row.concluido_em).toBeNull();
    await update({ status: 'CONCLUIDO' });
    expect(row.confirmacao_pendente).toBe(true);
    expect(row.status).toBe('AGUARDANDO_USUARIO');
  });
  test('espera comum não pode ser usada para confirmar encerramento', async () => {
    await update({ status: 'AGUARDANDO_USUARIO', motivo_espera: 'Acesso ao equipamento' });
    const r = await responder(true);
    expect(r.status).toHaveBeenCalledWith(409);
  });
  test('retomada técnica invalida confirmação pendente', async () => {
    await update({ status: 'CONCLUIDO' });
    await update({ status: 'EM_ANDAMENTO' });
    expect(row.confirmacao_pendente).toBe(false);
    const r = await responder(true);
    expect(r.status).toHaveBeenCalledWith(409);
  });
  test('sem checkbox conclui diretamente, sem pausa', async () => {
    row.exige_confirmacao = false;
    await update({ status: 'CONCLUIDO' });
    expect(row.status).toBe('CONCLUIDO');
    expect(row.concluido_em).toBeInstanceOf(Date);
    expect(prisma.pAUSAS_SLA_CHAMADOS.create).not.toHaveBeenCalled();
  });
  test('rejeita resposta que não seja booleana', async () => {
    const r = await responder('false');
    expect(r.status).toHaveBeenCalledWith(400);
    expect(prisma.cHAMADOS.update).not.toHaveBeenCalled();
  });
});
