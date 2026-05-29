'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 93mm wide × 13mm tall (744 × 104 dots). Fold at 27mm (216 dots).
 *
 * Printer hardware limits on this unit:
 *   Top dead zone : ~40 dots (5mm) → ^LH0,40 shifts origin into printable area
 *   Left dead zone: ~88 dots (11mm) → content at x<88 is clipped by hardware margin
 *   Printable height: 104 - 40 = 64 dots
 *
 * FACE 1  x=0–216  (27mm) — company, barcode, SKU  [visible from x≈88]
 * FOLD    x=216            — vertical line
 * FACE 2  x=228–432 (25mm) — name, GW, SW?, NW
 * NECK    x=432+           — category
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;
  const FOLD = 216;
  const F2X  = 228;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');  // 4-digit seq: even BY2 Code128B = 198 dots fits before fold
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
  lines.push('^LH0,40');  // origin at physical y=40 — clears 5mm top dead zone
  lines.push('^LS0');

  // ── FACE 1 — company, barcode, SKU (printable height = 64 dots) ──────────
  lines.push(`^FO4,0^A0N,10,7^FDMBJ^FS`);
  lines.push(`^FO2,12^BY2,3^BCN,40,N,N,N^FD${bc}^FS`);
  lines.push(`^FO4,54^A0N,8,7^FD${sku}^FS`);

  // ── FOLD LINE ─────────────────────────────────────────────────────────────
  lines.push(`^FO${FOLD},0^GB2,64,2^FS`);

  // ── FACE 2 — item name, weights (fits in 64 dots) ────────────────────────
  if (hasStone && stoneWeight) {
    lines.push(`^FO${F2X},0^A0N,18,12^FD${itemName}^FS`);
    lines.push(`^FO${F2X},20^A0N,12,9^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},34^A0N,12,9^FDSW:${stoneWeight}ct^FS`);
    lines.push(`^FO${F2X},48^A0N,12,9^FDNW:${netWeight}^FS`);
  } else {
    lines.push(`^FO${F2X},0^A0N,18,12^FD${itemName}^FS`);
    lines.push(`^FO${F2X},20^A0N,14,10^FDGW:${grossWeight}^FS`);
    lines.push(`^FO${F2X},36^A0N,14,10^FDNW:${netWeight}^FS`);
  }

  // ── NECK — category ───────────────────────────────────────────────────────
  if (category) lines.push(`^FO440,26^A0N,12,9^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
