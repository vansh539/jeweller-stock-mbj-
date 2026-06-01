'use strict';

/**
 * ZPL II — Zebra GC420t, fold-over jewellery tag LANDSCAPE.
 * Physical: 93mm × 13mm (744 × 104 dots @ 203dpi).
 *
 * Empirical dead zones on this unit:
 *   Left : stored ^LS ≈ +80 dots → all x-coords pre-shifted −80
 *   Top  : physical y=0–54 dead → LH=58 clears it (was LH=40, too low)
 *
 * Printable window: x = F1X–432, y = 0–46  (physical y=58–104)
 *
 * Physical positions (stored +80 x-offset baked in):
 *   Face 1 barcode  x=120  (ZPL F1X=40)
 *   Fold crease     x=216  (ZPL=136)
 *   Face 2 text     x=326  (ZPL RX=246)
 */
function generateZPL(item) {
  const PW  = 744;
  const LL  = 104;   // actual tag height: 13mm = 104 dots
  const F1X = 40;    // Face 1 x-start  → physical x ≈ 120
  const RX  = 246;   // Face 2 text col → physical x ≈ 326
  // LH=58: dead zone found to end at physical y=54; +4 dot safety margin
  // Max logical y = 104 − 58 = 46 dots

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
  lines.push('^LH0,58');  // shift y-origin past top dead zone
  lines.push('^LS0');

  // ── FACE 1: brand + barcode (y=0–44, physical y=58–102) ──────────────────
  lines.push(`^FO${F1X},0^A0N,10,8^FDMBJ^FS`);           // y=0,  h=10 → y=10
  lines.push(`^FO${F1X},12^BY1,3^BCN,32,N,N,N^FD${bc}^FS`); // y=12, h=32 → y=44 ✓

  // ── FACE 2: category+purity / weights (y=0–45) ────────────────────────────
  if (sw) {
    // Stone: 4 rows at h=10, spacing=12 — all fit in 46 dots
    lines.push(`^FO${RX},0^A0N,10,8^FD${catLine}^FS`);    // y=0,  h=10 → y=10
    lines.push(`^FO${RX},12^A0N,10,8^FDGW: ${gw}^FS`);    // y=12, h=10 → y=22
    lines.push(`^FO${RX},24^A0N,10,8^FDSW: ${sw}^FS`);    // y=24, h=10 → y=34
    lines.push(`^FO${RX},35^A0N,10,8^FDNW: ${nw}^FS`);    // y=35, h=10 → y=45 ✓
  } else {
    // No stone: 3 rows at h=12 — fits comfortably
    lines.push(`^FO${RX},0^A0N,12,9^FD${catLine}^FS`);    // y=0,  h=12 → y=12
    lines.push(`^FO${RX},15^A0N,12,9^FDGW: ${gw}^FS`);    // y=15, h=12 → y=27
    lines.push(`^FO${RX},33^A0N,12,9^FDNW: ${nw}^FS`);    // y=33, h=12 → y=45 ✓
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
