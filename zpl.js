'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 *
 * Dead zones on this unit:
 *   Bottom: physical y=0–54 dead → LH=58 clears it
 *
 * LL=120: restores latest12 vertical positioning (approved).
 * Logical window y=0–62. Content starts at y=8 (8-dot top margin).
 *
 * F1X=20: barcode x=20–178, quiet zone x=198 < fold x=216 ✓
 * Font: ^A0N = CG Triumvirate (Arial equivalent on GC420t)
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 120;   // restored — matches latest12 vertical positioning
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

  // ── FACE 1: y=8–62 ──────────────────────────────────────────────────────
  // Barcode reduced from BCN,27 to BCN,24 to give SKU 12pt (was 9pt = "weirdly small")
  lines.push(`^FO${F1X},8^A0N,16,14^FDMBJ^FS`);                    // y=8–24   (16pt)
  lines.push(`^FO${F1X},25^BY2,3^BCN,24,N,N,N^FD${bc}^FS`);        // y=25–49  (24pt barcode)
  lines.push(`^FO${F1X},50^A0N,12,10^FD${bc}^FS`);                  // y=50–62  (12pt SKU#)

  // ── FACE 2: y=8–62 ──────────────────────────────────────────────────────
  if (sw) {
    // catLine / GW+SW combined / NW — fits in 54 usable dots
    lines.push(`^FO${RX},8^A0N,20,13^FD${catLine}^FS`);             // y=8–28   (20pt)
    lines.push(`^FO${RX},29^A0N,18,9^FDGW:${gw} SW:${sw}^FS`);     // y=29–47  (18pt)
    lines.push(`^FO${RX},48^A0N,14,13^FDNW:${nw}^FS`);              // y=48–62  (14pt)
  } else {
    // catLine / GW+NW combined — big text in 54 usable dots
    lines.push(`^FO${RX},8^A0N,25,13^FD${catLine}^FS`);             // y=8–33   (25pt)
    lines.push(`^FO${RX},34^A0N,27,10^FDGW:${gw} NW:${nw}^FS`);    // y=34–61  (27pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
