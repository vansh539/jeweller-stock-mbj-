'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm wide (PW=744), label stock ~17mm tall.
 *
 * Dead zones on this unit:
 *   Bottom: physical y=0–54 dead → LH=58 starts content above dead zone
 *   Physical label edge: confirmed ≈ y=134–136 from print tests
 *
 * LL=134: logical window y=0–76 (physical y=58–134).
 *   latest13 confirmed SW at logical y=76 (physical 134) prints ✓
 *   NW at logical y=82 (physical 140) did NOT print → label ends between them
 *
 * F1X=20: barcode bars end x=178, quiet zone x=198 < fold x=216 ✓
 * Font: ^A0N = CG Triumvirate (Arial equivalent on GC420t)
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 134;   // physical label boundary confirmed at ~y=134
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

  // ── FACE 1: MBJ / barcode / SKU number — all within y=6–76 ─────────────
  lines.push(`^FO${F1X},6^A0N,18,16^FDMBJ^FS`);                    // y=6–24   (18pt)
  lines.push(`^FO${F1X},30^BY2,3^BCN,30,N,N,N^FD${bc}^FS`);        // y=30–60  (barcode)
  lines.push(`^FO${F1X},62^A0N,10,9^FD${bc}^FS`);                   // y=62–72  (SKU#)

  // ── FACE 2: all rows within y=6–76 ───────────────────────────────────────
  // catLine: up to 16 chars × 11w = 176 < 186 ✓
  // GW/SW/NW: "GW: 3.210" = 9 chars × 16w = 144 ✓
  if (sw) {
    // 4 rows × 15pt with 3-dot gaps — all within y=6–75
    lines.push(`^FO${RX},6^A0N,15,10^FD${catLine}^FS`);             // y=6–21   (15pt)
    lines.push(`^FO${RX},24^A0N,15,15^FDGW: ${gw}^FS`);             // y=24–39  (15pt)
    lines.push(`^FO${RX},42^A0N,15,15^FDSW: ${sw}^FS`);             // y=42–57  (15pt)
    lines.push(`^FO${RX},60^A0N,15,15^FDNW: ${nw}^FS`);             // y=60–75  (15pt)
  } else {
    // 3 rows, bigger text — catLine 20pt / GW 22pt / NW 18pt within y=6–76
    lines.push(`^FO${RX},6^A0N,20,11^FD${catLine}^FS`);             // y=6–26   (20pt)
    lines.push(`^FO${RX},32^A0N,22,16^FDGW: ${gw}^FS`);             // y=32–54  (22pt)
    lines.push(`^FO${RX},58^A0N,18,16^FDNW: ${nw}^FS`);             // y=58–76  (18pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
