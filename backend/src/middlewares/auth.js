const { toId } = require('../utils/ids');
const jwt = require('jsonwebtoken');
const { timingSafeEqual } = require('crypto');
const prisma = require('../prisma');
const { tokenVersion } = require('../utils/tokenVersion');
const { SESSION_COOKIE_NAME } = require('../utils/sessionCookie');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definido no .env');
const PERFIS_LEGADOS = { GERAL: 'ADMIN', INTERMEDIARIO: 'DIRECTOR', BAIXO: 'USER', TECNICO: 'DIRECTOR', COMUM: 'USER' };

function lerCookie(req, nome) {
  const cookies = req.headers.cookie || '';
  for (const item of cookies.split(';')) {
    const separador = item.indexOf('=');
    if (separador < 0 || item.slice(0, separador).trim() !== nome) continue;
    try {
      return decodeURIComponent(item.slice(separador + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function autenticar(req, res, next) {
  const token = lerCookie(req, SESSION_COOKIE_NAME);
  if (!token) return res.status(401).json({ erro: 'Sessão não fornecida.' });
  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ erro: 'Token inválido ou malformado.' });
  }

  try {
    const id = toId(decoded.id);
    // Perfil e status vêm do banco para que inativação e mudança de perfil valham imediatamente.
    const atual = await prisma.uSUARIOS.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, perfil: true, status: true, senha_hash: true },
    });
    if (!atual || atual.status !== 'ATIVO') {
      return res.status(401).json({ erro: 'Conta inativa ou inexistente. Faça login novamente.' });
    }
    const versaoEsperada = Buffer.from(tokenVersion(atual.senha_hash, SECRET), 'hex');
    const versaoToken = typeof decoded.cv === 'string' ? Buffer.from(decoded.cv, 'hex') : Buffer.alloc(0);
    if (versaoToken.length !== versaoEsperada.length || !timingSafeEqual(versaoToken, versaoEsperada)) {
      return res.status(401).json({ erro: 'Sessão inválida. Faça login novamente.' });
    }
    if (typeof decoded.csrf !== 'string') {
      return res.status(401).json({ erro: 'Sessão inválida. Faça login novamente.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfEsperado = Buffer.from(decoded.csrf);
      const csrfRecebido = Buffer.from(req.headers['x-csrf-token'] || '');
      if (csrfRecebido.length !== csrfEsperado.length || !timingSafeEqual(csrfRecebido, csrfEsperado)) {
        return res.status(403).json({ erro: 'Token de proteção CSRF inválido.' });
      }
    }
    req.usuario = {
      ...decoded,
      id,
      nome: atual.nome,
      email: atual.email,
      perfil: PERFIS_LEGADOS[atual.perfil] || atual.perfil,
    };
    next();
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(401).json({ erro: 'Token inválido ou malformado.' });
    res.status(500).json({ erro: 'Erro ao validar sessão.' });
  }
}
function apenasAdminOuDirector(req, res, next) {
  if (!['ADMIN', 'DIRECTOR'].includes(req.usuario.perfil)) {
    return res.status(403).json({ erro: 'Acesso negado. Perfil insuficiente.' });
  }
  next();
}

function apenasAdmin(req, res, next) {
  if (req.usuario.perfil !== 'ADMIN') {
    return res.status(403).json({ erro: 'Acesso negado. Apenas administradores.' });
  }
  next();
}

function apenasAdminOuUser(req, res, next) {
  if (!['ADMIN', 'USER'].includes(req.usuario.perfil)) {
    return res.status(403).json({ erro: 'Acesso negado. O perfil Director possui acesso somente para consulta.' });
  }
  next();
}

module.exports = { autenticar, apenasAdminOuDirector, apenasAdmin, apenasAdminOuUser, SECRET };