const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'output', 'pdf');
const OUT = path.join(OUT_DIR, 'ourobras-documentacao-tecnica.pdf');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Medidas A4 em pontos. Margens inspiradas na ABNT NBR 14724:
// esquerda/superior 3 cm; direita/inferior 2 cm.
const W = 595.28;
const H = 841.89;
const M_LEFT = 85.04;
const M_TOP = 85.04;
const M_RIGHT = 56.69;
const M_BOTTOM = 56.69;
const CONTENT_W = W - M_LEFT - M_RIGHT;
const CONTENT_BOTTOM = H - M_BOTTOM;

const doc = new PDFDocument({
  size: 'A4',
  autoFirstPage: false,
  margins: {
    top: M_TOP,
    left: M_LEFT,
    right: M_RIGHT,
    bottom: M_BOTTOM,
  },
  info: {
    Title: 'Ourobras Classificação - Documentação Técnica',
    Author: 'Ourobras / Codex',
    Subject: 'Arquitetura, catálogo e boas práticas de engenharia de software',
  },
});

const outStream = fs.createWriteStream(OUT);
doc.pipe(outStream);

const C = {
  ink: '#1A1612',
  muted: '#5F5751',
  line: '#D8D0C5',
  pale: '#F7F4EE',
  pale2: '#EEE8DC',
  gold: '#A8762A',
  blue: '#173B6D',
  green: '#166534',
  red: '#991B1B',
  orange: '#B45309',
  white: '#FFFFFF',
};

let pageNo = 0;
let currentPageTitle = '';

function addRawPage() {
  doc.addPage();
  pageNo += 1;
  doc.font('Times-Roman').fontSize(12).fillColor(C.ink);
}

function drawPageNumber() {
  const y = 42;
  const oldY = doc.y;
  doc.font('Times-Roman').fontSize(10).fillColor(C.muted)
    .text(String(pageNo), W - M_RIGHT - 60, y, {
      width: 60,
      align: 'right',
      lineBreak: false,
    });
  doc.y = oldY;
}

function addContentPage(title, subtitle) {
  addRawPage();
  currentPageTitle = title;
  drawPageNumber();
  doc.font('Times-Bold').fontSize(16).fillColor(C.blue)
    .text(title.toUpperCase(), M_LEFT, M_TOP, { width: CONTENT_W, align: 'left' });
  if (subtitle) {
    doc.moveDown(0.35);
    doc.font('Times-Roman').fontSize(11).fillColor(C.muted)
      .text(subtitle, M_LEFT, doc.y, { width: CONTENT_W, lineGap: 2 });
  }
  doc.moveTo(M_LEFT, doc.y + 12).lineTo(W - M_RIGHT, doc.y + 12)
    .strokeColor(C.line).lineWidth(1).stroke();
  doc.y += 30;
}

function ensureSpace(height) {
  if (doc.y + height > CONTENT_BOTTOM) {
    addContentPage(currentPageTitle || 'Continuação', 'Continuação da seção.');
  }
}

function heading(text) {
  ensureSpace(42);
  doc.moveDown(0.25);
  doc.font('Times-Bold').fontSize(13).fillColor(C.blue)
    .text(text, M_LEFT, doc.y, { width: CONTENT_W });
  doc.moveDown(0.35);
}

function para(text, opts = {}) {
  ensureSpace(opts.height || 48);
  doc.font('Times-Roman').fontSize(opts.size || 12).fillColor(opts.color || C.ink)
    .text(text, M_LEFT, doc.y, {
      width: opts.width || CONTENT_W,
      align: opts.align || 'justify',
      lineGap: opts.lineGap === undefined ? 4 : opts.lineGap,
    });
  doc.moveDown(opts.after === undefined ? 0.6 : opts.after);
}

function bullets(items) {
  doc.font('Times-Roman').fontSize(11.5).fillColor(C.ink);
  items.forEach((item) => {
    ensureSpace(36);
    const y = doc.y + 3;
    doc.circle(M_LEFT + 4, y + 5, 2).fill(C.gold);
    doc.fillColor(C.ink).text(item, M_LEFT + 16, y, {
      width: CONTENT_W - 16,
      lineGap: 3,
    });
    doc.moveDown(0.35);
  });
  doc.moveDown(0.25);
}

function card(x, y, w, h, title, body, color = C.blue) {
  doc.save();
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(C.white, C.line);
  doc.rect(x, y, 4, h).fill(color);
  doc.font('Times-Bold').fontSize(10.5).fillColor(color)
    .text(title, x + 12, y + 10, { width: w - 22 });
  doc.font('Times-Roman').fontSize(9.2).fillColor(C.muted)
    .text(body, x + 12, y + 30, { width: w - 22, lineGap: 2 });
  doc.restore();
}

function sectionBand(text, color = C.gold) {
  ensureSpace(48);
  const y = doc.y;
  doc.roundedRect(M_LEFT, y, CONTENT_W, 28, 4).fill(color);
  doc.font('Times-Bold').fontSize(11).fillColor(C.white)
    .text(text, M_LEFT + 12, y + 8, { width: CONTENT_W - 24 });
  doc.y = y + 42;
}

function node(x, y, w, h, title, subtitle, color = C.blue) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fillAndStroke(C.pale, C.line);
  doc.font('Times-Bold').fontSize(9.2).fillColor(color)
    .text(title, x + 8, y + 10, { width: w - 16, align: 'center' });
  if (subtitle) {
    doc.font('Times-Roman').fontSize(7.6).fillColor(C.muted)
      .text(subtitle, x + 8, y + 28, { width: w - 16, align: 'center' });
  }
  doc.restore();
}

function arrow(x1, y1, x2, y2, label) {
  doc.save();
  doc.strokeColor(C.muted).lineWidth(1).moveTo(x1, y1).lineTo(x2, y2).stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = 6;
  doc.path(`M ${x2} ${y2} L ${x2 - len * Math.cos(ang - Math.PI / 6)} ${y2 - len * Math.sin(ang - Math.PI / 6)} L ${x2 - len * Math.cos(ang + Math.PI / 6)} ${y2 - len * Math.sin(ang + Math.PI / 6)} Z`).fill(C.muted);
  if (label) {
    doc.font('Times-Roman').fontSize(7.2).fillColor(C.muted)
      .text(label, (x1 + x2) / 2 - 34, (y1 + y2) / 2 - 12, { width: 68, align: 'center' });
  }
  doc.restore();
}

