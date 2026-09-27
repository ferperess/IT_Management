export const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', AGUARDANDO_USUARIO: 'Aguardando usuário', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

// Formata somente os modelos de mensagem do sistema, preservando comentários livres.
export function formatarHistorico(comentario) {
  if (typeof comentario !== 'string') return '';
  return comentario.replace(/^Status alterado para (ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)\.$/,
    (_, status) => `Status alterado para ${statusLabel[status]}.`);
}

export function formatarErroChamado(mensagem) {
  if (typeof mensagem !== 'string') return '';
  const transicao = /^Transição de status inválida: não é possível mover de "(ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)" para "(ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)"\.$/;
  return mensagem
    .replace(transicao, (_, origem, destino) => `Transição de status inválida: não é possível mover de "${statusLabel[origem]}" para "${statusLabel[destino]}".`)
    .replace(/^Status inválido\. Valores aceitos: ((?:ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)(?:, (?:ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO))*)\.$/,
      (_, valores) => `Status inválido. Valores aceitos: ${valores.split(', ').map(status => statusLabel[status]).join(', ')}.`);
}
