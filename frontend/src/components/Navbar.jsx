import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuBotao = useRef(null);

  useEffect(() => { setMenuAberto(false); }, [pathname]);

  function fecharComEscape(event) {
    if (event.key === 'Escape' && menuAberto) {
      setMenuAberto(false);
      menuBotao.current?.focus();
    }
  }

  function handleSair() {
    logout();
    navigate('/');
  }

  return (
    <header className="nav-header" onKeyDown={fecharComEscape}>
      <NavLink to="/dashboard" className="nav-logo">&#9670; Gestão de TI</NavLink>
      <button ref={menuBotao} type="button" className="nav-toggle" aria-expanded={menuAberto} aria-controls="navegacao-principal" onClick={() => setMenuAberto(aberto => !aberto)}>
        {menuAberto ? 'Fechar menu' : 'Menu'}
      </button>
      <nav id="navegacao-principal" aria-label="Navegação principal" className={menuAberto ? 'nav-open' : ''} onClick={event => { if (event.target.closest('a')) setMenuAberto(false); }}>
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
        <button type="button" className="nav-logout" onClick={handleSair}>Sair</button>
      </div>
    </header>
  );
}
