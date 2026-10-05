'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
global.RCCADomain = require('./rcca-domain');
const table = require('./rcca-detail-table');

const context = {
  assignedArea: row => row.areaOverride || row.autoArea,
  classificationNote: row => row.areaReason,
  formatDate: value => value || ''
};

test('contains exactly the 22 FQ template columns', () => {
  const labels = table.FLAT_COLUMNS.map(column => column.label);
  for (const label of [
    'WO', 'WK', 'FAMILIA', 'MODELO', 'SN', 'STATION', 'FAILURE DATE DD-MM-YY', 'FECHA', 'SHIFT',
    'Fail Information (SFC)', 'Defect Symptom (Real Defect)', 'Defect Location', 'OWNER',
    'EVIDENCE', 'INSTRUMENTAL EVIDENCE', 'ROOT CAUSE CATEGORY', 'RC ANALYSIS', 'CONTAINMENT ACTION',
    'CORRECTIVE / PREVENTIVE ACTION', 'STATUS', 'STATUS POST-RWK', 'COMMENTS'
  ]) assert.ok(labels.includes(label), `Falta el rubro ${label}`);
  assert.equal(table.FLAT_COLUMNS.length, 22);
  assert.equal(table.exportColumns(context).length, 22);
});

test('renders complete text, editable RCCA controls, and matching export columns', () => {
  const longDescription = 'Descripción completa de la causa, sin recorte ni puntos suspensivos. '.repeat(8);
  const row = {
    id: 'event-1', serial: 'SN-1', wo: 'WO-1', station: 'FTS', failureInfo: longDescription,
    autoArea: 'MFG', areaReason: 'El remark describe daño físico.', rootCause: '', rcAnalysis: '', containment: '', corrective: ''
  };
  const container = { innerHTML: '' };
  table.render(container, [row], context);
  assert.ok(container.innerHTML.includes(longDescription));
  assert.ok(container.innerHTML.includes('data-rcca-field="rootCause"'));
  assert.ok(container.innerHTML.includes('data-rcca-field="containment"'));
  assert.ok(container.innerHTML.includes('data-rcca-field="corrective"'));
  assert.equal((container.innerHTML.match(/<th scope="col">/g) || []).length, table.FLAT_COLUMNS.length);
  assert.equal(table.exportColumns(context).length, table.FLAT_COLUMNS.length);
});
