import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const navigate = useNavigate();

  usePageTitle('Usuários');

  async function carregar(q = '') {
    try {
      const { data } = await api.get(`/usuarios${q ? `?busca=${encodeURIComponent(q)}` : ''}`);
      setUsuarios(data);
    } catch {}
  }

  useEffect(() => { carregar(); }, []);

  async function inativar(id) {
    if (!window.confirm('Deseja inativar este usuário?')) return;
    await api.patch(`/usuarios/${id}/inativar`);
    carregar(busca);
  }

  const perfilLabel = { ADMIN: 'Administrador', TECNICO: 'Técnico de TI', COMUM: 'Comum' };

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box">
          <div className="page-header">
            <h2>Gestão de Usuários</h2>
            <button className="btn btn-primary" onClick={() => navigate('/usuarios/novo')}>
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
          <table className="cps-table">
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
                    <span className={`badge badge-${u.status === 'ATIVO' ? 'ativo' : 'inativo'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-bar">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/usuarios/${u.id}`)}>
                        Editar
                      </button>
                      {u.status === 'ATIVO' && (
                        <button className="btn btn-danger btn-sm" onClick={() => inativar(u.id)}>
                          Inativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}