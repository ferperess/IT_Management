const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

    const usuario = await prisma.uSUARIOS.findUnique({ where: { email } });
    if (!usuario || usuario.status === 'INATIVO') {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

    const SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno ao realizar login.' });
  }
}

module.exports = { login };