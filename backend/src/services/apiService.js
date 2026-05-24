const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api',
});

const PRIORIDADES_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const CATEGORIAS_VALIDAS = ['HARDWARE', 'SOFTWARE', 'REDE', 'ACESSO', 'IMPRESSORA', 'AUDIOVISUAL', 'OUTRO'];

function sanitizar(texto) {
  return texto
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>{}]/g, '')
    .substring(0, 500)
    .trim();
}

async function classificarChamado(titulo, descricao) {
  const tituloSeguro = sanitizar(titulo);
  const descricaoSegura = sanitizar(descricao);

  const api_response = await client.messages.create({
    model: 'anthropic/claude-haiku-4-5',
    max_tokens: 20,
    messages: [{
      role: 'user',
      content: `Você é um classificador de chamados de TI. Analise o título e a descrição e responda APENAS com JSON no formato {"prioridade":"X","categoria":"Y"} onde:
- prioridade: BAIXA, MEDIA, ALTA ou CRITICA
- categoria: HARDWARE, SOFTWARE, REDE, ACESSO, IMPRESSORA, AUDIOVISUAL ou OUTRO

Título: ${tituloSeguro}
Descrição: ${descricaoSegura}

JSON:`
    }]
  });

  try {
    const texto = api_response.content[0].text.trim();
    const parsed = JSON.parse(texto);
    const prioridade = PRIORIDADES_VALIDAS.includes(parsed.prioridade?.toUpperCase())
      ? parsed.prioridade.toUpperCase()
      : 'MEDIA';
    const categoria = CATEGORIAS_VALIDAS.includes(parsed.categoria?.toUpperCase())
      ? parsed.categoria.toUpperCase()
      : 'OUTRO';
    return { prioridade, categoria };
  } catch {
    return { prioridade: 'MEDIA', categoria: 'OUTRO' };
  }
}

// Mantido por compatibilidade com testes existentes
async function classificarPrioridade(titulo, descricao) {
  const resultado = await classificarChamado(titulo, descricao);
  return resultado.prioridade;
}

module.exports = { classificarChamado, classificarPrioridade };
