const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'gestao_ti_secret_2024';

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Token não fornecido.' });
  const token = auth.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido.' });
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
