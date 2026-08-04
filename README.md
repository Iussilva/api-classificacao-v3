# Ourobras Classificacao

API e painel interno para consultas otimizadas da Ourobras.

## Objetivo

Centralizar consultas intersetoriais de Estoque, Vendas, Auditoria, Consultas ERP, Marketing e Administracao, preservando o banco ERP Firebird como somente leitura.

## Arquitetura

```text
ourobras-classificacao/
  db/
    migrations/
  docs/
  public/
    img/
    index.html
    login.html
    login.js
    script.js
    style.css
  src/
    config/
    db/
    middlewares/
    routes/
    services/
    app.js
  tests/
  tools/
  package.json
  package-lock.json
  server.js
```

## Bancos

- Firebird ERP: somente leitura, usado para consultas operacionais.
- MySQL/MariaDB App: usuarios, permissoes e logs de auditoria.

## Comandos

```bash
npm install
npm start
npm test
npm run seed:admin
```

No Windows/PowerShell, se `npm` estiver bloqueado, use:

```bash
npm.cmd test
npm.cmd run seed:admin
```

## Seguranca

- JWT em cookie HttpOnly.
- CSP sem script inline.
- CORS restrito.
- Permissoes por aba.
- Abas sem permissao ausentes no front.
- Logs de auditoria no MySQL da aplicacao.
- Rate limit no login e na API.

## Deploy

Em producao, configurar:

```env
NODE_ENV=production
APP_DB_ENABLED=true
ALLOWED_ORIGIN=https://classificacao.suporteourobras.com
```

O acesso ao Firebird deve ocorrer via rede segura, como WireGuard, sempre com usuario de leitura.
