const express = require('express');

module.exports = function createSharedRoutes(ctx) {
  const router = express.Router();
  const { query, appDb, normalizarOrigem, FABRICANTES_IN, limparCache, cache } = ctx;

router.post('/cache/limpar', function (req, res) {
  limparCache();
  res.json({ ok: true, mensagem: 'Cache limpo com sucesso.' });
});

router.get('/cache/status', function (req, res) {
  res.json(cache.statusCache());
});

router.get('/ping', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    await query('SELECT 1 FROM RDB$DATABASE', [], origem);
    res.json({ status: 'ok', servico: 'Classificacao', origem: origem, hora: new Date().toLocaleTimeString('pt-BR') });
  } catch (err) {
    // Temporário para debugar o erro de conexão:
    console.error('[Ping] DETALHES DO ERRO FIREBIRD:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao conectar com o banco de dados.' });
  }
});

router.get('/status/bancos', async function (req, res) {
  var origem = normalizarOrigem(req.query.origem);
  var status = {
    status: 'ok',
    hora: new Date().toLocaleTimeString('pt-BR'),
    bancos: {
      erp: {
        nome: 'ERP Firebird',
        origem: origem,
        status: 'offline'
      },
      app: {
        nome: 'App MySQL',
        status: appDb && appDb.enabled ? 'offline' : 'desativado'
      }
    }
  };

  try {
    await query('SELECT 1 FROM RDB$DATABASE', [], origem);
    status.bancos.erp.status = 'online';
  } catch (err) {
    console.error('[Status] ERP Firebird offline:', err.message);
  }

  if (appDb && appDb.enabled) {
    try {
      await appDb.query('SELECT 1 AS ok', []);
      status.bancos.app.status = 'online';
    } catch (err) {
      console.error('[Status] App MySQL offline:', err.message);
    }
  }

  if (status.bancos.erp.status !== 'online' || status.bancos.app.status === 'offline') {
    status.status = 'parcial';
  }

  res.json(status);
});

router.get('/estabelecimentos', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var rows = await query(
      'SELECT INTERNO,' +
      '  TRIM(NOME) AS NOME,' +
      '  COALESCE(TRIM(FANTASIA), TRIM(NOME)) AS FANTASIA' +
      ' FROM ESTABELECIMENTO' +
      ' WHERE INTERNO > 0' +
      ' ORDER BY INTERNO',
      [],
      origem
    );
    res.json({ estabelecimentos: rows, origem: origem });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

router.get('/fabricantes', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var sql =
      'SELECT DISTINCT CF.INTERNO, TRIM(CF.NOME) AS NOME' +
      ' FROM CLIENTE_FORNECEDOR CF' +
      ' WHERE TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      ' ORDER BY CF.NOME';
    var rows = await query(sql, [], origem);
    res.json({ fabricantes: rows, origem: origem });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});


  return router;
};
