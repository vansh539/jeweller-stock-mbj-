'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   Jalan Jewellers — Stock Management  |  app.js
   Pure vanilla JS, no frameworks.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────────────────────────
let allItems   = [];   // master list from server
let filtered   = [];   // currently displayed rows
let currentSku = null; // SKU open in print modal
let liveRates  = null; // populated by fetchGoldRates

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const scanInput     = $('scan-input');
const scanClear     = $('scan-clear');
const scanHint      = $('scan-hint');
const tbody         = $('items-tbody');
const filterSearch  = $('filter-search');
const filterStatus  = $('filter-status');
const filterCategory= $('filter-category');
const filterMetal   = $('filter-metal');
const filterReset   = $('filter-reset');
const filterCount   = $('filter-count');

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format a number as ₹ Indian locale */
function formatINR(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Format weight to 2 dp */
function fmtWt(val) {
  if (val == null || val === '') return '—';
  return Number(val).toFixed(2) + 'g';
}

/** Status → badge CSS class */
function statusClass(status) {
  const map = {
    'In Stock':  'badge-instock',
    'Sold':      'badge-sold',
    'Reserved':  'badge-reserved',
    'On Repair': 'badge-repair',
  };
  return map[status] || 'badge-sold';
}

/** Escape HTML special chars */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/** Show a toast notification */
function toast(message, type = 'success') {
  const icons = { success: '✔', error: '✖', info: 'ℹ', warning: '⚠' };
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span>${esc(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

/** Show/hide inline error box */
function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else     { el.textContent = '';  el.style.display = 'none';  }
}

/** Show/hide inline success box */
function showSuccess(id, msg) {
  const el = $(id);
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else     { el.textContent = '';  el.style.display = 'none';  }
}

/** Set today's date in navbar */
function setNavDate() {
  const el = $('nav-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { success: false, error: text }; }
  return { ok: res.ok, status: res.status, data };
}

// ─── Custom dropdown options (localStorage) ───────────────────────────────────

const DROPDOWN_DEFAULTS = {
  category: ['Necklace','Ring','Bangle','Earrings','Bracelet','Pendant','Brooch'],
  metal:    ['Gold','Silver','Platinum','Rose Gold'],
  purity:   ['24K','22K','18K','14K','925','950'],
  stone:    ['Diamond','Ruby','Emerald','Sapphire','Pearl'],
};
const LS_KEY = 'mbj_custom_opts';

function getCustomOpts() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (_) { return {}; }
}

function saveCustomOpt(field, value) {
  const v = value.trim();
  if (!v || DROPDOWN_DEFAULTS[field]?.includes(v)) return;
  const opts = getCustomOpts();
  if (!opts[field]) opts[field] = [];
  if (!opts[field].includes(v)) {
    opts[field].push(v);
    localStorage.setItem(LS_KEY, JSON.stringify(opts));
    refreshAllDatalists(field);
  }
}

function getAllOpts(field) {
  return [...(DROPDOWN_DEFAULTS[field] || []), ...(getCustomOpts()[field] || [])];
}

function populateDatalist(dlId, field) {
  const dl = $(dlId);
  if (!dl) return;
  dl.innerHTML = getAllOpts(field).map(v => `<option value="${esc(v)}">`).join('');
}

function refreshAllDatalists(field) {
  const map = {
    category: ['dl-f-category','dl-e-category'],
    metal:    ['dl-f-metal','dl-e-metal'],
    purity:   ['dl-f-purity','dl-e-purity'],
    stone:    ['dl-stone-types'],
  };
  (map[field] || []).forEach(id => populateDatalist(id, field));
}

function initAllDatalist() {
  ['category','metal','purity','stone'].forEach(f => refreshAllDatalists(f));
}

// Persist any new values typed into datalist-backed inputs after form submit
function persistNewDropdownValues(formValues) {
  ['category','metal','purity'].forEach(field => {
    const v = formValues[field];
    if (v) saveCustomOpt(field, v);
  });
}

// ─── Stone rows ───────────────────────────────────────────────────────────────

function getRateForPurity(metal, purity) {
  if (!liveRates) return null;
  const m = (metal || '').toLowerCase();
  if (m !== 'gold' && m !== 'rose gold') return null;
  if (purity === '24K') return liveRates.g24k;
  if (purity === '22K') return liveRates.g22k;
  if (purity === '18K') return liveRates.g18k;
  const k = parseInt(purity);
  if (k && liveRates.g24k) return Math.round((k / 24) * liveRates.g24k);
  return null;
}

function recalcAll(prefix) {
  // Invoice prefix has no gross weight element — delegate to calcInvoice
  if (prefix === 'inv') { calcInvoice(); return; }

  // ── 1. Net weight (gross g − stone ct × 0.2 g/ct) ──
  const gross    = parseFloat($(`${prefix}-gross`)?.value) || 0;
  const stones   = getStonesFromForm(prefix);
  const stoneWtG = stones.reduce((s, st) => s + (st.pieces || 1) * (st.weight || 0) * 0.2, 0);
  const netWt    = gross > 0 ? Math.max(0, gross - stoneWtG) : 0;
  const netEl    = $(`${prefix}-net`);
  if (netEl && gross > 0) netEl.value = netWt.toFixed(2);

  // ── 2. Making charges = net × making_rate ──
  const makingRateEl = $(`${prefix}-making-rate`);
  const makingRate   = makingRateEl ? (parseFloat(makingRateEl.value) || 0) : 0;
  const making       = netWt > 0 && makingRate > 0 ? Math.round(netWt * makingRate) : 0;
  const makingEl     = $(`${prefix}-making`);
  if (makingEl) makingEl.value = making > 0 ? making : '';

  // ── 3. MRP ──
  const metal    = $(`${prefix}-metal`)?.value?.trim() || '';
  const purity   = $(`${prefix}-purity`)?.value?.trim() || '';
  const wastage  = parseFloat($(`${prefix}-wastage`)?.value) || 0;
  const rate     = getRateForPurity(metal, purity);
  const stoneTotalVal = stones.reduce((s, st) =>
    s + (st.pieces || 1) * (st.weight || 0) * (st.price_per_ct || 0), 0);

  const mrpEl = $(`${prefix}-mrp`);
  if (rate && netWt > 0) {
    const goldVal    = netWt * rate;
    const wastageAmt = (wastage / 100) * goldVal;
    const mrp        = Math.round(goldVal + wastageAmt + making + stoneTotalVal);
    if (mrpEl) mrpEl.value = mrp;
  } else if (mrpEl && mrpEl.value === '') {
    mrpEl.value = '';
  }
}

function addStoneRow(prefix, data = {}) {
  const container = $(`${prefix}-stones-container`);
  const emptyHint = $(`${prefix}-stones-empty`);
  if (emptyHint) emptyHint.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'stone-row';
  row.innerHTML = `
    <input type="text"   class="stone-type"   list="dl-stone-types"
           placeholder="Stone type" autocomplete="off" value="${esc(data.type || '')}">
    <input type="number" class="stone-pieces"  placeholder="Pcs" min="1" step="1"
           value="${data.pieces != null ? data.pieces : 1}">
    <input type="number" class="stone-weight"  placeholder="Wt/pc" min="0" step="0.001"
           value="${data.weight != null ? data.weight : ''}">
    <select class="stone-unit">
      <option value="ct">ct</option>
      <option value="g">g</option>
    </select>
    <input type="number" class="stone-ppc"     placeholder="₹ / ct" min="0" step="1"
           value="${data.price_per_ct != null ? data.price_per_ct : ''}">
    <span class="stone-value">—</span>
    <button type="button" class="btn-remove-stone" title="Remove">×</button>
  `;
  container.appendChild(row);

  const calcRow = () => {
    const pcs   = parseInt(row.querySelector('.stone-pieces').value)  || 1;
    const wt    = parseFloat(row.querySelector('.stone-weight').value) || 0;
    const unit  = row.querySelector('.stone-unit').value;
    const wt_ct = unit === 'g' ? wt / 0.2 : wt;
    const ppc   = parseFloat(row.querySelector('.stone-ppc').value)    || 0;
    const tot   = pcs * wt_ct * ppc;
    row.querySelector('.stone-value').textContent = tot > 0
      ? '₹' + tot.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : '—';
    recalcAll(prefix);
  };

  row.querySelector('.stone-pieces').addEventListener('input', calcRow);
  row.querySelector('.stone-weight').addEventListener('input', calcRow);
  row.querySelector('.stone-unit').addEventListener('change', calcRow);
  row.querySelector('.stone-ppc').addEventListener('input', calcRow);
  row.querySelector('.stone-type').addEventListener('change', e => saveCustomOpt('stone', e.target.value));
  row.querySelector('.btn-remove-stone').addEventListener('click', () => {
    row.remove();
    const remaining = container.querySelectorAll('.stone-row').length;
    if (emptyHint && remaining === 0) emptyHint.style.display = '';
    recalcAll(prefix);
  });

  calcRow();
}

function clearStoneRows(prefix) {
  const container = $(`${prefix}-stones-container`);
  container.querySelectorAll('.stone-row').forEach(r => r.remove());
  const emptyHint = $(`${prefix}-stones-empty`);
  if (emptyHint) emptyHint.style.display = '';
}

function getStonesFromForm(prefix) {
  const rows = $(`${prefix}-stones-container`).querySelectorAll('.stone-row');
  const stones = [];
  rows.forEach(row => {
    const type   = row.querySelector('.stone-type').value.trim();
    const pieces = parseInt(row.querySelector('.stone-pieces').value)  || 1;
    const wt     = parseFloat(row.querySelector('.stone-weight').value) || 0;
    const unit   = row.querySelector('.stone-unit')?.value || 'ct';
    const wt_ct  = unit === 'g' ? wt / 0.2 : wt;  // always store in carats
    const ppc    = parseFloat(row.querySelector('.stone-ppc').value)    || 0;
    if (type || wt || ppc) stones.push({ type, pieces, weight: wt_ct, price_per_ct: ppc });
  });
  return stones;
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

async function refreshStats() {
  const { ok, data } = await apiFetch('/api/stats');
  if (!ok) return;
  const s = data.stats;
  $('stat-total').textContent   = s.total;
  $('stat-instock').textContent = s.inStock;
  $('stat-sold').textContent    = s.sold;
  $('stat-reserved').textContent= s.reserved;
  $('stat-repair').textContent  = s.onRepair;
  $('stat-value').textContent   = formatINR(s.totalMRPValue);

  // also update reports tab summary
  $('r-total').textContent    = s.total;
  $('r-instock').textContent  = s.inStock;
  $('r-value').textContent    = formatINR(s.totalMRPValue);
  $('r-sold').textContent     = s.sold;
  $('r-reserved').textContent = s.reserved;
  $('r-repair').textContent   = s.onRepair;
}

// ─── Load & render items ──────────────────────────────────────────────────────

async function loadItems() {
  tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Loading items…</td></tr>';
  const { ok, data } = await apiFetch('/api/items');
  if (!ok) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Failed to load items. ${esc(data.error || '')}</td></tr>`;
    return;
  }
  allItems = data.items || [];
  applyFilters();
}

function renderTable(items) {
  if (!items.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No items found.</td></tr>';
    filterCount.textContent = '0 items';
    return;
  }

  filterCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  tbody.innerHTML = items.map(item => `
    <tr data-sku="${esc(item.sku)}">
      <td class="td-sku">${esc(item.sku)}</td>
      <td class="td-name">${esc(item.name)}</td>
      <td>${esc(item.category)}</td>
      <td class="td-metal">${esc(item.metal)} / ${esc(item.purity)}</td>
      <td class="td-weight">${fmtWt(item.gross_weight)} / ${fmtWt(item.net_weight)}</td>
      <td class="td-mrp">${formatINR(item.mrp)}</td>
      <td><span class="badge ${statusClass(item.status)}">${esc(item.status)}</span></td>
      <td>${esc(item.date_added || '—')}</td>
      <td class="td-actions">
        <button class="btn btn-info btn-sm"    onclick="openPrintModal('${esc(item.sku)}')"    title="Print Tag">🏷 Tag</button>
        <button class="btn btn-gold btn-sm"    onclick="openInvoiceModal('${esc(item.sku)}')" title="Invoice">🧾 Invoice</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${esc(item.sku)}')"  title="Edit">✎ Edit</button>
        ${item.status !== 'Sold'
          ? `<button class="btn btn-warning btn-sm" onclick="markSold('${esc(item.sku)}')" title="Mark Sold">✔ Sold</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="markInStock('${esc(item.sku)}')" title="Back to In Stock">↩ Stock</button>`
        }
        <button class="btn btn-danger btn-sm"  onclick="deleteItem('${esc(item.sku)}')"    title="Delete">✕</button>
      </td>
    </tr>
  `).join('');
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function applyFilters() {
  const search   = filterSearch.value.trim().toLowerCase();
  const status   = filterStatus.value;
  const category = filterCategory.value;
  const metal    = filterMetal.value;

  filtered = allItems.filter(item => {
    if (status   && item.status   !== status)   return false;
    if (category && item.category !== category) return false;
    if (metal    && item.metal    !== metal)     return false;
    if (search) {
      const haystack = [
        item.sku, item.name, item.supplier, item.notes,
        item.category, item.metal, item.purity
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderTable(filtered);
}

// ─── Scan input ───────────────────────────────────────────────────────────────

scanInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = scanInput.value.trim();
  if (!val) return;

  // If it looks like a SKU (JS- prefix), find and highlight
  if (/^JS-/i.test(val)) {
    highlightSKU(val.toUpperCase());
  } else {
    // Use as search filter
    filterSearch.value = val;
    applyFilters();
    scanHint.textContent = `Filtered table for: "${val}"`;
  }
});

scanInput.addEventListener('input', () => {
  scanClear.style.display = scanInput.value ? 'flex' : 'none';
});

scanClear.addEventListener('click', () => {
  scanInput.value = '';
  scanClear.style.display = 'none';
  scanHint.textContent = 'Press Enter to search • SKU pattern: JS-YYYYMMDD-XXXX';
  scanInput.focus();
});

function highlightSKU(sku) {
  // Switch to All Stock tab
  switchTab('stock');

  // Clear filters so the item is visible
  filterSearch.value = '';
  filterStatus.value = '';
  filterCategory.value = '';
  filterMetal.value = '';
  applyFilters();

  // Find and highlight the row
  setTimeout(() => {
    const row = tbody.querySelector(`tr[data-sku="${CSS.escape(sku)}"]`);
    if (row) {
      // Remove existing highlights
      tbody.querySelectorAll('.highlighted').forEach(r => r.classList.remove('highlighted'));
      row.classList.add('highlighted');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scanHint.textContent = `Found SKU: ${sku}`;
      // Remove after animation
      row.addEventListener('animationend', () => row.classList.remove('highlighted'), { once: true });
    } else {
      scanHint.textContent = `SKU not found: ${sku}`;
      toast(`SKU "${sku}" not found in current inventory.`, 'warning');
    }
  }, 50);
}

// ─── Filter event listeners ───────────────────────────────────────────────────

filterSearch.addEventListener('input',   applyFilters);
filterStatus.addEventListener('change',  applyFilters);
filterCategory.addEventListener('change',applyFilters);
filterMetal.addEventListener('change',   applyFilters);

filterReset.addEventListener('click', () => {
  filterSearch.value   = '';
  filterStatus.value   = '';
  filterCategory.value = '';
  filterMetal.value    = '';
  applyFilters();
  scanInput.focus();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${name}`);
  });
  if (name === 'reports') renderReports();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ─── Add Item form ────────────────────────────────────────────────────────────

const addForm = $('add-form');

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  showError('add-error', '');
  showSuccess('add-success', '');

  const body = formToObject(addForm);
  body.stones_json = getStonesFromForm('f');

  if (!body.category || !body.metal || !body.purity) {
    showError('add-error', 'Please fill in Category, Metal, and Purity.');
    return;
  }

  const { ok, data } = await apiFetch('/api/items', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!ok) {
    const msg = data.errors ? data.errors.join('\n') : (data.error || 'Unknown error');
    showError('add-error', msg);
    return;
  }

  persistNewDropdownValues(body);
  showSuccess('add-success', `Item "${data.item.name}" added successfully. SKU: ${data.item.sku}`);
  addForm.reset();
  clearStoneRows('f');
  toast(`Added: ${data.item.name} (${data.item.sku})`, 'success');

  await loadItems();
  await refreshStats();
  setTimeout(() => switchTab('stock'), 1200);
});

