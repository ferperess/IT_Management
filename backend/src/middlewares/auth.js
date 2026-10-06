const { toId } = require('../utils/ids');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definido no .env');
const PERFIS_LEGADOS = { GERAL: 'ADMIN', INTERMEDIARIO: 'DIRECTOR', BAIXO: 'USER', TECNICO: 'DIRECTOR', COMUM: 'USER' };

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Token não fornecido.' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    // Adiciona verificação extra se necessário (ex: status do usuário no banco)
    req.usuario = {
      ...decoded,
      id: toId(decoded.id),
      perfil: PERFIS_LEGADOS[decoded.perfil] || decoded.perfil,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    res.status(401).json({ erro: 'Token inválido ou malformado.' });
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