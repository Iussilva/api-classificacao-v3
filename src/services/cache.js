const env = require('../config/env');

var cacheStore = {};
var CACHE_TTL = env.cacheTtlMs;

async function comCache(chave, fn) {
  var agora = Date.now();
  var item = cacheStore[chave];
  if (item && (agora - item.ts) < CACHE_TTL) {
    console.log('[Cache] HIT -> ' + chave);
    return item.data;
  }
  console.log('[Cache] MISS -> ' + chave);
  var data = await fn();
  cacheStore[chave] = { ts: agora, data: data };
  return data;
}

function limparCache() {
  cacheStore = {};
  console.log('[Cache] Limpo manualmente.');
}

function statusCache() {
  var agora = Date.now();
  var entradas = Object.keys(cacheStore).map(function (k) {
    return { chave: k, idade_segundos: Math.round((agora - cacheStore[k].ts) / 1000) };
  });
  return { total: entradas.length, ttl_ms: CACHE_TTL, entradas: entradas };
}

setInterval(function () {
  var agora = Date.now();
  var antes = Object.keys(cacheStore).length;
  Object.keys(cacheStore).forEach(function (k) {
    if ((agora - cacheStore[k].ts) >= CACHE_TTL) delete cacheStore[k];
  });
  var depois = Object.keys(cacheStore).length;
  if (antes !== depois) console.log('[Cache] Limpeza: ' + (antes - depois) + ' entradas removidas.');
}, 10 * 60 * 1000);

module.exports = {
  comCache: comCache,
  limparCache: limparCache,
  statusCache: statusCache,
  CACHE_TTL: CACHE_TTL
};
