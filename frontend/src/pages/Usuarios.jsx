import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ConfirmarInativacao from '../components/ConfirmarInativacao';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [busca, setBusca] = useState('');
  const [usuarioInativar, setUsuarioInativar] = useState(null);
  const cadastroBotao = useRef(null);
  const navigate = useNavigate();
  const consultaAtual = useRef(0);

  usePageTitle('Usuários');

  async function carregar(q = '') {
    const consulta = ++consultaAtual.current;
    setCarregandoLista(true); setErroLista('');
    try {
      const { data } = await api.get(`/usuarios${q ? `?busca=${encodeURIComponent(q)}` : ''}`);
      if (consulta === consultaAtual.current) setUsuarios(data);
    } catch {
      if (consulta === consultaAtual.current) setErroLista('Não foi possível carregar os usuários. Tente novamente.');
    } finally {
      if (consulta === consultaAtual.current) setCarregandoLista(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function inativar() {
    await api.patch(`/usuarios/${usuarioInativar.id}/inativar`);
    setUsuarios(lista => lista.map(u => u.id === usuarioInativar.id ? { ...u, status: 'INATIVO' } : u));
    setUsuarioInativar(null);
  }

  const perfilLabel = { ADMIN: 'Admin', DIRECTOR: 'Director', USER: 'User' };

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box">
          <div className="page-header">
            <h2>Gestão de Usuários</h2>
            <button ref={cadastroBotao} className="btn btn-primary" onClick={() => navigate('/usuarios/cadastro')}>
              + Cadastrar Usuário
            </button>
          </div>
          <div className="form-row" style={{ marginBottom: 15 }}>
            <input
              className="form-control"
              placeholder="Buscar usuário por nome ou e-mail..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && carregar(busca)}
            />
            <button className="btn btn-secondary" onClick={() => carregar(busca)}>Pesquisar</button>
          </div>
          {carregandoLista ? <p className="list-feedback" role="status">Carregando usuários…</p> : erroLista ? (
            <div className="alert alert-erro" role="alert">{erroLista} <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar(busca)}>Tentar novamente</button></div>
          ) : (
          <div className="table-scroll" role="region" aria-label="Tabela de usuários" tabIndex={0}><table className="cps-table">
            <thead>
              <tr>
                <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{perfilLabel[u.perfil] || u.perfil}</td>
                  <td>
                    <span className={`badge badge-user-status badge-${u.status === 'ATIVO' ? 'ativo' : 'inativo'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-bar">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/usuarios/edicao', { state: { usuarioId: String(u.id) } })}>
                        Editar
                      </button>
                      {u.status === 'ATIVO' && (
                        <button className="btn btn-danger btn-sm" onClick={() => setUsuarioInativar(u)}>
                          Inativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
          )}
        </div>
      </main>
      {usuarioInativar && <ConfirmarInativacao titulo="Inativar Usuário" pergunta="Confirma que deseja inativar o usuário abaixo?" identificacao={`${usuarioInativar.nome} - ${perfilLabel[usuarioInativar.perfil] || usuarioInativar.perfil}`} onConfirmar={inativar} onCancelar={() => setUsuarioInativar(null)} focoRetorno={cadastroBotao} />}
    </>
  );
}
