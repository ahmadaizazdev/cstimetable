'use strict';

/* ---------- Constants ---------- */
const KEY = 'timetableState';
const SAVED_KEY = 'savedTimetablesList';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ROOM_TYPES = ['Room', 'Lab', 'Hall', 'E-Class', 'Online'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const PALETTE = [
  '#e0f2fe', '#dcfce7', '#f3e8ff', '#fce7f3', '#ffedd5', '#cffafe', 
  '#f3f4f6', '#fef08a', '#fecdd3', '#d1fae5', '#e0e7ff', '#ffe4e6'
];

const ENT = {
  programs: { one: 'Program', title: 'Programs', fk: 'programId', cols: [['name', 'Name'], ['color', 'Color', 'color']] },
  teachers: { one: 'Teacher', title: 'Teachers', fk: 'teacherId', cols: [['name', 'Name']] },
  courses:  { one: 'Course',  title: 'Courses',  fk: 'courseId',  cols: [['code', 'Code'], ['title', 'Title']] },
  rooms:    { one: 'Room',    title: 'Rooms',    fk: 'roomId',    cols: [['name', 'Name'], ['type', 'Type', 'select', ROOM_TYPES]] }
};

/* ---------- State ---------- */
let state = { programs: [], teachers: [], rooms: [], courses: [], sessions: [] };
let view = 'dashboard';
let f = { p: '', sem: 1, sec: 'A' };
let modalHandlers = null;

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const byId = (k, id) => state[k].find(x => x.id === id);
const name = (k, id) => { const x = byId(k, id); return x ? (x.name || x.code) : '?'; };
const pName = id => name('programs', id);
const courseLabel = id => { const c = byId('courses', id); return c ? `${c.code} ${c.title}` : '?'; };

const to12h = (time) => {
  if (!time) return '';
  let [h, m] = time.split(':');
  h = parseInt(h);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; 
  t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> ${esc(msg)}`;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

/* ---------- Persistence ---------- */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    $('saveState').innerHTML = `<i class="fa-solid fa-cloud"></i> Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) { $('saveState').textContent = 'Auto-save failed'; }
}

async function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  if (raw) {
    try { state = JSON.parse(raw); } catch (e) {}
  } else {
    try { const r = await fetch('timetable.json'); if (r.ok) state = await r.json(); } catch (e) {}
  }
  ['programs', 'teachers', 'rooms', 'courses', 'sessions'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; });
}

function exportJson() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = 'timetable.json'; a.click(); URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      ['programs', 'teachers', 'rooms', 'courses', 'sessions'].forEach(k => { if (!Array.isArray(d[k])) throw Error('missing "' + k + '" list'); });
      state = d; save(); initFilters(); render(); toast('Timetable imported', 'success');
    } catch (e) { toast('Could not import: ' + e.message, 'error'); }
  };
  r.readAsText(file);
}

/* ---------- Saved Views ---------- */
function saveCurrentView() {
  const c = cur();
  const label = `${pName(c.p)} - Sem ${c.sem} - Sec ${c.sec}`;
  const sessions = state.sessions.filter(s => inGroup(s, { programId: c.p, semester: c.sem, section: c.sec }));
  
  if (!sessions.length) return toast('No sessions to save in this view.', 'error');

  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
  saved[label] = { 
    timestamp: new Date().toISOString(), 
    sessions: JSON.parse(JSON.stringify(sessions)) 
  };
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  toast(`Saved: ${label}`, 'success');
  if (view === 'saved') renderSaved();
}

function deleteSaved(key) {
  if (!confirm('Delete this saved timetable?')) return;
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
  delete saved[key];
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  renderSaved();
  toast('Deleted.', 'success');
}

function loadSaved(key) {
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
  if (!saved[key]) return toast('Not found.', 'error');
  
  const [pStr, semStr, secStr] = key.split(' - ');
  const program = state.programs.find(p => p.name === pStr);
  if (!program) return toast('Program missing.', 'error');
  const sem = parseInt(semStr.replace('Sem ', ''));
  const sec = secStr.replace('Sec ', '');

  const g = { programId: program.id, semester: sem, section: sec };
  state.sessions = state.sessions.filter(s => !inGroup(s, g));
  state.sessions.push(...saved[key].sessions);
  
  save();
  f.p = program.id; f.sem = sem; f.sec = sec;
  initFilters();
  view = 'builder'; render();
  toast(`Loaded: ${key}`, 'success');
}

