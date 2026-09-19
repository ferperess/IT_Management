import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const tiposOpts = ['Desktop', 'Notebook', 'Impressora', 'Servidor', 'Rede (Switch/Roteador)', 'Outro'];
const statusOpts = ['ATIVO', 'EM_MANUTENCAO', 'INATIVO'];
const statusLabel = { ATIVO: 'Ativo', EM_MANUTENCAO: 'Em Manutenção', INATIVO: 'Inativo/Baixado' };
const badgeMap = { ATIVO: 'ativo', EM_MANUTENCAO: 'manutencao', INATIVO: 'inativo' };

const formVazio = { nome: '', tipo: 'Desktop', localizacao: '', data_aquisicao: '', status: 'ATIVO' };

export default function Ativos() {
  const { usuario } = useAuth();
  const podeEditar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [ativos, setAtivos] = useState([]);
  const [form, setForm] = useState(formVazio);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  usePageTitle('Ativos');

  async function carregar() {
    const { data } = await api.get('/ativos');
    setAtivos(data);
  }

  useEffect(() => { carregar(); }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function iniciarEdicao(a) {
    setEditandoId(a.id);
    setForm({
      nome: a.nome, tipo: a.tipo, localizacao: a.localizacao || '',
      data_aquisicao: a.data_aquisicao ? a.data_aquisicao.slice(0, 10) : '',
      status: a.status,
    });
    setMostrarForm(true);
    setErro(''); setSucesso('');
  }

  function novoForm() {
    setEditandoId(null);
    setForm(formVazio);
    setMostrarForm(true);
    setErro(''); setSucesso('');
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
        <div className="card-box">
          <div className="page-header">
            <h2>Gestão de Ativos de TI</h2>
            {podeEditar && (
              <button className="btn btn-primary" onClick={novoForm}>+ Cadastrar Ativo</button>
            )}
          </div>
          <div className="table-scroll" role="region" aria-label="Tabela de ativos" tabIndex={0}><table className="cps-table">
            <thead>
              <tr><th>Equipamento</th><th>Tipo</th><th>Localização</th><th>Status</th>{podeEditar && <th>Ações</th>}</tr>
            </thead>
            <tbody>
              {ativos.map(a => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td>{a.tipo}</td>
                  <td>{a.localizacao}</td>
                  <td><span className={`badge badge-${badgeMap[a.status]}`}>{statusLabel[a.status]}</span></td>
                  {podeEditar && (
                    <td>
                      <div className="actions-bar">
                        <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(a)}>Editar</button>
                        {usuario?.perfil === 'ADMIN' && (
                          <button className="btn btn-danger btn-sm" onClick={() => remover(a.id)}>Remover</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {ativos.length === 0 && (
                <tr><td colSpan={podeEditar ? 5 : 4} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum ativo cadastrado.</td></tr>
              )}
            </tbody>
          </table></div>
        </div>

        {mostrarForm && podeEditar && (
          <div className="card-box">
            <h2>{editandoId ? 'Editar Ativo' : 'Cadastrar Ativo'}</h2>
            <hr className="divider" />
            {erro && <div className="alert alert-erro">{erro}</div>}
            {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="ativos-campo-1">Nome do Equipamento (Tag/Patrimônio)</label>
                <input id="ativos-campo-1" className="form-control" placeholder="Ex: Desktop-Lab01-PC05" value={form.nome} onChange={set('nome')} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ativos-campo-2">Tipo</label>
                  <select id="ativos-campo-2" className="form-control" value={form.tipo} onChange={set('tipo')}>
                    {tiposOpts.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="ativos-campo-3">Localização</label>
                  <input id="ativos-campo-3" className="form-control" placeholder="Ex: Laboratório 1" value={form.localizacao} onChange={set('localizacao')} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ativos-campo-4">Data de Aquisição</label>
                  <input id="ativos-campo-4" type="date" className="form-control" value={form.data_aquisicao} onChange={set('data_aquisicao')} />
                </div>
                <div className="form-group">
                  <label htmlFor="ativos-campo-5">Status</label>
                  <select id="ativos-campo-5" className="form-control" value={form.status} onChange={set('status')}>
                    {statusOpts.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Ativo</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
