import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleSair() {
    logout();
    navigate('/');
  }

  return (
    <header className="nav-header">
      <NavLink to="/dashboard" className="nav-logo">&#9670; Gestão de TI</NavLink>
      <nav>
        <ul>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
          </li>
          {usuario?.perfil === 'ADMIN' && (
            <li>
              <NavLink to="/usuarios" className={({ isActive }) => isActive ? 'active' : ''}>
                Usuários
              </NavLink>
            </li>
          )}
          <li>
            <NavLink to="/ativos" className={({ isActive }) => isActive ? 'active' : ''}>
              Ativos
            </NavLink>
          </li>
          <li>
            <NavLink to="/chamados" className={({ isActive }) => isActive ? 'active' : ''}>
              Chamados
            </NavLink>
          </li>
          <li>
            <NavLink to="/documentacao" className={({ isActive }) => isActive ? 'active' : ''}>
              Documentação
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="nav-sair">
        <a onClick={handleSair} style={{ cursor: 'pointer' }}>Sair</a>
      </div>
    </header>
  );
}
