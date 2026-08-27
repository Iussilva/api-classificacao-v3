const express = require('express');

module.exports = function createConsultasErpRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, normalizarOrigem } = ctx;

function validarDataISOConsulta(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function dataISOParaFirebird(valor) {
  var p = String(valor).split('-');
  return p[1] + '/' + p[2] + '/' + p[0];
}

var TIPOS_CONSULTA_ERP = {
  matriz: {
    contrato_120: {
      nome: 'Contratos 120 dias',
      status: [29, 68, 69, 70, 80, 81, 82, 87, 89, 90, 91, 94, 99, 100, 106, 107, 123, 124, 125]
    },
    contrato_003: {
      nome: 'Contratos 003 dias',
      status: [28, 65, 66, 67, 77, 78, 79, 85, 88, 92, 93, 95, 97, 98, 103, 104, 120, 121, 122]
    },
    contrato_relogio_120: {
      nome: 'Contrato Relógio 120 dias',
      status: [182, 186, 187, 188, 192, 193, 194, 196, 197, 198, 201, 205, 206, 209, 210, 214, 215, 216]
    },
    contrato_relogio_003: {
      nome: 'Contrato Relógio 003 dias',
      status: [217, 183, 184, 185, 189, 190, 191, 195, 199, 200, 202, 203, 204, 207, 208, 211, 212, 213]
    },
    contrato_upgrade: {
      nome: 'Contrato Upgrade',
      status: [235, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234]
    },
    vendas_vitrine: {
      nome: 'Vendas Vitrine',
      status: [23, 30, 160]
    }
  },

  manaus: {
    contrato_120: {
      nome: 'Contratos 120 dias',
      status: [31, 32, 33, 43]
    },
    contrato_003: {
      nome: 'Contratos 003 dias',
      status: [28, 29, 30, 42]
    },
    vendas_vitrine: {
      nome: 'Vendas Vitrine',
      status: [41, 73, 74]
    }
  }
};

// Ouromarket utiliza a mesma tabela de modalidades/status da Matriz.
TIPOS_CONSULTA_ERP.ouromarket = TIPOS_CONSULTA_ERP.matriz;

router.get('/consultas/movimentacoes-v3', async function (req, res) {
  try {
    var tipo = String(req.query.tipo || '').trim();
    var origem = normalizarOrigem(req.query.origem);
    var configOrigem = TIPOS_CONSULTA_ERP[origem] || {};
    var config = configOrigem[tipo];

    if (!config) {
      var nomesTipos = {
        contrato_120: 'Contratos 120 dias',
        contrato_003: 'Contratos 003 dias',
        contrato_relogio_120: 'Contrato Relógio 120 dias',
        contrato_relogio_003: 'Contrato Relógio 003 dias',
        contrato_upgrade: 'Contrato Upgrade',
        vendas_vitrine: 'Vendas Vitrine'
      };

      if (origem === 'manaus' && nomesTipos[tipo]) {
        return res.json({
          tipo: tipo,
          descricao: nomesTipos[tipo],
          origem: origem,
          registros: [],
          aviso: 'Esta modalidade não possui status cadastrado no banco Manaus.'
        });
      }

      return res.status(400).json({ erro: 'Tipo de consulta inválido.' });
    }

    var dataInicio = req.query.data_inicio;
    var dataFim = req.query.data_fim;
    if (!validarDataISOConsulta(dataInicio) || !validarDataISOConsulta(dataFim)) {
      return res.status(400).json({ erro: 'Informe data_inicio e data_fim no formato YYYY-MM-DD.' });
    }
    if (dataInicio > dataFim) {
      return res.status(400).json({ erro: 'A data inicial não pode ser maior que a data final.' });
    }

    var internoEst = parseInt(req.query.interno_est, 10);
    if (!Number.isInteger(internoEst) || internoEst <= 0) {
      return res.status(400).json({ erro: 'Selecione uma loja válida.' });
    }


    // O estabelecimento é filtrado separadamente por CDN.INTERNO_EST.
    // Usamos a lista completa de status da modalidade para evitar dependência
    // de um pareamento manual status x loja e manter compatibilidade com retroativos.
    var statusSelecionados = Array.isArray(config.status) ? config.status : [];
    if (!statusSelecionados.length) {
      return res.json({
        tipo: tipo,
        descricao: config.nome,
        origem: origem,
        interno_est: internoEst,
        data_inicio: dataInicio,
        data_fim: dataFim,
        registros: [],
        aviso: 'Não existem códigos de status configurados para esta modalidade.'
      });
    }

    var statusSql = statusSelecionados.join(', ');
    var sql =
      'SELECT' +
      ' CDN.TIPO AS TIPO,' +
      ' CDN.NOTA_NUMERO AS NOTA_NUMERO,' +
      ' CDN.NOTA_ESPECIE AS NOTA_ESPECIE,' +
      ' CDN.NOTA_SERIE AS NOTA_SERIE,' +
      ' CDN.INTERNO AS INTERNO_PEDIDO,' +
      ' TRIM(CAST(CDN.PEDIDO_CLIENTE AS VARCHAR(30))) AS PEDIDO_CLIENTE,' +
      ' CASE' +
      "   WHEN TRIM(COALESCE(CAST(CDN.PEDIDO_CLIENTE AS VARCHAR(30)), '')) <> ''" +
      '   THEN TRIM(CAST(CDN.PEDIDO_CLIENTE AS VARCHAR(30)))' +
      '   ELSE CAST(CDN.INTERNO AS VARCHAR(30))' +
      ' END AS NUMERO_CONTRATO,' +
      ' CF.CODIGO AS CODIGO_CLIENTE_FORNECEDOR,' +
      ' TRIM(CF.NOME) AS NOME_CLIENTE_FORNECEDOR,' +
      ' P.CODIGO AS CODIGO_PRODUTO,' +
      ' TRIM(P.NOME) AS PRODUTO,' +
      ' L.ITEM AS ITEM_NUMERO,' +
      (['contrato_120', 'contrato_003', 'contrato_upgrade'].includes(tipo)
        ? ' CASE' +
          '   WHEN COALESCE(PEG.INTERNO_GRADE, 0) = 0 THEN L.QUANTIDADE' +
          '   ELSE PEG.PESO_LIQUIDO' +
          ' END AS QUANTIDADE,'
        : ' L.QUANTIDADE AS QUANTIDADE,') +
      ' COALESCE(L.VALOR, 0) AS ITEM_VALOR_UNITARIO,' +
      ' COALESCE(L.VALOR_TOTAL, 0) AS ITEM_VALOR_TOTAL,' +
      ' CDN.DATA_PEDIDO AS DATA_PEDIDO,' +
      ' CDN.DATA_ESTOQUE AS DATA_ESTOQUE,' +
      ' CDN.CANCELADO AS CANCELADO,' +
      ' S.INTERNO AS CODIGO_STATUS,' +
      ' TRIM(S.NOME) AS STATUS,' +
      ' COALESCE(CDN.TOTAL_PRODUTOS, 0) AS TOTAL_BRUTO,' +
      ' COALESCE(CDN.DESCONTO_PERC, 0) AS DESCONTO_PERC,' +
      ' COALESCE(CDN.DESCONTO_VALOR, 0) AS DESCONTO_VALOR,' +
      (tipo === 'vendas_vitrine'
        ? ' (COALESCE(CDN.TOTAL_PRODUTOS, 0) - COALESCE(CDN.DESCONTO_VALOR, 0)) AS TOTAL_LIQUIDO,'
        : ' COALESCE(CDN.TOTAL_NOTA, 0) AS TOTAL_LIQUIDO,') +
      ' CDN.DATA_EMISSAO AS DATA_EMISSAO' +
      ' FROM CABECALHO_DE_NOTA CDN' +
      ' INNER JOIN STATUS S ON S.INTERNO = CDN.INTERNO_STATUS' +
      ' LEFT JOIN CLIENTE_FORNECEDOR CF ON CF.INTERNO = CDN.INTERNO_CLIENTE' +
      ' LEFT JOIN LANCAMENTO L ON L.INTERNO_CABECALHO = CDN.INTERNO' +
      ' LEFT JOIN PRODUTO_ESTABELECIMENTO PE ON PE.INTERNO = L.INTERNO_PRODUTO_EST' +
      ' LEFT JOIN PRODUTO_EST_GRADE PEG ON PEG.INTERNO = L.INTERNO_PRODUTO_EST_GRADE' +
      ' LEFT JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      " WHERE CDN.DATA_ESTOQUE BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)" +
      ' AND CDN.INTERNO_EST = ?' +
      ' AND CDN.INTERNO_STATUS IN (' + statusSql + ')' +
      " AND COALESCE(CDN.CANCELADO, 'Não') <> 'Sim'" +
      ' ORDER BY CDN.DATA_ESTOQUE DESC, CDN.NOTA_NUMERO, P.NOME';

    var params = [dataISOParaFirebird(dataInicio), dataISOParaFirebird(dataFim), internoEst];
    var cacheKey = 'consulta-erp:v3-desconto:' + origem + ':' + tipo + ':' + internoEst + ':' + dataInicio + ':' + dataFim;
    var rows = await comCache(cacheKey, async function () {
      return await query(sql, params, origem);
    });

    res.json({
      tipo: tipo,
      descricao: config.nome,
      origem: origem,
      interno_est: internoEst,
      data_inicio: dataInicio,
      data_fim: dataFim,
      versao: 'consultas-erp-v3-desconto',
      status_consultados: statusSelecionados,
      registros: rows
    });
  } catch (err) {
    console.error('[Consultas ERP]', err);
    res.status(500).json({ erro: 'Erro ao consultar movimentações no Firebird.' });
  }
});

// ── 4. ANÁLISE DE CONTRATOS ───────────────────────────────────
// Recebe dados de contratos e retorna análise
// POST /api/ia/analisar-contratos
// Body: { contratos: [...], pergunta: "..." }

function contratoInteiroPositivo(valor) {
  var n = parseInt(valor, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function contratoOrigem(req) {
  return normalizarOrigem((req.query && req.query.origem) || (req.body && req.body.origem));
}

router.get('/contratos/parametros', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var internoEst = contratoInteiroPositivo(req.query.interno_est);
    if (!internoEst) return res.status(400).json({ erro: 'Informe uma loja válida.' });

    var sql =
      'SELECT FIRST 1' +
      ' P.INTERNO_EST,' +
      ' P.VALOR_COTACAO_OURO,' +
      ' P.PERC_TOLERANCIA_COTACAO_OURO,' +
      ' P.INTERNO_PRODUTO_NOVO_CONTRATO,' +
      ' P.INTERNO_FPAG_NOVO_CONTRATO,' +
      ' P.INTERNO_FPAG_DEVOL_CONTRATO,' +
      ' P.INTERNO_STATUS_DEVOL_CONTRATO,' +
      ' P.INTERNO_TRANSPORT_CONTRATO,' +
      ' P.HABILITAR_ROTINAS_CONTRATO,' +
      ' TRIM(E.NOME) AS ESTABELECIMENTO_NOME,' +
      ' COALESCE(TRIM(E.FANTASIA_FISCAL), TRIM(E.FANTASIA), TRIM(E.NOME)) AS ESTABELECIMENTO_FANTASIA,' +
      ' E.CNPJ AS ESTABELECIMENTO_CNPJ,' +
      ' E.INSCRICAO_ESTADUAL AS ESTABELECIMENTO_IE,' +
      ' TRIM(E.ENDERECO) AS ESTABELECIMENTO_ENDERECO,' +
      ' TRIM(E.NUMERO) AS ESTABELECIMENTO_NUMERO,' +
      ' TRIM(E.COMPLEMENTO) AS ESTABELECIMENTO_COMPLEMENTO,' +
      ' TRIM(E.BAIRRO) AS ESTABELECIMENTO_BAIRRO,' +
      ' TRIM(E.CEP) AS ESTABELECIMENTO_CEP,' +
      ' TRIM(E.CIDADE) AS ESTABELECIMENTO_CIDADE,' +
      ' TRIM(E.UF) AS ESTABELECIMENTO_UF,' +
      ' E.TELEFONE AS ESTABELECIMENTO_TELEFONE,' +
      ' E.EMAIL AS ESTABELECIMENTO_EMAIL' +
      ' FROM PARAMETRO_DE_ESTABELECIMENTO P' +
      ' INNER JOIN ESTABELECIMENTO E ON E.INTERNO = P.INTERNO_EST' +
      ' WHERE P.INTERNO_EST = ?';
    var rows = await query(sql, [internoEst], origem);
    if (!rows.length) return res.status(404).json({ erro: 'Parâmetros da loja não encontrados.' });
    res.json({ origem: origem, parametros: rows[0] });
  } catch (err) {
    console.error('[Contrato parâmetros]', err);
    res.status(500).json({ erro: 'Erro ao consultar parâmetros do contrato.' });
  }
});

router.get('/contratos/tipos', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var sql =
      'SELECT S.INTERNO, TRIM(S.NOME) AS NOME' +
      ' FROM STATUS S' +
      " WHERE UPPER(S.NOME) CONTAINING 'CONTRATO'" +
      " AND (UPPER(S.NOME) CONTAINING '003' OR UPPER(S.NOME) CONTAINING '120')" +
      ' ORDER BY S.NOME';
    var rows = await query(sql, [], origem);
    res.json({ origem: origem, tipos: rows });
  } catch (err) {
    console.error('[Contrato tipos]', err);
    res.status(500).json({ erro: 'Erro ao consultar tipos de contrato.' });
  }
});