function table(headers, rows, widths, opts = {}) {
  let y = doc.y;
  const rowH = opts.rowH || 28;

  function drawHeader() {
    let x = M_LEFT;
    doc.font('Times-Bold').fontSize(8.5).fillColor(C.white);
    headers.forEach((h, i) => {
      doc.rect(x, y, widths[i], rowH).fill(C.blue);
      doc.fillColor(C.white).text(h, x + 4, y + 7, {
        width: widths[i] - 8,
        height: rowH - 8,
      });
      x += widths[i];
    });
    y += rowH;
  }

  ensureSpace(rowH * 2);
  drawHeader();
  doc.font('Times-Roman').fontSize(8.3);

  rows.forEach((row, idx) => {
    if (y + rowH > CONTENT_BOTTOM - 12) {
      doc.y = y;
      addContentPage(opts.contTitle || 'Continuação', opts.contSubtitle || '');
      y = doc.y;
      drawHeader();
      doc.font('Times-Roman').fontSize(8.3);
    }
    let x = M_LEFT;
    const bg = idx % 2 === 0 ? C.white : C.pale;
    row.forEach((cell, i) => {
      doc.rect(x, y, widths[i], rowH).fillAndStroke(bg, C.line);
      doc.fillColor(C.ink).text(String(cell), x + 4, y + 6, {
        width: widths[i] - 8,
        height: rowH - 7,
        lineGap: 1,
      });
      x += widths[i];
    });
    y += rowH;
  });

  doc.y = y + 12;
}

function tableTitle(text) {
  ensureSpace(24);
  doc.font('Times-Bold').fontSize(10.5).fillColor(C.ink)
    .text(text, M_LEFT, doc.y, { width: CONTENT_W, align: 'left' });
  doc.moveDown(0.35);
}

function sourceLine(text = 'Fonte: elaboração própria, com base no projeto analisado.') {
  ensureSpace(18);
  doc.font('Times-Roman').fontSize(9).fillColor(C.muted)
    .text(text, M_LEFT, doc.y, { width: CONTENT_W, align: 'left' });
  doc.moveDown(0.85);
}

function figureCaption(text) {
  ensureSpace(20);
  doc.font('Times-Bold').fontSize(10).fillColor(C.ink)
    .text(text, M_LEFT, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.25);
}

function codeBlock(text) {
  ensureSpace(180);
  const y = doc.y;
  doc.roundedRect(M_LEFT, y, CONTENT_W, 168, 4).fillAndStroke('#FBFAF7', C.line);
  doc.font('Courier').fontSize(7.4).fillColor(C.ink)
    .text(text, M_LEFT + 10, y + 10, { width: CONTENT_W - 20, lineGap: 1.5 });
  doc.y = y + 182;
}

function smallPill(x, y, w, text, active = false) {
  doc.roundedRect(x, y, w, 22, 5)
    .fillAndStroke(active ? C.gold : C.white, C.line);
  doc.font('Times-Bold').fontSize(7.3).fillColor(active ? C.white : C.muted)
    .text(text, x + 4, y + 7, { width: w - 8, align: 'center', lineBreak: false });
}

function inputBox(x, y, w, label, value) {
  doc.font('Times-Bold').fontSize(7.2).fillColor(C.muted)
    .text(label.toUpperCase(), x, y, { width: w, lineBreak: false });
  doc.roundedRect(x, y + 13, w, 27, 4).stroke(C.line);
  doc.font('Times-Roman').fontSize(8.4).fillColor(C.ink)
    .text(value, x + 8, y + 22, { width: w - 16, lineBreak: false });
}

function kpiBox(x, y, w, title, value, subtitle) {
  doc.roundedRect(x, y, w, 54, 4).fillAndStroke(C.white, C.line);
  doc.rect(x, y, w, 3).fill(C.gold);
  doc.font('Times-Bold').fontSize(6.8).fillColor(C.muted)
    .text(title.toUpperCase(), x + 9, y + 11, { width: w - 18, height: 16 });
  doc.font('Times-Bold').fontSize(13).fillColor(C.ink)
    .text(value, x + 9, y + 27, { width: w - 18, height: 14 });
  doc.font('Times-Roman').fontSize(7).fillColor(C.muted)
    .text(subtitle, x + 9, y + 42, { width: w - 18, height: 10 });
}

function screenShell(y, activeTab) {
  doc.roundedRect(M_LEFT, y, CONTENT_W, 300, 5).fillAndStroke(C.white, C.line);
  doc.rect(M_LEFT, y, CONTENT_W, 38).fill(C.pale2);
  doc.font('Times-Bold').fontSize(9).fillColor(C.blue)
    .text('OUROBRASIL', M_LEFT + 12, y + 14, { width: 78, lineBreak: false });
  const tabs = ['Estoque', 'Vendas', 'Auditoria', 'Consultas ERP', 'Marketing'];
  const widths = [54, 52, 62, 76, 62];
  let x = M_LEFT + 98;
  tabs.forEach((tab, i) => {
    smallPill(x, y + 9, widths[i], tab, tab === activeTab);
    x += widths[i] + 8;
  });
  return y + 52;
}

function screenSummary(title, bulletsList) {
  heading(title);
  bullets(bulletsList);
}

// Capa, em formato semelhante ao elemento pre-textual ABNT.
addRawPage();
const logo = path.join(ROOT, 'public', 'img', 'logo.jpg');
if (fs.existsSync(logo)) {
  try { doc.image(logo, M_LEFT, 70, { width: 130 }); } catch (_) {}
}
doc.font('Times-Bold').fontSize(13).fillColor(C.ink)
  .text('OUROBRAS JOALHERIA', M_LEFT, 168, { width: CONTENT_W, align: 'center' });
