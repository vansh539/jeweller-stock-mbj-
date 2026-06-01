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

  // ── FACE 1: brand + barcode (MBJ bold, rest plain) ───────────────────────
  lines.push(`^FO${F1X},2^A0N,12,12^FDMBJ^FS`);
  lines.push(`^FO${F1X + 1},2^A0N,12,12^FDMBJ^FS`);           // MBJ bold only
  lines.push(`^FO${F1X},16^BY1,3^BCN,26,N,N,N^FD${bc}^FS`);   // taller barcode y=16→42 ✓

  // ── FACE 2: all 4 fields, no bold, widest chars that fit ─────────────────
  // 4 rows max in 46 printable dots → h=11 per row (physical max for 4 rows).
  // w=13 for catLine (max for long names ~13 chars × 13 = 169 < 186).
  // w=18 for weights (max 10 chars × 18 = 180 < 186) — fills horizontal space.
  lines.push(`^FO${RX},0^A0N,11,13^FD${catLine}^FS`);          // y=0→11
  lines.push(`^FO${RX},12^A0N,11,18^FDGW: ${gw}^FS`);          // y=12→23
  if (sw) {
    lines.push(`^FO${RX},24^A0N,11,18^FDSW: ${sw}^FS`);        // y=24→35
    lines.push(`^FO${RX},36^A0N,11,18^FDNW: ${nw}^FS`);        // y=36→47 (last row)
  } else {
    lines.push(`^FO${RX},24^A0N,11,18^FDNW: ${nw}^FS`);        // y=24→35
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
