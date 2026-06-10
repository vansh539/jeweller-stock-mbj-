'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 *
 * LH=28: 3.5mm top dead zone. LL=104: 13mm label. Usable y=0–76.
 *
 * F1 layout:
 *   x=20–130  : left text column
 *   x=106–120 : vertical tag number (A0R)
 *   x=124–180 : rotated barcode (BCR)
 *
 * No-stone: MBJ(24pt) / cat+purity(16pt) / GW(14pt) / NW(14pt pinned bottom)
 * Stone:    MBJ(18pt) / cat+purity(13pt) / GW(13pt) / SW(12pt) / NW(11pt bottom)
 *
 * F2 (x=246–432): up to 5 stone rows — adaptive font.
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;
  const F1X = 20;
  const TNX = 106;   // vertical tag number (14 dots wide → x=106–120)
  const BCX = 124;   // rotated barcode → ends at x=180
  const RX  = 246;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');
    return skuStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(-4);
  }

  const sku      = (item.sku      || '').toString().trim();
  const category = (item.category || '').toString().trim().substring(0, 7).toUpperCase();
  const purity   = (item.purity   || '').toString().replace(/[^0-9]/g, '').substring(0, 3);
  const gw       = item.gross_weight != null ? Number(item.gross_weight).toFixed(3) : '—';
  const nw       = Number(item.net_weight || 0).toFixed(3);
  const bc       = barcodePayload(sku);

  // "NECKLAC 22K" or "RING 22K" or just "NECKLAC"
  const catPurLine = [category, purity ? `${purity}K` : ''].filter(Boolean).join(' ');

  // Stone list: prefer stones_json, fall back to simple stone fields
  let stones = [];
  try {
    const sj = item.stones_json;
    if (sj && sj !== '[]' && sj !== 'null') {
      const parsed = JSON.parse(sj);
      if (Array.isArray(parsed) && parsed.length > 0) stones = parsed;
    }
  } catch (e) {}
  if (stones.length === 0 && item.stone_type && item.stone_type !== 'None' && item.stone_type.trim()) {
    stones = [{
      type:         item.stone_type,
      pieces:       null,
      weight:       item.stone_weight != null ? Number(item.stone_weight) : 0,
      price_per_ct: item.stone_price  != null ? Number(item.stone_price)  : 0,
    }];
  }

  // Total stone weight for F1 SW row
  let swDisplay = null;
  if (stones.length > 0) {
    if (item.stone_weight != null) {
      swDisplay = Number(item.stone_weight).toFixed(3);
    } else {
      const totalCt = stones.reduce((sum, s) =>
        sum + (s.pieces != null ? Number(s.pieces) * Number(s.weight || 0) : Number(s.weight || 0)), 0);
      swDisplay = totalCt.toFixed(3);
    }
  }

  const lines = [];
  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,28');
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1 ────────────────────────────────────────────────────────────────
  // Vertical tag number: A0R (90°CW) at x=136, flows downward
  // h=14 → 14 dots wide; w=18 → 18 dots per char; 4 chars × 18 = 72 → y=2–74
  lines.push(`^FO${TNX},2^A0R,14,18^FD${bc}^FS`);

  // Rotated barcode: BCR at x=154, bar_len=56 → x=154–210 ✓
  lines.push(`^FO${BCX},0^BY1,3^BCR,56,N,N,N^FD${bc}^FS`);

  // Left text column (x=20, up to x=130 = 110 dots)
  if (swDisplay !== null) {
    // Stone: MBJ big + 4 data rows; NW pinned at bottom
    lines.push(`^FO${F1X},2^A0N,18,14^FDMBJ^FS`);               // y=2–20  (18pt, wide)
    lines.push(`^FO${F1X},22^A0N,13,9^FD${catPurLine}^FS`);     // y=22–35
    lines.push(`^FO${F1X},37^A0N,13,9^FDGW:${gw}g^FS`);         // y=37–50
    lines.push(`^FO${F1X},52^A0N,12,9^FDSW:${swDisplay}g^FS`);  // y=52–64
    lines.push(`^FO${F1X},65^A0N,11,9^FDNW:${nw}g^FS`);         // y=65–76 (bottom)
  } else {
    // No-stone: MBJ VERY big + 3 data rows; NW pinned at bottom with air gap
    lines.push(`^FO${F1X},2^A0N,24,20^FDMBJ^FS`);              // y=2–26  (24pt, very wide)
    lines.push(`^FO${F1X},28^A0N,16,9^FD${catPurLine}^FS`);    // y=28–44
    lines.push(`^FO${F1X},46^A0N,14,9^FDGW:${gw}g^FS`);        // y=46–60
    lines.push(`^FO${F1X},62^A0N,14,9^FDNW:${nw}g^FS`);        // y=62–76 (pinned, 2-dot gap)
  }

  // ── FACE 2: stone details (up to 5 types) ────────────────────────────────
  if (stones.length > 0) {
    const count = Math.min(stones.length, 5);
    // [fontH, fontW, yStart, rowGap]
    const layouts = [
      null,
      [40, 11, 18,  0],   // 1 stone
      [30, 11,  4,  8],   // 2 stones
      [22, 11,  0,  5],   // 3 stones
      [16, 11,  0,  4],   // 4 stones
      [13, 10,  0,  2],   // 5 stones
    ];
    const [h, w, yStart, gap] = layouts[count];

    stones.slice(0, 5).forEach((s, i) => {
      const abbr = (s.type || 'STN').substring(0, 4).toUpperCase();
      let row;
      const totalCt = Number(s.weight || 0).toFixed(2);
      if (s.pieces != null && s.pieces > 0) {
        row = `${abbr}   ${s.pieces}/  ${totalCt}ct`;
      } else {
        row = Number(s.weight || 0) > 0 ? `${abbr}   ${totalCt}ct` : abbr;
      }
      lines.push(`^FO${RX},${yStart + i * (h + gap)}^A0N,${h},${w}^FD${row}^FS`);
    });
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
