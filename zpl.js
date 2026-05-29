'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 93mm wide × 13mm tall (744 × 104 dots). Fold at 27mm (216 dots).
 *
 * Printer hardware limits (this unit):
 *   Top dead zone : 40 dots (5mm)  → ^LH0,40 shifts origin to first printable row
 *   Left dead zone: 88 dots (11mm) → Face 1 content starts at x=90 (first visible dot)
 *   Printable height: 64 dots (y=0–64 in ZPL = physical y=40–104)
 *   Printable Face 1: x=90–216 = 126 dots
 *
 * FACE 1  x=90–216  — company, barcode (BY1), SKU
 * FOLD    x=216     — vertical line
 * FACE 2  x=228–432 — name, GW, NW (or GW, SW, NW)
 * NECK    x=432+    — category
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;
  const FOLD = 216;
  const F1X  = 90;   // first printable dot in Face 1
  const F2X  = 228;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');  // 4-digit seq; BY1 Code128B = 99 dots, fits 126-dot Face 1
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
  lines.push('^LH0,40');  // clear 5mm top dead zone; y=0–64 is printable
  lines.push('^LS0');

  // ── FACE 1 (y fits: 12+2+38+2+10 = 64) ──────────────────────────────────
  // BY2 Code128B 4-digit = ~198 dots; at x=2 ends at x=200 < 216 fold ✓
  lines.push(`^FO4,0^A0N,12,9^FDMBJ^FS`);
  lines.push(`^FO2,14^BY2,3^BCN,38,N,N,N^FD${bc}^FS`);
  lines.push(`^FO4,54^A0N,10,8^FD${sku}^FS`);

  // ── FOLD LINE ─────────────────────────────────────────────────────────────
  lines.push(`^FO${FOLD},0^GB2,64,2^FS`);

  // ── FACE 2 ────────────────────────────────────────────────────────────────
  if (hasStone && stoneWeight) {
    lines.push(`^FO${F2X},0^A0N,20,14^FD${itemName}^FS`);
    lines.push(`^FO${F2X},22^A0N,16,11^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},40^A0N,16,11^FDSW:${stoneWeight}ct^FS`);
    lines.push(`^FO${F2X},56^A0N,12,9^FDNW:${netWeight}^FS`);
  } else {
    lines.push(`^FO${F2X},0^A0N,24,16^FD${itemName}^FS`);
    lines.push(`^FO${F2X},26^A0N,18,12^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},46^A0N,18,12^FDNW:${netWeight}^FS`);
  }

  // ── NECK ──────────────────────────────────────────────────────────────────
  if (category) lines.push(`^FO440,26^A0N,12,9^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
