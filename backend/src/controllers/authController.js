const { hashPassword, verifyPassword, needsMigration } = require('../utils/passwords');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

    const usuario = await prisma.uSUARIOS.findUnique({ where: { email } });
    if (!usuario || usuario.status === 'INATIVO') {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const ok = await verifyPassword(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

    if (needsMigration(senha, usuario.senha_hash)) {
      const novoHash = await hashPassword(senha);
      // Não sobrescreve uma troca de senha ou desativação feita em outra sessão.
      const migracao = await prisma.uSUARIOS.updateMany({
        where: { id: usuario.id, senha_hash: usuario.senha_hash, status: usuario.status },
        data: { senha_hash: novoHash },
      });
      if (migracao.count !== 1) {
        return res.status(401).json({ erro: 'Credenciais alteradas. Tente entrar novamente.' });
      }
    }

    const SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: usuario.id.toString(), nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: { id: usuario.id.toString(), nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno ao realizar login.' });
  }
}

module.exports = { login };