doc.font('Times-Bold').fontSize(14)
  .text('DOCUMENTAÇÃO TÉCNICA DO SISTEMA', M_LEFT, 310, { width: CONTENT_W, align: 'center' });
doc.font('Times-Bold').fontSize(14)
  .text('OUROBRAS CLASSIFICAÇÃO', M_LEFT, 335, { width: CONTENT_W, align: 'center' });
doc.font('Times-Roman').fontSize(12)
  .text('Ambiente corporativo de consultas otimizadas para todos os setores, com catálogo, arquitetura, boas práticas, segurança e organização de engenharia de software.', M_LEFT, 390, {
    width: CONTENT_W,
    align: 'center',
    lineGap: 4,
  });
doc.font('Times-Roman').fontSize(12)
  .text('Brasil', M_LEFT, H - 135, { width: CONTENT_W, align: 'center' });
doc.text('2026', M_LEFT, H - 112, { width: CONTENT_W, align: 'center' });

// Folha de rosto.
addRawPage();
drawPageNumber();
doc.font('Times-Bold').fontSize(13)
  .text('OUROBRAS JOALHERIA', M_LEFT, M_TOP, { width: CONTENT_W, align: 'center' });
doc.moveDown(5);
doc.font('Times-Bold').fontSize(14)
  .text('DOCUMENTAÇÃO TÉCNICA DO SISTEMA OUROBRAS CLASSIFICAÇÃO', M_LEFT, doc.y, {
    width: CONTENT_W,
    align: 'center',
    lineGap: 4,
  });
doc.moveDown(3);
doc.font('Times-Roman').fontSize(12)
  .text('Documento técnico elaborado para catalogar o projeto, representar sua arquitetura, registrar boas práticas de engenharia de software e orientar a inclusão de novas consultas otimizadas para todos os setores da empresa, com segurança, previsibilidade e padronização.', M_LEFT + 170, doc.y, {
    width: CONTENT_W - 170,
    align: 'justify',
    lineGap: 4,
  });
doc.font('Times-Roman').fontSize(12)
  .text('Brasil', M_LEFT, H - 135, { width: CONTENT_W, align: 'center' });
doc.text('2026', M_LEFT, H - 112, { width: CONTENT_W, align: 'center' });

addContentPage('Sumário', 'Estrutura analítica do documento.');
table(['Seção', 'Conteúdo'], [
  ['1', 'Sumário executivo'],
  ['2', 'Catálogo da estrutura do projeto'],
  ['3', 'Arquitetura e fronteiras de segurança'],
  ['4', 'Fluxo de autenticação'],
  ['5', 'Fluxo de consulta e cache'],
  ['6', 'Catálogo resumido da API'],
  ['7', 'Interfaces, abas, botões e estados de uso'],
  ['8', 'Boas práticas de API e banco de dados'],
  ['9', 'Boas práticas de front-end'],
  ['10', 'Boas práticas de segurança'],
  ['11', 'Organização de engenharia de software'],
  ['12', 'Checklist de publicação e definição de pronto'],
], [75, CONTENT_W - 75], { rowH: 25 });

addContentPage('1. Sumário Executivo', 'Síntese da situação atual e direção técnica recomendada.');
heading('1.1 Resumo');
para('O sistema Ourobras Classificação é uma aplicação Node.js/Express com front-end estático em public/, API protegida por JWT, consultas Firebird para Matriz e Manaus, cache em memória e recursos de inteligência artificial para análises. A solução atual atende ao uso operacional, mas concentra muitas responsabilidades em server.js e public/script.js.');
heading('1.2 Finalidade do projeto');
para('A finalidade do projeto é consolidar um ambiente corporativo de consultas otimizadas para todos os setores da empresa. A plataforma deve permitir acrescentar novas consultas de forma organizada, segura e padronizada, reunindo informações de estoque, vendas, auditoria, contratos, movimentações ERP, marketing e demais áreas que necessitem de dados operacionais e gerenciais.');
para('O objetivo é reduzir consultas manuais ao ERP, padronizar indicadores, acelerar análises entre áreas, diminuir retrabalho e entregar dados consistentes para tomada de decisão. O sistema deve evoluir como uma camada de consulta intersetorial: cada novo módulo precisa respeitar autenticação, validação de filtros, rastreabilidade, desempenho e documentação.');
bullets([
  'Comercial: análise de vendas por período, fabricante, loja, coordenador e produtos mais vendidos.',
  'Estoque: acompanhamento de saldo por loja, fabricante, ranking e produtos disponíveis.',
  'Auditoria: conferência de estoque por grade, código de barras, valores e exportações.',
  'Gestão ERP: consulta de contratos, vendas vitrine e modalidades por status.',
  'Marketing: identificação de clientes novos por período, loja, grupo e tipo de documento.'
]);
sectionBand('Avaliação de segurança observada: 6,5/10');
bullets([
  'Pontos positivos: JWT nas rotas de API, bcrypt no login, Helmet, rate limit, arquivo .env ignorado no Git e ausência de segredos no front-end.',
  'Pontos de atenção: CORS permissivo, dependências com vulnerabilidades no npm audit, token em localStorage, CSP com unsafe-inline, innerHTML com dados externos e SQL concatenado em algumas rotas.',
  'Prioridade recomendada: corrigir CORS, atualizar dependências, remover fallback de senha padrão, reduzir exposição de erros e padronizar validação e queries.'
]);
heading('1.3 Diretriz de evolução');
para('A decisão de engenharia recomendada é manter a API como camada responsável por proteger dados, validar permissões e centralizar regras sensíveis. O front-end pode ser visto pelo navegador; portanto, segredos, credenciais, permissões e regras críticas devem permanecer no back-end.');
para('A evolução deve ocorrer por módulos pequenos e verificáveis, evitando reescritas amplas. Cada nova consulta deve possuir finalidade clara, filtros validados, contrato de resposta documentado e teste manual das consultas críticas antes de publicação.');
sectionBand('Encaminhamentos recomendados');
bullets([
  'Tratar cada nova consulta como um pequeno produto interno: objetivo, usuário atendido, filtros, origem dos dados e resultado esperado.',
  'Registrar decisões técnicas relevantes em documentação viva, mantendo diagramas e catálogo de rotas sincronizados com o código.',
  'Priorizar segurança aplicada: autenticação no servidor, controle de origem, sanitização de saída e mensagens de erro sem detalhes internos.',
  'Evoluir a arquitetura por extração gradual de módulos, preservando a lógica atual e reduzindo risco para as consultas já em produção.'
]);

