const express = require('express');

module.exports = function createEstoqueRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, FABRICANTES_IN, montarFiltrosSP, dataHoje } = ctx;

router.get('/estoque', async function (req, res) {
  try {
    // Loja obrigatória APENAS quando nenhum fabricante específico está selecionado
    // Com fabricante selecionado, pode consultar todas as lojas
    if (!req.query.interno_est && !req.query.fabricante) {
      return res.status(400).json({
        erro: 'Selecione uma loja ou um fabricante para consultar.',
        codigo: 'FILTRO_OBRIGATORIO'
      });
    }

    var interno_est = req.query.interno_est ? parseInt(req.query.interno_est) : null;
    var dataRef = dataHoje();

    // Filtro opcional por fabricante — aceita INTERNO (número) ou NOME (texto)
    var fabParam = req.query.fabricante || null;
    var fabFiltro = '';
    if (fabParam) {
      if (!isNaN(fabParam)) {
        // Recebeu o código numérico (INTERNO) — filtro por ID
        fabFiltro = ' AND CF.INTERNO = ' + parseInt(fabParam);
      } else {
        // Recebeu nome — filtro por nome exato
        fabFiltro = " AND TRIM(CF.NOME) = '" + fabParam.replace(/'/g, "''") + "'";
      }
    }

    // Filtro opcional por teor (ex: 10K, 18K)
    var f = montarFiltrosSP(req);
    var dataRef = dataHoje();

    var sql =
      'SELECT' +
      '  P.CODIGO,' +
      '  TRIM(P.NOME) AS NOME,' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  PE.INTERNO_EST AS ESTABELECIMENTO,' +
      '  COALESCE(TRIM(EST.FANTASIA), TRIM(EST.NOME)) AS NOME_ESTABELECIMENTO,' +
      '  COALESCE(POS.SALDO_FINAL_PROPRIO, 0) AS SALDO' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' INNER JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = P.INTERNO_FABRICANTE' +
      ' LEFT JOIN ESTABELECIMENTO EST ON EST.INTERNO = PE.INTERNO_EST' +
      ' LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(' +
      '   2, PE.INTERNO, NULL,' +
      "   '" + dataRef + "', '" + dataRef + "', 'Não'" +
      ' ) POS ON 0 = 0' +
      " WHERE P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      f.fabFiltro + f.lojaFiltro + f.teorFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' ORDER BY CF.NOME, P.NOME';

    var cacheKey = 'estoque:' + f.cacheKey;
    var todos = await comCache(cacheKey, async function () { return await query(sql, []); });
    var pagina = parseInt(req.query.pagina) || 1;
    var limite = parseInt(req.query.limite) || 9999;
    var total_itens = todos.length;
    var total_saldo = todos.reduce(function (s, r) { return s + (parseFloat(r.SALDO) || 0); }, 0);
    var inicio = (pagina - 1) * limite;
    var rows = todos.slice(inicio, inicio + limite);

    res.json({
      estoque: rows,
      pagina: pagina,
      paginas: Math.ceil(total_itens / limite),
      limite: limite,
      total_itens: total_itens,
      total_saldo: total_saldo,
      data_ref: dataRef,
    });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

router.get('/estoque/por-fabricante', async function (req, res) {
  try {
    var f = montarFiltrosSP(req);
    var dataRef = dataHoje();

    var sql =
      'SELECT' +
      '  CF.INTERNO AS INTERNO_FABRICANTE,' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  COUNT(DISTINCT P.INTERNO) AS QTD_PRODUTOS,' +
      '  SUM(COALESCE(POS.SALDO_FINAL_PROPRIO, 0)) AS SALDO_TOTAL' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' INNER JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = P.INTERNO_FABRICANTE' +
      ' LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(' +
      '   2, PE.INTERNO, NULL,' +
      "   '" + dataRef + "', '" + dataRef + "', 'Não'" +
      ' ) POS ON 0 = 0' +
      " WHERE P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      f.fabFiltro +
      f.lojaFiltro +
      f.teorFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' GROUP BY CF.INTERNO, CF.NOME' +
      ' ORDER BY SALDO_TOTAL DESC';

    var cacheKey = 'fab:' + f.cacheKey;
    var rows = await comCache(cacheKey, async function () { return await query(sql, []); });
    var total = rows.reduce(function (s, r) { return s + (parseFloat(r.SALDO_TOTAL) || 0); }, 0);

    res.json({ fabricantes: rows, total_saldo: total, data_ref: dataRef });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

router.get('/estoque/por-loja', async function (req, res) {
  try {
    var f = montarFiltrosSP(req);
    var dataRef = dataHoje();

    var sql =
      'SELECT' +
      '  PE.INTERNO_EST AS ESTABELECIMENTO,' +
      '  COALESCE(TRIM(EST.FANTASIA), TRIM(EST.NOME)) AS NOME_LOJA,' +
      '  COUNT(DISTINCT P.INTERNO) AS QTD_PRODUTOS,' +
      '  SUM(COALESCE(POS.SALDO_FINAL_PROPRIO, 0)) AS SALDO_TOTAL' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' INNER JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = P.INTERNO_FABRICANTE' +
      ' LEFT JOIN ESTABELECIMENTO EST ON EST.INTERNO = PE.INTERNO_EST' +
      ' LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(' +
      '   2, PE.INTERNO, NULL,' +
      "   '" + dataRef + "', '" + dataRef + "', 'Não'" +
      ' ) POS ON 0 = 0' +
      " WHERE P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      f.fabFiltro +
      f.lojaFiltro +
      f.teorFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' GROUP BY PE.INTERNO_EST, EST.FANTASIA, EST.NOME' +
      ' ORDER BY SALDO_TOTAL DESC';

    var cacheKey = 'loja:' + f.cacheKey;
    var rows = await comCache(cacheKey, async function () { return await query(sql, []); });
    var total = rows.reduce(function (s, r) { return s + (parseFloat(r.SALDO_TOTAL) || 0); }, 0);

    res.json({ lojas: rows, total_saldo: total, data_ref: dataRef });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

router.get('/estoque/fabricante-por-loja', async function (req, res) {
  try {
    var interno_est = req.query.interno_est ? parseInt(req.query.interno_est) : null;
    var dataRef = dataHoje();

    var lojaFiltro = interno_est ? ' AND PE.INTERNO_EST = ' + interno_est : '';

    var sql =
      'SELECT' +
      '  CF.INTERNO AS INTERNO_FABRICANTE,' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  PE.INTERNO_EST AS ESTABELECIMENTO,' +
      '  COALESCE(TRIM(EST.FANTASIA), TRIM(EST.NOME)) AS NOME_LOJA,' +
      '  COUNT(DISTINCT P.INTERNO) AS QTD_PRODUTOS,' +
      '  SUM(COALESCE(POS.SALDO_FINAL_PROPRIO, 0)) AS SALDO_TOTAL' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' INNER JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = P.INTERNO_FABRICANTE' +
      ' LEFT JOIN ESTABELECIMENTO EST ON EST.INTERNO = PE.INTERNO_EST' +
      ' LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(' +
      '   2, PE.INTERNO, NULL,' +
      "   '" + dataRef + "', '" + dataRef + "', 'Não'" +
      ' ) POS ON 0 = 0' +
      " WHERE P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      lojaFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' GROUP BY CF.INTERNO, CF.NOME, PE.INTERNO_EST, EST.FANTASIA, EST.NOME' +
      ' ORDER BY CF.NOME, SALDO_TOTAL DESC';

    var rows = await query(sql, []);
    res.json({ dados: rows, data_ref: dataRef });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

router.get('/estoque/ranking', async function (req, res) {
  try {
    var f = montarFiltrosSP(req);
    var dataRef = dataHoje();

    var sql =
      'SELECT' +
      '  CF.INTERNO,' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  COUNT(DISTINCT P.INTERNO) AS QTD_PRODUTOS,' +
      '  COUNT(DISTINCT PE.INTERNO_EST) AS QTD_LOJAS,' +
      '  SUM(COALESCE(POS.SALDO_FINAL_PROPRIO, 0)) AS SALDO_TOTAL' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' INNER JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = P.INTERNO_FABRICANTE' +
      ' LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(' +
      '   2, PE.INTERNO, NULL,' +
      "   '" + dataRef + "', '" + dataRef + "', 'Não'" +
      ' ) POS ON 0 = 0' +
      " WHERE P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND TRIM(CF.NOME) IN (' + FABRICANTES_IN + ')' +
      f.fabFiltro +
      f.lojaFiltro +
      f.teorFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' GROUP BY CF.INTERNO, CF.NOME' +
      ' ORDER BY SALDO_TOTAL DESC';

    var cacheKey = 'rank:' + f.cacheKey;
    var rows = await comCache(cacheKey, async function () { return await query(sql, []); });
    var total = rows.reduce(function (s, r) { return s + (parseFloat(r.SALDO_TOTAL) || 0); }, 0);

    res.json({ ranking: rows, total_geral: total, data_ref: dataRef });
  } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
});

  return router;
};
