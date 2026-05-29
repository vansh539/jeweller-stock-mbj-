'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const os      = require('os');
const https   = require('https');
const fs      = require('fs');
const crypto  = require('crypto');
const { execSync } = require('child_process');

const { db, generateSKU, generateInvoiceNo } = require('./db');
const { generateZPL }     = require('./zpl');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── License validation ───────────────────────────────────────────────────────

const _LS = '0d7a2e955e516326ece7612a68a97d00cf62bab779e65b5cc14e819e2decfbc4';

function _getMachineId() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('wmic csproduct get UUID /value', { encoding: 'utf8', timeout: 4000 });
      const m = out.match(/UUID=([^\r\n]+)/);
      return m ? m[1].trim() : null;
    }
  } catch (_) {}
  return null; // non-Windows: skip machine check (dev environment)
}

function _checkLicense() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'license.key'), 'utf8').trim();
    const dot  = raw.lastIndexOf('.');
    if (dot === -1) return 'Invalid license format';
    const payloadB64 = raw.slice(0, dot);
    const sig        = raw.slice(dot + 1);
    const expected   = crypto.createHmac('sha256', _LS).update(payloadB64).digest('hex');
    if (sig !== expected) return 'License key is invalid';
    const p = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (new Date(p.expires) < new Date()) return `License expired on ${p.expires}`;
    const machineId = _getMachineId();
    if (p.machine && p.machine !== '*' && machineId && p.machine !== machineId)
      return 'License is not valid for this machine';
    console.log(`[License] Valid — client: ${p.client}, expires: ${p.expires}`);
    return null;
  } catch (err) {
    if (err.code === 'ENOENT') return 'License file (license.key) not found';
    return 'License validation error';
  }
}

const _licenseError = _checkLicense();
if (_licenseError) {
  console.error(`[License] INVALID: ${_licenseError}`);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
  next();
});

// License gate — blocks all routes except the expired page itself
app.use((req, res, next) => {
  if (!_licenseError) return next();
  const url = req.path;
  if (url === '/expired.html' || url.startsWith('/favicon')) return next();
  if (url.startsWith('/api/')) {
    return res.status(402).json({ success: false, error: _licenseError });
  }
  return res.redirect(`/expired.html?reason=${encodeURIComponent(_licenseError)}`);
});

// Serve static frontend (if present)
app.use(express.static(path.join(__dirname, 'public')));

// ─── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
  // list all items (dynamic filtering is done in the route handler)
  all:        db.prepare('SELECT * FROM items ORDER BY id DESC'),

  // single item
  bySku:      db.prepare('SELECT * FROM items WHERE sku = ?'),

  // insert
  insert: db.prepare(`
    INSERT INTO items
      (sku, name, category, metal, purity,
       gross_weight, net_weight, stone_type, stone_weight,
       stone_price, wastage_pct, making_rate, making_charges, mrp, supplier, date_added, status, notes, stones_json)
    VALUES
      (@sku, @name, @category, @metal, @purity,
       @gross_weight, @net_weight, @stone_type, @stone_weight,
       @stone_price, @wastage_pct, @making_rate, @making_charges, @mrp, @supplier, @date_added, @status, @notes, @stones_json)
  `),

  // full update (all mutable fields)
  update: db.prepare(`
    UPDATE items SET
      name           = @name,
      category       = @category,
      metal          = @metal,
      purity         = @purity,
      gross_weight   = @gross_weight,
      net_weight     = @net_weight,
      stone_type     = @stone_type,
      stone_weight   = @stone_weight,
      stone_price    = @stone_price,
      wastage_pct    = @wastage_pct,
      making_rate    = @making_rate,
      making_charges = @making_charges,
      mrp            = @mrp,
      supplier       = @supplier,
      status         = @status,
      notes          = @notes,
      stones_json    = @stones_json
    WHERE sku = @sku
  `),

  // status-only patch
  patchStatus: db.prepare('UPDATE items SET status = @status WHERE sku = @sku'),

  // delete
  delete: db.prepare('DELETE FROM items WHERE sku = ?'),

  // stats
  stats: db.prepare(`
    SELECT
      COUNT(*)                                    AS total,
      SUM(CASE WHEN status = 'In Stock'   THEN 1 ELSE 0 END) AS inStock,
      SUM(CASE WHEN status = 'Sold'       THEN 1 ELSE 0 END) AS sold,
      SUM(CASE WHEN status = 'Reserved'   THEN 1 ELSE 0 END) AS reserved,
      SUM(CASE WHEN status = 'On Repair'  THEN 1 ELSE 0 END) AS onRepair,
      COALESCE(SUM(CASE WHEN status = 'In Stock' THEN mrp ELSE 0 END), 0) AS totalMRPValue
    FROM items
  `),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['In Stock', 'Sold', 'Reserved', 'On Repair']);

