import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);
const perfisLegados = { GERAL: 'ADMIN', INTERMEDIARIO: 'DIRECTOR', BAIXO: 'USER', TECNICO: 'DIRECTOR', COMUM: 'USER' };
const normalizarUsuario = usuario => usuario && ({
  ...usuario,
  id: String(usuario.id),
  perfil: perfisLegados[usuario.perfil] || usuario.perfil,
});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const s = localStorage.getItem('usuario');
    if (!s) return null;
    try {
      return normalizarUsuario(JSON.parse(s));
    } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  function login(data) {
    data = { ...data, usuario: normalizarUsuario(data.usuario) };
    setToken(data.token);
    setUsuario(data.usuario);
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
  }

  function logout() {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
