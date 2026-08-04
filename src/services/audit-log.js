function createAuditLogService(ctx) {
  const query = ctx.query;

  async function registrar(req, evento, dados) {
    try {
      await query(
        'INSERT INTO logs_acesso (usuario_id, usuario, evento, ip, user_agent)' +
        ' VALUES (?, ?, ?, ?, ?)',
        [
          req.usuarioId || null,
          req.usuario || (dados && dados.usuario) || null,
          String(evento || '').slice(0, 60),
          req.ip || null,
          String(req.headers['user-agent'] || '').slice(0, 255)
        ]
      );
    } catch (err) {
      console.error('[Auditoria] Falha ao registrar log:', err.message);
    }
  }

  return {
    registrar: registrar
  };
}

module.exports = createAuditLogService;
