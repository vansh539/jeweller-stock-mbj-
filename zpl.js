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
 * Shoora 'Layout Swarna' ref: Arial Bold, Font 6-7, ~11-dot row spacing.
 * We match that proportion within our 62-dot window.
 *
 * Face 1 — MBJ + barcode (BY2=thicker bars, HRT as separate field to avoid clipping)
 * Face 2 — 4 equal rows (stone) or 3 larger rows (no stone)
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 120;   // 15mm — confirmed. Do not change.
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

  // ── FACE 1: MBJ + barcode ────────────────────────────────────────────────
  // BY2 = 2-dot narrow bars (was 1) → thicker, more scannable
  // BCN h=34, HRT=N — avoids barcode-number overflow past y=62
  // Barcode number printed separately at y=51 with controlled font size
  lines.push(`^FO${F1X},2^A0N,13,11^FDMBJ^FS`);                   // y=2–15
  lines.push(`^FO${F1X},16^BY2,3^BCN,34,N,N,N^FD${bc}^FS`);       // bars y=16–50
  lines.push(`^FO${F1X},51^A0N,11,9^FD${bc}^FS`);                  // barcode num y=51–62

  // ── FACE 2: rows proportioned to Shoora ~11-dot spacing ──────────────────
  if (sw) {
    // 4 rows × 14pt packed into 60-dot window (y=2 to y=62)
    lines.push(`^FO${RX},2^A0N,15,11^FD${catLine}^FS`);            // y=2–17
    lines.push(`^FO${RX},18^A0N,14,10^FDGW:${gw}^FS`);             // y=18–32
    lines.push(`^FO${RX},33^A0N,14,10^FDSW:${sw}^FS`);             // y=33–47
    lines.push(`^FO${RX},48^A0N,14,10^FDNW:${nw}^FS`);             // y=48–62
  } else {
    // 3 rows — bigger text since no stone row needed
    lines.push(`^FO${RX},2^A0N,19,13^FD${catLine}^FS`);            // y=2–21
    lines.push(`^FO${RX},22^A0N,19,13^FDGW:${gw}^FS`);             // y=22–41
    lines.push(`^FO${RX},42^A0N,20,13^FDNW:${nw}^FS`);             // y=42–62
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
