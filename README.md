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

## Usuário de teste

 E-mail: teste@teste.com
 Senha: teste
 Perfil: ADMIN

---

## Estrutura do projeto

```
gestao-ti/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Modelos do banco de dados
│   │   ├── seed.js           # Usuário admin teste
|   |   └── dev.db            # Banco de Dados
│   ├── src/
│   │   ├── controllers/      # Lógica de negócio
│   │   ├── middlewares/      # JWT + controle de perfil
│   │   ├── routes/           # Endpoints REST
│   │   └── server.js         # Entry point Express
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/          # AuthContext (JWT)
    │   ├── pages/            # Login, Dashboard, Ativos, Chamados, etc.
    │   ├── components/       # Navbar
    │   ├── services/         # Axios configurado
    │   └── App.jsx           # Roteamento
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
