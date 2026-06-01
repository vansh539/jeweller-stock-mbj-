'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm × 15mm (744 × 120 dots @ 203dpi).
 *   Swarna reference confirms Height=15mm → LL=120, not 104.
 *
 * Dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → x-coords pre-shifted −80
 *   Top  : physical y=0–54 dead → LH=58 clears it
 *
 * Printable window: logical y=0–62 (physical y=58–120) = 7.7mm.
 * Previous LL=104 was wrong — lost 2mm (16 dots) of printable area.
 * ^MD12: darker print. No bold.
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 120;   // 15mm — confirmed by Swarna reference (was 104 = wrong)
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
  lines.push('^LH0,58');  // confirmed safe — do not reduce (label overflow risk)
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: MBJ + barcode with HRT ───────────────────────────────────────
  // 62-dot printable window → taller barcode fits (Swarna: barcode Y=5, H~18)
  lines.push(`^FO${F1X},0^A0N,12,12^FDMBJ^FS`);
  lines.push(`^FO${F1X},13^BY1,3^BCN,40,Y,N,N^FD${bc}^FS`);   // bars y=13→53, HRT→61 ✓

  // ── FACE 2: all 4 fields in 62-dot window ────────────────────────────────
  // LL=120 gives 62 usable dots vs old 46 → 35% bigger → 14pt weights vs 10pt
  lines.push(`^FO${RX},0^A0N,16,13^FD${catLine}^FS`);          // y=0→16
  lines.push(`^FO${RX},17^A0N,14,13^FDGW: ${gw}^FS`);          // y=17→31
  if (sw) {
    lines.push(`^FO${RX},32^A0N,14,13^FDSW: ${sw}^FS`);        // y=32→46
    lines.push(`^FO${RX},47^A0N,14,13^FDNW: ${nw}^FS`);        // y=47→61 ✓
  } else {
    lines.push(`^FO${RX},32^A0N,14,13^FDNW: ${nw}^FS`);        // y=32→46
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