router.get('/contratos/compradores', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var internoEst = contratoInteiroPositivo(req.query.interno_est);
    if (!internoEst) return res.status(400).json({ erro: 'Informe uma loja válida.' });

    var sql =
      'SELECT DISTINCT C.INTERNO, C.CODIGO, TRIM(C.NOME) AS NOME, TRIM(C.TIPO_DO_COMISSIONADO) AS TIPO' +
      ' FROM COMISSIONADO C' +
      ' INNER JOIN COMISSIONADO_ESTABELECIMENTO CE ON CE.INTERNO_COMISSIONADO = C.INTERNO' +
      " WHERE C.ATIVO = 'Ativo'" +
      ' AND CE.INTERNO_EST = ?' +
      " AND C.TIPO_DO_COMISSIONADO IN ('Comprador', 'Gerente', 'Serviço')" +
      ' ORDER BY C.NOME';
    var rows = await query(sql, [internoEst], origem);
    res.json({ origem: origem, compradores: rows });
  } catch (err) {
    console.error('[Contrato compradores]', err);
    res.status(500).json({ erro: 'Erro ao consultar compradores.' });
  }
});

router.get('/contratos/clientes', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var internoEst = contratoInteiroPositivo(req.query.interno_est);
    var busca = String(req.query.busca || '').trim();
    if (!internoEst) return res.status(400).json({ erro: 'Informe uma loja válida.' });
    if (busca.length < 2) return res.status(400).json({ erro: 'Digite ao menos 2 caracteres para buscar o cliente.' });

    var termo = busca.toUpperCase();
    var sql =
      'SELECT FIRST 25 CF.INTERNO, CF.CODIGO, TRIM(CF.NOME) AS NOME,' +
      ' CF.CPF, CF.CNPJ, TRIM(CF.TIPO) AS TIPO,' +
      ' TRIM(CF.ENDERECO) AS ENDERECO, TRIM(CF.NUMERO) AS NUMERO,' +
      ' TRIM(CF.COMPLEMENTO) AS COMPLEMENTO, TRIM(CF.BAIRRO) AS BAIRRO,' +
      ' TRIM(CF.CIDADE) AS CIDADE, TRIM(CF.UF) AS UF, TRIM(CF.CEP) AS CEP,' +
      ' TRIM(CF.TELEFONE1) AS TELEFONE1, TRIM(CF.TELEFONE2) AS TELEFONE2,' +
      ' TRIM(CF.EMAIL_CONTATO1) AS EMAIL' +
      ' FROM CLIENTE_FORNECEDOR CF' +
      ' INNER JOIN CLIENTE_ESTABELECIMENTO CE ON CE.INTERNO_CLIENTE = CF.INTERNO' +
      " WHERE CF.ATIVO = 'Ativo'" +
      ' AND CE.INTERNO_EST = ?' +
      " AND CF.TIPO IN ('Todos','Cliente/Fornecedor','Fornecedor','Fabricante','Fab./Fornecedor','Fornecedor/Cotação')" +
      ' AND (UPPER(CF.NOME) CONTAINING ? OR UPPER(CAST(CF.CODIGO AS VARCHAR(30))) CONTAINING ?' +
      ' OR UPPER(COALESCE(CF.CPF,\'\')) CONTAINING ? OR UPPER(COALESCE(CF.CNPJ,\'\')) CONTAINING ?)' +
      ' ORDER BY CF.NOME';
    var rows = await query(sql, [internoEst, termo, termo, termo, termo], origem);
    res.json({ origem: origem, clientes: rows });
  } catch (err) {
    console.error('[Contrato clientes]', err);
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
});

