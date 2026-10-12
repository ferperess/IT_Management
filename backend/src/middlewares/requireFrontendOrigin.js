function createRequireFrontendOrigin(frontendUrl) {
  const allowedOrigin = new URL(frontendUrl).origin;
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  return function requireFrontendOrigin(req, res, next) {
    if (safeMethods.has(req.method)) return next();
    if (req.get('Origin') !== allowedOrigin) {
      return res.status(403).json({ erro: 'Origem da requisição não permitida.' });
    }
    next();
  };
}

module.exports = { createRequireFrontendOrigin };
