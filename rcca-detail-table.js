(function (root, factory) {
  const api = factory(root.RCCADomain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RCCADetailTable = api;
})(typeof globalThis === 'object' ? globalThis : this, function (domain) {
  'use strict';

  if (!domain) throw new Error('rcca-domain.js debe cargarse antes de rcca-detail-table.js.');

  const GROUPS = Object.freeze([
    { label: 'Identificación', columns: [
      { key: 'wo', label: 'WO' }, { key: 'week', label: 'WK' }, { key: 'family', label: 'FAMILIA' },
      { key: 'model', label: 'MODELO' }, { key: 'serial', label: 'SN', type: 'serial' },
      { key: 'station', label: 'STATION', value: row => row.station || row.testStation },
      { key: 'failureDate', label: 'FAILURE DATE DD-MM-YY', value: row => row.failureDate || row.testTime, type: 'date' },
      { key: 'registeredDate', label: 'FECHA', value: row => row.registeredDate || row.repairTime, type: 'date' },
      { key: 'shift', label: 'SHIFT' }
    ] },
    { label: 'Falla y asignación', columns: [
      { key: 'failureInfo', label: 'Fail Information (SFC)' },
      { key: 'defect', label: 'Defect Symptom (Real Defect)', value: row => row.defect || row.reasonDesc },
      { key: 'location', label: 'Defect Location' },
      { key: 'areaOverride', label: 'OWNER / ÁREA ASIGNADA', type: 'area' }
    ] },
    { label: 'Seguimiento RCCA', columns: [
      { key: 'evidence', label: 'EVIDENCE', type: 'textarea' },
      { key: 'instrumental', label: 'INSTRUMENTAL EVIDENCE', type: 'textarea' },
      { key: 'rootCause', label: 'ROOT CAUSE CATEGORY', type: 'textarea' },
      { key: 'rcAnalysis', label: 'RC ANALYSIS', type: 'textarea' },
      { key: 'containment', label: 'CONTAINMENT ACTION', type: 'textarea' },
      { key: 'corrective', label: 'CORRECTIVE / PREVENTIVE ACTION', type: 'textarea' },
      { key: 'status', label: 'STATUS', type: 'status' },
      { key: 'postStatus', label: 'STATUS POST-RWK', type: 'input' },
      { key: 'comments', label: 'COMMENTS', type: 'textarea' }
    ] },
    { label: 'Reporte FALLAS', columns: [
      { key: 'actualStation', label: 'ACTUAL_STATION' }, { key: 'repairStation', label: 'REPAIR STATION' },
      { key: 'repairer', label: 'REPAIRER' }, { key: 'errorCode', label: 'ERROR_CODE' },
      { key: 'reasonCode', label: 'REASON_CODE' }, { key: 'dutyStation', label: 'DUTY_STATION' },
      { key: 'remark', label: 'REMARK' }, { key: 'sourceOwner', label: 'OWNER (fuente)' },
      { key: 'areaReason', label: 'CRITERIO DE ASIGNACIÓN', type: 'reason' }
    ] }
  ]);

  const STATUSES = domain.STATUSES;
  const FLAT_COLUMNS = GROUPS.flatMap(group => group.columns.map(column => ({ ...column, group: group.label })));
  const EDITABLE_FIELDS = new Set(['areaOverride', 'evidence', 'instrumental', 'rootCause', 'rcAnalysis', 'containment', 'corrective', 'status', 'postStatus', 'comments']);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function fieldLabel(field) {
    return FLAT_COLUMNS.find(column => column.key === field)?.label || field;
  }

  function rowId(row) { return escapeHtml(row.id); }

  function renderSelect(row, column, value, context) {
    const options = column.type === 'area' ? domain.AREAS : STATUSES;
    const placeholder = column.type === 'area'
      ? `<option value="AUTO" ${row.areaOverride ? '' : 'selected'}>Automática (${escapeHtml(row.autoArea || 'POR REVISAR')})</option>`
      : '<option value="">— Sin capturar —</option>';
    const renderedOptions = options.map(option => `<option value="${escapeHtml(option)}" ${String(value || '') === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
    return `<select class="table-cell-input table-cell-select" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}">${placeholder}${renderedOptions}</select>`;
  }

  function renderEditable(row, column, context) {
    const value = column.key === 'areaOverride' ? context.assignedArea(row) : row[column.key];
    if (column.type === 'area' || column.type === 'status') return renderSelect(row, column, value, context);
    const controlType = column.type === 'input' ? 'input' : 'textarea';
    const control = controlType === 'input'
      ? `<input class="table-cell-input" type="text" value="${escapeHtml(value)}" placeholder="Agregar dato" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}" />`
      : `<textarea class="table-cell-input table-cell-textarea" rows="3" placeholder="Capturar ${escapeHtml(fieldLabel(column.key).toLowerCase())}" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}">${escapeHtml(value)}</textarea>`;
    return control;
  }

  function renderCell(row, column, context) {
    if (EDITABLE_FIELDS.has(column.key)) return `<td class="editable-cell">${renderEditable(row, column, context)}</td>`;
    if (column.type === 'serial') return `<td><button class="serial-link" type="button" data-serial="${escapeHtml(row.serial)}" aria-label="Abrir detalle del serial ${escapeHtml(row.serial)}">${escapeHtml(row.serial || '—')}</button></td>`;
    if (column.type === 'reason') return `<td class="reason-cell">${escapeHtml(context.classificationNote(row) || '—')}</td>`;
    const value = column.value ? column.value(row) : row[column.key];
    const display = column.type === 'date' ? context.formatDate(value) : value;
    return `<td>${escapeHtml(display || '—')}</td>`;
  }

  function render(container, rows, context) {
    const groupHeader = GROUPS.map(group => `<th scope="colgroup" colspan="${group.columns.length}">${escapeHtml(group.label)}</th>`).join('');
    const columnHeader = FLAT_COLUMNS.map(column => `<th scope="col">${escapeHtml(column.label)}</th>`).join('');
    const body = rows.map(row => `<tr data-event-row="${rowId(row)}">${FLAT_COLUMNS.map(column => renderCell(row, column, context)).join('')}</tr>`).join('');
    container.innerHTML = `<table class="incident-table rcca-detail-table"><caption class="sr-only">Detalle completo de fallas y rubros del formato FQ-3264-INT-NVD</caption><thead><tr class="column-groups">${groupHeader}</tr><tr>${columnHeader}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function csvValue(row, column, context) {
    if (column.key === 'areaOverride') return context.assignedArea(row);
    if (column.type === 'reason') return context.classificationNote(row);
    const value = column.value ? column.value(row) : row[column.key];
    return column.type === 'date' ? context.formatDate(value) : value || '';
  }

  function exportColumns(context) {
    return FLAT_COLUMNS.map(column => ({ label: column.label, value: row => csvValue(row, column, context) }));
  }

  return { GROUPS, FLAT_COLUMNS, EDITABLE_FIELDS, STATUSES, fieldLabel, render, exportColumns };
});
