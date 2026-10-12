import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ConfirmarInativacao from '../components/ConfirmarInativacao';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const tiposOpts = [
  { value: 'COMPUTADOR', label: 'Desktop / Computador' },
  { value: 'NOTEBOOK', label: 'Notebook' },
  { value: 'IMPRESSORA', label: 'Impressora' },
  { value: 'SERVIDOR', label: 'Servidor' },
  { value: 'REDE', label: 'Rede (Switch/Roteador)' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PERIFERICO', label: 'Periférico' },
  { value: 'OUTRO', label: 'Outro' },
];
const tipoLabel = Object.fromEntries(tiposOpts.map(({ value, label }) => [value, label]));
const tipoLegado = { Desktop: 'COMPUTADOR', Notebook: 'NOTEBOOK', Impressora: 'IMPRESSORA', Servidor: 'SERVIDOR', 'Rede (Switch/Roteador)': 'REDE', Outro: 'OUTRO' };
const statusOpts = ['ATIVO', 'MANUTENCAO', 'INATIVO'];
const statusLabel = { ATIVO: 'Ativo', MANUTENCAO: 'Em Manutenção', EM_MANUTENCAO: 'Em Manutenção', INATIVO: 'Inativo/Baixado' };
const badgeMap = { ATIVO: 'ativo', MANUTENCAO: 'manutencao', EM_MANUTENCAO: 'manutencao', INATIVO: 'inativo' };

const formVazio = { nome: '', patrimonio: '', tipo: 'COMPUTADOR', id_local: '', data_aquisicao: '', status: 'ATIVO' };
const filtrosVazios = { id_local: '', tipo: '', status: '' };

export default function Ativos() {
  const { usuario } = useAuth();
  const podeEditar = usuario?.perfil === 'ADMIN';

  const [ativos, setAtivos] = useState([]);
  const [ativoInativar, setAtivoInativar] = useState(null);
  const cadastroBotao = useRef(null);
  const [locais, setLocais] = useState([]);
  const [carregandoLocais, setCarregandoLocais] = useState(false);
  const [erroLocais, setErroLocais] = useState('');
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const cadastroAtivo = location.pathname === '/ativos/cadastro';
  const edicaoAtivo = location.pathname === '/ativos/edicao';

  usePageTitle('Ativos');

  async function carregar() {
    setCarregandoLista(true); setErroLista('');
    try {
      const { data } = await api.get('/ativos');
      setAtivos(data);
    } catch {
      setErroLista('Não foi possível carregar os ativos. Tente novamente.');
    } finally { setCarregandoLista(false); }
  }

  useEffect(() => {
    carregar();
    carregarLocais();
  }, []);
  useEffect(() => {
    if (cadastroAtivo) {
      if (!podeEditar) {
        navigate('/ativos', { replace: true });
        return;
      }
      setEditandoId(null);
      setForm(formVazio);
      setMostrarForm(true);
      setErro(''); setSucesso('');
      carregarLocais();
    } else if (edicaoAtivo) {
      if (!podeEditar) {
        navigate('/ativos', { replace: true });
        return;
      }
      if (carregandoLista) return;
      const ativo = ativos.find(a => String(a.id) === String(location.state?.ativoId));
      if (!ativo) {
        navigate('/ativos', { replace: true });
        return;
      }
      if (String(editandoId) !== String(ativo.id)) prepararEdicao(ativo);
    } else {
      setMostrarForm(false);
      setEditandoId(null);
    }
  }, [cadastroAtivo, edicaoAtivo, podeEditar, navigate, carregandoLista, ativos, editandoId, location.state]);

  async function carregarLocais() {
    setCarregandoLocais(true); setErroLocais('');
    try {
      const { data } = await api.get('/locais');
      setLocais(data);
    } catch { setErroLocais('Não foi possível carregar as localizações.'); }
    finally { setCarregandoLocais(false); }
  }
  const ativosFiltrados = ativos.filter(a => {
    const status = a.status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : a.status;
    return (!filtros.id_local || String(a.id_local ?? a.local?.id ?? '') === filtros.id_local)
      && (!filtros.tipo || a.tipo === filtros.tipo)
      && (!filtros.status || status === filtros.status);
  });
  const haFiltros = Object.values(filtros).some(Boolean);
  const mudarFiltro = campo => e => setFiltros(f => ({ ...f, [campo]: e.target.value }));
  const ativoEditado = ativos.find(a => a.id === editandoId);
  const localAnterior = ativoEditado?.local;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function carregarHistorico(id) {
    setHistorico([]);
    setCarregandoHistorico(true);
    setErroHistorico('');
    api.get(`/ativos/${id}/historico`)
      .then(({ data }) => setHistorico(data))
      .catch(() => setErroHistorico('Não foi possível carregar o histórico deste ativo.'))
      .finally(() => setCarregandoHistorico(false));
  }

  function prepararEdicao(a) {
    setEditandoId(a.id);
    setForm({
      nome: a.nome, patrimonio: a.patrimonio || '', tipo: tipoLegado[a.tipo] || a.tipo, id_local: a.id_local ? String(a.id_local) : '',
      data_aquisicao: a.data_aquisicao ? a.data_aquisicao.slice(0, 10) : '',
      status: a.status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : a.status,
    });
    setMostrarForm(true);
    carregarLocais();
    setErro(''); setSucesso('');
    carregarHistorico(a.id);
  }

  function iniciarEdicao(a) {
    navigate('/ativos/edicao', { state: { ativoId: String(a.id) } });
  }

  function novoForm() {
    navigate('/ativos/cadastro');
  }

  function fecharForm() {
    setMostrarForm(false);
    setHistorico([]);
    setEditandoId(null);
    if (cadastroAtivo || edicaoAtivo) navigate('/ativos', { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); setSucesso('');
    try {
      if (editandoId) {
        const payload = {};
        const statusAtual = ativoEditado.status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : ativoEditado.status;
        if (form.status !== statusAtual) payload.status = form.status;
        if (String(form.id_local) !== String(ativoEditado.id_local || '')) payload.id_local = form.id_local;
        if (!Object.keys(payload).length) {
          setSucesso('Nenhuma alteração para salvar.');
          return;
        }
        await api.put(`/ativos/${editandoId}`, payload);
        setSucesso('Ativo atualizado com sucesso!');
      } else {
        await api.post('/ativos', form);
        setSucesso('Ativo cadastrado com sucesso!');
      }
      setForm(formVazio);
      setEditandoId(null);
      setMostrarForm(false);
      setHistorico([]);
      if (cadastroAtivo || edicaoAtivo) navigate('/ativos', { replace: true });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar ativo.');
    }
  }

  async function inativar() {
    await api.put(`/ativos/${ativoInativar.id}`, { status: 'INATIVO' });
    setAtivos(lista => lista.map(a => a.id === ativoInativar.id ? { ...a, status: 'INATIVO' } : a));
    setAtivoInativar(null);
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box" hidden={mostrarForm}>
          <div className="page-header">
            <h1>Gestão de Ativos</h1>
            <div className="document-list-actions">
              {podeEditar && (
                <button ref={cadastroBotao} className="btn btn-primary" onClick={novoForm}>+ Cadastrar Ativo</button>
              )}
              <button type="button" className="btn btn-primary" aria-expanded={filtrosAbertos} aria-controls="ativos-filtros" onClick={() => setFiltrosAbertos(aberto => !aberto)}>
                {filtrosAbertos ? 'Recolher filtro' : 'Filtro'}{haFiltros ? ` (${Object.values(filtros).filter(Boolean).length})` : ''}
              </button>
            </div>
          </div>
          <div id="ativos-filtros" className="documentation-filter-panel" hidden={!filtrosAbertos}>
            <div className="form-row documentation-filters">
              <div className="form-group">
                <label htmlFor="ativos-filtro-localizacao">Localização</label>
                <select id="ativos-filtro-localizacao" className="form-control" value={filtros.id_local} onChange={mudarFiltro('id_local')} disabled={carregandoLocais || !!erroLocais}>
                  <option value="">{carregandoLocais ? 'Carregando localizações…' : 'Todas'}</option>
                  {locais.map(local => <option key={local.id} value={String(local.id)}>{local.nome}</option>)}
                </select>
                {erroLocais && <p role="alert">{erroLocais} <button type="button" className="btn btn-secondary btn-sm" onClick={carregarLocais}>Tentar novamente</button></p>}
              </div>
              <div className="form-group">
                <label htmlFor="ativos-filtro-tipo">Tipo</label>
                <select id="ativos-filtro-tipo" className="form-control" value={filtros.tipo} onChange={mudarFiltro('tipo')}>
                  <option value="">Todos</option>
                  {tiposOpts.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ativos-filtro-status">Status</label>
                <select id="ativos-filtro-status" className="form-control" value={filtros.status} onChange={mudarFiltro('status')}>
                  <option value="">Todos</option>
                  {statusOpts.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}
                </select>
              </div>
            </div>
          </div>
          {carregandoLista ? <p className="list-feedback" role="status">Carregando ativos…</p> : erroLista ? (
            <div className="alert alert-erro" role="alert">{erroLista} <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar()}>Tentar novamente</button></div>
          ) : (
          <>
          <div className="document-results">
            <p role="status">{ativosFiltrados.length} de {ativos.length} ativos</p>
            {haFiltros && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFiltros(filtrosVazios)}>Limpar filtros</button>}
          </div>
          <div className="table-scroll" role="region" aria-label="Tabela de ativos" tabIndex={0}><table className="cps-table cps-table-stack">
            <thead>
              <tr><th>Equipamento</th><th>Patrimônio</th><th>Tipo</th><th>Localização</th><th>Status</th>{podeEditar && <th>Ações</th>}</tr>
            </thead>
            <tbody>
              {ativosFiltrados.map(a => (
                <tr key={a.id}>
                  <td data-label="Equipamento">{a.nome}</td>
                  <td data-label="Patrimônio">{a.patrimonio || '—'}</td>
                  <td data-label="Tipo">{tipoLabel[a.tipo] || a.tipo}</td>
                  <td data-label="Localização">{a.local?.nome || a.localizacao || '—'}{a.local?.status === 'INATIVO' && ' (inativo)'}</td>
                  <td data-label="Status"><span className={`badge badge-${badgeMap[a.status]}`}>{statusLabel[a.status]}</span></td>
                  {podeEditar && (
                    <td data-label="Ações">
                      <div className="actions-bar">
                        <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(a)}>Editar</button>
                        {usuario?.perfil === 'ADMIN' && (
                          <button className="btn btn-danger btn-sm" disabled={a.status === 'INATIVO'} onClick={() => setAtivoInativar(a)}>Inativar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {ativos.length === 0 ? (
                <tr><td colSpan={podeEditar ? 6 : 5} className="table-empty-state">Nenhum ativo cadastrado.</td></tr>
              ) : ativosFiltrados.length === 0 && (
                <tr><td colSpan={podeEditar ? 6 : 5} className="table-empty-state">Nenhum ativo corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table></div>
          </>
          )}
        </div>

        {mostrarForm && podeEditar && (
          <div className="card-box ativos-form">
            <h2>{editandoId ? 'Editar Ativo' : 'Cadastrar Ativo'}</h2>
            <hr className="divider" />
            {erro && <div className="alert alert-erro">{erro}</div>}
            {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
            <form onSubmit={handleSubmit}>
              {editandoId ? (
                <div className="ativos-dados-fixos" aria-label="Dados não editáveis do ativo">
                  <div><strong>Equipamento</strong><span>{ativoEditado?.nome}</span></div>
                  <div><strong>Patrimônio</strong><span>{ativoEditado?.patrimonio || '—'}</span></div>
                  <div><strong>Tipo</strong><span>{tipoLabel[ativoEditado?.tipo] || ativoEditado?.tipo}</span></div>
                  <div><strong>Data de aquisição</strong><span>{ativoEditado?.data_aquisicao ? new Date(ativoEditado.data_aquisicao).toLocaleDateString('pt-BR') : '—'}</span></div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="ativos-campo-1">Nome do Equipamento</label>
                    <input id="ativos-campo-1" className="form-control" placeholder="Ex: Desktop Dell OptiPlex" value={form.nome} onChange={set('nome')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ativos-patrimonio">Patrimônio</label>
                    <input id="ativos-patrimonio" className="form-control" placeholder="Ex: 001234" value={form.patrimonio} onChange={set('patrimonio')} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ativos-campo-2">Tipo</label>
                    <select id="ativos-campo-2" className="form-control" value={form.tipo} onChange={set('tipo')} required>
                      {tiposOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="ativos-campo-4">Data de Aquisição</label>
                    <input id="ativos-campo-4" type="date" className="form-control" value={form.data_aquisicao} onChange={set('data_aquisicao')} required />
                  </div>
                </>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ativos-campo-3">Localização</label>
                  <select id="ativos-campo-3" className="form-control" value={form.id_local} onChange={set('id_local')} required disabled={carregandoLocais || (!!erroLocais && !editandoId)}>
                    <option value="">{carregandoLocais ? 'Carregando localizações…' : 'Selecione a localização'}</option>
                    {localAnterior && !locais.some(l => String(l.id) === String(localAnterior.id)) && <option value={String(localAnterior.id)}>{localAnterior.nome} (local atual)</option>}
                    {locais.map(local => <option key={local.id} value={String(local.id)}>{local.nome}</option>)}
                  </select>
                  {erroLocais && <p role="alert">{erroLocais} <button type="button" className="btn btn-secondary btn-sm" onClick={carregarLocais}>Tentar novamente</button></p>}
                  {!carregandoLocais && !erroLocais && locais.length === 0 && <p role="status">Nenhum local ativo cadastrado. Solicite o cadastro ao responsável.</p>}
                </div>
                <div className="form-group">
                  <label htmlFor="ativos-campo-5">Status</label>
                  <select id="ativos-campo-5" className="form-control" value={form.status} onChange={set('status')} required>
                    {statusOpts.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharForm}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={carregandoLocais || (!!erroLocais && !editandoId)}>Salvar Ativo</button>
              </div>
            </form>
            {editandoId && (
              <section className="ativos-historico" aria-labelledby="ativos-historico-titulo">
                <h3 id="ativos-historico-titulo">Histórico do ativo</h3>
                {carregandoHistorico ? <p role="status">Carregando histórico…</p> : erroHistorico ? (
                  <p role="alert">{erroHistorico} <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregarHistorico(editandoId)}>Tentar novamente</button></p>
                ) : historico.length ? (
                  <div className="ch-history" role="list">
                    {historico.map(evento => <div key={evento.id} role="listitem"><p>{evento.comentario}</p><span>{evento.usuario?.nome || 'Sistema'} · {new Date(evento.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>)}
                  </div>
                ) : <p className="ch-muted">Não há histórico para este ativo.</p>}
              </section>
            )}
          </div>
        )}
      </main>
      {ativoInativar && <ConfirmarInativacao titulo="Inativar Ativo" pergunta="Confirma que deseja inativar o ativo abaixo?" identificacao={`${ativoInativar.nome} - ${ativoInativar.patrimonio || 'Sem patrimônio'}`} onConfirmar={inativar} onCancelar={() => setAtivoInativar(null)} focoRetorno={cadastroBotao} />}
    </>
  );
}
