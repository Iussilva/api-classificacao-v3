const bcrypt = require('bcryptjs');
const modulesConfig = require('../config/modules');
const PERMISSOES_VALIDAS = modulesConfig.PERMISSOES_VALIDAS;

function limparUsuario(usuario) {
  return String(usuario || '').trim();
}

function normalizarPermissoes(permissoes) {
  return (permissoes || [])
    .map(function (p) { return String(p || '').trim(); })
    .filter(function (p) { return PERMISSOES_VALIDAS.includes(p); });
}

function createUsersService(ctx) {
  const query = ctx.query;

  async function buscarPorUsuario(usuario) {
    usuario = limparUsuario(usuario);
    if (!usuario) return null;

    var rows = await query(
      'SELECT id, usuario, nome, senha_hash, perfil, ativo' +
      ' FROM usuarios' +
      ' WHERE LOWER(usuario) = LOWER(?)' +
      ' LIMIT 1',
      [usuario]
    );

    return rows[0] || null;
  }

  async function buscarPorId(usuarioId) {
    var rows = await query(
      'SELECT id, usuario, nome, perfil, ativo, criado_em, ultimo_login_em' +
      ' FROM usuarios' +
      ' WHERE id = ?' +
      ' LIMIT 1',
      [usuarioId]
    );

    return rows[0] || null;
  }

  async function listarPermissoes(usuarioId) {
    var rows = await query(
      'SELECT permissao' +
      ' FROM usuarios_permissoes' +
      ' WHERE usuario_id = ?' +
      ' ORDER BY permissao',
      [usuarioId]
    );

    return normalizarPermissoes(rows.map(function (r) { return r.permissao; }));
  }

  async function autenticar(usuario, senha) {
    var user = await buscarPorUsuario(usuario);
    if (!user) return null;
    if (user.ativo !== 'S') return null;
    if (!bcrypt.compareSync(String(senha || ''), user.senha_hash)) return null;

    var permissoes = await listarPermissoes(user.id);
    await registrarUltimoLogin(user.id);

    return {
      id: user.id,
      usuario: user.usuario,
      nome: user.nome,
      perfil: user.perfil || 'usuario',
      permissoes: permissoes
    };
  }

  async function registrarUltimoLogin(usuarioId) {
    try {
      await query(
        'UPDATE usuarios SET ultimo_login_em = CURRENT_TIMESTAMP WHERE id = ?',
        [usuarioId]
      );
    } catch (err) {
      console.error('[Usuarios] Falha ao atualizar ultimo login:', err.message);
    }
  }

  async function listarUsuarios() {
    var rows = await query(
      'SELECT id, usuario, nome, perfil, ativo, criado_em, ultimo_login_em' +
      ' FROM usuarios' +
      ' ORDER BY usuario',
      []
    );

    for (var i = 0; i < rows.length; i++) {
      rows[i].permissoes = await listarPermissoes(rows[i].id);
    }

    return rows;
  }

  async function criarUsuario(dados) {
    var usuario = limparUsuario(dados.usuario);
    var senha = String(dados.senha || '');
    var nome = String(dados.nome || '').trim();
    var perfil = String(dados.perfil || 'usuario').trim();
    var permissoes = normalizarPermissoes(dados.permissoes);

    if (!usuario || senha.length < 8) {
      var erro = new Error('USUARIO_INVALIDO');
      erro.statusCode = 400;
      throw erro;
    }

    await query(
      'INSERT INTO usuarios (usuario, nome, senha_hash, perfil, ativo)' +
      ' VALUES (?, ?, ?, ?, ?)',
      [usuario, nome || null, bcrypt.hashSync(senha, 12), perfil, 'S']
    );

    var novo = await buscarPorUsuario(usuario);
    await definirPermissoes(novo.id, permissoes);
    return buscarPorId(novo.id);
  }

  async function definirPermissoes(usuarioId, permissoes) {
    permissoes = normalizarPermissoes(permissoes);
    await query('DELETE FROM usuarios_permissoes WHERE usuario_id = ?', [usuarioId]);

    for (var i = 0; i < permissoes.length; i++) {
      await query(
        'INSERT INTO usuarios_permissoes (usuario_id, permissao) VALUES (?, ?)',
        [usuarioId, permissoes[i]]
      );
    }
  }

  async function alterarStatus(usuarioId, ativo) {
    await query(
      'UPDATE usuarios SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [ativo ? 'S' : 'N', usuarioId]
    );
  }

  async function alterarSenha(usuarioId, senha) {
    if (String(senha || '').length < 8) {
      var erro = new Error('SENHA_INVALIDA');
      erro.statusCode = 400;
      throw erro;
    }

    await query(
      'UPDATE usuarios SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [bcrypt.hashSync(String(senha), 12), usuarioId]
    );
  }

  async function listarLogs() {
    return await query(
      'SELECT id, usuario_id, usuario, evento, ip, criado_em' +
      ' FROM logs_acesso' +
      ' ORDER BY criado_em DESC' +
      ' LIMIT 100',
      []
    );
  }

  return {
    PERMISSOES_VALIDAS: PERMISSOES_VALIDAS,
    autenticar: autenticar,
    listarUsuarios: listarUsuarios,
    criarUsuario: criarUsuario,
    definirPermissoes: definirPermissoes,
    alterarStatus: alterarStatus,
    alterarSenha: alterarSenha,
    listarLogs: listarLogs
  };
}

module.exports = createUsersService;