addContentPage('2. Catálogo da Estrutura', 'Arquivos, responsabilidades e limites do projeto.');
tableTitle('Quadro 1 - Estrutura atual do projeto');
table(['Arquivo ou pasta', 'Responsabilidade', 'Boa prática associada'], [
  ['server.js', 'API Express, middlewares, banco, cache, IA e rotas.', 'Separar gradualmente em config, db, middlewares, services e routes.'],
  ['public/index.html', 'Tela principal do painel.', 'Não colocar segredos nem regras sensíveis.'],
  ['public/login.html', 'Tela de autenticação.', 'Validação amigável no front; decisão real no servidor.'],
  ['public/script.js', 'Chamadas API, filtros, gráficos e renderização.', 'Escapar dados da API e reduzir innerHTML direto.'],
  ['public/style.css', 'Estilos da aplicação.', 'Manter padrão visual, responsividade e consistência.'],
  ['.env', 'Credenciais e configurações locais.', 'Nunca versionar. Rotacionar segredos quando houver exposição.'],
  ['docs/', 'Documentação viva do projeto.', 'Atualizar junto com novas rotas, fluxos ou decisões técnicas.'],
], [96, 180, 177], { rowH: 34 });
sourceLine();

addContentPage('2.1 Dependências Principais', 'Pacotes utilizados e responsabilidade técnica.');
tableTitle('Quadro 2 - Dependências diretas do projeto');
table(['Pacote', 'Uso'], [
  ['express', 'Servidor HTTP e roteamento.'],
  ['node-firebird', 'Conexão e execução de SQL no Firebird.'],
  ['jsonwebtoken', 'Assinatura e validação de tokens JWT.'],
  ['bcryptjs', 'Comparação da senha administrativa com hash bcrypt.'],
  ['helmet', 'Headers de segurança HTTP.'],
  ['cors', 'Controle de origens.'],
  ['express-rate-limit', 'Proteção contra abuso de requisições.'],
  ['openai', 'Cliente de IA com endpoint compatível.'],
], [130, CONTENT_W - 130], { rowH: 25 });
sourceLine('Fonte: package.json do projeto.');

addContentPage('3. Arquitetura e Segurança', 'Visão dos componentes e suas conexões.');
figureCaption('Figura 1 - Visão geral da arquitetura da aplicação');
const yA = doc.y + 34;
node(M_LEFT, yA + 86, 82, 56, 'Usuário', 'Navegador', C.blue);
node(M_LEFT + 104, yA, 100, 56, 'Login', 'login.html', C.gold);
node(M_LEFT + 104, yA + 86, 100, 56, 'Painel', 'HTML/CSS/JS', C.blue);
node(M_LEFT + 230, yA + 42, 104, 68, 'API Express', 'server.js', C.green);
node(M_LEFT + 360, yA - 8, 92, 50, 'JWT', 'autenticar()', C.blue);
node(M_LEFT + 360, yA + 58, 92, 50, 'Cache', 'memória TTL', C.gold);
node(M_LEFT + 360, yA + 124, 92, 50, 'IA', 'análises', C.orange);
node(M_LEFT + 230, yA + 164, 104, 56, 'Firebird', 'Matriz/Manaus', C.red);
arrow(M_LEFT + 82, yA + 114, M_LEFT + 104, yA + 114, 'abre');
arrow(M_LEFT + 204, yA + 28, M_LEFT + 230, yA + 58, 'login');
arrow(M_LEFT + 204, yA + 114, M_LEFT + 230, yA + 76, 'Bearer');
arrow(M_LEFT + 334, yA + 58, M_LEFT + 360, yA + 18, 'verifica');
arrow(M_LEFT + 334, yA + 76, M_LEFT + 360, yA + 83, 'cache');
arrow(M_LEFT + 334, yA + 76, M_LEFT + 360, yA + 149, 'contexto');
arrow(M_LEFT + 282, yA + 110, M_LEFT + 282, yA + 164, 'SQL');
doc.y = yA + 236;
sourceLine('Fonte: elaboração própria, com base na análise de server.js e public/script.js.');
heading('3.1 Leitura correta do F12');
para('Arquivos da pasta public/ sempre aparecem no navegador. Isso não é falha por si só. A proteção real deve estar nas rotas /api, que precisam exigir token, validar entradas e retornar apenas dados autorizados.');
heading('3.2 Fronteiras de segurança');
bullets([
  'Público: HTML, CSS, JavaScript, imagens e bibliotecas carregadas pelo navegador.',
  'Privado: .env, JWT_SECRET, credenciais Firebird, chaves de IA e lógica de autorização.',
  'Corporativo: dados retornados pelo Firebird e agregações geradas pela API.'
]);

addContentPage('4. Fluxo de Autenticação', 'Como o usuário recebe e utiliza o token.');
const sx = M_LEFT + 10, sy = 170, gap = 108;
['Usuário', 'Navegador', 'API', 'Bcrypt/JWT'].forEach((t, i) => {
  node(sx + i * gap, sy, 82, 42, t, '', i === 0 ? C.gold : C.blue);
});
[
  ['1. informa usuário/senha', 0, 1],
  ['2. POST /api/auth/login', 1, 2],
  ['3. compara hash e assina JWT', 2, 3],
  ['4. retorna token', 3, 1],
  ['5. chama /api com Authorization', 1, 2],
].forEach((a, idx) => {
  const y = sy + 76 + idx * 44;
  const from = sx + a[1] * gap + 41;
  const to = sx + a[2] * gap + 41;
  arrow(from, y, to, y, a[0]);
});
doc.y = sy + 326;
sectionBand('Pontos de controle');
bullets([
  'Senha nunca deve ser gravada em logs.',
  'JWT_SECRET deve ser forte e permanecer apenas no .env do servidor.',
  'Token em localStorage é funcional, mas cookie HttpOnly, Secure e SameSite é mais seguro para uma etapa futura.',
  'Login deve manter rate limit e mensagens genéricas para usuário ou senha incorretos.'
]);

