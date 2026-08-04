// ── Verificação de autenticação ──────────────────────────────
(function () {
  fetch('/api/auth/session', { credentials: 'same-origin' }).then(function (r) {
    if (r.status === 401) {
      window.location.href = '/login.html';
      return null;
    }
    return r.json();
  }).then(function (sessao) {
    if (sessao) aplicarPermissoesInterface(sessao.permissoes || [], sessao.modulos || []);
  }).catch(function () {
    window.location.href = '/login.html';
  });
})();

function aplicarPermissoesInterface(permissoes, modulos) {
  if (modulos && modulos.length) configurarCatalogoModulos(modulos);
  permissoesSessao = Array.isArray(permissoes) ? permissoes : [];
  document.body.classList.remove('auth-loading');
  var isAdmin = permissoesSessao.includes('admin');
  var abasPermitidas = [];

  Object.keys(permissaoPorAba).forEach(function (aba) {
    var btn = document.getElementById(botaoPorAba[aba]);
    var permitido = isAdmin || permissoesSessao.includes(permissaoPorAba[aba]);

    if (btn) {
      btn.style.display = permitido ? '' : 'none';
    }

    if (permitido) abasPermitidas.push(aba);
  });

  if (!abasPermitidas.includes(abaAtiva)) {
    var proximaAba = abasPermitidas[0];
    if (proximaAba) {
      mudarAba(proximaAba, document.getElementById(botaoPorAba[proximaAba]));
    }
  }
}

function configurarCatalogoModulos(modulos) {
  modulosSistema = normalizarCatalogoModulos(modulos);
  permissaoPorAba = {};
  botaoPorAba = {};
  adminPermissoesLabels = {};

  modulosSistema.forEach(function (modulo) {
    permissaoPorAba[modulo.aba] = modulo.chave;
    botaoPorAba[modulo.aba] = modulo.botaoId;
    adminPermissoesLabels[modulo.chave] = modulo.label;
  });
}

function normalizarCatalogoModulos(modulos) {
  if (!Array.isArray(modulos) || !modulos.length) return modulosPadrao;

  if (typeof modulos[0] === 'string') {
    return modulos.map(function (chave, index) {
      var padrao = modulosPadrao.find(function (m) { return m.chave === chave; });
      return padrao || {
        chave: chave,
        label: chave,
        aba: chave,
        botaoId: 'tabBtn' + chave,
        ordem: index * 10
      };
    });
  }

  return modulos.filter(function (modulo) {
    return modulo && modulo.chave && modulo.label;
  }).map(function (modulo, index) {
    var padrao = modulosPadrao.find(function (m) { return m.chave === modulo.chave; }) || {};
    return {
      chave: modulo.chave,
      label: modulo.label || padrao.label || modulo.chave,
      aba: modulo.aba || padrao.aba || modulo.chave,
      botaoId: modulo.botaoId || padrao.botaoId || ('tabBtn' + modulo.chave),
      ordem: modulo.ordem || padrao.ordem || (index * 10)
    };
  });
}

// ── Função global para chamadas autenticadas ─────────────────
function apiFetch(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.credentials = opts.credentials || 'same-origin';

  return fetch(url, opts).then(function (r) {
    if (r.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Sessão expirada');
    }
    return r;
  });
}

// Substitua todos os fetch('/api/...') por apiFetch('/api/...')

/* ════════════════════════════════════════════════
   GLOBALS
════════════════════════════════════════════════ */
var chartFabE = null, chartLojaE = null, chartPizzaE = null;
var chartFabV = null, chartLojaV = null;
var coordenadoresMap = {};
var produtosCarregados = false, todosProdutos = [], produtosAbertos = false;
var vCoordAtivo = null;
var chatAberto = false, chatMinimizado = false, chatHistorico = [];
var abaAtiva = 'estoque';
var permissoesSessao = [];
var modulosSistema = [];

var permissaoPorAba = {};
var botaoPorAba = {};
var adminPermissoesLabels = {};

var modulosPadrao = [
  { chave: 'estoque', label: 'Estoque', aba: 'estoque', botaoId: 'tabBtnEstoque' },
  { chave: 'vendas', label: 'Vendas', aba: 'vendas', botaoId: 'tabBtnVendas' },
  { chave: 'auditoria', label: 'Auditoria', aba: 'auditoria', botaoId: 'tabBtnAuditoria' },
  { chave: 'consultas_erp', label: 'Consultas ERP', aba: 'consultas', botaoId: 'tabBtnConsultas' },
  { chave: 'marketing', label: 'Marketing', aba: 'marketing', botaoId: 'tabBtnMarketing' },
  { chave: 'admin', label: 'Admin', aba: 'admin', botaoId: 'tabBtnAdmin' }
];

configurarCatalogoModulos(modulosPadrao);

var PALETTE = [
  '#1A3A6B', '#A8762A', '#166534', '#7c3aed',
  '#0891b2', '#c2410c', '#1E5F8A', '#1A6B45', '#7B3074', '#b45309'
];

function fmt(v, dec) {
  return (parseFloat(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: dec !== undefined ? dec : 2 });
}
function nomeFab(n) { return (n || 'Sem Fabricante').trim(); }
function nomeLoja(n, cod) { return (n || 'Est. ' + cod).trim(); }

/* ── RELÓGIO ────────────────────────────────── */
setInterval(function () {
  var el = document.getElementById('hora');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}, 1000);

document.addEventListener('DOMContentLoaded', iniciarEventosUI);

function bindClick(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function bindChange(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('change', fn);
}

function bindInput(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', fn);
}

function iniciarEventosUI() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () { mudarAba(btn.dataset.tab, btn); });
  });

  bindClick('btnConsultarEstoque', function () { resetProdutos(); carregarTudo(); });
  bindClick('btnResumoIAClose', function () { document.getElementById('resumoIA').style.display = 'none'; });
  bindInput('filtroProduto', filtrarProdutos);
  bindClick('btnVerProdutos', toggleProdutos);
  bindClick('btnBuscarV', buscarVendas);
  bindClick('btnLimparVendas', limparVendas);
  bindChange('aOrigem', carregarLojasAuditoria);
  bindClick('btnBuscarAuditoria', buscarAuditoria);
  bindChange('filtroTipoAuditoria', aplicarFiltrosAuditoria);
  bindInput('filtroAuditoria', aplicarFiltrosAuditoria);
  bindClick('btnExportarAuditoriaExcel', exportarAuditoriaExcel);
  bindClick('btnExportarAuditoriaPDF', exportarAuditoriaPDF);
  bindChange('cOrigem', function () { atualizarTiposConsultaPorOrigem(); carregarLojasConsultas(); });
  bindClick('btnBuscarConsultas', buscarConsultasERP);
  bindChange('mOrigem', function () { carregarLojasMarketing(); carregarGruposMarketing(); });
  bindClick('btnBuscarMarketing', buscarClientesNovos);
  bindClick('btnExportarMarketingExcel', exportarMarketingExcel);
  bindClick('btnExportarMarketingPDF', exportarMarketingPDF);
  bindClick('btnCriarUsuarioAdmin', criarUsuarioAdmin);
  bindClick('btnLimparAdmin', limparFormularioAdmin);
  bindClick('btnAtualizarAdmin', carregarUsuariosAdmin);
  bindClick('btnAtualizarLogsAdmin', carregarLogsAdmin);
  bindClick('btnFecharModalConsulta', function () { fecharModalConsulta(); });
  bindClick('btnMinimizarChat', minimizarChat);
  bindClick('btnFecharChat', fecharChat);
  bindClick('chatSend', enviarChat);
  bindClick('chatBtn', toggleChat);

  document.querySelectorAll('.coord-pill').forEach(function (btn) {
    btn.addEventListener('click', function () { toggleCoordV(btn); });
  });

  document.querySelectorAll('.auditoria-col').forEach(function (input) {
    input.addEventListener('change', aplicarFiltrosAuditoria);
  });

  document.querySelectorAll('.consulta-tipo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { selecionarTipoConsulta(btn); });
  });

  var modal = document.getElementById('consultaModal');
  if (modal) {
    modal.addEventListener('click', function (event) { fecharModalConsulta(event); });
  }

  var chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        enviarChat();
      }
    });
    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
    });
  }

  document.addEventListener('click', function (event) {
    var fab = event.target.closest('.js-toggle-fab');
    if (fab) {
      toggleFab(fab.dataset.target);
      return;
    }

    var detalhe = event.target.closest('.js-modal-consulta');
    if (detalhe) {
      abrirModalConsulta(parseInt(detalhe.dataset.idx, 10));
      return;
    }

    var salvarPerms = event.target.closest('.admin-save-perms');
    if (salvarPerms) {
      salvarPermissoesAdmin(parseInt(salvarPerms.dataset.userId, 10));
      return;
    }

    var status = event.target.closest('.admin-toggle-status');
    if (status) {
      alterarStatusAdmin(parseInt(status.dataset.userId, 10), status.dataset.ativo === 'true');
      return;
    }

    var chip = event.target.closest('.chat-chip[data-question]');
    if (chip) {
      perguntaRapida(chip.dataset.question);
    }
  });

  document.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'filtroTabelaVendas') {
      filtrarTabelaV(event.target.value);
    }
  });
}

/* ── TOAST ──────────────────────────────────── */
function showToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (tipo === 'ok' ? ' success' : '');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('show'); }, 4000);
}

/* ════════════════════════════════════════════════
   NAVEGAÇÃO POR ABAS
════════════════════════════════════════════════ */
function mudarAba(aba, btn) {
  if (!usuarioPodeAcessarAba(aba)) {
    toast('Você não tem permissão para acessar esta aba.', 'erro');
    return;
  }

  abaAtiva = aba;

  document.querySelectorAll('.tab-panel').forEach(function (p) {
    p.classList.remove('active');
  });

  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.remove('active');
  });

  document.getElementById('panel-' + aba).classList.add('active');
  if (btn) btn.classList.add('active');

  // Importante: a troca de aba NÃO deve disparar consultas pesadas do estoque.
  // A aba Auditoria consulta somente /api/auditoria/estoque-grade quando o usuário clicar no botão.
  if (aba === 'admin') {
    iniciarAdmin();
    return;
  }
  if (aba === 'auditoria') return;
}

function usuarioPodeAcessarAba(aba) {
  if (!permissoesSessao.length) return true;
  return permissoesSessao.includes('admin') || permissoesSessao.includes(permissaoPorAba[aba]);
}

/* ════════════════════════════════════════════════
   PING / STATUS
════════════════════════════════════════════════ */
async function ping() {
  var b = document.getElementById('statusBadge');
  try {
    var d = await fetch('/api/status/bancos').then(function (r) { return r.json(); });
    var erpOnline = d.bancos && d.bancos.erp && d.bancos.erp.status === 'online';
    var appOnline = d.bancos && d.bancos.app && d.bancos.app.status === 'online';
    var appDesativado = d.bancos && d.bancos.app && d.bancos.app.status === 'desativado';
    var appTexto = appDesativado ? 'App desativado' : 'App ' + (appOnline ? 'Online' : 'Offline');

    b.innerHTML = '<span class="status-dot"></span> ERP ' + (erpOnline ? 'Online' : 'Offline') + ' | ' + appTexto;
    b.title = 'ERP Firebird: ' + (erpOnline ? 'online' : 'offline') + ' | Banco da aplicacao MySQL: ' + (appDesativado ? 'desativado' : (appOnline ? 'online' : 'offline'));

    if (erpOnline && (appOnline || appDesativado)) {
      b.className = 'status-badge';
    } else {
      b.className = 'status-badge parcial';
    }
  } catch (e) {
    b.innerHTML = '<span class="status-dot"></span> Status indisponivel';
    b.title = 'Não foi possível consultar o status dos bancos.';
    b.className = 'status-badge erro';
  }
}

/* ════════════════════════════════════════════════
   ESTOQUE — FILTROS
════════════════════════════════════════════════ */
/* ADMIN - USUÁRIOS E PERMISSÕES */
var adminPermissoesDisponiveis = [];
var adminCarregado = false;

function iniciarAdmin() {
  if (adminCarregado) {
    carregarUsuariosAdmin();
    carregarLogsAdmin();
    return;
  }

  adminCarregado = true;
  carregarPermissoesAdmin().then(function () {
    carregarUsuariosAdmin();
    carregarLogsAdmin();
  }).catch(function () {
    toast('Não foi possível carregar a administração.', 'erro');
  });
}

