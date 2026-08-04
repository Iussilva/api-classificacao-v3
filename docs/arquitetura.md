# Arquitetura do Projeto

Este documento cataloga a arquitetura atual do projeto `ourobras-classificacao` e serve como mapa para evolucoes futuras.

## Visao Geral

O sistema e uma aplicacao Node.js/Express que entrega um front-end estatico e uma API protegida por JWT. A API consulta bancos Firebird, agrega dados de estoque, vendas, auditoria, contratos e marketing, e tambem envia contextos resumidos para uma integracao de IA.

```mermaid
flowchart LR
  Usuario[Usuario no navegador]
  Front[Front-end estatico<br/>public/index.html<br/>public/script.js<br/>public/style.css]
  Login[public/login.html]
  API[API Express<br/>server.js]
  Auth[Middleware JWT<br/>autenticar]
  Cache[Cache em memoria<br/>comCache]
  FB1[(Firebird Matriz)]
  FB2[(Firebird Manaus)]
  IA[Provedor IA<br/>OpenAI SDK/Groq]

  Usuario --> Front
  Usuario --> Login
  Login -->|POST /api/auth/login| API
  Front -->|Authorization: Bearer token| API
  API --> Auth
  Auth --> Cache
  Cache --> FB1
  Cache --> FB2
  API --> IA
```

## Fluxo de Autenticacao

```mermaid
sequenceDiagram
  participant U as Usuario
  participant B as Navegador
  participant A as API Express

  U->>B: Acessa login.html
  B->>A: POST /api/auth/login usuario/senha
  A->>A: bcrypt.compareSync
  A->>A: jwt.sign expira em 8h
  A-->>B: token JWT
  B->>B: salva ourobras_token no localStorage
  B->>A: GET /api/... Authorization: Bearer token
  A->>A: jwt.verify
  A-->>B: dados da consulta
```

## Fluxo de Consulta

```mermaid
sequenceDiagram
  participant F as Front-end
  participant A as API
  participant C as Cache em memoria
  participant DB as Firebird

  F->>A: GET /api/estoque?... com Bearer token
  A->>A: autenticar()
  A->>A: normalizar filtros
  A->>C: procurar cacheKey
  alt cache valido
    C-->>A: dados em memoria
  else cache ausente/expirado
    A->>DB: query(sql, params, origem)
    DB-->>A: rows
    A->>C: armazenar por CACHE_TTL_MS
  end
  A-->>F: JSON
```

## Componentes Principais

| Area | Arquivo | Responsabilidade |
| --- | --- | --- |
| Servidor HTTP | `server.js` | Configura Express, middlewares, rotas e startup |
| Seguranca HTTP | `server.js` | Helmet, CORS, rate limit e autenticacao JWT |
| Banco de dados | `server.js` | Conexao Firebird Matriz/Manaus e funcao `query` |
| Cache | `server.js` | Cache simples em memoria com TTL |
| Estoque | `server.js`, `public/script.js` | Dashboards, ranking, produtos e filtros |
| Vendas | `server.js`, `public/script.js` | Consulta por periodo, loja, fabricante e coordenador |
| Auditoria | `server.js`, `public/script.js` | Estoque com grade, valores opcionais e exportacoes |
| Consultas ERP | `server.js`, `public/script.js` | Movimentacoes por tipo/status/loja/data |
| Contratos | `server.js`, `public/script.js` | Parametros, clientes, produtos, compradores e validacao |
| Marketing | `server.js`, `public/script.js` | Clientes novos, grupos e exportacoes |
| IA | `server.js`, `public/script.js` | Chat e resumos baseados em dados agregados |

## Fronteiras de Seguranca

```mermaid
flowchart TB
  subgraph Publico["Publico no navegador"]
    HTML[index.html/login.html]
    JS[script.js]
    CSS[style.css]
  end

  subgraph Privado["Servidor"]
    ENV[.env]
    JWT[JWT_SECRET]
    FBPASS[Credenciais Firebird]
    API[server.js]
  end

  subgraph Dados["Dados corporativos"]
    DB[(Firebird)]
  end

  HTML --> JS
  JS -->|Bearer token| API
  API --> ENV
  API --> DB
```

Tudo em `public/` e visivel no F12. Segredos e regras sensiveis devem ficar apenas no servidor.

## Estado Atual Observado

- API exige JWT para `/api/`, exceto `/api/ping` e `/api/auth/login`.
- `public/` e servido estaticamente antes do middleware de autenticacao.
- `.env` esta ignorado no Git e nao apareceu como arquivo versionado.
- Login usa hash bcrypt no `.env`.
- CORS possui whitelist, mas atualmente libera origens bloqueadas por causa do retorno temporario.
- Algumas consultas usam parametros `?`; outras ainda montam trechos SQL por concatenacao.
- O front usa `localStorage` para token e `innerHTML` em varias renderizacoes.