addContentPage('5. Fluxo de Consulta e Cache', 'Padrão para estoque, vendas, auditoria e consultas ERP.');
node(M_LEFT, 170, 88, 48, 'Front-end', 'apiFetch()', C.blue);
node(M_LEFT + 112, 170, 100, 48, 'JWT', 'jwt.verify()', C.green);
node(M_LEFT + 238, 170, 92, 48, 'Validação', 'query/body', C.gold);
node(M_LEFT + 356, 170, 92, 48, 'Cache', 'cacheKey', C.orange);
node(M_LEFT + 238, 286, 92, 48, 'Firebird', 'query()', C.red);
arrow(M_LEFT + 88, 194, M_LEFT + 112, 194, 'Bearer');
arrow(M_LEFT + 212, 194, M_LEFT + 238, 194, 'ok');
arrow(M_LEFT + 330, 194, M_LEFT + 356, 194, 'consulta');
arrow(M_LEFT + 402, 218, M_LEFT + 284, 286, 'miss');
arrow(M_LEFT + 284, 286, M_LEFT + 402, 218, 'rows');
doc.y = 375;
heading('5.1 Boa prática para consultas');
bullets([
  'Parâmetros do usuário devem ser convertidos e validados antes do SQL.',
  'Valores externos devem usar placeholders ? sempre que possível.',
  'Cache deve ser aplicado somente em consultas idempotentes e pesadas.',
  'Chave de cache deve incluir origem, filtros e datas.',
  'Resposta de erro para o front-end deve ser segura e sem detalhes internos do banco.'
]);

addContentPage('6. Catálogo Resumido da API', 'Rotas agrupadas por domínio funcional.');
table(['Grupo', 'Rotas', 'Observação'], [
  ['Autenticação', 'GET /api/ping; POST /api/auth/login', 'Rotas públicas controladas.'],
  ['Cache', 'POST /api/cache/limpar; GET /api/cache/status', 'Exigem token.'],
  ['Cadastros base', 'GET /api/estabelecimentos; /api/fabricantes; /api/coordenadores', 'Filtros de origem quando aplicável.'],
  ['Estoque', '/api/estoque; /por-fabricante; /por-loja; /fabricante-por-loja; /ranking', 'Base dos dashboards.'],
  ['Vendas', 'GET /api/vendas', 'Período, loja, fabricante e coordenador.'],
  ['Marketing', '/api/marketing/grupos; /clientes-novos', 'Clientes por período e grupo.'],
  ['IA', '/api/ia/chat; /resumo-estoque; /analisar-estoque; /analisar-contratos', 'Enviar apenas o contexto necessário.'],
  ['Consultas ERP', 'GET /api/consultas/movimentacoes-v3', 'Modalidades por tipo/status.'],
  ['Auditoria', 'GET /api/auditoria/estoque-grade', 'Valores e grade opcionais.'],
  ['Contratos', '/parametros; /tipos; /compradores; /clientes; /produtos; /validar', 'Validação antes de persistir ou exportar.'],
], [78, 244, 131], { rowH: 36, contTitle: '6. Catálogo Resumido da API' });

addContentPage('7. Interfaces, Abas e Estados', 'Documentação visual baseada nas telas reais do sistema.');
heading('7.1 Tela de login');
para('A tela de login centraliza o acesso ao painel e deve ser mantida simples: marca, título, orientação curta, campos de usuário e senha, botão de entrada e mensagem de erro genérica.');
const loginTop = doc.y + 6;
const loginW = 252;
const loginH = 245;
const loginX = M_LEFT + (CONTENT_W - loginW) / 2;
const loginPad = 32;
const loginInnerX = loginX + loginPad;
const loginInnerW = loginW - loginPad * 2;
doc.roundedRect(loginX, loginTop, loginW, loginH, 10).fillAndStroke(C.white, C.line);
doc.font('Times-Bold').fontSize(12).fillColor(C.blue)
  .text('OUROBRASIL', loginInnerX, loginTop + 28, { width: loginInnerW, align: 'center' });
doc.font('Times-Bold').fontSize(12).fillColor(C.ink)
  .text('Acesso restrito', loginInnerX, loginTop + 66, { width: loginInnerW, align: 'center' });
doc.font('Times-Roman').fontSize(8.5).fillColor(C.muted)
  .text('Entre com suas credenciais para continuar', loginInnerX, loginTop + 87, { width: loginInnerW, align: 'center' });
inputBox(loginInnerX, loginTop + 120, loginInnerW, 'Usuário', 'seu usuário');
inputBox(loginInnerX, loginTop + 170, loginInnerW, 'Senha', '••••••••');
doc.roundedRect(loginInnerX, loginTop + 220, loginInnerW, 28, 5).fill(C.gold);
doc.font('Times-Bold').fontSize(10).fillColor(C.white)
  .text('Entrar', loginInnerX, loginTop + 229, { width: loginInnerW, align: 'center' });
doc.y = loginTop + loginH + 22;
table(['Elemento', 'Comportamento esperado', 'Boa prática'], [
  ['Campo Usuário', 'Autocomplete username; obrigatório.', 'Não revelar se o usuário existe.'],
  ['Campo Senha', 'Tipo password; Enter envia login.', 'Nunca registrar a senha em log.'],
  ['Botão Entrar', 'Desabilita durante envio.', 'Rate limit no back-end.'],
  ['Erro', 'Mensagem genérica.', 'Evitar detalhes sobre credenciais.'],
], [92, 205, 156], { rowH: 30 });

