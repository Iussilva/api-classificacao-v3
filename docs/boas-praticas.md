# Boas Praticas de Desenvolvimento

Este guia define como evoluir o projeto com previsibilidade, seguranca e menos risco de quebrar consultas existentes.

## Principios

- Toda regra sensivel fica no backend, nunca no `public/script.js`.
- Toda rota que retorna dados corporativos exige JWT.
- Toda entrada externa deve ser validada antes de chegar ao SQL.
- Toda query nova deve usar parametros `?` quando o valor vier do usuario.
- Toda renderizacao com dados da API deve escapar HTML ou usar `textContent`.
- Mudancas grandes devem ser feitas em etapas pequenas e testaveis.

## Checklist Antes de Criar uma Rota

- Definir se a rota e publica ou autenticada.
- Validar todos os parametros de `req.query`, `req.body` e `req.params`.
- Usar `normalizarOrigem()` para selecionar banco quando houver origem.
- Usar `query(sql, params, origem)` com parametros.
- Definir chave de cache apenas quando a consulta for pesada e idempotente.
- Retornar JSON consistente.
- Logar erro no servidor sem expor detalhes internos ao cliente.

## Padrao Recomendado de Rota

```js
app.get('/api/exemplo', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var internoEst = parseInt(req.query.interno_est, 10);

    if (!Number.isInteger(internoEst) || internoEst <= 0) {
      return res.status(400).json({ erro: 'Loja invalida.' });
    }

    var sql =
      'SELECT FIRST 25 CAMPO1, CAMPO2' +
      ' FROM TABELA' +
      ' WHERE INTERNO_EST = ?' +
      ' ORDER BY CAMPO1';

    var rows = await query(sql, [internoEst], origem);
    res.json({ dados: rows, meta: { origem: origem, total: rows.length } });
  } catch (err) {
    console.error('[api/exemplo]', err);
    res.status(500).json({ erro: 'Erro interno ao consultar dados.' });
  }
});
```

## Seguranca

### CORS

Estado atual: existe whitelist, mas a origem bloqueada ainda e permitida por um retorno temporario.

Padrao desejado:

```js
if (allowedOrigins.includes(origin)) {
  return callback(null, true);
}

return callback(new Error('Origem nao permitida pelo CORS.'));
```

### JWT

Estado atual: token no `localStorage`.

Aceitavel para curto prazo, desde que XSS seja tratado. Melhor pratica futura: cookie `HttpOnly`, `Secure` e `SameSite`.

### CSP

Estado atual: `unsafe-inline` em scripts/atributos/estilos.

Evolucao recomendada:

- Remover handlers inline do HTML.
- Mover scripts inline para arquivos `.js`.
- Usar nonce/hash para scripts inevitaveis.
- Trocar `innerHTML` por `textContent`/DOM API quando possivel.

### SQL

Evite:

```js
" WHERE CAMPO = '" + valorUsuario + "'"
```

Prefira:

```js
' WHERE CAMPO = ?'
```

com:

```js
query(sql, [valorUsuario], origem)
```

Listas fixas de constantes podem ser interpoladas se forem controladas pelo codigo, como status conhecidos.

## Front-end

### Renderizacao Segura

Para texto:

```js
el.textContent = valor;
```

Para tabela:

```js
var tr = document.createElement('tr');
var td = document.createElement('td');
td.textContent = r.NOME || '';
tr.appendChild(td);
```

Se precisar montar HTML string, use `escapeHtml()` em todo dado vindo de API, banco ou usuario.

### Token

O front pode conhecer rotas e montar filtros. Ele nao pode conter:

- Senhas.
- Chaves de API.
- `JWT_SECRET`.
- Credenciais Firebird.
- Regras de autorizacao sensiveis.

## Dependencias

Rotina recomendada:

```powershell
npm.cmd audit --omit=dev
npm.cmd outdated
```

Para corrigir vulnerabilidades compativeis:

```powershell
npm.cmd audit fix
```

Depois testar login e principais consultas.

## Testes Manuais Minimos

Antes de publicar:

- Acessar `/api/estoque` sem token e confirmar `Token de autenticacao ausente`.
- Fazer login com senha invalida e confirmar bloqueio.
- Fazer login correto e consultar estoque.
- Consultar vendas com periodo curto.
- Consultar auditoria com e sem valores.
- Trocar origem Matriz/Manaus quando aplicavel.
- Abrir F12 > Network e confirmar que chamadas usam `Authorization`.
- Testar uma origem nao autorizada apos corrigir CORS.

## Roadmap Tecnico Recomendado

1. Corrigir CORS.
2. Rodar `npm audit fix` e testar.
3. Remover fallback `masterkey`.
4. Parar de retornar `detalhe: err.message` em producao.
5. Escapar renderizacoes com `innerHTML`.
6. Parametrizar consultas restantes que usam valores do usuario.
7. Separar `server.js` em modulos: `config`, `db`, `middlewares`, `routes`.
8. Migrar JWT para cookie `HttpOnly` se o ambiente permitir.

