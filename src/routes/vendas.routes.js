const express = require('express');

module.exports = function createVendasRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, COORDENADORES } = ctx;

  router.get('/coordenadores', function (req, res) {
    res.json({ coordenadores: COORDENADORES });
  });

  router.get('/vendas', async function (req, res) {
    try {
      var dataInicio = req.query.data_inicio;
      var dataFim = req.query.data_fim;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          erro: 'Parâmetros data_inicio e data_fim são obrigatórios (YYYY-MM-DD).'
        });
      }

      function somarDiasIso(d, dias) {
        var dt = new Date(d + 'T00:00:00');
        dt.setDate(dt.getDate() + dias);
        return dt.toISOString().slice(0, 10);
      }

      var di = dataInicio;
      var dfExclusivo = somarDiasIso(dataFim, 1);

      var filtrosSql = '';
      var coordenador = req.query.coordenador || null;
      var internoEst = req.query.interno_est ? parseInt(req.query.interno_est, 10) : null;
      var fabParam = req.query.fabricante || null;

      if (internoEst) {
        filtrosSql += ' AND e.INTERNO = ' + internoEst;
      } else if (coordenador && COORDENADORES[coordenador]) {
        filtrosSql += ' AND e.INTERNO IN (' + COORDENADORES[coordenador].join(', ') + ')';
      }

      if (fabParam) {
        if (!isNaN(fabParam)) {
          filtrosSql += ' AND cf_forn.INTERNO = ' + parseInt(fabParam, 10);
        } else {
          filtrosSql += " AND TRIM(cf_forn.NOME) = '" + fabParam.replace(/'/g, "''") + "'";
        }
      }

      var sql =
        'SELECT' +
        '  cdn.NOTA_NUMERO,' +
        '  cdn.TOTAL_PRODUTOS_DESC,' +
        '  cdn.DATA_EMISSAO,' +
        '  cdn.DATA_ESTOQUE,' +
        '  TRIM(cf_cliente.NOME) AS CLIENTE,' +
        '  TRIM(cf_forn.NOME) AS FABRICANTE,' +
        '  e.INTERNO AS COD_LOJA,' +
        '  TRIM(e.NOME) AS ESTABELECIMENTO,' +
        '  s.INTERNO AS COD_STATUS,' +
        '  TRIM(s.NOME) AS STATUS,' +
        '  l.QUANTIDADE,' +
        '  TRIM(p.NOME) AS PRODUTO' +
        ' FROM CABECALHO_DE_NOTA cdn' +
        ' JOIN CLIENTE_FORNECEDOR cf_cliente' +
        '   ON cf_cliente.INTERNO = cdn.INTERNO_CLIENTE' +
        ' JOIN ESTABELECIMENTO e' +
        '   ON e.INTERNO = cdn.INTERNO_EST' +
        ' JOIN STATUS s' +
        '   ON s.INTERNO = cdn.INTERNO_STATUS' +
        ' JOIN LANCAMENTO l' +
        '   ON l.INTERNO_CABECALHO = cdn.INTERNO' +
        ' JOIN PRODUTO_ESTABELECIMENTO pe' +
        '   ON pe.INTERNO = l.INTERNO_PRODUTO_EST' +
        ' JOIN PRODUTO p' +
        '   ON p.INTERNO = pe.INTERNO_PRODUTO' +
        ' LEFT JOIN CLIENTE_FORNECEDOR cf_forn' +
        '   ON cf_forn.INTERNO = p.INTERNO_FABRICANTE' +
        " WHERE cdn.CANCELADO = 'Não'" +
        ' AND cdn.INTERNO_LOCAL = 2' +
        ' AND cdn.INTERNO_STATUS IN (23, 30)' +
        " AND cdn.DATA_EMISSAO >= DATE '" + di + "'" +
        " AND cdn.DATA_EMISSAO < DATE '" + dfExclusivo + "'" +
        filtrosSql +
        ' ORDER BY cdn.DATA_EMISSAO DESC, cdn.NOTA_NUMERO DESC';

      var cacheKey =
        'vendas:v2:' +
        dataInicio +
        ':' +
        dataFim +
        ':' +
        (internoEst || coordenador || 'T') +
        ':' +
        (fabParam || 'T');

      var rows = await comCache(cacheKey, async function () {
        return await query(sql, []);
      });

      var notasUnicas = {};
      var prodQtd = {};
      var prodFab = {};

      rows.forEach(function (r) {
        notasUnicas[String(r.NOTA_NUMERO)] = true;

        var k = r.PRODUTO || '—';
        var q = parseFloat(r.QUANTIDADE) || 0;

        prodQtd[k] = (prodQtd[k] || 0) + q;
        prodFab[k] = r.FABRICANTE || '—';
      });

      var topProdutos = Object.entries(prodQtd)
        .map(function (e) {
          return {
            produto: e[0],
            quantidade: e[1],
            fabricante: prodFab[e[0]]
          };
        })
        .sort(function (a, b) {
          return b.quantidade - a.quantidade;
        })
        .slice(0, 20);

      var fabTotais = {};

      rows.forEach(function (r) {
        var f = r.FABRICANTE || '—';

        fabTotais[f] =
          (fabTotais[f] || 0) +
          (parseFloat(r.QUANTIDADE) || 0);
      });

      var porFabricante = Object.entries(fabTotais)
        .map(function (e) {
          return {
            fabricante: e[0],
            quantidade: e[1]
          };
        })
        .sort(function (a, b) {
          return b.quantidade - a.quantidade;
        });

      var lojaTotais = {};
      var lojaNomes = {};

      rows.forEach(function (r) {
        var cod = r.COD_LOJA;

        lojaTotais[cod] =
          (lojaTotais[cod] || 0) +
          (parseFloat(r.QUANTIDADE) || 0);

        lojaNomes[cod] =
          r.ESTABELECIMENTO || 'Loja ' + cod;
      });

      var porLoja = Object.entries(lojaTotais)
        .map(function (e) {
          return {
            cod_loja: parseInt(e[0], 10),
            nome_loja: lojaNomes[e[0]],
            quantidade: e[1]
          };
        })
        .sort(function (a, b) {
          return b.quantidade - a.quantidade;
        });

      res.json({
        vendas: rows,
        total_itens: rows.length,
        total_notas: Object.keys(notasUnicas).length,
        top_produtos: topProdutos,
        por_fabricante: porFabricante,
        por_loja: porLoja,
        data_inicio: dataInicio,
        data_fim: dataFim
      });
    } catch (err) {
      console.error('[ERRO /vendas]', err);

      res.status(500).json({
        erro: 'Erro interno no servidor.'
      });
    }
  });

  return router;
};