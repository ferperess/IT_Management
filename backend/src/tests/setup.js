// Carrega variáveis de ambiente antes de qualquer teste
process.env.JWT_SECRET = 'jwt_secret_para_testes';
process.env.DATABASE_URL = 'postgresql://fake:fake@localhost:5432/fake';
process.env.OPENROUTER_API_KEY = 'sk-fake-key-para-testes';
