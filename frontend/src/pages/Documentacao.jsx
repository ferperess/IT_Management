import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const formVazio = { titulo: '', descricao: '', link_externo: '', id_ativo: '' };
const filtrosDocumentacaoVazios = { titulo: '', ativo: '', inicio: '', fim: '' };
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function validarLinkExterno(valor) {
  if (typeof valor !== 'string') return '';
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export default function Documentacao() {
  const { usuario } = useAuth();
  const podeEditar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);

  const [docs, setDocs] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [ativos, setAtivos] = useState([]);
  const [filtros, setFiltros] = useState(filtrosDocumentacaoVazios);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [arquivo, setArquivo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [lendoDoc, setLendoDoc] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [baixando, setBaixando] = useState(null);
  const formTitulo = useRef(null);
  const arquivoInput = useRef(null);
  const formBotao = useRef(null);
  const formularioAbertoAnteriormente = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const cadastroDocumento = location.pathname === '/documentacao/cadastro';
  const edicaoDocumento = location.pathname === '/documentacao/edicao';

  usePageTitle('Documentação');

  async function carregar() {
    setCarregandoLista(true); setErroLista('');
    const [d, a] = await Promise.allSettled([
      api.get('/documentacoes'),
      api.get('/ativos'),
    ]);
    if (d.status === 'fulfilled') setDocs(d.value.data);
    else setErroLista('Não foi possível carregar os documentos. Tente novamente.');
    if (a.status === 'fulfilled') setAtivos(a.value.data);
    setCarregandoLista(false);
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (cadastroDocumento) {
      if (!podeEditar) {
        navigate('/documentacao', { replace: true });
        return;
      }
      setEditandoId(null);
      setForm(formVazio);
      setArquivo(null);
      if (arquivoInput.current) arquivoInput.current.value = '';
      setMostrarForm(true);
      setErro(''); setSucesso('');
    } else if (edicaoDocumento) {
      if (!podeEditar) {
        navigate('/documentacao', { replace: true });
        return;
      }
      if (carregandoLista) return;
      const documento = docs.find(d => String(d.id) === String(location.state?.documentoId));
      if (!documento) {
        navigate('/documentacao', { replace: true });
        return;
      }
      if (String(editandoId) !== String(documento.id)) prepararEdicao(documento);
    } else {
      setMostrarForm(false);
      setEditandoId(null);
    }
  }, [cadastroDocumento, edicaoDocumento, podeEditar, navigate, carregandoLista, docs, editandoId, location.state]);
  useEffect(() => {
    if (mostrarForm) formTitulo.current?.focus();
    else if (formularioAbertoAnteriormente.current) formBotao.current?.focus();
    formularioAbertoAnteriormente.current = mostrarForm;
  }, [mostrarForm]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const mudarFiltro = campo => e => setFiltros(f => ({ ...f, [campo]: e.target.value }));

  function novoForm() {
    navigate('/documentacao/cadastro');
  }

  function fecharForm() {
    setMostrarForm(false);
    setArquivo(null);
    if (arquivoInput.current) arquivoInput.current.value = '';
    setEditandoId(null);
    if (cadastroDocumento || edicaoDocumento) navigate('/documentacao', { replace: true });
  }

  function prepararEdicao(d) {
    setEditandoId(d.id);
    setForm({
      titulo: d.titulo,
      descricao: d.descricao || '',
      link_externo: d.link_externo || '',
      id_ativo: d.id_ativo || '',
    });
    setArquivo(null);
    if (arquivoInput.current) arquivoInput.current.value = '';
    setMostrarForm(true);
    setErro(''); setSucesso('');
  }

  function iniciarEdicao(d) {
    navigate('/documentacao/edicao', { state: { documentoId: String(d.id) } });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(''); setSucesso('');
    try {
      const fd = new FormData();
      fd.append('titulo', form.titulo);
      fd.append('descricao', form.descricao);
      fd.append('link_externo', form.link_externo);
      if (!editandoId) fd.append('id_ativo', form.id_ativo);
      if (arquivo) fd.append('arquivo', arquivo);

      if (editandoId) {
        await api.put(`/documentacoes/${editandoId}`, fd);
        setSucesso('Documento atualizado!');
      } else {
        await api.post(`/documentacoes`, fd);
        setSucesso('Documento cadastrado!');
      }
      setForm(formVazio); setArquivo(null); setEditandoId(null); setMostrarForm(false);
      if (arquivoInput.current) arquivoInput.current.value = '';
      if (cadastroDocumento || edicaoDocumento) navigate('/documentacao', { replace: true });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar documento.');
    } finally { setSalvando(false); }
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

  const linkExternoSeguro = lendoDoc ? validarLinkExterno(lendoDoc.link_externo) : '';
  const ativoDocumentoEditado = docs.find(doc => String(doc.id) === String(editandoId))?.ativo;
  const periodoInvalido = filtros.inicio && filtros.fim && filtros.inicio > filtros.fim;
  const docsFiltrados = docs.filter(doc => {
    const registro = new Date(doc.criado_em);
    return !periodoInvalido
      && (!filtros.titulo || normalizar(doc.titulo).includes(normalizar(filtros.titulo.trim())))
      && (!filtros.ativo || String(doc.id_ativo ?? doc.ativo?.id ?? '') === filtros.ativo)
      && (!filtros.inicio || registro >= new Date(`${filtros.inicio}T00:00:00`))
      && (!filtros.fim || registro <= new Date(`${filtros.fim}T23:59:59.999`));
  });
  const haFiltros = Object.values(filtros).some(Boolean);

  return (
    <>
      <Navbar />
      <main>
        {podeEditar && (
          <div className="card-box documentation-form-card" hidden={!mostrarForm}>
            <section id="documentacao-formulario" className="documentation-form" aria-labelledby="documentacao-formulario-titulo">
              <h2 id="documentacao-formulario-titulo">{editandoId ? 'Editar Documento' : 'Cadastrar Documentação'}</h2>
              <hr className="divider" />
              {erro && <div className="alert alert-erro">{erro}</div>}
              {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
              <form onSubmit={handleSubmit} style={{ marginTop: 15 }}>
                <div className="form-group">
                  <label htmlFor="documentacao-campo-1">Título do Documento</label>
                  <input ref={formTitulo} id="documentacao-campo-1" className="form-control" placeholder="Ex: Manual de Configuração da Rede Wi-Fi" value={form.titulo} onChange={set('titulo')} required />
                </div>
                <div className="form-group">
                  <label htmlFor="documentacao-campo-2">Descrição</label>
                  <textarea id="documentacao-campo-2" className="form-control" placeholder="Ex: Documento técnico de referência com instruções e parâmetros da rede" rows={3} value={form.descricao} onChange={set('descricao')} required />
                </div>
                {editandoId ? (
                  <div className="form-group">
                    <label>Ativo Relacionado</label>
                    <p className="form-control" aria-readonly="true">{ativoDocumentoEditado?.nome || '— Nenhum —'}</p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="documentacao-campo-3">Ativo Relacionado (Opcional)</label>
                    <select id="documentacao-campo-3" className="form-control" value={form.id_ativo} onChange={set('id_ativo')}>
                      <option value="">— Nenhum —</option>
                      {ativos.map(a => (
                        <option key={a.id} value={a.id}>{a.nome} ({a.tipo})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="documentacao-campo-5">Link Externo (Opcional)</label>
                    <input id="documentacao-campo-5" type="url" className="form-control" placeholder="https://..." value={form.link_externo} onChange={set('link_externo')} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="documentacao-campo-6">Arquivo (PDF, DOC, DOCX, JPG ou PNG)</label>
                    <input ref={arquivoInput} id="documentacao-campo-6" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="form-control" style={{ padding: 7 }} onChange={e => setArquivo(e.target.files[0] || null)} required={!editandoId} />
                    {editandoId && <small style={{ color: '#999' }}>Deixe em branco para manter o arquivo atual.</small>}
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={fecharForm}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar Documento'}</button>
                </div>
              </form>
            </section>
          </div>
        )}
        <div className="card-box" hidden={mostrarForm}>
          <div className="page-header">
            <h2>Base de Conhecimento / Documentação</h2>
            <div className="document-list-actions">
              {podeEditar && (
                <button ref={formBotao} className="btn btn-primary" aria-expanded={mostrarForm} aria-controls="documentacao-formulario" onClick={() => mostrarForm ? fecharForm() : novoForm()}>
                  {mostrarForm ? 'Recolher formulário' : '+ Novo Documento'}
                </button>
              )}
              <button type="button" className="btn btn-primary" aria-expanded={filtrosAbertos} aria-controls="documentacao-filtros" onClick={() => setFiltrosAbertos(aberto => !aberto)}>
                Filtro{haFiltros ? ` (${Object.values(filtros).filter(Boolean).length})` : ''}
              </button>
            </div>
          </div>
          <div id="documentacao-filtros" className="documentation-filter-panel" hidden={!filtrosAbertos}>
            <div className="form-row documentation-filters">
              <div className="form-group">
                <label htmlFor="documentacao-filtro-titulo">Buscar por título</label>
                <input id="documentacao-filtro-titulo" type="search" className="form-control" placeholder="Título do documento" value={filtros.titulo} onChange={mudarFiltro('titulo')} />
              </div>
              <div className="form-group">
                <label htmlFor="documentacao-filtro-ativo">Ativo</label>
                <select id="documentacao-filtro-ativo" className="form-control" value={filtros.ativo} onChange={mudarFiltro('ativo')}>
                  <option value="">Todos</option>
                  {ativos.map(a => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="documentacao-filtro-inicio">Registro a partir de</label>
                <input id="documentacao-filtro-inicio" type="date" lang="pt-BR" className="form-control" value={filtros.inicio} max={filtros.fim || undefined} onChange={mudarFiltro('inicio')} />
              </div>
              <div className="form-group">
                <label htmlFor="documentacao-filtro-fim">Registro até</label>
                <input id="documentacao-filtro-fim" type="date" lang="pt-BR" className="form-control" value={filtros.fim} min={filtros.inicio || undefined} onChange={mudarFiltro('fim')} />
              </div>
            </div>
            {periodoInvalido && <div className="alert alert-erro" role="alert">A data final deve ser igual ou posterior à inicial.</div>}
          </div>
          {carregandoLista ? <p className="list-feedback" role="status">Carregando documentos…</p> : erroLista ? (
            <div className="alert alert-erro" role="alert">{erroLista} <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar()}>Tentar novamente</button></div>
          ) : (
          <>
          <div className="document-results">
            <p role="status">{docsFiltrados.length} de {docs.length} documentos</p>
            {haFiltros && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFiltros(filtrosDocumentacaoVazios)}>Limpar filtros</button>}
          </div>
          <div className="table-scroll" role="region" aria-label="Tabela de documentos" tabIndex={0}><table className="cps-table">
            <thead>
              <tr><th>Título</th><th>Ativo Vinculado</th><th>Responsável</th><th>Data Registro</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {docsFiltrados.map(d => (
                <tr key={d.id}>
                  <td>{d.titulo}</td>
                  <td>{d.ativo ? d.ativo.nome : <span style={{ color: '#bbb' }}>—</span>}</td>
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
                      {podeEditar && (d.bloqueado ? (
                        <>
                          <button className="btn btn-secondary btn-sm" disabled aria-describedby={`doc-bloqueado-${d.id}`}>Editar</button>
                          {usuario?.perfil === 'ADMIN' && (
                            <button className="btn btn-danger btn-sm" disabled aria-describedby={`doc-bloqueado-${d.id}`}>Remover</button>
                          )}
                          <small id={`doc-bloqueado-${d.id}`} className="doc-blocked-note">Histórico protegido: usado por chamado concluído ou cancelado.</small>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicao(d)}>Editar</button>
                          {usuario?.perfil === 'ADMIN' && (
                            <button className="btn btn-danger btn-sm" onClick={() => remover(d.id)}>Remover</button>
                          )}
                        </>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {docs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum documento cadastrado.</td></tr>
              ) : docsFiltrados.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhum documento corresponde aos filtros.</td></tr>
              )}
            </tbody>
          </table></div>
          </>
          )}
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
                <strong>Ativo vinculado:</strong> {lendoDoc.ativo.nome}
              </p>
            )}
            {!!lendoDoc.chamados?.length && <div><strong>Chamados que usam este documento:</strong><ul className="document-linked-tickets">{lendoDoc.chamados.map(c => <li key={c.id}>#{c.id} — {c.titulo}</li>)}</ul></div>}
            {lendoDoc.descricao && <p style={{ marginBottom: 10, marginTop: 10 }}>{lendoDoc.descricao}</p>}
            {linkExternoSeguro && (
              <p><a href={linkExternoSeguro} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cps-vermelho)' }}>
                🔗 {lendoDoc.link_externo}
              </a></p>
            )}
            {lendoDoc.arquivo_nome && (
              <button
                type="button"
                className="btn btn-secondary document-download-button"
                style={{ marginTop: 10 }}
                onClick={() => baixarArquivo(lendoDoc)}
                disabled={baixando === lendoDoc.id}
              >
                {baixando === lendoDoc.id ? 'Baixando…' : `Baixar ${lendoDoc.arquivo_nome}`}
              </button>
            )}
          </div>
        )}

      </main>
    </>
  );
}
