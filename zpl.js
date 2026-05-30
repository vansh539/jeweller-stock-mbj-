'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 93mm wide × 13mm tall (744 × 104 dots). Fold at 27mm (216 dots).
 *
 * ^LH0,2  — 2-dot y-shift only (clears media top edge, preserves full 102-dot print height)
 * DO NOT use ^LH0,40 — it pushes all content to the vertical centre of the tag.
 *
 * FACE 1  x=0–216  — MBJ (8,2), barcode BY2 (2,14 h=56), SKU (8,72)
 * FOLD    x=216     — vertical GB line, height=102
 * FACE 2  x=228–432 — name, GW, NW (or GW, SW, NW)
 * NECK    x=432+    — category (440,42)
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;
  const FOLD = 216;
  const F2X  = 228;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');
    return skuStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(-4);
  }

  const sku         = (item.sku         || '').toString().trim();
  const grossWeight = item.gross_weight != null ? `${Number(item.gross_weight).toFixed(2)}g` : '—';
  const netWeight   = `${Number(item.net_weight || 0).toFixed(2)}g`;
  const itemName    = (item.item_name || item.name || '').toString().trim().slice(0, 16);
  const category    = (item.category   || '').toString().trim();

  const hasStone = !!(item.stone_type && item.stone_type !== 'None');
  const stoneWeight = hasStone && item.stone_weight != null
    ? `${Number(item.stone_weight).toFixed(2)}`
    : null;

  const bc = barcodePayload(sku);
  const lines = [];

  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,2');
  lines.push('^LS0');

  // ── FACE 1 (x=0–216) ─────────────────────────────────────────────────────
  // MBJ:     y=2  h=10  bottom=12
  // Barcode: y=14 h=56  bottom=70  (BY2 4-digit Code128B = 198 dots; x=2→200 < fold ✓)
  // SKU:     y=72 h=10  bottom=82  (physical y=74→84 < 104 ✓)
  lines.push(`^FO8,2^A0N,10,8^FDMBJ^FS`);
  lines.push(`^FO2,14^BY2,3^BCN,56,N,N,N^FD${bc}^FS`);
  lines.push(`^FO8,72^A0N,10,8^FD${sku}^FS`);

  // ── FOLD LINE ─────────────────────────────────────────────────────────────
  lines.push(`^FO${FOLD},0^GB2,102,2^FS`);

  // ── FACE 2 (x=228–432) ────────────────────────────────────────────────────
  if (hasStone && stoneWeight) {
    // name: y=2→22  GW: y=24→38  SW: y=40→54  NW: y=56→68  (physical bottom=70 < 104 ✓)
    lines.push(`^FO${F2X},2^A0N,20,14^FD${itemName}^FS`);
    lines.push(`^FO${F2X},24^A0N,14,10^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},40^A0N,14,10^FDSW:${stoneWeight}ct^FS`);
    lines.push(`^FO${F2X},56^A0N,12,9^FDNW:${netWeight}^FS`);
  } else {
    // name: y=2→26  GW: y=28→46  NW: y=48→66  (physical bottom=68 < 104 ✓)
    lines.push(`^FO${F2X},2^A0N,24,16^FD${itemName}^FS`);
    lines.push(`^FO${F2X},28^A0N,18,12^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},48^A0N,18,12^FDNW:${netWeight}^FS`);
  }

  // ── NECK ──────────────────────────────────────────────────────────────────
  if (category) lines.push(`^FO440,42^A0N,12,9^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
