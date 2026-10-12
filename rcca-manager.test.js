'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const manager = require('./rcca-manager');

test('work order totals separate events, unique failed serials and repeated serials', () => {
  const rows = [
    { id: 'a', wo: 'WO-1', serial: 'SN-1' },
    { id: 'b', wo: 'WO-1', serial: 'SN-1' },
    { id: 'c', wo: 'WO-1', serial: 'SN-2' },
    { id: 'd', wo: 'WO-2', serial: 'SN-3' }
  ];
  const result = manager.summarizeWorkorders(rows, { 'WO-1': 10 });
  assert.deepEqual(result[0], { wo: 'WO-1', events: 3, failedSerials: 2, repeatedSerials: 1, productionUnits: 10, failureRate: 0.2, denominatorValid: true, openActions: 3, overdueActions: 0 });
  assert.equal(result[1].failureRate, null);
});

test('invalid WO denominator is not converted into a failure rate', () => {
  const result = manager.summarizeWorkorders([
    { id: 'a', wo: 'WO-1', serial: 'SN-1' },
    { id: 'b', wo: 'WO-1', serial: 'SN-2' }
  ], { 'WO-1': 1 });
  assert.equal(result[0].failureRate, null);
  assert.equal(result[0].denominatorValid, false);
});

test('closed actions require verified effectiveness and count overdue records', () => {
  const rows = [{ id: 'closed', wo: 'WO-1' }, { id: 'late', wo: 'WO-1' }, { id: 'open', wo: 'WO-1' }];
  const actions = {
    closed: { phase: 'CERRADA', effectiveness: 'EFECTIVA', verificationDate: '2026-10-01', verificationEvidence: 'EV-123' },
    late: { phase: 'EN PROCESO', effectiveness: 'PENDIENTE', dueDate: '2026-10-01' }
  };
  const today = new Date(2026, 9, 12);
  assert.deepEqual(manager.summarizeActions(rows, actions, today), { pending: 2, overdue: 1, missingDueDate: 1, missingEvidence: 2 });
  assert.equal(manager.isActionClosed({ phase: 'CERRADA', effectiveness: 'EFECTIVA', verificationDate: '2026-10-01' }), false);
});

test('monthly trend and period filter use event dates and unique serials per month', () => {
  const rows = [
    { wo: 'WO-1', serial: 'SN-1', failureDate: new Date(2026, 8, 4) },
    { wo: 'WO-1', serial: 'SN-1', failureDate: new Date(2026, 8, 8) },
    { wo: 'WO-2', serial: 'SN-2', failureDate: new Date(2026, 9, 2) },
    { wo: 'WO-2', serial: 'SN-3' }
  ];
  assert.deepEqual(manager.summarizeTrend(rows), [
    { month: '2026-09', events: 2, serials: 1 },
    { month: '2026-10', events: 1, serials: 1 }
  ]);
  assert.equal(manager.filterByPeriod(rows, { from: '2026-10' }).length, 1);
});

test('Pareto output includes cumulative percentages', () => {
  assert.deepEqual(manager.pareto([['A', 5], ['B', 3], ['C', 2]]), [
    { label: 'A', value: 5, cumulativeRate: 0.5 },
    { label: 'B', value: 3, cumulativeRate: 0.8 },
    { label: 'C', value: 2, cumulativeRate: 1 }
  ]);
});
