// Regras de negócio centralizadas

const PERFIS_VALIDOS = ['USER', 'DIRECTOR', 'ADMIN'];
const STATUS_USUARIO_VALIDOS = ['ATIVO', 'INATIVO'];
const STATUS_ATIVO_VALIDOS = ['ATIVO', 'INATIVO', 'MANUTENCAO', 'EM_MANUTENCAO'];
const TIPOS_ATIVO_VALIDOS = ['COMPUTADOR', 'NOTEBOOK', 'IMPRESSORA', 'SERVIDOR', 'REDE', 'MONITOR', 'PERIFERICO', 'OUTRO'];
const STATUS_CHAMADO_VALIDOS = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_USUARIO', 'CONCLUIDO', 'CANCELADO'];
const PRIORIDADES_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const CATEGORIAS_VALIDAS = ['HARDWARE', 'SOFTWARE', 'REDE', 'ACESSO', 'IMPRESSORA', 'AUDIOVISUAL', 'OUTRO'];
const SENHA_MIN_CARACTERES = 12;
const SENHA_MAX_CARACTERES = 18;

// Fluxo de status permitido para chamados
const TRANSICOES_STATUS = {
  ABERTO: ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['AGUARDANDO_USUARIO', 'CONCLUIDO', 'CANCELADO'],
  AGUARDANDO_USUARIO: ['EM_ANDAMENTO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
};

function validarEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarSenha(senha) {
  return typeof senha === 'string'
    && senha.length >= SENHA_MIN_CARACTERES
    && senha.length <= SENHA_MAX_CARACTERES;
}

function validarTransicaoStatus(statusAtual, statusNovo) {
  const permitidos = TRANSICOES_STATUS[statusAtual] || [];
  return permitidos.includes(statusNovo);
}

function validarDataPassada(data) {
  return new Date(data) <= new Date();
}

module.exports = {
  PERFIS_VALIDOS,
  STATUS_USUARIO_VALIDOS,
  STATUS_ATIVO_VALIDOS,
  TIPOS_ATIVO_VALIDOS,
  STATUS_CHAMADO_VALIDOS,
  PRIORIDADES_VALIDAS,
  CATEGORIAS_VALIDAS,
  SENHA_MIN_CARACTERES,
  SENHA_MAX_CARACTERES,
  TRANSICOES_STATUS,
  validarEmail,
  validarSenha,
  validarTransicaoStatus,
  validarDataPassada,
};
