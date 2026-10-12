import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api, { setCsrfToken } from '../services/api';

const AuthContext = createContext(null);
const perfisLegados = { GERAL: 'ADMIN', INTERMEDIARIO: 'DIRECTOR', BAIXO: 'USER', TECNICO: 'DIRECTOR', COMUM: 'USER' };
const normalizarUsuario = usuario => usuario && ({
  ...usuario,
  id: String(usuario.id),
  perfil: perfisLegados[usuario.perfil] || usuario.perfil,
});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const geracaoAuth = useRef(0);

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    const aoExpirar = () => {
      geracaoAuth.current += 1;
      setCsrfToken(null);
      setUsuario(null);
      setCarregando(false);
    };
    window.addEventListener('auth:unauthorized', aoExpirar);

    const geracaoInicial = ++geracaoAuth.current;
    api.get('/auth/session')
      .then(({ data }) => {
        if (geracaoAuth.current !== geracaoInicial) return;
        setCsrfToken(data.csrfToken);
        setUsuario(normalizarUsuario(data.usuario));
      })
      .catch(() => {
        if (geracaoAuth.current !== geracaoInicial) return;
        setCsrfToken(null);
        setUsuario(null);
      })
      .finally(() => {
        if (geracaoAuth.current === geracaoInicial) setCarregando(false);
      });

    return () => window.removeEventListener('auth:unauthorized', aoExpirar);
  }, []);

  function login(data) {
    geracaoAuth.current += 1;
    setCsrfToken(data.csrfToken);
    setUsuario(normalizarUsuario(data.usuario));
    setCarregando(false);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      if (err.response?.status !== 401) throw err;
    }
    geracaoAuth.current += 1;
    setCsrfToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
