# Usuarios e permissoes

## Regra do banco ERP

O banco Firebird usado para consultas do ERP deve ser tratado como somente leitura.

Nao criar neste banco:

- tabelas;
- triggers;
- generators;
- procedures;
- indices;
- registros de usuarios;
- logs da aplicacao;
- qualquer estrutura auxiliar da API.

As consultas atuais de Estoque, Vendas, Auditoria, Consultas ERP e Marketing devem continuar apenas lendo os dados existentes.

## Estado atual

O login permanece baseado no administrador configurado por `.env`.

A API nao esta conectando a camada de usuarios ao banco Firebird do ERP.

O JWT agora pode ser enviado por cookie `HttpOnly`, reduzindo a exposicao do token ao JavaScript do navegador.

Em producao, configure:

```text
NODE_ENV=production
```

Com isso, o cookie de autenticacao sera emitido com a flag `Secure`, exigindo HTTPS.

## Auditoria

Eventos de seguranca e administracao sao registrados no MySQL da aplicacao, na tabela:

```text
logs_acesso
```

Eventos registrados:

- `LOGIN_SUCESSO_BANCO`
- `LOGIN_SUCESSO_ENV`
- `LOGIN_FALHA`
- `LOGOUT`
- `ADMIN_USUARIO_CRIADO`
- `ADMIN_PERMISSOES_ALTERADAS`
- `ADMIN_STATUS_ALTERADO`
- `ADMIN_SENHA_ALTERADA`

A tela Admin exibe os ultimos eventos em "Logs de auditoria".

## CSP

Os eventos inline do front-end foram removidos da tela principal e movidos para listeners em JavaScript.

A politica CSP nao permite mais script inline:

```text
script-src 'self' https://cdnjs.cloudflare.com
script-src-attr 'none'
```

Ainda existe `unsafe-inline` em `style-src` porque o HTML possui estilos inline e estilos em pagina. A proxima etapa de endurecimento e mover esses estilos para `public/style.css`.

## Caminho correto para usuarios no futuro

Se a empresa quiser usuarios, permissoes e logs persistidos em banco, a boa pratica sera criar um banco MySQL/MariaDB separado para a aplicacao, por exemplo:

```text
ourobras_app
```

Nesse desenho:

- Banco ERP: somente leitura, usado apenas para consultas operacionais.
- Banco APP: usuarios, permissoes, logs, preferencias e configuracoes da aplicacao.

Essa separacao evita risco de impacto no ERP e mantem a governanca dos dados mais clara.

## Teste local com XAMPP

Para testar com XAMPP, use MySQL/MariaDB pelo phpMyAdmin:

```text
http://localhost/phpmyadmin
```

Execute o script abaixo no phpMyAdmin:

```text
db/migrations/001_app_mysql_usuarios.sql
```

Depois, configure o `.env` local:

```env
APP_DB_ENABLED=true
APP_DB_HOST=127.0.0.1
APP_DB_PORT=3306
APP_DB_NAME=ourobras_app
APP_DB_USER=root
APP_DB_PASSWORD=
```

Instale o driver MySQL da API:

```bash
npm install mysql2
```

Reinicie a API:

```bash
npm start
```

Enquanto nao houver usuario cadastrado no MySQL, o admin do `.env` continua funcionando como contingencia.

## Permissoes previstas

As permissoes por aba ficam centralizadas no catalogo:

```text
src/config/modules.js
```

Cada modulo define:

- `chave`: permissao gravada no usuario.
- `label`: nome exibido na tela Admin.
- `aba`: id logico usado no front-end.
- `botaoId`: botao da navegacao.
- `ordem`: ordem visual/operacional.

Catalogo atual:

- `admin`
- `estoque`
- `vendas`
- `auditoria`
- `consultas_erp`
- `marketing`

Enquanto nao existir um banco APP separado, essas permissoes podem continuar vindo do `.env` ou de uma configuracao externa propria da aplicacao.

Para criar uma nova aba no futuro, adicione o modulo em `src/config/modules.js` e proteja a rota correspondente no backend. A tela Admin passara a exibir o novo checkbox automaticamente.
