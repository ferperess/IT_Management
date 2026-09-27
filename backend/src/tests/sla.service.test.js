jest.mock('../config/slaPolicy', () => ({ ALTA: { atendimento: null, resolucao: null } }));
const { calcularSla, prazosIniciais } = require('../services/slaService');
const politica = require('../config/slaPolicy');
const date = h => new Date(`2026-09-20T${String(h).padStart(2, '0')}:00:00Z`);
const base = () => ({ status: 'EM_ANDAMENTO', criado_em: date(8), prazo_atendimento_em: date(9), atendimento_iniciado_em: date(9), prazo_resolucao_em: date(12), pausas_sla: [] });

test('sem configuração não inventa prazo', () => {
  expect(prazosIniciais('ALTA', date(8))).toEqual({ prazo_atendimento_em: null, prazo_resolucao_em: null });
});
test('política calcula horas corridas a partir da abertura', () => {
  const anterior = politica.ALTA;
  try { politica.ALTA = { atendimento: 1, resolucao: 4 };
    expect(prazosIniciais('ALTA', date(8))).toEqual({ prazo_atendimento_em: date(9), prazo_resolucao_em: date(12) });
  } finally { politica.ALTA = anterior; }
});
test('limite exato conta como cumprido', () => {
  const r = calcularSla({ ...base(), status: 'CONCLUIDO', concluido_em: date(12) }, date(16));
  expect(r.atendimento.situacao).toBe('CUMPRIDO'); expect(r.resolucao.situacao).toBe('CUMPRIDO');
});
test('pendência atrasada e conclusão fora do prazo', () => {
  expect(calcularSla(base(), date(13)).resolucao.situacao).toBe('ATRASADO');
  expect(calcularSla({ ...base(), status: 'CONCLUIDO', concluido_em: date(13) }, date(15)).resolucao.situacao).toBe('VIOLADO');
});
test('pausas se somam somente uma vez e não alteram atendimento', () => {
  const r = calcularSla({ ...base(), pausas_sla: [{ iniciado_em: date(9), encerrado_em: date(10) }, { iniciado_em: date(11), encerrado_em: date(12) }] }, date(13));
  expect(r.pausa_minutos).toBe(120); expect(r.resolucao.prazo_efetivo_em).toEqual(date(14)); expect(r.atendimento.prazo_efetivo_em).toEqual(date(9));
});
test('espera em aberto congela saldo e preserva atraso anterior', () => {
  const c = { ...base(), status: 'AGUARDANDO_USUARIO', pausas_sla: [{ iniciado_em: date(10), encerrado_em: null }] };
  expect(calcularSla(c, date(13)).resolucao.restante_minutos).toBe(120);
  expect(calcularSla(c, date(15)).resolucao.restante_minutos).toBe(120);
  expect(calcularSla(c, date(15)).resolucao.situacao).toBe('PAUSADO');
  c.pausas_sla[0].iniciado_em = date(13);
  expect(calcularSla(c, date(15)).resolucao.situacao).toBe('ATRASADO');
});
test('cancelados são excluídos, legados não recebem data inventada', () => {
  expect(calcularSla({ ...base(), status: 'CANCELADO', cancelado_em: date(13) }).resolucao.situacao).toBe('CANCELADO');
  expect(calcularSla({ ...base(), status: 'CONCLUIDO', concluido_em: null }).resolucao.situacao).toBe('SEM_REGISTRO');
  expect(calcularSla({ ...base(), prazo_resolucao_em: null }).resolucao.situacao).toBe('NAO_DEFINIDO');
});
test('intervalos sobrepostos não duplicam desconto e conclusão congela resultado', () => {
  const c = { ...base(), status: 'CONCLUIDO', concluido_em: date(14), pausas_sla: [{ iniciado_em: date(9), encerrado_em: date(11) }, { iniciado_em: date(10), encerrado_em: date(12) }] };
  expect(calcularSla(c, date(20)).pausa_minutos).toBe(180);
  expect(calcularSla(c, date(20)).tempo_resolucao_horas).toBe(3);
});
