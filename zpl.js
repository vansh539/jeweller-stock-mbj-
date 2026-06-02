'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical label edge confirmed at logical y=76 (physical y=134).
 * LH=58 clears the bottom dead zone.
 *
 * Layout: latest12 vertical indentation (y=8 start, 8-dot top margin)
 *         + latest13 approved font sizes, packed to fit within y=76.
 *
 * F1X=20: barcode x=20–178, quiet zone x=198 < fold x=216 ✓
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

  // ── FACE 1: y=8 start, all within y=76 ──────────────────────────────────
  // MBJ 20pt + barcode 32pt + 12pt SKU fits in 68 dots (y=8–76)
  lines.push(`^FO${F1X},8^A0N,20,18^FDMBJ^FS`);                    // y=8–28   (20pt)
  lines.push(`^FO${F1X},30^BY2,3^BCN,32,N,N,N^FD${bc}^FS`);        // y=30–62  (32pt barcode)
  lines.push(`^FO${F1X},64^A0N,12,10^FD${bc}^FS`);                  // y=64–76  (12pt SKU#)

  // ── FACE 2: y=8 start, all within y=76 ──────────────────────────────────
  if (sw) {
    // 4 rows × 17pt uniform — starts y=8, ends y=76
    // 4×17 = 68 dots exactly fits in y=8–76
    lines.push(`^FO${RX},8^A0N,17,10^FD${catLine}^FS`);             // y=8–25   (17pt)
    lines.push(`^FO${RX},25^A0N,17,16^FDGW: ${gw}^FS`);             // y=25–42  (17pt)
    lines.push(`^FO${RX},42^A0N,17,16^FDSW: ${sw}^FS`);             // y=42–59  (17pt)
    lines.push(`^FO${RX},59^A0N,17,16^FDNW: ${nw}^FS`);             // y=59–76  (17pt)
  } else {
    // catLine 22pt + GW 28pt = exact latest13 sizes, NW 18pt fits the remainder
    // 22 + 28 + 18 = 68 dots exactly fills y=8–76
    lines.push(`^FO${RX},8^A0N,22,12^FD${catLine}^FS`);             // y=8–30   (22pt ✓ latest13)
    lines.push(`^FO${RX},30^A0N,28,18^FDGW: ${gw}^FS`);             // y=30–58  (28pt ✓ latest13)
    lines.push(`^FO${RX},58^A0N,18,18^FDNW: ${nw}^FS`);             // y=58–76  (18pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
