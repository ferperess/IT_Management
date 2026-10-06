import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const categoriaLabel = {
  HARDWARE: 'Hardware', SOFTWARE: 'Software', REDE: 'Rede',
  ACESSO: 'Acesso', IMPRESSORA: 'Impressora', AUDIOVISUAL: 'Audiovisual', OUTRO: 'Outro',
};
const prioLabel = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_USUARIO: 'Aguardando usuário', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

const hoje = new Date();
const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
const hoje_str = hoje.toISOString().split('T')[0];
const formatarHoras = horas => horas == null ? '—' : `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export default function Dashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const podeVerRelatorios = ['ADMIN', 'DIRECTOR'].includes(usuario?.perfil);
  const abrirFormularioChamado = () => navigate('/chamados', { state: { abrirNovoChamado: true } });

  const [stats, setStats] = useState({ abertos: 0, andamento: 0, totalAtivos: 0, aguardando: 0, tempoMedioAtendimentoHoras: null, tempoMedioResolucaoHoras: null });
  const [relatorios, setRelatorios] = useState(null);
  const [modoPeriodo, setModoPeriodo] = useState(null);
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hoje_str);
  const [carregandoRel, setCarregandoRel] = useState(false);
  const [erroRelatorio, setErroRelatorio] = useState('');

  usePageTitle('Home');

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  async function carregarRelatorios(modo = modoPeriodo) {
    setCarregandoRel(true);
    setErroRelatorio('');
    try {
      const filtroPeriodo = modo === 'especifico' ? `?dataInicio=${dataInicio}&dataFim=${dataFim}` : '';
      const { data } = await api.get(`/relatorios${filtroPeriodo}`);
      setRelatorios(data);
    } catch {
      setRelatorios(null);
      setErroRelatorio('Não foi possível gerar o relatório. Tente novamente.');
    } finally {
      setCarregandoRel(false);
    }
  }

  function alterarModoPeriodo(modo) {
    if (modo === modoPeriodo && modo !== 'geral') return;
    setModoPeriodo(modo);
    setRelatorios(null);
    setErroRelatorio('');
    if (modo === 'geral') carregarRelatorios('geral');
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="dashboard-greeting">
          <h1>
            Olá, <strong>{usuario?.nome}</strong>!
          </h1>
        </div>

        {/* Cards resumo */}
        <div className="cards-grid dashboard-ticket-cards">
          <div className="card destaque">
            <div className="card-title">Chamados Abertos</div>
            <div className="card-value">{stats.abertos}</div>
          </div>
          <div className="card">
            <div className="card-title">Em Andamento</div>
            <div className="card-value">{stats.andamento ?? 0}</div>
          </div>
          <div className="card">
            <div className="card-title">Aguardando usuário</div>
            <div className="card-value">{stats.aguardando ?? 0}</div>
          </div>
        </div>
        {podeVerRelatorios && (
          <div className="cards-grid dashboard-sla-cards">
            <div className="card">
              <div className="card-title">Tempo médio até primeiro atendimento (SLA)</div>
              <div className="card-value">{formatarHoras(stats.tempoMedioAtendimentoHoras)}</div>
            </div>
            <div className="card">
              <div className="card-title">Tempo médio de resolução (SLA)</div>
              <div className="card-value">{formatarHoras(stats.tempoMedioResolucaoHoras)}</div>
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        {podeVerRelatorios && (
        <div className="quick-actions">
          <h2>Ações Rápidas</h2>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={abrirFormularioChamado}>+ Abrir Novo Chamado</button>
            <button className="btn btn-secondary" onClick={() => navigate('/ativos')}>Consultar Ativos</button>
            <button className="btn btn-secondary" onClick={() => navigate('/documentacao')}>Base de Conhecimento</button>
          </div>
        </div>
        )}
        {!podeVerRelatorios && (
          <button className="btn btn-primary dashboard-new-ticket" onClick={abrirFormularioChamado}>+ Abrir Novo Chamado</button>
        )}

        {/* Relatórios gerenciais — perfis Admin e Director */}
        {podeVerRelatorios && (
          <div className="card-box reports-panel">
            <div className="page-header">
              <h2>Relatórios Gerenciais</h2>
            </div>

            {/* Filtro de período */}
            <div className="form-row report-filters" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
              <div className="form-group report-period-group">
                <span className="report-period-label">Período do relatório</span>
                <div className="report-period-mode" role="group" aria-label="Período do relatório">
                  <button type="button" className={`btn ${modoPeriodo === 'geral' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={modoPeriodo === 'geral'} disabled={carregandoRel} onClick={() => alterarModoPeriodo('geral')}>Todo o período</button>
                  <button type="button" className={`btn ${modoPeriodo === 'especifico' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={modoPeriodo === 'especifico'} disabled={carregandoRel} onClick={() => alterarModoPeriodo('especifico')}>Período específico</button>
                </div>
              </div>
              {modoPeriodo === 'especifico' && <>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="dashboard-campo-1">Data Início</label>
                  <input id="dashboard-campo-1" type="date" className="form-control" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="dashboard-campo-2">Data Fim</label>
                  <input id="dashboard-campo-2" type="date" className="form-control" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </>}
              {modoPeriodo === 'especifico' && <div className="form-group" style={{ flex: 'none' }}>
                <button className="btn btn-primary" onClick={() => carregarRelatorios('especifico')} disabled={carregandoRel}>
                  {carregandoRel ? 'Carregando...' : 'Filtrar'}
                </button>
              </div>}
            </div>

            {relatorios && (
              <>
                <div className="report-total">
                  <span>Chamados no período</span>
                  <strong>{relatorios.totalPeriodo}</strong>
                </div>

                <div className="report-breakdowns">
                  <section className="report-section">
                    <h3>Por categoria</h3>
                    {relatorios.porCategoria.length === 0
                      ? <p className="report-empty">Nenhum chamado no período.</p>
                      : <table className="cps-table report-table"><thead><tr><th scope="col">Categoria</th><th scope="col">Chamados</th></tr></thead><tbody>
                        {relatorios.porCategoria.map(r => <tr key={r.categoria}><td>{categoriaLabel[r.categoria] || r.categoria}</td><td>{r.total}</td></tr>)}
                      </tbody></table>}
                  </section>
                  <section className="report-section">
                    <h3>Por prioridade</h3>
                    {relatorios.porPrioridade.length === 0
                      ? <p className="report-empty">Nenhum chamado no período.</p>
                      : <table className="cps-table report-table"><thead><tr><th scope="col">Prioridade</th><th scope="col">Chamados</th></tr></thead><tbody>
                        {relatorios.porPrioridade.map(r => <tr key={r.prioridade}><td>{prioLabel[r.prioridade] || r.prioridade}</td><td>{r.total}</td></tr>)}
                      </tbody></table>}
                  </section>
                  <section className="report-section">
                    <h3>Por status</h3>
                    {relatorios.porStatus.length === 0
                      ? <p className="report-empty">Nenhum chamado no período.</p>
                      : <table className="cps-table report-table"><thead><tr><th scope="col">Status</th><th scope="col">Chamados</th></tr></thead><tbody>
                        {relatorios.porStatus.map(r => <tr key={r.status}><td>{statusLabel[r.status] || r.status}</td><td>{r.total}</td></tr>)}
                      </tbody></table>}
                  </section>
                </div>

                {relatorios.sla && <section className="report-section report-sla">
                  <h3>SLA de resolução no período</h3>
                  <dl className="report-sla-grid">{Object.entries({ cumpridos: 'Concluídos no prazo', violados: 'Concluídos fora do prazo', atrasados: 'Pendentes atrasados', no_prazo: 'Pendentes no prazo', pausados: 'Pausados no prazo', sem_prazo: 'SLA não definido', sem_registro: 'Sem data de conclusão', cancelados: 'Cancelados (fora do indicador)' }).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{relatorios.sla[k] ?? 0}</dd></div>)}</dl>
                </section>}

                <div className="reports-lower">
                  <section className="report-section">
                    <h3>Top 5 ativos com mais chamados</h3>
                    {relatorios.rankingAtivos.length === 0
                      ? <p className="report-empty">Nenhum chamado vinculado a ativo.</p>
                      : <table className="cps-table report-table"><thead><tr><th scope="col">#</th><th scope="col">Ativo</th><th scope="col">Chamados</th></tr></thead><tbody>
                        {relatorios.rankingAtivos.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td>{r.nome} <span className="report-meta">({r.tipo})</span></td><td>{r.total_chamados}</td></tr>)}
                      </tbody></table>}
                  </section>
                  <section className="report-section">
                    <h3>Tempo médio de resolução por técnico</h3>
                    <p className="report-note">Horas corridas entre abertura e conclusão, incluindo esperas. Chamados sem data de conclusão não entram na média.</p>
                    {relatorios.tempoMedioPorTecnico.length === 0
                      ? <p className="report-empty">Nenhum chamado concluído com técnico atribuído no período.</p>
                      : <div className="table-scroll" role="region" aria-label="Tempo médio de resolução por técnico" tabIndex={0}><table className="cps-table report-table"><thead><tr><th scope="col">Técnico</th><th scope="col">Concluídos</th><th scope="col">Tempo médio</th></tr></thead><tbody>
                        {relatorios.tempoMedioPorTecnico.map(t => <tr key={t.tecnico}><td>{t.tecnico}</td><td>{t.chamados_concluidos}</td><td>{t.tempo_medio_horas < 1 ? `${Math.round(t.tempo_medio_horas * 60)} min` : `${t.tempo_medio_horas} h`}</td></tr>)}
                      </tbody></table></div>}
                  </section>
                </div>
              </>
            )}

            {carregandoRel && <p className="report-empty" role="status">Gerando relatório...</p>}
            {!relatorios && !carregandoRel && modoPeriodo === null && <p className="report-empty">Escolha um período para visualizar o relatório.</p>}
            {!relatorios && !carregandoRel && modoPeriodo === 'especifico' && !erroRelatorio && <p className="report-empty">Ajuste as datas e clique em Filtrar.</p>}
            {erroRelatorio && <p className="report-empty" role="alert">{erroRelatorio}</p>}
          </div>
        )}
      </main>
    </>
  );
}