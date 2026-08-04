require('dotenv').config();
const modulesConfig = require('./modules');

const REQUIRED_ENV = [
  'FB_HOST',
  'FB_DATABASE',
  'FB_USER',
  'FB_PASSWORD',
  'JWT_SECRET',
  'ADMIN_USER',
  'ADMIN_PASS_HASH',
  'ALLOWED_ORIGIN'
];

const DEFAULT_ADMIN_PERMISSIONS = modulesConfig.listarPermissoes();

function parseList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function requireEnv() {
  REQUIRED_ENV.forEach(function (key) {
    if (!process.env[key]) {
      console.error('[ERRO FATAL] Variavel de ambiente ausente: ' + key);
      process.exit(1);
    }
  });
}

requireEnv();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3003,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '8h',
  adminUser: process.env.ADMIN_USER,
  adminPassHash: process.env.ADMIN_PASS_HASH,
  adminPermissions: parseList(process.env.ADMIN_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS),
  allowedOrigins: [
    process.env.ALLOWED_ORIGIN,
    'https://classificacao.suporteourobras.com'
  ].filter(Boolean),
  cacheTtlMs: parseInt(process.env.CACHE_TTL_MS, 10) || 5 * 60 * 1000,
  appDb: {
    enabled: String(process.env.APP_DB_ENABLED || '').toLowerCase() === 'true',
    host: process.env.APP_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.APP_DB_PORT, 10) || 3306,
    database: process.env.APP_DB_NAME || 'ourobras_app',
    user: process.env.APP_DB_USER || 'root',
    password: process.env.APP_DB_PASSWORD || '',
    connectionLimit: parseInt(process.env.APP_DB_CONNECTION_LIMIT, 10) || 5
  },
  firebird: {
    matriz: {
      host: process.env.FB_HOST || 'ourobras_barra.qualyti.inf.br',
      port: parseInt(process.env.FB_PORT, 10) || 3050,
      database: process.env.FB_DATABASE || 'D:\\Conttroller\\Dados\\GERAIS.FDB',
      user: process.env.FB_USER || 'SYSDBA',
      password: process.env.FB_PASSWORD || 'masterkey',
      charset: process.env.FB_CHARSET || 'ISO8859_1',
      lowercase_keys: false
    },
    manaus: {
      host: process.env.FB_MANAUS_HOST,
      port: parseInt(process.env.FB_MANAUS_PORT, 10) || 3050,
      database: process.env.FB_MANAUS_DATABASE,
      user: process.env.FB_MANAUS_USER || process.env.FB_USER || 'SYSDBA',
      password: process.env.FB_MANAUS_PASSWORD || process.env.FB_PASSWORD,
      charset: process.env.FB_MANAUS_CHARSET || process.env.FB_CHARSET || 'ISO8859_1',
      lowercase_keys: false
    }
  }
};
