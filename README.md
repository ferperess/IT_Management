# IT_Management

## Pré-requisitos
- Node.js >= 18
- npm >= 9

---

## Configuração e execução

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

O servidor sobe em: http://localhost:3001

### Banco de dados

O banco PostgreSQL é mantido no Supabase. Alterações de schema devem ser registradas em scripts SQL versionados em `backend/sql/`, revisadas pela equipe e aplicadas ao Supabase pelo fluxo definido pelos desenvolvedores. Atualize também `backend/prisma/schema.prisma` para manter o Prisma Client sincronizado com o banco. Este projeto não usa migrations do Prisma nem bancos locais por desenvolvedor.

O script `backend/sql/sla_documentacoes.sql` atende instalações que ainda não receberam as alterações de SLA e documentação. Antes de executá-lo, confira se os objetos que ele cria ou altera ainda não existem no projeto Supabase.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

A aplicação abre em: http://localhost:5173

---

## Testes

Os testes unitários cobrem controllers, middlewares, serviços de SLA/senhas e a integração de classificação com OpenRouter. Eles rodam isoladamente, sem conexão com banco de dados ou com a API externa.

### Executar os testes

```bash
cd backend
npm test
```

### Executar com relatório de cobertura

```bash
cd backend
npm run test:coverage
```

### Estrutura dos testes

```
backend/src/tests/
├── setup.js                       # Configuração de ambiente para testes
├── auth.controller.test.js        # Login e autenticação
├── auth.middleware.test.js        # JWT e autorização por perfil
├── usuarios.controller.test.js    # Usuários e inativação
├── ativos.controller.test.js      # Cadastro, atualização e remoção de ativos
├── chamados.controller.test.js    # Chamados, SLA e dashboard
├── documentacoes.links.test.js    # Vínculos entre chamados e documentação
├── passwords.controllers.test.js  # Fluxos de senha nos controllers
├── passwords.test.js              # Hash e verificação de senhas
├── sla.controller.test.js         # Pausas e operações de SLA
├── sla.service.test.js            # Cálculos de SLA
└── apiService.test.js             # Classificação OpenRouter e validação da resposta
```

### O que é testado

| Suite | Casos |
|---|---|
| Middleware de autenticação | Token válido, expirado, inválido, ausente; restrição por perfil ADMIN, TECNICO e COMUM |
| Login | Campos ausentes, usuário inexistente, conta inativa, senha errada, sucesso, erro de banco |
| Usuários | Listar, buscar por ID, criar com campos faltando, e-mail duplicado, atualizar, inativar |
| Ativos | Listar, criar com campos faltando, criar com sucesso, atualizar, remover |
| Chamados | Listar, buscar, criar sem campos obrigatórios, ativo inexistente, atualizar, dashboard |
| Serviço OpenRouter | Classificação, resposta inválida, normalização e limites de entrada |
| SLA | Prazos, pausas, transições e resultados de atendimento/resolução |
| Documentação | Preservação e bloqueio de vínculos com chamados |
| Senhas | Hash, verificação e fluxos dos controllers |

---

## Usuário de teste

 E-mail: teste@teste.com  
 Senha: teste  
 Perfil: ADMIN

---

## Estrutura do projeto

```
IT_Management/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma             # Modelos PostgreSQL usados pelo Prisma Client
│   ├── sql/
│   │   └── sla_documentacoes.sql     # Atualização manual para instalações existentes
│   ├── src/
│   │   ├── config/                   # Políticas de SLA
│   │   ├── controllers/              # Lógica de negócio por domínio
│   │   ├── middlewares/              # Autenticação JWT e autorização
│   │   ├── routes/                   # Endpoints REST
│   │   ├── services/                 # OpenRouter, SLA e escrita transacional
│   │   ├── tests/                    # Testes unitários e de controllers
│   │   ├── utils/                    # IDs e senhas
│   │   ├── prisma.js                 # Cliente Prisma
│   │   ├── validators.js             # Validações e regras de domínio
│   │   └── server.js                 # Inicialização Express
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/                   # Recursos estáticos
│   │   ├── components/              # Navbar, seleção múltipla e painel SLA
│   │   ├── context/                  # Estado de autenticação
│   │   ├── hooks/                    # Hooks compartilhados
│   │   ├── pages/                    # Login, dashboard e telas do sistema
│   │   ├── services/                 # Cliente HTTP da API
│   │   ├── utils/                    # Labels e apresentação de chamados
│   │   ├── App.jsx                   # Rotas da aplicação
│   │   ├── index.css                 # Estilos globais
│   │   └── main.jsx                  # Inicialização React
│   ├── index.html
│   ├── package.json
│   └── vite.config.js                # Proxy /api para o backend
├── .gitignore
├── Contributors.md
└── README.md
```

---

## Endpoints da API

| Método | Rota | Perfil mínimo |
|--------|------|---------------|
| POST | /api/auth/login | — |
| GET | /api/dashboard | Qualquer autenticado |
| GET | /api/relatorios | TECNICO / ADMIN |
| GET | /api/usuarios | ADMIN |
| POST | /api/usuarios | ADMIN |
| GET/PUT | /api/usuarios/:id | ADMIN |
| PATCH | /api/usuarios/:id/inativar | ADMIN |
| GET | /api/ativos | Qualquer autenticado |
| POST | /api/ativos | TECNICO / ADMIN |
| PUT | /api/ativos/:id | TECNICO / ADMIN |
| DELETE | /api/ativos/:id | ADMIN |
| GET | /api/chamados e /api/chamados/:id | Qualquer autenticado |
| POST | /api/chamados | Qualquer autenticado |
| PUT | /api/chamados/:id | TECNICO / ADMIN |
| GET | /api/documentacoes, /api/documentacoes/:id e /api/documentacoes/:id/download | Qualquer autenticado |
| POST | /api/documentacoes | TECNICO / ADMIN |
| PUT | /api/documentacoes/:id | TECNICO / ADMIN |
| DELETE | /api/documentacoes/:id | ADMIN |