const MODULOS = [
  {
    chave: 'estoque',
    label: 'Estoque',
    aba: 'estoque',
    botaoId: 'tabBtnEstoque',
    ordem: 10
  },
  {
    chave: 'vendas',
    label: 'Vendas',
    aba: 'vendas',
    botaoId: 'tabBtnVendas',
    ordem: 20
  },
  {
    chave: 'auditoria',
    label: 'Auditoria',
    aba: 'auditoria',
    botaoId: 'tabBtnAuditoria',
    ordem: 30
  },
  {
    chave: 'consultas_erp',
    label: 'Consultas ERP',
    aba: 'consultas',
    botaoId: 'tabBtnConsultas',
    ordem: 40
  },
  {
    chave: 'marketing',
    label: 'Marketing',
    aba: 'marketing',
    botaoId: 'tabBtnMarketing',
    ordem: 50
  },
  {
    chave: 'admin',
    label: 'Admin',
    aba: 'admin',
    botaoId: 'tabBtnAdmin',
    ordem: 900
  }
];

const PERMISSOES_VALIDAS = MODULOS.map(function (modulo) {
  return modulo.chave;
});

function listarModulos() {
  return MODULOS.slice().sort(function (a, b) {
    return a.ordem - b.ordem;
  });
}

function listarPermissoes() {
  return PERMISSOES_VALIDAS.slice();
}

module.exports = {
  MODULOS: MODULOS,
  PERMISSOES_VALIDAS: PERMISSOES_VALIDAS,
  listarModulos: listarModulos,
  listarPermissoes: listarPermissoes
};
