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
  // Visible tag number: per-category counter if available, else fall back to SKU suffix
  const tagNo    = item.tag_no != null ? String(item.tag_no).padStart(4, '0') : bc;

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
      const totalCt = stones.reduce((sum, s) => sum + Number(s.weight || 0), 0);
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
  // Vertical tag number: per-category counter (human-readable)
  lines.push(`^FO${TNX},2^A0R,14,18^FD${tagNo}^FS`);

  // Rotated barcode: encodes SKU suffix for scanner lookup
  lines.push(`^FO${BCX},0^BY1,3^BCR,56,N,N,N^FD${bc}^FS`);

  // Left text column (x=20, up to x=130 = 110 dots)
  if (swDisplay !== null) {
    // Stone: MBJ big + 4 data rows; NW pinned at bottom
    lines.push(`^FO${F1X},2^A0N,19,15^FDMBJ^FS`);               // y=2–21  (19pt, wide)
    lines.push(`^FO${F1X},22^A0N,14,9^FD${catPurLine}^FS`);     // y=22–36
    lines.push(`^FO${F1X},37^A0N,14,9^FDGW:${gw}g^FS`);         // y=37–51
    lines.push(`^FO${F1X},52^A0N,13,9^FDSW:${swDisplay}ct^FS`); // y=52–65
    lines.push(`^FO${F1X},64^A0N,12,9^FDNW:${nw}g^FS`);         // y=64–76 (bottom)
  } else {
    // No-stone: MBJ VERY big + 3 data rows; NW pinned at bottom with air gap
    lines.push(`^FO${F1X},2^A0N,25,21^FDMBJ^FS`);              // y=2–27  (25pt, very wide)
    lines.push(`^FO${F1X},28^A0N,17,9^FD${catPurLine}^FS`);    // y=28–45
    lines.push(`^FO${F1X},46^A0N,15,9^FDGW:${gw}g^FS`);        // y=46–61
    lines.push(`^FO${F1X},61^A0N,15,9^FDNW:${nw}g^FS`);        // y=61–76 (pinned)
  }

  // ── FACE 2: stone details (up to 5 types) ────────────────────────────────
  if (stones.length > 0) {
    const count = Math.min(stones.length, 5);
    // Fixed font per tier so 1-stone doesn't blow up to 40pt
    let h, w, gap;
    if (count <= 3)      { h = 23; w = 12; gap = 5; }
    else if (count === 4){ h = 17; w = 11; gap = 3; }
    else                 { h = 14; w = 11; gap = 2; }
    const totalH = count * h + Math.max(0, count - 1) * gap;
    const yStart = Math.max(0, Math.floor((76 - totalH) / 2));

    stones.slice(0, 5).forEach((s, i) => {
      const abbr = (s.type || 'STN').substring(0, 4).toUpperCase();
      let row;
      const totalCt = Number(s.weight || 0).toFixed(2);
      if (s.pieces != null && s.pieces > 0) {
        row = `${abbr}   ${s.pieces}/  ${totalCt}ct`;
      } else {
        row = Number(s.weight || 0) > 0 ? `${abbr}   ${totalCt}ct` : abbr;
      }
      if ((s.type || '').toLowerCase() === 'diamond' && (s.colour || s.clarity)) {
        row += `  ${[s.colour, s.clarity].filter(Boolean).join('/')}`;
      }
      lines.push(`^FO${RX},${yStart + i * (h + gap)}^A0N,${h},${w}^FD${row}^FS`);
    });
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
