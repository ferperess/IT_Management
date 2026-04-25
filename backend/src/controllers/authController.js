const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middlewares/auth');

const prisma = new PrismaClient();

async function login(req, res) {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

  const usuario = await prisma.uSUARIOS.findUnique({ where: { email } });
  if (!usuario || usuario.status === 'INATIVO') {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }

  const ok = await bcrypt.compare(senha, usuario.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
}

module.exports = { login };
