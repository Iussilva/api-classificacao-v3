const express = require('express');

module.exports = function createAuditoriaRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, normalizarOrigem, dataHojeISO } = ctx;

router.get('/auditoria/estoque-grade', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var internoEst = req.query.interno_est ? parseInt(req.query.interno_est) : 1;
    var dataRef = req.query.data || dataHojeISO();

    if (!internoEst || internoEst <= 0) {
      return res.status(400).json({ erro: 'Loja inválida.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) {
      return res.status(400).json({ erro: 'Data inválida. Use YYYY-MM-DD.' });
    }

    // Quando incluir_valores=0, a API NÃO executa SP_PRECO_COMPRA2.
    // Isso deixa a auditoria mais leve quando Vl. Compra e Total não forem necessários.
    var incluirValores = String(req.query.incluir_valores || '1') !== '0';

    // Quando incluir_grade=0, a API NÃO faz JOIN com a tabela GRADE.
    // Isso deixa a consulta mais leve quando a coluna Grade não for necessária.
    var incluirGrade = String(req.query.incluir_grade || '1') !== '0';

    var campoGrade = incluirGrade
      ? "   TRIM(G.NOME) AS GRADE,"
      : "   CAST(NULL AS VARCHAR(80)) AS GRADE,";

    var joinGrade = incluirGrade
  ? " LEFT JOIN GRADE G ON G.INTERNO = PEG.INTERNO_GRADE"
  : "";

    var camposValores = incluirValores
      ? "   COALESCE(PC.PRECO_COMPRA, 0) AS VL_COMPRA," +
        "   COALESCE(EST.SALDO_FINAL_PROPRIO, 0) * COALESCE(PC.PRECO_COMPRA, 0) AS TOTAL_P"
      : "   CAST(NULL AS NUMERIC(15,2)) AS VL_COMPRA," +
        "   CAST(NULL AS NUMERIC(15,2)) AS TOTAL_P";

    var joinPrecoCompra = incluirValores
      ? " LEFT JOIN SP_PRECO_COMPRA2(" +
        "   B.INTERNO_PE," +
        "   DATE '" + dataRef + "'" +
        " ) PC ON 1 = 1"
      : "";

    var sql =
      "WITH BASE AS (" +
      " SELECT" +
      "   P.CODIGO," +
      "   PEG.REFERENCIA AS CODIGO_BARRAS," +
      "   TRIM(P.NOME) AS NOME," +
      "   P.UNIDADE," +
      "   PEG.INTERNO AS INTERNO_PRODUTO_EST_GRADE," +
      campoGrade +
      "   PE.INTERNO AS INTERNO_PE" +
      " FROM PRODUTO_ESTABELECIMENTO PE" +
      " INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO" +
      " LEFT JOIN PRODUTO_EST_GRADE PEG ON PEG.INTERNO_PRODUTO_EST = PE.INTERNO" +
      joinGrade +
      " WHERE PE.INTERNO_EST = " + internoEst +
      " AND P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ")" +
      " SELECT" +
      "   B.CODIGO," +
      "   B.CODIGO_BARRAS," +
      "   B.NOME," +
      "   B.UNIDADE," +
      "   B.INTERNO_PRODUTO_EST_GRADE," +
      "   B.GRADE," +
      "   COALESCE(EST.SALDO_FINAL_PROPRIO, 0) AS SD_ATUAL," +
      camposValores +
      " FROM BASE B" +
      " LEFT JOIN SP_POSICAO_ESTOQUE_MOD3(" +
      "   2," +
      "   NULL," +
      "   B.INTERNO_PRODUTO_EST_GRADE," +
      "   DATE '" + dataRef + "'," +
      "   DATE '" + dataRef + "'," +
      "   'Não'" +
      " ) EST ON 1 = 1" +
      joinPrecoCompra +
      " WHERE COALESCE(EST.SALDO_FINAL_PROPRIO, 0) > 0" +
      " ORDER BY B.CODIGO, B.GRADE";

    var cacheKey = 'auditoria_estoque_grade:' + origem + ':' + internoEst + ':' + dataRef + ':valores_' + (incluirValores ? '1' : '0') + ':grade_' + (incluirGrade ? '1' : '0');
    var rows = await comCache(cacheKey, async function () {
      return await query(sql, [], origem);
    });

    var totalSaldo = rows.reduce(function (s, r) { return s + (parseFloat(r.SD_ATUAL) || 0); }, 0);
    var totalValor = incluirValores
      ? rows.reduce(function (s, r) { return s + (parseFloat(r.TOTAL_P) || 0); }, 0)
      : 0;

    res.json({
      auditoria: rows,
      total_itens: rows.length,
      total_saldo: totalSaldo,
      total_valor: totalValor,
      incluir_valores: incluirValores,
      incluir_grade: incluirGrade,
      data_ref: dataRef,
      interno_est: internoEst,
      origem: origem
    });
  } catch (err) {
    console.error('[Auditoria Estoque Grade]', err.message);
    res.status(500).json({ erro: 'Erro interno ao consultar auditoria.' });
  }
});

  return router;
};
