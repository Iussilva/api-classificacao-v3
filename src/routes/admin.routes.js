const express = require('express');
const modulesConfig = require('../config/modules');

function idParam(req) {
  return parseInt(req.params.id, 10);
}

function createAdminRoutes(ctx) {
  const router = express.Router();
  const usersService = ctx.usersService;
  const auditLog = ctx.auditLog;

  router.get('/permissoes', function (req, res) {
    res.json(modulesConfig.listarPermissoes());
  });

  router.get('/modulos', function (req, res) {
    res.json(modulesConfig.listarModulos());
  });

  router.get('/usuarios', async function (req, res) {
    try {
      res.json(await usersService.listarUsuarios());
    } catch (err) {
      console.error('[Admin] Erro ao listar usuarios:', err.message);
      res.status(500).json({ erro: 'Erro ao listar usuarios.' });
    }
  });

  router.get('/logs', async function (req, res) {
    try {
      var rows = await usersService.listarLogs ? await usersService.listarLogs() : [];
      res.json(rows);
    } catch (err) {
      console.error('[Admin] Erro ao listar logs:', err.message);
      res.status(500).json({ erro: 'Erro ao listar logs.' });
    }
  });

  router.post('/usuarios', async function (req, res) {
    try {
      var novo = await usersService.criarUsuario(req.body || {});
      if (auditLog) await auditLog.registrar(req, 'ADMIN_USUARIO_CRIADO', { usuario: novo.usuario });
      res.status(201).json({
        id: novo.id,
        usuario: novo.usuario,
        nome: novo.nome,
        perfil: novo.perfil,
        ativo: novo.ativo
      });
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ erro: 'Usuario invalido ou senha com menos de 8 caracteres.' });
      }

      console.error('[Admin] Erro ao criar usuario:', err.message);
      res.status(500).json({ erro: 'Erro ao criar usuario.' });
    }
  });

  router.put('/usuarios/:id/permissoes', async function (req, res) {
    try {
      await usersService.definirPermissoes(idParam(req), req.body.permissoes || []);
      if (auditLog) await auditLog.registrar(req, 'ADMIN_PERMISSOES_ALTERADAS', { usuario: String(idParam(req)) });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin] Erro ao alterar permissoes:', err.message);
      res.status(500).json({ erro: 'Erro ao alterar permissoes.' });
    }
  });

  router.patch('/usuarios/:id/status', async function (req, res) {
    try {
      await usersService.alterarStatus(idParam(req), Boolean(req.body.ativo));
      if (auditLog) await auditLog.registrar(req, 'ADMIN_STATUS_ALTERADO', { usuario: String(idParam(req)) });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin] Erro ao alterar status:', err.message);
      res.status(500).json({ erro: 'Erro ao alterar status.' });
    }
  });

  router.post('/usuarios/:id/senha', async function (req, res) {
    try {
      await usersService.alterarSenha(idParam(req), req.body.senha);
      if (auditLog) await auditLog.registrar(req, 'ADMIN_SENHA_ALTERADA', { usuario: String(idParam(req)) });
      res.json({ ok: true });
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ erro: 'Senha deve ter pelo menos 8 caracteres.' });
      }

      console.error('[Admin] Erro ao alterar senha:', err.message);
      res.status(500).json({ erro: 'Erro ao alterar senha.' });
    }
  });

  return router;
}

module.exports = createAdminRoutes;
