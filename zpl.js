'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 *
 * Neck is on the RIGHT — box left edge = x=0. PW=800 prevents centering offset.
 * Box = 55mm × 13mm (440 × 104 dots). Fold at x=220 (exact centre).
 *
 * FACE 1    x=0–219    (27.5mm) — shop name, barcode, GW
 * FOLD LINE x=220               — dotted vertical line
 * FACE 2    x=223–439  (27.5mm) — SKU, name, metal/purity, stone, date/category
 * NECK      x=440+              — loop/hole area, no printing
 */
function generateZPL(item) {
  const PW   = 800;   // 100mm — must equal physical media width to avoid centering
  const LL   = 120;   // 15mm — full physical label pitch (not just the 13mm box)
  const HALF = 220;   // fold line at exact box midpoint (27.5mm)
  const L2   = HALF + 3;   // = 223, Face 2 start
  const FACE = HALF - 3;   // = 217, usable dots per half-face

  const lc  = (y, f, t) => `^FO2,${y}${f}^FB${FACE},1,0,L,0^FD${t}^FS`;
  const rl  = (y, f, t) => `^FO${L2},${y}${f}^FD${t}^FS`;
  const rr  = (y, f, t) => `^FO${L2},${y}${f}^FB${440 - L2 - 2},1,0,R,0^FD${t}^FS`;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return `${m[1]}${m[2].padStart(4, '0')}`;
    return skuStr.replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  function formatINR(v) {
    if (v == null || isNaN(v)) return '—';
    try { return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    catch (_) { return String(Number(v).toFixed(2)); }
  }

  const sku         = (item.sku         || '').toString().trim();
  const metal       = (item.metal       || '').toString().trim();
  const purity      = (item.purity      || '').toString().trim();
  const grossWeight = item.gross_weight != null ? `${Number(item.gross_weight).toFixed(2)}g` : '—';
  const netWeight   = `${Number(item.net_weight || 0).toFixed(2)}g`;
  const itemName    = (item.item_name || item.name || '').toString().trim().slice(0, 22);
  const category    = (item.category   || '').toString().trim();

  const metalPurity = [metal, purity].filter(Boolean).join('/');
  const metalLine   = metalPurity ? `${metalPurity}  NW:${netWeight}` : `NW:${netWeight}`;

  let dateDisplay = '';
  if (item.date_added) {
    const p = item.date_added.toString().split('-');
    dateDisplay = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : item.date_added.toString();
  }

  const hasStone = !!(item.stone_type && item.stone_type !== 'None');
  let stoneLine = '';
  if (hasStone) {
    const parts = [item.stone_type.toString().trim()];
    if (item.stone_weight != null) parts.push(`${Number(item.stone_weight).toFixed(2)}ct`);
    if (item.stone_price  != null) parts.push(`Rs.${formatINR(item.stone_price)}`);
    stoneLine = parts.join(' ');
  }

  const bc = barcodePayload(sku);
  const lines = [];

  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,0');

  // ── FACE 1 (front) — x=0 to x=220 ──────────────────────────────────────
  // y=30 clears the printer's physical top margin (~20-25 dots)
  lines.push(lc(30, '^A0N,9,7', 'M.BAJRANGLAL SONS'));

  lines.push(`^FO4,42^BY1,2^BCN,44,N,N,N^FD${bc}^FS`);

  // GW bold (double-print for weight)
  lines.push(lc(89, '^A0N,10,8', `GW:${grossWeight}`));
  lines.push(`^FO3,89^A0N,10,8^FB${FACE},1,0,L,0^FDGW:${grossWeight}^FS`);

  lines.push(lc(102, '^A0N,8,7', sku));

  // ── DOTTED FOLD LINE at x=HALF(220) ──────────────────────────────────────
  for (let y = 0; y < LL; y += 8) {
    if (y + 4 <= LL) lines.push(`^FO${HALF},${y}^GB1,4,1^FS`);
  }

  // ── FACE 2 (back) — details side ──────────────────────────────────────────
  lines.push(rl(30, '^A0N,9,7',  sku));
  lines.push(rl(42, '^A0N,13,10', itemName));
  lines.push(rl(58, '^A0N,10,8', metalLine));

  let ny = 71;
  if (hasStone) { lines.push(rl(ny, '^A0N,10,8', stoneLine)); ny += 13; }
  if (dateDisplay) lines.push(rl(ny,  '^A0N,9,7', dateDisplay));
  if (category)    lines.push(rr(ny,  '^A0N,9,7', category));

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