/** Convert a form element to a plain object, coercing numeric fields */
function formToObject(form) {
  const fd   = new FormData(form);
  const obj  = {};
  const numericFields  = ['gross_weight','net_weight','wastage_pct','making_charges','mrp'];
  const skipFields     = ['stone_type','stone_weight','stone_price']; // now managed via stones_json

  for (const [key, val] of fd.entries()) {
    if (skipFields.includes(key)) continue;
    const v = val.toString().trim();
    if (numericFields.includes(key)) {
      obj[key] = v === '' ? null : Number(v);
    } else {
      obj[key] = v === '' ? null : v;
    }
  }
  return obj;
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

const editModal  = $('edit-modal');
const editForm   = $('edit-form');

function setVal(id, val) {
  const el = $(id);
  if (!el) return;
  if (el.tagName === 'SELECT') {
    el.value = val ?? '';
  } else if (el.tagName === 'TEXTAREA') {
    el.value = val ?? '';
  } else {
    el.value = val ?? '';
  }
}

async function openEditModal(sku) {
  const { ok, data } = await apiFetch(`/api/items/${encodeURIComponent(sku)}`);
  if (!ok) { toast('Failed to load item details.', 'error'); return; }

  const item = data.item;
  setVal('e-sku',      item.sku);
  setVal('e-name',     item.name);
  setVal('e-category', item.category);
  setVal('e-metal',    item.metal);
  setVal('e-purity',   item.purity);
  setVal('e-gross',    item.gross_weight);
  setVal('e-net',      item.net_weight);
  setVal('e-wastage',      item.wastage_pct);
  setVal('e-making-rate', item.making_rate);
  setVal('e-making',       item.making_charges);
  setVal('e-mrp',          item.mrp);
  setVal('e-supplier', item.supplier);
  setVal('e-status',   item.status);
  setVal('e-notes',    item.notes);

  // Restore stone rows
  clearStoneRows('e');
  let stones = [];
  if (item.stones_json) {
    try { stones = JSON.parse(item.stones_json); } catch (_) {}
  } else if (item.stone_type && item.stone_type !== 'None') {
    // Legacy single-stone: derive price_per_ct from stone_price (stored as total, show as-is)
    const ppc = (item.stone_weight && item.stone_price) ? item.stone_price / item.stone_weight : (item.stone_price || 0);
    stones = [{ type: item.stone_type, weight: item.stone_weight || 0, price_per_ct: Math.round(ppc) }];
  }
  stones.forEach(s => addStoneRow('e', s));
  recalcAll('e');

  showError('edit-error', '');
  editModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  editModal.hidden = true;
  document.body.style.overflow = '';
}

$('edit-close').addEventListener('click',  closeEditModal);
$('edit-cancel').addEventListener('click', closeEditModal);

editModal.addEventListener('click', e => {
  if (e.target === editModal) closeEditModal();
});

editForm.addEventListener('submit', async e => {
  e.preventDefault();
  showError('edit-error', '');

  const sku  = $('e-sku').value.trim();
  const body = formToObject(editForm);
  delete body.sku;
  body.stones_json = getStonesFromForm('e');

  const { ok, data } = await apiFetch(`/api/items/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!ok) {
    const msg = data.errors ? data.errors.join('\n') : (data.error || 'Unknown error');
    showError('edit-error', msg);
    return;
  }

  persistNewDropdownValues(body);
  closeEditModal();
  toast(`Updated: ${data.item.name}`, 'success');
  await loadItems();
  await refreshStats();
});

// ─── Mark Sold / In Stock ─────────────────────────────────────────────────────

async function patchStatus(sku, status) {
  const { ok, data } = await apiFetch(`/api/items/${encodeURIComponent(sku)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  if (!ok) {
    toast(data.error || 'Failed to update status.', 'error');
    return;
  }

  toast(`${sku} marked as ${status}`, status === 'Sold' ? 'info' : 'success');
  await loadItems();
  await refreshStats();
}

function markSold(sku) {
  if (!confirm(`Mark ${sku} as Sold?`)) return;
  patchStatus(sku, 'Sold');
}

function markInStock(sku) {
  if (!confirm(`Move ${sku} back to In Stock?`)) return;
  patchStatus(sku, 'In Stock');
}

// ─── Delete item ──────────────────────────────────────────────────────────────

async function deleteItem(sku) {
  if (!confirm(`Permanently delete item ${sku}? This cannot be undone.`)) return;

  const { ok, data } = await apiFetch(`/api/items/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
  });

  if (!ok) {
    toast(data.error || 'Delete failed.', 'error');
    return;
  }

  toast(`${sku} deleted.`, 'info');
  await loadItems();
  await refreshStats();
}

// ─── Print / ZPL modal ────────────────────────────────────────────────────────

const printModal = $('print-modal');

async function openPrintModal(sku) {
  currentSku = sku;
  $('print-sku-title').textContent = sku;

  // Fetch item details and populate label mockup
  const itemRes = await apiFetch(`/api/items/${encodeURIComponent(sku)}`);
  if (itemRes.ok) {
    const it = itemRes.data.item;

    const gw = it.gross_weight != null ? `${Number(it.gross_weight).toFixed(2)}g` : '—';
    const nw = `${Number(it.net_weight || 0).toFixed(2)}g`;

    // Face 1: company name (static), barcode (rendered below), SKU below barcode
    $('lm-company').textContent = 'MBJ';
    $('lm-sku').textContent     = sku;

    // Face 2: item name at top, then GW, SW (if stone), NW
    $('lm-name').textContent = (it.name || '').slice(0, 16);
    $('lm-gw').textContent   = `GW: ${gw}`;

    const hasStone = !!(it.stone_type && it.stone_type !== 'None');
    if (hasStone) {
      const sw = it.stone_weight != null ? `${Number(it.stone_weight).toFixed(2)}ct` : '';
      $('lm-sw').textContent    = sw ? `SW: ${sw}` : '';
      $('lm-nw').textContent    = `NW: ${nw}`;
      $('lm-nw').style.top      = '42px';   /* ZPL y=52 × 0.801 */
      $('lm-date').style.top    = '53px';   /* ZPL y=66 × 0.801 */
    } else {
      $('lm-sw').textContent    = '';
      $('lm-nw').textContent    = `NW: ${nw}`;
      $('lm-nw').style.top      = '30px';   /* ZPL y=38 × 0.801 */
      $('lm-date').style.top    = '42px';   /* ZPL y=52 × 0.801 */
    }

    let dateDisplay = '';
    if (it.date_added) {
      const p = it.date_added.toString().split('-');
      dateDisplay = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : it.date_added;
    }
    $('lm-date').textContent = dateDisplay;
    $('lm-cat').textContent  = it.category || '';
  }

  // Render barcode via JsBarcode — use compact 12-digit numeric payload (matches ZPL print)
  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return `${m[1]}${m[2].padStart(4, '0')}`;
    return skuStr.replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  try {
    JsBarcode('#barcode-svg', barcodePayload(sku), {
      format: 'CODE128',
      width: 0.9,
      height: 45,
      displayValue: false,
      margin: 0,
      background: '#fff',
      lineColor: '#000',
    });
  } catch (err) {
    $('barcode-svg').innerHTML = `<text x="10" y="40" fill="red" font-size="12">Barcode error</text>`;
  }

  // Fetch ZPL (server returns plain text, not JSON)
  let zplText = '// Failed to load ZPL';
  try {
    const zplRes = await fetch(`/api/items/${encodeURIComponent(sku)}/zpl`);
    if (zplRes.ok) {
      zplText = await zplRes.text();
    } else {
      const errData = await zplRes.json().catch(() => ({}));
      zplText = `// Error: ${errData.error || zplRes.statusText}`;
    }
  } catch (e) {
    zplText = `// Network error: ${e.message}`;
  }
  rawZpl = zplText;
  const savedOffset = parseFloat(localStorage.getItem('mbj_printer_x_offset') || '0');
  const offsetInput = $('printer-x-offset');
  if (offsetInput) offsetInput.value = savedOffset;
  applyOffsetToTextarea(savedOffset);

  // Update lpr command
  $('lpr-cmd').textContent = `echo '${sku}.zpl' | lpr -P ZebraGC420t -l`;

  printModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePrintModal() {
  printModal.hidden = true;
  document.body.style.overflow = '';
  currentSku = null;
}

let rawZpl = '';

function applyOffsetToTextarea(offsetMm) {
  const dots = Math.round(offsetMm * (203 / 25.4));
  const shifted = rawZpl.replace(/\^FO(-?\d+),/g, (_, x) => `^FO${parseInt(x) + dots},`);
  $('zpl-textarea').value = shifted;
}

const applyOffsetBtn = $('apply-offset-btn');
if (applyOffsetBtn) {
  applyOffsetBtn.addEventListener('click', () => {
    const val = parseFloat($('printer-x-offset').value) || 0;
    localStorage.setItem('mbj_printer_x_offset', val);
    applyOffsetToTextarea(val);
    toast(`Offset ${val >= 0 ? '+' : ''}${val}mm applied`, 'success');
  });
}

$('print-close').addEventListener('click',  closePrintModal);
$('print-cancel').addEventListener('click', closePrintModal);

$('html-print-btn').addEventListener('click', () => {
  if (!currentSku) return;
  window.open(`/label-print.html?sku=${encodeURIComponent(currentSku)}`, '_blank', 'width=760,height=680');
});

printModal.addEventListener('click', e => {
  if (e.target === printModal) closePrintModal();
});

$('copy-zpl-btn').addEventListener('click', () => {
  const text = $('zpl-textarea').value;
  navigator.clipboard.writeText(text).then(() => {
    toast('ZPL copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback
    $('zpl-textarea').select();
    document.execCommand('copy');
    toast('ZPL copied!', 'success');
  });
});

$('copy-lpr-btn').addEventListener('click', () => {
  const text = $('lpr-cmd').textContent;
  navigator.clipboard.writeText(text).then(() => {
    toast('lpr command copied!', 'success');
  });
});

$('send-to-printer-btn').addEventListener('click', async () => {
  const zpl = $('zpl-textarea').value;
  if (!zpl) return;

  const btn = $('send-to-printer-btn');
  btn.disabled = true;
  btn.textContent = 'Printing…';

  try {
    const res  = await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: zpl });
    const data = await res.json();
    if (data.success) {
      toast('Label sent to printer!', 'success');
    } else {
      toast(data.error || 'Print failed', 'error');
    }
  } catch {
    toast('Could not reach print service. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send to Printer';
  }
});

// ─── Reports tab ──────────────────────────────────────────────────────────────

function renderReports() {
  renderCategoryBreakdown();
  renderMetalBreakdown();
}

function renderCategoryBreakdown() {
  const categories = ['Necklace','Ring','Bangle','Earrings','Bracelet','Pendant','Brooch','Other'];
  const reportTbody = $('report-tbody');

  const rows = categories.map(cat => {
    const items = allItems.filter(i => i.category === cat);
    if (!items.length) return null;

    const total    = items.length;
    const inStock  = items.filter(i => i.status === 'In Stock').length;
    const sold     = items.filter(i => i.status === 'Sold').length;
    const reserved = items.filter(i => i.status === 'Reserved').length;
    const repair   = items.filter(i => i.status === 'On Repair').length;
    const value    = items
      .filter(i => i.status === 'In Stock' && i.mrp != null)
      .reduce((sum, i) => sum + Number(i.mrp), 0);

    return `<tr>
      <td><strong>${esc(cat)}</strong></td>
      <td>${total}</td>
      <td>${inStock}</td>
      <td>${sold}</td>
      <td>${reserved}</td>
      <td>${repair}</td>
      <td>${value > 0 ? formatINR(value) : '—'}</td>
    </tr>`;
  }).filter(Boolean);

  reportTbody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="7">No items in inventory.</td></tr>';
}

function renderMetalBreakdown() {
  const metals = ['Gold','Silver','Platinum','Rose Gold'];
  const metalTbody = $('report-metal-tbody');

  const rows = metals.map(metal => {
    const items = allItems.filter(i => i.metal === metal);
    if (!items.length) return null;

    const total   = items.length;
    const inStock = items.filter(i => i.status === 'In Stock').length;
    const sold    = items.filter(i => i.status === 'Sold').length;
    const value   = items
      .filter(i => i.status === 'In Stock' && i.mrp != null)
      .reduce((sum, i) => sum + Number(i.mrp), 0);

    return `<tr>
      <td><strong>${esc(metal)}</strong></td>
      <td>${total}</td>
      <td>${inStock}</td>
      <td>${sold}</td>
      <td>${value > 0 ? formatINR(value) : '—'}</td>
    </tr>`;
  }).filter(Boolean);

  metalTbody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="5">No items in inventory.</td></tr>';
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Escape closes any open modal
  if (e.key === 'Escape') {
    if (!editModal.hidden)  closeEditModal();
    if (!printModal.hidden) closePrintModal();
  }

  // Ctrl/Cmd+F focuses scan input (only when no input is focused)
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (!isInput) {
      e.preventDefault();
      scanInput.focus();
      scanInput.select();
    }
  }
});

// ─── Invoice modal ────────────────────────────────────────────────────────────

const invoiceModal = $('invoice-modal');
const invoiceForm  = $('invoice-form');

function calcInvoice() {
  const rate    = Number($('inv-rate').value)    || 0;
  const weight  = Number($('inv-weight').value)  || 0;
  const wPct    = Number($('inv-wastage').value) || 0;
  const making  = Number($('inv-making').value)  || 0;
  const stones  = getStonesFromForm('inv');
  const stone   = stones.reduce((s, st) => s + (st.pieces || 1) * (st.weight || 0) * (st.price_per_ct || 0), 0);

  const gold     = rate * weight;
  const wastage  = (wPct / 100) * gold;
  const goldDisp = gold + wastage;
  const subtotal = goldDisp + making + stone;
  const cgst     = subtotal * 0.015;
  const sgst     = subtotal * 0.015;
  const total    = subtotal + cgst + sgst;

  const fmt = v => v > 0 ? formatINR(v) : '—';
  $('calc-gold').textContent   = fmt(goldDisp);
  $('calc-making').textContent = making > 0 ? fmt(making) : '—';
  $('calc-stone').textContent  = stone  > 0 ? fmt(stone)  : '—';
  $('calc-cgst').textContent   = subtotal > 0 ? fmt(cgst) : '—';
  $('calc-sgst').textContent   = subtotal > 0 ? fmt(sgst) : '—';
  $('calc-total').textContent  = total   > 0 ? formatINR(total) : '—';
}

function calcInvMaking() {
  const makingRate = Number($('inv-making-rate').value) || 0;
  const weight     = Number($('inv-weight').value)      || 0;
  $('inv-making').value = (makingRate > 0 && weight > 0) ? Math.round(weight * makingRate) : '';
  calcInvoice();
}

['inv-rate','inv-wastage'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', calcInvoice);
});
$('inv-weight').addEventListener('input', calcInvMaking);
$('inv-making-rate').addEventListener('input', calcInvMaking);

async function openInvoiceModal(sku) {
  const { ok, data } = await apiFetch(`/api/items/${encodeURIComponent(sku)}`);
  if (!ok) { toast('Failed to load item.', 'error'); return; }

  const item = data.item;
  $('invoice-sku-title').textContent = sku;
  $('inv-sku').value          = sku;
  $('inv-rate').value         = '';
  $('inv-weight').value       = item.net_weight  != null ? item.net_weight  : '';
  $('inv-wastage').value      = item.wastage_pct != null ? item.wastage_pct : '';
  $('inv-making-rate').value  = '';
  $('inv-making').value       = item.making_charges != null ? item.making_charges : '';
  $('inv-notes').value        = '';

  clearStoneRows('inv');
  const stonesData = item.stones_json
    ? (typeof item.stones_json === 'string' ? JSON.parse(item.stones_json) : item.stones_json)
    : [];
  stonesData.forEach(s => addStoneRow('inv', s));

  showError('invoice-error', '');
  calcInvoice();

  invoiceModal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('inv-rate').focus(), 50);
}

