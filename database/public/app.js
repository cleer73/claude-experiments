let currentTable = null;
let currentSchema = null;
let currentRows = [];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadTables() {
  const res = await fetch('/api/tables');
  const tables = await res.json();
  const list = document.getElementById('tableList');
  list.innerHTML = '';
  tables.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.name;
    if (currentTable === t.name) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => selectTable(t.name));
    list.appendChild(li);
  });
}

async function selectTable(name) {
  currentTable = name;
  await loadTables();

  const schemaRes = await fetch(`/api/tables/${name}/schema`);
  currentSchema = await schemaRes.json();

  const rowsRes = await fetch(`/api/tables/${name}/rows`);
  const rows = await rowsRes.json();
  currentRows = rows;

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('tableView').classList.remove('hidden');
  document.getElementById('tableName').textContent = name;

  const thead = document.getElementById('tableHead');
  const columns = ['id', ...currentSchema.columns.map(c => c.name)];
  thead.innerHTML = `<tr><th></th>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th></th></tr>`;

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td class="row-actions">
        <button class="edit-row-btn" onclick="showEditRowModal(${parseInt(row.id)})" title="Edit row">&#9998; Edit</button>
      </td>
      ${columns.map(c => `<td>${escapeHtml(row[c])}</td>`).join('')}
      <td class="row-actions">
        <button class="delete-row-btn" onclick="deleteRow(${parseInt(row.id)})" title="Delete row">&times; Delete</button>
      </td>
    </tr>
  `).join('');
}

function showCreateTableModal() {
  document.getElementById('createTableModal').classList.remove('hidden');
  document.getElementById('newTableName').value = '';
  document.getElementById('columnList').innerHTML = `
    <div class="column-row">
      <input type="text" placeholder="Column name" required>
      <select>
        <option value="text">Text</option>
        <option value="integer">Integer</option>
        <option value="real">Real</option>
        <option value="boolean">Boolean</option>
      </select>
      <button type="button" class="btn btn-secondary" onclick="removeColumn(this)">-</button>
    </div>
  `;
}

function hideCreateTableModal() {
  document.getElementById('createTableModal').classList.add('hidden');
}

function addColumnField() {
  const list = document.getElementById('columnList');
  const row = document.createElement('div');
  row.className = 'column-row';
  row.innerHTML = `
    <input type="text" placeholder="Column name" required>
    <select>
      <option value="text">Text</option>
      <option value="integer">Integer</option>
      <option value="real">Real</option>
      <option value="boolean">Boolean</option>
    </select>
    <button type="button" class="btn btn-secondary" onclick="removeColumn(this)">-</button>
  `;
  list.appendChild(row);
}

function removeColumn(btn) {
  const list = document.getElementById('columnList');
  if (list.children.length > 1) {
    btn.parentElement.remove();
  }
}

async function createTable(e) {
  e.preventDefault();
  const name = document.getElementById('newTableName').value;
  const columnRows = document.querySelectorAll('#columnList .column-row');
  const columns = Array.from(columnRows).map(row => ({
    name: row.querySelector('input').value,
    type: row.querySelector('select').value
  }));

  const res = await fetch('/api/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, columns })
  });

  if (res.ok) {
    hideCreateTableModal();
    await loadTables();
    await selectTable(name);
  } else {
    const error = await res.json();
    alert(error.error);
  }
}

function showAddRowModal() {
  const fields = document.getElementById('rowFields');
  fields.innerHTML = currentSchema.columns.map(col => {
    const safeName = escapeHtml(col.name);
    const safeType = escapeHtml(col.type);
    let inputHtml;

    if (col.type === 'integer' || col.type === 'real') {
      const stepAttr = col.type === 'real' ? ' step="any"' : '';
      inputHtml = `<input type="number" name="${safeName}"${stepAttr}>`;
    } else if (col.type === 'boolean') {
      inputHtml = `
        <select name="${safeName}">
          <option value="">-- Select --</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>`;
    } else {
      inputHtml = `<input type="text" name="${safeName}">`;
    }

    return `
      <div class="form-group">
        <label>${safeName} (${safeType})</label>
        ${inputHtml}
      </div>
    `;
  }).join('');
  document.getElementById('addRowModal').classList.remove('hidden');
}

function hideAddRowModal() {
  document.getElementById('addRowModal').classList.add('hidden');
}

async function addRow(e) {
  e.preventDefault();
  const form = document.getElementById('addRowForm');
  const data = {};
  currentSchema.columns.forEach(col => {
    const input = form.querySelector(`[name="${col.name}"]`);
    if (input.value) {
      data[col.name] = col.type === 'integer' ? parseInt(input.value) :
                      col.type === 'real' ? parseFloat(input.value) :
                      col.type === 'boolean' ? input.value === 'true' :
                      input.value;
    }
  });

  const res = await fetch(`/api/tables/${currentTable}/rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    hideAddRowModal();
    await selectTable(currentTable);
  }
}

