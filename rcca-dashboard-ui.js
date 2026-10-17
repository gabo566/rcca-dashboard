(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const announceFilter = message => {
    const hint = byId('chartFilterHint');
    if (!hint) return;
    hint.textContent = `${message} · Selecciona de nuevo para quitar este filtro.`;
    hint.dataset.active = 'true';
  };

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-dashboard-filter][data-filter-value]');
    if (!control) return;

    const value = control.dataset.filterValue;
    const kind = control.dataset.dashboardFilter;
    if (kind === 'search') {
      const input = byId('chartSearchFilter');
      if (!input) return;
      const clearing = input.value === value;
      input.value = clearing ? '' : value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      announceFilter(clearing ? `Filtro quitado: ${value}` : `Filtro aplicado: ${value}`);
      return;
    }

    if (kind === 'owner' || kind === 'workorder') {
      const select = byId(kind === 'owner' ? 'ownerFilter' : 'woFilter');
      if (!select) return;
      select.value = value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      announceFilter(`${kind === 'owner' ? 'Área' : 'Work Order'} seleccionada: ${value}`);
      return;
    }

  });
})();