/** Compute aggregate stone fields from a stones array. */
function stonesAggregate(stonesArr) {
  if (!Array.isArray(stonesArr) || stonesArr.length === 0) return { stone_type: null, stone_weight: null, stone_price: null };
  const first      = stonesArr[0];
  const totalWt    = stonesArr.reduce((s, st) => s + ((parseInt(st.pieces) || 1) * (parseFloat(st.weight) || 0)), 0);
  const totalPrice = stonesArr.reduce((s, st) => {
    const wt = (parseInt(st.pieces) || 1) * (parseFloat(st.weight) || 0);
    return s + wt * (parseFloat(st.price_per_ct) || 0);
  }, 0);
  return {
    stone_type:   first.type || null,
    stone_weight: totalWt    || null,
    stone_price:  totalPrice || null,
  };
}

/** Validate required fields for create/update. Returns array of error strings. */
function validateItemBody(body, isCreate = true) {
  const errors = [];

  if (isCreate || body.category !== undefined) {
    if (!body.category || !body.category.toString().trim()) errors.push('category is required');
  }
  if (isCreate || body.metal !== undefined) {
    if (!body.metal || !body.metal.toString().trim()) errors.push('metal is required');
  }
  if (isCreate || body.purity !== undefined) {
    if (!body.purity || !body.purity.toString().trim()) errors.push('purity is required');
  }
  if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
    errors.push(`status must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }

  const numericFields = ['gross_weight', 'net_weight', 'stone_weight', 'stone_price', 'wastage_pct', 'making_charges', 'mrp'];
  for (const field of numericFields) {
    if (body[field] !== undefined && body[field] !== null) {
      const v = Number(body[field]);
      if (isNaN(v) || v < 0) errors.push(`${field} must be a non-negative number`);
    }
  }

  return errors;
}

/** Build a row object safe to pass to INSERT prepared statement. */
function buildInsertRow(body, sku) {
  const today  = new Date().toISOString().slice(0, 10);
  const stones = Array.isArray(body.stones_json) ? body.stones_json : [];
  const agg    = stonesAggregate(stones);
  return {
    sku,
    name:           [body.metal, body.purity, body.category].filter(Boolean).join(' '),
    category:       body.category,
    metal:          body.metal,
    purity:         body.purity,
    gross_weight:   body.gross_weight   != null ? Number(body.gross_weight)   : null,
    net_weight:     body.net_weight     != null ? Number(body.net_weight)     : null,
    stone_type:     agg.stone_type,
    stone_weight:   agg.stone_weight,
    stone_price:    agg.stone_price,
    wastage_pct:    body.wastage_pct    != null ? Number(body.wastage_pct)    : null,
    making_rate:    body.making_rate    != null ? Number(body.making_rate)    : null,
    making_charges: body.making_charges != null ? Number(body.making_charges) : null,
    mrp:            body.mrp            != null ? Number(body.mrp)            : null,
    supplier:       body.supplier       || null,
    date_added:     body.date_added     || today,
    status:         body.status         || 'In Stock',
    notes:          body.notes          || null,
    stones_json:    stones.length ? JSON.stringify(stones) : null,
  };
}

/** Build a row object safe to pass to UPDATE prepared statement. */
function buildUpdateRow(existing, body, sku) {
  const stones = Array.isArray(body.stones_json) ? body.stones_json : null;
  const agg    = stones ? stonesAggregate(stones) : null;
  return {
    sku,
    name:           [body.metal ?? existing.metal, body.purity ?? existing.purity, body.category ?? existing.category].filter(Boolean).join(' '),
    category:       body.category       !== undefined ? body.category                                                     : existing.category,
    metal:          body.metal          !== undefined ? body.metal                                                        : existing.metal,
    purity:         body.purity         !== undefined ? body.purity                                                       : existing.purity,
    gross_weight:   body.gross_weight   !== undefined ? (body.gross_weight   != null ? Number(body.gross_weight)   : null): existing.gross_weight,
    net_weight:     body.net_weight     !== undefined ? (body.net_weight     != null ? Number(body.net_weight)     : null): existing.net_weight,
    stone_type:     agg ? agg.stone_type   : existing.stone_type,
    stone_weight:   agg ? agg.stone_weight : existing.stone_weight,
    stone_price:    agg ? agg.stone_price  : existing.stone_price,
    wastage_pct:    body.wastage_pct    !== undefined ? (body.wastage_pct    != null ? Number(body.wastage_pct)    : null): existing.wastage_pct,
    making_rate:    body.making_rate    !== undefined ? (body.making_rate    != null ? Number(body.making_rate)    : null): existing.making_rate,
    making_charges: body.making_charges !== undefined ? (body.making_charges != null ? Number(body.making_charges) : null): existing.making_charges,
    mrp:            body.mrp            !== undefined ? (body.mrp            != null ? Number(body.mrp)            : null): existing.mrp,
    supplier:       body.supplier       !== undefined ? (body.supplier       || null)                                     : existing.supplier,
    status:         body.status         !== undefined ? body.status                                                       : existing.status,
    notes:          body.notes          !== undefined ? (body.notes          || null)                                     : existing.notes,
    stones_json:    stones !== null ? (stones.length ? JSON.stringify(stones) : null)                                     : existing.stones_json,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/items
// Supports: ?search= ?status= ?category= ?metal=
app.get('/api/items', (req, res) => {
  try {
    const { search, status, category, metal } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const params     = [];

    if (search) {
      conditions.push('(name LIKE ? OR sku LIKE ? OR supplier LIKE ? OR notes LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status && VALID_STATUSES.has(status)) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (category && VALID_CATEGORIES.has(category)) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (metal && VALID_METALS.has(metal)) {
      conditions.push('metal = ?');
      params.push(metal);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql   = `SELECT * FROM items ${where} ORDER BY id DESC`;
    const items = db.prepare(sql).all(...params);

    res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error('[GET /api/items]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve items' });
  }
});

// GET /api/items/:sku
app.get('/api/items/:sku', (req, res) => {
  try {
    const item = stmts.bySku.get(req.params.sku);
    if (!item) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }
    res.json({ success: true, item });
  } catch (err) {
    console.error('[GET /api/items/:sku]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve item' });
  }
});

// POST /api/items
app.post('/api/items', (req, res) => {
  try {
    const errors = validateItemBody(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    const sku = generateSKU();
    const row = buildInsertRow(req.body, sku);

    stmts.insert.run(row);

    const created = stmts.bySku.get(sku);
    res.status(201).json({ success: true, item: created });
  } catch (err) {
    // SQLite UNIQUE constraint violation
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, error: 'SKU already exists' });
    }
    console.error('[POST /api/items]', err);
    res.status(500).json({ success: false, error: 'Failed to create item' });
  }
});

// PUT /api/items/:sku
app.put('/api/items/:sku', (req, res) => {
  try {
    const existing = stmts.bySku.get(req.params.sku);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const errors = validateItemBody(req.body, false);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    const row    = buildUpdateRow(existing, req.body, req.params.sku);
    const result = stmts.update.run(row);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const updated = stmts.bySku.get(req.params.sku);
    res.json({ success: true, item: updated });
  } catch (err) {
    console.error('[PUT /api/items/:sku]', err);
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

// DELETE /api/items/:sku
app.delete('/api/items/:sku', (req, res) => {
  try {
    const existing = stmts.bySku.get(req.params.sku);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const result = stmts.delete.run(req.params.sku);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    res.json({ success: true, message: `Item ${req.params.sku} deleted successfully` });
  } catch (err) {
    console.error('[DELETE /api/items/:sku]', err);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// PATCH /api/items/:sku/status
app.patch('/api/items/:sku/status', (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'status field is required' });
    }
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${[...VALID_STATUSES].join(', ')}`,
      });
    }

    const existing = stmts.bySku.get(req.params.sku);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const result = stmts.patchStatus.run({ status, sku: req.params.sku });
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const updated = stmts.bySku.get(req.params.sku);
    res.json({ success: true, item: updated });
  } catch (err) {
    console.error('[PATCH /api/items/:sku/status]', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// GET /api/items/:sku/zpl
app.get('/api/items/:sku/zpl', (req, res) => {
  try {
    const item = stmts.bySku.get(req.params.sku);
    if (!item) {
      return res.status(404).json({ success: false, error: `Item with SKU "${req.params.sku}" not found` });
    }

    const zpl = generateZPL(item);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(zpl);
  } catch (err) {
    console.error('[GET /api/items/:sku/zpl]', err);
    res.status(500).json({ success: false, error: 'Failed to generate ZPL' });
  }
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  try {
    const row = stmts.stats.get();
    res.json({
      success: true,
      stats: {
        total:         row.total         || 0,
        inStock:       row.inStock       || 0,
        sold:          row.sold          || 0,
        reserved:      row.reserved      || 0,
        onRepair:      row.onRepair      || 0,
        totalMRPValue: row.totalMRPValue || 0,
      },
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
});

// ─── Gold rates (IBJA) ───────────────────────────────────────────────────────

let _goldCache = null; // { date, g24k, g22k, g18k, asOf }

app.get('/api/gold-rates', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    if (_goldCache && _goldCache.date === today) {
      return res.json({ success: true, cached: true, ..._goldCache });
    }

    const response = await fetch('https://ibjarates.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    if (!response.ok) throw new Error(`IBJA returned HTTP ${response.status}`);

    const html = await response.text();
    const match = html.match(/id="HdnGold"\s+value="([^"]+)"/);
    if (!match) throw new Error('Gold data field not found in IBJA page');

    const jsonStr = match[1].replace(/&quot;/g, '"');
    const data    = JSON.parse(jsonStr);
    const last    = data.purity999.length - 1;

    const raw24k = Math.round(data.purity999[last] / 10);
    const raw22k = Math.round(data.purity916[last] / 10);
    const g24k = Math.round(raw24k * 1.03);
    const g22k = Math.round(raw22k * 1.03);
    const g18k = Math.round(raw24k * 0.75 * 1.03);
    const asOf = data.labels[last]; // DD/MM/YYYY

    _goldCache = { date: today, g24k, g22k, g18k, asOf, source: 'IBJA', source_label: 'IBJA (incl. 3% GST)' };
    res.json({ success: true, cached: false, ..._goldCache });
  } catch (err) {
    console.error('[GET /api/gold-rates]', err.message);
    if (_goldCache) return res.json({ success: true, cached: true, stale: true, ..._goldCache });
    res.status(503).json({ success: false, error: 'Could not fetch gold rates. ' + err.message });
  }
});

// ─── Print proxy (Zebra Browser Print) ───────────────────────────────────────

app.post('/api/print', express.text({ type: '*/*', limit: '512kb' }), (req, res) => {
  const zpl = req.body;
  if (!zpl) return res.status(400).json({ success: false, error: 'No ZPL provided' });

  const http = require('http');

  // Step 1: get default printer from Zebra Browser Print
  http.get('http://localhost:9100/default?type=printer', (zbpRes) => {
    let raw = '';
    zbpRes.on('data', c => raw += c);
    zbpRes.on('end', () => {
      let device;
      try { device = JSON.parse(raw); } catch {
        return res.status(503).json({ success: false, error: 'Zebra Browser Print returned invalid data. Make sure a printer is selected as default.' });
      }
      if (!device || !device.name) {
        return res.status(503).json({ success: false, error: 'No default printer set in Zebra Browser Print. Open the app and select your printer.' });
      }

      // Step 2: send ZPL to printer
      const payload = JSON.stringify({ device, data: zpl });
      const opts = {
        hostname: 'localhost', port: 9100, path: '/write', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const wr = http.request(opts, wrRes => {
        let wd = ''; wrRes.on('data', c => wd += c);
        wrRes.on('end', () => res.json({ success: true }));
      });
      wr.on('error', err => res.status(503).json({ success: false, error: 'Print failed: ' + err.message }));
      wr.write(payload);
      wr.end();
    });
  }).on('error', () => {
    res.status(503).json({ success: false, error: 'Zebra Browser Print is not running. Please open it first.' });
  });
});

// ─── Calibrate printer (one-time NVRAM LH reset) ─────────────────────────────

app.post('/api/calibrate-printer', (req, res) => {
  const http = require('http');
  const resetZpl = '^XA^LH0,0^JUS^XZ';
  http.get('http://localhost:9100/default?type=printer', (zbpRes) => {
    let raw = '';
    zbpRes.on('data', c => raw += c);
    zbpRes.on('end', () => {
      let device;
      try { device = JSON.parse(raw); } catch {
        return res.status(503).json({ success: false, error: 'Zebra Browser Print returned invalid data.' });
      }
      if (!device || !device.name) return res.status(503).json({ success: false, error: 'No default printer set in Zebra Browser Print.' });
      const payload = JSON.stringify({ device, data: resetZpl });
      const opts = {
        hostname: 'localhost', port: 9100, path: '/write', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const wr = http.request(opts, wrRes => { wrRes.resume(); wrRes.on('end', () => res.json({ success: true })); });
      wr.on('error', err => res.status(503).json({ success: false, error: err.message }));
      wr.write(payload);
      wr.end();
    });
  }).on('error', () => res.status(503).json({ success: false, error: 'Zebra Browser Print not running.' }));
});

// ─── Invoice routes ───────────────────────────────────────────────────────────

// POST /api/invoice — compute invoice in memory, no DB storage
app.post('/api/invoice', (req, res) => {
  try {
    const {
      sku,
      per_gram_rate, weight_used, wastage_pct,
      making_charges, stone_price, notes,
    } = req.body;

    if (!sku)           return res.status(400).json({ success: false, error: 'sku is required' });
    if (!per_gram_rate || isNaN(Number(per_gram_rate)))
                        return res.status(400).json({ success: false, error: 'per_gram_rate is required' });
    if (!weight_used || isNaN(Number(weight_used)))
                        return res.status(400).json({ success: false, error: 'weight_used is required' });

    const item = stmts.bySku.get(sku);
    if (!item) return res.status(404).json({ success: false, error: `Item "${sku}" not found` });

    const rate   = Number(per_gram_rate);
    const weight = Number(weight_used);
    const wPct   = Number(wastage_pct)    || 0;
    const making = Number(making_charges) || 0;
    const stone  = Number(stone_price)    || 0;

    const gold_value     = rate * weight;
    const wastage_amount = (wPct / 100) * gold_value;
    const subtotal       = gold_value + wastage_amount + making + stone;
    const cgst_amount    = Math.round(subtotal * 0.015);
    const sgst_amount    = Math.round(subtotal * 0.015);
    const amount_paid    = subtotal + cgst_amount + sgst_amount;

    const invoice_no   = generateInvoiceNo();
    const date_created = new Date().toISOString().slice(0, 10);

    const invoice = {
      invoice_no,
      sku,
      per_gram_rate:  rate,
      weight_used:    weight,
      wastage_pct:    wPct,
      wastage_amount,
      making_charges: making,
      stone_price:    stone,
      gold_value,
      cgst_amount,
      sgst_amount,
      amount_paid,
      date_created,
      notes:        notes ? notes.trim() : null,
      name:         item.name,
      category:     item.category,
      metal:        item.metal,
      purity:       item.purity,
      gross_weight: item.gross_weight,
      net_weight:   item.net_weight,
      stone_type:   item.stone_type,
      stone_weight: item.stone_weight,
    };

    res.status(201).json({ success: true, invoice });
  } catch (err) {
    console.error('[POST /api/invoice]', err);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

// ─── 404 catch-all for /api routes ───────────────────────────────────────────

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `API route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const HTTPS_PORT = 3443;

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    const ipv4 = iface.find(i => i.family === 'IPv4' && !i.internal);
    if (ipv4) return ipv4.address;
  }
  return 'unknown';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`M. Bajranglal Sons Gems & Jewels — Stock System`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
});

// HTTPS server — required for camera access on iOS Safari
const certPath = path.join(__dirname, 'cert.pem');
const keyPath  = path.join(__dirname, 'key.pem');
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
    .listen(HTTPS_PORT, '0.0.0.0', () => {
      const localIP = getLocalIP();
      console.log(`  HTTPS:   https://${localIP}:${HTTPS_PORT}  ← use this on iPhone for camera`);
    });
}

module.exports = app; // for testing
