const appModule = require('./src/app');

const app = appModule.app;
const PORT = appModule.PORT;
const fbOptions = appModule.fbOptions;
const FABRICANTES_FIXOS = appModule.FABRICANTES_FIXOS;

app.listen(PORT, '0.0.0.0', function () {
  console.log('\n💎 API de Classificacao — Ourobras');
  console.log(' Servidor rodando em http://localhost:' + PORT);
  console.log(' Banco padrão: ' + fbOptions.database);
  if (process.env.FB_MANAUS_DATABASE) console.log(' Banco Manaus: ' + process.env.FB_MANAUS_DATABASE);
  console.log(' Fabricantes monitorados:');
  FABRICANTES_FIXOS.forEach(function (f) { console.log('   • ' + f); });
  console.log('\n Endpoints disponíveis:');
  console.log('   GET /api/ping');
  console.log('   GET /api/estabelecimentos');
  console.log('   GET /api/fabricantes');
  console.log('   GET /api/estoque                  ?interno_est=1');
  console.log('   GET /api/estoque/por-fabricante   ?interno_est=1');
  console.log('   GET /api/estoque/por-loja');
  console.log('   GET /api/estoque/fabricante-por-loja');
  console.log('   GET /api/estoque/ranking');
  console.log('   POST /api/cache/limpar');
  console.log('   GET  /api/cache/status');
  console.log('   POST /api/ia/chat');
  console.log('   POST /api/ia/resumo-estoque');
  console.log('   POST /api/ia/analisar-estoque');
  console.log('   POST /api/ia/analisar-contratos');
  console.log('   GET  /api/vendas                  ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&interno_est=1&fabricante=X&coordenador=Bruno');
  console.log('   GET  /api/coordenadores');
  console.log('   GET  /api/auditoria/estoque-grade     ?interno_est=1&data=YYYY-MM-DD&incluir_valores=0&incluir_grade=0\n');
});