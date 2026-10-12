const { hashPassword, verifyPassword, needsMigration } = require('../utils/passwords');
const { tokenVersion } = require('../utils/tokenVersion');
const { randomBytes } = require('crypto');
const {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  sessionClearCookieOptions,
} = require('../utils/sessionCookie');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

async function login(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { email, senha } = body;
    if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

    const usuario = await prisma.uSUARIOS.findUnique({ where: { email: emailNormalizado } });
    if (!usuario || usuario.status !== 'ATIVO') {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const ok = await verifyPassword(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

    let senhaHashAtual = usuario.senha_hash;
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
      senhaHashAtual = novoHash;
    }

    const SECRET = process.env.JWT_SECRET;
    const csrfToken = randomBytes(32).toString('base64url');
    const token = jwt.sign(
      {
        id: usuario.id.toString(),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        cv: tokenVersion(senhaHashAtual, SECRET),
        csrf: csrfToken,
      },
      SECRET,
      { expiresIn: '1h' }
    );

    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    res.json({
      csrfToken,
      usuario: { id: usuario.id.toString(), nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro interno ao realizar login.' });
  }
}

function session(req, res) {
  const { id, nome, email, perfil, csrf } = req.usuario;
  return res.json({ usuario: { id: id.toString(), nome, email, perfil }, csrfToken: csrf });
}

function logout(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, sessionClearCookieOptions());
  return res.json({ mensagem: 'Sessão encerrada.' });
}

module.exports = { login, session, logout };