function closeInvoiceModal() {
  invoiceModal.hidden = true;
  document.body.style.overflow = '';
}

$('invoice-close').addEventListener('click',  closeInvoiceModal);
$('invoice-cancel').addEventListener('click', closeInvoiceModal);
invoiceModal.addEventListener('click', e => { if (e.target === invoiceModal) closeInvoiceModal(); });

invoiceForm.addEventListener('submit', async e => {
  e.preventDefault();
  showError('invoice-error', '');

  const body = {
    sku:            $('inv-sku').value.trim(),
    per_gram_rate:  Number($('inv-rate').value),
    weight_used:    Number($('inv-weight').value),
    wastage_pct:    Number($('inv-wastage').value) || 0,
    making_charges: Number($('inv-making').value)  || 0,
    stone_price:    Math.round(getStonesFromForm('inv').reduce((s, st) => s + (st.pieces || 1) * (st.weight || 0) * (st.price_per_ct || 0), 0)),
    notes:          $('inv-notes').value.trim() || null,
  };

  if (!body.per_gram_rate)  { showError('invoice-error', 'Enter today\'s rate per gram.'); return; }
  if (!body.weight_used)    { showError('invoice-error', 'Enter the final weight.'); return; }

  const { ok, data } = await apiFetch('/api/invoice', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!ok) { showError('invoice-error', data.error || 'Failed to create invoice.'); return; }

  closeInvoiceModal();
  toast(`Invoice ${data.invoice.invoice_no} created`, 'success');
  sessionStorage.setItem(`inv_${data.invoice.invoice_no}`, JSON.stringify(data.invoice));
  window.open(`/invoice-print.html?inv=${encodeURIComponent(data.invoice.invoice_no)}`, '_blank');
  await patchStatus(body.sku, 'Sold');
});

