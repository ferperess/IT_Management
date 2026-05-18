// Regras de negócio centralizadas

const PERFIS_VALIDOS = ['COMUM', 'TECNICO', 'ADMIN'];
const STATUS_USUARIO_VALIDOS = ['ATIVO', 'INATIVO'];
const STATUS_ATIVO_VALIDOS = ['ATIVO', 'INATIVO', 'MANUTENCAO'];
const TIPOS_ATIVO_VALIDOS = ['COMPUTADOR', 'IMPRESSORA', 'SERVIDOR', 'REDE', 'MONITOR', 'PERIFERICO', 'OUTRO'];
const STATUS_CHAMADO_VALIDOS = ['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'];
const PRIORIDADES_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

// Fluxo de status permitido para chamados
const TRANSICOES_STATUS = {
  ABERTO: ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
};

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarSenha(senha) {
  return typeof senha === 'string' && senha.length >= 6;
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
  TRANSICOES_STATUS,
  validarEmail,
  validarSenha,
  validarTransicaoStatus,
  validarDataPassada,
};
