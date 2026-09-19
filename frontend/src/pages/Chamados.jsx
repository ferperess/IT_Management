import { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const prioLabel = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const categorias = { HARDWARE: 'Hardware', SOFTWARE: 'Software', REDE: 'Rede', ACESSO: 'Acesso', IMPRESSORA: 'Impressora', AUDIOVISUAL: 'Audiovisual', OUTRO: 'Outro' };
// Espelha validators.js; a API continua responsável por validar a transição.
const transicoes = { ABERTO: ['EM_ANDAMENTO', 'CANCELADO'], EM_ANDAMENTO: ['CONCLUIDO', 'CANCELADO'], CONCLUIDO: [], CANCELADO: [] };
const novoVazio = { titulo: '', descricao: '', id_ativo: '' };
const filtrosVazios = { busca: '', status: '', prioridade: '', categoria: '', ativo: '', inicio: '', fim: '' };
const normalizar = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtData = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
function Badge({ valor, prioridade = false }) {
  return <span className={`ch-badge ch-${valor}`}>{(prioridade ? prioLabel : statusLabel)[valor] || valor}</span>;
}
function Campo({ id, label, children }) {
  return <div className="form-group"><label htmlFor={id}>{label}</label>{children}</div>;
}
function Opcoes({ items }) {
  return Object.entries(items).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

export default function Chamados() {
  const { usuario } = useAuth();
  const podeGerenciar = ['ADMIN', 'TECNICO'].includes(usuario?.perfil);
  const [vista, setVista] = useState(() => podeGerenciar ? 'kanban' : 'lista');
  const [chamados, setChamados] = useState([]);
  const [statusMobile, setStatusMobile] = useState('ABERTO');
  const [ativos, setAtivos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [avisoAuxiliar, setAvisoAuxiliar] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [avisoClassificacao, setAvisoClassificacao] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [novo, setNovo] = useState(novoVazio);
  const [criando, setCriando] = useState(false);
  const [erroNovo, setErroNovo] = useState('');
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [detalhe, setDetalhe] = useState(null);
  const [gestao, setGestao] = useState({});
  const [buscandoDetalhe, setBuscandoDetalhe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState('');
  const [sucessoDetalhe, setSucessoDetalhe] = useState('');
  const dialog = useRef(null);
  const tituloInput = useRef(null);
  const novoBotao = useRef(null);
  const requisicaoDetalhe = useRef(0);
  const travaCriacao = useRef(false);
  const travaSalvar = useRef(false);
  usePageTitle('Chamados');

  async function carregarLista() {
    setCarregando(true); setErroLista('');
    try { const { data } = await api.get('/chamados'); setChamados(data); }
    catch (err) { setErroLista(err.response?.data?.erro || 'Não foi possível carregar os chamados. Tente novamente.'); }
    finally { setCarregando(false); }
  }
  useEffect(() => {
    carregarLista();
    let ativo = true;
    async function carregarAuxiliares() {
      const resultados = await Promise.allSettled([
        api.get('/ativos'),
        usuario?.perfil === 'ADMIN' ? api.get('/usuarios') : Promise.resolve({ data: [] }),
      ]);
      if (!ativo) return;
      if (resultados[0].status === 'fulfilled') setAtivos(resultados[0].value.data);
      if (resultados[1].status === 'fulfilled') setTecnicos(resultados[1].value.data.filter(u => ['ADMIN', 'TECNICO'].includes(u.perfil) && u.status === 'ATIVO'));
      const avisos = [];
      if (resultados[0].status === 'rejected') avisos.push('A lista de ativos está indisponível. Você ainda pode abrir um chamado sem vínculo.');
      if (resultados[1].status === 'rejected') avisos.push('A lista de responsáveis está indisponível. A atribuição atual será preservada.');
      setAvisoAuxiliar(avisos.join(' '));
    }
    carregarAuxiliares();
    return () => { ativo = false; };
  }, [usuario?.perfil]);
  useEffect(() => { if (formAberto) tituloInput.current?.focus(); }, [formAberto]);
  useEffect(() => {
    if (!dialog.current?.open) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [buscandoDetalhe, detalhe]);

  function fecharDetalhe() {
    if (travaSalvar.current) return;
    requisicaoDetalhe.current += 1;
    dialog.current?.close(); setDetalhe(null); setBuscandoDetalhe(false);
  }
  function preencherGestao(data) {
    setGestao({ status: data.status, prioridade: data.prioridade, categoria: data.categoria || 'OUTRO', id_tecnico: data.id_tecnico || '', comentario: '' });
  }
  async function abrirDetalhe(id) {
    const versao = ++requisicaoDetalhe.current;
    setDetalhe(null); setErroDetalhe(''); setSucessoDetalhe(''); setBuscandoDetalhe(true);
    dialog.current.showModal();
    try {
      const { data } = await api.get(`/chamados/${id}`);
      if (versao !== requisicaoDetalhe.current) return;
      setDetalhe(data); preencherGestao(data);
    } catch (err) {
      if (versao === requisicaoDetalhe.current) setErroDetalhe(err.response?.data?.erro || 'Não foi possível abrir o chamado. Feche este painel e tente novamente.');
    } finally { if (versao === requisicaoDetalhe.current) setBuscandoDetalhe(false); }
  }
  async function criar(e) {
    e.preventDefault();
    if (travaCriacao.current) return;
    if (novo.titulo.trim().length < 5 || novo.descricao.trim().length < 10) {
      setErroNovo('Informe um título com pelo menos 5 caracteres e uma descrição com pelo menos 10 caracteres.'); return;
    }
    travaCriacao.current = true; setCriando(true); setErroNovo(''); setMensagem(''); setAvisoClassificacao('');
    try {
      const { data } = await api.post('/chamados', { titulo: novo.titulo.trim(), descricao: novo.descricao.trim(), id_ativo: novo.id_ativo ? String(novo.id_ativo) : null });
      setChamados(lista => [data, ...lista.filter(c => c.id !== data.id)]);
      setNovo(novoVazio); setFormAberto(false);
      setAvisoClassificacao(data.aviso ? `Chamado #${data.id}: ${data.aviso}` : '');
      setMensagem(`Chamado #${data.id} registrado com sucesso`);
      novoBotao.current?.focus();
    } catch (err) { setErroNovo(err.response?.data?.erro || 'Não foi possível registrar o chamado. Seus dados foram preservados.'); }
    finally { travaCriacao.current = false; setCriando(false); }
  }
  async function atualizar(e) {
    e.preventDefault();
    if (travaSalvar.current || !detalhe) return;
    if (detalhe.status === 'CANCELADO') {
      setErroDetalhe('Chamados cancelados são somente leitura e não podem ser alterados.');
      return;
    }
    travaSalvar.current = true; setSalvando(true); setErroDetalhe(''); setSucessoDetalhe('');
    const payload = {};
    for (const campo of ['status', 'prioridade', 'categoria']) if (gestao[campo] !== detalhe[campo]) payload[campo] = gestao[campo];
    if (String(gestao.id_tecnico || '') !== String(detalhe.id_tecnico || '')) payload.id_tecnico = gestao.id_tecnico ? String(gestao.id_tecnico) : null;
    if (gestao.comentario.trim()) payload.comentario = gestao.comentario.trim();
    try {
      if (!Object.keys(payload).length) { setSucessoDetalhe('Nenhuma alteração para salvar.'); return; }
      const { data } = await api.put(`/chamados/${detalhe.id}`, payload);
      setChamados(lista => lista.map(c => c.id === data.id ? data : c));
      setDetalhe(data); preencherGestao(data); setSucessoDetalhe('Chamado atualizado com sucesso.');
      // O PUT retorna antes da inclusão do histórico; buscar novamente após salvar.
      try {
        const atualizado = await api.get(`/chamados/${data.id}`);
        setDetalhe(atualizado.data); preencherGestao(atualizado.data);
        setChamados(lista => lista.map(c => c.id === data.id ? atualizado.data : c));
      } catch { setErroDetalhe('Alterações salvas, mas não foi possível atualizar o histórico. Reabra o chamado para tentar novamente.'); }
    } catch (err) { setErroDetalhe(err.response?.data?.erro || 'Não foi possível salvar. Suas alterações foram preservadas.'); }
    finally { travaSalvar.current = false; setSalvando(false); }
  }
  const mudarFiltro = key => e => setFiltros(f => ({ ...f, [key]: e.target.value }));
  const mudarNovo = key => e => setNovo(f => ({ ...f, [key]: e.target.value }));
  const mudarGestao = key => e => setGestao(f => ({ ...f, [key]: e.target.value }));
  const periodoInvalido = filtros.inicio && filtros.fim && filtros.inicio > filtros.fim;
  const filtrados = chamados.filter(c => {
    const data = new Date(c.criado_em);
    return !periodoInvalido && (!filtros.busca || normalizar([c.id, c.titulo, c.solicitante?.nome, c.tecnico?.nome, c.ativo?.nome].join(' ')).includes(normalizar(filtros.busca.trim())))
      && (!filtros.status || c.status === filtros.status) && (!filtros.prioridade || c.prioridade === filtros.prioridade)
      && (!filtros.categoria || c.categoria === filtros.categoria) && (!filtros.ativo || String(c.id_ativo) === filtros.ativo)
      && (!filtros.inicio || data >= new Date(`${filtros.inicio}T00:00:00`)) && (!filtros.fim || data <= new Date(`${filtros.fim}T23:59:59.999`));
  });

  return <><Navbar /><main className="chamados-page">
    <div className="ch-heading"><div><p className="ch-eyebrow">CENTRAL DE ATENDIMENTO</p><h1>Chamados</h1><p className="ch-muted">{podeGerenciar ? 'Organize os atendimentos e acompanhe cada etapa.' : 'Abra uma solicitação e acompanhe seus atendimentos.'}</p></div>
      <button ref={novoBotao} className="btn btn-primary" aria-expanded={formAberto} aria-controls="ch-novo" disabled={criando} onClick={() => setFormAberto(v => !v)}>{formAberto ? 'Recolher formulário' : '+ Novo chamado'}</button></div>
    {mensagem && <div className="alert alert-sucesso" role="status">{mensagem}</div>}
    {avisoClassificacao && <div className="ch-notice" role="alert">{avisoClassificacao}</div>}
    {avisoAuxiliar && <p className="ch-notice" role="status">{avisoAuxiliar}</p>}
    <section id="ch-novo" className="card-box ch-create" hidden={!formAberto} aria-labelledby="ch-novo-titulo">
      <h2 id="ch-novo-titulo">Novo chamado</h2><p className="ch-muted">Conte o que aconteceu. Categoria e prioridade serão definidas automaticamente e podem ser revisadas pela equipe técnica.</p>
      {erroNovo && <div role="alert" className="alert alert-erro">{erroNovo}</div>}
      <form onSubmit={criar}><fieldset disabled={criando}>
        <Campo id="ch-titulo" label="Título do problema"><input ref={tituloInput} id="ch-titulo" className="form-control" value={novo.titulo} onChange={mudarNovo('titulo')} required minLength={5} placeholder="Ex.: Projetor do laboratório não liga" /></Campo>
        <Campo id="ch-descricao" label="Descrição detalhada"><textarea id="ch-descricao" className="form-control" rows={4} value={novo.descricao} onChange={mudarNovo('descricao')} required minLength={10} placeholder="Descreva o problema, o local e como ele afeta sua atividade." /></Campo>
        <Campo id="ch-ativo" label="Ativo relacionado (opcional)"><select id="ch-ativo" className="form-control" value={novo.id_ativo} onChange={mudarNovo('id_ativo')}><option value="">Sem ativo vinculado</option>{ativos.map(a => <option key={a.id} value={a.id} disabled={['MANUTENCAO', 'EM_MANUTENCAO'].includes(a.status)}>{a.nome} ({a.tipo}){['MANUTENCAO', 'EM_MANUTENCAO'].includes(a.status) ? ' — em manutenção' : ''}</option>)}</select></Campo>
        <div className="ch-actions"><button type="button" className="btn btn-secondary" onClick={() => { setFormAberto(false); novoBotao.current?.focus(); }}>Recolher e manter rascunho</button><button className="btn btn-primary" type="submit">{criando ? 'Registrando e classificando…' : 'Registrar chamado'}</button></div>
      </fieldset></form>
    </section>
    <section className="card-box ch-workspace" aria-label="Acompanhamento de chamados">
      <div className="ch-toolbar"><div className="ch-switch" role="group" aria-label="Visualização">{['kanban', 'lista'].map(v => <button key={v} className="btn btn-secondary" aria-pressed={vista === v} onClick={() => setVista(v)}>{v === 'kanban' ? 'Kanban' : 'Lista'}</button>)}</div><button className="btn btn-secondary" onClick={carregarLista} disabled={carregando}>{carregando ? 'Carregando…' : 'Atualizar lista'}</button></div>
      <div className="ch-filters">
        <Campo id="ch-busca" label="Buscar chamado"><input id="ch-busca" type="search" className="form-control" placeholder="Número, título ou pessoa" value={filtros.busca} onChange={mudarFiltro('busca')} /></Campo>
        <Campo id="ch-status" label="Status"><select id="ch-status" className="form-control" value={filtros.status} onChange={mudarFiltro('status')}><option value="">Todos</option><Opcoes items={statusLabel} /></select></Campo>
        <Campo id="ch-prioridade" label="Prioridade"><select id="ch-prioridade" className="form-control" value={filtros.prioridade} onChange={mudarFiltro('prioridade')}><option value="">Todas</option><Opcoes items={prioLabel} /></select></Campo>
        <Campo id="ch-categoria" label="Categoria"><select id="ch-categoria" className="form-control" value={filtros.categoria} onChange={mudarFiltro('categoria')}><option value="">Todas</option><Opcoes items={categorias} /></select></Campo>
      </div>
      <details className="ch-more"><summary>Mais filtros: ativo e período</summary><div className="ch-filters ch-extra">
        <Campo id="ch-filtro-ativo" label="Ativo"><select id="ch-filtro-ativo" className="form-control" value={filtros.ativo} onChange={mudarFiltro('ativo')}><option value="">Todos</option>{ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Campo>
        <Campo id="ch-inicio" label="Abertura a partir de"><input id="ch-inicio" type="date" className="form-control" value={filtros.inicio} onChange={mudarFiltro('inicio')} /></Campo>
        <Campo id="ch-fim" label="Abertura até"><input id="ch-fim" type="date" className="form-control" value={filtros.fim} min={filtros.inicio || undefined} onChange={mudarFiltro('fim')} /></Campo>
      </div></details>
      {periodoInvalido && <p role="alert" className="alert alert-erro">A data final deve ser igual ou posterior à inicial.</p>}
      <div className="ch-results"><p role="status">{filtrados.length} de {chamados.length} chamados</p>{Object.values(filtros).some(Boolean) && <button className="ch-link" onClick={() => setFiltros(filtrosVazios)}>Limpar filtros</button>}</div>
      {erroLista ? <div className="alert alert-erro" role="alert">{erroLista} <button className="ch-link" onClick={carregarLista}>Tentar novamente</button></div> : carregando ? <p className="ch-empty" role="status">Carregando chamados…</p> : !filtrados.length ? <div className="ch-empty"><h2>{chamados.length ? 'Nenhum resultado para estes filtros' : 'Nenhum chamado por aqui'}</h2><p>{chamados.length ? 'Ajuste a busca ou limpe os filtros para continuar.' : 'Use “Novo chamado” para registrar a primeira solicitação.'}</p></div> : vista === 'kanban' ?
        <><div className="ch-mobile-status" role="group" aria-label="Etapas do Kanban">
          {Object.entries(statusLabel).filter(([s]) => !filtros.status || s === filtros.status).map(([s, label]) => (
            <button key={s} type="button" aria-pressed={(filtros.status || statusMobile) === s} aria-controls={`ch-coluna-${s}`} onClick={() => setStatusMobile(s)}>
              <span>{label}</span><span className="ch-status-count">{filtrados.filter(c => c.status === s).length}</span>
            </button>
          ))}
        </div><div className="ch-board">{Object.entries(statusLabel).filter(([s]) => !filtros.status || s === filtros.status).map(([s, label]) => {
          const cards = filtrados.filter(c => c.status === s);
          return <section className={`ch-column ch-column-${s}`} key={s} id={`ch-coluna-${s}`} data-mobile-active={(filtros.status || statusMobile) === s} aria-label={label}><div className="ch-column-heading"><h2>{label}</h2><span>{cards.length}</span></div><div className="ch-cards">{cards.length ? cards.map(c => <article key={c.id} className="ch-ticket"><div className="ch-ticket-top"><span>#{c.id}</span><Badge valor={c.prioridade} prioridade /></div><h3><button className="ch-title-link" onClick={() => abrirDetalhe(c.id)}>{c.titulo}</button></h3><p className="ch-muted">{categorias[c.categoria] || 'Outro'}</p><dl><dt>Solicitante</dt><dd>{c.solicitante?.nome || '—'}</dd><dt>Responsável</dt><dd>{c.tecnico?.nome || 'Não atribuído'}</dd>{c.ativo && <><dt>Ativo</dt><dd>{c.ativo.nome}</dd></>}</dl><div className="ch-ticket-footer"><time dateTime={c.criado_em}>{fmtData(c.criado_em)}</time><button className="ch-link" aria-label={`Ver chamado ${c.id}`} onClick={() => abrirDetalhe(c.id)}>Ver detalhes</button></div></article>) : <p className="ch-column-empty">Nenhum chamado nesta etapa.</p>}</div></section>;
        })}</div></> : <div className="ch-table-wrap" role="region" aria-label="Lista de chamados" tabIndex={0}><table className="cps-table"><thead><tr>{['Chamado', 'Solicitante / responsável', 'Prioridade', 'Status', 'Abertura'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{filtrados.map(c => <tr key={c.id}><td><button className="ch-title-link" onClick={() => abrirDetalhe(c.id)}>#{c.id} · {c.titulo}</button><span className="ch-cell-sub">{categorias[c.categoria] || 'Outro'}{c.ativo ? ` · ${c.ativo.nome}` : ''}</span></td><td>{c.solicitante?.nome || '—'}<span className="ch-cell-sub">{c.tecnico?.nome || 'Não atribuído'}</span></td><td><Badge valor={c.prioridade} prioridade /></td><td><Badge valor={c.status} /></td><td><time dateTime={c.criado_em}>{fmtData(c.criado_em)}</time></td></tr>)}</tbody></table></div>}
    </section>
    <dialog ref={dialog} className="ch-drawer" aria-labelledby="ch-detalhe-titulo" onCancel={e => { e.preventDefault(); fecharDetalhe(); }}>
      <div className="ch-drawer-head"><h2 id="ch-detalhe-titulo">{detalhe ? `Chamado #${detalhe.id}` : 'Detalhes do chamado'}</h2><button className="btn btn-secondary" autoFocus disabled={salvando} onClick={fecharDetalhe}>Fechar</button></div>
      {buscandoDetalhe && <p role="status">Carregando detalhes…</p>}
      {erroDetalhe && <div className="alert alert-erro" role="alert">{erroDetalhe}</div>}
      {sucessoDetalhe && <div className="alert alert-sucesso" role="status">{sucessoDetalhe}</div>}
      {detalhe && <><h3 className="ch-detail-title">{detalhe.titulo}</h3><div className="ch-detail-badges"><Badge valor={detalhe.status} /><Badge valor={detalhe.prioridade} prioridade /></div><dl className="ch-detail-meta"><dt>Solicitante</dt><dd>{detalhe.solicitante?.nome || '—'}</dd><dt>Abertura</dt><dd>{fmtData(detalhe.criado_em)}</dd><dt>Categoria</dt><dd>{categorias[detalhe.categoria] || 'Outro'}</dd><dt>Responsável</dt><dd>{detalhe.tecnico?.nome || 'Não atribuído'}</dd><dt>Ativo</dt><dd>{detalhe.ativo?.nome || 'Sem vínculo'}</dd></dl><h3>Descrição</h3><p className="ch-description">{detalhe.descricao}</p>
        {detalhe.status === 'CANCELADO' && <p className="ch-notice" role="status">Este chamado foi cancelado e está disponível somente para consulta</p>}
        {podeGerenciar && detalhe.status !== 'CANCELADO' && <form className="ch-management" onSubmit={atualizar}><h3>Gestão técnica</h3><fieldset disabled={salvando}><div className="ch-form-grid">
          <Campo id="ch-editar-status" label="Status"><select id="ch-editar-status" className="form-control" value={gestao.status} onChange={mudarGestao('status')}>{[detalhe.status, ...(transicoes[detalhe.status] || [])].map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}</select></Campo>
          <Campo id="ch-editar-prioridade" label="Prioridade"><select id="ch-editar-prioridade" className="form-control" value={gestao.prioridade} onChange={mudarGestao('prioridade')}><Opcoes items={prioLabel} /></select></Campo>
          <Campo id="ch-editar-categoria" label="Categoria"><select id="ch-editar-categoria" className="form-control" value={gestao.categoria} onChange={mudarGestao('categoria')}><Opcoes items={categorias} /></select></Campo>
          <Campo id="ch-tecnico" label="Responsável"><select id="ch-tecnico" className="form-control" value={gestao.id_tecnico} onChange={mudarGestao('id_tecnico')}><option value="">Não atribuído</option>{detalhe.id_tecnico && !tecnicos.some(t => t.id === detalhe.id_tecnico) && detalhe.id_tecnico !== usuario.id && <option value={detalhe.id_tecnico}>{detalhe.tecnico?.nome || 'Responsável atual'}</option>}{!tecnicos.some(t => t.id === usuario.id) && <option value={usuario.id}>{usuario.nome} (eu)</option>}{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Campo>
        </div><Campo id="ch-comentario" label="Adicionar comentário ou registrar solução"><textarea id="ch-comentario" className="form-control" rows={3} value={gestao.comentario} onChange={mudarGestao('comentario')} /></Campo><button type="submit" className="btn btn-primary">{salvando ? 'Salvando…' : 'Salvar alterações'}</button></fieldset></form>}
        <h3>Histórico de atendimento</h3>{detalhe.historico?.length ? <ol className="ch-history">{detalhe.historico.map(h => <li key={h.id}><p>{h.comentario}</p><span>{h.usuario?.nome || 'Sistema'} · {fmtData(h.criado_em)}</span></li>)}</ol> : <p className="ch-muted">Nenhuma ação registrada.</p>}
      </>}
    </dialog>
  </main></>;
}
