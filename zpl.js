'use strict';

/**
 * ZPL II label for Zebra GC420t — 100mm × 15mm fold-over jewellery tag at 203 dpi.
 *
 * Label loaded LANDSCAPE: 100mm across printhead (PW=800), 15mm in feed dir (LL=120).
 *
 * NECK      x=0–159    (~20mm) — blank, loop/hole area, no printing
 * FACE 1    x=163–476  (~39mm) — front: shop name, barcode, GW
 * FOLD LINE x=480               — vertical line
 * FACE 2    x=484–797  (~39mm) — back: SKU, name, metal/purity, stone, date/category
 *
 * No MRP on tag.
 */
function generateZPL(item) {
  // Printable rectangle: 55mm × 13mm at 203dpi
  const PW   = 440;   // 55mm wide  (8 dots/mm × 55 = 440)
  const LL   = 104;   // 13mm tall  (8 dots/mm × 13 = 104)
  const HALF = 220;   // exact midpoint — fold line x
  const L2   = HALF + 3;
  const FACE = HALF - 3;  // usable width per half (~217 dots)

  const lc  = (y, f, t) => `^FO2,${y}${f}^FB${FACE},1,0,C,0^FD${t}^FS`;
  const rl  = (y, f, t) => `^FO${L2},${y}${f}^FD${t}^FS`;
  const rr  = (y, f, t) => `^FO${L2},${y}${f}^FB${PW - L2 - 2},1,0,R,0^FD${t}^FS`;

  function barcodePayload(skuStr) {
    const m = skuStr.match(/JS-(\d{8})-(\d+)/);
    if (m) return `${m[1]}${m[2].padStart(4, '0')}`;
    return skuStr.replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  function formatINR(v) {
    if (v == null || isNaN(v)) return '—';
    try { return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
    catch (_) { return String(Number(v).toFixed(2)); }
  }

  const sku         = (item.sku         || '').toString().trim();
  const metal       = (item.metal       || '').toString().trim();
  const purity      = (item.purity      || '').toString().trim();
  const grossWeight = item.gross_weight != null ? `${Number(item.gross_weight).toFixed(2)}g` : '—';
  const netWeight   = `${Number(item.net_weight || 0).toFixed(2)}g`;
  const itemName    = (item.item_name || item.name || '').toString().trim().slice(0, 22);
  const category    = (item.category   || '').toString().trim();

  const metalPurity = [metal, purity].filter(Boolean).join('/');
  const metalLine   = metalPurity ? `${metalPurity}  NW:${netWeight}` : `NW:${netWeight}`;

  let dateDisplay = '';
  if (item.date_added) {
    const p = item.date_added.toString().split('-');
    dateDisplay = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : item.date_added.toString();
  }

  const hasStone = !!(item.stone_type && item.stone_type !== 'None');
  let stoneLine = '';
  if (hasStone) {
    const parts = [item.stone_type.toString().trim()];
    if (item.stone_weight != null) parts.push(`${Number(item.stone_weight).toFixed(2)}ct`);
    if (item.stone_price  != null) parts.push(`Rs.${formatINR(item.stone_price)}`);
    stoneLine = parts.join(' ');
  }

  const bc = barcodePayload(sku);
  const lines = [];

  lines.push('^XA');
  lines.push(`^PW${PW}`);
  lines.push(`^LL${LL}`);
  lines.push('^LH0,0');

  // ── FACE 1 (front) — x=0 to x=220 ───────────────────────────────────────
  lines.push(lc(2, '^A0N,9,7', 'M.BAJRANGLAL SONS'));

  // Barcode: fits within ~217-dot face width; height=56 leaves room for text above/below
  lines.push(`^FO4,13^BY1,2^BCN,56,N,N,N^FD${bc}^FS`);

  // GW bold (double-print)
  lines.push(lc(76, '^A0N,10,8', `GW:${grossWeight}`));
  lines.push(`^FO3,76^A0N,10,8^FB${FACE},1,0,C,0^FDGW:${grossWeight}^FS`);

  lines.push(lc(89, '^A0N,8,7', sku));

  // ── DOTTED FOLD LINE at x=220 (exactly half of 440) ──────────────────────
  for (let y = 0; y < LL; y += 8) {
    if (y + 4 <= LL) lines.push(`^FO${HALF},${y}^GB1,4,1^FS`);
  }

  // ── FACE 2 (back) — details side ──────────────────────────────────────────
  lines.push(rl(3,  '^A0N,9,7',  sku));
  lines.push(rl(14, '^A0N,13,10', itemName));
  lines.push(rl(30, '^A0N,10,8', metalLine));

  let ny = 44;
  if (hasStone) { lines.push(rl(ny, '^A0N,10,8', stoneLine)); ny += 13; }
  if (dateDisplay) lines.push(rl(ny,  '^A0N,9,7', dateDisplay));
  if (category)    lines.push(rr(ny,  '^A0N,9,7', category));

  lines.push('^XZ');
  return lines.join('\n');
}

module.exports = { generateZPL };