async function carregarPermissoesAdmin() {
  var modulos = null;

  try {
    var respModulos = await apiFetch('/api/admin/modulos');
    if (respModulos.ok) modulos = await respModulos.json();
  } catch (err) {}

  if (!modulos) {
    try {
      var respPermissoes = await apiFetch('/api/admin/permissoes');
      if (respPermissoes.ok) modulos = await respPermissoes.json();
    } catch (err) {}
  }

  configurarCatalogoModulos(modulos || modulosPadrao);
  adminPermissoesDisponiveis = modulosSistema.map(function (modulo) { return modulo.chave; });
  renderPermissoesForm([]);
}

function renderPermissoesForm(selecionadas) {
  var el = document.getElementById('adminPermissoesForm');
  if (!el) return;

  selecionadas = selecionadas || [];
  el.innerHTML = adminPermissoesDisponiveis.map(function (p) {
    var checked = selecionadas.includes(p) ? ' checked' : '';
    return '<label class="admin-perm-chip">' +
      '<input type="checkbox" value="' + p + '"' + checked + '> ' +
      (adminPermissoesLabels[p] || p) +
      '</label>';
  }).join('');
}

function permissoesFormSelecionadas() {
  return Array.prototype.slice.call(document.querySelectorAll('#adminPermissoesForm input:checked'))
    .map(function (el) { return el.value; });
}

function limparFormularioAdmin() {
  document.getElementById('adminUsuario').value = '';
  document.getElementById('adminNome').value = '';
  document.getElementById('adminSenha').value = '';
  renderPermissoesForm([]);
}

async function carregarUsuariosAdmin() {
  var tbody = document.getElementById('adminUsuariosTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3)">Carregando usuários.</td></tr>';

  try {
    var usuarios = await apiFetch('/api/admin/usuarios').then(function (r) { return r.json(); });
    document.getElementById('adminUsuariosCount').textContent = (usuarios.length || 0) + ' registro(s)';

    if (!usuarios.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3)">Nenhum usuário cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = usuarios.map(renderUsuarioAdmin).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger)">Erro ao carregar usuários.</td></tr>';
  }
}

function renderUsuarioAdmin(u) {
  var permissoes = Array.isArray(u.permissoes) ? u.permissoes : [];
  var ativo = u.ativo === 'S';
  if (!adminPermissoesDisponiveis.length) {
    configurarCatalogoModulos(modulosPadrao);
    adminPermissoesDisponiveis = modulosSistema.map(function (modulo) { return modulo.chave; });
  }
  var permissoesHtml = adminPermissoesDisponiveis.map(function (p) {
    var checked = permissoes.includes(p) ? ' checked' : '';
    return '<label class="admin-perm-mini">' +
      '<input type="checkbox" data-user="' + u.id + '" value="' + p + '"' + checked + '> ' +
      (adminPermissoesLabels[p] || p) +
      '</label>';
  }).join('');

  return '<tr>' +
    '<td><strong>' + escapeHtml(u.usuario || '') + '</strong></td>' +
    '<td>' + escapeHtml(u.nome || '-') + '</td>' +
    '<td>' + escapeHtml(u.perfil || 'usuario') + '</td>' +
    '<td><span class="admin-status ' + (ativo ? 'ativo' : 'inativo') + '">' + (ativo ? 'Ativo' : 'Inativo') + '</span></td>' +
    '<td><div class="admin-perm-list">' + permissoesHtml + '</div></td>' +
    '<td style="text-align:right"><div class="admin-row-actions">' +
      '<button class="btn-secondary admin-save-perms" data-user-id="' + u.id + '">Salvar</button>' +
      '<button class="btn-secondary admin-toggle-status" data-user-id="' + u.id + '" data-ativo="' + (!ativo) + '">' + (ativo ? 'Desativar' : 'Ativar') + '</button>' +
    '</div></td>' +
  '</tr>';
}

async function criarUsuarioAdmin() {
  var payload = {
    usuario: document.getElementById('adminUsuario').value.trim(),
    nome: document.getElementById('adminNome').value.trim(),
    senha: document.getElementById('adminSenha').value,
    perfil: 'usuario',
    permissoes: permissoesFormSelecionadas()
  };

  if (!payload.usuario || !payload.senha) {
    toast('Informe usuário e senha inicial.', 'erro');
    return;
  }

  try {
    var resp = await apiFetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      var erro = await resp.json().catch(function () { return {}; });
      toast(erro.erro || 'Erro ao criar usuário.', 'erro');
      return;
    }

    limparFormularioAdmin();
    await carregarUsuariosAdmin();
    await carregarLogsAdmin();
    toast('Usuário criado com sucesso.', 'ok');
  } catch (err) {
    toast('Erro ao criar usuário.', 'erro');
  }
}

async function salvarPermissoesAdmin(usuarioId) {
  var permissoes = Array.prototype.slice.call(document.querySelectorAll('input[data-user="' + usuarioId + '"]:checked'))
    .map(function (el) { return el.value; });

  try {
    await apiFetch('/api/admin/usuarios/' + usuarioId + '/permissoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissoes: permissoes })
    });
    await carregarLogsAdmin();
    toast('Permissões atualizadas.', 'ok');
  } catch (err) {
    toast('Erro ao atualizar permissões.', 'erro');
  }
}

async function alterarStatusAdmin(usuarioId, ativo) {
  try {
    await apiFetch('/api/admin/usuarios/' + usuarioId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: ativo })
    });
    await carregarUsuariosAdmin();
    await carregarLogsAdmin();
    toast('Status atualizado.', 'ok');
  } catch (err) {
    toast('Erro ao alterar status.', 'erro');
  }
}

async function carregarLogsAdmin() {
  var tbody = document.getElementById('adminLogsTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Carregando logs.</td></tr>';

  try {
    var logs = await apiFetch('/api/admin/logs').then(function (r) { return r.json(); });
    document.getElementById('adminLogsCount').textContent = (logs.length || 0) + ' evento(s)';

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Nenhum log encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(function (log) {
      return '<tr>' +
        '<td>' + escapeHtml(formatarDataHora(log.criado_em)) + '</td>' +
        '<td>' + escapeHtml(log.usuario || '-') + '</td>' +
        '<td><strong>' + escapeHtml(log.evento || '-') + '</strong></td>' +
        '<td>' + escapeHtml(log.ip || '-') + '</td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--danger)">Erro ao carregar logs.</td></tr>';
  }
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  var d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return d.toLocaleString('pt-BR');
}

function escapeHtml(valor) {
  return String(valor || '').replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

async function carregarFiltros() {
  try {
    var [dl, df, dc] = await Promise.all([
      apiFetch('/api/estabelecimentos').then(function (r) { return r.json(); }),
      apiFetch('/api/fabricantes').then(function (r) { return r.json(); }),
      apiFetch('/api/coordenadores').then(function (r) { return r.json(); }).catch(function () { return { coordenadores: {} }; }),
    ]);
    coordenadoresMap = (dc && dc.coordenadores) ? dc.coordenadores : {};
    var selL = document.getElementById('selLoja');
    selL.innerHTML = '<option value="">— Todas as lojas —</option>';
    (dl.estabelecimentos || []).forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.INTERNO;
      o.textContent = e.INTERNO + ' — ' + (e.FANTASIA || e.NOME || '').trim();
      selL.appendChild(o);
    });
    var selF = document.getElementById('selFabricante');
    selF.innerHTML = '<option value="">— Todos os fabricantes —</option>';
    (df.fabricantes || []).forEach(function (f) {
      var o = document.createElement('option');
      o.value = f.INTERNO;
      o.textContent = (f.NOME || '').trim();
      selF.appendChild(o);
    });
    var selC = document.getElementById('selCoord');
    selC.innerHTML = '<option value="">— Todos —</option>';
    Object.keys(coordenadoresMap).forEach(function (nome) {
      var o = document.createElement('option');
      o.value = nome;
      o.textContent = nome + ' (' + (coordenadoresMap[nome] || []).length + ' lojas)';
      selC.appendChild(o);
    });
  } catch (e) { console.error(e); }
}

function getParams() {
  var p = new URLSearchParams();
  var loja = document.getElementById('selLoja').value;
  var fab = document.getElementById('selFabricante').value;
  var teor = document.getElementById('selTeor').value;
  if (loja) p.set('interno_est', loja);
  if (fab) p.set('fabricante', fab);
  if (teor) p.set('teor', teor);
  return p;
}

function getCoordSelecionado() {
  var el = document.getElementById('selCoord');
  return el ? el.value : '';
}

/* ── Estoque por coordenador ─────────────────── */
async function carregarProdutosPorCoordenador(coordNome) {
  var lojas = coordenadoresMap[coordNome] || [];
  var fab = document.getElementById('selFabricante').value;
  var teor = document.getElementById('selTeor').value;
  var reqs = lojas.map(async function (codLoja) {
    var p = new URLSearchParams();
    p.set('interno_est', codLoja);
    if (fab) p.set('fabricante', fab);
    if (teor) p.set('teor', teor);
    p.set('limite', 9999);
    var d = await apiFetch('/api/estoque?' + p).then(function (r) { return r.json(); });
    return { loja: codLoja, data_ref: d.data_ref || 'hoje', estoque: d.estoque || [] };
  });
  var respostas = await Promise.all(reqs);
  var todos = []; var dataRef = 'hoje';
  respostas.forEach(function (r) { if (r.data_ref) dataRef = r.data_ref; r.estoque.forEach(function (i) { todos.push(i); }); });
  return { produtos: todos, data_ref: dataRef, lojas: lojas };
}

function agregarDashboard(produtos) {
  var fabM = {}, lojaM = {}, rankM = {};
  produtos.forEach(function (p) {
    var fab = nomeFab(p.FABRICANTE); var cod = parseInt(p.ESTABELECIMENTO) || 0;
    var nl = nomeLoja(p.NOME_ESTABELECIMENTO, cod); var s = parseFloat(p.SALDO) || 0;
    var cp = String(p.CODIGO || '') + '|' + fab;
    if (!fabM[fab]) fabM[fab] = { FABRICANTE: fab, QTD_PRODUTOS: 0, SALDO_TOTAL: 0, _p: {} };
    if (!fabM[fab]._p[cp]) { fabM[fab]._p[cp] = 1; fabM[fab].QTD_PRODUTOS++; }
    fabM[fab].SALDO_TOTAL += s;
    if (!lojaM[cod]) lojaM[cod] = { ESTABELECIMENTO: cod, NOME_LOJA: nl, QTD_PRODUTOS: 0, SALDO_TOTAL: 0, _p: {} };
    if (!lojaM[cod]._p[cp]) { lojaM[cod]._p[cp] = 1; lojaM[cod].QTD_PRODUTOS++; }
    lojaM[cod].SALDO_TOTAL += s;
    if (!rankM[fab]) rankM[fab] = { FABRICANTE: fab, QTD_PRODUTOS: 0, QTD_LOJAS: 0, SALDO_TOTAL: 0, _p: {}, _l: {} };
    if (!rankM[fab]._p[cp]) { rankM[fab]._p[cp] = 1; rankM[fab].QTD_PRODUTOS++; }
    if (!rankM[fab]._l[cod]) { rankM[fab]._l[cod] = 1; rankM[fab].QTD_LOJAS++; }
    rankM[fab].SALDO_TOTAL += s;
  });
  var sort = function (m) { return Object.values(m).sort(function (a, b) { return b.SALDO_TOTAL - a.SALDO_TOTAL; }); };
  return {
    fabricantes: sort(fabM), lojas: sort(lojaM), ranking: sort(rankM),
    total_saldo: produtos.reduce(function (s, p) { return s + (parseFloat(p.SALDO) || 0); }, 0),
    total_itens: produtos.length
  };
}

/* ── Render KPIs e Gráficos Estoque ─────────── */
function renderKpisEstoque(fabs, lojas, total, totalItens, dataRef) {
  function formatarDataBR(data) {
    if (!data) return 'hoje';

    // tenta converter
    const d = new Date(data);

    // valida data
    if (isNaN(d)) return data;

    return d.toLocaleDateString('pt-BR');
  }

  document.getElementById('kpiDataRef').textContent = 'Ref: ' + formatarDataBR(dataRef);
  document.getElementById('kpiTotal').textContent = fmt(total, 3) + ' g';
  document.getElementById('kpiFabricantes').textContent = fabs.length;
  document.getElementById('kpiItens').textContent = (totalItens || 0).toLocaleString('pt-BR');
  document.getElementById('kpiLojas').textContent = lojas.length;
  if (fabs.length) {
    document.getElementById('kpiMaiorFab').textContent = nomeFab(fabs[0].FABRICANTE).substring(0, 22);
    document.getElementById('kpiMaiorFabSub').textContent = fmt(fabs[0].SALDO_TOTAL, 3) + ' g';
  }
  if (lojas.length) {
    document.getElementById('kpiMaiorLoja').textContent = nomeLoja(lojas[0].NOME_LOJA, lojas[0].ESTABELECIMENTO).substring(0, 20);
    document.getElementById('kpiMaiorLojaSub').textContent = fmt(lojas[0].SALDO_TOTAL, 3) + ' g';
  }
}

function renderChartsEstoque(fabs, lojas) {
  // Barras fabricante
  if (chartFabE) chartFabE.destroy();
  chartFabE = new Chart(document.getElementById('chartFabricante'), {
    type: 'bar',
    data: {
      labels: fabs.map(function (f) { var n = nomeFab(f.FABRICANTE); return n.length > 22 ? n.slice(0, 22) + '…' : n; }),
      datasets: [{
        label: 'Saldo', data: fabs.map(function (f) { return parseFloat(f.SALDO_TOTAL) || 0; }),
        backgroundColor: PALETTE.map(function (c) { return c + 'cc'; }), borderColor: PALETTE, borderWidth: 2, borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + fmt(c.parsed.y, 3) + ' g'; } } } },
      scales: {
        x: { ticks: { color: '#8A8078', font: { size: 11 } }, grid: { color: '#E8E2D8' } },
        y: { ticks: { color: '#8A8078' }, grid: { color: '#E8E2D8' } }
      }
    }
  });
  // Pizza
  if (chartPizzaE) chartPizzaE.destroy();
  chartPizzaE = new Chart(document.getElementById('chartPizza'), {
    type: 'doughnut',
    data: {
      labels: fabs.map(function (f) { return nomeFab(f.FABRICANTE).substring(0, 24); }),
      datasets: [{
        data: fabs.map(function (f) { return parseFloat(f.SALDO_TOTAL) || 0; }),
        backgroundColor: PALETTE.map(function (c) { return c + 'cc'; }), borderColor: PALETTE, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#4A4440', font: { size: 12 }, boxWidth: 14, padding: 12 } },
        tooltip: { callbacks: { label: function (c) { return ' ' + fmt(c.parsed, 3) + ' g'; } } }
      }
    }
  });
  // Lojas
  if (chartLojaE) chartLojaE.destroy();
  var horiz = lojas.length > 5;
  var alt = horiz ? Math.max(260, lojas.length * 34) : 220;
  document.getElementById('wrapLoja').style.height = alt + 'px';
  chartLojaE = new Chart(document.getElementById('chartLoja'), {
    type: 'bar',
    data: {
      labels: lojas.map(function (l) { return nomeLoja(l.NOME_LOJA, l.ESTABELECIMENTO); }),
      datasets: [{
        label: 'Saldo', data: lojas.map(function (l) { return parseFloat(l.SALDO_TOTAL) || 0; }),
        backgroundColor: PALETTE.map(function (c) { return c + 'cc'; }), borderColor: PALETTE, borderWidth: 2, borderRadius: 4
      }]
    },
    options: {
      indexAxis: horiz ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var v = horiz ? c.parsed.x : c.parsed.y; return ' ' + fmt(v, 3) + ' g'; } } } },
      scales: {
        x: { ticks: { color: '#8A8078', font: { size: 11 } }, grid: { color: '#E8E2D8' } },
        y: { ticks: { color: '#4A4440', font: { size: horiz ? 11 : 10 } }, grid: { color: '#E8E2D8' } }
      }
    }
  });
}

