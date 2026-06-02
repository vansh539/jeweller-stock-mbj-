'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 *
 * TEST: LH=0, LL=104 — exact Shoora "Layout Swarna" dimensions (13mm).
 * If MBJ prints without top clipping → no dead zone on this printer,
 * LH=58 offset was wrong, and full 104-dot window is usable.
 *
 * F1X=20: barcode x=20–178, quiet zone x=198 < fold x=216 ✓
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;   // 13mm — Shoora's exact label height
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
  lines.push('^LH0,0');   // TEST — no offset (was 58)
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: Shoora-matched Y positions ───────────────────────────────────
  // CompanyName Y=2 Font=6, BarcodeImage Y=12 Height=18, BarcodeID Y=35 Font=7
  lines.push(`^FO${F1X},2^A0N,16,14^FDMBJ^FS`);                    // y=2–18   (16pt)
  lines.push(`^FO${F1X},20^BY2,3^BCN,18,N,N,N^FD${bc}^FS`);        // y=20–38  (barcode)
  lines.push(`^FO${F1X},40^A0N,18,14^FD${bc}^FS`);                  // y=40–58  (18pt SKU#)

  // ── FACE 2: Shoora Row Y=2/13/23/33, Font 6-7 ───────────────────────────
  if (sw) {
    // 4 rows matching Shoora's exact Y spacing
    lines.push(`^FO${RX},2^A0N,18,10^FD${catLine}^FS`);             // y=2–20   (Row1 Y=2  Font=7)
    lines.push(`^FO${RX},22^A0N,16,15^FDGW:${gw}^FS`);              // y=22–38  (Row2 Y=13 Font=6)
    lines.push(`^FO${RX},40^A0N,16,15^FDSW:${sw}^FS`);              // y=40–56  (Row3 Y=23 Font=6)
    lines.push(`^FO${RX},58^A0N,16,15^FDNW:${nw}^FS`);              // y=58–74  (Row4 Y=33 Font=6)
  } else {
    // 3 rows — bigger text in full 104-dot window
    lines.push(`^FO${RX},2^A0N,22,12^FD${catLine}^FS`);             // y=2–24   (22pt)
    lines.push(`^FO${RX},28^A0N,26,16^FDGW:${gw}^FS`);              // y=28–54  (26pt)
    lines.push(`^FO${RX},58^A0N,22,16^FDNW:${nw}^FS`);              // y=58–80  (22pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
