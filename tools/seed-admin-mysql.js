require('dotenv').config();

const env = require('../src/config/env');
const appDb = require('../src/db/app-mysql');

async function main() {
  if (!env.appDb.enabled) {
    throw new Error('APP_DB_ENABLED precisa estar true para criar o admin no MySQL.');
  }

  var usuario = env.adminUser;
  var senhaHash = env.adminPassHash;
  var permissoes = env.adminPermissions;

  var existentes = await appDb.query(
    'SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER(?) LIMIT 1',
    [usuario]
  );

  var usuarioId;
  if (existentes[0]) {
    usuarioId = existentes[0].id;
    await appDb.query(
      'UPDATE usuarios SET nome = ?, senha_hash = ?, perfil = ?, ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      ['Administrador', senhaHash, 'admin', 'S', usuarioId]
    );
  } else {
    var result = await appDb.query(
      'INSERT INTO usuarios (usuario, nome, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)',
      [usuario, 'Administrador', senhaHash, 'admin', 'S']
    );
    usuarioId = result.insertId;
  }

  await appDb.query('DELETE FROM usuarios_permissoes WHERE usuario_id = ?', [usuarioId]);

  for (var i = 0; i < permissoes.length; i++) {
    await appDb.query(
      'INSERT INTO usuarios_permissoes (usuario_id, permissao) VALUES (?, ?)',
      [usuarioId, permissoes[i]]
    );
  }

  console.log('Admin sincronizado no MySQL da aplicacao: ' + usuario);
  process.exit(0);
}

main().catch(function (err) {
  console.error('Erro ao sincronizar admin:', err.message);
  process.exit(1);
});
