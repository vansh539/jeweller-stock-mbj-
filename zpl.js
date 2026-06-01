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
 *
 * ^MD12: print darkness boosted for heavier ink on each character.
 * Bold: every field printed at x and x+1 (double stroke width).
 * Face 2 is always 3 rows — 3 rows in 46 dots → max ~15pt per row.
 * Stone: Face2=catLine+GW+SW, Face1=MBJ+NW+barcode.
 * No-stone: Face2=catLine+GW+NW, Face1=MBJ+barcode.
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
  lines.push('^MD12');    // boost print darkness

  // ── FACE 1: brand (bold) + NW (stone only) + barcode ────────────────────
  // BY1 = 1-dot module width (BY2 was too wide and overflowed into Face 2)
  lines.push(`^FO${F1X},2^A0N,12,12^FDMBJ^FS`);
  lines.push(`^FO${F1X + 1},2^A0N,12,12^FDMBJ^FS`);           // bold, y=2→14
  if (sw) {
    // Stone: show NW on Face 1 to free Face 2 for 3 big rows
    lines.push(`^FO${F1X},15^A0N,10,9^FDNW:${nw}^FS`);
    lines.push(`^FO${F1X + 1},15^A0N,10,9^FDNW:${nw}^FS`);    // bold, y=15→25
    lines.push(`^FO${F1X},27^BY1,3^BCN,16,N,N,N^FD${bc}^FS`); // y=27→43 ✓
  } else {
    // No stone: more room → taller barcode
    lines.push(`^FO${F1X},16^BY1,3^BCN,26,N,N,N^FD${bc}^FS`); // y=16→42 ✓
  }

  // ── FACE 2: always 3 rows — big fonts, all bold ──────────────────────────
  // 3 rows in 46 dots → each row ~15pt → 1.9mm char height (vs 11pt before)
  // catLine: 16pt, weights: 14pt. Bold = double-print at x and x+1.
  if (sw) {
    // Stone: catLine + GW + SW (NW is on Face 1)
    lines.push(`^FO${RX},2^A0N,16,14^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},2^A0N,16,14^FD${catLine}^FS`);    // bold, y=2→18
    lines.push(`^FO${RX},19^A0N,14,13^FDGW:${gw}^FS`);
    lines.push(`^FO${RX + 1},19^A0N,14,13^FDGW:${gw}^FS`);     // bold, y=19→33
    lines.push(`^FO${RX},34^A0N,14,13^FDSW:${sw}^FS`);
    lines.push(`^FO${RX + 1},34^A0N,14,13^FDSW:${sw}^FS`);     // bold, y=34→48 (last row)
  } else {
    // No stone: catLine + GW + NW
    lines.push(`^FO${RX},2^A0N,16,14^FD${catLine}^FS`);
    lines.push(`^FO${RX + 1},2^A0N,16,14^FD${catLine}^FS`);    // bold, y=2→18
    lines.push(`^FO${RX},19^A0N,14,13^FDGW:${gw}^FS`);
    lines.push(`^FO${RX + 1},19^A0N,14,13^FDGW:${gw}^FS`);     // bold, y=19→33
    lines.push(`^FO${RX},34^A0N,14,13^FDNW:${nw}^FS`);
    lines.push(`^FO${RX + 1},34^A0N,14,13^FDNW:${nw}^FS`);     // bold, y=34→48 (last row)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
