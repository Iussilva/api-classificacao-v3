const Firebird = require('node-firebird');
const env = require('../config/env');

const ORIGENS_BANCO = {
  matriz: env.firebird.matriz,
  manaus: env.firebird.manaus
};

function normalizarOrigem(origem) {
  origem = String(origem || 'matriz').toLowerCase().trim();
  return ORIGENS_BANCO[origem] ? origem : 'matriz';
}

function getFbOptions(origem) {
  origem = normalizarOrigem(origem);
  var options = ORIGENS_BANCO[origem];

  if (!options.host || !options.database || !options.user || !options.password) {
    throw new Error('Configuracao Firebird incompleta para origem: ' + origem);
  }

  return options;
}

function query(sql, params, origem) {
  params = params || [];
  var options;

  try {
    options = getFbOptions(origem);
  } catch (e) {
    return Promise.reject(e);
  }

  return new Promise(function (resolve, reject) {
    Firebird.attach(options, function (err, db) {
      if (err) return reject(err);
      db.query(sql, params, function (err, result) {
        db.detach();
        if (err) return reject(err);
        resolve(result);
      });
    });
  });
}

module.exports = {
  fbOptions: env.firebird.matriz,
  fbOptionsManaus: env.firebird.manaus,
  normalizarOrigem: normalizarOrigem,
  getFbOptions: getFbOptions,
  query: query
};
