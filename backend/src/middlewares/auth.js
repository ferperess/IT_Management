const { toId } = require('../utils/ids');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definido no .env');
const PERFIS_LEGADOS = { GERAL: 'ADMIN', INTERMEDIARIO: 'DIRECTOR', BAIXO: 'USER', TECNICO: 'DIRECTOR', COMUM: 'USER' };

async function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Token não fornecido.' });
  const token = auth.split(' ')[1];
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
    const atual = await prisma.uSUARIOS.findUnique({ where: { id }, select: { id: true, perfil: true, status: true } });
    if (!atual || atual.status !== 'ATIVO') {
      return res.status(401).json({ erro: 'Conta inativa ou inexistente. Faça login novamente.' });
    }
    req.usuario = {
      ...decoded,
      id,
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