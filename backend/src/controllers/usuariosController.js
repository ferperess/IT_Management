const { toId } = require('../utils/ids');
const { hashPassword } = require('../utils/passwords');
const prisma = require('../prisma');
const {
  PERFIS_VALIDOS,
  STATUS_USUARIO_VALIDOS,
  SENHA_MIN_CARACTERES,
  SENHA_MAX_CARACTERES,
  validarEmail,
  validarSenha,
} = require('../validators');

function normalizarTextoUsuario(valor, maximo) {
  if (typeof valor !== 'string' || valor.length > maximo) return null;
  const texto = valor.trim();
  return texto || null;
}

async function listar_usuarios(req, res) {
  try {
    let { busca } = req.query;
    if (busca) {
      // Limita o tamanho da busca e remove caracteres perigosos
      busca = busca.trim().substring(0, 100);
    }
    const where = busca
      ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { email: { contains: busca, mode: 'insensitive' } }] }
      : {};
    const usuarios = await prisma.uSUARIOS.findMany({
      where,
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true, criado_em: true },
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
}

async function buscarPorId(req, res) {
  try {
    const u = await prisma.uSUARIOS.findUnique({
      where: { id: toId(req.params.id) },
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(u);
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(500).json({ erro: 'Erro ao buscar usuário.' });
  }
}

async function criar_usuario(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { senha, perfil, status } = body;
    const nome = normalizarTextoUsuario(body.nome, 100);
    const email = normalizarTextoUsuario(body.email, 254)?.toLowerCase();
    const username = normalizarTextoUsuario(body.username, 50)?.toLowerCase();

    if (!nome || !email || !username || !senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, username, senha.' });
    }

    // Validação de formato de e-mail
    if (!validarEmail(email)) {
      return res.status(400).json({ erro: 'Formato de e-mail inválido.' });
    }

    // Validação de senha mínima
    if (!validarSenha(senha)) {
      return res.status(400).json({ erro: `A senha deve ter entre ${SENHA_MIN_CARACTERES} e ${SENHA_MAX_CARACTERES} caracteres.` });
    }

    // Validação de perfil
    if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ erro: `Perfil inválido. Valores aceitos: ${PERFIS_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (status !== undefined && !STATUS_USUARIO_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_USUARIO_VALIDOS.join(', ')}.` });
    }

    const hash = await hashPassword(senha);
    const u = await prisma.uSUARIOS.create({
      data: { nome, email, username, senha_hash: hash, perfil: perfil || 'USER', status: status || 'ATIVO' },
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    res.status(201).json(u);
  } catch (e) {
    if (e.code === 'INVALID_ID') return res.status(400).json({ erro: e.message });
    if (e.code === 'P2002') return res.status(409).json({ erro: 'Email ou username já em uso.' });
    res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
}

async function atualizar_usuario(req, res) {
  try {
    const { id } = req.params;
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).length === 0) return res.status(400).json({ erro: 'Informe ao menos um campo válido para atualização.' });
    const { senha, perfil, status } = body;
    const data = {};
    const camposTexto = [
      ['nome', 100, valor => valor],
      ['email', 254, valor => valor.toLowerCase()],
      ['username', 50, valor => valor.toLowerCase()],
    ];
    for (const [campo, maximo, transformar] of camposTexto) {
      if (body[campo] !== undefined) {
        const valor = normalizarTextoUsuario(body[campo], maximo);
        if (!valor) return res.status(400).json({ erro: `Campo ${campo} inválido.` });
        data[campo] = transformar(valor);
      }
    }

    if (data.email && !validarEmail(data.email)) {
      return res.status(400).json({ erro: 'Formato de e-mail inválido.' });
    }

    if (senha !== undefined && !validarSenha(senha)) {
      return res.status(400).json({ erro: `A senha deve ter entre ${SENHA_MIN_CARACTERES} e ${SENHA_MAX_CARACTERES} caracteres.` });
    }

    // Validação de perfil
    if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ erro: `Perfil inválido. Valores aceitos: ${PERFIS_VALIDOS.join(', ')}.` });
    }

    // Validação de status
    if (status !== undefined && !STATUS_USUARIO_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Valores aceitos: ${STATUS_USUARIO_VALIDOS.join(', ')}.` });
    }

    if (perfil !== undefined) data.perfil = perfil;
    if (status !== undefined) data.status = status;
    if (senha !== undefined) data.senha_hash = await hashPassword(senha);

    const u = await prisma.uSUARIOS.update({
      where: { id: toId(id) },
      data,
      select: { id: true, nome: true, email: true, username: true, perfil: true, status: true },
    });
    res.json(u);
  } catch (e) {
    if (e.code === 'INVALID_ID') return res.status(400).json({ erro: e.message });
    if (e.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (e.code === 'P2002') return res.status(409).json({ erro: 'Email ou username já em uso.' });
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
}

async function inativar_usuario(req, res) {
  try {
    const idAlvo = toId(req.params.id);

    // Admin não pode inativar a si mesmo
    if (req.usuario.id === idAlvo) {
      return res.status(400).json({ erro: 'Você não pode inativar sua própria conta.' });
    }

    await prisma.uSUARIOS.update({ where: { id: idAlvo }, data: { status: 'INATIVO' } });
    res.json({ mensagem: 'Usuário inativado.' });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Usuário não encontrado.' });
  }
}

async function reativar_usuario(req, res) {
  try {
    const idAlvo = toId(req.params.id);
    await prisma.uSUARIOS.update({ where: { id: idAlvo }, data: { status: 'ATIVO' } });
    res.json({ mensagem: 'Usuário reativado.' });
  } catch (err) {
    if (err.code === 'INVALID_ID') return res.status(400).json({ erro: err.message });
    res.status(404).json({ erro: 'Usuário não encontrado.' });
  }
}

module.exports = { listar: listar_usuarios, buscarPorId, criar: criar_usuario, atualizar: atualizar_usuario, inativar: inativar_usuario, reativar: reativar_usuario };
