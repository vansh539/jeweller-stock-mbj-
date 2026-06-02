'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical label edge confirmed at ~y=134 (physical y=58+76) from print tests.
 *
 * Dead zones on this unit:
 *   Bottom dead zone: physical y=0–54 (LH=58 clears it)
 *   Physical label edge: confirmed y=134 → logical window y=0–76
 *
 * Layout: approved font sizes from latest13 shifted to start at y=2,
 * packing everything within y=76 so NW and SKU are no longer cut off.
 *
 * F1X=20: barcode bars x=20–178, quiet zone x=198 < fold x=216 ✓
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 134;
  const F1X = 20;
  const RX  = 246;

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
  lines.push('^LH0,58');  // confirmed safe — do not reduce
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: y=2–76 ──────────────────────────────────────────────────────
  // Same sizes as latest13, shifted up from y=8 → y=2 so SKU fits within y=76
  lines.push(`^FO${F1X},2^A0N,22,20^FDMBJ^FS`);                    // y=2–24   (22pt)
  lines.push(`^FO${F1X},26^BY2,3^BCN,36,N,N,N^FD${bc}^FS`);        // y=26–62  (36pt barcode)
  lines.push(`^FO${F1X},64^A0N,12,10^FD${bc}^FS`);                  // y=64–76  (12pt SKU#)

  // ── FACE 2: y=2–76 ──────────────────────────────────────────────────────
  // catLine: up to 15 chars × 12w = 180 < 186 ✓ (no-stone) / 15ch × 10 = 150 ✓ (stone)
  // GW/SW/NW: "GW: X.XXX" = 9 chars × 18w = 162 < 186 ✓ / 9 × 16 = 144 ✓
  if (sw) {
    // 4 rows tight-packed (0 gap) to hit approved sizes in y=2–76
    lines.push(`^FO${RX},2^A0N,20,10^FD${catLine}^FS`);             // y=2–22   (20pt)
    lines.push(`^FO${RX},22^A0N,18,16^FDGW: ${gw}^FS`);             // y=22–40  (18pt)
    lines.push(`^FO${RX},40^A0N,18,16^FDSW: ${sw}^FS`);             // y=40–58  (18pt)
    lines.push(`^FO${RX},58^A0N,18,16^FDNW: ${nw}^FS`);             // y=58–76  (18pt)
  } else {
    // 3 rows with 2-dot gaps — approved sizes from latest13
    lines.push(`^FO${RX},2^A0N,22,12^FD${catLine}^FS`);             // y=2–24   (22pt)
    lines.push(`^FO${RX},26^A0N,28,18^FDGW: ${gw}^FS`);             // y=26–54  (28pt)
    lines.push(`^FO${RX},56^A0N,20,18^FDNW: ${nw}^FS`);             // y=56–76  (20pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
