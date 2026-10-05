(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RCCADomain = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const AREAS = Object.freeze(['FA', 'REWORK', 'MFG', 'PRODUCTO', 'PRUEBAS', 'PROCESOS', 'POR REVISAR']);
  const STATUSES = Object.freeze(['ABIERTO', 'LLENADO', 'EN PROCESO', 'CERRADO', 'RECHAZADO']);
  const RULES = Object.freeze([
    { area: 'PRUEBAS', cue: /\b(?:ac|asic)\s*cycle\b|\bcycles?\b|\bretests?\b|\bretest\s*after\s*repair\b|\btest\s*(?:cycle|update|upgrade)\b|\bactualizaci[oó]n\s+de\s+pruebas?\b|\bfalla\s+en\s+prueba\b|\btest\s+failure\b/, reason: 'El remark indica ciclo, retest o falla de prueba.' },
    { area: 'REWORK', cue: /\bmala\s+reparaci[oó]n\b|\breparaci[oó]n\s+(?:incorrecta|deficiente|mal\s+hecha)\b|\bbad\s+repair\b|\bpoor\s+repair\b|\brepaired\s+incorrectly\b|\bmal\s+retrabajo\b|\bdefective\s+rework\b/, reason: 'El remark describe una reparación o retrabajo incorrecto.' },
    { area: 'PROCESOS', cue: /\btemperatura\b|\btemperature\b|\btin\s*pads?\b|\btinpad\b|\breflow\b|\bsoldadura\b|\bsolder(?:ing)?\b|\bflux\b|\bpar[aá]metros?\s+de\s+proceso\b|\bproceso\s+(?:incorrecto|err[oó]neo|mal\s+ejecutado)\b|\berror\s+de\s+proceso\b|\bwrong\s+process\b|\bprocess\s+error\b|\bmal\s+proceso\b/, reason: 'La evidencia apunta a un parámetro o método de proceso.' },
    { area: 'MFG', cue: /\bda[nñ]o\s+f[ií]sico\b|\bphysical\s+damage\b|\bcrack(?:ed)?\b|\bfisura\b|\bgrieta\b|\bbroken\b|\bdamaged\b|\bdamage\b|\bkapton\b|\bmal\s+ensamble\b|\bmal\s+ensambl(?:e|ado|ada)\b|\bincorrect\s+assembly\b|\bbad\s+assembly\b|\bmisassembl(?:y|ed)\b|\bmala\s+colocaci[oó]n\b|\bmal\s+colocad[oa]\b|\bwrong\s+placement\b|\bmisplaced\b|\bmal\s+manejo\b|\bmala\s+manipulaci[oó]n\b|\bcable\s+mal\s+conectado\b/, reason: 'El remark describe daño físico, colocación o ensamble.' },
    { area: 'FA', cue: /\bfalla\s+funcional\b|\bfunctional\s+(?:failure|fault|issue)\b|\bipex\b|\breseat\b|\bre-?seat\b|\breasent(?:ar|amiento|ado|ada)\b|\breasienta\b|\breasiento\b/, reason: 'El remark apunta a una reparación funcional o reasentamiento.' },
    { area: 'PRODUCTO', cue: /\bdefecto\s+de\s+producto\b|\bfalla\s+de\s+producto\b|\bproduct\s+(?:defect|issue|failure)\b|\bdise[nñ]o\s+de\s+producto\b|\bproduct\s+design\b|\bdesign\s+(?:flaw|defect|issue)\b|\bcomponente\s+defectuoso\s+de\s+origen\b/, reason: 'La evidencia identifica un defecto de producto o diseño.' }
  ]);

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  }

  function normalizeArea(value) {
    const valueKey = normalizeText(value).replace(/[^a-z0-9]/g, '');
    const aliases = {
      fa: 'FA', rework: 'REWORK', rwk: 'REWORK', retrabajo: 'REWORK',
      mfg: 'MFG', manufactura: 'MFG', manufacturing: 'MFG',
      producto: 'PRODUCTO', product: 'PRODUCTO',
      prueba: 'PRUEBAS', pruebas: 'PRUEBAS', testing: 'PRUEBAS',
      proceso: 'PROCESOS', procesos: 'PROCESOS', process: 'PROCESOS',
      porrevisar: 'POR REVISAR'
    };
    return aliases[valueKey] || '';
  }

  function classifyText(value) {
    const text = normalizeText(value);
    if (!text) return [];
    return RULES.filter(rule => rule.cue.test(text));
  }

  function resolveMatches(matches, sourceLabel) {
    const found = [...new Map(matches.map(match => [match.area, match])).values()];
    const testRule = found.find(match => match.area === 'PRUEBAS');
    if (testRule) return { area: 'PRUEBAS', reason: testRule.reason + ' Evidencia: ' + sourceLabel + '.' };
    if (found.length === 1) return { area: found[0].area, reason: found[0].reason + ' Evidencia: ' + sourceLabel + '.' };
    if (found.length > 1) return { area: 'POR REVISAR', reason: 'El texto combina criterios de ' + found.map(match => match.area).join(' y ') + '; requiere revisión.' };
    return null;
  }

  function classifyEvent(row = {}) {
    const remarkMatches = classifyText(row.remark);
    const fromRemark = resolveMatches(remarkMatches, 'REMARK');
    if (fromRemark) return fromRemark;

    const description = [row.errorDesc, row.reasonDesc, row.defect, row.failureInfo, row.dutyStation].filter(Boolean).join(' ');
    const fromDescription = resolveMatches(classifyText(description), 'descripción de falla');
    if (fromDescription) return fromDescription;
    return { area: 'POR REVISAR', reason: 'REMARK y descripción no aportan evidencia suficiente para asignar área.' };
  }

  function stableEventId(fileName, fileIndex, rowNumber) {
    return 'source-' + encodeURIComponent(String(fileName || 'archivo')) + '-' + Number(fileIndex || 0) + '-' + Number(rowNumber || 0);
  }

  function summarizeAreas(rows, areaFor) {
    const groups = new Map(AREAS.map(area => [area, { area, events: 0, serials: new Set() }]));
    (rows || []).forEach(row => {
      const normalized = normalizeArea(areaFor(row)) || 'POR REVISAR';
      const summary = groups.get(normalized) || groups.get('POR REVISAR');
      summary.events += 1;
      if (row.serial != null && String(row.serial).trim()) summary.serials.add(String(row.serial).trim());
    });
    return [...groups.values()].map(item => ({ area: item.area, events: item.events, serials: item.serials.size }));
  }

  return { AREAS, STATUSES, RULES, normalizeText, normalizeArea, classifyEvent, stableEventId, summarizeAreas };
});
