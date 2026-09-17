const { toId } = require('../utils/ids');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definido no .env');

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Token não fornecido.' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    // Adiciona verificação extra se necessário (ex: status do usuário no banco)
    req.usuario = { ...decoded, id: toId(decoded.id) };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    res.status(401).json({ erro: 'Token inválido ou malformado.' });
  }
}

function apenasAdminOuTecnico(req, res, next) {
  if (!['ADMIN', 'TECNICO'].includes(req.usuario.perfil)) {
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

module.exports = { autenticar, apenasAdminOuTecnico, apenasAdmin, SECRET };