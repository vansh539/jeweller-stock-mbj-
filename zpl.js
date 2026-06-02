'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm wide (PW=744), label stock ~20mm tall.
 *
 * Dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → x-coords pre-shifted (^LS0 resets)
 *   Bottom: physical y=0–54 dead → LH=58 starts content above dead zone
 *
 * LL=160 (was 120): extends printable window to use blank space confirmed
 * below content in latest12 photo. Physical y=58–160 = 102 usable dots.
 * If this overprints onto next label, revert LL to 120.
 *
 * F1X=20: barcode bars end at x=178, quiet zone ends at x=198 < fold x=216 ✓
 * Font: ^A0N = CG Triumvirate (Arial equivalent — clearest on GC420t).
 *   Width set close to 0.6× height for natural, readable proportions.
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 160;   // was 120 — extended to claim blank space below content
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

  // ── FACE 1: MBJ / barcode / SKU number ─────────────────────────────────
  // Spaced evenly across 102-dot window (y=8 → y=97)
  // BY2 = 2-dot bars, BCN h=36 no HRT, SKU printed separately
  lines.push(`^FO${F1X},8^A0N,22,20^FDMBJ^FS`);                    // y=8–30  (22pt)
  lines.push(`^FO${F1X},40^BY2,3^BCN,36,N,N,N^FD${bc}^FS`);        // y=40–76 (barcode)
  lines.push(`^FO${F1X},83^A0N,14,12^FD${bc}^FS`);                  // y=83–97 (SKU num)

  // ── FACE 2: spaced rows, big text ────────────────────────────────────────
  // GW/SW/NW formatted "GW: X.XXX" (9 chars × 18w = 162 < 186 ✓)
  // catLine up to 15 chars × 12w = 180 < 186 ✓
  if (sw) {
    // 4 rows with ~6-dot gaps: catLine / GW / SW / NW
    lines.push(`^FO${RX},8^A0N,20,12^FD${catLine}^FS`);             // y=8–28   (20pt)
    lines.push(`^FO${RX},34^A0N,18,16^FDGW: ${gw}^FS`);             // y=34–52  (18pt)
    lines.push(`^FO${RX},58^A0N,18,16^FDSW: ${sw}^FS`);             // y=58–76  (18pt)
    lines.push(`^FO${RX},82^A0N,18,16^FDNW: ${nw}^FS`);             // y=82–100 (18pt)
  } else {
    // 3 rows with ~14-dot gaps: catLine / GW / NW
    lines.push(`^FO${RX},8^A0N,22,12^FD${catLine}^FS`);             // y=8–30   (22pt)
    lines.push(`^FO${RX},44^A0N,28,18^FDGW: ${gw}^FS`);             // y=44–72  (28pt)
    lines.push(`^FO${RX},80^A0N,22,18^FDNW: ${nw}^FS`);             // y=80–102 (22pt)
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
