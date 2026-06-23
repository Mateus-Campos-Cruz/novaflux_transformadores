# NovaFlux Almoxarifado — Plataforma Digital de Gestão de Almoxarifado Industrial

Sistema de gestão de estoque e alocação de insumos desenvolvido para a **NovaFlux Transformadores**. A plataforma fornece rastreabilidade operacional de materiais, alocação de reservas para ordens de fabricação de transformadores, consolidação de rupturas de estoque para compras e logs de auditoria de segurança.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18 + Vite + React Router v6 + CSS3 (Design System Industrial HSL, Fontes Rajdhani e Inter)
- **Backend:** Node.js + Express
- **Banco de Dados:** PostgreSQL (Suporta Neon.tech ou Instalação Local)
- **Autenticação:** JWT + Rotação de Refresh Token

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v18+)
- Banco de Dados PostgreSQL ativo e acessível

### 1. Configurando o Banco de Dados
1. Crie uma base de dados no PostgreSQL (local ou Neon.tech):
   ```sql
   CREATE DATABASE novaflux_db;
   ```

### 2. Configurando o Backend
1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie e preencha o arquivo `.env` baseado no `.env.example`:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/novaflux_db
   JWT_SECRET=sua_chave_secreta_jwt_acesso
   JWT_REFRESH_SECRET=sua_chave_secreta_jwt_refresh
   CORS_ORIGIN=http://localhost:5173
   ```
4. Execute o script de configuração do banco (criação das tabelas, índices e usuários sementes):
   ```bash
   npm run db:setup
   ```
   *Nota: Esse comando criará as tabelas e adicionará os seguintes usuários semente para testes:*
   - **Administrador:** `admin@novaflux.com` / `adminPassword123`
   - **Almoxarife:** `almoxarife@novaflux.com` / `almoxarife123`
   - **Engenharia:** `engenharia@novaflux.com` / `engenharia123`
   - **Compras:** `compras@novaflux.com` / `compras123`
5. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

### 3. Configurando o Frontend
1. Abra um novo terminal e navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor Vite local:
   ```bash
   npm run dev
   ```
4. O sistema estará acessível em: `http://localhost:5173`

---

## 🔒 Regras de Segurança Implementadas

1. **Proteção Contra Brute Force:** Bloqueio automático de contas por 15 minutos após 5 tentativas de login consecutivas malsucedidas (gerido com persistência via banco).
2. **Rate Limiting:** Limite rigoroso de no máximo 10 tentativas de login por minuto por IP (usando `express-rate-limit`).
3. **Helmet Security Headers:** Headers como `X-Frame-Options` para evitar clickjacking, `X-XSS-Protection` contra injeção de scripts e configurações restritas de `Content-Security-Policy`.
4. **Queries Parametrizadas:** Proteção absoluta contra injeção de SQL em todas as transações de banco de dados.
5. **Auditoria Transacional:** Toda inserção, atualização ou modificação crítica (reservas, ajustes de saldo) é registrada de forma imutável com usuário e IP de origem na tabela `audit_log`.
6. **Soft Delete:** Nenhum material ou usuário é excluído permanentemente; em vez disso, são desativados via flag `ativo = FALSE`.

---

## 📊 Regra de Negócio Crítica: Estoque Disponível Líquido

O cálculo do estoque líquido disponível ocorre em tempo real em todas as visualizações (nunca em cache):
$$\text{disponivel\_liquido} = \text{quantidade\_fisica} - \sum(\text{reservas ativas})$$
- Uma reserva manual só é gerada caso $\text{disponivel\_liquido} \ge \text{quantidade\_a\_reservar}$.
- Caso contrário, a reserva é bloqueada exibindo a falta.

---

## 🌐 Documentação das Rotas da API (REST)

### Autenticação (`/api/auth`)
- `POST /login`
  - *Descrição:* Autentica o usuário, reinicia falhas se correto ou atualiza contador de erros/bloqueia conta.
  - *Rate Limit:* 10 req/min por IP.
  - *Parâmetros:* `{ email, password }`
- `POST /refresh-token`
  - *Descrição:* Renova o token de acesso (8 horas) utilizando rotação de refresh token (invalida o refresh anterior).
  - *Parâmetros:* `{ refreshToken }`
