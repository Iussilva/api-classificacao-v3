const express = require('express');
const path = require('path');
const env = require('./config/env');
const applySecurity = require('./middlewares/security');
const auth = require('./middlewares/auth');
const db = require('./db/firebird');
const appDb = require('./db/app-mysql');
const cache = require('./services/cache');
const createUsersService = require('./services/users');
const createAuditLogService = require('./services/audit-log');
const createSharedRoutes = require('./routes/shared.routes');
const createAdminRoutes = require('./routes/admin.routes');
const createEstoqueRoutes = require('./routes/estoque.routes');
const createVendasRoutes = require('./routes/vendas.routes');
const createMarketingRoutes = require('./routes/marketing.routes');
const createAuditoriaRoutes = require('./routes/auditoria.routes');
const createConsultasErpRoutes = require('./routes/consultas-erp.routes');
const iaService = require('./services/ia');
const createIaRoutes = require('./routes/ia.routes');

const app = express();
const PORT = env.port;
const fbOptions = db.fbOptions;
const fbOptionsManaus = db.fbOptionsManaus;
const normalizarOrigem = db.normalizarOrigem;
const query = db.query;
const comCache = cache.comCache;
const limparCache = cache.limparCache;
const usersService = appDb.enabled ? createUsersService({ query: appDb.query }) : null;
const auditLog = appDb.enabled ? createAuditLogService({ query: appDb.query }) : null;

if (usersService) {
  auth.setUsersService(usersService);
}

