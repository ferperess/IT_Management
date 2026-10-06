import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function CadastroUsuario() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const idUsuario = id || location.state?.usuarioId;
  const isEdicao = location.pathname === '/usuarios/edicao' || Boolean(id);

  const [form, setForm] = useState({
    nome: '', email: '', username: '', senha: '', perfil: 'USER', status: 'ATIVO',
  });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  usePageTitle(isEdicao ? 'Edição Usuário' : 'Cadastro Usuário');

  useEffect(() => {
    if (isEdicao) {
      if (!idUsuario) {
        navigate('/usuarios', { replace: true });
        return;
      }
      api.get(`/usuarios/${idUsuario}`).then(r => {
        const u = r.data;
        setForm({ nome: u.nome, email: u.email, username: u.username, senha: '', perfil: u.perfil, status: u.status });
      }).catch(() => navigate('/usuarios'));
    }
  }, [idUsuario, isEdicao, navigate]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); setSucesso(''); setLoading(true);
    try {
      const payload = { ...form };
      if (isEdicao && !payload.senha) delete payload.senha;
      if (isEdicao) {
        await api.put(`/usuarios/${idUsuario}`, payload);
        setSucesso('Usuário atualizado com sucesso!');
      } else {
        await api.post('/usuarios', payload);
        setSucesso('Usuário cadastrado com sucesso!');
        setForm({ nome: '', email: '', username: '', senha: '', perfil: 'USER', status: 'ATIVO' });
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar usuário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="card-box cadastro-usuario-form">
          <h2>{isEdicao ? 'Editar Usuário' : 'Cadastrar Usuário'}</h2>
          <hr className="divider" />
          {erro && <div className="alert alert-erro">{erro}</div>}
          {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="cadastrousuario-campo-1">Nome Completo</label>
              <input id="cadastrousuario-campo-1" className="form-control" placeholder="Nome do servidor" value={form.nome} onChange={set('nome')} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cadastrousuario-campo-2">E-mail</label>
                <input id="cadastrousuario-campo-2" type="email" className="form-control" placeholder="email@teste.com" value={form.email} onChange={set('email')} required />
              </div>
              <div className="form-group">
                <label htmlFor="cadastrousuario-campo-3">Usuário de Acesso</label>
                <input id="cadastrousuario-campo-3" className="form-control" placeholder="nome.sobrenome" value={form.username} onChange={set('username')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cadastrousuario-campo-4">Senha {isEdicao && <span style={{ fontWeight: 'normal', fontSize: 12 }}>(deixe em branco para manter)</span>}</label>
                <input id="cadastrousuario-campo-4" type="password" className="form-control" value={form.senha} onChange={set('senha')} {...(!isEdicao ? { required: true } : {})} />
              </div>
              <div className="form-group">
                <label htmlFor="cadastrousuario-campo-5">Perfil de Acesso</label>
                <select id="cadastrousuario-campo-5" className="form-control" value={form.perfil} onChange={set('perfil')}>
                  <option value="USER">User</option>
                  <option value="DIRECTOR">Director</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cadastrousuario-campo-6">Status</label>
                <select id="cadastrousuario-campo-6" className="form-control" value={form.status} onChange={set('status')}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/usuarios')}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Dados'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}