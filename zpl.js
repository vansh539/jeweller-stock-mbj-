'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm × 13mm (744 × 104 dots @ 203dpi).
 *
 * Dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → x-coords pre-shifted −80
 *   Top  : physical y=0–54 dead → LH=58 clears it
 *
 * Printable window: logical y=0–46 (physical y=58–104).
 * Layout uses y=2–45 (+2 top margin to pull content down a little).
 *
 * Bold effect: each key text field printed twice at x and x+1,
 * doubling vertical stroke width (ZPL's cleanest bold technique).
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;
  const F1X = 40;    // Face 1 x → physical x ≈ 120
  const RX  = 246;   // Face 2 x → physical x ≈ 326

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
  lines.push('^LH0,58');  // clears top dead zone; logical y max = 46
  lines.push('^LS0');

  // ── FACE 1: brand (bold) + barcode with sequence number below ────────────
  // Bold = print same text at x and x+1 (doubles stroke width)
  lines.push(`^FO${F1X},2^A0N,12,12^FDMBJ^FS`);
  lines.push(`^FO${F1X + 1},2^A0N,12,12^FDMBJ^FS`);
  // BCN,18,Y → bars 18 dots tall + HRT (~8) = 26 total → y=16+26=42 ✓
  lines.push(`^FO${F1X},16^BY1,3^BCN,18,Y,N,N^FD${bc}^FS`);

  // ── FACE 2: category+purity (bold) / weights ─────────────────────────────
  if (sw) {
    // Stone: 4 rows — tight but fits in 43 logical dots
    lines.push(`^FO${RX},2^A0N,10,10^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},2^A0N,10,10^FD${catLine}^FS`);   // bold
    lines.push(`^FO${RX},14^A0N,10,9^FDGW: ${gw}^FS`);        // y=14 → y=24
    lines.push(`^FO${RX},26^A0N,10,9^FDSW: ${sw}^FS`);        // y=26 → y=36
    lines.push(`^FO${RX},37^A0N,8,7^FDNW: ${nw}^FS`);         // y=37 → y=45 ✓
  } else {
    // No stone: 3 rows — larger fonts, more breathing room
    lines.push(`^FO${RX},2^A0N,14,13^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},2^A0N,14,13^FD${catLine}^FS`);   // bold
    lines.push(`^FO${RX},19^A0N,13,11^FDGW: ${gw}^FS`);       // y=19 → y=32
    lines.push(`^FO${RX},33^A0N,12,10^FDNW: ${nw}^FS`);       // y=33 → y=45 ✓
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
