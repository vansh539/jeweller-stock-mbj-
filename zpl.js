'use strict';

/**
 * ZPL II label for Zebra GC420t — 6.2 cm × 1.5 cm tag at 203 dpi.
 *
 * Pixel dimensions : 496 × 120 dots
 * Fold point       : x = 248 (tag folds in half and clips to product)
 *
 * LEFT HALF  (front face) — shop name, barcode, GW
 * RIGHT HALF (back face)  — SKU, item name, metal/purity + NW, stone, date/category
 *
 * No MRP on tag.
 */
function generateZPL(item) {
  const LABEL_WIDTH  = 496;
  const LABEL_HEIGHT = 120;
  const HALF         = 248;

  function leftCentred(y, fontCmd, text) {
    return `^FO0,${y}${fontCmd}^FB${HALF},1,0,C,0^FD${text}^FS`;
  }
  function rightLeft(y, fontCmd, text) {
    return `^FO${HALF + 4},${y}${fontCmd}^FD${text}^FS`;
  }
  function rightRight(y, fontCmd, text) {
    return `^FO${HALF},${y}${fontCmd}^FB${HALF - 4},1,0,R,0^FD${text}^FS`;
  }

  // At 203 dpi the GC420t renders a minimum of ~2 dots per module.
  // Full 18-char SKU → ~466 dots wide — overflows the left half.
  // Encode only the numeric YYYYMMDDXXXX part using Code 128C (digit pairs),
  // which is ~101 modules × 2 dots = 202 dots + quiet zones ≈ 242 dots → fits.
  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return `${m[1]}${m[2].padStart(4, '0')}`;   // e.g. "202605160001"
    return skuStr.replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  function formatINR(value) {
    if (value == null || isNaN(value)) return '—';
    try {
      return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } catch (_) { return String(Number(value).toFixed(2)); }
  }

  const sku         = (item.sku          || '').toString().trim();
  const metal       = (item.metal        || '').toString().trim();
  const purity      = (item.purity       || '').toString().trim();
  const grossWeight = item.gross_weight  != null ? `${Number(item.gross_weight).toFixed(2)}g` : '—';
  const netWeight   = `${Number(item.net_weight || 0).toFixed(2)}g`;
  const itemName    = (item.item_name || item.name || '').toString().trim().slice(0, 22);

  const metalPurity = [metal, purity].filter(Boolean).join('/');
  const metalLine   = metalPurity
    ? `${metalPurity}  NW:${netWeight}`
    : `NW:${netWeight}`;

  const category = (item.category || '').toString().trim();

  let dateDisplay = '';
  if (item.date_added) {
    const parts = item.date_added.toString().split('-');
    dateDisplay = parts.length === 3
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : item.date_added.toString();
  }

  const hasStone = !!(item.stone_type && item.stone_type !== 'None' && item.stone_type !== null);
  let stoneLine = '';
  if (hasStone) {
    const stoneType   = item.stone_type.toString().trim();
    const stoneWeight = item.stone_weight != null ? `${Number(item.stone_weight).toFixed(2)}ct` : null;
    const stonePrice  = item.stone_price  != null ? `Rs.${formatINR(item.stone_price)}` : null;
    const parts = [stoneType];
    if (stoneWeight) parts.push(stoneWeight);
    if (stonePrice)  parts.push(stonePrice);
    stoneLine = parts.join(' ');
  }

  const stoneOffset = hasStone ? 13 : 0;
  const barcodeData = barcodePayload(sku);

  const lines = [];

  lines.push('^XA');
  lines.push(`^PW${LABEL_WIDTH}`);
  lines.push(`^LL${LABEL_HEIGHT}`);
  lines.push('^LH0,0');

  // ── LEFT HALF ─────────────────────────────────────────────────────────────
  lines.push(leftCentred(3, '^A0N,12,9', 'M.BAJRANGLAL SONS'));

  // Compact 12-digit numeric barcode — fits the 248-dot left half at 2 dots/module
  lines.push('^FO4,17');
  lines.push('^BY1,3,55');
  lines.push('^BCN,55,N,N,N');
  lines.push(`^FD${barcodeData}^FS`);

  // GW bold — double-print at x=0 and x=1
  lines.push(leftCentred(78, '^A0N,12,9', `GW:${grossWeight}`));
  lines.push(`^FO1,78^A0N,12,9^FB${HALF},1,0,C,0^FDGW:${grossWeight}^FS`);

  // SKU in small text below GW (human-readable reference on front face)
  lines.push(leftCentred(94, '^A0N,10,7', sku));

  // ── FOLD LINE ──────────────────────────────────────────────────────────────
  lines.push(`^FO${HALF},0^GB1,${LABEL_HEIGHT},1^FS`);

  // ── RIGHT HALF ────────────────────────────────────────────────────────────
  lines.push(rightLeft(3,  '^A0N,10,8', sku));
  lines.push(rightLeft(15, '^A0N,13,10', itemName));
  lines.push(rightLeft(30, '^A0N,11,8',  metalLine));

  if (hasStone) {
    lines.push(rightLeft(43, '^A0N,11,8', stoneLine));
  }

  const dateY = 43 + stoneOffset;
  if (dateDisplay) lines.push(rightLeft(dateY,  '^A0N,10,8', dateDisplay));
  if (category)    lines.push(rightRight(dateY, '^A0N,10,8', category));

  lines.push('^XZ');

  return lines.join('\n');
}

module.exports = { generateZPL };