function showEditRowModal(id) {
  const row = currentRows.find(r => r.id === id);
  if (!row) return;

  const fields = document.getElementById('editRowFields');
  fields.innerHTML = currentSchema.columns.map(col => {
    const safeName = escapeHtml(col.name);
    const safeType = escapeHtml(col.type);
    const currentValue = row[col.name];
    let inputHtml;

    if (col.type === 'integer' || col.type === 'real') {
      const stepAttr = col.type === 'real' ? ' step="any"' : '';
      inputHtml = `<input type="number" name="${safeName}"${stepAttr} value="${escapeHtml(currentValue ?? '')}">`;
    } else if (col.type === 'boolean') {
      const isTrue = currentValue === 1 || currentValue === true;
      const isFalse = currentValue === 0 || currentValue === false;
      inputHtml = `
        <select name="${safeName}">
          <option value="">-- Select --</option>
          <option value="true"${isTrue ? ' selected' : ''}>True</option>
          <option value="false"${isFalse && currentValue !== null && currentValue !== undefined ? ' selected' : ''}>False</option>
        </select>`;
    } else {
      inputHtml = `<input type="text" name="${safeName}" value="${escapeHtml(currentValue ?? '')}">`;
    }

    return `
      <div class="form-group">
        <label>${safeName} (${safeType})</label>
        ${inputHtml}
      </div>
    `;
  }).join('');

  document.getElementById('editRowForm').dataset.rowId = id;
  document.getElementById('editRowModal').classList.remove('hidden');
}

function hideEditRowModal() {
  document.getElementById('editRowModal').classList.add('hidden');
}

async function editRow(e) {
  e.preventDefault();
  const form = document.getElementById('editRowForm');
  const rowId = form.dataset.rowId;
  const data = {};
  currentSchema.columns.forEach(col => {
    const input = form.querySelector(`[name="${col.name}"]`);
    data[col.name] = col.type === 'integer' ? (input.value ? parseInt(input.value) : null) :
                    col.type === 'real' ? (input.value ? parseFloat(input.value) : null) :
                    col.type === 'boolean' ? (input.value === 'true' ? 1 : input.value === 'false' ? 0 : null) :
                    input.value;
  });

  const res = await fetch(`/api/tables/${currentTable}/rows/${rowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    hideEditRowModal();
    await selectTable(currentTable);
  }
}

async function deleteRow(id) {
  if (!confirm('Delete this row?')) return;
  await fetch(`/api/tables/${currentTable}/rows/${id}`, { method: 'DELETE' });
  await selectTable(currentTable);
}

async function deleteCurrentTable() {
  if (!confirm(`Delete table "${currentTable}"?`)) return;
  await fetch(`/api/tables/${currentTable}`, { method: 'DELETE' });
  currentTable = null;
  currentSchema = null;
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('tableView').classList.add('hidden');
  await loadTables();
}

loadTables();
