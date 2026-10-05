'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const domain = require('./rcca-domain');

test('classifies the supplied examples with REMARK priority', () => {
  const cases = [
    [{ remark: 'AC CYCLE' }, 'PRUEBAS'],
    [{ errorDesc: 'Missing Kapton', reasonDesc: 'assembly', remark: 'colocacion de cinta kapton' }, 'MFG'],
    [{ errorDesc: 'IPEX Board Functional failure', remark: 'REEMPLAZO DE IPEX L POR FALLA FUNCIONAL' }, 'FA'],
    [{ errorDesc: 'BMC issue', remark: 'RESEAT BMC, J21/J22, RETEST' }, 'PRUEBAS'],
    [{ errorDesc: 'No boot', reasonDesc: 'Bianca L Damage', remark: 'REEMPLAZO DE CABLE J15' }, 'MFG'],
    [{ errorDesc: 'Coldplate damage', remark: 'fisura física en coldplate; reemplazo de cable' }, 'MFG'],
    [{ remark: 'mala reparación del cable' }, 'REWORK'],
    [{ remark: 'temperatura incorrecta de tin pads' }, 'PROCESOS'],
    [{ remark: 'defecto de diseño de producto' }, 'PRODUCTO'],
    [{ remark: 'sin detalle suficiente' }, 'POR REVISAR']
  ];
  for (const [event, expected] of cases) assert.equal(domain.classifyEvent(event).area, expected, JSON.stringify(event));
});

test('normalizes previous template owner labels without inventing a mapping', () => {
  assert.equal(domain.normalizeArea('RWK'), 'REWORK');
  assert.equal(domain.normalizeArea('MANUFACTURA'), 'MFG');
  assert.equal(domain.normalizeArea('PROCESO'), 'PROCESOS');
  assert.equal(domain.normalizeArea('CALIDAD'), '');
});

test('area summary counts events and distinct serials independently', () => {
  const rows = [
    { serial: 'SN-1', area: 'MFG' },
    { serial: 'SN-1', area: 'MFG' },
    { serial: 'SN-1', area: 'FA' },
    { serial: 'SN-2', area: 'POR REVISAR' }
  ];
  const summary = domain.summarizeAreas(rows, row => row.area);
  assert.deepEqual(summary.find(item => item.area === 'MFG'), { area: 'MFG', events: 2, serials: 1 });
  assert.deepEqual(summary.find(item => item.area === 'FA'), { area: 'FA', events: 1, serials: 1 });
  assert.deepEqual(summary.find(item => item.area === 'POR REVISAR'), { area: 'POR REVISAR', events: 1, serials: 1 });
  assert.equal(summary.length, domain.AREAS.length);
});