addContentPage('7.2 Aba Estoque', 'Consulta de estoque atual por loja, fabricante, coordenador e teor.');
let bodyY = screenShell(138, 'Estoque');
doc.font('Times-Bold').fontSize(10).fillColor(C.ink).text('Filtros - Estoque Atual', M_LEFT + 14, bodyY, { width: 190 });
inputBox(M_LEFT + 14, bodyY + 32, 130, 'Estabelecimento', '1 - OURO DO BRASIL - BARRA');
inputBox(M_LEFT + 154, bodyY + 32, 120, 'Fabricante', 'Todos');
inputBox(M_LEFT + 284, bodyY + 32, 92, 'Coordenador', 'Todos');
inputBox(M_LEFT + 386, bodyY + 32, 66, 'Teor', 'Todos');
doc.roundedRect(M_LEFT + 386, bodyY + 84, 66, 24, 4).fill(C.blue);
doc.font('Times-Bold').fontSize(8).fillColor(C.white).text('Consultar', M_LEFT + 386, bodyY + 92, { width: 66, align: 'center' });
kpiBox(M_LEFT + 14, bodyY + 126, 68, 'Total em estoque', '519,83 g', 'saldo em gramas');
kpiBox(M_LEFT + 92, bodyY + 126, 68, 'Itens distintos', '187', 'produtos');
kpiBox(M_LEFT + 170, bodyY + 126, 68, 'Fabricantes', '4', 'ativos');
kpiBox(M_LEFT + 248, bodyY + 126, 68, 'Lojas ativas', '1', 'positivas');
kpiBox(M_LEFT + 326, bodyY + 126, 126, 'Maior estoque', 'OUROBRAS', '332,4 g');
card(M_LEFT + 14, bodyY + 196, 210, 70, 'Gráficos', 'Estoque por fabricante, estoque por loja e participação por ranking.', C.blue);
card(M_LEFT + 242, bodyY + 196, 210, 70, 'Produtos por fabricante', 'Lista expansível com busca e botão Ver Produtos.', C.green);
doc.y = bodyY + 330;
screenSummary('Finalidade da aba Estoque', [
  'Consultar saldo atual em gramas por loja, fabricante, coordenador e teor.',
  'Apoiar decisões de reposição, acompanhamento de vitrine e priorização comercial.',
  'Exibir KPIs, gráficos, ranking e lista detalhada sem acesso direto ao ERP.'
]);

addContentPage('7.3 Aba Vendas', 'Análise comercial por período, loja, fabricante e coordenador.');
bodyY = screenShell(138, 'Vendas');
inputBox(M_LEFT + 12, bodyY, 74, 'Data início', '01/07/2026');
inputBox(M_LEFT + 96, bodyY, 74, 'Data fim', '31/07/2026');
inputBox(M_LEFT + 180, bodyY, 90, 'Fabricante', 'Todos');
inputBox(M_LEFT + 280, bodyY, 80, 'Loja', 'Todas');
doc.roundedRect(M_LEFT + 372, bodyY + 13, 80, 27, 4).fill(C.blue);
doc.font('Times-Bold').fontSize(8).fillColor(C.white).text('Consultar Vendas', M_LEFT + 372, bodyY + 22, { width: 80, align: 'center' });
kpiBox(M_LEFT + 12, bodyY + 68, 96, 'Total de notas', '120', 'lançamentos');
kpiBox(M_LEFT + 120, bodyY + 68, 96, 'Itens vendidos', '295', 'quantidade total');
kpiBox(M_LEFT + 228, bodyY + 68, 96, 'Lojas com venda', '7', 'ativas');
kpiBox(M_LEFT + 336, bodyY + 68, 116, 'Top produto', 'Pulseira', '54 un.');
card(M_LEFT + 12, bodyY + 144, 206, 62, 'Por fabricante', 'Gráfico de participação das vendas por fabricante.', C.blue);
card(M_LEFT + 236, bodyY + 144, 216, 62, 'Top lojas', 'Ranking horizontal por quantidade vendida.', C.gold);
card(M_LEFT + 12, bodyY + 220, 440, 52, 'Top 20 produtos e detalhamento', 'Lista ranqueada de produtos mais vendidos e tabela de notas, loja, fabricante, produto, quantidade e modelo.', C.orange);
doc.y = bodyY + 330;
screenSummary('Finalidade da aba Vendas', [
  'Acompanhar desempenho comercial por período e área responsável.',
  'Comparar fabricantes, lojas e produtos com melhor saída.',
  'Fornecer visão executiva e detalhada para decisões de compra, campanha e reposição.'
]);

addContentPage('7.4 Aba Auditoria', 'Conferência de estoque por grade, código de barras e valor.');
bodyY = screenShell(138, 'Auditoria');
doc.font('Times-Bold').fontSize(10).fillColor(C.ink).text('Auditoria - Estoque por Grade / Código de Barras', M_LEFT + 12, bodyY, { width: 300 });
inputBox(M_LEFT + 12, bodyY + 30, 92, 'Origem / banco', 'Manaus');
inputBox(M_LEFT + 114, bodyY + 30, 180, 'Loja', '1 - Manaus Matriz');
inputBox(M_LEFT + 304, bodyY + 30, 82, 'Data estoque', '04/08/2026');
doc.roundedRect(M_LEFT + 396, bodyY + 43, 56, 27, 4).fill(C.blue);
doc.font('Times-Bold').fontSize(7.6).fillColor(C.white).text('Consultar', M_LEFT + 396, bodyY + 52, { width: 56, align: 'center' });
kpiBox(M_LEFT + 12, bodyY + 96, 100, 'Itens encontrados', '511', 'saldo positivo');
kpiBox(M_LEFT + 122, bodyY + 96, 100, 'Saldo total', '1.699,1 g', 'gramas');
kpiBox(M_LEFT + 232, bodyY + 96, 104, 'Valor total', 'R$ 601.525', 'preço compra');
kpiBox(M_LEFT + 346, bodyY + 96, 106, 'Data referência', '04/08/2026', 'posição');
card(M_LEFT + 12, bodyY + 170, 440, 86, 'Resultado da auditoria', 'Tabela com código, código de barras, produto, unidade, grade, saldo, valor de compra e total. Inclui filtros, seleção de colunas e exportação em Excel/PDF.', C.gold);
doc.y = bodyY + 330;
screenSummary('Finalidade da aba Auditoria', [
  'Conferir estoque operacional por grade e código de barras.',
  'Apoiar inventário, auditoria interna e validações entre lojas.',
  'Permitir exportação controlada para análise externa ou registro documental.'
]);

