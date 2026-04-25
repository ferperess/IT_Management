import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function Dashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ abertos: 0, andamento: 0, concluidos: 0, totalAtivos: 0 });

  usePageTitle('Home');

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <main>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 'normal' }}>
            Olá, <strong>{usuario?.nome}</strong>!
          </h1>
        </div>

        <div className="cards-grid">
          <div className="card destaque">
            <div className="card-title">Chamados Abertos</div>
            <div className="card-value">{stats.abertos}</div>
          </div>
          <div className="card">
            <div className="card-title">Chamados em Andamento</div>
            <div className="card-value">{String(stats.andamento).padStart(2, '0')}</div>
          </div>
          <div className="card">
            <div className="card-title">Chamados Concluídos</div>
            <div className="card-value">{stats.concluidos}</div>
          </div>
          <div className="card">
            <div className="card-title">Total de Ativos de TI</div>
            <div className="card-value">{stats.totalAtivos}</div>
          </div>
        </div>

        <div className="quick-actions">
          <h2>Ações Rápidas</h2>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => navigate('/chamados')}>+ Abrir Novo Chamado</button>
            <button className="btn btn-secondary" onClick={() => navigate('/ativos')}>Consultar Ativos</button>
            <button className="btn btn-secondary" onClick={() => navigate('/documentacao')}>Base de Conhecimento</button>
          </div>
        </div>
      </main>
    </>
  );
}
