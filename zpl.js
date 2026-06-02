'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm × 15mm (744 × 120 dots @ 203dpi).
 *
 * Dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → x-coords pre-shifted −80
 *   Top  : physical y=0–54 dead → LH=58 clears it
 *
 * Printable window: logical y=0–62 (physical y=58–120) = 7.7mm.
 * DO NOT change PW/LL/LH/LS — both faces print correctly at these values.
 *
 * F1X=20: barcode starts at x=20, bars end at x=178, right quiet zone ends at
 * x=198, fold at x=216 → 18-dot clearance (was x=40→218 which crossed fold).
 *
 * Face 2 layout: combine GW+NW (no stone) or GW+SW (stone) onto one line
 * to reduce rows → bigger per-row text within 62-dot window.
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 120;   // 15mm — confirmed. Do not change.
  const F1X = 20;    // was 40 — moved left to clear the fold (x=216)
  const RX  = 246;   // Face 2 content start

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
  lines.push('^LH0,58');  // confirmed safe — do not reduce (label overflow risk)
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: MBJ + barcode ────────────────────────────────────────────────
  // F1X=20: barcode width (158 dots) + right quiet zone (20 dots) = 198 < fold(216) ✓
  // BCN h=27, HRT=N: barcode num printed separately to avoid overflow past y=62
  // All content shifted to y=8 for top margin (was y=2)
  lines.push(`^FO${F1X},8^A0N,16,14^FDMBJ^FS`);                    // y=8–24
  lines.push(`^FO${F1X},25^BY2,3^BCN,27,N,N,N^FD${bc}^FS`);        // bars y=25–52
  lines.push(`^FO${F1X},53^A0N,9,8^FD${bc}^FS`);                   // barcode num y=53–62

  // ── FACE 2: fewer rows = bigger text ─────────────────────────────────────
  if (sw) {
    // 3 rows: catLine / GW+SW combined / NW
    // 20 + 18 + 14 = 52pt in 54-dot window (y=8–62) ✓
    lines.push(`^FO${RX},8^A0N,20,13^FD${catLine}^FS`);             // y=8–28
    lines.push(`^FO${RX},29^A0N,18,9^FDGW:${gw} SW:${sw}^FS`);     // y=29–47
    lines.push(`^FO${RX},48^A0N,14,13^FDNW:${nw}^FS`);             // y=48–62
  } else {
    // 2 rows: catLine / GW+NW combined — biggest possible text
    // 25 + 27 = 52pt in 54-dot window (y=8–62) ✓
    lines.push(`^FO${RX},8^A0N,25,13^FD${catLine}^FS`);             // y=8–33
    lines.push(`^FO${RX},34^A0N,27,10^FDGW:${gw} NW:${nw}^FS`);    // y=34–61
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
