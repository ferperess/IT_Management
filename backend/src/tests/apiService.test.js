const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

const { classificarPrioridade } = require('../services/apiService');

describe('apiService: classificarPrioridade', () => {
  beforeEach(() => mockCreate.mockClear());

  test('deve retornar ALTA para chamado crítico', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'ALTA' }] });
    const resultado = await classificarPrioridade('Servidor caiu', 'O servidor principal está fora do ar');
    expect(resultado).toBe('ALTA');
  });

  test('deve retornar BAIXA para chamado simples', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'BAIXA' }] });
    const resultado = await classificarPrioridade('Trocar mouse', 'Mouse do usuário parou de funcionar');
    expect(resultado).toBe('BAIXA');
  });

  test('deve retornar MEDIA se IA retornar valor inválido', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'URGENTE' }] });
    const resultado = await classificarPrioridade('Qualquer título', 'Qualquer descrição');
    expect(resultado).toBe('MEDIA');
  });

  test('deve aceitar resposta em minúsculas e normalizar', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'critica' }] });
    const resultado = await classificarPrioridade('Sistema fora do ar', 'Todos os serviços caíram');
    expect(resultado).toBe('CRITICA');
  });

  test('deve sanitizar quebras de linha substituindo por espaço', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'MEDIA' }] });
    await classificarPrioridade('Título\ncom\nquebras', 'Descrição\ncom\nquebras');
    const chamada = mockCreate.mock.calls[0][0];
    const content = chamada.messages[0].content;
    // Quebras de linha são substituídas por espaço — título e descrição aparecem sem \n
    expect(content).toContain('Título com quebras');
    expect(content).toContain('Descrição com quebras');
  });

  test('deve limitar texto a 500 caracteres por campo', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'MEDIA' }] });
    const textoLongo = 'A'.repeat(1000);
    await classificarPrioridade(textoLongo, textoLongo);
    const chamada = mockCreate.mock.calls[0][0];
    const content = chamada.messages[0].content;
    expect(content).not.toContain('A'.repeat(600));
  });
});
