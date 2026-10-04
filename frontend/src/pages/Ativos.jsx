import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
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

export default function Ativos() {
  const { usuario } = useAuth();
  const podeEditar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [ativos, setAtivos] = useState([]);
  const [locais, setLocais] = useState([]);
  const [carregandoLocais, setCarregandoLocais] = useState(false);
  const [erroLocais, setErroLocais] = useState('');
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [form, setForm] = useState(formVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const cadastroAtivo = location.pathname === '/ativos/cadastro';

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

  useEffect(() => { carregar(); }, []);
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
    } else {
      setMostrarForm(false);
    }
  }, [cadastroAtivo, podeEditar, navigate]);

  async function carregarLocais() {
    setCarregandoLocais(true); setErroLocais('');
    try {
      const { data } = await api.get('/locais');
      setLocais(data);
    } catch { setErroLocais('Não foi possível carregar as localizações.'); }
    finally { setCarregandoLocais(false); }
  }
  const ativoEditado = ativos.find(a => a.id === editandoId);
  const localAnterior = ativoEditado?.local;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function iniciarEdicao(a) {
    setEditandoId(a.id);
    setForm({
      nome: a.nome, patrimonio: a.patrimonio || '', tipo: tipoLegado[a.tipo] || a.tipo, id_local: a.id_local ? String(a.id_local) : '',
      data_aquisicao: a.data_aquisicao ? a.data_aquisicao.slice(0, 10) : '',
      status: a.status === 'EM_MANUTENCAO' ? 'MANUTENCAO' : a.status,
    });
    setMostrarForm(true);
    carregarLocais();
    setErro(''); setSucesso('');
  }

  function novoForm() {
    navigate('/ativos/cadastro');
  }

  function fecharForm() {
    setMostrarForm(false);
    if (cadastroAtivo) navigate('/ativos', { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); setSucesso('');
    try {
      if (editandoId) {
        await api.put(`/ativos/${editandoId}`, form);
        setSucesso('Ativo atualizado com sucesso!');
      } else {
        await api.post('/ativos', form);
        setSucesso('Ativo cadastrado com sucesso!');
      }
      setForm(formVazio);
      setEditandoId(null);
      setMostrarForm(false);
      if (cadastroAtivo) navigate('/ativos', { replace: true });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar ativo.');
    }
  }

  async function remover(id) {
    if (!window.confirm('Remover este ativo?')) return;
    try {
      await api.delete(`/ativos/${id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao remover ativo.');
    }
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box" hidden={mostrarForm}>
          <div className="page-header">
            <h2>Gestão de Ativos</h2>
            {podeEditar && (
              <button className="btn btn-primary" onClick={novoForm}>+ Cadastrar Ativo</button>
            )}
          </div>
          {carregandoLista ? <p className="list-feedback" role="status">Carregando ativos…</p> : erroLista ? (
            <div className="alert alert-erro" role="alert">{erroLista} <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar()}>Tentar novamente</button></div>
          ) : (
          <div className="table-scroll" role="region" aria-label="Tabela de ativos" tabIndex={0}><table className="cps-table">
            <thead>
              <tr><th>Equipamento</th><th>Patrimônio</th><th>Tipo</th><th>Localização</th><th>Status</th>{podeEditar && <th>Ações</th>}</tr>
            </thead>
            <tbody>
              {ativos.map(a => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td>{a.patrimonio || '—'}</td>
                  <td>{tipoLabel[a.tipo] || a.tipo}</td>
                  <td>{a.local?.nome || a.localizacao || '—'}{a.local?.status === 'INATIVO' && ' (inativo)'}</td>
                  <td><span className={`badge badge-${badgeMap[a.status]}`}>{statusLabel[a.status]}</span></td>
                  {podeEditar && (
                    <td>
                      <div className="actions-bar">
                        <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(a)}>Editar</button>
                        {usuario?.perfil === 'ADMIN' && (
                          <button className="btn btn-danger btn-sm" onClick={() => remover(a.id)}>Inativar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {ativos.length === 0 && (
                <tr><td colSpan={podeEditar ? 6 : 5} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum ativo cadastrado.</td></tr>
              )}
            </tbody>
          </table></div>
          )}
        </div>

        {mostrarForm && podeEditar && (
          <div className="card-box ativos-form">
            <h2>{editandoId ? 'Editar Ativo' : 'Cadastrar Ativo'}</h2>
            <hr className="divider" />
            {erro && <div className="alert alert-erro">{erro}</div>}
            {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="ativos-campo-1">Nome do Equipamento</label>
                <input id="ativos-campo-1" className="form-control" placeholder="Ex: Desktop Dell OptiPlex" value={form.nome} onChange={set('nome')} required />
              </div>
              <div className="form-group">
                <label htmlFor="ativos-patrimonio">Patrimônio</label>
                <input id="ativos-patrimonio" className="form-control" placeholder="Ex: 001234" value={form.patrimonio} onChange={set('patrimonio')} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ativos-campo-2">Tipo</label>
                  <select id="ativos-campo-2" className="form-control" value={form.tipo} onChange={set('tipo')} required>
                    {tiposOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="ativos-campo-3">Localização</label>
                  <select id="ativos-campo-3" className="form-control" value={form.id_local} onChange={set('id_local')} required disabled={carregandoLocais || !!erroLocais}>
                    <option value="">{carregandoLocais ? 'Carregando localizações…' : 'Selecione a localização'}</option>
                    {localAnterior && !locais.some(l => String(l.id) === String(localAnterior.id)) && <option value={String(localAnterior.id)}>{localAnterior.nome} (local atual)</option>}
                    {locais.map(local => <option key={local.id} value={String(local.id)}>{local.nome}</option>)}
                  </select>
                  {erroLocais && <p role="alert">{erroLocais} <button type="button" className="btn btn-secondary btn-sm" onClick={carregarLocais}>Tentar novamente</button></p>}
                  {!carregandoLocais && !erroLocais && locais.length === 0 && <p role="status">Nenhum local ativo cadastrado. Solicite o cadastro ao responsável.</p>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ativos-campo-4">Data de Aquisição</label>
                  <input id="ativos-campo-4" type="date" className="form-control" value={form.data_aquisicao} onChange={set('data_aquisicao')} required />
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
                <button type="submit" className="btn btn-primary" disabled={carregandoLocais || !!erroLocais}>Salvar Ativo</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
