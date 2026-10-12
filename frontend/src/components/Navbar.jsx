import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoSGTI from '../assets/SGTI-navbar.svg';

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [erroLogout, setErroLogout] = useState('');
  const menuBotao = useRef(null);

  useEffect(() => { setMenuAberto(false); }, [pathname]);

  function fecharComEscape(event) {
    if (event.key === 'Escape' && menuAberto) {
      setMenuAberto(false);
      menuBotao.current?.focus();
    }
  }

  async function handleSair() {
    setErroLogout('');
    try {
      await logout();
      navigate('/');
    } catch {
      setErroLogout('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }

  return (
    <header className="nav-header" onKeyDown={fecharComEscape}>
      <NavLink to="/dashboard" className="nav-logo">
        <img src={logoSGTI} alt="" width="32" height="32" />
        <span>Gestão de TI</span>
      </NavLink>
      <button ref={menuBotao} type="button" className="nav-toggle" aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuAberto} aria-controls="navegacao-principal" onClick={() => setMenuAberto(aberto => !aberto)}>
        Menu
      </button>
      <nav id="navegacao-principal" aria-label="Navegação principal" className={menuAberto ? 'nav-open' : ''} onClick={event => { if (event.target.closest('a') && menuAberto) { menuBotao.current?.focus(); setMenuAberto(false); } }}>
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
          {['ADMIN', 'DIRECTOR'].includes(usuario?.perfil) && (
          <li>
            <NavLink to="/ativos" className={({ isActive }) => isActive ? 'active' : ''}>
              Ativos
            </NavLink>
          </li>
          )}
          <li>
            <NavLink to="/chamados" className={({ isActive }) => isActive ? 'active' : ''}>
              Chamados
            </NavLink>
          </li>
          {['ADMIN', 'DIRECTOR'].includes(usuario?.perfil) && (
          <li>
            <NavLink to="/documentacao" className={({ isActive }) => isActive ? 'active' : ''}>
              Documentação
            </NavLink>
          </li>
          )}
        </ul>
      </nav>
      <div className="nav-sair">
        {erroLogout && <span role="alert">{erroLogout}</span>}
        <button type="button" className="nav-logout" onClick={handleSair}>Sair</button>
      </div>
    </header>
  );
}
