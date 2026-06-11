'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'jeweller-stock.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    sku            TEXT    UNIQUE NOT NULL,
    name           TEXT    NOT NULL,
    category       TEXT    NOT NULL CHECK(category IN ('Necklace','Ring','Bangle','Earrings','Bracelet','Pendant','Brooch','Other')),
    metal          TEXT    NOT NULL CHECK(metal IN ('Gold','Silver','Platinum','Rose Gold')),
    purity         TEXT    NOT NULL CHECK(purity IN ('24K','22K','18K','14K','925','950','Other')),
    gross_weight   REAL,
    net_weight     REAL,
    stone_type     TEXT    CHECK(stone_type IN ('Diamond','Ruby','Emerald','Sapphire','Pearl','None','Other') OR stone_type IS NULL),
    stone_weight   REAL,
    making_charges REAL,
    mrp            REAL,
    supplier       TEXT,
    date_added     TEXT    DEFAULT (date('now')),
    status         TEXT    NOT NULL DEFAULT 'In Stock' CHECK(status IN ('In Stock','Sold','Reserved','On Repair')),
    notes          TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_items_sku    ON items(sku);
  CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
`);

// Add new item columns if they don't exist yet (safe on existing DB)
for (const col of [
  'ALTER TABLE items ADD COLUMN stone_price  REAL',
  'ALTER TABLE items ADD COLUMN wastage_pct  REAL',
  'ALTER TABLE items ADD COLUMN making_rate  REAL',
]) {
  try { db.exec(col); } catch (_) {}
}

// Migration: remove CHECK constraints + add stones_json column
// Runs once — detected by absence of the stones_json column
const _hasStonesJson = db.prepare("PRAGMA table_info(items)").all().some(c => c.name === 'stones_json');
if (!_hasStonesJson) {
  db.exec(`
    BEGIN;
    CREATE TABLE items_v2 (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sku            TEXT    UNIQUE NOT NULL,
      name           TEXT    NOT NULL,
      category       TEXT    NOT NULL,
      metal          TEXT    NOT NULL,
      purity         TEXT    NOT NULL,
      gross_weight   REAL,
      net_weight     REAL,
      stone_type     TEXT,
      stone_weight   REAL,
      stone_price    REAL,
      wastage_pct    REAL,
      making_charges REAL,
      mrp            REAL,
      supplier       TEXT,
      date_added     TEXT    DEFAULT (date('now')),
      status         TEXT    NOT NULL DEFAULT 'In Stock',
      notes          TEXT,
      stones_json    TEXT
    );
    INSERT INTO items_v2 (id,sku,name,category,metal,purity,gross_weight,net_weight,
      stone_type,stone_weight,stone_price,wastage_pct,making_charges,mrp,supplier,date_added,status,notes)
    SELECT id,sku,name,category,metal,purity,gross_weight,net_weight,
      stone_type,stone_weight,stone_price,wastage_pct,making_charges,mrp,supplier,date_added,status,notes
    FROM items;
    DROP TABLE items;
    ALTER TABLE items_v2 RENAME TO items;
    CREATE INDEX IF NOT EXISTS idx_items_sku    ON items(sku);
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    COMMIT;
  `);
}

// Add tag_no column for per-category sequential tag numbers
try { db.exec('ALTER TABLE items ADD COLUMN tag_no INTEGER'); } catch (_) {}

// Per-category tag sequence
db.exec(`
  CREATE TABLE IF NOT EXISTS category_tag_sequence (
    category TEXT PRIMARY KEY,
    last_seq  INTEGER NOT NULL DEFAULT 0
  );
`);

const _getNextTagSeq = db.transaction((category) => {
  db.prepare(`
    INSERT INTO category_tag_sequence (category, last_seq)
    VALUES (?, 1)
    ON CONFLICT(category) DO UPDATE SET last_seq = last_seq + 1
  `).run(category);
  return db.prepare('SELECT last_seq FROM category_tag_sequence WHERE category = ?').get(category).last_seq;
});

function generateTagNo(category) {
  return _getNextTagSeq(category);
}

// Add new invoice breakup columns if they don't exist yet
for (const col of [
  'ALTER TABLE invoices ADD COLUMN per_gram_rate  REAL',
  'ALTER TABLE invoices ADD COLUMN weight_used    REAL',
  'ALTER TABLE invoices ADD COLUMN wastage_pct    REAL',
  'ALTER TABLE invoices ADD COLUMN wastage_amount REAL',
  'ALTER TABLE invoices ADD COLUMN making_charges REAL',
  'ALTER TABLE invoices ADD COLUMN stone_price    REAL',
  'ALTER TABLE invoices ADD COLUMN gold_value     REAL',
]) {
  try { db.exec(col); } catch (_) {}
}

// ─── SKU Generator ───────────────────────────────────────────────────────────

/**
 * Generate a unique SKU in the format JS-YYYYMMDD-XXXX.
 * XXXX is a zero-padded, auto-incrementing counter that resets per day.
 * A lightweight sequence table keeps track of the daily counter.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS sku_sequence (
    date_key TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );
`);

const _getNextSeq = db.transaction((dateKey) => {
  db.prepare(`
    INSERT INTO sku_sequence (date_key, last_seq)
    VALUES (?, 1)
    ON CONFLICT(date_key) DO UPDATE SET last_seq = last_seq + 1
  `).run(dateKey);

  return db.prepare('SELECT last_seq FROM sku_sequence WHERE date_key = ?').get(dateKey).last_seq;
});

function generateSKU() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const dateKey = `${yyyy}${mm}${dd}`;

  const seq = _getNextSeq(dateKey);
  const seqStr = String(seq).padStart(4, '0');

  return `JS-${dateKey}-${seqStr}`;
}

// ─── Invoices ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no     TEXT    UNIQUE NOT NULL,
    sku            TEXT    NOT NULL,
    customer_name  TEXT    NOT NULL,
    customer_phone TEXT,
    amount_paid    REAL    NOT NULL,
    date_created   TEXT    DEFAULT (date('now')),
    notes          TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_sku        ON invoices(sku);
  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no);

  CREATE TABLE IF NOT EXISTS invoice_sequence (
    date_key TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );
`);

const _getNextInvSeq = db.transaction((dateKey) => {
  db.prepare(`
    INSERT INTO invoice_sequence (date_key, last_seq)
    VALUES (?, 1)
    ON CONFLICT(date_key) DO UPDATE SET last_seq = last_seq + 1
  `).run(dateKey);
  return db.prepare('SELECT last_seq FROM invoice_sequence WHERE date_key = ?').get(dateKey).last_seq;
});

function generateInvoiceNo() {
  const now = new Date();
  const dateKey = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const seq = _getNextInvSeq(dateKey);
  return `INV-${dateKey}-${String(seq).padStart(4,'0')}`;
}

module.exports = { db, generateSKU, generateInvoiceNo, generateTagNo };