// ─── Expose functions to inline onclick attrs ─────────────────────────────────
window.openPrintModal   = openPrintModal;
window.openEditModal    = openEditModal;
window.openInvoiceModal = openInvoiceModal;
window.markSold         = markSold;
window.markInStock      = markInStock;
window.deleteItem       = deleteItem;

// ─── Gold rates strip ─────────────────────────────────────────────────────────

async function fetchGoldRates() {
  const btn = $('gold-refresh-btn');
  const meta = $('gold-strip-meta');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

  try {
    const { ok, data } = await apiFetch('/api/gold-rates');
    if (!ok || !data.success) throw new Error(data.error || 'Failed');

    const f = v => '₹' + Number(v).toLocaleString('en-IN');
    $('gr-24k').textContent = f(data.g24k) + '/g';
    $('gr-22k').textContent = f(data.g22k) + '/g';
    $('gr-18k').textContent = f(data.g18k) + '/g';
    liveRates = { g24k: data.g24k, g22k: data.g22k, g18k: data.g18k };
    recalcAll('f');
    recalcAll('e');

    if (meta) {
      const label = data.stale ? '⚠ Stale — ' : (data.cached ? '' : 'Live · ');
      meta.textContent = data.stale
        ? `⚠ Stale — IBJA (incl. 3% GST) · As of ${data.asOf}`
        : `${label}IBJA (incl. 3% GST) · As of ${data.asOf}`;
    }
  } catch (err) {
    if (meta) meta.textContent = 'Rates unavailable';
  } finally {
    if (btn) {
      setTimeout(() => { btn.classList.remove('spinning'); btn.disabled = false; }, 400);
    }
  }
}

$('gold-refresh-btn').addEventListener('click', fetchGoldRates);

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  setNavDate();
  initAllDatalist();

  // Auto recalc when gross, metal, purity, or wastage changes
  const fGross = $('f-gross');
  if (fGross) fGross.addEventListener('input', () => recalcAll('f'));
  const eGross = $('e-gross');
  if (eGross) eGross.addEventListener('input', () => recalcAll('e'));

  ['f-metal','f-purity','f-wastage','f-making-rate'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => recalcAll('f'));
  });
  ['e-metal','e-purity','e-wastage','e-making-rate'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => recalcAll('e'));
  });

  scanInput.focus();
  scanClear.style.display = 'none';
  await Promise.all([loadItems(), refreshStats(), fetchGoldRates()]);
}

init();
