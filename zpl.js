'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical tag: 93mm wide × 13mm tall (744 × 104 dots). Fold at 27mm (216 dots).
 *
 * FACE 1  x=0–216   (27mm) — company name (4,2), barcode (2,18 h52), SKU (4,74)
 * FOLD    x=216             — solid vertical line
 * FACE 2  x=228–432 (25mm) — name (228,2), GW (228,28), SW if present (228,48), NW
 * NECK    x=432+            — category (440,42)
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;
  const FOLD = 216;
  const F2X  = 228;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return `${m[1].slice(2)}${m[2].padStart(4, '0')}`;  // YYMMDD+NNNN = 10 digits, fits BY2 in Face 1
    return skuStr.replace(/[^A-Z0-9]/g, '').slice(0, 10);
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
  lines.push('^LS0');  // cancel any ^LS stored in printer EEPROM — fixes blank left margin

  // ── FACE 1 — company name, barcode, SKU ──────────────────────────────────
  lines.push(`^FO4,2^A0N,14,10^FDMBJ^FS`);
  lines.push(`^FO2,18^BY2,3^BCN,52,N,N,N^FD>:${bc}^FS`);  // >: forces Code128C (pairs) — BY2 ratio 3 standard
  lines.push(`^FO4,74^A0N,16,12^FD${sku}^FS`);

  // ── FOLD LINE at x=216, height=102 ────────────────────────────────────────
  lines.push(`^FO${FOLD},0^GB2,102,2^FS`);

  // ── FACE 2 — item name, weights (no date — matches Swarna layout) ─────────
  lines.push(`^FO${F2X},2^A0N,24,16^FD${itemName}^FS`);
  lines.push(`^FO${F2X},28^A0N,18,13^FDGW:${grossWeight}^FS`);
  if (hasStone && stoneWeight) {
    lines.push(`^FO${F2X},48^A0N,18,13^FDSW:${stoneWeight}ct^FS`);
    lines.push(`^FO${F2X},68^A0N,18,13^FDNW:${netWeight}^FS`);
  } else {
    lines.push(`^FO${F2X},50^A0N,18,13^FDNW:${netWeight}^FS`);
  }

  // ── NECK — category ────────────────────────────────────────────────────────
  if (category) lines.push(`^FO440,42^A0N,14,10^FD${category}^FS`);

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
