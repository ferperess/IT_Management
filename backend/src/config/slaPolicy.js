// Prazos em HORAS CORRIDAS. null = SLA não definido para novos chamados.
// Configure após aprovação da instituição; não altera os prazos já gravados.
// A mudança de prioridade recalcula os prazos a partir da abertura do chamado.
module.exports = {
  BAIXA: { atendimento: 24, resolucao: 120 },
  MEDIA: { atendimento: 8, resolucao: 24 },
  ALTA: { atendimento: 1, resolucao: 8 },
  CRITICA: { atendimento: 0.25, resolucao: 4 },
};

