const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api',
});

const PRIORIDADES_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];


function sanitizar(texto) {
  return texto
    .replace(/[\r\n]+/g, ' ')  // remove quebras de linha
    .replace(/[<>{}]/g, '')     // remove caracteres suspeitos
    .substring(0, 500)          // limita o tamanho
    .trim();
}

async function classificarPrioridade(titulo, descricao) {
  const tituloSeguro = sanitizar(titulo);
  const descricaoSegura = sanitizar(descricao);

  // const response
 // Correção Smell: const api_response
  const api_response = await client.messages.create({
    model: 'anthropic/claude-haiku-4-5',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Você é um classificador de prioridades de chamados de TI. Sua única tarefa é analisar o título e a descrição de um chamado e classificá-lo em uma das seguintes categorias: BAIXA, MEDIA, ALTA ou CRITICA.\nVocê DEVE responder APENAS com uma dessas quatro palavras, sem qualquer texto adicional, explicação ou pontuação.\n\nChamado para Classificação:\nTítulo: ${tituloSeguro}\nDescrição: ${descricaoSegura}\n\nClassificação de Prioridade:`
    }]
  });

  const resultado = api_response.content[0].text.trim().toUpperCase();
  return PRIORIDADES_VALIDAS.includes(resultado) ? resultado : 'MEDIA';
}

module.exports = { classificarPrioridade };