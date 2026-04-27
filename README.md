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
IT_Management/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Modelos do banco de dados
│   │   ├── seed.js           # Usuário admin padrão
│   │   └── dev.db            # Banco de dados SQLite
│   ├── src/
│   │   ├── controllers/      # Lógica de negócio (ativos, chamados, usuários, etc.)
│   │   ├── middlewares/      # Autenticação JWT e controle de perfil
│   │   ├── routes/           # Endpoints REST
│   │   ├── services/         # Integração com IA (OpenRouter/Claude)
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
