const express = require('express');

module.exports = function createIaRoutes(ctx) {
  const router = express.Router();
  const { query, comCache, FABRICANTES_IN, montarFiltrosSP, dataHoje, chamarOpenAI } = ctx;

router.post('/ia/chat', async function (req, res) {
  try {
    var mensagens = req.body.mensagens || [];
    var filtros = req.body.filtros || {};
    if (!mensagens.length) {
      return res.status(400).json({ erro: 'Nenhuma mensagem enviada.' });
    }

    // ── Busca dados reais do Firebird ─────────────────────────
    var dataRef = dataHoje();
    var f = montarFiltrosSP({ query: filtros });

    // Query resumida por fabricante × loja
    var sqlResumo =
      'SELECT' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  COALESCE(TRIM(EST.FANTASIA), TRIM(EST.NOME)) AS LOJA,' +
      '  PE.INTERNO_EST AS COD_LOJA,' +
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
      f.fabFiltro + f.lojaFiltro +
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' GROUP BY CF.NOME, EST.FANTASIA, EST.NOME, PE.INTERNO_EST' +
      ' ORDER BY CF.NOME, SALDO_TOTAL DESC';

    var cacheKey = 'chat_ctx:' + dataRef + ':' + (filtros.interno_est || 'T') + ':' + (filtros.fabricante || 'T');
    var dadosReais = await comCache(cacheKey, async function () {
      return await query(sqlResumo, []);
    });

    // ── Monta contexto com dados reais ────────────────────────
    var totalGeral = dadosReais.reduce(function (s, r) { return s + (parseFloat(r.SALDO_TOTAL) || 0); }, 0);

    // Agrupa por fabricante
    var porFab = {};
    var porLoja = {};
    dadosReais.forEach(function (r) {
      var fab = (r.FABRICANTE || '—').trim();
      var loja = (r.LOJA || 'Loja ' + r.COD_LOJA).trim();
      var s = parseFloat(r.SALDO_TOTAL) || 0;
      if (!porFab[fab]) porFab[fab] = { saldo: 0, lojas: [] };
      if (!porLoja[loja]) porLoja[loja] = { saldo: 0, fabricantes: [] };
      porFab[fab].saldo += s;
      porFab[fab].lojas.push(loja + ': ' + s.toFixed(3) + 'g');
      porLoja[loja].saldo += s;
      porLoja[loja].fabricantes.push(fab + ': ' + s.toFixed(3) + 'g');
    });

    var linhasFab = Object.entries(porFab)
      .sort(function (a, b) { return b[1].saldo - a[1].saldo; })
      .map(function (e) {
        return '\u2022 ' + e[0] + ': ' + e[1].saldo.toFixed(3) + 'g | ' + e[1].lojas.join(' | ');
      }).join('\n');

    var linhasLoja = Object.entries(porLoja)
      .sort(function (a, b) { return b[1].saldo - a[1].saldo; })
      .map(function (e) {
        return '• ' + e[0] + ': ' + e[1].saldo.toFixed(3) + 'g (' + e[1].fabricantes.join(' | ') + ')';
      }).join('\n');

    var contexto = [
      '=== ESTOQUE REAL — ' + dataRef + ' ===',
      'Total geral: ' + totalGeral.toFixed(3) + 'g',
      'Fabricantes: ELLOS GOLD | SG METAIS | MANTOVANI JOIAS',
      '',
      '--- POR FABRICANTE ---',
      linhasFab || 'Sem dados',
      '',
      '--- POR LOJA ---',
      linhasLoja || 'Sem dados',
      '',
      'IMPORTANTE: Use APENAS esses dados reais. NAO invente valores.',
    ].join('\n');

    // Injeta contexto como primeira mensagem do sistema
    var mensagensComContexto = [
      { role: 'user', content: contexto },
      { role: 'assistant', content: 'Entendido. Tenho os dados reais do estoque da Ourobras. Pode perguntar!' }
    ].concat(mensagens);

    var resposta = await chamarOpenAI(mensagensComContexto, 800);
    res.json({ resposta: resposta });

  } catch (err) {
    if (err.message === 'OPENAI_KEY_MISSING') {
      return res.status(200).json({
        resposta: '⚠️ Chave não configurada. Adicione OPENAI_API_KEY no .env com sua chave do Groq (gsk_...)'
      });
    }
    res.status(500).json({ erro: 'Erro interno no servidor.' });;
  }
});

router.post('/ia/resumo-estoque', async function (req, res) {
  try {
    var dados = req.body;
    var filtros = dados.filtros || {};

    // Monta contexto dos dados para a IA
    var contexto = [];

    contexto.push('=== DADOS DO ESTOQUE ATUAL ===');

    if (filtros.loja) contexto.push('Filtro ativo: Loja ' + filtros.loja);
    if (filtros.fabricante) contexto.push('Filtro ativo: Fabricante ' + filtros.fabricante);
    if (filtros.dataRef) contexto.push('Data de referência: ' + filtros.dataRef);

    if (dados.fabricantes && dados.fabricantes.length) {
      contexto.push('\n--- POR FABRICANTE ---');
      dados.fabricantes.forEach(function (f) {
        contexto.push(
          (f.FABRICANTE || '—') + ': ' +
          parseFloat(f.SALDO_TOTAL).toFixed(3) + 'g | ' +
          f.QTD_PRODUTOS + ' produtos'
        );
      });
    }

    if (dados.lojas && dados.lojas.length) {
      contexto.push('\n--- POR LOJA ---');
      dados.lojas.forEach(function (l) {
        contexto.push(
          (l.NOME_LOJA || 'Loja ' + l.ESTABELECIMENTO) + ': ' +
          parseFloat(l.SALDO_TOTAL).toFixed(3) + 'g | ' +
          l.QTD_PRODUTOS + ' produtos'
        );
      });
    }

    if (dados.ranking && dados.ranking.length) {
      contexto.push('\n--- RANKING FABRICANTES ---');
      dados.ranking.forEach(function (r, i) {
        contexto.push(
          (i + 1) + 'º ' + (r.FABRICANTE || '—') + ': ' +
          parseFloat(r.SALDO_TOTAL).toFixed(3) + 'g'
        );
      });
    }

    var prompt = [
      'Com base nos dados abaixo, gere um resumo executivo do estoque.',
      'Destaque: total em estoque, distribuição entre fabricantes, loja com mais estoque,',
      'e qualquer insight relevante para a gestão.',
      '',
      contexto.join('\n'),
    ].join('\n');

    var resposta = await chamarOpenAI([{ role: 'user', content: prompt }], 600);
    res.json({ resumo: resposta });
  } catch (err) {
    if (err.message === 'OPENAI_KEY_MISSING') return res.status(200).json({ resumo: '⚠️ Chave da OpenAI não configurada no .env' });
    res.status(500).json({ erro: 'Erro interno no servidor.' });;
  }
});

router.post('/ia/analisar-estoque', async function (req, res) {
  try {
    var pergunta = req.body.pergunta;
    if (!pergunta) return res.status(400).json({ erro: 'Pergunta não informada.' });

    // Busca dados atuais do banco para dar contexto à IA
    var dataRef = dataHoje();
    var sql =
      'SELECT' +
      '  TRIM(CF.NOME) AS FABRICANTE,' +
      '  COALESCE(TRIM(EST.FANTASIA), TRIM(EST.NOME)) AS LOJA,' +
      '  PE.INTERNO_EST AS COD_LOJA,' +
      '  TRIM(P.NOME) AS PRODUTO,' +
      '  P.CODIGO,' +
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
      ' AND COALESCE(POS.SALDO_FINAL_PROPRIO, 0) <> 0' +
      ' ORDER BY CF.NOME, EST.NOME, P.NOME';

    var cacheKey = 'ia_estoque_completo:' + dataRef;
    var dados = await comCache(cacheKey, async function () {
      return await query(sql, []);
    });

    // Resume os dados para não estourar o contexto
    var resumoFab = {};
    var resumoLoja = {};
    var resumoProd = {};

    dados.forEach(function (r) {
      var fab = r.FABRICANTE || '—';
      var loja = r.LOJA || 'Loja ' + r.COD_LOJA;
      var prod = r.PRODUTO || '—';
      var s = parseFloat(r.SALDO) || 0;

      if (!resumoFab[fab]) resumoFab[fab] = 0;
      if (!resumoLoja[loja]) resumoLoja[loja] = 0;
      if (!resumoProd[prod]) resumoProd[prod] = { saldo: 0, fab: fab };

      resumoFab[fab] += s;
      resumoLoja[loja] += s;
      resumoProd[prod].saldo += s;
    });

    // Top 20 produtos por saldo
    var topProd = Object.entries(resumoProd)
      .sort(function (a, b) { return b[1].saldo - a[1].saldo; })
      .slice(0, 20)
      .map(function (e) { return e[0] + ' (' + e[1].fab + '): ' + e[1].saldo.toFixed(3) + 'g'; });

    var contextoIA = [
      '=== ESTOQUE ATUAL DA VITRINE — ' + dataRef + ' ===',
      '',
      '--- TOTAL POR FABRICANTE ---',
      Object.entries(resumoFab).map(function (e) { return e[0] + ': ' + e[1].toFixed(3) + 'g'; }).join('\n'),
      '',
      '--- TOTAL POR LOJA ---',
      Object.entries(resumoLoja).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) { return e[0] + ': ' + e[1].toFixed(3) + 'g'; }).join('\n'),
      '',
      '--- TOP 20 PRODUTOS POR SALDO ---',
      topProd.join('\n'),
    ].join('\n');

    var mensagens = [
      { role: 'user', content: contextoIA + '\n\n=== PERGUNTA ===\n' + pergunta }
    ];

    var resposta = await chamarOpenAI(mensagens, 800);
    res.json({ resposta: resposta, dados_consultados: dados.length });

  } catch (err) {
    if (err.message === 'OPENAI_KEY_MISSING') return res.status(200).json({ resposta: '⚠️ Chave da OpenAI não configurada no .env' });
    res.status(500).json({ erro: 'Erro interno no servidor.' });;
  }
});

