export const statusLabel = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', AGUARDANDO_USUARIO: 'Aguardando usuário', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };

const eventosHistorico = [
  /^Chamado aberto por /,
  /^Status alterado para (ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO|Aberto|Em andamento|Aguardando usuário|Concluído|Cancelado)\.$/,
  /^Motivo da espera: /,
  /^Prioridade alterada\. Os prazos de SLA originais foram preservados\.$/,
  /^Documentações relacionadas atualizadas\.$/,
  /^Dados do chamado atualizados\.$/,
  /^Encerramento confirmado pelo solicitante\.$/,
  /^Encerramento rejeitado pelo solicitante\. Atendimento retomado\.$/,
];

export function formatarHistorico(comentario) {
  if (typeof comentario !== 'string') return '';
  const linhas = comentario.split('\n');
  const eventos = [];
  while (linhas.length && eventosHistorico.some(evento => evento.test(linhas[0]))) {
    const linha = linhas.shift();
    eventos.push(linha.replace(/^Status alterado para (ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)\.$/,
      (_, status) => `Status alterado para ${statusLabel[status]}.`));
  }
  const textoLivre = linhas.join('\n').trim();
  if (textoLivre) eventos.push(textoLivre.startsWith('Comentário:') ? textoLivre : `Comentário: ${textoLivre}`);
  return eventos.join('\n');
}

export function formatarErroChamado(mensagem) {
  if (typeof mensagem !== 'string') return '';
  const transicao = /^Transição de status inválida: não é possível mover de "(ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)" para "(ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)"\.$/;
  return mensagem
    .replace(transicao, (_, origem, destino) => `Transição de status inválida: não é possível mover de "${statusLabel[origem]}" para "${statusLabel[destino]}".`)
    .replace(/^Status inválido\. Valores aceitos: ((?:ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO)(?:, (?:ABERTO|EM_ANDAMENTO|AGUARDANDO_USUARIO|CONCLUIDO|CANCELADO))*)\.$/,
      (_, valores) => `Status inválido. Valores aceitos: ${valores.split(', ').map(status => statusLabel[status]).join(', ')}.`);
}
