import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const formVazio = { titulo: '', descricao: '', link_externo: '' };

export default function Documentacao() {
  const { usuario } = useAuth();
  const podeEditar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState(formVazio);
  const [arquivo, setArquivo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [lendoDoc, setLendoDoc] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  usePageTitle('Documentação');

  async function carregar() {
    const { data } = await api.get('/documentacoes');
    setDocs(data);
  }

  useEffect(() => { carregar(); }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function novoForm() {
    setEditandoId(null);
    setForm(formVazio);
    setArquivo(null);
    setMostrarForm(true);
    setErro(''); setSucesso('');
  }

  function iniciarEdicao(d) {
    setEditandoId(d.id);
    setForm({ titulo: d.titulo, descricao: d.descricao || '', link_externo: d.link_externo || '' });
    setArquivo(null);
    setMostrarForm(true);
    setErro(''); setSucesso('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); setSucesso('');
    try {
      const fd = new FormData();
      fd.append('titulo', form.titulo);
      fd.append('descricao', form.descricao);
      fd.append('link_externo', form.link_externo);
      if (arquivo) fd.append('arquivo', arquivo);

      if (editandoId) {
        await api.put(`/documentacoes/${editandoId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSucesso('Documento atualizado!');
      } else {
        await api.post('/documentacoes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSucesso('Documento cadastrado!');
      }
      setForm(formVazio); setArquivo(null); setEditandoId(null); setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar documento.');
    }
  }

  async function remover(id) {
    if (!window.confirm('Remover este documento?')) return;
    try {
      await api.delete(`/documentacoes/${id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao remover.');
    }
  }

  function fmtData(d) {
    return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box">
          <div className="page-header">
            <h2>Base de Conhecimento / Documentação</h2>
            {podeEditar && (
              <button className="btn btn-primary" onClick={novoForm}>+ Novo Documento</button>
            )}
          </div>
          <table className="cps-table">
            <thead>
              <tr><th>Título</th><th>Responsável</th><th>Data Registro</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id}>
                  <td>{d.titulo}</td>
                  <td>{d.responsavel?.nome}</td>
                  <td>{fmtData(d.criado_em)}</td>
                  <td className="actions-bar">
                    <button className="btn btn-secondary btn-sm" onClick={() => setLendoDoc(d)}>Ler</button>
                    {podeEditar && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(d)}>Editar</button>
                        {usuario?.perfil === 'ADMIN' && (
                          <button className="btn btn-danger btn-sm" onClick={() => remover(d.id)}>Remover</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum documento cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leitura */}
        {lendoDoc && (
          <div className="card-box">
            <div className="page-header">
              <h2>{lendoDoc.titulo}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setLendoDoc(null)}>Fechar</button>
            </div>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>
              Por: {lendoDoc.responsavel?.nome} | {new Date(lendoDoc.criado_em).toLocaleDateString('pt-BR')}
            </p>
            {lendoDoc.descricao && <p style={{ marginBottom: 10 }}>{lendoDoc.descricao}</p>}
            {lendoDoc.link_externo && (
              <p><a href={lendoDoc.link_externo} target="_blank" rel="noreferrer" style={{ color: 'var(--cps-vermelho)' }}>
                🔗 {lendoDoc.link_externo}
              </a></p>
            )}
            {lendoDoc.arquivo_nome && (
              <p style={{ marginTop: 10 }}>📎 Arquivo: {lendoDoc.arquivo_nome}</p>
            )}
          </div>
        )}

        {/* Formulário */}
        {mostrarForm && podeEditar && (
          <div className="card-box">
            <h2>{editandoId ? 'Editar Documento' : 'Cadastrar Documentação'}</h2>
            <hr className="divider" />
            {erro && <div className="alert alert-erro">{erro}</div>}
            {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
            <form onSubmit={handleSubmit} style={{ marginTop: 15 }}>
              <div className="form-group">
                <label>Título do Documento</label>
                <input className="form-control" placeholder="Título descritivo" value={form.titulo} onChange={set('titulo')} required />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea className="form-control" rows={3} value={form.descricao} onChange={set('descricao')} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Link Externo (Opcional)</label>
                  <input type="url" className="form-control" placeholder="https://..." value={form.link_externo} onChange={set('link_externo')} />
                </div>
                <div className="form-group">
                  <label>Arquivo (PDF, DOCX)</label>
                  <input type="file" className="form-control" style={{ padding: 7 }} onChange={e => setArquivo(e.target.files[0])} />
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Documento</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
