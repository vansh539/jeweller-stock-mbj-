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

  // ── FACE 1: brand + barcode, no bold ─────────────────────────────────────
  lines.push(`^FO${F1X},2^A0N,12,12^FDMBJ^FS`);
  lines.push(`^FO${F1X},16^BY1,3^BCN,26,N,N,N^FD${bc}^FS`);   // y=16→42 ✓

  // ── FACE 2: 3 rows — big catLine + GW + compact SW/NW ────────────────────
  // catLine at 20pt (2.5mm) — genuinely readable.
  // GW at 14pt — readable.
  // SW and NW share bottom row (different units: carats vs grams) at 10pt.
  // No stone: catLine 20pt, GW 16pt, NW 12pt — all 3 rows bigger.
  lines.push(`^FO${RX},0^A0N,20,13^FD${catLine}^FS`);          // y=0→20
  if (sw) {
    lines.push(`^FO${RX},21^A0N,14,13^FDGW: ${gw}^FS`);        // y=21→35
    const swShort = Number(sw).toFixed(2);
    const nwShort = Number(nw).toFixed(2);
    lines.push(`^FO${RX},36^A0N,10,13^FDS:${swShort}  N:${nwShort}^FS`); // y=36→46 ✓
  } else {
    lines.push(`^FO${RX},21^A0N,16,13^FDGW: ${gw}^FS`);        // y=21→37
    lines.push(`^FO${RX},38^A0N,10,13^FDNW: ${nw}^FS`);        // y=38→48 (last row)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
