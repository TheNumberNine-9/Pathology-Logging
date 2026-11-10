(() => {
  'use strict';

  const STORAGE_KEY = 'pathology-logs.v1';
  const DOCTORS_KEY = 'pathology-logs.doctors';
  const CLINIC_KEY = 'pathology-logs.clinic';

  const CLINICS = {
    orange: 'Orange Dermatology',
    bowral: 'Bowral Dermatology',
    parkes: 'Parkes Dermatology',
  };
  const STATUS_LABELS = { received: 'Received', actioned: 'Actioned' };
  const OVERDUE_DAYS = 14;
  const DAY_MS = 86400000;
  const ADD_DOCTOR = '__add__';

  const $ = (id) => document.getElementById(id);
  const grid = $('grid');
  const dialog = $('sampleDialog');
  const form = $('sampleForm');
  const filters = {
    name: $('filterName'),
    number: $('filterNumber'),
    doctor: $('filterDoctor'),
    status: $('filterStatus'),
    sort: $('sortBy'),
  };

  /* ---------- storage ---------- */

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      alert('Unable to save — browser storage is unavailable.');
    }
  }

  let samples = read(STORAGE_KEY, []);
  if (!Array.isArray(samples)) samples = [];
  let doctors = read(DOCTORS_KEY, []);
  if (!Array.isArray(doctors)) doctors = [];
  let clinic = read(CLINIC_KEY, 'orange');
  if (!CLINICS[clinic]) clinic = 'orange';

  // Upgrade records saved by the first version (3 statuses, no clinic).
  const OLD_STATUS = { 'not-sent': 'received', sent: 'received', closed: 'actioned' };
  let migrated = false;
  for (const s of samples) {
    if (OLD_STATUS[s.status]) { s.status = OLD_STATUS[s.status]; migrated = true; }
    if (!s.clinic) { s.clinic = 'bowral'; migrated = true; }
    if (!s.receivedDate) { s.receivedDate = s.date || isoDate(new Date(s.created || Date.now())); migrated = true; }
  }
  if (migrated) write(STORAGE_KEY, samples);

  const save = () => write(STORAGE_KEY, samples);

  /* ---------- helpers ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function isoDate(d) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  function parseDate(iso) {
    return iso ? new Date(iso + 'T00:00:00') : null;
  }
  function formatDate(iso) {
    const d = parseDate(iso);
    return d && !isNaN(d) ? d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }
  function daysWaiting(s) {
    if (s.status !== 'received') return 0;
    const d = parseDate(s.receivedDate);
    if (!d || isNaN(d)) return 0;
    const today = parseDate(isoDate(new Date()));
    return Math.max(0, Math.round((today - d) / DAY_MS));
  }
  const isOverdue = (s) => s.status === 'received' && daysWaiting(s) >= OVERDUE_DAYS;

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of [].concat(children)) node.append(c);
    return node;
  }

  /* ---------- clinic menu ---------- */

  const menuBtn = $('clinicMenuBtn');
  const menu = $('clinicMenu');

  function renderClinicMenu() {
    menu.querySelectorAll('.menu-item').forEach((n) => n.remove());
    for (const [key, label] of Object.entries(CLINICS)) {
      const item = el('button', { type: 'button', className: 'menu-item', textContent: label });
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(key === clinic));
      item.addEventListener('click', () => { setClinic(key); closeMenu(); });
      menu.append(item);
    }
  }
  function openMenu() {
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    menu.querySelector('[aria-checked="true"]')?.focus();
  }
  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.clinic-menu')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuBtn.focus(); }
  });

  function setClinic(key) {
    clinic = key;
    write(CLINIC_KEY, clinic);
    $('clinicTitle').textContent = CLINICS[clinic];
    $('footerClinic').textContent = CLINICS[clinic];
    document.title = `Pathology Logs — ${CLINICS[clinic]}`;
    renderClinicMenu();
    render();
  }

  /* ---------- doctors ---------- */

  function renderDoctorOptions(selected) {
    const docSel = $('doctor');
    docSel.replaceChildren(
      el('option', { value: '', textContent: 'Select doctor…' }),
      ...doctors.map((d) => el('option', { value: d, textContent: d })),
      el('option', { value: ADD_DOCTOR, textContent: '＋ Add new doctor…' }),
    );
    // Keep a doctor on an old record selectable even if not in the list.
    if (selected && !doctors.includes(selected)) {
      docSel.insertBefore(el('option', { value: selected, textContent: selected }), docSel.lastChild);
    }
    docSel.value = selected || '';

    const current = filters.doctor.value;
    filters.doctor.replaceChildren(
      el('option', { value: '', textContent: 'All doctors' }),
      ...doctors.map((d) => el('option', { value: d, textContent: d })),
    );
    filters.doctor.value = doctors.includes(current) ? current : '';
  }

  let lastDoctor = '';
  $('doctor').addEventListener('focus', () => { lastDoctor = $('doctor').value; });
  $('doctor').addEventListener('change', () => {
    const docSel = $('doctor');
    if (docSel.value !== ADD_DOCTOR) { lastDoctor = docSel.value; return; }
    const name = (prompt('Doctor name (e.g. Dr Jane Smith):') || '').trim();
    if (name) {
      if (!doctors.includes(name)) {
        doctors.push(name);
        doctors.sort((a, b) => a.localeCompare(b));
        write(DOCTORS_KEY, doctors);
      }
      renderDoctorOptions(name);
      lastDoctor = name;
    } else {
      docSel.value = lastDoctor;
    }
  });

  /* ---------- status changes ---------- */

  function applyStatus(s, status, receivedDate) {
    // Restart the received clock (and overdue reminders) when the sample is moved
    // back to Received, or when the received date is edited in the form.
    const newDate = receivedDate || (status === 'received' && s.status !== 'received' ? isoDate(new Date()) : null);
    if (newDate && newDate !== s.receivedDate) {
      s.receivedDate = newDate;
      s.notifiedWeek = 0;
    }
    if (status === 'actioned' && s.status !== 'actioned') s.actionedDate = isoDate(new Date());
    s.status = status;
  }

  /* ---------- rendering ---------- */

  const clinicSamples = () => samples.filter((s) => s.clinic === clinic);

  function filtered() {
    const name = filters.name.value.trim().toLowerCase();
    const number = filters.number.value.trim().toLowerCase();
    const doctor = filters.doctor.value;
    const status = filters.status.value;

    const list = clinicSamples().filter((s) =>
      (!name || s.name.toLowerCase().includes(name)) &&
      (!number || s.number.toLowerCase().includes(number)) &&
      (!doctor || s.doctor === doctor) &&
      (!status || (status === 'overdue' ? isOverdue(s) : s.status === status))
    );

    const sorters = {
      newest: (a, b) => b.created - a.created,
      oldest: (a, b) => a.created - b.created,
      waiting: (a, b) => daysWaiting(b) - daysWaiting(a) || a.created - b.created,
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
      applyStatus(s, select.value);
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
      ['DOB', formatDate(s.dob)],
      ['Doctor', s.doctor || '—'],
      ['Specimen', s.type || '—'],
      ['Date taken', formatDate(s.date)],
      ['Received', formatDate(s.receivedDate)],
    ];
    if (s.status === 'actioned' && s.actionedDate) details.push(['Actioned', formatDate(s.actionedDate)]);
    if (s.notes) details.push(['Notes', s.notes]);

    const head = [
      el('h3', { className: 'card-name', textContent: s.name }),
      el('span', { className: 'card-number', textContent: `# ${s.number}` }),
    ];
    if (s.status === 'received') {
      const days = daysWaiting(s);
      head.push(el('span', {
        className: `wait-badge${isOverdue(s) ? ' overdue' : ''}`,
        textContent: isOverdue(s) ? `Overdue · ${days} days on Received` : `${days} day${days === 1 ? '' : 's'} on Received`,
      }));
    }

    const card = el('article', { className: `card${isOverdue(s) ? ' is-overdue' : ''}` }, [
      el('div', { className: 'card-head' }, head),
      el('div', { className: 'card-body' }, [
        el('dl', {}, details.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])),
      ]),
      el('div', { className: 'card-foot' }, [select, el('div', { className: 'card-actions' }, [editBtn, delBtn])]),
    ]);
    card.dataset.status = s.status;
    return card;
  }

  function render() {
    const all = clinicSamples();
    const list = filtered();
    grid.replaceChildren(...list.map(renderCard));
    $('emptyState').hidden = list.length > 0;
    $('resultCount').textContent = `Showing ${list.length} of ${all.length} sample${all.length === 1 ? '' : 's'} at ${CLINICS[clinic]}`;

    const overdue = all.filter(isOverdue).length;
    $('countAll').textContent = all.length;
    $('countReceived').textContent = all.filter((s) => s.status === 'received').length;
    $('countActioned').textContent = all.filter((s) => s.status === 'actioned').length;
    $('countOverdue').textContent = overdue;

    $('overdueBanner').hidden = overdue === 0;
    $('overdueText').textContent =
      `${overdue} sample${overdue === 1 ? ' has' : 's have'} been on Received for more than 2 weeks at ${CLINICS[clinic]}.`;

    checkOverdueNotifications();
  }

  /* ---------- dialog ---------- */

  $('clinic').replaceChildren(...Object.entries(CLINICS).map(([v, t]) => el('option', { value: v, textContent: t })));

  function openDialog(sample) {
    form.reset();
    const today = isoDate(new Date());
    $('dialogTitle').textContent = sample ? 'Edit Pathology Sample' : 'New Pathology Sample';
    $('sampleId').value = sample?.id || '';
    $('patientName').value = sample?.name || '';
    $('patientNumber').value = sample?.number || '';
    $('dob').value = sample?.dob || '';
    $('clinic').value = sample?.clinic || clinic;
    renderDoctorOptions(sample?.doctor || '');
    $('sampleType').value = sample?.type || '';
    $('dateTaken').value = sample?.date || today;
    $('status').value = sample?.status || 'received';
    $('receivedDate').value = sample?.receivedDate || today;
    $('notes').value = sample?.notes || '';
    dialog.showModal();
    $('patientName').focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('patientName').value.trim();
    const number = $('patientNumber').value.trim();
    if (!name || !number) return;

    const doctor = $('doctor').value === ADD_DOCTOR ? '' : $('doctor').value;
    const data = {
      name,
      number,
      dob: $('dob').value,
      clinic: $('clinic').value,
      doctor,
      type: $('sampleType').value.trim(),
      date: $('dateTaken').value,
      notes: $('notes').value.trim(),
      updated: Date.now(),
    };
    const status = $('status').value;
    const receivedDate = $('receivedDate').value || isoDate(new Date());

    const id = $('sampleId').value;
    let s = id && samples.find((x) => x.id === id);
    if (s) {
      Object.assign(s, data);
    } else {
      s = { id: uid(), created: Date.now(), status: '', notifiedWeek: 0, ...data };
      samples.push(s);
    }
    applyStatus(s, status, receivedDate);
    save();
    dialog.close();
    if (s.clinic !== clinic) setClinic(s.clinic); else render();
  });

  $('openAdd').addEventListener('click', () => openDialog());
  $('cancelDialog').addEventListener('click', () => dialog.close());

  /* ---------- filters ---------- */

  function clearFilters() {
    filters.name.value = '';
    filters.number.value = '';
    filters.doctor.value = '';
    filters.status.value = '';
    filters.sort.value = 'newest';
  }
  $('clearFilters').addEventListener('click', () => { clearFilters(); render(); });
  for (const f of Object.values(filters)) f.addEventListener('input', render);

  function showOverdue(clinicKey) {
    clearFilters();
    filters.status.value = 'overdue';
    filters.sort.value = 'waiting';
    if (clinicKey && clinicKey !== clinic) setClinic(clinicKey); else render();
  }
  $('showOverdue').addEventListener('click', () => showOverdue());

  /* ---------- notifications ---------- */
  // A sample on "Received" triggers a reminder at 2 weeks, then once every
  // further week (3, 4, 5…) until it is changed to "Actioned".
  // Checks run while this page is open in a browser tab.

  const notifyBtn = $('notifyBtn');
  const canNotify = 'Notification' in window;

  function updateNotifyBtn() {
    if (!canNotify) { notifyBtn.hidden = true; return; }
    const p = Notification.permission;
    notifyBtn.hidden = p === 'granted';
    notifyBtn.textContent = p === 'denied' ? 'Notifications Blocked' : 'Enable Notifications';
    notifyBtn.disabled = p === 'denied';
    notifyBtn.title = p === 'denied' ? 'Allow notifications for this site in your browser settings.' : '';
  }
  notifyBtn.addEventListener('click', async () => {
    await Notification.requestPermission();
    updateNotifyBtn();
    checkOverdueNotifications();
  });

  function checkOverdueNotifications() {
    if (!canNotify || Notification.permission !== 'granted') return;
    const due = [];
    for (const s of samples) {
      if (!isOverdue(s)) continue;
      const week = Math.floor(daysWaiting(s) / 7);
      if ((s.notifiedWeek || 0) < week) {
        s.notifiedWeek = week;
        due.push(s);
      }
    }
    if (!due.length) return;
    save();

    const send = (title, body, tag, clinicKey) => {
      try {
        const n = new Notification(title, { body, tag, icon: 'assets/logo.png' });
        n.onclick = () => { window.focus(); showOverdue(clinicKey); n.close(); };
      } catch { /* notifications unsupported in this context */ }
    };

    if (due.length <= 3) {
      for (const s of due) {
        send(
          `Pathology overdue: ${s.name} (#${s.number})`,
          `${CLINICS[s.clinic]} · ${s.doctor || 'No doctor set'} — on "Received" for ${daysWaiting(s)} days. Please action.`,
          `path-${s.id}`,
          s.clinic,
        );
      }
    } else {
      send(
        `${due.length} pathology samples overdue`,
        `${due.length} samples have been on "Received" for 2+ weeks without being actioned.`,
        'path-summary',
        due[0].clinic,
      );
    }
  }

  // Re-check periodically and when the tab regains focus.
  setInterval(() => render(), 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  /* ---------- init ---------- */

  renderDoctorOptions('');
  updateNotifyBtn();
  setClinic(clinic);
})();
