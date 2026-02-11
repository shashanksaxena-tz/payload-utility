/* ================================================================== */
/*  Reusable UI Components                                             */
/* ================================================================== */

/* ---- Toast notifications ---- */
export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---- Modal ---- */
export function openModal(title, contentHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = contentHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
window.__closeModal = closeModal;
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

/* ---- Status badge ---- */
export function badge(status) {
  const map = {
    active: 'success', processed: 'success', paid: 'success', completed: 'success',
    enabled: 'success', sent: 'info', pending: 'warning', paused: 'warning',
    declined: 'danger', void: 'danger', voided: 'danger', cancelled: 'danger',
    disabled: 'danger', failed: 'danger', charge: 'info', payment: 'success',
  };
  const cls = map[(status || '').toLowerCase()] || 'neutral';
  return `<span class="badge badge-${cls}">${status || 'unknown'}</span>`;
}

/* ---- Data table ---- */
export function dataTable(columns, rows, actions) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state"><div class="icon">&#128196;</div><p>No records found</p></div>`;
  }
  let html = '<div class="table-wrap"><table><thead><tr>';
  columns.forEach(c => { html += `<th>${c.label}</th>`; });
  if (actions) html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    columns.forEach(c => {
      let val = row[c.key] ?? '';
      if (c.render) val = c.render(val, row);
      else if (c.key === 'status') val = badge(val);
      else if (typeof val === 'object') val = JSON.stringify(val);
      html += `<td>${val}</td>`;
    });
    if (actions) {
      html += '<td class="btn-group">';
      actions.forEach(a => {
        html += `<button class="btn btn-sm ${a.cls || 'btn-outline'}" data-action="${a.name}" data-id="${row.id}">${a.label}</button>`;
      });
      html += '</td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---- Form builder ---- */
export function buildForm(fields, values = {}) {
  let html = '<div class="form-grid">';
  fields.forEach(f => {
    const val = values[f.name] ?? f.default ?? '';
    const cls = f.full ? 'form-group full' : 'form-group';
    html += `<div class="${cls}"><label for="f-${f.name}">${f.label}</label>`;
    if (f.type === 'select') {
      html += `<select id="f-${f.name}" name="${f.name}">`;
      (f.options || []).forEach(o => {
        const sel = o.value === val ? ' selected' : '';
        html += `<option value="${o.value}"${sel}>${o.label}</option>`;
      });
      html += '</select>';
    } else if (f.type === 'textarea') {
      html += `<textarea id="f-${f.name}" name="${f.name}" rows="3">${val}</textarea>`;
    } else {
      const t = f.type || 'text';
      html += `<input type="${t}" id="f-${f.name}" name="${f.name}" value="${val}" ${f.placeholder ? 'placeholder="'+f.placeholder+'"' : ''} ${f.required ? 'required' : ''}>`;
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/* ---- Read form values ---- */
export function readForm(fields) {
  const data = {};
  fields.forEach(f => {
    const el = document.getElementById(`f-${f.name}`);
    if (!el) return;
    let val = el.value.trim();
    if (val === '') return;
    if (f.type === 'number') val = Number(val);
    data[f.name] = val;
  });
  return data;
}

/* ---- Key-value detail view ---- */
export function kvDetail(obj) {
  if (!obj) return '<p>No data</p>';
  let html = '<div class="kv-list">';
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    let display = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (k === 'status') display = badge(v);
    html += `<div class="kv-key">${k}</div><div class="kv-val">${display}</div>`;
  });
  html += '</div>';
  return html;
}

/* ---- Money formatter ---- */
export function money(val) {
  if (val === undefined || val === null) return '-';
  return '$' + Number(val).toFixed(2);
}

/* ---- Truncated ID ---- */
export function shortId(id) {
  if (!id) return '-';
  if (id.length <= 16) return id;
  return id.slice(0, 12) + '...';
}

/* ---- Filter bar ---- */
export function filterBar(fields, onApply) {
  const id = 'filter-bar-' + Date.now();
  let html = `<div class="filter-bar" id="${id}"><div class="filter-row">`;
  html += `<select class="filter-field">`;
  fields.forEach(f => { html += `<option value="${f.key}">${f.label}</option>`; });
  html += `</select>`;
  html += `<select class="filter-op">
    <option value="eq">equals</option>
    <option value="ne">not equal</option>
    <option value="gt">greater than</option>
    <option value="lt">less than</option>
    <option value="gte">at least</option>
    <option value="lte">at most</option>
    <option value="contains">contains</option>
  </select>`;
  html += `<input type="text" class="filter-val" placeholder="Value...">`;
  html += `<button class="btn btn-sm btn-primary filter-apply">Apply</button>`;
  html += `<button class="btn btn-sm btn-outline filter-clear">Clear</button>`;
  html += `</div></div>`;

  setTimeout(() => {
    const bar = document.getElementById(id);
    if (!bar) return;
    bar.querySelector('.filter-apply').onclick = () => {
      const field = bar.querySelector('.filter-field').value;
      const op = bar.querySelector('.filter-op').value;
      const val = bar.querySelector('.filter-val').value.trim();
      if (!val) return;
      onApply({ field, op, value: val });
    };
    bar.querySelector('.filter-clear').onclick = () => {
      bar.querySelector('.filter-val').value = '';
      onApply(null);
    };
  }, 0);
  return html;
}

/* ---- Pagination bar ---- */
export function paginationBar(currentPage, pageSize, totalShown, onPage) {
  const id = 'pagination-' + Date.now();
  const hasPrev = currentPage > 0;
  const hasNext = totalShown >= pageSize;
  let html = `<div class="pagination-bar" id="${id}">`;
  html += `<button class="btn btn-sm btn-outline pg-prev" ${hasPrev ? '' : 'disabled'}>&#8592; Prev</button>`;
  html += `<span class="pg-info">Page ${currentPage + 1} (${totalShown} shown)</span>`;
  html += `<button class="btn btn-sm btn-outline pg-next" ${hasNext ? '' : 'disabled'}>Next &#8594;</button>`;
  html += `</div>`;
  setTimeout(() => {
    const bar = document.getElementById(id);
    if (!bar) return;
    bar.querySelector('.pg-prev').onclick = () => { if (hasPrev) onPage(currentPage - 1); };
    bar.querySelector('.pg-next').onclick = () => { if (hasNext) onPage(currentPage + 1); };
  }, 0);
  return html;
}
