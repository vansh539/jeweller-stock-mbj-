'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm × 13mm (744 × 104 dots @ 203dpi).
 *
 * Dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → x-coords pre-shifted −80
 *   Top  : physical y=0–54 dead → LH=58 clears it (calibrate printer to fix)
 *
 * Printable window: logical y=0–46 (physical y=58–104) = 5.7mm only.
 * Shoora-style layout: MBJ + barcode + HRT on Face1, all 4 fields on Face2.
 * ^MD12: darker print. No bold.
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;
  const F1X = 40;    // Face 1 x → physical x ≈ 120
  const RX  = 246;   // Face 2 x → physical x ≈ 326

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
  lines.push('^LH0,20');  // TEST: reduced from 58 — if top clips, increase slightly
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: MBJ + barcode with HRT ───────────────────────────────────────
  // LH=20 test: if top is printable, barcode gets full 80 dots of height
  lines.push(`^FO${F1X},0^A0N,14,14^FDMBJ^FS`);
  lines.push(`^FO${F1X},16^BY1,3^BCN,50,Y,N,N^FD${bc}^FS`);   // tall barcode

  // ── FACE 2: LH=20 test — 84 usable dots → 4 rows at 20pt each ───────────
  lines.push(`^FO${RX},0^A0N,20,14^FD${catLine}^FS`);          // y=0→20
  lines.push(`^FO${RX},22^A0N,18,14^FDGW: ${gw}^FS`);          // y=22→40
  if (sw) {
    lines.push(`^FO${RX},42^A0N,16,13^FDSW: ${sw}^FS`);        // y=42→58
    lines.push(`^FO${RX},60^A0N,16,13^FDNW: ${nw}^FS`);        // y=60→76
  } else {
    lines.push(`^FO${RX},42^A0N,18,14^FDNW: ${nw}^FS`);        // y=42→60
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