/* ── Ranking ─────────────────────────────────── */
async function carregarRanking(p) {
  var el = document.getElementById('rankingFab');
  try {
    var d = await apiFetch('/api/estoque/ranking?limite=10&' + p).then(function (r) { return r.json(); });
    var ranking = d.ranking || []; var total = d.total_geral || 1;
    if (!ranking.length) { el.innerHTML = '<div class="empty">Nenhum dado encontrado.</div>'; return; }
    var maxVal = parseFloat(ranking[0].SALDO_TOTAL) || 1;
    var rows = ranking.map(function (r, i) {
      var pct = ((parseFloat(r.SALDO_TOTAL) || 0) / total * 100).toFixed(1);
      var bw = ((parseFloat(r.SALDO_TOTAL) || 0) / maxVal * 100).toFixed(0);
      return '<tr>' +
        '<td><strong>' + (i + 1) + '</strong></td>' +
        '<td>' + nomeFab(r.FABRICANTE).substring(0, 28) + '</td>' +
        '<td style="text-align:right">' + r.QTD_PRODUTOS + '</td>' +
        '<td style="text-align:right">' + r.QTD_LOJAS + '</td>' +
        '<td style="text-align:right" class="money">' + fmt(r.SALDO_TOTAL, 3) + ' g</td>' +
        '<td style="min-width:90px"><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:' + bw + '%"></div></div><span style="font-size:.72rem;color:#8A8078">' + pct + '%</span></div></td>' +
        '</tr>';
    }).join('');
    el.innerHTML = '<table class="dt"><thead><tr><th></th><th>Fabricante</th><th style="text-align:right">Produtos</th><th style="text-align:right">Lojas</th><th style="text-align:right">Saldo (g)</th><th>Part.%</th></tr></thead><tbody>' + rows + '</tbody></table>';
  } catch (e) { el.innerHTML = '<div class="empty">Erro ao carregar.</div>'; }
}

/* ── carregarTudo ────────────────────────────── */
async function carregarTudo() {
  var loja = document.getElementById('selLoja').value;
  var fab = document.getElementById('selFabricante').value;
  var coord = getCoordSelecionado();
  var p = getParams();

  if (coord && !loja) {
    try {
      var dc = await carregarProdutosPorCoordenador(coord);
      var agg = agregarDashboard(dc.produtos || []);
      renderKpisEstoque(agg.fabricantes, agg.lojas, agg.total_saldo, agg.total_itens, dc.data_ref);
      renderChartsEstoque(agg.fabricantes, agg.lojas);
      renderRankingLocal(agg.ranking);
      if (agg.fabricantes.length) gerarResumoIA(agg.fabricantes, agg.lojas, agg.ranking, { coordenador: coord });
    } catch (e) { console.error(e); }
    return;
  }

  await Promise.all([
    carregarResumoFabricante(p),
    carregarResumoLoja(p),
    carregarRanking(p),
  ]);
}

function renderRankingLocal(ranking) {
  var el = document.getElementById('rankingFab');
  if (!ranking.length) { el.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  var total = ranking.reduce(function (s, r) { return s + (parseFloat(r.SALDO_TOTAL) || 0); }, 0);
  var maxVal = parseFloat(ranking[0].SALDO_TOTAL) || 1;
  var rows = ranking.slice(0, 10).map(function (r, i) {
    var pct = ((parseFloat(r.SALDO_TOTAL) || 0) / total * 100).toFixed(1);
    var bw = ((parseFloat(r.SALDO_TOTAL) || 0) / maxVal * 100).toFixed(0);
    return '<tr><td><strong>' + (i + 1) + '</strong></td><td>' + nomeFab(r.FABRICANTE).substring(0, 28) + '</td>' +
      '<td style="text-align:right">' + r.QTD_PRODUTOS + '</td><td style="text-align:right">' + r.QTD_LOJAS + '</td>' +
      '<td style="text-align:right" class="money">' + fmt(r.SALDO_TOTAL, 3) + ' g</td>' +
      '<td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:' + bw + '%"></div></div><span style="font-size:.72rem;color:#8A8078">' + pct + '%</span></div></td></tr>';
  }).join('');
  el.innerHTML = '<table class="dt"><thead><tr><th></th><th>Fabricante</th><th style="text-align:right">Produtos</th><th style="text-align:right">Lojas</th><th style="text-align:right">Saldo (g)</th><th>Part.%</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

async function carregarResumoFabricante(p) {
  try {
    var d = await apiFetch('/api/estoque/por-fabricante?' + p).then(function (r) { return r.json(); });
    var fabs = d.fabricantes || []; var total = d.total_saldo || 0;
    var itens = fabs.reduce(function (s, f) { return s + (f.QTD_PRODUTOS || 0); }, 0);
    renderKpisEstoque(fabs, [], total, itens, d.data_ref);
    renderChartsEstoque(fabs, []);
    var loja = document.getElementById('selLoja').value;
    if (loja || fabs.length) gerarResumoIA(fabs, [], [], { loja, fabricante: document.getElementById('selFabricante').value, dataRef: d.data_ref });
  } catch (e) { console.error(e); }
}

async function carregarResumoLoja(p) {
  try {
    var d = await apiFetch('/api/estoque/por-loja?' + p).then(function (r) { return r.json(); });
    var lojas = d.lojas || [];
    document.getElementById('kpiLojas').textContent = lojas.length;
    if (lojas.length) {
      document.getElementById('kpiMaiorLoja').textContent = nomeLoja(lojas[0].NOME_LOJA, lojas[0].ESTABELECIMENTO).substring(0, 20);
      document.getElementById('kpiMaiorLojaSub').textContent = fmt(lojas[0].SALDO_TOTAL, 3) + ' g';
    }
    // Atualiza gráfico de lojas
    if (chartLojaE) chartLojaE.destroy();
    var horiz = lojas.length > 5;
    var alt = horiz ? Math.max(260, lojas.length * 34) : 220;
    document.getElementById('wrapLoja').style.height = alt + 'px';
    chartLojaE = new Chart(document.getElementById('chartLoja'), {
      type: 'bar',
      data: {
        labels: lojas.map(function (l) { return nomeLoja(l.NOME_LOJA, l.ESTABELECIMENTO); }),
        datasets: [{
          label: 'Saldo', data: lojas.map(function (l) { return parseFloat(l.SALDO_TOTAL) || 0; }),
          backgroundColor: PALETTE.map(function (c) { return c + 'cc'; }), borderColor: PALETTE, borderWidth: 2, borderRadius: 4
        }]
      },
      options: {
        indexAxis: horiz ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var v = horiz ? c.parsed.x : c.parsed.y; return ' ' + fmt(v, 3) + ' g'; } } } },
        scales: { x: { ticks: { color: '#8A8078', font: { size: 11 } }, grid: { color: '#E8E2D8' } }, y: { ticks: { color: '#4A4440', font: { size: horiz ? 11 : 10 } }, grid: { color: '#E8E2D8' } } }
      }
    });
  } catch (e) { console.error(e); }
}

/* ── Produtos ────────────────────────────────── */
function resetProdutos() {
  produtosCarregados = false; todosProdutos = [];
  document.getElementById('countProdutos').textContent = '';
  if (produtosAbertos) {
    document.getElementById('produtosConteudo').innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--text-3)">Filtros alterados. Clique em <strong>Ver Produtos</strong> para recarregar.</div>';
  }
}

function toggleProdutos() {
  var area = document.getElementById('produtosArea');
  var btn = document.getElementById('btnVerProdutos');
  produtosAbertos = !produtosAbertos;
  if (produtosAbertos) {
    area.style.display = 'block';
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg> Ocultar';
    btn.style.background = '#4A4440';
    if (!produtosCarregados) carregarProdutos();
  } else {
    area.style.display = 'none';
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Ver Produtos';
    btn.style.background = 'var(--accent)';
  }
}

