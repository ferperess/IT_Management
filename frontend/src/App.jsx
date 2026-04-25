import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import CadastroUsuario from './pages/CadastroUsuario';
import Ativos from './pages/Ativos';
import Chamados from './pages/Chamados';
import Documentacao from './pages/Documentacao';

function RotaProtegida({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
        <Route path="/usuarios" element={<RotaProtegida><Usuarios /></RotaProtegida>} />
        <Route path="/usuarios/novo" element={<RotaProtegida><CadastroUsuario /></RotaProtegida>} />
        <Route path="/usuarios/:id" element={<RotaProtegida><CadastroUsuario /></RotaProtegida>} />
        <Route path="/ativos" element={<RotaProtegida><Ativos /></RotaProtegida>} />
        <Route path="/chamados" element={<RotaProtegida><Chamados /></RotaProtegida>} />
        <Route path="/documentacao" element={<RotaProtegida><Documentacao /></RotaProtegida>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}