if (auditLog) {
  auth.setAuditLogService(auditLog);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
applySecurity(app);

// ── Arquivos estáticos do front-end ─────────────────────────
const publicPath = path.join(__dirname, '..', 'public');

// Serve TODOS os arquivos diretamente da pasta public
app.use(express.static(publicPath));

// Página principal
app.get('/', function (req, res) {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.post('/api/auth/login', auth.login);
app.post('/api/auth/logout', auth.logout);
app.get('/api/auth/session', auth.autenticar, auth.session);

// ════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO — JWT obrigatório em /api/
// ════════════════════════════════════════════════════════════
app.use(auth.autenticar);

function protegerPrefixos(permissoesAceitas, prefixos) {
  var middleware = auth.exigirPermissao.apply(auth, permissoesAceitas);

  return function (req, res, next) {
    var caminho = req.path;
    var deveProteger = prefixos.some(function (prefixo) {
      return caminho === prefixo || caminho.indexOf(prefixo + '/') === 0;
    });

    if (!deveProteger) return next();
    return middleware(req, res, next);
  };
}

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DO BANCO FIREBIRD
// ════════════════════════════════════════════════════════════════

// Configuracao Firebird movida para src/db/firebird.js

// Sistema de cache movido para src/services/cache.js

var FABRICANTES_FIXOS = [
  'SG METAIS LTDA',
  'MANTOVANI JOIAS LTDA.',
  'ELLOS GOLD INDUSTRIA E COMERCIO LTDA',
  'OUROBRAS COMERCIO DE JOIAS LTDA - CP'
];

// Monta cláusula IN com os fabricantes fixos (sem parâmetros — nomes fixos)
var FABRICANTES_IN = FABRICANTES_FIXOS.map(function (n) {
  return "'" + n.replace(/'/g, "''") + "'";
}).join(', ');

/**
 * Monta filtro SQL para fabricante e loja a partir dos query params.
 * Garante que TODOS os endpoints usem a mesma lógica.
 *
 * @param {object} req - request Express
 * @returns {{ lojaFiltro, fabFiltro, cacheKey }} strings SQL e chave de cache
 */
function montarFiltrosSP(req) {
  var interno_est = req.query.interno_est ? parseInt(req.query.interno_est) : null;
  var fabParam = req.query.fabricante || null;
  var teor = req.query.teor || null;

  // Filtro de loja
  var lojaFiltro = interno_est ? ' AND PE.INTERNO_EST = ' + interno_est : '';

  // Filtro de fabricante — aceita INTERNO numérico ou nome
  var fabFiltro = '';
  if (fabParam) {
    if (!isNaN(fabParam)) {
      fabFiltro = ' AND CF.INTERNO = ' + parseInt(fabParam);
    } else {
      fabFiltro = " AND TRIM(CF.NOME) = '" + fabParam.replace(/'/g, "''") + "'";
    }
  }

  // Filtro de teor (busca no nome do produto)
  var teorFiltro = teor
    ? " AND UPPER(P.NOME) CONTAINING UPPER('" + teor.replace(/'/g, "''") + "')"
    : '';

  var cacheKey = (interno_est || 'T') + ':' + (fabParam || 'T') + ':' + (teor || 'T');

  return { lojaFiltro: lojaFiltro, fabFiltro: fabFiltro, teorFiltro: teorFiltro, cacheKey: cacheKey };
}

/**
 * Retorna a data de hoje no formato MM/DD/YYYY (exigido pela SP_POSICAO_ESTOQUE_MOD3)
 */
function dataHoje() {
  var hoje = new Date();
  return String(hoje.getMonth() + 1).padStart(2, '0') + '/' +
    String(hoje.getDate()).padStart(2, '0') + '/' +
    hoje.getFullYear();
}


function dataHojeISO() {
  var hoje = new Date();
  return hoje.getFullYear() + '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
    String(hoje.getDate()).padStart(2, '0');
}

// ════════════════════════════════════════════════════════════════
// ENDPOINTS
// ════════════════════════════════════════════════════════════════

// ── PING ─────────────────────────────────────────────────────

// ── ESTABELECIMENTOS ──────────────────────────────────────────

// ── FABRICANTES ───────────────────────────────────────────────
// Retorna apenas os fabricantes fixos configurados nesta API

// ── ESTOQUE — VITRINE ─────────────────────────────────────────
// Retorna saldo da vitrine (tipo 2) dos fabricantes fixos
// Loja obrigatória para performance

// ── RESUMO POR FABRICANTE ─────────────────────────────────────
// Agrupa saldo total por fabricante (apenas os 3 fixos)

// ── RESUMO POR LOJA ───────────────────────────────────────────
// Agrupa saldo total por estabelecimento (apenas os 3 fabricantes fixos)

// ── FABRICANTE × LOJA (cruzamento) ───────────────────────────

// ── RANKING DOS 3 FABRICANTES ────────────────────────────────

// ════════════════════════════════════════════════════════════════
// MAPA DE COORDENADORES — internos das lojas por responsável
// ════════════════════════════════════════════════════════════════

var COORDENADORES = {
  'Bruno': [5, 8, 9, 17, 18],          // Natal, João Pessoa, Fortaleza, Recife, Maceió
  'Gabriel': [12, 19, 20, 4, 3, 15],      // São Luís/Tropical, São Luís/Centro, São Luís/Cohab, Imperatriz, Marabá, Belém
  'Raiane': [23, 1, 6, 10, 25, 16, 13]   // FSA/Getúlio, Barra, Itaigara, Aracaju, Goiânia, Feira de Santana, Avenida Sete
};
// Nota: ajuste os INTERNOs acima se algum não bater com o banco.
// Referência da imagem fornecida:
//  1=Barra, 2=CT Produção, 3=Marabá, 4=Imperatriz, 5=Natal, 6=Itaigara
//  8=João Pessoa, 9=Fortaleza, 10=Aracaju, 13=São Luís/Tropical, 15=Belém
//  16=FSA, 17=Maceió, 18=Recife, 19=São Luís/Centro, 20=São Luís/Cohab
//  23=FSA/Getúlio, 25=Goiânia, 28=Vila Conceição, 30=Vila Mariana

// Endpoint: retorna o mapa de coordenadores
if (usersService) {
  app.use('/api/admin', auth.exigirPermissao('admin'), createAdminRoutes({
    usersService: usersService,
    auditLog: auditLog
  }));
}

app.use('/api', createSharedRoutes({
  query: query,
  appDb: appDb,
  normalizarOrigem: normalizarOrigem,
  FABRICANTES_IN: FABRICANTES_IN,
  limparCache: limparCache,
  cache: cache
}));

app.use('/api', protegerPrefixos(['estoque'], ['/estoque']), createEstoqueRoutes({
  query: query,
  comCache: comCache,
  FABRICANTES_IN: FABRICANTES_IN,
  montarFiltrosSP: montarFiltrosSP,
  dataHoje: dataHoje
}));

app.use('/api', protegerPrefixos(['vendas'], ['/vendas', '/coordenadores']), createVendasRoutes({
  query: query,
  comCache: comCache,
  FABRICANTES_IN: FABRICANTES_IN,
  COORDENADORES: COORDENADORES
}));

app.use('/api', protegerPrefixos(['marketing'], ['/marketing']), createMarketingRoutes({
  query: query,
  normalizarOrigem: normalizarOrigem
}));

app.use('/api', protegerPrefixos(['auditoria'], ['/auditoria']), createAuditoriaRoutes({
  query: query,
  comCache: comCache,
  normalizarOrigem: normalizarOrigem,
  dataHojeISO: dataHojeISO
}));

app.use('/api', protegerPrefixos(['consultas_erp'], ['/consultas', '/contratos']), createConsultasErpRoutes({
  query: query,
  comCache: comCache,
  normalizarOrigem: normalizarOrigem
}));

app.use('/api', protegerPrefixos(['admin', 'estoque', 'vendas', 'auditoria', 'consultas_erp', 'marketing'], ['/ia']), createIaRoutes({
  query: query,
  comCache: comCache,
  FABRICANTES_IN: FABRICANTES_IN,
  montarFiltrosSP: montarFiltrosSP,
  dataHoje: dataHoje,
  chamarOpenAI: iaService.chamarOpenAI
}));

app.use(function (err, req, res, next) {
  if (err && err.message === 'Origem nao permitida pelo CORS.') {
    return res.status(403).json({ erro: 'Origem nao permitida.' });
  }

  console.error('[Erro nao tratado]', err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});


// ════════════════════════════════════════════════════════════════
// ENDPOINT: VENDAS — Histórico de notas de saída por período
// GET /api/vendas
// Query params:
//   data_inicio  — YYYY-MM-DD  (obrigatório)
//   data_fim     — YYYY-MM-DD  (obrigatório)
//   interno_est  — número      (opcional — filtra por loja)
//   fabricante   — nome/interno (opcional)
//   coordenador  — Bruno|Gabriel|Raiane (opcional)
// ════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
// MARKETING — CLIENTES NOVOS
// Rotas novas e isoladas. Não alteram os endpoints já existentes.
// ════════════════════════════════════════════════════════════════


// Lista os tipos de grupo disponíveis para preencher o filtro da tela.

// Consulta clientes cadastrados por período, loja, tipo de grupo, CPF e CNPJ.

// ════════════════════════════════════════════════════════════════
// MÓDULO: INTELIGÊNCIA ARTIFICIAL — Groq (llama-3.3-70b)
// Funcionalidades:
//  1. Chat flutuante — conversa livre sobre o sistema
//  2. Resumo automático — interpreta dados do estoque ao consultar
//  3. Análise de estoque por linguagem natural
//  4. Análise de contratos de compra
// ════════════════════════════════════════════════════════════════


// ── 1. CHAT FLUTUANTE ─────────────────────────────────────────
// Busca dados REAIS do banco e inclui como contexto para a IA
// POST /api/ia/chat
// Body: { mensagens: [{ role, content }], filtros: { interno_est, fabricante } }
// ── 2. RESUMO AUTOMÁTICO DO ESTOQUE ──────────────────────────
// Recebe os dados já consultados e gera um resumo em linguagem natural
// POST /api/ia/resumo-estoque
// Body: { fabricantes, lojas, ranking, filtros }


// ── 3. ANÁLISE POR LINGUAGEM NATURAL ─────────────────────────
// Usuário faz uma pergunta e a IA busca os dados e responde
// POST /api/ia/analisar-estoque
// Body: { pergunta: "Qual loja tem mais aliancas?" }



// ════════════════════════════════════════════════════════════════
// CONSULTAS ERP — CONTRATOS 120 / 003 E VENDAS VITRINE
// Uma linha retornada por item; o front agrupa pelo INTERNO do pedido.
// ════════════════════════════════════════════════════════════════



// ── AUDITORIA — ESTOQUE POR GRADE / CÓDIGO DE BARRAS ─────────

// ── INICIA O SERVIDOR ─────────────────────────────────────────

// ════════════════════════════════════════════════════════════════
// NOVO CONTRATO ERP — FASE 1 (SOMENTE LEITURA E VALIDAÇÃO)
// Nenhum endpoint abaixo executa INSERT, UPDATE, DELETE ou GEN_ID.
// ════════════════════════════════════════════════════════════════


module.exports = {
  app: app,
  PORT: PORT,
  fbOptions: fbOptions,
  fbOptionsManaus: fbOptionsManaus,
  FABRICANTES_FIXOS: FABRICANTES_FIXOS
};