/* ---------- Conflict & Logic ---------- */
const groupsOf = s => [{ programId: s.programId, semester: +s.semester, section: s.section }, ...(s.mergedWith || [])];
const sameG = (a, b) => a.programId === b.programId && +a.semester === +b.semester && a.section === b.section;
const gLabel = g => `${pName(g.programId)} ${g.semester}-${g.section}`;
const inGroup = (s, g) => groupsOf(s).some(x => sameG(x, g));
const overlap = (a, b) => a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime;

function findConflicts(s) {
  if (s.type === 'Free') return []; 
  const out = [], gs = groupsOf(s), room = byId('rooms', s.roomId);
  for (const o of state.sessions) {
    if (o.id === s.id || o.type === 'Free' || !overlap(s, o)) continue;
    const when = `${o.day} ${to12h(o.startTime)}-${to12h(o.endTime)} (${name('courses', o.courseId)})`;
    if (o.teacherId === s.teacherId) out.push(`Teacher ${name('teachers', o.teacherId)} is already booked ${when}`);
    if (o.roomId === s.roomId && !(room && room.type === 'Online')) out.push(`Room ${name('rooms', o.roomId)} is already booked ${when}`);
    const shared = gs.find(a => groupsOf(o).some(b => sameG(a, b)));
    if (shared) out.push(`Section ${gLabel(shared)} is already booked ${when}`);
  }
  return out;
}

const colorOf = s => {
  const c = byId('courses', s.courseId);
  if (!c) return 'c6'; 
  const idx = state.courses.indexOf(c) % 12;
  return 'c' + (idx < 0 ? 0 : idx);
};

/* ---------- Filters ---------- */
const cur = () => ({ p: f.p, sem: +f.sem, sec: f.sec });
function opts(items, sel) { return items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join(''); }
function allSections() { return [...new Set([...SECTIONS, ...state.sessions.map(s => s.section)])].sort(); }

function initFilters() {
  if (!byId('programs', f.p)) f.p = state.programs[0] ? state.programs[0].id : '';
  $('fProgram').innerHTML = opts(state.programs.map(p => [p.id, p.name]), f.p) || '<option value="">No programs</option>';
  $('fSemester').innerHTML = opts(SEMESTERS.map(n => [n, n]), f.sem);
  $('fSection').innerHTML = opts(allSections().map(x => [x, x]), f.sec);
  
  $('xProgram').innerHTML = $('fProgram').innerHTML;
  $('xSemester').innerHTML = $('fSemester').innerHTML;
  $('xSection').innerHTML = $('fSection').innerHTML;
}

/* ---------- Modal & Form Helpers ---------- */
function openModal(title, html, onSave, onDelete) {
  $('modalTitle').textContent = title;
  $('modalForm').innerHTML = '<div id="formError"></div>' + html;
  $('modalDelete').hidden = !onDelete;
  modalHandlers = { onSave, onDelete };
  $('modal').hidden = false;
  const first = $('modalForm').querySelector('input,select'); if (first) first.focus();
}
const closeModal = () => { $('modal').hidden = true; modalHandlers = null; };

function showFormError(msg) {
  $('formError').innerHTML = `<div class="form-error"><i class="fa-solid fa-circle-exclamation"></i> ${esc(msg).replace(/\n/g, '<br>')}</div>`;
}
const field = (n, label, v = '', type = 'text', extra = '') => `<label>${label}<input name="${n}" type="${type}" value="${esc(v)}" ${extra}></label>`;