router.post('/ia/analisar-contratos', async function (req, res) {
  try {
    var contratos = req.body.contratos || [];
    var pergunta = req.body.pergunta || 'Faça uma análise geral dos contratos.';

    if (!contratos.length) {
      return res.status(400).json({ erro: 'Nenhum contrato enviado para análise.' });
    }

    // Sumariza os contratos para a IA
    var totalValor = contratos.reduce(function (s, c) { return s + (parseFloat(c.VALOR_TOTAL) || 0); }, 0);
    var porSituacao = {};
    contratos.forEach(function (c) {
      var sit = c.SITUACAO_CONTRATO || 'ATV';
      porSituacao[sit] = (porSituacao[sit] || 0) + 1;
    });

    var lista = contratos.slice(0, 30).map(function (c) {
      return '  • Pedido ' + c.NUMERO_PEDIDO +
        ' | Contrato ' + (c.CONTRATO || '—') +
        ' | Cliente: ' + (c.NOME_CLIENTE || '—') +
        ' | Valor: R$ ' + parseFloat(c.VALOR_TOTAL || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
        ' | Situação: ' + (c.SITUACAO_CONTRATO || 'ATV') +
        ' | Data: ' + (c.DATA_EMISSAO || '—');
    }).join('\n');

    var contexto = [
      '=== CONTRATOS DE COMPRA ===',
      'Total de contratos: ' + contratos.length,
      'Valor total: R$ ' + totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      'Por situação: ' + Object.entries(porSituacao).map(function (e) { return e[0] + ': ' + e[1]; }).join(', '),
      '',
      '--- LISTA DE CONTRATOS ---',
      lista,
      contratos.length > 30 ? '  ... e mais ' + (contratos.length - 30) + ' contratos.' : '',
    ].join('\n');

    var resposta = await chamarOpenAI([
      { role: 'user', content: contexto + '\n\n=== PERGUNTA ===\n' + pergunta }
    ], 800);

    res.json({ resposta: resposta });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno no servidor.' });;
  }
});

  return router;
};
