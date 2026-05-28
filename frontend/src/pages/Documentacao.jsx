import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const formVazio = { titulo: '', descricao: '', link_externo: '', id_ativo: '', id_chamado: '' };

export default function Documentacao() {
  const { usuario } = useAuth();
  const podeEditar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [docs, setDocs] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [form, setForm] = useState(formVazio);
  const [arquivo, setArquivo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [lendoDoc, setLendoDoc] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [baixando, setBaixando] = useState(null);

  usePageTitle('Documentação');

  async function carregar() {
    const [d, a, c] = await Promise.allSettled([
      api.get('/documentacoes'),
      api.get('/ativos'),
      api.get('/chamados'),
    ]);
    if (d.status === 'fulfilled') setDocs(d.value.data);
    if (a.status === 'fulfilled') setAtivos(a.value.data);
    if (c.status === 'fulfilled') setChamados(c.value.data);
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
    setForm({
      titulo: d.titulo,
      descricao: d.descricao || '',
      link_externo: d.link_externo || '',
      id_ativo: d.id_ativo || '',
      id_chamado: d.id_chamado || '',
    });
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
      if (form.id_ativo) fd.append('id_ativo', form.id_ativo);
      if (form.id_chamado) fd.append('id_chamado', form.id_chamado);
      if (arquivo) fd.append('arquivo', arquivo);

      if (editandoId) {
        await api.put(`/documentacoes/${editandoId}`, fd);
        setSucesso('Documento atualizado!');
      } else {
        await api.post(`/documentacoes`, fd);
        setSucesso('Documento cadastrado!');
      }
      setForm(formVazio); setArquivo(null); setEditandoId(null); setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar documento.');
    }
  }

  async function baixarArquivo(doc) {
    setBaixando(doc.id);
    try {
      const resp = await api.get(`/documentacoes/${doc.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.arquivo_nome || 'arquivo');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar o arquivo.');
    } finally {
      setBaixando(null);
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
              <tr><th>Título</th><th>Ativo Vinculado</th><th>Chamado Vinculado</th><th>Responsável</th><th>Data Registro</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id}>
                  <td>{d.titulo}</td>
                  <td>{d.ativo ? d.ativo.nome : <span style={{ color: '#bbb' }}>—</span>}</td>
                  <td>{d.chamado ? `#${d.chamado.id} - ${d.chamado.titulo}` : <span style={{ color: '#bbb' }}>—</span>}</td>
                  <td>{d.responsavel?.nome}</td>
                  <td>{fmtData(d.criado_em)}</td>
                  <td>
                    <div className="actions-bar">
                      <button className="btn btn-secondary btn-sm" onClick={() => setLendoDoc(d)}>Ler</button>
                      {d.arquivo_nome && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => baixarArquivo(d)}
                          disabled={baixando === d.id}
                        >
                          {baixando === d.id ? '...' : 'Baixar'}
                        </button>
                      )}
                      {podeEditar && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(d)}>Editar</button>
                          {usuario?.perfil === 'ADMIN' && (
                            <button className="btn btn-danger btn-sm" onClick={() => remover(d.id)}>Remover</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum documento cadastrado.</td></tr>
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
            {lendoDoc.ativo && (
              <p style={{ marginBottom: 6 }}>
                🖥️ <strong>Ativo vinculado:</strong> {lendoDoc.ativo.nome}
              </p>
            )}
            {lendoDoc.chamado && (
              <p style={{ marginBottom: 6 }}>
                🎫 <strong>Chamado vinculado:</strong> #{lendoDoc.chamado.id} — {lendoDoc.chamado.titulo}
              </p>
            )}
            {lendoDoc.descricao && <p style={{ marginBottom: 10, marginTop: 10 }}>{lendoDoc.descricao}</p>}
            {lendoDoc.link_externo && (
              <p><a href={lendoDoc.link_externo} target="_blank" rel="noreferrer" style={{ color: 'var(--cps-vermelho)' }}>
                🔗 {lendoDoc.link_externo}
              </a></p>
            )}
            {lendoDoc.arquivo_nome && (
              <p style={{ marginTop: 10 }}>
                📎 {lendoDoc.arquivo_nome}{' '}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => baixarArquivo(lendoDoc)}
                  disabled={baixando === lendoDoc.id}
                >
                  {baixando === lendoDoc.id ? 'Baixando...' : 'Baixar'}
                </button>
              </p>
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
                  <label>Ativo Relacionado (Opcional)</label>
                  <select className="form-control" value={form.id_ativo} onChange={set('id_ativo')}>
                    <option value="">— Nenhum —</option>
                    {ativos.map(a => (
                      <option key={a.id} value={a.id}>{a.nome} ({a.tipo})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Chamado Relacionado (Opcional)</label>
                  <select className="form-control" value={form.id_chamado} onChange={set('id_chamado')}>
                    <option value="">— Nenhum —</option>
                    {chamados.map(c => (
                      <option key={c.id} value={c.id}>#{c.id} — {c.titulo}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Link Externo (Opcional)</label>
                  <input type="url" className="form-control" placeholder="https://..." value={form.link_externo} onChange={set('link_externo')} />
                </div>
                <div className="form-group">
                  <label>Arquivo (PDF, DOCX, JPG, PNG)</label>
                  <input type="file" className="form-control" style={{ padding: 7 }} onChange={e => setArquivo(e.target.files[0])} />
                  {editandoId && <small style={{ color: '#999' }}>Deixe em branco para manter o arquivo atual.</small>}
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
