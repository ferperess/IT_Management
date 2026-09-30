# Gestão de TI (IT_Management)

Aplicação web para gerenciamento de chamados de TI, ativos, locais e documentação, com autenticação por perfil e acompanhamento de SLA.

## Requisitos
- Node.js 18 ou superior
- npm 9 ou superior
- Banco PostgreSQL provisionado no Supabase
- Chave e modelo do OpenRouter para classificar chamados ao criá-los

## Configuração

### Banco de dados

O projeto usa PostgreSQL no Supabase. Não usa migrations do Prisma nem banco local por desenvolvedor. Mudanças de schema são mantidas em `backend/sql/` e aplicadas ao Supabase conforme o fluxo da equipe. `backend/prisma/schema.prisma` deve permanecer sincronizado com o banco.

Os scripts SQL são atualizações incrementais para instalações existentes. Confira o estado do banco e aplique somente as alterações que ainda faltam; não os execute às cegas.

| Script | Alterações |
|---|---|
| `backend/sql/sla_documentacoes.sql` | Campos e pausas de SLA, vínculos entre chamados e documentações, migração dos vínculos existentes. |
| `backend/sql/ativos_confirmacao.sql` | Patrimônio dos ativos e confirmação de encerramento pelo solicitante. |
| `backend/sql/locais.sql` | Tabela de locais, locais iniciais e vínculo dos ativos por `id_local`; preserva localizações antigas como inativas para revisão. |

Depois de aplicar os scripts necessários, gere o cliente Prisma:

```bash
cd backend
npx prisma generate
```

### Variáveis de ambiente

Crie `backend/.env` com os valores do ambiente. Não versione esse arquivo nem compartilhe suas credenciais.

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=segredo-longo-e-aleatorio
OPENROUTER_API_KEY=sua-chave
OPENROUTER_MODEL=provedor/modelo-principal
# Opcional: segunda tentativa de classificação
OPENROUTER_FALLBACK_MODEL=provedor/modelo-alternativo
# Opcionais; estes são os padrões locais
PORT=3001
FRONTEND_URL=http://localhost:5173
```

`DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` são necessários para a configuração completa. O modelo alternativo é opcional. Sem chave/modelo do OpenRouter, a criação de chamados não consegue concluir a classificação automática.
Na classificação, o título e a descrição do chamado são enviados ao OpenRouter.

## Executar

Inicie o backend em um terminal:

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

O backend inicia em `http://localhost:3001` por padrão.

Inicie o frontend em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

A aplicação fica em `http://localhost:5173`. O Vite encaminha `/api` para `http://localhost:3001`. Em outro ambiente, `VITE_API_URL` pode definir a URL base da API.

Não há usuário de demonstração criado pelo repositório. Use uma conta provisionada para a instância; a criação de usuários pela aplicação é restrita a administradores.

## Funcionalidades

- Chamados classificados pelo OpenRouter, histórico, confirmação de encerramento e SLA em horas corridas. Prazos atendimento/resolução: Baixa `24h/120h`, Média `8h/24h`, Alta `1h/8h`, Crítica `15min/4h`; a espera do usuário pausa a resolução.
- Gestão de ativos, patrimônio, locais e documentação com arquivos ou links; documentação pode ser vinculada a ativos e chamados.
- `COMUM`: abre e consulta os próprios chamados, sem prazos SLA ou documentos vinculados no detalhe. `TECNICO`: gerencia chamados/ativos/documentação e vê relatórios. `ADMIN`: também administra usuários e remove registros.

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

Os testes usam mocks; não precisam de conexão com o Supabase ou com a API do OpenRouter.

---

## Estrutura do projeto

```text
IT_Management/
├── backend/
│   ├── prisma/schema.prisma
│   ├── sql/
│   │   ├── ativos_confirmacao.sql
│   │   ├── locais.sql
│   │   └── sla_documentacoes.sql
│   ├── src/
│   │   ├── config/          # Política de SLA
│   │   ├── controllers/     # auth, usuários, ativos, locais, chamados e documentação
│   │   ├── middlewares/     # Autenticação e autorização
│   │   ├── routes/
│   │   ├── services/        # OpenRouter, SLA e escrita transacional
│   │   ├── tests/
│   │   ├── utils/
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, SLA e seleção múltipla
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/           # Login, dashboard, chamados, ativos, usuários e documentação
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Contributors.md
└── README.md
```

---

## Endpoints da API

- Autenticação e dashboard: `POST /api/auth/login`, `GET /api/dashboard`.
- Chamados: `GET/POST /api/chamados`, `GET /api/chamados/:id`, `PUT /api/chamados/:id`; leitura é autenticada, `COMUM` vê apenas os próprios, edição exige `TECNICO` ou `ADMIN`.
- Confirmação: `POST /api/chamados/:id/confirmacao`, somente pelo solicitante do chamado.
- Ativos e locais: leitura autenticada; criar/editar ativos exige `TECNICO` ou `ADMIN`, remover exige `ADMIN`. `GET /api/locais` lista locais ativos.
- Documentação: leitura e download autenticados; criar/editar exige `TECNICO` ou `ADMIN`, remover exige `ADMIN`.
- Usuários: administração exclusiva de `ADMIN`. Relatórios: `TECNICO` ou `ADMIN`.