/* ---------- Entity CRUD ---------- */
function renderEntity(k) {
  const E = ENT[k], rows = state[k];
  $('view-' + k).innerHTML = `
    <div class="list-head"><h1>${E.title}</h1><button class="btn primary" data-act="add" data-k="${k}"><i class="fa-solid fa-plus"></i> Add ${E.one.toLowerCase()}</button></div>
    ${rows.length ? `<table class="data"><thead><tr>${E.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${E.cols.map(c => `<td>${c[2] === 'color' ? `<span class="swatch" style="background:${esc(r[c[0]])}"></span>${esc(r[c[0]])}` : esc(r[c[0]])}</td>`).join('')}
        <td class="row-actions"><button class="btn" data-act="edit" data-k="${k}" data-id="${r.id}"><i class="fa-solid fa-pen"></i></button></td></tr>`).join('')}
    </tbody></table>` : `<div class="empty">No ${E.title.toLowerCase()} yet.</div>`}`;
}

function editEntity(k, id) {
  const E = ENT[k], item = id ? byId(k, id) : {};
  let html = E.cols.map(([n, l, t, o]) =>
    t === 'select' ? `<label>${l}<select name="${n}">${opts(o.map(x => [x, x]), item[n] || o[0])}</select></label>`
      : t === 'color' ? `<label>${l}<input name="${n}" type="color" value="${esc(item[n] || PALETTE[state[k].length % 12])}" style="height:40px;"></label>`
      : field(n, l, item[n] || '')).join('');
  
  openModal((id ? 'Edit ' : 'Add ') + E.one.toLowerCase(), html, d => {
    if (!String(d[E.cols[0][0]]).trim()) return E.cols[0][1] + ' is required';
    E.cols.forEach(c => d[c[0]] = String(d[c[0]]).trim());
    if (id) Object.assign(item, d); else state[k].push({ id: uid(k[0]), ...d });
    if (k === 'programs') initFilters();
  }, id ? () => {
    const used = state.sessions.some(s => s[E.fk] === id || (k === 'programs' && (s.mergedWith || []).some(m => m.programId === id)));
    if (used) return toast(`Can't delete: used by sessions.`, 'error');
    if (!confirm('Delete this ' + E.one.toLowerCase() + '?')) return;
    state[k] = state[k].filter(x => x.id !== id);
    if (k === 'programs') initFilters();
    return true;
  } : null);
}

/* ---------- Autocomplete ---------- */
function setupAutocomplete(inputId, listId, items, displayKey, valueKey) {
  const input = $(inputId);
  const list = $(listId);
  if (!input || !list) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    list.innerHTML = '';
    if (!val) { list.classList.remove('active'); return; }

    const filtered = items.filter(item => String(item[displayKey]).toLowerCase().includes(val));
    if (!filtered.length) { list.classList.remove('active'); return; }

    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = item[displayKey];
      div.onclick = () => {
        input.value = item[displayKey];
        input.dataset.selectedId = item[valueKey];
        list.classList.remove('active');
        input.dispatchEvent(new Event('change'));
      };
      list.appendChild(div);
    });
    list.classList.add('active');
  });

  input.addEventListener('blur', () => setTimeout(() => list.classList.remove('active'), 200));
  input.addEventListener('change', () => {
    const val = input.value.toLowerCase();
    const match = items.find(item => String(item[displayKey]).toLowerCase() === val);
    if (match) input.dataset.selectedId = match[valueKey];
    else input.dataset.selectedId = ''; 
  });
}

/* ---------- Session Modal ---------- */
function mergedToText(s) { return (s.mergedWith || []).map(m => `${pName(m.programId)}-${m.semester}-${m.section}`).join(', '); }
function parseMerged(txt) {
  const out = [];
  for (const part of txt.split(',').map(x => x.trim()).filter(Boolean)) {
    const m = part.match(/^(.+?)[\s-]+(\d+)[\s-]+(\w+)$/);
    const p = m && state.programs.find(x => x.name.toLowerCase() === m[1].trim().toLowerCase());
    if (!p) return { error: `"${part}" is invalid.` };
    out.push({ programId: p.id, semester: +m[2], section: m[3].toUpperCase() });
  }
  return { list: out };
}

