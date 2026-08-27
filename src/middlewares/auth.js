const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const env = require('../config/env');
const modulesConfig = require('../config/modules');

var usersService = null;
var auditLog = null;

var COOKIE_NAME = 'ourobras_token';

function setUsersService(service) {
  usersService = service || null;
}

function setAuditLogService(service) {
  auditLog = service || null;
}

function autenticar(req, res, next) {
  if (
    req.path === '/api/ping' ||
    req.path === '/api/status/bancos' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/logout'
  ) {
    return next();
  }

  if (!req.path.startsWith('/api/')) {
    return next();
  }

  var authHeader = req.headers['authorization'] || '';

  var token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : lerCookie(req, COOKIE_NAME);

  if (!token) {
    return res.status(401).json({
      erro: 'Token de autenticacao ausente.'
    });
  }

  try {
    var decoded = jwt.verify(token, env.jwtSecret);

    req.usuario = decoded.usuario;
    req.usuarioId = decoded.id || null;
    req.nomeUsuario = decoded.nome || null;
    req.perfil = decoded.perfil || null;
    req.permissoes = Array.isArray(decoded.permissoes)
      ? decoded.permissoes
      : [];

    next();
  } catch (e) {
    return res.status(401).json({
      erro: 'Token invalido ou expirado. Faca login novamente.'
    });
  }
}

function lerCookie(req, nome) {
  var header = req.headers.cookie || '';
  var partes = header.split(';');

  for (var i = 0; i < partes.length; i++) {
    var parte = partes[i].trim();

    if (parte.indexOf(nome + '=') === 0) {
      return decodeURIComponent(parte.slice(nome.length + 1));
    }
  }

  return null;
}

function temPermissao(req, permissao) {
  var permissoes = Array.isArray(req.permissoes)
    ? req.permissoes
    : [];

  return permissoes.includes('admin') ||
    permissoes.includes(permissao);
}

function exigirPermissao() {
  var permissoesAceitas = Array.prototype.slice.call(arguments);

  return function (req, res, next) {
    var autorizado = permissoesAceitas.some(function (permissao) {
      return temPermissao(req, permissao);
    });

    if (!autorizado) {
      return res.status(403).json({
        erro: 'Acesso nao autorizado para esta area.'
      });
    }

    next();
  };
}

function emitirToken(res, principal) {
  var token = jwt.sign(
    {
      id: principal.id || null,
      usuario: principal.usuario,
      nome: principal.nome || null,
      perfil: principal.perfil || 'usuario',
      permissoes: principal.permissoes || []
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiry
    }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: calcularMaxAge(env.jwtExpiry)
  });

  /*
   * IMPORTANTE:
   * O token continua sendo gravado no cookie para o portal da API,
   * mas agora também é devolvido no JSON para permitir que sistemas
   * externos, como o RFD, utilizem Authorization: Bearer <token>.
   */
  res.json({
    autenticado: true,
    token: token,
    expira_em: env.jwtExpiry,
    usuario: principal.usuario,
    nome: principal.nome || null,
    perfil: principal.perfil || 'usuario',
    permissoes: principal.permissoes || []
  });
}

function calcularMaxAge(expiry) {
  var texto = String(expiry || '8h').trim();
  var match = texto.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 8 * 60 * 60 * 1000;
  }

  var valor = parseInt(match[1], 10);
  var unidade = match[2].toLowerCase();

  if (unidade === 's') {
    return valor * 1000;
  }

  if (unidade === 'm') {
    return valor * 60 * 1000;
  }

  if (unidade === 'h') {
    return valor * 60 * 60 * 1000;
  }

  if (unidade === 'd') {
    return valor * 24 * 60 * 60 * 1000;
  }

  return 8 * 60 * 60 * 1000;
}

function session(req, res) {
  res.json({
    autenticado: true,
    usuario: req.usuario,
    nome: req.nomeUsuario || null,
    perfil: req.perfil || null,
    permissoes: req.permissoes || [],
    modulos: modulesConfig.listarModulos()
  });
}

function logout(req, res) {
  try {
    var token = lerCookie(req, COOKIE_NAME);

    if (token) {
      var decoded = jwt.verify(token, env.jwtSecret);

      req.usuario = decoded.usuario;
      req.usuarioId = decoded.id || null;

      if (auditLog) {
        auditLog.registrar(req, 'LOGOUT', {
          usuario: decoded.usuario
        });
      }
    }
  } catch (err) {
    // Ignora token expirado/invalido durante logout.
  }

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  res.json({
    ok: true
  });
}

function autenticarAdminEnv(usuario, senha) {
  if (usuario !== env.adminUser) {
    return null;
  }

  if (!bcrypt.compareSync(
    String(senha || ''),
    env.adminPassHash
  )) {
    return null;
  }

  return {
    id: null,
    usuario: usuario,
    nome: 'Administrador',
    perfil: 'admin',
    permissoes: env.adminPermissions
  };
}

async function login(req, res) {
  var usuario = req.body.usuario;
  var senha = req.body.senha;

  if (!usuario || !senha) {
    return res.status(400).json({
      erro: 'Usuario e senha obrigatorios.'
    });
  }

  if (usersService) {
    try {
      var principalBanco =
        await usersService.autenticar(usuario, senha);

      if (principalBanco) {
        console.log(
          '[Auth] Login bem-sucedido via banco: ' + usuario
        );

        req.usuario = principalBanco.usuario;
        req.usuarioId = principalBanco.id || null;

        if (auditLog) {
          auditLog.registrar(
            req,
            'LOGIN_SUCESSO_BANCO',
            {
              usuario: usuario
            }
          );
        }

        return emitirToken(
          res,
          principalBanco
        );
      }
    } catch (err) {
      console.warn(
        '[Auth] Login via banco indisponivel. Usando fallback por ambiente.'
      );
    }
  }

  var principalEnv =
    autenticarAdminEnv(usuario, senha);

  if (!principalEnv) {
    console.warn(
      '[Auth] Tentativa de login falhou para: ' +
      usuario +
      ' | IP: ' +
      req.ip
    );

    if (auditLog) {
      auditLog.registrar(
        req,
        'LOGIN_FALHA',
        {
          usuario: usuario
        }
      );
    }

    return setTimeout(function () {
      res.status(401).json({
        erro: 'Usuario ou senha incorretos.'
      });
    }, 500);
  }

  console.log(
    '[Auth] Login bem-sucedido via ambiente: ' +
    usuario
  );

  req.usuario = principalEnv.usuario;
  req.usuarioId = null;

  if (auditLog) {
    auditLog.registrar(
      req,
      'LOGIN_SUCESSO_ENV',
      {
        usuario: usuario
      }
    );
  }

  return emitirToken(
    res,
    principalEnv
  );
}

module.exports = {
  autenticar: autenticar,
  exigirPermissao: exigirPermissao,
  login: login,
  logout: logout,
  session: session,
  setAuditLogService: setAuditLogService,
  setUsersService: setUsersService
};