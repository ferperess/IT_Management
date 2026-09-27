jest.mock('node:https', () => ({ request: jest.fn() }));

const { EventEmitter } = require('node:events');
const https = require('node:https');
const { classificarPrioridade } = require('../services/apiService');
let corposEnviados;

function configurarResposta(prioridade, categoria = 'HARDWARE') {
  https.request.mockImplementation((url, options, receberResposta) => {
    const requisicao = new EventEmitter();
    requisicao.destroy = jest.fn(erro => requisicao.emit('error', erro));
    requisicao.end = jest.fn(corpo => {
      corposEnviados.push(JSON.parse(corpo));
      const resposta = new EventEmitter();
      resposta.statusCode = 200;
      resposta.setEncoding = jest.fn();
      receberResposta(resposta);
      resposta.emit('data', JSON.stringify({
        model: 'modelo-teste',
        choices: [{ message: { content: JSON.stringify({ prioridade, categoria }) } }],
      }));
      resposta.emit('end');
    });
    return requisicao;
  });
}

describe('apiService: classificarPrioridade', () => {
  beforeEach(() => {
    https.request.mockReset();
    corposEnviados = [];
    process.env.OPENROUTER_MODEL = 'modelo-teste';
    process.env.OPENROUTER_FALLBACK_MODEL = '';
  });

  test('deve retornar ALTA para chamado crítico', async () => {
    configurarResposta('ALTA');
    await expect(classificarPrioridade('Servidor caiu', 'O servidor principal está fora do ar')).resolves.toBe('ALTA');
  });

  test('deve retornar BAIXA para chamado simples', async () => {
    configurarResposta('BAIXA');
    await expect(classificarPrioridade('Trocar mouse', 'Mouse do usuário parou de funcionar')).resolves.toBe('BAIXA');
  });

  test('deve rejeitar classificação inválida', async () => {
    configurarResposta('URGENTE');
    await expect(classificarPrioridade('Qualquer título', 'Qualquer descrição'))
      .rejects.toMatchObject({ code: 'CLASSIFICACAO_INDISPONIVEL' });
  });

  test('deve aceitar resposta em minúsculas e normalizar', async () => {
    configurarResposta('critica');
    await expect(classificarPrioridade('Sistema fora do ar', 'Todos os serviços caíram')).resolves.toBe('CRITICA');
  });

  test('envia título e descrição como dados JSON, preservando quebras de linha', async () => {
    configurarResposta('MEDIA');
    await classificarPrioridade('Título\ncom\nquebras', 'Descrição\ncom\nquebras');
    expect(JSON.parse(corposEnviados[0].messages[1].content)).toEqual({
      titulo: 'Título\ncom\nquebras',
      descricao: 'Descrição\ncom\nquebras',
    });
  });

  test('limita título a 500 caracteres e descrição a 6000', async () => {
    configurarResposta('MEDIA');
    await classificarPrioridade('T'.repeat(1000), 'D'.repeat(7000));
    const dados = JSON.parse(corposEnviados[0].messages[1].content);
    expect(dados.titulo).toHaveLength(500);
    expect(dados.descricao).toHaveLength(6000);
  });
});