addContentPage('7.5 Aba Consultas ERP', 'Consulta otimizada de vendas, contratos e movimentações por status.');
bodyY = screenShell(138, 'Consultas ERP');
doc.font('Times-Bold').fontSize(10).fillColor(C.ink).text('Consultas ERP - Vendas e Contratos', M_LEFT + 12, bodyY, { width: 260 });
['Contratos 120 dias', 'Contratos 003 dias', 'Relógio 120 dias', 'Relógio 003 dias', 'Upgrade', 'Vendas Vitrine'].forEach((t, i) => {
  smallPill(M_LEFT + 12 + (i % 3) * 146, bodyY + 30 + Math.floor(i / 3) * 28, 132, t, i === 0);
});
inputBox(M_LEFT + 12, bodyY + 98, 92, 'Origem / banco', 'Matriz');
inputBox(M_LEFT + 114, bodyY + 98, 184, 'Loja', '3 - Marabá');
inputBox(M_LEFT + 308, bodyY + 98, 70, 'Data início', '01/07/2026');
inputBox(M_LEFT + 388, bodyY + 98, 64, 'Data fim', '31/08/2026');
kpiBox(M_LEFT + 12, bodyY + 166, 100, 'Contratos', '53', 'únicos');
kpiBox(M_LEFT + 122, bodyY + 166, 100, 'Itens', '126', 'produtos');
kpiBox(M_LEFT + 232, bodyY + 166, 100, 'Quantidade', '489,6', 'soma');
kpiBox(M_LEFT + 342, bodyY + 166, 110, 'Valor total', 'R$ 170.600', 'sem duplicar');
card(M_LEFT + 12, bodyY + 236, 440, 44, 'Tabela de movimentações', 'Contratos por data, número, NF, cliente/fornecedor, status, itens, quantidade, total líquido e botão Visualizar.', C.blue);
doc.y = bodyY + 330;
screenSummary('Finalidade da aba Consultas ERP', [
  'Consultar movimentações do ERP com filtros específicos por loja, data e modalidade.',
  'Evitar consultas manuais lentas e repetitivas no sistema de origem.',
  'Entregar visão consolidada para áreas comercial, financeira, operação e gestão.'
]);

addContentPage('7.6 Aba Marketing', 'Clientes novos por período, loja, grupo e tipo de documento.');
bodyY = screenShell(138, 'Marketing');
doc.font('Times-Bold').fontSize(10).fillColor(C.ink).text('Marketing - Clientes Novos', M_LEFT + 12, bodyY, { width: 240 });
inputBox(M_LEFT + 12, bodyY + 32, 90, 'Origem / banco', 'Matriz');
inputBox(M_LEFT + 112, bodyY + 32, 70, 'Data início', '01/07/2026');
inputBox(M_LEFT + 192, bodyY + 32, 70, 'Data fim', '31/07/2026');
inputBox(M_LEFT + 272, bodyY + 32, 90, 'Loja', 'Marabá');
inputBox(M_LEFT + 372, bodyY + 32, 80, 'Documento', 'CPF');
doc.roundedRect(M_LEFT + 12, bodyY + 88, 58, 24, 4).fill(C.blue);
doc.font('Times-Bold').fontSize(8).fillColor(C.white).text('Consultar', M_LEFT + 12, bodyY + 96, { width: 58, align: 'center' });
kpiBox(M_LEFT + 12, bodyY + 136, 100, 'Clientes', '27', 'no período');
kpiBox(M_LEFT + 122, bodyY + 136, 100, 'Com grupo', '27', 'associados');
kpiBox(M_LEFT + 232, bodyY + 136, 100, 'Sem grupo', '0', 'não classificados');
kpiBox(M_LEFT + 342, bodyY + 136, 110, 'Lojas', '1', 'com cadastros');
card(M_LEFT + 12, bodyY + 212, 440, 56, 'Tabela de clientes novos', 'Código, cliente, CPF/CNPJ, data de cadastro, código da loja, loja, grupo e exportações Excel/PDF.', C.green);
doc.y = bodyY + 330;
screenSummary('Finalidade da aba Marketing', [
  'Identificar novos clientes por período, loja e tipo de documento.',
  'Apoiar campanhas, segmentação, relacionamento e acompanhamento de origem de clientes.',
  'Permitir exportação para análises externas preservando filtros e rastreabilidade.'
]);

addContentPage('8. Boas Práticas de API', 'Contrato para novas rotas e manutenção das existentes.');
sectionBand('Padrão de rota segura');
codeBlock(`app.get('/api/exemplo', async function (req, res) {
  try {
    var origem = normalizarOrigem(req.query.origem);
    var internoEst = parseInt(req.query.interno_est, 10);

    if (!Number.isInteger(internoEst) || internoEst <= 0) {
      return res.status(400).json({ erro: 'Loja inválida.' });
    }

    var sql = 'SELECT FIRST 25 CAMPO FROM TABELA WHERE INTERNO_EST = ?';
    var rows = await query(sql, [internoEst], origem);

    res.json({ dados: rows, meta: { origem: origem, total: rows.length } });
  } catch (err) {
    console.error('[api/exemplo]', err);
    res.status(500).json({ erro: 'Erro interno ao consultar dados.' });
  }
});`);
bullets([
  'Validar origem, datas, inteiros, strings e limites.',
  'Não retornar err.message em produção.',
  'Não criar endpoint que confie apenas em filtro do front-end.',
  'Não misturar mutação e consulta na mesma rota.',
  'Documentar cada rota nova em docs/catalogo-api.md.'
]);