async function carregarProdutos() {
  var conteudo = document.getElementById('produtosConteudo');
  var loja = document.getElementById('selLoja').value;
  var fab = document.getElementById('selFabricante').value;
  var coord = getCoordSelecionado();
  if (coord && !loja) {
    try {
      var dc = await carregarProdutosPorCoordenador(coord);
      todosProdutos = dc.produtos || []; produtosCarregados = true;
      document.getElementById('filtroProduto').value = '';
      renderProdutosPorFabricante(todosProdutos);
    } catch (e) { conteudo.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger)">❌ ' + e.message + '</div>'; }
    return;
  }
  if (!loja && !fab) {
    conteudo.innerHTML = '<div style="text-align:center;padding:24px;background:var(--accent-lt);border-radius:8px;font-size:.88rem;color:var(--accent)"> Selecione uma <strong>loja</strong> ou um <strong>fabricante</strong>.</div>';
    return;
  }
  conteudo.innerHTML = '<div style="text-align:center;padding:32px"><div class="spinner"></div><br><span style="color:var(--text-3);font-size:.85rem">Buscando produtos...</span></div>';
  try {
    var p = getParams(); p.set('limite', 9999);
    var d = await apiFetch('/api/estoque?' + p).then(function (r) { return r.json(); });
    if (d.erro) { conteudo.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger)">❌ ' + d.erro + '</div>'; return; }
    todosProdutos = d.estoque || []; produtosCarregados = true;
    document.getElementById('filtroProduto').value = '';
    renderProdutosPorFabricante(todosProdutos);
  } catch (e) { conteudo.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger)">❌ ' + e.message + '</div>'; }
}

function extrairFamilia(nome) {
  if (!nome) return 'OUTROS';
  return nome.trim().split(/\s+/)[0].toUpperCase() || 'OUTROS';
}

