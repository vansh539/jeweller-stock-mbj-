'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm wide × 13mm tall (744 × 104 dots @ 203dpi).
 *
 * This printer has a persistent +80-dot rightward offset (stored ^LS from
 * old experiments). All ZPL x-coords are pre-shifted -80 to compensate.
 * DO NOT press Calibrate — it may clear the offset and break positioning.
 *
 * Physical print positions (offset already baked in):
 *   Face 1 barcode  : physical x = 120–197  (ZPL x = 40–117)
 *   Fold line       : physical x = 216      (ZPL x = 136)
 *   Face 2 text col : physical x = 326      (ZPL x = 246)
 *
 * Printable height: 104 (tag) − 40 (LH) = 64 dots. Content max y = 62.
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 104;
  const F1X  = 40;    // Face 1: brand + barcode (physical x ≈ 120)
  const FOLD = 136;   // fold divider (physical x = 216)
  const RX   = 246;   // Face 2: category + weights (physical x ≈ 326)

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');
    return skuStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(-4);
  }

  const sku      = (item.sku || '').toString().trim();
  const category = (item.category || '').toString().trim();
  const purity   = (item.purity   || '').toString().replace(/[^0-9]/g, '');
  const gw       = item.gross_weight != null ? Number(item.gross_weight).toFixed(3) : '—';
  const nw       = Number(item.net_weight || 0).toFixed(3);

  const hasStone = !!(item.stone_type && item.stone_type !== 'None');
  const sw       = hasStone && item.stone_weight != null
                   ? Number(item.stone_weight).toFixed(3) : null;

  const bc      = barcodePayload(sku);
  const catLine = purity ? `${category}  ${purity}` : category;

  const lines = [];
  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,40');  // top dead zone: shifts y-origin 5mm down
  lines.push('^LS0');

  // ── FACE 1: brand + barcode (ZPL x=40–117, physical x=120–197) ───────────
  // BY1 + 4-digit Code128C = 77 dots wide — fits Face 1's 77-dot budget ✓
  lines.push(`^FO${F1X},0^A0N,13,10^FDMBJ^FS`);
  lines.push(`^FO${F1X},15^BY1,3^BCN,46,N,N,N^FD${bc}^FS`);
  // barcode: y=15 to y=61 ✓ (within 62-dot limit)

  // ── FOLD LINE (physical x=216, visible divider) ───────────────────────────
  lines.push(`^FO${FOLD},0^GB2,62,2^FS`);

  // ── FACE 2: category+purity / weights (ZPL x=246, physical x≈326) ────────
  if (sw) {
    lines.push(`^FO${RX},0^A0N,13,10^FD${catLine}^FS`);
    lines.push(`^FO${RX},16^A0N,12,9^FDGW: ${gw}^FS`);
    lines.push(`^FO${RX},30^A0N,12,9^FDSW: ${sw}^FS`);
    lines.push(`^FO${RX},44^A0N,12,9^FDNW: ${nw}^FS`);
    // ends y=56 ✓
  } else {
    lines.push(`^FO${RX},0^A0N,14,11^FD${catLine}^FS`);
    lines.push(`^FO${RX},22^A0N,13,10^FDGW: ${gw}^FS`);
    lines.push(`^FO${RX},44^A0N,13,10^FDNW: ${nw}^FS`);
    // ends y=57 ✓
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
