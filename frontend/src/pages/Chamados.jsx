import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const prioridadeOpts = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const statusOpts = ['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'];
const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const badgeMap = { ABERTO: 'aberto', EM_ANDAMENTO: 'andamento', CONCLUIDO: 'concluido', CANCELADO: 'cancelado' };
const prioLabel = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };

export default function Chamados() {
  const { usuario } = useAuth();
  const podeGerenciar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [chamados, setChamados] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [detalhe, setDetalhe] = useState(null);
  const [novoForm, setNovoForm] = useState({ titulo: '', descricao: '', prioridade: 'MEDIA', id_ativo: '' });
  const [gestaoForm, setGestaoForm] = useState({ status: '', prioridade: '', id_tecnico: '', comentario: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function carregar() {
    const [c, a] = await Promise.all([api.get('/chamados'), api.get('/ativos')]);
    setChamados(c.data);
    setAtivos(a.data);
  }

  useEffect(() => { carregar(); }, []);

  async function abrirDetalhe(id) {
    const { data } = await api.get(`/chamados/${id}`);
    setDetalhe(data);
    setGestaoForm({ status: data.status, prioridade: data.prioridade, id_tecnico: data.id_tecnico || '', comentario: '' });
    setErro(''); setSucesso('');
  }

  const setNovo = k => e => setNovoForm(f => ({ ...f, [k]: e.target.value }));
  const setGestao = k => e => setGestaoForm(f => ({ ...f, [k]: e.target.value }));

  async function handleAbrirChamado(e) {
    e.preventDefault();
    setErro(''); setSucesso('');
    try {
      await api.post('/chamados', {
        ...novoForm,
        id_ativo: novoForm.id_ativo ? Number(novoForm.id_ativo) : null,
      });
      setSucesso('Chamado registrado com sucesso!');
      setNovoForm({ titulo: '', descricao: '', prioridade: 'MEDIA', id_ativo: '' });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao registrar chamado.');
    }
  }

  async function handleAtualizar() {
    setErro(''); setSucesso('');
    try {
      await api.put(`/chamados/${detalhe.id}`, gestaoForm);
      setSucesso('Chamado atualizado!');
      abrirDetalhe(detalhe.id);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao atualizar chamado.');
    }
  }

  function fmtData(d) {
    return d ? new Date(d).toLocaleString('pt-BR') : '-';
  }

  return (
    <>
      <Navbar />
      <main>
        {/* Formulário abrir chamado */}
        <div className="card-box">
          <h2>Abrir Novo Chamado</h2>
          <hr className="divider" />
          {sucesso && !detalhe && <div className="alert alert-sucesso">{sucesso}</div>}
          {erro && !detalhe && <div className="alert alert-erro">{erro}</div>}
          <form onSubmit={handleAbrirChamado}>
            <div className="form-group">
              <label>Título do Problema</label>
              <input className="form-control" placeholder="Ex: Impressora não liga" value={novoForm.titulo} onChange={setNovo('titulo')} required />
            </div>
            <div className="form-group">
              <label>Descrição Detalhada</label>
              <textarea className="form-control" rows={4} placeholder="Descreva o problema em detalhes..." value={novoForm.descricao} onChange={setNovo('descricao')} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prioridade</label>
                <select className="form-control" value={novoForm.prioridade} onChange={setNovo('prioridade')}>
                  {prioridadeOpts.map(p => <option key={p} value={p}>{prioLabel[p]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ativo Relacionado (Opcional)</label>
                <select className="form-control" value={novoForm.id_ativo} onChange={setNovo('id_ativo')}>
                  <option value="">-- Selecione um ativo --</option>
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.tipo})</option>)}
                </select>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button type="submit" className="btn btn-primary">Registrar Chamado</button>
            </div>
          </form>
        </div>

        {/* Lista de chamados */}
        <div className="card-box">
          <div className="page-header">
            <h2>Chamados</h2>
          </div>
          <table className="cps-table">
            <thead>
              <tr><th>#</th><th>Título</th><th>Solicitante</th><th>Prioridade</th><th>Status</th><th>Abertura</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {chamados.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.titulo}</td>
                  <td>{c.solicitante?.nome}</td>
                  <td>{prioLabel[c.prioridade]}</td>
                  <td><span className={`badge badge-${badgeMap[c.status]}`}>{statusLabel[c.status]}</span></td>
                  <td>{fmtData(c.criado_em)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrirDetalhe(c.id)}>Ver</button>
                  </td>
                </tr>
              ))}
              {chamados.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum chamado encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detalhe */}
        {detalhe && (
          <div className="card-box">
            <div className="page-header">
              <h2>Chamado #{detalhe.id} - {detalhe.titulo}</h2>
              <span className={`badge badge-${badgeMap[detalhe.status]}`} style={{ fontSize: 13, padding: '6px 14px' }}>
                {statusLabel[detalhe.status]}
              </span>
            </div>
            <p><strong>Solicitante:</strong> {detalhe.solicitante?.nome} &nbsp;|&nbsp; <strong>Abertura:</strong> {fmtData(detalhe.criado_em)}</p>
            {detalhe.ativo && <p style={{ marginTop: 5 }}><strong>Ativo:</strong> {detalhe.ativo.nome}</p>}
            <p style={{ marginTop: 5 }}><strong>Descrição:</strong> {detalhe.descricao}</p>
            <hr className="divider" />

            {podeGerenciar && (
              <div style={{ background: '#f9f9f9', padding: 15, borderRadius: 4, marginBottom: 20 }}>
                <h4>Gestão Técnica</h4>
                {sucesso && <div className="alert alert-sucesso" style={{ marginTop: 10 }}>{sucesso}</div>}
                {erro && <div className="alert alert-erro" style={{ marginTop: 10 }}>{erro}</div>}
                <div className="form-row" style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label>Alterar Status</label>
                    <select className="form-control" value={gestaoForm.status} onChange={setGestao('status')}>
                      {statusOpts.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Alterar Prioridade</label>
                    <select className="form-control" value={gestaoForm.prioridade} onChange={setGestao('prioridade')}>
                      {prioridadeOpts.map(p => <option key={p} value={p}>{prioLabel[p]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Adicionar Comentário / Registrar Solução</label>
                  <textarea className="form-control" rows={2} value={gestaoForm.comentario} onChange={setGestao('comentario')} />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleAtualizar}>Atualizar Chamado</button>
              </div>
            )}

            <h4>Histórico</h4>
            <ul className="historico-list">
              {detalhe.historico.map(h => (
                <li key={h.id}>
                  - {fmtData(h.criado_em)}: {h.comentario} <em style={{ color: '#aaa' }}>({h.usuario?.nome})</em>
                </li>
              ))}
            </ul>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 15 }} onClick={() => setDetalhe(null)}>Fechar</button>
          </div>
        )}
      </main>
    </>
  );
}
