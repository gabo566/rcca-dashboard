(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RCCAManager = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const text = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const monthKey = value => {
    const date = parseDate(value);
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  };

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 100000) {
      return new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    }
    if (value == null || value === '') return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function filterByPeriod(rows, { workorder = '', from = '', to = '' } = {}) {
    return (rows || []).filter(row => {
      const order = text(row.wo);
      if (workorder && order !== workorder) return false;
      if (!from && !to) return true;
      const month = monthKey(row.failureDate) || monthKey(row.testTime) || monthKey(row.registeredDate) || monthKey(row.repairTime);
      if (!month) return false;
      return (!from || month >= from) && (!to || month <= to);
    });
  }

  function isActionClosed(action = {}) {
    return action.phase === 'CERRADA' && action.effectiveness === 'EFECTIVA' && Boolean(action.verificationDate) && Boolean(text(action.verificationEvidence));
  }

  function summarizeWorkorders(rows, productionByWorkorder = {}, actionByRow = {}, today = new Date()) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const wo = text(row.wo);
      if (!wo) return;
      if (!groups.has(wo)) groups.set(wo, { wo, events: 0, serials: new Map(), openActions: 0, overdueActions: 0 });
      const group = groups.get(wo);
      group.events += 1;
      if (text(row.serial)) group.serials.set(text(row.serial), (group.serials.get(text(row.serial)) || 0) + 1);
      const action = actionByRow[row.id] || {};
      if (!isActionClosed(action)) {
        group.openActions += 1;
        const dueDate = parseDate(action.dueDate);
        if (dueDate && dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) group.overdueActions += 1;
      }
    });
    return [...groups.values()].map(group => {
      const failedSerials = group.serials.size;
      const repeatedSerials = [...group.serials.values()].filter(count => count > 1).length;
      const rawUnits = productionByWorkorder[group.wo];
      const productionUnits = rawUnits === '' || rawUnits == null ? null : Number(rawUnits);
      const denominatorValid = Number.isInteger(productionUnits) && productionUnits > 0 && productionUnits >= failedSerials;
      return {
        wo: group.wo, events: group.events, failedSerials, repeatedSerials,
        productionUnits: Number.isInteger(productionUnits) && productionUnits >= 0 ? productionUnits : null,
        failureRate: denominatorValid ? failedSerials / productionUnits : null,
        denominatorValid, openActions: group.openActions, overdueActions: group.overdueActions
      };
    }).sort((a, b) => {
      if (a.failureRate != null && b.failureRate != null && a.failureRate !== b.failureRate) return b.failureRate - a.failureRate;
      if (a.failureRate != null && b.failureRate == null) return -1;
      if (a.failureRate == null && b.failureRate != null) return 1;
      return b.failedSerials - a.failedSerials || a.wo.localeCompare(b.wo);
    });
  }

  function summarizeActions(rows, actionByRow = {}, today = new Date()) {
    let pending = 0;
    let overdue = 0;
    let missingDueDate = 0;
    let missingEvidence = 0;
    (rows || []).forEach(row => {
      const action = actionByRow[row.id] || {};
      if (isActionClosed(action)) return;
      pending += 1;
      if (!text(action.verificationEvidence)) missingEvidence += 1;
      const dueDate = parseDate(action.dueDate);
      if (!dueDate) missingDueDate += 1;
      else if (dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) overdue += 1;
    });
    return { pending, overdue, missingDueDate, missingEvidence };
  }

  function summarizeTrend(rows) {
    const months = new Map();
    (rows || []).forEach(row => {
      const month = monthKey(row.failureDate) || monthKey(row.testTime) || monthKey(row.registeredDate) || monthKey(row.repairTime);
      if (!month) return;
      if (!months.has(month)) months.set(month, { month, events: 0, serials: new Set() });
      const bucket = months.get(month);
      bucket.events += 1;
      if (text(row.serial)) bucket.serials.add(text(row.serial));
    });
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
      .map(item => ({ month: item.month, events: item.events, serials: item.serials.size }));
  }

  function pareto(entries) {
    const total = (entries || []).reduce((sum, [, value]) => sum + value, 0);
    let accumulated = 0;
    return (entries || []).map(([label, value]) => {
      accumulated += value;
      return { label, value, cumulativeRate: total ? accumulated / total : 0 };
    });
  }

  return { monthKey, filterByPeriod, isActionClosed, summarizeWorkorders, summarizeActions, summarizeTrend, pareto };
});
