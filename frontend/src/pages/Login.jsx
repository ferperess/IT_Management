import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  usePageTitle('Login');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      login(data);
      navigate('/dashboard');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-box">
        <h1>Sistema de Gestão de TI</h1>
        <p className="subtitle">Acesso restrito aos colaboradores</p>
        {erro && <div className="alert alert-erro">{erro}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-campo-1">E-mail</label>
            <input id="login-campo-1"
              type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
              className="form-control"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-campo-2">Senha</label>
            <input id="login-campo-2"
              type="password" autoComplete="current-password"
              className="form-control"
              placeholder="Digite sua senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}