'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 *
 * LH=20: small top dead zone confirmed (~2.5mm).
 * LL=104: 13mm label (Shoora-matched).
 * Logical window: y=0 to y=84 (104-20 = 84 dots = 10.5mm usable).
 *
 * Previous LH=58 was massively overcorrecting — wasted 38 dots.
 *
 * F1X=20: barcode x=20–178, quiet zone x=198 < fold x=216 ✓
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;   // 13mm — confirmed Shoora-matched label height
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
  lines.push('^LH0,20');  // 20-dot top dead zone (2.5mm)
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: MBJ / barcode / SKU — y=2 to y=82 ──────────────────────────
  lines.push(`^FO${F1X},2^A0N,22,20^FDMBJ^FS`);                    // y=2–24   (22pt)
  lines.push(`^FO${F1X},26^BY2,3^BCN,36,N,N,N^FD${bc}^FS`);        // y=26–62  (36pt barcode)
  lines.push(`^FO${F1X},64^A0N,18,14^FD${bc}^FS`);                  // y=64–82  (18pt SKU# — matches MBJ size)

  // ── FACE 2: y=2 to y=84 ─────────────────────────────────────────────────
  if (sw) {
    // 4 rows — 20pt each with spacing, all within y=84
    lines.push(`^FO${RX},2^A0N,20,10^FD${catLine}^FS`);             // y=2–22   (20pt)
    lines.push(`^FO${RX},24^A0N,20,15^FDGW:${gw}^FS`);              // y=24–44  (20pt)
    lines.push(`^FO${RX},46^A0N,20,15^FDSW:${sw}^FS`);              // y=46–66  (20pt)
    lines.push(`^FO${RX},68^A0N,16,15^FDNW:${nw}^FS`);              // y=68–84  (16pt)
  } else {
    // 3 rows — biggest text we've ever had
    lines.push(`^FO${RX},2^A0N,28,12^FD${catLine}^FS`);             // y=2–30   (28pt)
    lines.push(`^FO${RX},34^A0N,28,16^FDGW:${gw}^FS`);              // y=34–62  (28pt)
    lines.push(`^FO${RX},66^A0N,18,16^FDNW:${nw}^FS`);              // y=66–84  (18pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
