const env = require('../config/env');

var pool = null;

function carregarMysql() {
  try {
    return require('mysql2/promise');
  } catch (err) {
    console.warn('[AppDB] Driver mysql2 nao instalado. Banco da aplicacao desativado.');
    return null;
  }
}

function getPool() {
  if (!env.appDb.enabled) return null;
  if (pool) return pool;

  var mysql = carregarMysql();
  if (!mysql) return null;

  pool = mysql.createPool({
    host: env.appDb.host,
    port: env.appDb.port,
    database: env.appDb.database,
    user: env.appDb.user,
    password: env.appDb.password,
    waitForConnections: true,
    connectionLimit: env.appDb.connectionLimit,
    charset: 'utf8mb4'
  });

  console.log('[AppDB] MySQL habilitado: ' + env.appDb.host + ':' + env.appDb.port + '/' + env.appDb.database);
  return pool;
}

async function query(sql, params) {
  var p = getPool();
  if (!p) {
    var erro = new Error('APP_DB_DESABILITADO');
    erro.code = 'APP_DB_DESABILITADO';
    throw erro;
  }

  var result = await p.execute(sql, params || []);
  return result[0];
}

module.exports = {
  enabled: env.appDb.enabled,
  getPool: getPool,
  query: query
};
