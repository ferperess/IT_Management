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
const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

const hoje = new Date();
const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
const hoje_str = hoje.toISOString().split('T')[0];

export default function Dashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const podeVerRelatorios = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [stats, setStats] = useState({ abertos: 0, andamento: 0, concluidos: 0, totalAtivos: 0 });
  const [relatorios, setRelatorios] = useState(null);
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hoje_str);
  const [carregandoRel, setCarregandoRel] = useState(false);

  usePageTitle('Home');

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (podeVerRelatorios) carregarRelatorios();
  }, []);

  async function carregarRelatorios() {
    setCarregandoRel(true);
    try {
      const { data } = await api.get(`/relatorios?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      setRelatorios(data);
    } catch {
      setRelatorios(null);
    } finally {
      setCarregandoRel(false);
    }
  }

  return (
    <>
      <Navbar />
      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'normal' }}>
            Olá, <strong>{usuario?.nome}</strong>!
          </h1>
        </div>

        {/* Cards resumo */}
        <div className="cards-grid">
          <div className="card destaque">
            <div className="card-title">Chamados Abertos</div>
            <div className="card-value">{stats.abertos}</div>
          </div>
          <div className="card">
            <div className="card-title">Em Andamento</div>
            <div className="card-value">{stats.andamento}</div>
          </div>
          <div className="card">
            <div className="card-title">Concluídos</div>
            <div className="card-value">{stats.concluidos}</div>
          </div>
          <div className="card">
            <div className="card-title">Total de Ativos</div>
            <div className="card-value">{stats.totalAtivos}</div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="quick-actions">
          <h2>Ações Rápidas</h2>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => navigate('/chamados')}>+ Abrir Novo Chamado</button>
            <button className="btn btn-secondary" onClick={() => navigate('/ativos')}>Consultar Ativos</button>
            <button className="btn btn-secondary" onClick={() => navigate('/documentacao')}>Base de Conhecimento</button>
          </div>
        </div>

        {/* Relatórios gerenciais — apenas Admin e Técnico */}
        {podeVerRelatorios && (
          <div className="card-box" style={{ marginTop: 24 }}>
            <div className="page-header">
              <h2>Relatórios Gerenciais</h2>
            </div>

            {/* Filtro de período */}
            <div className="form-row" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="dashboard-campo-1">Data Início</label>
                <input id="dashboard-campo-1" type="date" className="form-control" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="dashboard-campo-2">Data Fim</label>
                <input id="dashboard-campo-2" type="date" className="form-control" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 'none' }}>
                <button className="btn btn-primary" onClick={carregarRelatorios} disabled={carregandoRel}>
                  {carregandoRel ? 'Carregando...' : 'Filtrar'}
                </button>
              </div>
            </div>

            {relatorios && (
              <>
                {/* Total no período */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 14, color: '#666' }}>
                    Total de chamados no período: <strong style={{ fontSize: 18, color: 'var(--cps-preto)' }}>{relatorios.totalPeriodo}</strong>
                  </p>
                </div>

                <div className="reports-grid">

                  {/* Por Categoria */}
                  <div>
                    <h4 style={{ marginBottom: 10, fontSize: 14, color: '#666', textTransform: 'uppercase' }}>Por Categoria</h4>
                    {relatorios.porCategoria.length === 0
                      ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum dado</p>
                      : relatorios.porCategoria.map(r => (
                        <div key={r.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                          <span>{categoriaLabel[r.categoria] || r.categoria}</span>
                          <strong>{r.total}</strong>
                        </div>
                      ))
                    }
                  </div>

                  {/* Por Prioridade */}
                  <div>
                    <h4 style={{ marginBottom: 10, fontSize: 14, color: '#666', textTransform: 'uppercase' }}>Por Prioridade</h4>
                    {relatorios.porPrioridade.length === 0
                      ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum dado</p>
                      : relatorios.porPrioridade.map(r => (
                        <div key={r.prioridade} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                          <span>{prioLabel[r.prioridade] || r.prioridade}</span>
                          <strong>{r.total}</strong>
                        </div>
                      ))
                    }
                  </div>

                  {/* Por Status */}
                  <div>
                    <h4 style={{ marginBottom: 10, fontSize: 14, color: '#666', textTransform: 'uppercase' }}>Por Status</h4>
                    {relatorios.porStatus.length === 0
                      ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum dado</p>
                      : relatorios.porStatus.map(r => (
                        <div key={r.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                          <span>{statusLabel[r.status] || r.status}</span>
                          <strong>{r.total}</strong>
                        </div>
                      ))
                    }
                  </div>

                  {/* Ranking de ativos */}
                  <div>
                    <h4 style={{ marginBottom: 10, fontSize: 14, color: '#666', textTransform: 'uppercase' }}>Top 5 Ativos com Mais Chamados</h4>
                    {relatorios.rankingAtivos.length === 0
                      ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum chamado vinculado a ativo</p>
                      : relatorios.rankingAtivos.map((r, i) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                          <span>{i + 1}. {r.nome} <span style={{ color: '#aaa', fontSize: 12 }}>({r.tipo})</span></span>
                          <strong>{r.total_chamados}</strong>
                        </div>
                      ))
                    }
                  </div>

                  {/* Tempo médio por técnico */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4 style={{ marginBottom: 10, fontSize: 14, color: '#666', textTransform: 'uppercase' }}>Tempo Médio de Resolução por Técnico</h4>
                    {relatorios.tempoMedioPorTecnico.length === 0
                      ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum chamado concluído com técnico atribuído no período</p>
                      : (
                        <div className="table-scroll" role="region" aria-label="Tempo médio de resolução por técnico" tabIndex={0}><table className="cps-table" style={{ marginTop: 0 }}>
                          <thead>
                            <tr>
                              <th>Técnico</th>
                              <th>Chamados Concluídos</th>
                              <th>Tempo Médio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatorios.tempoMedioPorTecnico.map(t => (
                              <tr key={t.tecnico}>
                                <td>{t.tecnico}</td>
                                <td>{t.chamados_concluidos}</td>
                                <td>{t.tempo_medio_horas < 1
                                  ? `${Math.round(t.tempo_medio_horas * 60)} min`
                                  : `${t.tempo_medio_horas} h`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      )
                    }
                  </div>

                </div>
              </>
            )}

            {!relatorios && !carregandoRel && (
              <p style={{ color: '#bbb', fontSize: 13 }}>Selecione um período e clique em Filtrar.</p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
