const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.FB_HOST = process.env.FB_HOST || 'localhost';
process.env.FB_DATABASE = process.env.FB_DATABASE || 'C:\\fake\\GERAIS.FDB';
process.env.FB_USER = process.env.FB_USER || 'SYSDBA';
process.env.FB_PASSWORD = process.env.FB_PASSWORD || 'masterkey';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'admin';
process.env.ADMIN_PASS_HASH = bcrypt.hashSync('senha-segura', 8);
process.env.ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3003';
process.env.ADMIN_PERMISSIONS = 'admin,estoque,vendas,auditoria,consultas_erp,marketing';

const auth = require('../src/middlewares/auth');

function criarAppTeste() {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/login', auth.login);
  app.post('/api/auth/logout', auth.logout);
  app.get('/api/auth/session', auth.autenticar, auth.session);
  app.use(auth.autenticar);
  app.get('/api/estoque-teste', auth.exigirPermissao('estoque'), function (req, res) {
    res.json({ ok: true, area: 'estoque' });
  });
  app.get('/api/vendas-teste', auth.exigirPermissao('vendas'), function (req, res) {
    res.json({ ok: true, area: 'vendas' });
  });
  return app;
}

function assinar(permissoes) {
  return jwt.sign({
    usuario: 'teste',
    perfil: permissoes.includes('admin') ? 'admin' : 'usuario',
    permissoes: permissoes
  }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function requisitar(app, metodo, caminho, opcoes) {
  opcoes = opcoes || {};

  return new Promise(function (resolve, reject) {
    const server = app.listen(0, function () {
      const port = server.address().port;
      const body = opcoes.body ? JSON.stringify(opcoes.body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: caminho,
        method: metodo,
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Content-Length': body ? Buffer.byteLength(body) : 0
        }, opcoes.headers || {})
      }, function (res) {
        var chunks = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) { chunks += chunk; });
        res.on('end', function () {
          server.close(function () {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: chunks ? JSON.parse(chunks) : null
            });
          });
        });
      });

      req.on('error', function (err) {
        server.close(function () { reject(err); });
      });

      if (body) req.write(body);
      req.end();
    });
  });
}

test('bloqueia rota protegida sem token', async function () {
  const res = await requisitar(criarAppTeste(), 'GET', '/api/estoque-teste');
  assert.equal(res.status, 401);
});

test('permite acesso por permissao especifica da aba', async function () {
  const token = assinar(['estoque']);
  const res = await requisitar(criarAppTeste(), 'GET', '/api/estoque-teste', {
    headers: { Authorization: 'Bearer ' + token }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.area, 'estoque');
});

test('bloqueia usuario sem permissao da aba', async function () {
  const token = assinar(['estoque']);
  const res = await requisitar(criarAppTeste(), 'GET', '/api/vendas-teste', {
    headers: { Authorization: 'Bearer ' + token }
  });

  assert.equal(res.status, 403);
});

test('admin acessa qualquer aba protegida', async function () {
  const token = assinar(['admin']);
  const res = await requisitar(criarAppTeste(), 'GET', '/api/vendas-teste', {
    headers: { Authorization: 'Bearer ' + token }
  });

  assert.equal(res.status, 200);
});

test('login cria cookie HttpOnly e nao devolve token no corpo', async function () {
  const res = await requisitar(criarAppTeste(), 'POST', '/api/auth/login', {
    body: { usuario: 'admin', senha: 'senha-segura' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.autenticado, true);
  assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'token'), false);
  assert.match(String(res.headers['set-cookie']), /HttpOnly/);
});

test('sessao aceita token via cookie HttpOnly', async function () {
  const token = assinar(['estoque']);
  const res = await requisitar(criarAppTeste(), 'GET', '/api/auth/session', {
    headers: { Cookie: 'ourobras_token=' + encodeURIComponent(token) }
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.permissoes, ['estoque']);
});