function openSession(s) {
  const isNew = !s.id;
  
  let swatchHtml = '<div class="color-picker">';
  PALETTE.forEach((color, i) => {
    swatchHtml += `<div class="color-swatch ${s.colorIdx === i ? 'selected' : ''}" 
      style="background:${color}" 
      onclick="document.querySelectorAll('.color-swatch').forEach(e=>e.classList.remove('selected')); this.classList.add('selected'); document.querySelector('input[name=\\'colorIdx\\']').value = ${i};">
    </div>`;
  });
  swatchHtml += `</div><input type="hidden" name="colorIdx" value="${s.colorIdx || 0}">`;

  const html = `
    <div class="row">
      <label>Session Type
        <select name="type" id="sessionTypeSelect">
          <option value="Theory" ${s.type === 'Theory' ? 'selected' : ''}>Theory</option>
          <option value="Lab" ${s.type === 'Lab' ? 'selected' : ''}>Lab</option>
          <option value="Free" ${s.type === 'Free' ? 'selected' : ''}>FREE (No Class)</option>
        </select>
      </label>
      <label>Day
        <select name="day">
          ${DAYS.map(d => `<option value="${d}" ${d === s.day ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>
    </div>

    <div class="row">
      <label>Start Time
        <input type="time" name="startTime" value="${s.startTime || '08:00'}">
      </label>
      <label>End Time
        <input type="time" name="endTime" value="${s.endTime || '09:30'}">
      </label>
    </div>

    <div id="courseTeacherFields" style="display: ${s.type === 'Free' ? 'none' : 'grid'}; gap: 16px;">
      <div class="autocomplete-wrapper">
        <label>Course
          <input type="text" id="courseInput" name="courseInput" value="${s.courseId ? courseLabel(s.courseId) : ''}" placeholder="Type to search course..." autocomplete="off">
          <div class="autocomplete-list" id="courseList"></div>
        </label>
      </div>
      
      <div class="row">
        <div class="autocomplete-wrapper">
          <label>Teacher
            <input type="text" id="teacherInput" name="teacherInput" value="${s.teacherId ? name('teachers', s.teacherId) : ''}" placeholder="Type to search teacher..." autocomplete="off">
            <div class="autocomplete-list" id="teacherList"></div>
          </label>
        </div>
        <label>Room
          <select name="roomId">
            ${state.rooms.map(r => `<option value="${r.id}" ${r.id === s.roomId ? 'selected' : ''}>${r.name} (${r.type})</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="row">
      <label>Program
        <select name="programId">
          ${state.programs.map(p => `<option value="${p.id}" ${p.id === s.programId ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </label>
      <label>Semester
        <select name="semester">
          ${SEMESTERS.map(n => `<option value="${n}" ${n === s.semester ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>
    </div>

    <div class="row">
      <label>Section
        <select name="section">
          ${allSections().map(x => `<option value="${x}" ${x === s.section ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </label>
      <label>Merged with (optional)
        <input type="text" name="merged" value="${mergedToText(s)}" placeholder="e.g., BSIT-3-B">
      </label>
    </div>
    
    <label>Color Tag</label>
    ${swatchHtml}
  `;

  openModal(isNew ? 'Add Session' : 'Edit Session', html, d => {
    if (!d.startTime || !d.endTime || d.startTime >= d.endTime) return 'End time must be after start time.';
    
    let sess = { 
      id: s.id || uid('s'), 
      programId: d.programId, semester: +d.semester, section: d.section,
      day: d.day, startTime: d.startTime, endTime: d.endTime, type: d.type,
      colorIdx: parseInt(d.colorIdx || 0)
    };

    if (d.type !== 'Free') {
      const courseId = $('courseInput').dataset.selectedId;
      if (!courseId) return 'Please select a valid course.';
      const teacherId = $('teacherInput').dataset.selectedId;
      if (!teacherId) return 'Please select a valid teacher.';
      
      sess.courseId = courseId;
      sess.teacherId = teacherId;
      sess.roomId = d.roomId;
      
      const m = parseMerged(d.merged || ''); 
      if (m.error) return m.error;
      if (m.list.length) sess.mergedWith = m.list;
    }

    const conflicts = findConflicts(sess);
    if (conflicts.length) return 'Conflict - not saved:\n' + conflicts.join('\n');
    
    if (isNew) state.sessions.push(sess); else state.sessions[state.sessions.indexOf(state.sessions.find(x => x.id === s.id))] = sess;
  }, isNew ? null : () => {
    if (!confirm('Delete this session?')) return;
    state.sessions = state.sessions.filter(x => x.id !== s.id); return true;
  });

  setTimeout(() => {
    $('sessionTypeSelect').addEventListener('change', (e) => {
      $('courseTeacherFields').style.display = e.target.value === 'Free' ? 'none' : 'grid';
    });

    const courseItems = state.courses.map(c => ({ ...c, searchStr: `${c.code} - ${c.title}` }));
    setupAutocomplete('courseInput', 'courseList', courseItems, 'searchStr', 'id');
    setupAutocomplete('teacherInput', 'teacherList', state.teachers, 'name', 'id');
    
    if (s.courseId) $('courseInput').dataset.selectedId = s.courseId;
    if (s.teacherId) $('teacherInput').dataset.selectedId = s.teacherId;
  }, 50);
}

/* ---------- DYNAMIC GRID LOGIC ---------- */
function getDynamicSlots() {
  const times = new Set();
  if (!state.sessions.length) {
    times.add('08:00'); times.add('09:30'); times.add('11:00'); times.add('12:30'); times.add('14:00'); times.add('15:30');
  } else {
    state.sessions.forEach(s => {
      times.add(s.startTime);
      times.add(s.endTime);
    });
  }
  
  const sortedTimes = Array.from(times).sort();
  const slots = [];
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    slots.push({ start: sortedTimes[i], end: sortedTimes[i+1] });
  }
  return slots;
}

function renderBuilder() {
  const c = cur();
  $('builderTitle').textContent = c.p ? `${pName(c.p)} - Semester ${c.sem} - Section ${c.sec}` : 'Timetable Builder';
  if (!c.p) { $('grid').innerHTML = '<div class="empty" style="grid-column:1/-1">Add a program first.</div>'; return; }
  
  const dynamicSlots = getDynamicSlots();
  const g = { programId: c.p, semester: c.sem, section: c.sec };
  const currentSessions = state.sessions.filter(s => inGroup(s, g));

  // DAYS AS COLUMNS (Top), TIME AS ROWS (Left)
  let h = '<div class="tt-head" style="grid-row:1;grid-column:1">Time</div>' + DAYS.map((d, i) => `<div class="tt-head" style="grid-row:1;grid-column:${i + 2}">${d}</div>`).join('');
  
  dynamicSlots.forEach((sl, r) => {
    h += `<div class="tt-time" style="grid-row:${r + 2};grid-column:1">${to12h(sl.start)}<br>-<br>${to12h(sl.end)}</div>`;
    DAYS.forEach((d, i) => h += `<div class="tt-cell" data-day="${d}" data-start="${sl.start}" data-end="${sl.end}" style="grid-row:${r + 2};grid-column:${i + 2}"></div>`);
  });
  
  currentSessions.forEach(s => {
    const startRow = dynamicSlots.findIndex(sl => sl.start === s.startTime);
    const endRow = dynamicSlots.findIndex(sl => sl.end === s.endTime);
    if (startRow === -1 || endRow === -1) return;
    
    const span = endRow - startRow + 1;
    const bad = findConflicts(s).length > 0, merged = mergedToText(s);
    const colorClass = s.colorIdx !== undefined ? 'c' + s.colorIdx : colorOf(s);
    
    let content = '';
    if (s.type === 'Free') {
      // SEXY FREE PERIOD DESIGN WITH COFFEE CUP
      content = `<div class="free-content">
        <i class="fa-solid fa-mug-hot"></i>
        <span>Free Period</span>
      </div>`;
    } else {
      // DISPLAYS TIME INSIDE THE BLOCK
      content = `<b>${esc(courseLabel(s.courseId))}</b>
      <div class="meta"><i class="fa-regular fa-clock"></i> ${to12h(s.startTime)} - ${to12h(s.endTime)}</div>
      <div class="meta"><i class="fa-solid fa-user"></i> ${esc(name('teachers', s.teacherId))}</div>
      <div class="meta"><i class="fa-solid fa-location-dot"></i> ${esc(name('rooms', s.roomId))}</div>
      <span class="tag">${s.type}${merged ? ' + ' + esc(merged) : ''}${bad ? ' - conflict' : ''}</span>`;
    }

    h += `<div class="tt-block ${colorClass}${bad ? ' conflict' : ''}" data-id="${s.id}" 
      style="grid-row:${startRow + 2} / span ${span}; grid-column:${DAYS.indexOf(s.day) + 2};">
      ${content}
    </div>`;
  });
  
  $('grid').style.gridTemplateColumns = `120px repeat(${DAYS.length}, minmax(180px, 1fr))`;
  $('grid').innerHTML = h;
}

/* ---------- Saved Views ---------- */
function renderSaved() {
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
  const keys = Object.keys(saved);
  
  if (!keys.length) {
    $('savedList').innerHTML = '<div class="empty">No saved timetables yet. Go to the Builder and click "Save View".</div>';
    return;
  }

  $('savedList').innerHTML = keys.map(k => `
    <div class="saved-card">
      <h3>${esc(k)}</h3>
      <div class="meta"><i class="fa-regular fa-clock"></i> Saved: ${new Date(saved[k].timestamp).toLocaleString()}</div>
      <div class="meta"><i class="fa-solid fa-layer-group"></i> ${saved[k].sessions.length} sessions</div>
      <div class="actions">
        <button class="btn primary" onclick="window.app.loadSaved('${esc(k)}')"><i class="fa-solid fa-folder-open"></i> Load</button>
        <button class="btn danger" onclick="window.app.deleteSaved('${esc(k)}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

/* ---------- Export Studio ---------- */
function exportGroups() {
  const lvl = $('xLevel').value, p = $('xProgram').value, sem = +$('xSemester').value, sec = $('xSection').value;
  const seen = [];
  state.sessions.forEach(s => groupsOf(s).forEach(g => { if (!seen.some(x => sameG(x, g))) seen.push(g); }));
  return seen.filter(g => lvl === 'dept' || (g.programId === p && (lvl === 'program' || (+g.semester === sem && (lvl === 'semester' || g.section === sec)))))
    .sort((a, b) => pName(a.programId).localeCompare(pName(b.programId)) || a.semester - b.semester || a.section.localeCompare(b.section));
}

function staticTable(g) {
  const list = state.sessions.filter(s => inGroup(s, g));
  const times = new Set();
  list.forEach(s => { times.add(s.startTime); times.add(s.endTime); });
  if (!times.size) { times.add('08:00'); times.add('09:30'); }
  const dynamicSlots = Array.from(times).sort().reduce((acc, t, i, arr) => {
    if (i < arr.length - 1) acc.push({ start: t, end: arr[i+1] });
    return acc;
  }, []);

  const skip = {}; 
  let h = '<table class="x-table"><thead><tr><th>Time</th>' + DAYS.map(d => `<th>${d}</th>`).join('') + '</tr></thead><tbody>';
  
  dynamicSlots.forEach((sl, i) => {
    h += `<tr><th>${to12h(sl.start)} - ${to12h(sl.end)}</th>`;
    DAYS.forEach(d => {
      if (skip[d] > 0) { skip[d]--; return; }
      
      const s = list.find(x => x.day === d && x.startTime === sl.start);
      if (!s) { h += '<td></td>'; return; }
      
      const endRow = dynamicSlots.findIndex(x => x.end === s.endTime);
      const span = (endRow - i) + 1;
      
      skip[d] = span - 1; 
      const others = groupsOf(s).filter(x => !sameG(x, g)).map(gLabel).join(', ');
      const colorClass = s.colorIdx !== undefined ? 'c' + s.colorIdx : colorOf(s);
      
      let content = '';
      if (s.type === 'Free') {
        content = `<div class="tt-block ${colorClass}" style="margin:0; height:100%;">
          <div class="free-content"><i class="fa-solid fa-mug-hot"></i><span>Free Period</span></div>
        </div>`;
      } else {
        content = `<div class="tt-block ${colorClass}" style="margin:0; height:100%;">
          <b>${esc(courseLabel(s.courseId))}</b>
          <div class="meta">${to12h(s.startTime)} - ${to12h(s.endTime)}</div>
          <div class="meta">${esc(name('teachers', s.teacherId))}</div>
          <div class="meta">${esc(name('rooms', s.roomId))}</div>
          <span class="tag">${s.type}${others ? ' + ' + esc(others) : ''}</span>
        </div>`;
      }
      
      h += `<td rowspan="${span}">${content}</td>`;
    });
    h += '</tr>';
  });
  return h + '</tbody></table>';
}

function renderExport() {
  const lvl = $('xLevel').value;
  $('xProgram').disabled = lvl === 'dept';
  $('xSemester').disabled = lvl === 'dept' || lvl === 'program';
  $('xSection').disabled = lvl !== 'section';
  
  const term = $('xTerm').value.trim(), p = pName($('xProgram').value);
  const title = lvl === 'dept' ? `Department Timetable - ${term}`
    : lvl === 'program' ? `${p} - ${term}`
    : lvl === 'semester' ? `${p} Semester ${$('xSemester').value} - ${term}`
    : `${p} Semester ${$('xSemester').value} Section ${$('xSection').value} - ${term}`;
  
  const groups = exportGroups();
  $('exportCanvas').innerHTML = `<div class="x-head">
      <div>
        <h2>${esc(title)}</h2>
        <div style="font-size: 14px; font-weight: 500; color: #4b5563; margin-top: 4px;">Department of Computer Science - Allama Iqbal Open University</div>
      </div>
      <img src="aiou-logo.png" alt="AIOU" onerror="this.style.display='none';">
    </div>` +
    (groups.length ? groups.map(g => `<h3 class="x-group">${esc(gLabel(g))}</h3>${staticTable(g)}`).join('')
      : '<p class="muted">No sessions found for this selection.</p>') +
    `<div class="x-foot"><span>Generated on ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span><span>Timetable Manager</span></div>`;
}

function downloadPng(type = 'png') {
  if (!window.htmlToImage) return toast('Image library failed to load.', 'error');
  htmlToImage.toPng($('exportCanvas'), { pixelRatio: 2, backgroundColor: '#ffffff' })
    .then(url => { 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `timetable.${type}`; 
      a.click(); 
    })
    .catch(() => toast('Could not create the image.', 'error'));
}

function downloadExcel() {
  if (!window.XLSX) return toast('Excel library failed to load.', 'error');
  const groups = exportGroups();
  if (!groups.length) return toast('No data to export.', 'error');
  const wb = XLSX.utils.book_new();

  groups.forEach(g => {
    const list = state.sessions.filter(s => inGroup(s, g));
    const wsData = [['Time', ...DAYS]];

    getDynamicSlots().forEach(sl => {
      const row = [`${to12h(sl.start)} - ${to12h(sl.end)}`];
      DAYS.forEach(d => {
        const s = list.find(x => x.day === d && x.startTime === sl.start);
        if (s) {
          const merged = mergedToText(s);
          if (s.type === 'Free') row.push('FREE PERIOD');
          else row.push(`${courseLabel(s.courseId)}\nTime: ${to12h(s.startTime)}-${to12h(s.endTime)}\nTeacher: ${name('teachers', s.teacherId)}\nRoom: ${name('rooms', s.roomId)}\nType: ${s.type}${merged ? ' (+ ' + merged + ')' : ''}`);
        } else {
          row.push('');
        }
      });
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, ...DAYS.map(() => ({ wch: 30 }))];
    let sheetName = gLabel(g).replace(/[^a-zA-Z0-9 -]/g, '').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, 'timetable.xlsx');
}

/* ---------- Render + Wiring ---------- */
function renderDashboard() {
  const conflicts = state.sessions.filter(s => findConflicts(s).length).length;
  const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  $('stats').innerHTML = stat(state.programs.length, 'Programs') + stat(state.teachers.length, 'Teachers') + stat(state.courses.length, 'Courses') +
    stat(state.rooms.length, 'Rooms') + stat(state.sessions.length, 'Sessions') + stat(conflicts, 'Conflicts');
  
  const missing = ['programs', 'teachers', 'courses', 'rooms'].filter(k => !state[k].length);
  $('dashHint').textContent = missing.length
    ? 'Add at least one entry in: ' + missing.join(', ') + '. Then open Timetable Builder to add sessions.'
    : 'You are all set up! Open Timetable Builder, pick a program, semester, and section, and click any cell to add a session.';
}

function render() {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'dashboard') renderDashboard();
  else if (view === 'builder') renderBuilder();
  else if (view === 'export') renderExport();
  else if (view === 'saved') renderSaved();
  else renderEntity(view);
}

function init() {
  const st = document.createElement('style');
  st.textContent = `.x-table{border-collapse:collapse;width:100%;margin-bottom:24px;font-family:'Inter',sans-serif; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;}
  .x-table th,.x-table td{border:1px solid #e5e7eb;padding:12px;vertical-align:top;font-size:13px}
  .x-table th{background:#fafafa;color:#6b7280;font-weight:600;padding:16px;text-align:center; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12px;}
  .x-table td{min-width:160px;height:100px; padding: 8px;}
  .x-table .tt-block{margin:0; height:100%; border-radius:6px; display:flex; flex-direction:column; justify-content:center;}
  .x-table .tt-block b { font-size: 15px; margin-bottom: 4px; }
  .x-table .free-content { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; text-align: center; gap: 8px; }
  .x-table .free-content i { font-size: 24px; opacity: 0.5; }
  .x-table .free-content span { font-size: 14px; font-weight: 700; }
  .modal-body select{width:100%}`;
  document.head.appendChild(st);

  window.app = { loadSaved, deleteSaved };

  document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => { view = b.dataset.view; render(); });
  
  [['fProgram', 'p'], ['fSemester', 'sem'], ['fSection', 'sec']].forEach(([id, key]) => {
    $(id).onchange = e => { 
      f[key] = e.target.value; 
      if (view === 'builder') renderBuilder();
    };
  });
  
  ['xLevel', 'xProgram', 'xSemester', 'xSection'].forEach(id => $(id).onchange = renderExport);
  $('xTerm').oninput = renderExport;
  
  $('btnSaveTimetable').onclick = saveCurrentView;
  $('btnPng').onclick = () => downloadPng('png');
  $('btnJpeg').onclick = () => downloadPng('jpeg');
  $('btnExcel').onclick = downloadExcel;
  $('btnExportJson').onclick = exportJson;
  $('btnImport').onclick = () => $('fileImport').click();
  $('fileImport').onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };
  
  $('btnAddSession').onclick = () => { 
    view = 'builder'; render(); 
    const c = cur(); 
    openSession({ programId: c.p, semester: c.sem, section: c.sec, day: DAYS[0], type: 'Theory', startTime: '08:00', endTime: '09:30' }); 
  };

  $('grid').onclick = e => {
    const blk = e.target.closest('.tt-block'), cell = e.target.closest('.tt-cell');
    if (blk) return openSession({ ...byId('sessions', blk.dataset.id) });
    if (cell) { 
      const c = cur();
      openSession({ programId: c.p, semester: c.sem, section: c.sec, day: cell.dataset.day, type: 'Theory', startTime: cell.dataset.start, endTime: cell.dataset.end }); 
    }
  };

  $('view-programs').parentNode.onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    editEntity(b.dataset.k, b.dataset.act === 'edit' ? b.dataset.id : null);
  };

  $('modalClose').onclick = $('modalCancel').onclick = closeModal;
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
  
  $('modalForm').onsubmit = e => { e.preventDefault(); $('modalSave').click(); };
  $('modalSave').onclick = () => {
    const err = modalHandlers.onSave(Object.fromEntries(new FormData($('modalForm'))));
    if (err) return showFormError(err);
    closeModal(); save(); render();
  };
  $('modalDelete').onclick = () => { if (modalHandlers.onDelete() === true) { closeModal(); save(); render(); } };

  initFilters(); render();
}

load().then(init);