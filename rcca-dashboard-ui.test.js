'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(require.resolve('./rcca-dashboard-ui.js'), 'utf8');
const dashboard = fs.readFileSync(require.resolve('./rcca-dashboard.html'), 'utf8');

function mountUi() {
  const elements = new Map();
  let clickHandler;
  class FakeEvent {
    constructor(type, options = {}) { this.type = type; this.bubbles = options.bubbles || false; }
  }
  const document = {
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', dataset: {}, dispatches: [], dispatchEvent(event) { this.dispatches.push(event); } });
      return elements.get(id);
    }
  };
  vm.runInNewContext(source, { document, Event: FakeEvent });
  return {
    elements,
    click(kind, value) {
      const control = { dataset: { dashboardFilter: kind, filterValue: value } };
      clickHandler({ target: { closest: selector => selector === '[data-dashboard-filter][data-filter-value]' ? control : null } });
    }
  };
}

test('chart failure filters apply and toggle off without a visible search field', () => {
  const ui = mountUi();
  ui.click('search', 'Missing Kapton');
  assert.equal(ui.elements.get('chartSearchFilter').value, 'Missing Kapton');
  assert.equal(ui.elements.get('chartSearchFilter').dispatches[0].type, 'input');
  assert.equal(ui.elements.get('chartFilterHint').dataset.active, 'true');
  ui.click('search', 'Missing Kapton');
  assert.equal(ui.elements.get('chartSearchFilter').value, '');
});

test('area and WO chart filters target the corresponding selectors', () => {
  const ui = mountUi();
  ui.click('owner', 'MANUFACTURA');
  ui.click('workorder', 'WO-123');
  assert.equal(ui.elements.get('ownerFilter').value, 'MANUFACTURA');
  assert.equal(ui.elements.get('woFilter').value, 'WO-123');
});

test('dashboard moves charts above action tracking and removes the two large panels', () => {
  const dashboardView = dashboard.split('<section id="view-rcca"')[0];
  assert.ok(dashboardView.indexOf('class="toolbar-card"') < dashboardView.indexOf('class="chart-grid"'));
  assert.ok(dashboardView.indexOf('class="chart-grid"') < dashboardView.indexOf('id="actionsTitle"'));
  assert.doesNotMatch(dashboardView, /id="workorderSummary"|id="trendChart"|aria-labelledby="woSummaryTitle"|aria-labelledby="trendTitle"/);
  assert.match(dashboard, /'Impacto por Work Order'/);
  assert.match(dashboard, /'Tendencia mensual'/);
});

test('title is centered in the top bar and filters only keep the Excel export button', () => {
  const dashboardView = dashboard.split('<section id="view-rcca"')[0];
  const toolbarStart = dashboardView.indexOf('<section class="card toolbar-card"');
  const toolbarEnd = dashboardView.indexOf('</section>', toolbarStart);
  const toolbar = dashboardView.slice(toolbarStart, toolbarEnd);
  assert.match(dashboard, /<h1 id="pageTitle" class="topbar-title">RCCA \/ YIELD NVD<\/h1>/);
  assert.match(dashboard, /\.topbar-title[^}]*text-align: center/);
  assert.doesNotMatch(dashboard, /id="sourceChip"|\$\('#sourceChip'\)/);
  assert.match(dashboard, /\.topbar[^}]*background: #172733/);
  assert.match(dashboard, /\.topbar-title[^}]*color: #fff/);
  assert.doesNotMatch(dashboard, /aiStatusChip|Reglas locales/);
  assert.match(toolbar, /id="exportExcel"/);
  assert.equal((toolbar.match(/<button\b/g) || []).length, 1);
  assert.doesNotMatch(toolbar, /Buscar WO, serial|id="searchInput"/);
  assert.match(dashboard, /id="chartSearchFilter" type="hidden"/);
  assert.match(dashboard, /\.chart-grid[^}]*margin: 18px 0 12px/);
  assert.doesNotMatch(toolbar, /id="exportCsv"|id="clearFilters"/);
  assert.match(dashboard, /id="fileInput"/);
  assert.match(dashboard, />Importar Excel<\/label>/);
});