function renderProdutosPorFabricante(dados) {
  var conteudo = document.getElementById('produtosConteudo');
  var count = document.getElementById('countProdutos');
  if (!dados.length) { conteudo.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>'; count.textContent = ''; return; }
  var saldoTotal = dados.reduce(function (s, p) { return s + (parseFloat(p.SALDO) || 0); }, 0);
  count.textContent = dados.length.toLocaleString('pt-BR') + ' produto(s) · Saldo total: ' + fmt(saldoTotal, 3) + ' g';
  var grupos = {};
  dados.forEach(function (p) {
    var fab = (p.FABRICANTE || 'Sem Fabricante').trim();
    var fam = extrairFamilia(p.NOME);
    if (!grupos[fab]) grupos[fab] = { saldo: 0, familias: {} };
    grupos[fab].saldo += parseFloat(p.SALDO) || 0;
    if (!grupos[fab].familias[fam]) grupos[fab].familias[fam] = { saldo: 0, qtd: 0, produtos: [] };
    grupos[fab].familias[fam].saldo += parseFloat(p.SALDO) || 0;
    grupos[fab].familias[fam].qtd++;
    grupos[fab].familias[fam].produtos.push(p);
  });
  var fabsOrd = Object.keys(grupos).sort(function (a, b) { return grupos[b].saldo - grupos[a].saldo; });
  var html = '';
  fabsOrd.forEach(function (fab, fi) {
    var g = grupos[fab]; var fId = 'fab_' + fi;
    var qtdT = Object.values(g.familias).reduce(function (s, f) { return s + f.qtd; }, 0);
    var isOpen = fabsOrd.length === 1;
    html += '<div class="fab-section">';
    html += '<div class="fab-header js-toggle-fab" data-target="' + fId + '">';
    html += '<div class="fab-header-title">📦 ' + fab + '</div>';
    html += '<div class="fab-header-meta"><span>' + qtdT + ' produtos</span><span>Saldo: <strong>' + fmt(g.saldo, 3) + ' g</strong></span><span id="seta_' + fId + '">' + (isOpen ? '▲' : '▼') + '</span></div>';
    html += '</div>';
    html += '<div id="' + fId + '" class="fab-body' + (isOpen ? ' open' : '') + '" style="padding:0">';
    var famOrd = Object.keys(g.familias).sort(function (a, b) { return g.familias[b].saldo - g.familias[a].saldo; });
    famOrd.forEach(function (fam, fmi) {
      var fm = g.familias[fam]; var fmId = fId + '_f' + fmi; var fmOpen = famOrd.length === 1;
      html += '<div style="border-bottom:1px solid var(--border)">';
      html += '<div class="js-toggle-fab" data-target="' + fmId + '" style="display:flex;align-items:center;justify-content:space-between;padding:9px 16px;background:var(--bg);cursor:pointer;border-left:3px solid var(--gold)">';
      html += '<span style="font-size:.85rem;font-weight:700;color:var(--gold)">🔖 ' + fam + '</span>';
      html += '<span style="font-size:.78rem;color:var(--text-3);display:flex;gap:14px;align-items:center"><span>' + fm.qtd + ' itens</span><span class="money">' + fmt(fm.saldo, 3) + ' g</span><span id="seta_' + fmId + '">' + (fmOpen ? '▲' : '▼') + '</span></span>';
      html += '</div>';
      html += '<div id="' + fmId + '" class="fab-body' + (fmOpen ? ' open' : '') + '"><table class="dt"><thead><tr><th>Código</th><th>Produto</th><th style="text-align:center">Est.</th><th>Loja</th><th style="text-align:right">Saldo (g)</th></tr></thead><tbody>';
      fm.produtos.forEach(function (p) {
        html += '<tr><td><strong>' + p.CODIGO + '</strong></td><td>' + (p.NOME || '—') + '</td><td style="text-align:center">' + p.ESTABELECIMENTO + '</td><td>' + (p.NOME_ESTABELECIMENTO || '—') + '</td><td style="text-align:right" class="money">' + fmt(p.SALDO, 3) + ' g</td></tr>';
      });
      html += '</tbody></table></div></div>';
    });
    html += '</div></div>';
  });
  conteudo.innerHTML = html;
}

function toggleFab(id) {
  var body = document.getElementById(id); var seta = document.getElementById('seta_' + id);
  if (!body) return;
  if (body.classList.contains('open')) { body.classList.remove('open'); seta.textContent = '▼'; }
  else { body.classList.add('open'); seta.textContent = '▲'; }
}

function filtrarProdutos() {
  if (!produtosCarregados) return;
  var t = document.getElementById('filtroProduto').value.toLowerCase();
  var d = t ? todosProdutos.filter(function (p) { return (p.NOME || '').toLowerCase().includes(t) || (p.FABRICANTE || '').toLowerCase().includes(t) || String(p.CODIGO || '').includes(t); }) : todosProdutos;
  renderProdutosPorFabricante(d);
}

async function limparCacheAPI() {
  try {
    await apiFetch('/api/cache/limpar', { method: 'POST' });
    resetProdutos();
    showToast('✅ Cache limpo! Próxima consulta buscará dados atualizados.', 'ok');
  } catch (e) { showToast('Erro: ' + e.message); }
}

/* ════════════════════════════════════════════════
   VENDAS
════════════════════════════════════════════════ */
// Datas padrão
(function () {
  var hoje = new Date();
  var ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  function fi(d) { return d.toISOString().slice(0, 10); }
  document.getElementById('vDataInicio').value = fi(ini);
  document.getElementById('vDataFim').value = fi(hoje);
})();

function toggleCoordV(el) {
  var coord = el.dataset.coord;
  var classes = { Bruno: 'b-active', Gabriel: 'g-active', Raiane: 'r-active' };
  if (vCoordAtivo === coord) {
    vCoordAtivo = null;
    el.classList.remove('active', classes[coord] || 'active');
  } else {
    document.querySelectorAll('.coord-pill').forEach(function (p) {
      p.classList.remove('active', 'b-active', 'g-active', 'r-active');
    });
    vCoordAtivo = coord;
    el.classList.add('active', classes[coord] || 'active');
    document.getElementById('vLoja').value = '';
  }
}

function limparVendas() {
  vCoordAtivo = null;
  document.querySelectorAll('.coord-pill').forEach(function (p) { p.classList.remove('active', 'b-active', 'g-active', 'r-active'); });
  document.getElementById('vLoja').value = '';
  document.getElementById('vFabricante').value = '';
  var hoje = new Date(); var ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById('vDataInicio').value = ini.toISOString().slice(0, 10);
  document.getElementById('vDataFim').value = hoje.toISOString().slice(0, 10);
}

function badgeFab(nome) {
  if (!nome) return '<span class="badge-fab badge-other">—</span>';
  var u = nome.toUpperCase();
  if (u.includes('SG METAIS')) return '<span class="badge-fab badge-sg">SG Metais</span>';
  if (u.includes('MANTOVANI')) return '<span class="badge-fab badge-mant">Mantovani</span>';
  if (u.includes('ELLOS')) return '<span class="badge-fab badge-ellos">Ellos Gold</span>';
  return '<span class="badge-fab badge-other">' + nome.split(' ')[0] + '</span>';
}

function abrevFab(nome) {
  if (!nome) return '—';
  var u = nome.toUpperCase();
  if (u.includes('SG METAIS')) return 'SG Metais';
  if (u.includes('MANTOVANI')) return 'Mantovani';
  if (u.includes('ELLOS')) return 'Ellos Gold';
  return nome.split(' ')[0];
}

function fmtData(v) {
  if (!v) return '—';
  if (typeof v === 'string' && v.includes('T')) return new Date(v).toLocaleDateString('pt-BR');
  return String(v).slice(0, 10);
}

async function buscarVendas() {
  var di = document.getElementById('vDataInicio').value;
  var df = document.getElementById('vDataFim').value;
  var fab = document.getElementById('vFabricante').value;
  var lj = document.getElementById('vLoja').value;
  if (!di || !df) { showToast('⚠️ Informe o período de consulta.'); return; }
  if (di > df) { showToast('⚠️ Data início deve ser anterior à data fim.'); return; }
  var btn = document.getElementById('btnBuscarV');
  btn.disabled = true; btn.textContent = '⏳ Carregando...';
  var params = new URLSearchParams({ data_inicio: di, data_fim: df });
  if (fab) params.set('fabricante', fab);
  if (vCoordAtivo) params.set('coordenador', vCoordAtivo);
  else if (lj) params.set('interno_est', lj);
  try {
    var r = await apiFetch('/api/vendas?' + params);
    var data = await r.json();
    if (data.erro) { showToast('Erro: ' + data.erro); return; }
    renderVendas(data);
  } catch (e) { showToast('Falha ao conectar: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = ' Consultar Vendas'; }
}

function renderVendas(data) {
  var vendas = data.vendas || [];
  var topProd = data.top_produtos || [];
  var porFab = data.por_fabricante || [];
  var porLoja = data.por_loja || [];
  var totalItens = data.total_itens || 0;
  var totalQtd = vendas.reduce(function (s, r) { return s + (parseFloat(r.QUANTIDADE) || 0); }, 0);
  var vc = document.getElementById('vendasContent');
  vc.innerHTML = '';

  // KPIs
  var kGrid = document.createElement('div');
  kGrid.className = 'kpi-grid-4';
  kGrid.innerHTML =
    vKpi('Total de Notas', totalItens.toLocaleString('pt-BR'), 'Lançamentos no Período') +
    vKpi('Itens Vendidos', totalQtd.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), 'Quantidade Total') +
    vKpi('Lojas com Venda', porLoja.length, 'Estabelecimentos Ativos') +
    vKpi('Top Produto', topProd.length ? topProd[0].produto.split(' ').slice(0, 3).join(' ') + '…' : '—', topProd.length ? topProd[0].quantidade.toFixed(0) + ' un.' : '');
  vc.appendChild(kGrid);

  // Charts row
  var cg = document.createElement('div');
  cg.className = 'v-charts-grid';

  var cFab = document.createElement('div');
  cFab.className = 'v-chart-card';
  cFab.innerHTML = '<div class="v-chart-title"><i class="fi fi-rr-chat-arrow-grow"></i></div> Por Fabricante</div><div class="v-chart-wrap"><canvas id="vChartFab"></canvas></div>';
  cg.appendChild(cFab);

  var cLoja = document.createElement('div');
  cLoja.className = 'v-chart-card';
  cLoja.innerHTML = '<div class="v-chart-title"><img src="/img/local.svg" alt="Local" width="18" height="18"> Top Lojas — Qtd Vendida</div><div class="v-chart-wrap"><canvas id="vChartLoja"></canvas></div>';
  cg.appendChild(cLoja);
  vc.appendChild(cg);

  // Top produtos
  var tpCard = document.createElement('div');
  tpCard.className = 'v-chart-card';
  var rankHtml = '<div class="v-chart-title"><img src="/img/rank.svg" width="18" style="vertical-align:middle; margin-right:6px;"> Top 20 Produtos Mais Vendidos</div><div class="rank-list">';
  var maxQ = topProd.length ? topProd[0].quantidade : 1;
  topProd.forEach(function (p, i) {
    var pct = (p.quantidade / maxQ * 100).toFixed(0);
    rankHtml += '<div class="rank-item">' +
      '<div class="rank-num' + (i < 3 ? ' gold' : '') + '">' + (i + 1) + '</div>' +
      '<div class="rank-bar-wrap">' +
      '<div class="rank-name">' + p.produto.substring(0, 50) + ' ' + badgeFab(p.fabricante) + '</div>' +
      '<div class="rank-bar-bg"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="rank-qty">' + p.quantidade.toFixed(0) + '</div>' +
      '</div>';
  });
  rankHtml += '</div>';
  tpCard.innerHTML = rankHtml;
  vc.appendChild(tpCard);

  // Tabela
  var tCard = document.createElement('div');
  tCard.className = 'v-table-card';
  tCard.innerHTML =
    '<div class="v-table-header">' +
    '<div><div class="v-table-title"><img src="/img/search.svg" alt="Local" width="18" height="18"> Detalhamento de Vendas</div><div class="v-table-count">' + totalItens.toLocaleString('pt-BR') + ' registros</div></div>' +
    '<input class="v-search" id="filtroTabelaVendas" placeholder=" Filtrar tabela…"/>' +
    '</div>' +
    '<div class="v-table-wrap">' +
    '<table class="vt"><thead><tr><th>Nota</th><th>Data</th><th>Loja</th><th>Fabricante</th><th>Produto</th><th style="text-align:right">Qtd</th><th>Modelo</th></tr></thead>' +
    '<tbody id="tbodyV"></tbody></table></div>';
  vc.appendChild(tCard);

  var tbody = document.getElementById('tbodyV');
  vendas.forEach(function (r) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-weight:600;color:var(--text-1)">' + (r.NOTA_NUMERO || '—') + '</td>' +
      '<td>' + fmtData(r.DATA_EMISSAO) + '</td>' +
      '<td title="' + r.ESTABELECIMENTO + '">' + ((r.ESTABELECIMENTO || '').split(' - ').pop()) + '</td>' +
      '<td>' + badgeFab(r.FABRICANTE) + '</td>' +
      '<td title="' + r.PRODUTO + '">' + (r.PRODUTO || '').substring(0, 42) + (r.PRODUTO && r.PRODUTO.length > 42 ? '…' : '') + '</td>' +
      '<td style="text-align:right;font-weight:700;color:var(--gold)">' + parseFloat(r.QUANTIDADE || 0).toFixed(2) + '</td>' +
      '<td style="color:var(--text-3)">' + (r.MODELO || '—') + '</td>';
    tbody.appendChild(tr);
  });

  // Charts
  setTimeout(function () {
    if (chartFabV) chartFabV.destroy();
    chartFabV = new Chart(document.getElementById('vChartFab'), {
      type: 'doughnut',
      data: {
        labels: porFab.map(function (f) { return abrevFab(f.fabricante); }),
        datasets: [{
          data: porFab.map(function (f) { return f.quantidade; }),
          backgroundColor: ['#1A3A6B', '#A8762A', '#166534', '#7c3aed'],
          borderColor: '#FFFFFF', borderWidth: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#4A4440', font: { size: 12 }, padding: 14 } },
          tooltip: { callbacks: { label: function (c) { return ' ' + abrevFab(c.label) + ': ' + c.parsed.toFixed(0); } } }
        }
      }
    });
    if (chartLojaV) chartLojaV.destroy();
    var topL = porLoja.slice(0, 10);
    chartLojaV = new Chart(document.getElementById('vChartLoja'), {
      type: 'bar',
      data: {
        labels: topL.map(function (l) { return l.nome_loja.split(' - ').pop(); }),
        datasets: [{
          label: 'Qtd', data: topL.map(function (l) { return l.quantidade; }),
          backgroundColor: 'rgba(168,118,42,.75)', borderColor: '#A8762A', borderWidth: 1, borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#E8E2D8' }, ticks: { color: '#8A8078', font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#1A1612', font: { size: 12 } } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }, 50);
}

function vKpi(label, value, sub) {
  return '<div class="v-kpi"><div class="v-kpi-label">' + label + '</div><div class="v-kpi-valor">' + value + '</div><div class="v-kpi-sub">' + sub + '</div></div>';
}

function filtrarTabelaV(q) {
  q = q.toLowerCase();
  var rows = document.querySelectorAll('#tbodyV tr');
  rows.forEach(function (tr) { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}

/* ════════════════════════════════════════════════
   CHAT IA MIDAS
════════════════════════════════════════════════ */
function toggleChat() {
  if (chatMinimizado) {
    chatMinimizado = false;
    document.getElementById('chatBox').classList.add('open');
    document.getElementById('chatBtn').textContent = '✕';
    chatAberto = true;
  } else if (chatAberto) {
    fecharChat();
  } else {
    abrirChat();
  }
}

function abrirChat() {
  chatAberto = true; chatMinimizado = false;
  document.getElementById('chatBox').classList.add('open');
  document.getElementById('chatBtn').textContent = '✕';
  setTimeout(function () { document.getElementById('chatInput').focus(); }, 100);
}

function fecharChat() {
  chatAberto = false;
  chatMinimizado = false;
  document.getElementById('chatBox').classList.remove('open');
  document.getElementById('chatBtn').innerHTML =
    '<img src="/img/assets/voice-bot.svg" class="chat-btn-icon" alt="Bot">';
}

function minimizarChat() {
  chatMinimizado = true; chatAberto = false;
  document.getElementById('chatBox').classList.remove('open');
  document.getElementById('chatBtn').innerHTML = '<img src="/img/assets/voice-bot.svg" class="chat-btn-icon" alt="Bot">';
  document.getElementById('chatBtn').classList.add('minimized');
}

function perguntaRapida(texto) {
  if (!chatAberto) abrirChat();
  document.getElementById('chatInput').value = texto;
  document.getElementById('chatQuick').style.display = 'none';
  enviarChat();
}

async function enviarChat() {
  var input = document.getElementById('chatInput');
  var texto = input.value.trim();
  if (!texto) return;
  var send = document.getElementById('chatSend');
  var msgs = document.getElementById('chatMsgs');
  chatHistorico.push({ role: 'user', content: texto });
  addMsg(texto, 'user');
  input.value = ''; input.style.height = 'auto';
  send.disabled = true;
  var loadId = 'load_' + Date.now();
  var loadRow = document.createElement('div');
  loadRow.className = 'msg-row'; loadRow.id = 'row_' + loadId;
  loadRow.innerHTML = '<div class="msg-icon ia-icon"><img src="/img/assets/voice-bot.svg" class="chat-icon"></div><div class="msg ia loading" id="' + loadId + '"><div class="dot-anim"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(loadRow); msgs.scrollTop = msgs.scrollHeight;
  try {
    var d = await apiFetch('/api/ia/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagens: chatHistorico }) }).then(function (r) { return r.json(); });
    var el = document.getElementById('row_' + loadId); if (el) el.remove();
    var resp = d.resposta || d.erro || 'Erro ao processar.';
    chatHistorico.push({ role: 'assistant', content: resp });
    addMsg(resp, 'ia');
  } catch (e) {
    var el2 = document.getElementById('row_' + loadId); if (el2) el2.remove();
    addMsg('Erro de conexão. Verifique se o servidor está ativo.', 'ia');
  }
  send.disabled = false; input.focus();

  /* quero retornar a pergunta rápida após a resposta */

  setTimeout(function () {
    document.getElementById('chatQuick').style.display = 'flex';
  }, 20);
}

function addMsg(texto, tipo) {
  var msgs = document.getElementById('chatMsgs');
  var row = document.createElement('div');
  row.className = 'msg-row' + (tipo === 'user' ? ' user' : '');
  var icon = document.createElement('div');
  icon.className = 'msg-icon ' + (tipo === 'user' ? 'usr-icon' : 'ia-icon');
  icon.innerHTML = tipo === 'user'
    ? 'EU'
    : '<img src="/img/assets/voice-bot.svg" class="chat-icon" alt="Bot">';
  var div = document.createElement('div');
  div.className = 'msg ' + tipo;
  div.textContent = texto;
  if (tipo === 'user') { row.appendChild(div); row.appendChild(icon); }
  else { row.appendChild(icon); row.appendChild(div); }
  msgs.appendChild(row); msgs.scrollTop = msgs.scrollHeight;
}

/* ── Resumo IA ─────────────────────────────── */
/*     async function gerarResumoIA(fabricantes, lojas, ranking, filtros) {
      var el = document.getElementById('resumoIA');
      var txt = document.getElementById('resumoIATexto');
      el.style.display = 'block'; el.classList.add('loading');
      txt.textContent = 'Gerando análise inteligente...';
      try {
        var d = await apiFetch('/api/ia/resumo-estoque', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fabricantes, lojas, ranking, filtros })
        }).then(function (r) { return r.json(); });
        el.classList.remove('loading');
        txt.textContent = d.resumo || 'Não foi possível gerar o resumo.';
      } catch (e) { el.classList.remove('loading'); txt.textContent = 'Erro ao gerar análise.'; }
    } */



// Função segura para evitar ReferenceError quando o resumo IA estiver desativado.
// Mantém o dashboard funcionando sem disparar análise automática.
async function gerarResumoIA(fabricantes, lojas, ranking, filtros) {
  var el = document.getElementById('resumoIA');
  if (el) el.style.display = 'none';
  return null;
}

/* ════════════════════════════════════════════════
   AUDITORIA — ESTOQUE GRADE / CÓDIGO BARRAS
════════════════════════════════════════════════ */
var auditoriaDados = [];
var auditoriaDadosFiltrados = [];

var AUDITORIA_COLUNAS = [
  { key: 'codigo', label: 'Código', align: 'left', valor: function (r) { return r.CODIGO || ''; } },
  { key: 'codigo_barras', label: 'Cód. Barras', align: 'left', valor: function (r) { return r.CODIGO_BARRAS || ''; } },
  { key: 'produto', label: 'Produto', align: 'left', valor: function (r) { return r.NOME || ''; } },
  { key: 'unidade', label: 'Un.', align: 'left', valor: function (r) { return r.UNIDADE || ''; } },
  { key: 'grade', label: 'Grade', align: 'left', valor: function (r) { return r.GRADE || ''; } },
  { key: 'saldo', label: 'Saldo', align: 'right', valor: function (r) { return fmt(r.SD_ATUAL, 3); } },
  { key: 'vl_compra', label: 'Vl. Compra', align: 'right', valor: function (r) { return (r.VL_COMPRA === null || r.VL_COMPRA === undefined) ? '—' : 'R$ ' + fmt(r.VL_COMPRA, 2); } },
  { key: 'total', label: 'Total', align: 'right', valor: function (r) { return (r.TOTAL_P === null || r.TOTAL_P === undefined) ? '—' : 'R$ ' + fmt(r.TOTAL_P, 2); } }
];

function dataHojeInput() {
  var hoje = new Date();
  return hoje.getFullYear() + '-' +
    String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
    String(hoje.getDate()).padStart(2, '0');
}

function escapeHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getColunasAuditoriaSelecionadas() {
  var marcadas = Array.prototype.slice.call(document.querySelectorAll('.auditoria-col:checked')).map(function (el) {
    return el.value;
  });
  if (!marcadas.length) marcadas = AUDITORIA_COLUNAS.map(function (c) { return c.key; });
  return AUDITORIA_COLUNAS.filter(function (c) { return marcadas.indexOf(c.key) >= 0; });
}

function deveConsultarValoresAuditoria() {
  var colunas = Array.prototype.slice.call(document.querySelectorAll('.auditoria-col:checked')).map(function (el) {
    return el.value;
  });

  // Consulta preço de compra somente se o usuário quiser visualizar/exportar
  // Vl. Compra ou Total. Se ambos estiverem desmarcados, a API usa consulta leve.
  return colunas.indexOf('vl_compra') >= 0 || colunas.indexOf('total') >= 0;
}

function deveConsultarGradeAuditoria() {
  var colunas = Array.prototype.slice.call(document.querySelectorAll('.auditoria-col:checked')).map(function (el) {
    return el.value;
  });

  // Consulta a tabela GRADE somente se o usuário quiser visualizar/exportar Grade.
  // Se Grade estiver desmarcado, a API evita o JOIN com GRADE para deixar a consulta mais leve.
  return colunas.indexOf('grade') >= 0;
}

function extrairTipoAuditoria(nome) {
  return String(nome || '').trim().split(/\s+/)[0].toUpperCase();
}

function atualizarTiposAuditoria(dados) {
  var sel = document.getElementById('filtroTipoAuditoria');
  if (!sel) return;

  var selecionado = sel.value || '';
  var tipos = {};
  (dados || []).forEach(function (r) {
    var tipo = extrairTipoAuditoria(r.NOME);
    if (tipo) tipos[tipo] = true;
  });

  var lista = Object.keys(tipos).sort();
  sel.innerHTML = '<option value="">Todos os tipos</option>' + lista.map(function (tipo) {
    return '<option value="' + escapeHtml(tipo) + '">' + escapeHtml(tipo.charAt(0) + tipo.slice(1).toLowerCase()) + '</option>';
  }).join('');

  if (selecionado && tipos[selecionado]) sel.value = selecionado;
}

function getDadosAuditoriaFiltrados() {
  var qEl = document.getElementById('filtroAuditoria');
  var tipoEl = document.getElementById('filtroTipoAuditoria');
  var q = qEl ? String(qEl.value || '').toLowerCase().trim() : '';
  var tipo = tipoEl ? String(tipoEl.value || '').toUpperCase().trim() : '';

  return auditoriaDados.filter(function (r) {
    var okTipo = !tipo || extrairTipoAuditoria(r.NOME) === tipo;
    var okBusca = !q ||
      String(r.CODIGO || '').toLowerCase().includes(q) ||
      String(r.CODIGO_BARRAS || '').toLowerCase().includes(q) ||
      String(r.NOME || '').toLowerCase().includes(q) ||
      String(r.UNIDADE || '').toLowerCase().includes(q) ||
      String(r.GRADE || '').toLowerCase().includes(q);

    return okTipo && okBusca;
  });
}


function getOrigemAuditoria() {
  var el = document.getElementById('aOrigem');
  return el ? (el.value || 'matriz') : 'matriz';
}

async function carregarLojasAuditoria() {
  var origem = getOrigemAuditoria();
  var sel = document.getElementById('aLoja');
  if (!sel) return;

  sel.innerHTML = '<option value="">Carregando lojas...</option>';

  try {
    var d = await apiFetch('/api/estabelecimentos?origem=' + encodeURIComponent(origem)).then(function (r) { return r.json(); });
    var lojas = d.estabelecimentos || [];

    sel.innerHTML = '';

    if (!lojas.length) {
      sel.innerHTML = '<option value="">Nenhuma loja encontrada</option>';
      return;
    }

    lojas.forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.INTERNO;
      o.textContent = e.INTERNO + ' — ' + (e.FANTASIA || e.NOME || '').trim();
      sel.appendChild(o);
    });
  } catch (e) {
    console.error(e);
    sel.innerHTML = '<option value="1">1 — Loja padrão</option>';
    showToast('Erro ao carregar lojas da origem selecionada.');
  }
}

async function buscarAuditoria() {
  var origem = getOrigemAuditoria();
  var loja = document.getElementById('aLoja').value || 1;
  var data = document.getElementById('aData').value || dataHojeInput();
  var tbody = document.getElementById('tbodyAuditoria');
  var resumo = document.getElementById('auditoriaResumo');

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px"><div class="spinner"></div><br>Consultando auditoria...</td></tr>';
  resumo.textContent = 'Consultando dados no Firebird...';

  try {
    var p = new URLSearchParams();
    p.set('origem', origem);
    p.set('interno_est', loja);
    p.set('data', data);
    p.set('incluir_valores', deveConsultarValoresAuditoria() ? '1' : '0');
    p.set('incluir_grade', deveConsultarGradeAuditoria() ? '1' : '0');

    var resp = await apiFetch('/api/auditoria/estoque-grade?' + p);
    var textoResp = await resp.text();
    var d;

    try {
      d = JSON.parse(textoResp);
    } catch (jsonErr) {
      throw new Error('A API retornou HTML/erro em vez de JSON. Status HTTP: ' + resp.status);
    }

    if (!resp.ok) {
      throw new Error(d.erro || ('Erro HTTP ' + resp.status));
    }

    if (d.erro) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">' + escapeHtml(d.erro) + '</td></tr>';
      resumo.textContent = 'Erro na consulta.';
      return;
    }

    auditoriaDados = d.auditoria || [];

    var filtroTexto = document.getElementById('filtroAuditoria');
    var filtroTipo = document.getElementById('filtroTipoAuditoria');
    if (filtroTexto) filtroTexto.value = '';
    if (filtroTipo) filtroTipo.value = '';

    atualizarTiposAuditoria(auditoriaDados);

    document.getElementById('aKpiItens').textContent = (d.total_itens || 0).toLocaleString('pt-BR');
    document.getElementById('aKpiSaldo').textContent = fmt(d.total_saldo || 0, 3) + ' g';
    document.getElementById('aKpiValor').textContent = d.incluir_valores === false ? '—' : 'R$ ' + fmt(d.total_valor || 0, 2);
    document.getElementById('aKpiData').textContent = data.split('-').reverse().join('/');

    var avisosConsultaLeve = [];
    if (d.incluir_grade === false) avisosConsultaLeve.push('sem grade');
    if (d.incluir_valores === false) avisosConsultaLeve.push('sem preço de compra/total');

    resumo.textContent = (d.total_itens || 0).toLocaleString('pt-BR') + ' item(ns) encontrados em ' + origem.toUpperCase() + ' · loja ' + loja +
      (avisosConsultaLeve.length ? ' · Consulta leve ' + avisosConsultaLeve.join(' e ') + '.' : '.');
    aplicarFiltrosAuditoria();

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">Erro: ' + escapeHtml(e.message) + '</td></tr>';
    resumo.textContent = 'Falha ao consultar auditoria.';
  }
}

function renderTabelaAuditoria(dados) {
  var tbody = document.getElementById('tbodyAuditoria');
  var thead = document.getElementById('theadAuditoria');
  var colunas = getColunasAuditoriaSelecionadas();

  if (thead) {
    thead.innerHTML = '<tr>' + colunas.map(function (c) {
      return '<th' + (c.align === 'right' ? ' style="text-align:right"' : '') + '>' + escapeHtml(c.label) + '</th>';
    }).join('') + '</tr>';
  }

  if (!dados.length) {
    tbody.innerHTML = '<tr><td colspan="' + colunas.length + '" style="text-align:center;color:var(--text-3)">Nenhum item encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = dados.map(function (r) {
    return '<tr>' + colunas.map(function (c) {
      var valor = c.valor(r);
      var tdStyle = c.align === 'right' ? ' style="text-align:right"' : '';
      var classe = (c.key === 'saldo' || c.key === 'total') ? ' class="money"' : '';
      if (c.key === 'codigo') valor = '<strong>' + escapeHtml(valor) + '</strong>';
      else valor = escapeHtml(valor);
      return '<td' + tdStyle + classe + '>' + valor + '</td>';
    }).join('') + '</tr>';
  }).join('');
}

function aplicarFiltrosAuditoria() {
  auditoriaDadosFiltrados = getDadosAuditoriaFiltrados();
  renderTabelaAuditoria(auditoriaDadosFiltrados);

  var resumo = document.getElementById('auditoriaResumo');
  var loja = document.getElementById('aLoja') ? document.getElementById('aLoja').value : '';
  if (resumo && auditoriaDados.length) {
    resumo.textContent = auditoriaDadosFiltrados.length.toLocaleString('pt-BR') + ' item(ns) exibidos de ' + auditoriaDados.length.toLocaleString('pt-BR') + ' encontrados na loja ' + loja + '.';
  }
}

function filtrarAuditoria(q) {
  var el = document.getElementById('filtroAuditoria');
  if (el && el.value !== q) el.value = q || '';
  aplicarFiltrosAuditoria();
}

function baixarArquivo(nome, conteudo, mime) {
  var blob = new Blob([conteudo], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function nomeArquivoAuditoria(ext) {
  var loja = document.getElementById('aLoja') ? document.getElementById('aLoja').value : 'loja';
  var data = document.getElementById('aData') ? document.getElementById('aData').value : dataHojeInput();
  var origem = getOrigemAuditoria();
  return 'auditoria_estoque_' + origem + '_loja_' + loja + '_' + data + '.' + ext;
}

function exportarAuditoriaExcel() {
  var dados = auditoriaDadosFiltrados.length ? auditoriaDadosFiltrados : getDadosAuditoriaFiltrados();
  if (!dados.length) return showToast('Consulte ou filtre a auditoria antes de exportar.');

  var colunas = getColunasAuditoriaSelecionadas();
  var linhas = [];
  linhas.push(colunas.map(function (c) { return c.label; }).join(';'));
  dados.forEach(function (r) {
    linhas.push(colunas.map(function (c) {
      return '"' + String(c.valor(r)).replace(/"/g, '""') + '"';
    }).join(';'));
  });

  baixarArquivo(nomeArquivoAuditoria('csv'), '\ufeff' + linhas.join('\n'), 'text/csv;charset=utf-8;');
  showToast('Excel gerado com os filtros atuais.', 'ok');
}

function exportarAuditoriaPDF() {
  var dados = auditoriaDadosFiltrados.length ? auditoriaDadosFiltrados : getDadosAuditoriaFiltrados();
  if (!dados.length) return showToast('Consulte ou filtre a auditoria antes de exportar.');

  var colunas = getColunasAuditoriaSelecionadas();
  var lojaSel = document.getElementById('aLoja');
  var loja = lojaSel ? lojaSel.options[lojaSel.selectedIndex].text : '';
  var data = document.getElementById('aData') ? document.getElementById('aData').value.split('-').reverse().join('/') : '';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Auditoria Estoque</title>' +
    '<style>body{font-family:Arial,sans-serif;color:#222;margin:24px}h1{font-size:18px;margin:0 0 6px}p{font-size:12px;margin:0 0 14px;color:#555}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#f3efe8;color:#6f6258;text-transform:uppercase;font-size:9px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}td.right,th.right{text-align:right}.money{font-weight:700}@media print{body{margin:12mm}}</style>' +
    '</head><body><h1>Auditoria — Estoque por Grade / Código de Barras</h1>' +
    '<p>' + escapeHtml(loja) + ' · Data referência: ' + escapeHtml(data) + ' · Itens exibidos: ' + dados.length.toLocaleString('pt-BR') + '</p>' +
    '<table><thead><tr>' + colunas.map(function (c) { return '<th class="' + (c.align === 'right' ? 'right' : '') + '">' + escapeHtml(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    dados.map(function (r) {
      return '<tr>' + colunas.map(function (c) {
        return '<td class="' + (c.align === 'right' ? 'right ' : '') + ((c.key === 'saldo' || c.key === 'total') ? 'money' : '') + '">' + escapeHtml(c.valor(r)) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table><script>window.onload=function(){window.print();}</script></body></html>';

  var w = window.open('', '_blank');
  if (!w) return showToast('Pop-up bloqueado. Libere pop-ups para gerar PDF.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}

(function iniciarAuditoriaData() {
  setTimeout(function () {
    var el = document.getElementById('aData');
    if (el && !el.value) el.value = dataHojeInput();
  }, 100);
})();




/* ════════════════════════════════════════════════
   CONSULTAS ERP — CONTRATOS / VENDAS VITRINE
════════════════════════════════════════════════ */
var consultaTipoAtivo = 'contrato_120';
var consultaPedidos = [];


function atualizarTiposConsultaPorOrigem() {
  var origemEl = document.getElementById('cOrigem');
  if (!origemEl) return;

  var origem = origemEl.value;
  var indisponiveisManaus = ['contrato_relogio_120', 'contrato_relogio_003', 'contrato_upgrade'];

  document.querySelectorAll('.consulta-tipo-btn').forEach(function (btn) {
    var tipo = btn.getAttribute('data-tipo');
    var indisponivel = origem === 'manaus' && indisponiveisManaus.indexOf(tipo) !== -1;
    btn.disabled = indisponivel;
    btn.style.opacity = indisponivel ? '.45' : '';
    btn.style.cursor = indisponivel ? 'not-allowed' : '';
    btn.title = indisponivel ? 'Modalidade sem status cadastrado no banco Manaus.' : '';
  });

  if (origem === 'manaus' && indisponiveisManaus.indexOf(consultaTipoAtivo) !== -1) {
    var padrao = document.querySelector('.consulta-tipo-btn[data-tipo="contrato_120"]');
    if (padrao) selecionarTipoConsulta(padrao);
  }
}

function selecionarTipoConsulta(btn) {
  document.querySelectorAll('.consulta-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  consultaTipoAtivo = btn.getAttribute('data-tipo');
  var nomes = {
    contrato_120: 'Contratos 120 dias',
    contrato_003: 'Contratos 003 dias',
    contrato_relogio_120: 'Contrato Relógio 120 dias',
    contrato_relogio_003: 'Contrato Relógio 003 dias',
    contrato_upgrade: 'Contrato Upgrade',
    vendas_vitrine: 'Vendas Vitrine'
  };
  document.getElementById('cTituloResultado').textContent = nomes[consultaTipoAtivo];
  document.getElementById('cKpiQtdLabel').textContent = consultaTipoAtivo === 'vendas_vitrine' ? 'Vendas' : 'Contratos';
  var valorLabel = document.getElementById('cKpiValorLabel');
  var valorSub = document.getElementById('cKpiValorSub');
  if (valorLabel) valorLabel.textContent = consultaTipoAtivo === 'vendas_vitrine' ? 'Valor líquido' : 'Valor total';
  if (valorSub) valorSub.textContent = consultaTipoAtivo === 'vendas_vitrine' ? 'bruto menos descontos' : 'sem duplicar pedidos';
}

async function carregarLojasConsultas() {
  var sel = document.getElementById('cLoja');
  if (!sel) return;
  var origem = document.getElementById('cOrigem').value;
  sel.innerHTML = '<option value="">Carregando...</option>';
  try {
    var d = await apiFetch('/api/estabelecimentos?origem=' + encodeURIComponent(origem)).then(function (r) { return r.json(); });
    sel.innerHTML = '<option value="">— Selecione a loja —</option>';
    (d.estabelecimentos || []).forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.INTERNO;
      o.textContent = e.INTERNO + ' — ' + (e.FANTASIA || e.NOME || '').trim();
      sel.appendChild(o);
    });
  } catch (e) {
    sel.innerHTML = '<option value="">Erro ao carregar lojas</option>';
    showToast('Não foi possível carregar as lojas.');
  }
}

function consultaDataBR(v) {
  if (!v) return '—';
  var d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10).split('-').reverse().join('/');
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function consultaNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === '') return 0;
  var texto = String(v).trim();
  if (texto.indexOf(',') !== -1) texto = texto.replace(/\./g, '').replace(',', '.');
  var numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function consultaMoeda(v) {
  return consultaNumero(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function agruparMovimentacoes(rows) {
  var mapa = {};
  (rows || []).forEach(function (r) {
    var id = String(r.INTERNO_PEDIDO);
    if (!mapa[id]) {
      var bruto = consultaNumero(r.TOTAL_BRUTO);
      var desconto = consultaNumero(r.DESCONTO_VALOR);
      var liquidoRecebido = consultaNumero(r.TOTAL_LIQUIDO);

      // Em Vendas Vitrine, o valor considerado é sempre o bruto menos o desconto
      // registrado no cabeçalho do ERP. As demais abas mantêm TOTAL_LIQUIDO.
      var liquido = consultaTipoAtivo === 'vendas_vitrine'
        ? Math.max(0, bruto - desconto)
        : liquidoRecebido;

      mapa[id] = {
        interno: r.INTERNO_PEDIDO,
        numero_contrato: String(r.NUMERO_CONTRATO || r.PEDIDO_CLIENTE || r.INTERNO_PEDIDO || '').trim(),
        tipo: r.TIPO, nota_numero: r.NOTA_NUMERO,
        nota_especie: r.NOTA_ESPECIE, nota_serie: r.NOTA_SERIE,
        pedido_cliente: r.PEDIDO_CLIENTE, codigo_pessoa: r.CODIGO_CLIENTE_FORNECEDOR,
        nome_pessoa: r.NOME_CLIENTE_FORNECEDOR, data_pedido: r.DATA_PEDIDO,
        data_estoque: r.DATA_ESTOQUE, data_emissao: r.DATA_EMISSAO,
        codigo_status: r.CODIGO_STATUS, status: r.STATUS,
        total_bruto: bruto,
        desconto_perc: consultaNumero(r.DESCONTO_PERC),
        desconto_valor: desconto,
        total_liquido: liquido,
        itens: []
      };
    }

    if (r.CODIGO_PRODUTO !== null && r.CODIGO_PRODUTO !== undefined) {
      mapa[id].itens.push({
        item: r.ITEM_NUMERO,
        codigo: r.CODIGO_PRODUTO,
        produto: r.PRODUTO,
        quantidade: consultaNumero(r.QUANTIDADE),
        valor_unitario: consultaNumero(r.ITEM_VALOR_UNITARIO),
        valor_total: consultaNumero(r.ITEM_VALOR_TOTAL)
      });
    }
  });

  return Object.values(mapa).map(function (p) {
    p.quantidade_total = p.itens.reduce(function (s, i) { return s + i.quantidade; }, 0);
    return p;
  });
}

async function buscarConsultasERP() {
  var loja = document.getElementById('cLoja').value;
  var di = document.getElementById('cDataInicio').value;
  var df = document.getElementById('cDataFim').value;
  var origem = document.getElementById('cOrigem').value;
  if (!loja || !di || !df) return showToast('Selecione loja, data inicial e data final.');
  if (di > df) return showToast('A data inicial não pode ser maior que a final.');

  var tbody = document.getElementById('cTbody');
  tbody.innerHTML = '<tr><td colspan="9" class="consulta-empty"><div class="spinner"></div><br>Consultando Firebird...</td></tr>';
  try {
    var p = new URLSearchParams({ tipo: consultaTipoAtivo, interno_est: loja, data_inicio: di, data_fim: df, origem: origem });
    var r = await apiFetch('/api/consultas/movimentacoes-v3?' + p.toString());
    var d = await r.json();
    if (!r.ok || d.erro) throw new Error(d.detalhe || d.erro || 'Erro na consulta');
    if (d.versao !== 'consultas-erp-v3-desconto') {
      throw new Error('O backend da API não foi atualizado para a versão de desconto v3. Substitua o server.js e reinicie o PM2.');
    }
    consultaPedidos = agruparMovimentacoes(d.registros || []);
    renderConsultasERP();
    if (d.aviso) showToast(d.aviso);
  } catch (e) {
    consultaPedidos = [];
    tbody.innerHTML = '<tr><td colspan="9" class="consulta-empty">Erro: ' + escapeHtml(e.message) + '</td></tr>';
    showToast('Erro ao consultar: ' + e.message);
  }
}

function renderConsultasERP() {
  var tbody = document.getElementById('cTbody');
  var qtdItens = consultaPedidos.reduce(function (s, p) { return s + p.itens.length; }, 0);
  var qtdTotal = consultaPedidos.reduce(function (s, p) { return s + p.quantidade_total; }, 0);
  var valorTotal = consultaPedidos.reduce(function (s, p) { return s + (parseFloat(p.total_liquido) || 0); }, 0);
  document.getElementById('cKpiQtd').textContent = consultaPedidos.length.toLocaleString('pt-BR');
  document.getElementById('cKpiItens').textContent = qtdItens.toLocaleString('pt-BR');
  document.getElementById('cKpiPeso').textContent = fmt(qtdTotal, 4);
  document.getElementById('cKpiValor').textContent = consultaMoeda(valorTotal);
  document.getElementById('cResumoResultado').textContent = consultaPedidos.length + ' contrato(s) único(s), sem duplicação pelo pedido interno do ERP.';
  if (!consultaPedidos.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="consulta-empty">Nenhum registro encontrado para os filtros informados.</td></tr>';
    return;
  }
  tbody.innerHTML = consultaPedidos.map(function (p, idx) {
    return '<tr>' +
      '<td>' + escapeHtml(consultaDataBR(p.data_estoque)) + '</td>' +
      '<td><strong>' + escapeHtml(p.numero_contrato || p.interno) + '</strong></td>' +
      '<td>' + escapeHtml((p.nota_especie || '') + ' ' + (p.nota_serie || '') + ' - ' + (p.nota_numero || '—')) + '</td>' +
      '<td>' + escapeHtml(p.nome_pessoa || '—') + '</td>' +
      '<td>' + escapeHtml(p.status || '—') + '</td>' +
      '<td style="text-align:right">' + p.itens.length + '</td>' +
      '<td style="text-align:right" class="money">' + fmt(p.quantidade_total, 4) + '</td>' +
      '<td style="text-align:right" class="money">' + consultaMoeda(p.total_liquido) + '</td>' +
      '<td><button class="btn-ver-detalhes js-modal-consulta" data-idx="' + idx + '">Visualizar</button></td>' +
      '</tr>';
  }).join('');
}

function abrirModalConsulta(idx) {
  var p = consultaPedidos[idx];
  if (!p) return;

  var ehVenda = consultaTipoAtivo === 'vendas_vitrine';
  document.getElementById('consultaModalTitulo').textContent = 'Contrato ' + (p.numero_contrato || p.interno) + ' — ' + (p.status || 'Detalhes');

  var info = [
    ['Data estoque', consultaDataBR(p.data_estoque)],
    ['Data emissão', consultaDataBR(p.data_emissao)],
    ['Cliente/Fornecedor', p.nome_pessoa || '—'],
    ['Código', p.codigo_pessoa || '—'],
    ['Pedido interno ERP', p.interno || '—'],
    ['Nota', (p.nota_especie || '') + ' ' + (p.nota_serie || '') + ' - ' + (p.nota_numero || '—')],
    ['Itens', p.itens.length],
    ['Quantidade total', fmt(p.quantidade_total, 4)]
  ];

  if (ehVenda) {
    info.push(['Total bruto', consultaMoeda(p.total_bruto)]);
    info.push(['Desconto', consultaMoeda(p.desconto_valor)]);
    info.push(['Total líquido', consultaMoeda(p.total_liquido)]);
  } else {
    info.push(['Total líquido', consultaMoeda(p.total_liquido)]);
  }

  var itens;
  var cabecalhoItens;

  if (ehVenda) {
    cabecalhoItens = '<tr><th>Item</th><th>Código</th><th>Produto</th><th style="text-align:right">Quantidade</th><th style="text-align:right">Valor unitário</th><th style="text-align:right">Valor do item</th></tr>';
    itens = p.itens.map(function (i, n) {
      return '<tr>' +
        '<td>' + escapeHtml(i.item || (n + 1)) + '</td>' +
        '<td>' + escapeHtml(i.codigo || '—') + '</td>' +
        '<td>' + escapeHtml(i.produto || '—') + '</td>' +
        '<td style="text-align:right" class="money">' + fmt(i.quantidade, 4) + '</td>' +
        '<td style="text-align:right" class="money">' + consultaMoeda(i.valor_unitario) + '</td>' +
        '<td style="text-align:right" class="money">' + consultaMoeda(i.valor_total) + '</td>' +
      '</tr>';
    }).join('');
  } else {
    cabecalhoItens = '<tr><th>Item</th><th>Código</th><th>Produto</th><th style="text-align:right">Quantidade</th></tr>';
    itens = p.itens.map(function (i, n) {
      return '<tr><td>' + (n + 1) + '</td><td>' + escapeHtml(i.codigo || '—') + '</td><td>' + escapeHtml(i.produto || '—') + '</td><td style="text-align:right" class="money">' + fmt(i.quantidade, 4) + '</td></tr>';
    }).join('');
  }

  document.getElementById('consultaModalBody').innerHTML =
    '<div class="consulta-detalhes-grid">' + info.map(function (x) {
      return '<div class="consulta-detalhe"><small>' + escapeHtml(x[0]) + '</small><strong>' + escapeHtml(x[1]) + '</strong></div>';
    }).join('') + '</div>' +
    '<div class="chart-title" style="margin-bottom:10px">Itens do pedido</div>' +
    '<div class="table-wrap"><table class="dt"><thead>' + cabecalhoItens + '</thead><tbody>' + itens + '</tbody></table></div>';

  document.getElementById('consultaModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharModalConsulta(ev) {
  if (ev && ev.target !== document.getElementById('consultaModal')) return;
  document.getElementById('consultaModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharModalConsulta(); });

(function iniciarConsultasERP() {
  setTimeout(function () {
    var fim = document.getElementById('cDataFim');
    var inicio = document.getElementById('cDataInicio');
    if (fim && !fim.value) fim.value = dataHojeInput();
    if (inicio && !inicio.value) inicio.value = dataHojeInput();
    carregarLojasConsultas();
  }, 120);
})();


/* ════════════════════════════════════════════════
   MARKETING — CLIENTES NOVOS
════════════════════════════════════════════════ */
var marketingClientes = [];

function getOrigemMarketing() {
  var el = document.getElementById('mOrigem');
  return el ? (el.value || 'matriz') : 'matriz';
}

function somenteNumerosMarketing(valor) {
  return String(valor || '').replace(/\D/g, '');
}


function formatarCpfMarketing(valor) {
  var v = somenteNumerosMarketing(valor);
  return v.length === 11 ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (valor || '—');
}

function formatarCnpjMarketing(valor) {
  var v = somenteNumerosMarketing(valor);
  return v.length === 14 ? v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : (valor || '—');
}

async function carregarLojasMarketing() {
  var sel = document.getElementById('mLoja');
  if (!sel) return;
  var selecionado = sel.value || '';
  sel.innerHTML = '<option value="">Carregando lojas...</option>';

  try {
    var origem = getOrigemMarketing();
    var d = await apiFetch('/api/estabelecimentos?origem=' + encodeURIComponent(origem)).then(function (r) { return r.json(); });
    var lojas = d.estabelecimentos || [];
    sel.innerHTML = '<option value="">— Todas as lojas —</option>';
    lojas.forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.INTERNO;
      o.textContent = e.INTERNO + ' — ' + (e.FANTASIA || e.NOME || '').trim();
      sel.appendChild(o);
    });
    if (selecionado && lojas.some(function (e) { return String(e.INTERNO) === String(selecionado); })) sel.value = selecionado;
  } catch (e) {
    console.error(e);
    sel.innerHTML = '<option value="">Erro ao carregar lojas</option>';
  }
}

async function carregarGruposMarketing() {
  var sel = document.getElementById('mGrupo');
  if (!sel) return;
  var selecionado = sel.value || '';
  sel.innerHTML = '<option value="">Carregando grupos...</option>';

  try {
    var origem = getOrigemMarketing();
    var d = await apiFetch('/api/marketing/grupos?origem=' + encodeURIComponent(origem)).then(function (r) { return r.json(); });
    var grupos = d.grupos || [];
    sel.innerHTML = '<option value="">— Todos os grupos —</option>';
    grupos.forEach(function (g) {
      var o = document.createElement('option');
      o.value = (g.NOME || '').trim();
      o.textContent = (g.NOME || '').trim();
      sel.appendChild(o);
    });
    if (selecionado && grupos.some(function (g) { return String(g.NOME || '').trim() === selecionado; })) sel.value = selecionado;
  } catch (e) {
    console.error(e);
    sel.innerHTML = '<option value="">Erro ao carregar grupos</option>';
  }
}

function formatarDataMarketing(valor) {
  if (!valor) return '—';
  var data = new Date(valor);
  if (isNaN(data.getTime())) return String(valor).slice(0, 10);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getFiltrosMarketing() {
  return {
    dataInicio: document.getElementById('mDataInicio').value,
    dataFim: document.getElementById('mDataFim').value,
    loja: document.getElementById('mLoja').value,
    grupo: document.getElementById('mGrupo').value,
    tipoDocumento: document.getElementById('mTipoDocumento').value
  };
}

async function buscarClientesNovos() {
  var f = getFiltrosMarketing();
  var btn = document.getElementById('btnBuscarMarketing');
  var tbody = document.getElementById('mTbody');

  if (!f.dataInicio || !f.dataFim) return showToast('⚠️ Informe a data inicial e a data final.');
  if (f.dataInicio > f.dataFim) return showToast('⚠️ A data inicial não pode ser maior que a data final.');

  var params = new URLSearchParams({
    origem: getOrigemMarketing(),
    data_inicio: f.dataInicio,
    data_fim: f.dataFim
  });
  if (f.loja) params.set('interno_est', f.loja);
  if (f.grupo) params.set('grupo', f.grupo);
  if (f.tipoDocumento) params.set('tipo_documento', f.tipoDocumento);

  btn.disabled = true;
  btn.textContent = 'Carregando...';
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px"><div class="spinner"></div><br>Consultando clientes...</td></tr>';

  try {
    var resp = await apiFetch('/api/marketing/clientes-novos?' + params.toString());
    var data = await resp.json();
    if (!resp.ok || data.erro) throw new Error(data.erro || 'Erro ao consultar clientes.');

    marketingClientes = data.clientes || [];

    if (f.tipoDocumento && data.tipo_documento !== f.tipoDocumento) {
      throw new Error('O servidor não aplicou o filtro de documento. Reinicie a API Node.js e tente novamente.');
    }

    document.getElementById('mKpiTotal').textContent = (data.total_clientes || 0).toLocaleString('pt-BR');
    document.getElementById('mKpiComGrupo').textContent = (data.total_com_grupo || 0).toLocaleString('pt-BR');
    document.getElementById('mKpiSemGrupo').textContent = (data.total_sem_grupo || 0).toLocaleString('pt-BR');
    document.getElementById('mKpiLojas').textContent = (data.total_lojas || 0).toLocaleString('pt-BR');
    var tipoDocumentoLabel = f.tipoDocumento === 'cpf'
      ? 'Somente CPF'
      : (f.tipoDocumento === 'cnpj' ? 'Somente CNPJ' : 'Todos: CPF e CNPJ');

    document.getElementById('mResumoResultado').textContent =
      (data.total_clientes || 0).toLocaleString('pt-BR') + ' cliente(s) entre ' +
      formatarDataMarketing(data.data_inicio) + ' e ' + formatarDataMarketing(data.data_fim) +
      ' · Documento: ' + tipoDocumentoLabel + '.';

    renderTabelaMarketing(marketingClientes);
  } catch (e) {
    marketingClientes = [];
    tbody.innerHTML = '<tr><td colspan="8" class="consulta-empty">' + escapeHtml(e.message) + '</td></tr>';
    showToast('Erro: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Consultar';
  }
}

function renderTabelaMarketing(dados) {
  var tbody = document.getElementById('mTbody');
  if (!dados.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="consulta-empty">Nenhum cliente encontrado para os filtros informados.</td></tr>';
    return;
  }

  tbody.innerHTML = dados.map(function (r) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(r.CODIGO_CLIENTE || '—') + '</strong></td>' +
      '<td>' + escapeHtml(r.NOME_CLIENTE || '—') + '</td>' +
      '<td>' + escapeHtml(formatarCpfMarketing(r.CPF)) + '</td>' +
      '<td>' + escapeHtml(formatarCnpjMarketing(r.CNPJ)) + '</td>' +
      '<td>' + escapeHtml(formatarDataMarketing(r.DATA_CADASTRO)) + '</td>' +
      '<td>' + escapeHtml(r.CODIGO_LOJA || '—') + '</td>' +
      '<td>' + escapeHtml(r.NOME_LOJA || '—') + '</td>' +
      '<td>' + escapeHtml(r.GRUPO_CLIENTE || 'Sem grupo') + '</td>' +
      '</tr>';
  }).join('');
}

function baixarArquivoMarketing(nome, conteudo, mime) {
  var blob = new Blob([conteudo], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function nomeArquivoMarketing(ext) {
  var f = getFiltrosMarketing();
  return 'clientes_novos_' + getOrigemMarketing() + '_' + f.dataInicio + '_a_' + f.dataFim + '.' + ext;
}

function exportarMarketingExcel() {
  var dados = marketingClientes;
  if (!dados.length) return showToast('Consulte os clientes antes de exportar.');

  var linhas = [['Código', 'Cliente', 'CPF', 'CNPJ', 'Data de cadastro', 'Código da loja', 'Loja', 'Grupo'].join(';')];

  dados.forEach(function (r) {
    var valores = [
      r.CODIGO_CLIENTE || '', r.NOME_CLIENTE || '',
      formatarCpfMarketing(r.CPF) === '—' ? '' : formatarCpfMarketing(r.CPF),
      formatarCnpjMarketing(r.CNPJ) === '—' ? '' : formatarCnpjMarketing(r.CNPJ),
      formatarDataMarketing(r.DATA_CADASTRO), r.CODIGO_LOJA || '',
      r.NOME_LOJA || '', r.GRUPO_CLIENTE || 'Sem grupo'
    ];
    linhas.push(valores.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
  });

  baixarArquivoMarketing(nomeArquivoMarketing('csv'), '\ufeff' + linhas.join('\n'), 'text/csv;charset=utf-8;');
  showToast('Excel gerado com os filtros atuais.', 'ok');
}

function exportarMarketingPDF() {
  var dados = marketingClientes;
  if (!dados.length) return showToast('Consulte os clientes antes de exportar.');

  var f = getFiltrosMarketing();
  var lojaSel = document.getElementById('mLoja');
  var loja = f.loja && lojaSel ? lojaSel.options[lojaSel.selectedIndex].text : 'Todas as lojas';

  var conteudo = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Clientes Novos</title>' +
    '<style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#222;margin:0}h1{font-size:18px;margin:0 0 5px}.sub{font-size:10px;color:#555;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:8px;table-layout:fixed}th{background:#f3efe8;text-transform:uppercase;font-size:7px}th,td{border:1px solid #ddd;padding:4px;vertical-align:top;word-wrap:break-word}</style>' +
    '</head><body><h1>Marketing — Clientes Novos</h1>' +
    '<div class="sub">Período: ' + escapeHtml(formatarDataMarketing(f.dataInicio)) + ' a ' + escapeHtml(formatarDataMarketing(f.dataFim)) +
    ' · Loja: ' + escapeHtml(loja) + ' · Grupo: ' + escapeHtml(f.grupo || 'Todos') +
    ' · Documento: ' + escapeHtml(f.tipoDocumento === 'cpf' ? 'Somente CPF' : (f.tipoDocumento === 'cnpj' ? 'Somente CNPJ' : 'Todos: CPF e CNPJ')) +
    ' · Registros: ' + dados.length.toLocaleString('pt-BR') + '</div>' +
    '<table><thead><tr><th>Código</th><th>Cliente</th><th>CPF</th><th>CNPJ</th><th>Cadastro</th><th>Cód. loja</th><th>Loja</th><th>Grupo</th></tr></thead><tbody>' +
    dados.map(function (r) {
      return '<tr><td>' + escapeHtml(r.CODIGO_CLIENTE || '—') + '</td><td>' + escapeHtml(r.NOME_CLIENTE || '—') +
        '</td><td>' + escapeHtml(formatarCpfMarketing(r.CPF)) + '</td><td>' + escapeHtml(formatarCnpjMarketing(r.CNPJ)) +
        '</td><td>' + escapeHtml(formatarDataMarketing(r.DATA_CADASTRO)) + '</td><td>' + escapeHtml(r.CODIGO_LOJA || '—') +
        '</td><td>' + escapeHtml(r.NOME_LOJA || '—') + '</td><td>' + escapeHtml(r.GRUPO_CLIENTE || 'Sem grupo') + '</td></tr>';
    }).join('') +
    '</tbody></table><script>window.onload=function(){window.print();}</script></body></html>';

  var w = window.open('', '_blank');
  if (!w) return showToast('Pop-up bloqueado. Libere pop-ups para gerar o PDF.');
  w.document.open();
  w.document.write(conteudo);
  w.document.close();
}

(function iniciarMarketing() {
  setTimeout(function () {
    var inicio = document.getElementById('mDataInicio');
    var fim = document.getElementById('mDataFim');
    if (!inicio || !fim) return;
    var hoje = new Date();
    var primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    inicio.value = primeiroDia.getFullYear() + '-' + String(primeiroDia.getMonth() + 1).padStart(2, '0') + '-01';
    fim.value = dataHojeInput();
    carregarLojasMarketing();
    carregarGruposMarketing();
  }, 180);
})();

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
ping();
carregarFiltros();
carregarLojasAuditoria();

// Não carregar automaticamente o dashboard de estoque ao abrir o sistema.
// Isso evita que /api/estoque/por-fabricante, /api/estoque/por-loja e /api/estoque/ranking
// rodem em paralelo quando o usuário for direto para Auditoria, causando 504/timeout.
// O estoque continua carregando normalmente ao clicar em Consultar na aba Estoque.


// Sincroniza as modalidades disponíveis ao abrir a página.
setTimeout(function () {
  atualizarTiposConsultaPorOrigem();
}, 150);