addContentPage('9. Boas Práticas de Front-end', 'Segurança, telas e manutenção.');
table(['Tema', 'Regra', 'Motivo'], [
  ['Dados no HTML', 'Usar textContent ou escapeHtml em dados da API.', 'Reduz risco de XSS.'],
  ['Token', 'Não expor segredos; token atual fica em localStorage.', 'Segredos nunca devem ir ao navegador.'],
  ['Botões', 'Ter estados de carregando, desabilitado e erro.', 'Evita duplo clique e consultas duplicadas.'],
  ['Filtros', 'Montar URL com URLSearchParams.', 'Evita encoding incorreto.'],
  ['Tabelas', 'Alinhar números à direita e texto à esquerda.', 'Facilita auditoria visual.'],
  ['Exportações', 'Escapar conteúdo e nomear arquivo de forma previsível.', 'Evita arquivos confusos e dados quebrados.'],
], [78, 225, 150], { rowH: 36 });
heading('9.1 Padrão para renderizar texto');
codeBlock(`var td = document.createElement('td');
td.textContent = r.NOME || '';
tr.appendChild(td);`);

addContentPage('10. Boas Práticas de Segurança', 'Checklist técnico para produção.');
table(['Prioridade', 'Ação', 'Resultado esperado'], [
  ['Alta', 'Corrigir CORS para negar origem fora da whitelist.', 'Reduz abuso por sites externos.'],
  ['Alta', 'Rodar npm audit fix e testar consultas principais.', 'Remove vulnerabilidades conhecidas.'],
  ['Alta', 'Remover fallback de senha masterkey.', 'Evita credencial padrão acidental.'],
  ['Média', 'Trocar err.message por mensagem genérica em produção.', 'Reduz vazamento de detalhes internos.'],
  ['Média', 'Escapar todo innerHTML com dados da API.', 'Reduz risco de XSS.'],
  ['Média', 'Parametrizar SQL com valores do usuário.', 'Reduz risco de injeção.'],
  ['Futura', 'Migrar JWT para cookie HttpOnly/Secure/SameSite.', 'Reduz roubo de token por XSS.'],
  ['Futura', 'Remover unsafe-inline da CSP.', 'Aumenta proteção contra scripts injetados.'],
], [68, 235, 150], { rowH: 37 });

addContentPage('11. Engenharia de Software', 'Como manter o projeto evoluindo sem perda de controle.');
sectionBand('Organização recomendada por etapas');
bullets([
  'Etapa 1: documentar o existente antes de refatorar.',
  'Etapa 2: corrigir riscos com baixo impacto: CORS, audit, mensagens de erro e fallbacks.',
  'Etapa 3: padronizar validações e SQL parametrizado rota por rota.',
  'Etapa 4: separar server.js em módulos pequenos mantendo o comportamento.',
  'Etapa 5: adicionar testes automatizados para autenticação, validação e respostas de API.'
]);
heading('11.1 Estrutura futura sugerida');
codeBlock(`src/
  app.js
  config/env.js
  db/firebird.js
  middlewares/auth.js
  middlewares/security.js
  routes/estoque.routes.js
  routes/vendas.routes.js
  routes/auditoria.routes.js
  routes/contratos.routes.js
  services/cache.js
  services/ia.js
public/
docs/
tests/`);

addContentPage('12. Checklist de Publicação', 'Validações antes de enviar alterações para produção.');
table(['Item', 'Como validar', 'Status esperado'], [
  ['API sem token', 'Abrir /api/estoque no navegador anônimo.', 'Retorna Token ausente.'],
  ['Login inválido', 'Enviar senha errada várias vezes.', '401 e rate limit após tentativas.'],
  ['Login válido', 'Entrar e abrir painel.', 'Token gerado e consultas carregam.'],
  ['Estoque', 'Consultar loja, fabricante e teor.', 'Dados batem com o ERP.'],
  ['Vendas', 'Período curto e filtros.', 'Sem erro e sem lentidão excessiva.'],
  ['Auditoria', 'Com valores e sem valores.', 'Tabela e exportação corretas.'],
  ['CORS', 'Testar origem não autorizada.', 'Bloqueada.'],
  ['Logs', 'Forçar erro controlado.', 'Servidor loga; front não recebe detalhe interno.'],
], [83, 220, 150], { rowH: 36 });

addContentPage('13. Roadmap Recomendado', 'Ordem prática para elevar a nota técnica e de segurança.');
[
  ['1', 'Fechar CORS', 'Baixo risco; não altera consulta. Confirmar domínio oficial em ALLOWED_ORIGIN.', C.red],
  ['2', 'Atualizar dependências', 'Rodar npm audit fix e testar login e consultas.', C.orange],
  ['3', 'Sanitizar erros', 'Remover detalhe: err.message das respostas em produção.', C.gold],
  ['4', 'Corrigir XSS no front-end', 'Trocar innerHTML com dados por textContent ou escapeHtml.', C.blue],
  ['5', 'Parametrizar SQL restante', 'Fazer por rota com comparação de resultado antes e depois.', C.green],
  ['6', 'Modularizar server.js', 'Separar sem alterar comportamento, com testes de regressão.', C.blue],
].forEach((r, i) => {
  card(M_LEFT, 145 + i * 68, CONTENT_W, 52, `${r[0]}. ${r[1]}`, r[2], r[3]);
});

addContentPage('14. Definição de Pronto', 'Critérios mínimos para considerar uma mudança concluída.');
bullets([
  'Código alterado somente na área necessária.',
  'Nenhum segredo novo no front-end, Git ou logs.',
  'Rota documentada no catálogo da API.',
  'Entrada validada e SQL parametrizado quando o valor vem do usuário.',
  'Resposta de erro segura para o cliente.',
  'Telas testadas em desktop e mobile quando houver mudança visual.',
  'Consultas principais testadas manualmente após mudanças de back-end.',
  'npm audit sem vulnerabilidades corrigíveis de baixo risco.',
  'Documentação atualizada junto com a alteração.'
]);
sectionBand('Mensagem final');
para('Boas práticas não significam parar tudo para reescrever. O melhor caminho aqui é proteger o que já funciona, documentar as fronteiras e evoluir por pequenos passos verificáveis.');

doc.end();

outStream.on('finish', () => {
  console.log(OUT);
  console.log('planned-pages=' + pageNo);
});
