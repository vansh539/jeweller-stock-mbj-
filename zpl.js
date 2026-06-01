'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm wide × 13mm tall (744 × 104 dots @ 203dpi).
 *
 * Orientation: 93mm feeds ACROSS print head (PW=744), 13mm feeds THROUGH (LL=104).
 * Top dead zone: 40 dots (5mm) → ^LH0,40 shifts y-origin.
 * Printable height: 104 (physical) − 40 (LH) = 64 logical dots.  MAX CONTENT y = 62.
 * Left dead zone: Face 1 (x=0–215) does NOT print. Printable x starts at ~230.
 *
 * Face 2 layout (x=230–432, y=0–62):
 *
 *   x=230         x=310        x=432
 *   │ MBJ          Necklace  22 │
 *   │ ██████████████████        │   BY2 barcode, 154 dots wide
 *   │ 0001                      │   HRT below (no-stone only)
 *   │ GW: 4.190    NW: 3.780   │
 *   └─────────────────────────  ┘
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;    // actual tag height: 13mm = 104 dots
  const LX  = 230;    // barcode column x (14 dots past fold at 216)
  const CAT = 310;    // category text x

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
  lines.push('^LH0,40');  // skip 5mm top dead zone; printable = y 0–62
  lines.push('^LS0');

  if (sw) {
    // ── STONE VARIANT ────────────────────────────────────────────────────────
    // y=0  : MBJ + catLine (h=12) → ends y=12
    lines.push(`^FO${LX},0^A0N,12,9^FDMBJ^FS`);
    lines.push(`^FO${CAT},0^A0N,12,9^FD${catLine}^FS`);
    // y=14 : barcode BY2 h=22, no HRT (saves 10 dots) → ends y=36
    lines.push(`^FO${LX},14^BY2,3^BCN,22,N,N,N^FD${bc}^FS`);
    // y=38 : GW + SW on one line (A0N,10,8 = 10 dots tall) → ends y=48
    lines.push(`^FO${LX},38^A0N,10,8^FDGW: ${gw}  SW: ${sw}^FS`);
    // y=50 : NW → ends y=60 ✓ (within 62)
    lines.push(`^FO${LX},50^A0N,10,8^FDNW: ${nw}^FS`);

  } else {
    // ── NO-STONE VARIANT ─────────────────────────────────────────────────────
    // y=0  : MBJ + catLine (h=13) → ends y=13
    lines.push(`^FO${LX},0^A0N,13,10^FDMBJ^FS`);
    lines.push(`^FO${CAT},0^A0N,13,10^FD${catLine}^FS`);
    // y=15 : barcode BY2 h=24, HRT=Y (prints seq number below) → bars end y=39, HRT ends ~y=49
    lines.push(`^FO${LX},15^BY2,3^BCN,24,Y,N,N^FD${bc}^FS`);
    // y=51 : GW left, NW right (A0N,10,8 = 10 dots tall) → ends y=61 ✓ (within 62)
    lines.push(`^FO${LX},51^A0N,10,8^FDGW: ${gw}^FS`);
    lines.push(`^FO${LX + 110},51^A0N,10,8^FDNW: ${nw}^FS`);
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
