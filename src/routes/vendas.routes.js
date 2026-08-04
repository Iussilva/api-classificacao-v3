const express = require('express');

module.exports = function createVendasRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, FABRICANTES_IN, COORDENADORES } = ctx;

  router.get('/coordenadores', function (req, res) {
    res.json({ coordenadores: COORDENADORES });
  });

  router.get('/vendas', async function (req, res) {
    try {
      var dataInicio = req.query.data_inicio;
      var dataFim = req.query.data_fim;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({ erro: 'Parâmetros data_inicio e data_fim são obrigatórios (YYYY-MM-DD).' });
      }

      // Converte YYYY-MM-DD → MM/DD/YYYY (formato Firebird)
      function fmtFB(d) {
        var p = d.split('-');
        return p[1] + '/' + p[2] + '/' + p[0];
      }
      var di = fmtFB(dataInicio);
      var df = fmtFB(dataFim);

      // Filtro de loja — pode vir de interno_est ou de coordenador
      var lojaFiltro = '';
      var coordenador = req.query.coordenador || null;
      var interno_est = req.query.interno_est ? parseInt(req.query.interno_est) : null;

      if (coordenador && COORDENADORES[coordenador]) {
        var ids = COORDENADORES[coordenador].join(', ');
        lojaFiltro = ' AND e.INTERNO IN (' + ids + ')';
      } else if (interno_est) {
        lojaFiltro = ' AND e.INTERNO = ' + interno_est;
      }

      // Filtro de fabricante
      var fabParam = req.query.fabricante || null;
      var fabFiltro = '';
      if (fabParam) {
        if (!isNaN(fabParam)) {
          fabFiltro = ' AND cf_forn.INTERNO = ' + parseInt(fabParam);
        } else {
          fabFiltro = " AND TRIM(cf_forn.NOME) = '" + fabParam.replace(/'/g, "''") + "'";
        }
      } else {
        // Padrão: apenas os fabricantes fixos
        fabFiltro = ' AND TRIM(cf_forn.NOME) IN (' + FABRICANTES_IN + ')';
      }

      var sql =
        'SELECT' +
        '  cdn.NOTA_NUMERO,' +
        '  cdn.TOTAL_PRODUTOS_DESC,' +
        '  cdn.DATA_EMISSAO,' +
        '  TRIM(cf_cliente.NOME) AS CLIENTE,' +
        '  TRIM(cf_forn.NOME)    AS FABRICANTE,' +
        '  e.INTERNO             AS COD_LOJA,' +
        '  TRIM(e.NOME)          AS ESTABELECIMENTO,' +
        '  TRIM(mdn.NOME)        AS MODELO,' +
        '  l.QUANTIDADE,' +
        '  TRIM(p.NOME)          AS PRODUTO' +
        ' FROM CABECALHO_DE_NOTA cdn' +
        ' JOIN CLIENTE_FORNECEDOR cf_cliente ON cf_cliente.INTERNO = cdn.INTERNO_CLIENTE' +
        ' JOIN ESTABELECIMENTO e             ON e.INTERNO = cdn.INTERNO_EST' +
        ' JOIN MODELO_DE_NOTA mdn            ON mdn.INTERNO = cdn.INTERNO_MODELO' +
        ' JOIN LANCAMENTO l                  ON l.INTERNO_CABECALHO = cdn.INTERNO' +
        ' JOIN PRODUTO_ESTABELECIMENTO pe    ON pe.INTERNO = l.INTERNO_PRODUTO_EST' +
        ' JOIN PRODUTO p                     ON p.INTERNO = pe.INTERNO_PRODUTO' +
        ' LEFT JOIN CLIENTE_FORNECEDOR cf_forn ON cf_forn.INTERNO = p.INTERNO_FABRICANTE' +
        " WHERE cdn.CANCELADO = 'Não'" +
        ' AND cdn.INTERNO_LOCAL = 2' +
        ' AND mdn.INTERNO IN (25, 26)' +
        " AND cdn.DATA_EMISSAO >= CAST('" + di + "' AS DATE)" +
        " AND cdn.DATA_EMISSAO <= CAST('" + df + "' AS DATE)" +
        lojaFiltro +
        fabFiltro +
        ' ORDER BY cdn.DATA_EMISSAO DESC';

      var cacheKey = 'vendas:' + dataInicio + ':' + dataFim + ':' + (interno_est || coordenador || 'T') + ':' + (fabParam || 'T');

      var rows = await comCache(cacheKey, async function () {
        return await query(sql, []);
      });

      // ── Agregações server-side ────────────────────────────────

      // Top produtos por quantidade
      var prodQtd = {};
      var prodFab = {};
      rows.forEach(function (r) {
        var k = r.PRODUTO || '—';
        var q = parseFloat(r.QUANTIDADE) || 0;
        prodQtd[k] = (prodQtd[k] || 0) + q;
        prodFab[k] = r.FABRICANTE || '—';
      });

      var topProdutos = Object.entries(prodQtd)
        .map(function (e) { return { produto: e[0], quantidade: e[1], fabricante: prodFab[e[0]] }; })
        .sort(function (a, b) { return b.quantidade - a.quantidade; })
        .slice(0, 20);

      // Total por fabricante
      var fabTotais = {};
      rows.forEach(function (r) {
        var f = r.FABRICANTE || '—';
        fabTotais[f] = (fabTotais[f] || 0) + (parseFloat(r.QUANTIDADE) || 0);
      });
      var porFabricante = Object.entries(fabTotais)
        .map(function (e) { return { fabricante: e[0], quantidade: e[1] }; })
        .sort(function (a, b) { return b.quantidade - a.quantidade; });

      // Total por loja
      var lojaTotais = {};
      var lojaNomes = {};
      rows.forEach(function (r) {
        var cod = r.COD_LOJA;
        lojaTotais[cod] = (lojaTotais[cod] || 0) + (parseFloat(r.QUANTIDADE) || 0);
        lojaNomes[cod] = r.ESTABELECIMENTO || 'Loja ' + cod;
      });
      var porLoja = Object.entries(lojaTotais)
        .map(function (e) { return { cod_loja: parseInt(e[0]), nome_loja: lojaNomes[e[0]], quantidade: e[1] }; })
        .sort(function (a, b) { return b.quantidade - a.quantidade; });

      res.json({
        vendas: rows,
        total_itens: rows.length,
        top_produtos: topProdutos,
        por_fabricante: porFabricante,
        por_loja: porLoja,
        data_inicio: dataInicio,
        data_fim: dataFim,
      });

    } catch (err) { res.status(500).json({ erro: 'Erro interno no servidor.' });; }
  });

  return router;
};
