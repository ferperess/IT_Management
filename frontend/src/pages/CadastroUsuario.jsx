import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';
import usePageTitle from '../hooks/usePageTitle';

export default function CadastroUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdicao = Boolean(id);

  const [form, setForm] = useState({
    nome: '', email: '', username: '', senha: '', perfil: 'COMUM', status: 'ATIVO',
  });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  usePageTitle(isEdicao ? 'Edição Usuário' : 'Cadastro Usuário');

  useEffect(() => {
    if (isEdicao) {
      api.get('/usuarios').then(r => {
        const u = r.data.find(x => x.id === Number(id));
        if (u) setForm({ nome: u.nome, email: u.email, username: u.username, senha: '', perfil: u.perfil, status: u.status });
      });
    }
  }, [id]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(''); setSucesso(''); setLoading(true);
    try {
      const payload = { ...form };
      if (isEdicao && !payload.senha) delete payload.senha;
      if (isEdicao) {
        await api.put(`/usuarios/${id}`, payload);
        setSucesso('Usuário atualizado com sucesso!');
      } else {
        await api.post('/usuarios', payload);
        setSucesso('Usuário cadastrado com sucesso!');
        setForm({ nome: '', email: '', username: '', senha: '', perfil: 'COMUM', status: 'ATIVO' });
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
        <div className="card-box">
          <h2>{isEdicao ? 'Editar Usuário' : 'Cadastrar Usuário'}</h2>
          <hr className="divider" />
          {erro && <div className="alert alert-erro">{erro}</div>}
          {sucesso && <div className="alert alert-sucesso">{sucesso}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome Completo</label>
              <input className="form-control" placeholder="Nome do servidor" value={form.nome} onChange={set('nome')} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>E-mail</label>
                <input type="email" className="form-control" placeholder="email@teste.com" value={form.email} onChange={set('email')} required />
              </div>
              <div className="form-group">
                <label>Usuário de Acesso</label>
                <input className="form-control" placeholder="nome.sobrenome" value={form.username} onChange={set('username')} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Senha {isEdicao && <span style={{ fontWeight: 'normal', fontSize: 12 }}>(deixe em branco para manter)</span>}</label>
                <input type="password" className="form-control" value={form.senha} onChange={set('senha')} {...(!isEdicao ? { required: true } : {})} />
              </div>
              <div className="form-group">
                <label>Perfil de Acesso</label>
                <select className="form-control" value={form.perfil} onChange={set('perfil')}>
                  <option value="COMUM">Comum</option>
                  <option value="TECNICO">Técnico de TI</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={form.status} onChange={set('status')}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 20, textAlign: 'right', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
