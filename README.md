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

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

A aplicação abre em: http://localhost:5173

---

## Testes

Os testes unitários cobrem os controllers, middlewares e o serviço de IA. Eles rodam de forma isolada, sem precisar de conexão com o banco de dados ou com a API do OpenRouter.

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
├── setup.js                      # Variáveis de ambiente para o ambiente de teste
├── auth.middleware.test.js        # Middleware de autenticação JWT e controle de perfil
├── auth.controller.test.js        # Login: campos obrigatórios, credenciais, token
├── usuarios.controller.test.js    # CRUD de usuários e inativação
├── ativos.controller.test.js      # CRUD de ativos de TI
├── chamados.controller.test.js    # Abertura, atualização e dashboard de chamados
└── apiService.test.js             # Classificação de prioridade por IA e sanitização
```

### O que é testado

| Suite | Casos |
|---|---|
| Middleware de autenticação | Token válido, expirado, inválido, ausente; restrição por perfil ADMIN, TECNICO e COMUM |
| Login | Campos ausentes, usuário inexistente, conta inativa, senha errada, sucesso, erro de banco |
| Usuários | Listar, buscar por ID, criar com campos faltando, e-mail duplicado, atualizar, inativar |
| Ativos | Listar, criar com campos faltando, criar com sucesso, atualizar, remover |
| Chamados | Listar, buscar, criar sem campos obrigatórios, ativo inexistente, atualizar, dashboard |
| Serviço de IA | Classificação ALTA/BAIXA/MEDIA/CRÍTICA, valor inválido, sanitização, limite de caracteres |

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
│   │   ├── schema.prisma     # Modelos do banco de dados
│   │   └── migrations/       # Histórico de migrações
│   ├── src/
│   │   ├── controllers/      # Lógica de negócio (ativos, chamados, usuários, etc.)
│   │   ├── middlewares/      # Autenticação JWT e controle de perfil
│   │   ├── routes/           # Endpoints REST
│   │   ├── services/         # Integração com IA (OpenRouter/Claude)
│   │   ├── tests/            # Testes unitários
│   │   └── server.js         # Entry point Express
│   ├── .env                  # Variáveis de ambiente (chaves e segredos)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── assets/           # Ícone da aplicação
    │   ├── components/       # Navbar
    │   ├── context/          # AuthContext (JWT)
    │   ├── hooks/            # usePageTitle
    │   ├── pages/            # Login, Dashboard, Ativos, Chamados, Usuários, Documentação
    │   ├── services/         # Axios configurado
    │   ├── App.jsx           # Roteamento
    │   ├── index.css         # Estilos globais
    │   └── main.jsx          # Entry point React
    ├── index.html
    └── vite.config.js        # Proxy /api → localhost:3001
```

---

## Endpoints da API

| Método | Rota | Perfil mínimo |
|--------|------|---------------|
| POST | /api/auth/login | — |
| GET | /api/dashboard | Qualquer autenticado |
| GET/POST | /api/usuarios | ADMIN |
| PUT/PATCH | /api/usuarios/:id | ADMIN |
| GET | /api/ativos | Qualquer autenticado |
| POST/PUT | /api/ativos | TECNICO / ADMIN |
| DELETE | /api/ativos/:id | ADMIN |
| GET/POST | /api/chamados | Qualquer autenticado |
| PUT | /api/chamados/:id | TECNICO / ADMIN |
| GET/POST | /api/documentacoes | TECNICO / ADMIN |
| PUT/DELETE | /api/documentacoes/:id | ADMIN |