- `POST /logout`
  - *Descrição:* Invalida o token de refresh em memória do servidor.
  - *Parâmetros:* `{ refreshToken }`

### Materiais (`/api/materiais`)
- `GET /`
  - *Descrição:* Lista todos os materiais cadastrados ativos.
  - *Autorização:* Administrador, Almoxarife, Engenharia, Compras.
  - *Query Params:* `page=1`, `limit=50`, `codigo`, `grupo`, `descricao`, `unidade`.
- `POST /`
  - *Descrição:* Cadastra um novo material no catálogo de forma manual.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
  - *Parâmetros:* `{ codigo, grupo, descricao, unidade, quantidade_fisica, peso_unitario }`
- `POST /:id/movimentar`
  - *Descrição:* Realiza entrada, saída ou ajuste físico manual com motivo obrigatório.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
  - *Parâmetros:* `{ tipo: 'entrada'|'saida'|'ajuste', quantidade, motivo }`
- `GET /:id/movimentacoes`
  - *Descrição:* Histórico completo de movimentações físicas de um material específico.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
- `POST /import`
  - *Descrição:* Upload de planilha (.csv ou .xlsx) para cadastro/ajuste em lote.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
  - *Upload:* Campo `planilha` (Máximo 10MB).

### Projetos (`/api/projetos`)
- `GET /`
  - *Descrição:* Lista todos os projetos cadastrados ativos e informa se possuem rupturas em tempo real.
  - *Autorização:* Todos os perfis.
- `POST /`
  - *Descrição:* Cadastra um novo projeto.
  - *Autorização:* Administrador, Engenharia.
  - *Parâmetros:* `{ codigo_projeto, nome, descricao, status: 'planejamento'|'reserva_ativa' }`
- `GET /:id`
  - *Descrição:* Detalha o projeto e exibe a lista técnica de materiais com status individuais (disponível, alerta, ruptura).
  - *Autorização:* Todos os perfis.
- `PUT /:id`
  - *Descrição:* Atualiza dados do projeto. Caso alterado para `encerrado`, libera todas as reservas ativas do projeto automaticamente.
  - *Autorização:* Administrador, Engenharia.
  - *Parâmetros:* `{ nome, descricao, status }`
- `POST /:id/import-lista`
  - *Descrição:* Carrega a planilha técnica de materiais (BOM) vinculada ao projeto.
  - *Autorização:* Administrador, Engenharia.
  - *Upload:* Campo `planilha` (.csv ou .xlsx).
- `POST /:id/reservar-lote`
  - *Descrição:* Aloca reservas de estoque automaticamente para todos os itens da lista técnica com estoque disponível líquido livre no almoxarifado.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
- `GET /:id/pendencias`
  - *Descrição:* Gera o relatório técnico de pendências com itens em falta de estoque físico.
  - *Autorização:* Todos os perfis.

### Reservas (`/api/reservas`)
- `GET /`
  - *Descrição:* Lista todas as reservas que encontram-se com status `'ativa'`.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
- `POST /`
  - *Descrição:* Gera uma reserva manual unitária para um material em um projeto.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
  - *Parâmetros:* `{ projeto_id, material_id, quantidade_reservada }`
- `POST /:id/cancelar`
  - *Descrição:* Cancela uma reserva ativa informando obrigatoriamente a justificativa.
  - *Autorização:* Administrador, Almoxarife, Engenharia.
  - *Parâmetros:* `{ motivo }`
- `GET /historico`
  - *Descrição:* Histórico completo de alocações (ativas, canceladas ou liberadas).
  - *Autorização:* Administrador, Almoxarife, Engenharia.

### Área de Compras (`/api/compras`)
- `GET /rupturas`
  - *Descrição:* Retorna a visão consolidada de rupturas ativas de materiais agrupadas, com detalhamento de projetos solicitantes e quantidade exata de compra faltante.
  - *Autorização:* Todos os perfis (Especial foco em Compras).

### Auditoria de Segurança (`/api/auditoria`)
- `GET /`
  - *Descrição:* Retorna os logs de auditoria registrados com IP de origem.
  - *Autorização:* Apenas Administrador.
  - *Query Params:* `usuario`, `acao`, `data_inicio`, `data_fim`.
