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
 * Layout uses y=4–46 (small top margin, maximises usable dots for bigger text).
 *
 * ^MD12: print darkness boosted for heavier ink on each character.
 * Bold: every field printed at x and x+1 (double stroke width).
 * ^BY2: barcode module width doubled — wider bars, easier to scan.
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
  lines.push('^MD12');    // boost print darkness — heavier ink, more readable

  // ── FACE 1: brand (bold) + barcode ──────────────────────────────────────
  // ^BY2 = 2-dot module width → bars are physically twice as wide as before
  lines.push(`^FO${F1X},4^A0N,13,13^FDMBJ^FS`);
  lines.push(`^FO${F1X + 1},4^A0N,13,13^FDMBJ^FS`);           // bold, y=4→17
  lines.push(`^FO${F1X},20^BY2,3^BCN,22,N,N,N^FD${bc}^FS`);   // y=20→42 ✓ (BY2=double-width bars)

  // ── FACE 2: all rows separate, bold, wider chars ──────────────────────────
  // w=13 per char (was w=9) → 44% wider letters → significantly more readable
  if (sw) {
    // Stone: 4 rows from y=4 — catLine+GW+SW+NW all separate
    lines.push(`^FO${RX},4^A0N,12,12^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},4^A0N,12,12^FD${catLine}^FS`);    // bold, y=4→16
    lines.push(`^FO${RX},17^A0N,11,13^FDGW: ${gw}^FS`);
    lines.push(`^FO${RX + 1},17^A0N,11,13^FDGW: ${gw}^FS`);    // bold, y=17→28
    lines.push(`^FO${RX},29^A0N,11,13^FDSW: ${sw}^FS`);
    lines.push(`^FO${RX + 1},29^A0N,11,13^FDSW: ${sw}^FS`);    // bold, y=29→40
    lines.push(`^FO${RX},41^A0N,8,12^FDNW: ${nw}^FS`);
    lines.push(`^FO${RX + 1},41^A0N,8,12^FDNW: ${nw}^FS`);     // bold, y=41→49 (last row)
  } else {
    // No stone: 3 rows — biggest possible fonts
    lines.push(`^FO${RX},4^A0N,14,13^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},4^A0N,14,13^FD${catLine}^FS`);    // bold, y=4→18
    lines.push(`^FO${RX},20^A0N,13,12^FDGW: ${gw}^FS`);
    lines.push(`^FO${RX + 1},20^A0N,13,12^FDGW: ${gw}^FS`);    // bold, y=20→33
    lines.push(`^FO${RX},34^A0N,13,12^FDNW: ${nw}^FS`);
    lines.push(`^FO${RX + 1},34^A0N,13,12^FDNW: ${nw}^FS`);    // bold, y=34→47 (last row)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
