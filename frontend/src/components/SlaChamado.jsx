import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
const nomes = { NAO_DEFINIDO: 'SLA não definido', SEM_REGISTRO: 'Sem data registrada', CANCELADO: 'Cancelado — fora do SLA', CUMPRIDO: 'Cumprido', VIOLADO: 'Concluído fora do prazo', NO_PRAZO: 'No prazo', ATRASADO: 'Atrasado', PAUSADO: 'Pausado: aguardando usuário' };
const data = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
function tempo(minutos) {
  const total = Math.ceil(Math.abs(minutos));
  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const restante = total % 60;
  if (dias) return [ `${dias}d`, horas && `${horas}h`, restante && `${restante}min` ].filter(Boolean).join(' ');
  return `${horas}h ${restante}min`;
}
export default function SlaChamado({ chamado, compacto = false }) {
  const { usuario } = useAuth();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const sla = chamado.sla;
  if (usuario?.perfil === 'USER') return null;
  function item(tipo, titulo) {
    const valor = sla?.[tipo];
    let situacao = valor?.situacao || 'NAO_DEFINIDO';
    const emCurso = ['NO_PRAZO', 'ATRASADO'].includes(situacao) && !(tipo === 'resolucao' && sla?.pausado);
    const minutos = emCurso && valor?.prazo_efetivo_em ? (new Date(valor.prazo_efetivo_em).getTime() - agora) / 60000 : valor?.restante_minutos;
    if (emCurso && minutos < 0) situacao = 'ATRASADO';
    const quebraSituacao = !compacto && ['NAO_DEFINIDO', 'SEM_REGISTRO', 'CANCELADO'].includes(situacao);
    const resolucaoPausada = !compacto && tipo === 'resolucao' && situacao === 'PAUSADO';
    return <div className={`sla-item sla-${situacao}`}><strong>{titulo}:{quebraSituacao ? <br /> : ' '}{resolucaoPausada ? <>Pausado<br />Aguardando usuário</> : nomes[situacao]}</strong>
      {!compacto && <>{valor?.prazo_efetivo_em && <p>{tipo === 'resolucao' && sla.pausado ? 'Prazo calculado ao consultar' : 'Prazo'}: {data(valor.prazo_efetivo_em)}</p>}
      {minutos != null && ['NO_PRAZO', 'ATRASADO', 'PAUSADO'].includes(situacao) && <p>{minutos < 0 ? 'Atraso' : 'Tempo restante'}: {tempo(minutos)}{tipo === 'resolucao' && sla.pausado ? ' (contagem pausada)' : ''}</p>}</>}
    </div>;
  }
  if (compacto) return <div className="sla-compact">{item('resolucao', 'Resolução')}</div>;
  return <section className="sla-panel" aria-label="Prazos de atendimento"><h3>Acompanhamento de SLA</h3>
    <p>Contagem em horas corridas. A partir de 24h, as durações são exibidas em dias, horas e minutos. A espera pelo usuário pausa apenas a resolução.</p><br></br>
    <div className="sla-grid">{item('atendimento', 'Atendimento')}{item('resolucao', 'Resolução')}</div>
    {(chamado.atendimento_iniciado_em || chamado.concluido_em) && <p>
      {chamado.atendimento_iniciado_em && <>Primeiro atendimento: {data(chamado.atendimento_iniciado_em)}{chamado.concluido_em && <br />}</>}
      {chamado.concluido_em && <>Conclusão: {data(chamado.concluido_em)}</>}
    </p>}
    {!!chamado.pausas_sla?.length && <details><summary>Períodos de espera ({chamado.pausas_sla.length})</summary><ul className="sla-wait-periods">{chamado.pausas_sla.map(p => <li key={p.id}><strong>{data(p.iniciado_em)} — {p.encerrado_em ? data(p.encerrado_em) : 'Em aberto'}</strong><p>{p.motivo}</p></li>)}</ul></details>}
  </section>;
}