router.get('/contratos/produtos', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var internoEst = contratoInteiroPositivo(req.query.interno_est);
    var busca = String(req.query.busca || '').trim();
    if (!internoEst) return res.status(400).json({ erro: 'Informe uma loja válida.' });
    if (busca.length < 2) return res.status(400).json({ erro: 'Digite ao menos 2 caracteres para buscar o produto.' });

    var termo = busca.toUpperCase();
    var sql =
      'SELECT FIRST 25 PE.INTERNO AS INTERNO_PRODUTO_EST, P.INTERNO AS INTERNO_PRODUTO,' +
      ' P.CODIGO, TRIM(P.NOME) AS NOME, TRIM(P.UNIDADE) AS UNIDADE,' +
      ' P.INTERNO_GRUPO, P.INTERNO_SUBGRUPO' +
      ' FROM PRODUTO_ESTABELECIMENTO PE' +
      ' INNER JOIN PRODUTO P ON P.INTERNO = PE.INTERNO_PRODUTO' +
      ' WHERE PE.INTERNO_EST = ?' +
      " AND P.ATIVO = 'Ativo'" +
      " AND P.TIPO = 'Produto'" +
      ' AND (UPPER(P.NOME) CONTAINING ? OR UPPER(CAST(P.CODIGO AS VARCHAR(30))) CONTAINING ?)' +
      ' ORDER BY P.NOME';
    var rows = await query(sql, [internoEst, termo, termo], origem);
    res.json({ origem: origem, produtos: rows });
  } catch (err) {
    console.error('[Contrato produtos]', err);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

router.post('/contratos/validar', async function (req, res) {
  try {
    var origem = contratoOrigem(req);
    var b = req.body || {};
    var internoEst = contratoInteiroPositivo(b.interno_est);
    var clienteInterno = contratoInteiroPositivo(b.cliente_interno);
    var compradorInterno = contratoInteiroPositivo(b.comprador_interno);
    var tipoInterno = contratoInteiroPositivo(b.tipo_contrato_interno);
    var itens = Array.isArray(b.itens) ? b.itens : [];
    var erros = [];

    if (!internoEst) erros.push('Loja inválida.');
    if (!clienteInterno) erros.push('Cliente não selecionado.');
    if (!compradorInterno) erros.push('Comprador não selecionado.');
    if (!tipoInterno) erros.push('Tipo de contrato não selecionado.');
    if (!itens.length) erros.push('Inclua pelo menos um item.');
    if (erros.length) return res.status(422).json({ valido: false, erros: erros });

    var validacoes = await Promise.all([
      query("SELECT FIRST 1 CF.INTERNO, TRIM(CF.NOME) AS NOME FROM CLIENTE_FORNECEDOR CF INNER JOIN CLIENTE_ESTABELECIMENTO CE ON CE.INTERNO_CLIENTE=CF.INTERNO WHERE CF.INTERNO=? AND CE.INTERNO_EST=? AND CF.ATIVO='Ativo'", [clienteInterno, internoEst], origem),
      query("SELECT FIRST 1 C.INTERNO, TRIM(C.NOME) AS NOME FROM COMISSIONADO C INNER JOIN COMISSIONADO_ESTABELECIMENTO CE ON CE.INTERNO_COMISSIONADO=C.INTERNO WHERE C.INTERNO=? AND CE.INTERNO_EST=? AND C.ATIVO='Ativo'", [compradorInterno, internoEst], origem),
      query("SELECT FIRST 1 S.INTERNO, TRIM(S.NOME) AS NOME FROM STATUS S WHERE S.INTERNO=?", [tipoInterno], origem),
      query('SELECT FIRST 1 VALOR_COTACAO_OURO FROM PARAMETRO_DE_ESTABELECIMENTO WHERE INTERNO_EST=?', [internoEst], origem)
    ]);

    if (!validacoes[0].length) erros.push('Cliente não pertence à loja ou está inativo.');
    if (!validacoes[1].length) erros.push('Comprador não pertence à loja ou está inativo.');
    if (!validacoes[2].length) erros.push('Tipo de contrato inválido.');
    if (!validacoes[3].length) erros.push('Cotação da loja não encontrada.');

    var totalPesoBruto = 0, totalPesoLiquido = 0, totalValor = 0;
    for (var i = 0; i < itens.length; i++) {
      var item = itens[i] || {};
      var pe = contratoInteiroPositivo(item.produto_est_interno);
      var pb = Number(item.peso_bruto);
      var pl = Number(item.peso_liquido);
      var cl = parseInt(item.classificacao, 10);
      var teor = String(item.teor || '').trim().toUpperCase();
      if (!pe) erros.push('Item ' + (i + 1) + ': produto inválido.');
      if (!(pb > 0)) erros.push('Item ' + (i + 1) + ': peso bruto inválido.');
      if (!(pl > 0) || pl > pb) erros.push('Item ' + (i + 1) + ': peso líquido inválido.');
      if (!teor) erros.push('Item ' + (i + 1) + ': teor obrigatório.');
      if (!(cl >= 1 && cl <= 6)) erros.push('Item ' + (i + 1) + ': classificação deve estar entre 1 e 6.');
      var prod = pe ? await query("SELECT FIRST 1 PE.INTERNO, P.CODIGO, TRIM(P.NOME) AS NOME FROM PRODUTO_ESTABELECIMENTO PE INNER JOIN PRODUTO P ON P.INTERNO=PE.INTERNO_PRODUTO WHERE PE.INTERNO=? AND PE.INTERNO_EST=? AND P.ATIVO='Ativo'", [pe, internoEst], origem) : [];
      if (pe && !prod.length) erros.push('Item ' + (i + 1) + ': produto não pertence à loja ou está inativo.');
      totalPesoBruto += isFinite(pb) ? pb : 0;
      totalPesoLiquido += isFinite(pl) ? pl : 0;
    }

    var cotacaoBanco = validacoes[3].length ? Number(validacoes[3][0].VALOR_COTACAO_OURO) || 0 : 0;
    totalValor = totalPesoLiquido * cotacaoBanco;

    if (erros.length) return res.status(422).json({ valido: false, erros: erros });
    res.json({
      valido: true,
      mensagem: 'Contrato validado em modo de prévia. Nenhuma gravação foi realizada.',
      origem: origem,
      loja: internoEst,
      cliente: validacoes[0][0],
      comprador: validacoes[1][0],
      tipo: validacoes[2][0],
      cotacao_banco: cotacaoBanco,
      resumo: {
        quantidade_itens: itens.length,
        peso_bruto: Number(totalPesoBruto.toFixed(5)),
        peso_liquido: Number(totalPesoLiquido.toFixed(5)),
        valor_negociado: Number(totalValor.toFixed(2))
      }
    });
  } catch (err) {
    console.error('[Contrato validar]', err);
    res.status(500).json({ erro: 'Erro ao validar o contrato.' });
  }
});

  return router;
};
