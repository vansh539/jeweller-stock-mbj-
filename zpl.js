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
  lines.push('^LH0,58');  // clears top dead zone; logical y max = 46
  lines.push('^LS0');
  lines.push('^MD12');

  // ── FACE 1: MBJ + barcode with HRT (mirrors Shoora layout) ───────────────
  lines.push(`^FO${F1X},0^A0N,12,12^FDMBJ^FS`);                // brand at top
  lines.push(`^FO${F1X},13^BY1,3^BCN,28,Y,N,N^FD${bc}^FS`);   // tall barcode + number below

  // ── FACE 2: all 4 fields, proportional sizing (Shoora-matched layout) ────
  // Max 4 rows in 46 printable dots. catLine bigger, weights equal.
  // After printer calibration (full 13mm printable) this will be much larger.
  lines.push(`^FO${RX},0^A0N,14,13^FD${catLine}^FS`);          // y=0→14
  lines.push(`^FO${RX},15^A0N,10,13^FDGW: ${gw}^FS`);          // y=15→25
  if (sw) {
    lines.push(`^FO${RX},26^A0N,10,13^FDSW: ${sw}^FS`);        // y=26→36
    lines.push(`^FO${RX},37^A0N,10,13^FDNW: ${nw}^FS`);        // y=37→47 (last row)
  } else {
    lines.push(`^FO${RX},26^A0N,10,13^FDNW: ${nw}^FS`);        // y=26→36
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
