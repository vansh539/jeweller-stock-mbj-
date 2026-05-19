'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 54mm box (432 dots) × 12mm tall (96 dots). Fold at 27mm (216 dots).
 *
 * FACE 1  x=0–216   (27mm) — barcode (20,10 h60), GW/NW (20,75)
 * FOLD    x=216             — solid vertical line, height=96
 * FACE 2  x=228–432 (25mm) — SKU (228,10), name (228,25), stone/date below
 * NECK    x=432+            — category (440,42)
 */
function generateZPL(item) {
  const PW   = 800;
  const LL   = 120;  // label pitch (incl. gap); printable area is ~96 dots (12mm)
  const FOLD = 216;  // physical fold at 27mm = 216 dots
  const F2X  = 228;  // face-2 content starts 1.5mm (12 dots) after fold

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
  const grossWeight = item.gross_weight != null ? `${Number(item.gross_weight).toFixed(2)}g` : '—';
  const netWeight   = `${Number(item.net_weight || 0).toFixed(2)}g`;
  const itemName    = (item.item_name || item.name || '').toString().trim().slice(0, 16);
  const category    = (item.category   || '').toString().trim();

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

  // ── FACE 1 — barcode fills face, GW/NW below ─────────────────────────────
  lines.push(`^FO20,10^BY1,2^BCN,60,N,N,N^FD${bc}^FS`);
  lines.push(`^FO20,75^A0N,12,9^FDGW:${grossWeight}  NW:${netWeight}^FS`);

  // ── SOLID FOLD LINE at physical centre (x=216, height=96) ─────────────────
  lines.push(`^FO${FOLD},0^GB2,96,2^FS`);

  // ── FACE 2 — fits within 204 dots (432−228) ──────────────────────────────
  lines.push(`^FO${F2X},10^A0N,12,9^FDMBJ ${sku}^FS`);
  lines.push(`^FO${F2X},25^A0N,18,13^FD${itemName}^FS`);

  let ny = 46;
  if (hasStone)    { lines.push(`^FO${F2X},${ny}^A0N,12,9^FD${stoneLine}^FS`); ny += 13; }
  if (dateDisplay)   lines.push(`^FO${F2X},${ny}^A0N,12,9^FD${dateDisplay}^FS`);

  // ── NECK — category just past box right edge ──────────────────────────────
  if (category) lines.push(`^FO440,42^A0N,12,9^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
