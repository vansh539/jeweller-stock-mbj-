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
 * Layout uses y=14–46 (+14 top margin — significantly pulled from edge).
 *
 * Bold effect: every text field printed twice at x and x+1.
 * Stone items: GW+SW merged on one line → 3 rows → bigger fonts.
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

  // ── FACE 1: brand (bold) + barcode ──────────────────────────────────────
  lines.push(`^FO${F1X},14^A0N,14,14^FDMBJ^FS`);
  lines.push(`^FO${F1X + 1},14^A0N,14,14^FDMBJ^FS`);         // bold, y=14→28
  lines.push(`^FO${F1X},30^BY1,3^BCN,14,N,N,N^FD${bc}^FS`);  // y=30→44 ✓

  // ── FACE 2: category+purity + weights — ALL rows bold ────────────────────
  if (sw) {
    // Stone: GW+SW merged onto one line → 3 rows total → fits bigger fonts
    const gwsw = `G:${gw} S:${sw}`;
    lines.push(`^FO${RX},14^A0N,13,12^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},14^A0N,13,12^FD${catLine}^FS`);  // bold, y=14→27
    lines.push(`^FO${RX},29^A0N,11,9^FD${gwsw}^FS`);
    lines.push(`^FO${RX + 1},29^A0N,11,9^FD${gwsw}^FS`);      // bold, y=29→40
    lines.push(`^FO${RX},41^A0N,11,9^FDNW: ${nw}^FS`);
    lines.push(`^FO${RX + 1},41^A0N,11,9^FDNW: ${nw}^FS`);    // bold, y=41→52 (last row)
  } else {
    // No stone: 3 rows, large fonts, all bold
    lines.push(`^FO${RX},14^A0N,13,12^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},14^A0N,13,12^FD${catLine}^FS`);  // bold, y=14→27
    lines.push(`^FO${RX},29^A0N,11,9^FDGW: ${gw}^FS`);
    lines.push(`^FO${RX + 1},29^A0N,11,9^FDGW: ${gw}^FS`);    // bold, y=29→40
    lines.push(`^FO${RX},41^A0N,11,9^FDNW: ${nw}^FS`);
    lines.push(`^FO${RX + 1},41^A0N,11,9^FDNW: ${nw}^FS`);    // bold, y=41→52 (last row)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
