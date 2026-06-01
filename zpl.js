'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical: 93mm wide × 13mm tall (744 × 104 dots @203dpi). Fold at x=216.
 *
 * Hardware dead zones on this unit:
 *   Top  : 40 dots  → ^LH0,40 shifts ZPL origin to first printable row
 *   Left : 216+ dots → Face 1 (x=0–215) is entirely inside the dead zone
 *                      and will NOT print on this unit.
 *
 * PRINTABLE ZONE: x=230–432 = 202 dots (~25mm) within Face 2 only.
 * Logical height : LL(120) − LH(40) = 80 printable dots.
 *
 * Layout mirrors Shoora's two-column Face 2 structure:
 *
 *   x=230          x=333        x=432
 *   |── LEFT COL ──|── RIGHT COL ──|
 *   "MBJ"           category + purity
 *   [barcode]       GW: xx.xxx
 *   [bc number]     SW: xx.xxx  ← stone variant only
 *                   NW: xx.xxx
 *
 * LEFT COL  (x=230–332, 102 dots): brand text + BY1 barcode
 *   BY1,3,46 = narrow=1 dot, ratio=3, height=46 dots
 *   4-digit Code128 at BY1 encodes to ≈70 dots wide → fits in 102 dots
 *
 * RIGHT COL (x=336–432, 96 dots): category/purity + weights
 */
function generateZPL(item) {
  const PW     = 744;   // label width dots (93mm @ 203dpi)
  const LL     = 120;   // label length dots
  // ^LH0,40 → origin shifts down 40 dots; all Y coords are relative to row 40
  // Printable height = LL(120) − LH(40) = 80 dots

  // Printable x window
  const LX     = 230;   // left edge — safe margin past 216-dot dead zone
  const SPLIT  = 333;   // column break: LEFT=LX..332, RIGHT=336..432
  const RX     = 336;   // right column x start

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');
    return skuStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(-4);
  }

  const sku      = (item.sku || '').toString().trim();
  // itemName kept in scope for future use; currently brand is fixed as "MBJ"
  const itemName = (item.item_name || item.name || '').toString().trim().slice(0, 16); // eslint-disable-line no-unused-vars
  const category = (item.category || '').toString().trim();
  const purity   = (item.purity   || '').toString().replace(/[^0-9]/g, '');
  const gw       = item.gross_weight != null ? Number(item.gross_weight).toFixed(3) : '—';
  const nw       = Number(item.net_weight || 0).toFixed(3);

  const hasStone = !!(item.stone_type && item.stone_type !== 'None');
  const sw       = hasStone && item.stone_weight != null
                   ? Number(item.stone_weight).toFixed(3) : null;

  const bc      = barcodePayload(sku);
  // Matches Shoora format: "Necklace  22" — two spaces between category and purity
  const catLine = purity ? `${category}  ${purity}` : category;

  const lines = [];
  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,40');   // top dead zone: shifts origin 40 dots down
  lines.push('^LS0');

  // ── LEFT COL: brand label + barcode ──────────────────────────────────────
  // Y=2:  "MBJ" brand text — font A0N h=14 w=11
  lines.push(`^FO${LX},2^A0N,14,11^FDMBJ^FS`);

  // Y=18: BY1,3 barcode, height=46 dots
  //   HRT=Y prints barcode number below bars (like Shoora's "B0000005")
  //   4-digit payload at BY1 ≈ 4*(1+1+1) *3 narrow widths ≈ ~70 dots → fits in 102-dot column
  lines.push(`^FO${LX},18^BY1,3^BCN,46,Y,N,N^FD${bc}^FS`);
  // Barcode block ends at approx Y=18+46+12(HRT)=76 — within 80-dot printable height

  // ── RIGHT COL: category/purity + weights ─────────────────────────────────
  // Mirrors Shoora's right-side layout exactly.
  if (sw) {
    // Stone variant: 4 rows — need tighter spacing to fit in 80 dots
    // Y=2:  category + purity,  font A0N h=16 w=12
    lines.push(`^FO${RX},2^A0N,16,12^FD${catLine}^FS`);
    // Y=20: GW, font A0N h=14 w=11
    lines.push(`^FO${RX},20^A0N,14,11^FDGW: ${gw}^FS`);
    // Y=36: SW, font A0N h=14 w=11
    lines.push(`^FO${RX},36^A0N,14,11^FDSW: ${sw}^FS`);
    // Y=52: NW, font A0N h=13 w=10
    lines.push(`^FO${RX},52^A0N,13,10^FDNW: ${nw}^FS`);
    // Y=52+13=65 — within 80-dot printable height ✓
  } else {
    // No-stone variant: 3 rows — matches Shoora spacing
    // Y=2:  category + purity, font A0N h=18 w=13
    lines.push(`^FO${RX},2^A0N,18,13^FD${catLine}^FS`);
    // Y=24: GW, font A0N h=16 w=12
    lines.push(`^FO${RX},24^A0N,16,12^FDGW: ${gw}^FS`);
    // Y=44: NW, font A0N h=16 w=12
    lines.push(`^FO${RX},44^A0N,16,12^FDNW: ${nw}^FS`);
    // Y=44+16=60 — within 80-dot printable height ✓
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
