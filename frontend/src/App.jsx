import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import CadastroUsuario from './pages/CadastroUsuario';
import Ativos from './pages/Ativos';
import Chamados from './pages/Chamados';
import Documentacao from './pages/Documentacao';

function RotaProtegida({ children, perfis }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <main><p role="status">Verificando sessão...</p></main>;
  if (!usuario) return <Navigate to="/" replace />;
  if (perfis && !perfis.includes(usuario?.perfil)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
        <Route path="/usuarios" element={<RotaProtegida perfis={['ADMIN']}><Usuarios /></RotaProtegida>} />
        <Route path="/usuarios/cadastro" element={<RotaProtegida perfis={['ADMIN']}><CadastroUsuario /></RotaProtegida>} />
        <Route path="/usuarios/edicao" element={<RotaProtegida perfis={['ADMIN']}><CadastroUsuario /></RotaProtegida>} />
        <Route path="/usuarios/novo" element={<Navigate to="/usuarios/cadastro" replace />} />
        <Route path="/usuarios/:id" element={<RotaProtegida perfis={['ADMIN']}><CadastroUsuario /></RotaProtegida>} />
        <Route path="/ativos" element={<RotaProtegida perfis={['ADMIN', 'DIRECTOR']}><Ativos /></RotaProtegida>} />
        <Route path="/ativos/cadastro" element={<RotaProtegida perfis={['ADMIN']}><Ativos /></RotaProtegida>} />
        <Route path="/ativos/edicao" element={<RotaProtegida perfis={['ADMIN']}><Ativos /></RotaProtegida>} />
        <Route path="/chamados" element={<RotaProtegida><Chamados /></RotaProtegida>} />
        <Route path="/documentacao" element={<RotaProtegida perfis={['ADMIN', 'DIRECTOR']}><Documentacao /></RotaProtegida>} />
        <Route path="/documentacao/cadastro" element={<RotaProtegida perfis={['ADMIN']}><Documentacao /></RotaProtegida>} />
        <Route path="/documentacao/edicao" element={<RotaProtegida perfis={['ADMIN']}><Documentacao /></RotaProtegida>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}
