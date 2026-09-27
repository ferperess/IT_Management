const politica = require('../config/slaPolicy');
const HORA = 3600000;
const encerrado = status => ['CONCLUIDO', 'CANCELADO'].includes(status);

function prazosIniciais(prioridade, agora = new Date()) {
  const regra = politica[prioridade] || {};
  const prazo = horas => Number.isFinite(horas) && horas > 0 ? new Date(+agora + horas * HORA) : null;
  return { prazo_atendimento_em: prazo(regra.atendimento), prazo_resolucao_em: prazo(regra.resolucao) };
}

function calcularSla(c, agora = new Date()) {
  const fim = c.status === 'CONCLUIDO' ? c.concluido_em : c.status === 'CANCELADO' ? c.cancelado_em : agora;
  const limite = fim ? +new Date(fim) : +agora;
  // Recorta e une intervalos para não contar pausas sobrepostas duas vezes.
  const intervalos = (c.pausas_sla || []).map(p => [
    Math.max(+new Date(c.criado_em), +new Date(p.iniciado_em)),
    Math.min(limite, p.encerrado_em ? +new Date(p.encerrado_em) : limite),
  ]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let pausaMs = 0, ate = -Infinity;
  for (const [a, b] of intervalos) { pausaMs += Math.max(0, b - Math.max(a, ate)); ate = Math.max(ate, b); }
  const pausado = c.status === 'AGUARDANDO_USUARIO';
  function indicador(prazo, realizado, descontarPausas) {
    if (c.status === 'CANCELADO') return { situacao: 'CANCELADO', prazo_efetivo_em: null, restante_minutos: null };
    if (!prazo) return { situacao: 'NAO_DEFINIDO', prazo_efetivo_em: null, restante_minutos: null };
    if (encerrado(c.status) && !realizado) return { situacao: 'SEM_REGISTRO', prazo_efetivo_em: null, restante_minutos: null };
    const efetivo = +new Date(prazo) + (descontarPausas ? pausaMs : 0);
    const restante = (efetivo - +(realizado ? new Date(realizado) : agora)) / 60000;
    return { prazo_efetivo_em: new Date(efetivo), restante_minutos: restante,
      situacao: realizado ? (restante >= 0 ? 'CUMPRIDO' : 'VIOLADO') : restante < 0 ? 'ATRASADO' : descontarPausas && pausado ? 'PAUSADO' : 'NO_PRAZO' };
  }
  return { calculado_em: agora, pausado, pausa_minutos: pausaMs / 60000,
    atendimento: indicador(c.prazo_atendimento_em, c.atendimento_iniciado_em, false),
    resolucao: indicador(c.prazo_resolucao_em, c.concluido_em, true),
    tempo_resolucao_horas: c.concluido_em ? Math.max(0, (+new Date(c.concluido_em) - +new Date(c.criado_em) - pausaMs) / HORA) : null };
}
const comSla = c => ({ ...c, sla: calcularSla(c) });
module.exports = { prazosIniciais, calcularSla, comSla, encerrado };
