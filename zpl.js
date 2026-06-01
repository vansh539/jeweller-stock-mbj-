'use strict';

/**
 * ZPL II label for Zebra GC420t — fold-over jewellery tag loaded LANDSCAPE.
 * Physical: 93mm wide × 13mm tall (744 × 104 dots @203dpi). Fold at x=216.
 *
 * Hardware dead zones on this unit:
 *   Top  : 40 dots → ^LH0,40 shifts ZPL origin to first printable row
 *   Left : 88 dots → Face 1 content must start at x≥90
 *
 * FACE 1  x=90–214   — item name, barcode, SKU
 * FOLD    x=216      — vertical line
 * FACE 2  x=224–430  — category+purity (top), GW / SW / NW
 * NECK    x=440+     — blank
 */
function generateZPL(item) {
  const PW   = 744;
  const LL   = 120;
  const FOLD = 216;
  const F1X  = 90;
  const F2X  = 224;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return m[2].padStart(4, '0');
    return skuStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(-4);
  }

  const sku      = (item.sku || '').toString().trim();
  const itemName = (item.item_name || item.name || '').toString().trim().slice(0, 16);
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
  lines.push('^LH0,40');
  lines.push('^LS0');

  // ── FACE 1: brand / barcode (HRT prints barcode number below bars) ────────
  lines.push(`^FO${F1X},2^A0N,14,11^FDMBJ^FS`);
  lines.push(`^FO${F1X},18^BY1,3^BCN,46,Y,N,N^FD${bc}^FS`);

  // ── FOLD LINE ─────────────────────────────────────────────────────────────
  lines.push(`^FO${FOLD},0^GB2,80,2^FS`);

  // ── FACE 2: category+purity / weights ────────────────────────────────────
  if (sw) {
    lines.push(`^FO${F2X},2^A0N,18,13^FD${catLine}^FS`);
    lines.push(`^FO${F2X},22^A0N,14,11^FDGW: ${gw}^FS`);
    lines.push(`^FO${F2X},38^A0N,14,11^FDSW: ${sw}^FS`);
    lines.push(`^FO${F2X},54^A0N,12,9^FDNW: ${nw}^FS`);
  } else {
    lines.push(`^FO${F2X},2^A0N,20,15^FD${catLine}^FS`);
    lines.push(`^FO${F2X},26^A0N,16,12^FDGW: ${gw}^FS`);
    lines.push(`^FO${F2X},47^A0N,16,12^FDNW: ${nw}^FS`);
  }

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
