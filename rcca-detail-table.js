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
      { key: 'areaOverride', label: 'OWNER', type: 'area' }
    ] },
    { label: 'Seguimiento RCCA', columns: [
      { key: 'evidence', label: 'EVIDENCE', type: 'textarea' },
      { key: 'instrumental', label: 'INSTRUMENTAL EVIDENCE', type: 'textarea' },
      { key: 'rootCause', label: 'ROOT CAUSE CATEGORY', type: 'textarea' },
      { key: 'rcAnalysis', label: 'RC ANALYSIS', type: 'textarea' },
      { key: 'containment', label: 'CONTAINMENT ACTION', type: 'textarea' },
      { key: 'corrective', label: 'CORRECTIVE / PREVENTIVE ACTION', type: 'textarea' },
      { key: 'status', label: 'STATUS', type: 'status' },
      { key: 'postStatus', label: 'STATUS POST-RWK', type: 'postStatus' },
      { key: 'comments', label: 'COMMENTS', type: 'textarea' }
    ] },
    { label: 'Fuente', columns: [
      { key: 'remark', label: 'REMARK', type: 'longtext' }
    ] }
  ]);

  const FIELD_OPTIONS = Object.freeze({
    rootCause: ['MALA CONEXIÓN', 'FALLA FUNCIONAL', 'DAÑO FÍSICO', 'RETEST', 'AC CYCLE', 'MATERIAL DAÑADO'],
    rcAnalysis: ['REVISIÓN DE ENSAMBLE', 'VALIDACIÓN DE PROCESO', 'ANÁLISIS DE FALLA FUNCIONAL', 'REVISIÓN DE CONEXIONES', 'ANÁLISIS DE MATERIAL', 'CONFIRMACIÓN POR RETEST', 'NO SE REPRODUCE EN RETEST', 'PENDIENTE DE EVIDENCIA'],
    containment: ['REEMPLAZO POR DAÑO FÍSICO', 'REEMPLAZO POR FALLA FUNCIONAL', 'REEMPLAZO POR REQUERIMIENTO DEL CLIENTE', 'REFLASH DE TARJETAS M2, BF3', 'RESEAT DE CONEXIONES / CABLES', 'RESEAT DE TARJETAS', 'RETEST EN ESTACIÓN'],
    corrective: ['NO APLICA', 'REALIZAR UN CORRECTO ENSAMBLE POR PARTE DE MFG', 'VALIDAR EL PROCESO POR PARTE DE PE', 'ASIGNAR A PERSONAL CON LA CAPACITACIÓN REQUERIDA', 'RETROALIMENTACIÓN AL ÁREA CORRESPONDIENTE', 'DOUBLE CHECK INCOMING', 'DOUBLE CHECK EQUIPO DE QA']
  });
  const POST_RWK_OPTIONS = Object.freeze(['PASS', 'FAIL']);

  const STATUSES = domain.STATUSES;
  const FLAT_COLUMNS = GROUPS.flatMap(group => group.columns.map(column => ({ ...column, group: group.label })));
  const EDITABLE_FIELDS = new Set(['areaOverride', 'evidence', 'evidenceFileName', 'instrumental', 'instrumentalFileName', 'rootCause', 'rcAnalysis', 'containment', 'corrective', 'status', 'postStatus', 'comments']);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function fieldLabel(field) {
    return FLAT_COLUMNS.find(column => column.key === field)?.label || field;
  }

  function rowId(row) { return escapeHtml(row.id); }

  function optionValues(column, currentValue) {
    const base = column.type === 'area' ? domain.AREAS
      : column.type === 'status' ? STATUSES
        : column.type === 'postStatus' ? POST_RWK_OPTIONS
          : FIELD_OPTIONS[column.key] || [];
    return currentValue && !base.includes(currentValue) ? [currentValue, ...base] : base;
  }

  function renderSelect(row, column, value, context) {
    const options = optionValues(column, value);
    const placeholder = column.type === 'area'
      ? `<option value="AUTO" ${row.areaOverride ? '' : 'selected'}>Automática (${escapeHtml(row.autoArea || 'POR REVISAR')})</option>`
      : '<option value="">— Sin capturar —</option>';
    const renderedOptions = options.map(option => `<option value="${escapeHtml(option)}" ${String(value || '') === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
    return `<select class="table-cell-input table-cell-select" data-rcca-field="${column.key}" data-rcca-value="${escapeHtml(value || '')}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}">${placeholder}${renderedOptions}</select>`;
  }

  function renderEvidenceField(row, column) {
    const fileField = `${column.key}FileName`;
    const fileName = row[fileField] || '';
    return `<div class="evidence-editor"><textarea class="table-cell-input table-cell-textarea" rows="3" placeholder="Capturar ${escapeHtml(fieldLabel(column.key).toLowerCase())}" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}">${escapeHtml(row[column.key])}</textarea><label class="evidence-upload"><span class="material-symbols-outlined" aria-hidden="true">attach_file</span><span>Adjuntar evidencia</span><input class="file-input-inline" type="file" accept="image/*,.pdf,.txt,.csv,.xlsx" data-rcca-file-for="${column.key}" data-row-id="${rowId(row)}" aria-label="Subir evidencia para ${escapeHtml(fieldLabel(column.key))} del serial ${escapeHtml(row.serial)}" /></label>${fileName ? `<small class="evidence-file">${escapeHtml(fileName)}</small>` : ''}</div>`;
  }

  function renderEditable(row, column, context) {
    const value = column.key === 'areaOverride' ? context.assignedArea(row) : row[column.key];
    if (column.key === 'evidence' || column.key === 'instrumental') return renderEvidenceField(row, column);
    if (column.type === 'area' || column.type === 'status' || column.type === 'postStatus' || FIELD_OPTIONS[column.key]) return renderSelect(row, column, value, context);
    const controlType = column.type === 'input' ? 'input' : 'textarea';
    const control = controlType === 'input'
      ? `<input class="table-cell-input" type="text" value="${escapeHtml(value)}" placeholder="Agregar dato" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}" />`
      : `<textarea class="table-cell-input table-cell-textarea" rows="3" placeholder="Capturar ${escapeHtml(fieldLabel(column.key).toLowerCase())}" data-rcca-field="${column.key}" data-row-id="${rowId(row)}" aria-label="${escapeHtml(fieldLabel(column.key))} para serial ${escapeHtml(row.serial)}">${escapeHtml(value)}</textarea>`;
    return control;
  }

  function renderCell(row, column, context) {
    if (EDITABLE_FIELDS.has(column.key)) return `<td class="editable-cell">${renderEditable(row, column, context)}</td>`;
    if (column.type === 'serial') return `<td><button class="serial-link" type="button" data-serial="${escapeHtml(row.serial)}" aria-label="Abrir detalle del serial ${escapeHtml(row.serial)}">${escapeHtml(row.serial || '—')}</button></td>`;
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
