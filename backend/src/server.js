require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

const app = express();
app.set('trust proxy', 1);
const { jsonReplacer } = require('./utils/ids');
app.set('json replacer', jsonReplacer);

// Configuração de Segurança com Helmet
app.use(helmet());

// Limitação geral e proteção específica contra tentativas automatizadas de login.
const rateLimitWindowMs = 15 * 60 * 1000;
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições vindas deste IP, tente novamente mais tarde.' }
});
const loginLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));