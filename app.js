(() => {
  'use strict';

  const STORAGE_KEY = 'pathology-logs.v1';
  const STATUS_LABELS = { 'not-sent': 'Not Sent Off', sent: 'Sent Off', closed: 'Closed' };

  const $ = (id) => document.getElementById(id);
  const grid = $('grid');
  const dialog = $('sampleDialog');
  const form = $('sampleForm');
  const filters = {
    name: $('filterName'),
    number: $('filterNumber'),
    status: $('filterStatus'),
    sort: $('sortBy'),
  };

  let samples = load();

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    } catch {
      alert('Unable to save — browser storage is unavailable.');
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of [].concat(children)) node.append(c);
    return node;
  }

  function filtered() {
    const name = filters.name.value.trim().toLowerCase();
    const number = filters.number.value.trim().toLowerCase();
    const status = filters.status.value;

    const list = samples.filter((s) =>
      (!name || s.name.toLowerCase().includes(name)) &&
      (!number || s.number.toLowerCase().includes(number)) &&
      (!status || s.status === status)
    );

    const sorters = {
      newest: (a, b) => b.created - a.created,
      oldest: (a, b) => a.created - b.created,
      name: (a, b) => a.name.localeCompare(b.name),
      number: (a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }),
    };
    return list.sort(sorters[filters.sort.value] || sorters.newest);
  }

  function renderCard(s) {
    const select = el('select', { className: `status-select ${s.status}`, title: 'Change status' },
      Object.entries(STATUS_LABELS).map(([value, label]) =>
        el('option', { value, textContent: label, selected: value === s.status })));
    select.setAttribute('aria-label', `Status for ${s.name}`);
    select.addEventListener('change', () => {
      s.status = select.value;
      s.updated = Date.now();
      save();
      render();
    });

    const editBtn = el('button', { type: 'button', className: 'icon-btn', textContent: 'Edit' });
    editBtn.addEventListener('click', () => openDialog(s));
    const delBtn = el('button', { type: 'button', className: 'icon-btn', textContent: 'Delete' });
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete sample for ${s.name} (${s.number})?`)) {
        samples = samples.filter((x) => x.id !== s.id);
        save();
        render();
      }
    });

    const details = [
      ['Specimen', s.type || '—'],
      ['Date taken', formatDate(s.date)],
      ['Updated', formatDate(new Date(s.updated || s.created).toISOString())],
    ];
    if (s.notes) details.push(['Notes', s.notes]);

    const card = el('article', { className: 'card' }, [
      el('div', { className: 'card-head' }, [
        el('h3', { className: 'card-name', textContent: s.name }),
        el('span', { className: 'card-number', textContent: `# ${s.number}` }),
      ]),
      el('div', { className: 'card-body' }, [
        el('dl', {}, details.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])),
      ]),
      el('div', { className: 'card-foot' }, [select, el('div', { className: 'card-actions' }, [editBtn, delBtn])]),
    ]);
    card.dataset.status = s.status;
    return card;
  }

  function render() {
    const list = filtered();
    grid.replaceChildren(...list.map(renderCard));
    $('emptyState').hidden = list.length > 0;
    $('resultCount').textContent = `Showing ${list.length} of ${samples.length} sample${samples.length === 1 ? '' : 's'}`;

    const count = (st) => samples.filter((s) => s.status === st).length;
    $('countAll').textContent = samples.length;
    $('countNotSent').textContent = count('not-sent');
    $('countSent').textContent = count('sent');
    $('countClosed').textContent = count('closed');
  }

  function openDialog(sample) {
    form.reset();
    $('dialogTitle').textContent = sample ? 'Edit Pathology Sample' : 'New Pathology Sample';
    $('sampleId').value = sample?.id || '';
    $('patientName').value = sample?.name || '';
    $('patientNumber').value = sample?.number || '';
    $('sampleType').value = sample?.type || '';
    $('dateTaken').value = sample?.date || new Date().toISOString().slice(0, 10);
    $('status').value = sample?.status || 'not-sent';
    $('notes').value = sample?.notes || '';
    dialog.showModal();
    $('patientName').focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('patientName').value.trim();
    const number = $('patientNumber').value.trim();
    if (!name || !number) return;

    const data = {
      name,
      number,
      type: $('sampleType').value.trim(),
      date: $('dateTaken').value,
      status: $('status').value,
      notes: $('notes').value.trim(),
      updated: Date.now(),
    };
    const id = $('sampleId').value;
    if (id) {
      Object.assign(samples.find((s) => s.id === id), data);
    } else {
      samples.push({ id: uid(), created: Date.now(), ...data });
    }
    save();
    dialog.close();
    render();
  });

  $('openAdd').addEventListener('click', () => openDialog());
  $('cancelDialog').addEventListener('click', () => dialog.close());
  $('clearFilters').addEventListener('click', () => {
    filters.name.value = '';
    filters.number.value = '';
    filters.status.value = '';
    filters.sort.value = 'newest';
    render();
  });
  for (const f of Object.values(filters)) f.addEventListener('input', render);

  render();
})();
