'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 93mm wide × 13mm tall (744 × 104 dots). Fold at 27mm (216 dots).
 *
 * FACE 1  x=0–216   (27mm) — company name (8,2), barcode (3,14 h56), SKU below (8,72)
 * FOLD    x=216             — solid vertical line, height=102 (102 + LH2 = 104 physical)
 * FACE 2  x=228–432 (25mm) — name (228,2), GW (228,24), SW if present (228,38), NW, date
 * NECK    x=432+            — category (440,42)
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;  // label pitch (incl. gap); printable area is ~104 dots (13mm)
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
  const stoneWeight = hasStone && item.stone_weight != null
    ? `${Number(item.stone_weight).toFixed(2)}`
    : null;

  const bc = barcodePayload(sku);
  const lines = [];

  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,2');  // shift 0.2mm down to align on physical tag

  // ── FACE 1 — company name, barcode, SKU below ────────────────────────────
  lines.push(`^FO8,2^A0N,10,8^FDMBJ^FS`);
  lines.push(`^FO3,14^BY1,2^BCN,56,N,N,N^FD${bc}^FS`);
  lines.push(`^FO8,72^A0N,10,8^FD${sku}^FS`);

  // ── SOLID FOLD LINE at physical centre (x=216, height=102) ───────────────
  // ^LH0,2 shifts Y origin by 2 dots; GB height=102 keeps fold within 104-dot printable area
  lines.push(`^FO${FOLD},0^GB2,102,2^FS`);

  // ── FACE 2 — item name, weights, date ────────────────────────────────────
  lines.push(`^FO${F2X},2^A0N,20,10^FD${itemName}^FS`);
  lines.push(`^FO${F2X},24^A0N,12,9^FDGW:${grossWeight}^FS`);
  if (hasStone && stoneWeight) {
    lines.push(`^FO${F2X},38^A0N,12,9^FDSW:${stoneWeight}ct^FS`);
    lines.push(`^FO${F2X},52^A0N,12,9^FDNW:${netWeight}^FS`);
    if (dateDisplay) lines.push(`^FO${F2X},66^A0N,10,8^FD${dateDisplay}^FS`);
  } else {
    lines.push(`^FO${F2X},38^A0N,12,9^FDNW:${netWeight}^FS`);
    if (dateDisplay) lines.push(`^FO${F2X},52^A0N,10,8^FD${dateDisplay}^FS`);
  }

  // ── NECK — category just past box right edge ──────────────────────────────
  if (category) lines.push(`^FO440,42^A0N,12,9^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
