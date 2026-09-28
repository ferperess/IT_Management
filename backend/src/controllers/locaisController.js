const prisma = require('../prisma');

async function listar(req, res) {
  try {
    const locais = await prisma.lOCAIS.findMany({ where: { status: 'ATIVO' }, orderBy: { nome: 'asc' } });
    res.json(locais);
  } catch {
    res.status(500).json({ erro: 'Erro ao listar locais.' });
  }
}

module.exports = { listar };
