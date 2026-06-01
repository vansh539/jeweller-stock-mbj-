'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical: 93mm wide × 13mm tall (744 × 104 dots @203dpi). Fold at x=216.
 *
 * Dead zone: Face 1 (x=0–215) does NOT print on this unit.
 * All content lives in Face 2: x=230–432 (202 printable dots = 25mm).
 * Printable height: LL(120) − LH_y(40) = 80 logical dots.
 *
 * ROWS layout (matches Shoora style):
 *
 *   x=230 ─────────────────────────────── x=432
 *   y=0   │ MBJ              Necklace  22 │
 *   y=16  │ ┌────────────────────────────┐│
 *   y=44  │ │    BY2 barcode (154 dots)  ││
 *          │ └────────────────────────────┘│
 *   y=46  │  0001  (HRT below barcode)    │
 *   y=60  │ GW: 4.190        NW: 3.780   │
 *         └────────────────────────────────┘
 *
 * BY2 width check: 4-digit Code128C = 57 modules × 2 = 114 + quiet(40) = 154 dots
 * Starting at x=230, ends at x=384 — fits within 432 ✓
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 120;
  const LX  = 230;   // Face 2 start + 14-dot safety margin past fold (x=216)
  const CAT = 320;   // catLine x-position (90 dots right of LX)

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
  lines.push('^LH0,40');   // top dead zone: shifts y-origin 40 dots down
  lines.push('^LS0');

  // ── ROW 1: brand (left) + category/purity (right) — y=0, h≈14 ────────────
  lines.push(`^FO${LX},0^A0N,14,11^FDMBJ^FS`);
  lines.push(`^FO${CAT},0^A0N,13,10^FD${catLine}^FS`);

  // ── ROW 2: barcode BY2 — y=16, bar height=28, HRT=Y ─────────────────────
  // BY2 + 4-digit Code128C: 154 dots wide → x=230 to x=384 ✓
  // With HRT(~12 dots): total block ends at y=16+28+12=56
  lines.push(`^FO${LX},16^BY2,3^BCN,28,Y,N,N^FD${bc}^FS`);

  // ── ROW 3: weights — y=58+ ───────────────────────────────────────────────
  if (sw) {
    // Stone: GW + SW on one line, NW below
    // "GW: 4.190  SW: 0.906" = ~21 chars × 8 = 168 dots from x=230 → x=398 ✓
    lines.push(`^FO${LX},58^A0N,10,8^FDGW: ${gw}  SW: ${sw}^FS`);
    lines.push(`^FO${LX},69^A0N,10,8^FDNW: ${nw}^FS`);
    // ends y=79 ✓
  } else {
    // No stone: GW left, NW right on same line
    lines.push(`^FO${LX},58^A0N,12,9^FDGW: ${gw}^FS`);
    lines.push(`^FO${LX + 110},58^A0N,12,9^FDNW: ${nw}^FS`);
    // ends y=70 ✓
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
