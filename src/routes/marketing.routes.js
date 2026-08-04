const express = require('express');

module.exports = function createMarketingRoutes(ctx) {
  const router = express.Router();
  const { query, normalizarOrigem } = ctx;

function validarDataISO(data) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(data || ''));
}

function dataISOParaFirebird(data) {
  var partes = String(data).split('-');
  return partes[1] + '/' + partes[2] + '/' + partes[0];
}

router.get('/marketing/grupos', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var rows = await query(
      'SELECT G.INTERNO, TRIM(G.NOME) AS NOME' +
      ' FROM GRUPOS_DE_CLIENTES G' +
      ' WHERE G.INTERNO > 0' +
      ' AND G.NOME IS NOT NULL' +
      ' ORDER BY G.NOME',
      [],
      origem
    );

    res.json({ grupos: rows, origem: origem });
  } catch (err) {
    console.error('[Marketing/Grupos]', err);
    res.status(500).json({ erro: 'Erro ao consultar os grupos de clientes.' });
  }
});

router.get('/marketing/clientes-novos', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var dataInicio = req.query.data_inicio;
    var dataFim = req.query.data_fim;
    var internoEst = req.query.interno_est ? parseInt(req.query.interno_est, 10) : null;
    var grupo = String(req.query.grupo || '').trim();
    var tipoDocumento = String(req.query.tipo_documento || '').toLowerCase().trim();

    if (!validarDataISO(dataInicio) || !validarDataISO(dataFim)) {
      return res.status(400).json({ erro: 'Informe data_inicio e data_fim no formato YYYY-MM-DD.' });
    }
    if (dataInicio > dataFim) {
      return res.status(400).json({ erro: 'A data inicial não pode ser maior que a data final.' });
    }
    if (req.query.interno_est && (!Number.isInteger(internoEst) || internoEst <= 0)) {
      return res.status(400).json({ erro: 'Código da loja inválido.' });
    }

    var filtros = '';
    var params = [dataISOParaFirebird(dataInicio), dataISOParaFirebird(dataFim)];

    if (internoEst) {
      filtros += ' AND CE.INTERNO_EST = ?';
      params.push(internoEst);
    }
    if (grupo) {
      filtros += ' AND UPPER(TRIM(G.NOME)) = UPPER(TRIM(?))';
      params.push(grupo);
    }
    if (tipoDocumento === 'cpf') {
      filtros += " AND COALESCE(TRIM(CF.CPF), '') <> ''" +
                 " AND COALESCE(TRIM(CF.CNPJ), '') = ''";
    } else if (tipoDocumento === 'cnpj') {
      filtros += " AND COALESCE(TRIM(CF.CNPJ), '') <> ''" +
                 " AND COALESCE(TRIM(CF.CPF), '') = ''";
    } else if (tipoDocumento !== '') {
      return res.status(400).json({ erro: 'Tipo de documento inválido. Use cpf, cnpj ou deixe vazio para todos.' });
    }

    var sql =
      'SELECT' +
      ' CF.INTERNO AS INTERNO_CLIENTE,' +
      ' CF.CODIGO AS CODIGO_CLIENTE,' +
      ' TRIM(CF.NOME) AS NOME_CLIENTE,' +
      ' TRIM(CF.CPF) AS CPF,' +
      ' TRIM(CF.CNPJ) AS CNPJ,' +
      " CASE" +
      "   WHEN COALESCE(TRIM(CF.CPF), '') <> '' AND COALESCE(TRIM(CF.CNPJ), '') = '' THEN 'CPF'" +
      "   WHEN COALESCE(TRIM(CF.CNPJ), '') <> '' AND COALESCE(TRIM(CF.CPF), '') = '' THEN 'CNPJ'" +
      "   WHEN COALESCE(TRIM(CF.CPF), '') <> '' AND COALESCE(TRIM(CF.CNPJ), '') <> '' THEN 'CPF E CNPJ'" +
      "   ELSE 'SEM DOCUMENTO'" +
      " END AS TIPO_DOCUMENTO," +
      ' CAST(CF.DATA_CADASTRAMENTO AS DATE) AS DATA_CADASTRO,' +
      ' CE.INTERNO_EST AS CODIGO_LOJA,' +
      ' COALESCE(TRIM(E.FANTASIA), TRIM(E.NOME)) AS NOME_LOJA,' +
      ' TRIM(G.NOME) AS GRUPO_CLIENTE' +
      ' FROM CLIENTE_FORNECEDOR CF' +
      ' INNER JOIN CLIENTE_ESTABELECIMENTO CE ON CE.INTERNO_CLIENTE = CF.INTERNO' +
      ' INNER JOIN ESTABELECIMENTO E ON E.INTERNO = CE.INTERNO_EST' +
      ' LEFT JOIN CLIENTE_GRUPO GC ON GC.INTERNO_CLIENTE = CF.INTERNO' +
      ' LEFT JOIN GRUPOS_DE_CLIENTES G ON G.INTERNO = GC.INTERNO_GRUPO' +
      " WHERE CF.TIPO IN ('Todos', 'Cliente', 'Cliente/Fornecedor')" +
      " AND CF.ATIVO = 'Ativo'" +
      ' AND CF.DATA_CADASTRAMENTO >= CAST(? AS DATE)' +
      ' AND CF.DATA_CADASTRAMENTO < DATEADD(1 DAY TO CAST(? AS DATE))' +
      filtros +
      ' ORDER BY CF.DATA_CADASTRAMENTO DESC, CF.NOME, G.NOME';

    var rows = await query(sql, params, origem);
    var mapa = {};

    rows.forEach(function (r) {
      var chave = String(r.INTERNO_CLIENTE) + ':' + String(r.CODIGO_LOJA);
      if (!mapa[chave]) {
        mapa[chave] = {
          INTERNO_CLIENTE: r.INTERNO_CLIENTE,
          CODIGO_CLIENTE: r.CODIGO_CLIENTE,
          NOME_CLIENTE: r.NOME_CLIENTE,
          CPF: r.CPF || null,
          CNPJ: r.CNPJ || null,
          TIPO_DOCUMENTO: r.TIPO_DOCUMENTO || null,
          DATA_CADASTRO: r.DATA_CADASTRO,
          CODIGO_LOJA: r.CODIGO_LOJA,
          NOME_LOJA: r.NOME_LOJA,
          GRUPOS: []
        };
      }
      if (r.GRUPO_CLIENTE && mapa[chave].GRUPOS.indexOf(r.GRUPO_CLIENTE) < 0) {
        mapa[chave].GRUPOS.push(r.GRUPO_CLIENTE);
      }
    });

    var clientes = Object.keys(mapa).map(function (chave) {
      var item = mapa[chave];
      item.GRUPO_CLIENTE = item.GRUPOS.length ? item.GRUPOS.join(', ') : null;
      delete item.GRUPOS;
      return item;
    });

    var comGrupo = clientes.filter(function (c) { return !!c.GRUPO_CLIENTE; }).length;
    var lojas = {};
    clientes.forEach(function (c) { lojas[c.CODIGO_LOJA] = true; });

    res.json({
      clientes: clientes,
      total_clientes: clientes.length,
      total_com_grupo: comGrupo,
      total_sem_grupo: clientes.length - comGrupo,
      total_lojas: Object.keys(lojas).length,
      data_inicio: dataInicio,
      data_fim: dataFim,
      origem: origem,
      tipo_documento: tipoDocumento || 'todos'
    });
  } catch (err) {
    console.error('[Marketing/Clientes Novos]', err);
    res.status(500).json({ erro: 'Erro ao consultar clientes novos.' });
  }
});

  return router;
};
