// Chapter 7 — a renderer you can break on purpose.
//
// The point of this file is not the SVG. The point is that every defect the
// audit will be measured against is *injected here*, by name, so the truth
// about a render is known before any model looks at it. Chapter 6 used a 7:3
// mixture with a known rate; this chapter uses a renderer with known defects.

export type Code =
  | "missing_total"
  | "truncated_amount"
  | "overlap"
  | "low_contrast"
  | "offscreen_control"
  | "total_mismatch";

export const CODES: readonly Code[] = [
  "missing_total",
  "truncated_amount",
  "overlap",
  "low_contrast",
  "offscreen_control",
  "total_mismatch",
];

export interface Line {
  label: string;
  amount: number;
}

export interface Receipt {
  id: string;
  merchant: string;
  lines: Line[];
  shipping: number;
  /** Applied to items plus shipping, rounded to cents. */
  taxRate: number;
  /** What the document actually prints. May disagree with the arithmetic. */
  printedTotal: number;
  cta: string;
}

export interface Render {
  id: string;
  receipt: Receipt;
  /** Defects the renderer will draw. `total_mismatch` is derived, not listed. */
  defects: Code[];
}

const W = 480;
const H = 640;
const PAD = 24;
const RIGHT = W - PAD;

export function money(n: number): string {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Items plus shipping plus tax, to the cent. */
export function computedTotal(r: Receipt): number {
  const items = r.lines.reduce((sum, l) => sum + l.amount, 0);
  const base = items + r.shipping;
  return Math.round((base + base * r.taxRate) * 100) / 100;
}

/**
 * The truth about a render: the codes the renderer drew, plus the one that is
 * arithmetic rather than drawing. Derived from the receipt, never hand-annotated.
 */
export function truthOf(render: Render): Code[] {
  const drawn = [...render.defects];
  if (Math.abs(computedTotal(render.receipt) - render.receipt.printedTotal) > 0.005) {
    if (!drawn.includes("total_mismatch")) drawn.push("total_mismatch");
  }
  return drawn;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function row(y: number, label: string, amount: string, opts: { big?: boolean; muted?: boolean } = {}): string {
  const size = opts.big ? 20 : 15;
  const weight = opts.big ? 600 : 400;
  const fill = opts.muted ? "#EDE6D6" : "#14213A";
  return [
    `<text x="${PAD}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(label)}</text>`,
    `<text x="${RIGHT}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="end">${esc(amount)}</text>`,
  ].join("");
}

/**
 * Render one receipt as an SVG string.
 *
 * The layout is a cursor: each row advances it, and a defect either skips a
 * row, moves one, changes a color, or widens a box. That is the whole model of
 * a visual bug, and it is why the truth is knowable.
 */
export function render(r: Receipt, defects: readonly Code[] = []): string {
  const has = (c: Code) => defects.includes(c);
  const items = r.lines.reduce((sum, l) => sum + l.amount, 0);
  const base = items + r.shipping;
  const tax = Math.round(base * r.taxRate * 100) / 100;

  let y = 78;
  const parts: string[] = [];
  parts.push(`<text x="${PAD}" y="${y}" font-size="22" font-weight="700" fill="#14213A">${esc(r.merchant)}</text>`);
  y += 30;
  parts.push(`<text x="${PAD}" y="${y}" font-size="13" fill="#6B7280">Order ${esc(r.id)}</text>`);
  y += 40;

  for (const line of r.lines) {
    parts.push(row(y, line.label, money(line.amount)));
    y += 26;
  }

  y += 8;
  parts.push(`<line x1="${PAD}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="#D9D2C2"/>`);
  y += 28;
  parts.push(row(y, "Subtotal", money(items)));
  y += 26;
  parts.push(row(y, "Shipping", money(r.shipping)));

  const taxY = y + 26;
  const totalY = taxY + 32;

  // Overlap draws the tax row on the total's baseline, so the two collide.
  parts.push(row(has("overlap") ? totalY : taxY, "Tax", money(tax)));

  if (!has("missing_total")) {
    const fill = has("low_contrast") ? "#EFE9DB" : "#14213A";
    const label = `<text x="${PAD}" y="${totalY}" font-size="20" font-weight="600" fill="${fill}">Total</text>`;
    const amount = has("truncated_amount")
      ? // Starts too far right for its own width: the card clips it mid-number.
        `<text x="${RIGHT - 24}" y="${totalY}" font-size="20" font-weight="600" fill="${fill}" text-anchor="start">${esc(money(r.printedTotal))}</text>`
      : `<text x="${RIGHT}" y="${totalY}" font-size="20" font-weight="600" fill="${fill}" text-anchor="end">${esc(money(r.printedTotal))}</text>`;
    parts.push(label + amount);
  }

  const ctaY = 470;
  const ctaWidth = has("offscreen_control") ? 300 : 200;
  const ctaX = has("offscreen_control") ? 300 : PAD;
  parts.push(
    `<rect x="${ctaX}" y="${ctaY}" rx="8" width="${ctaWidth}" height="52" fill="#E8833A"/>`,
    `<text x="${ctaX + 20}" y="${ctaY + 33}" font-size="16" font-weight="600" fill="#FFFFFF">${esc(r.cta)}</text>`,
  );

  parts.push(
    `<text x="${PAD}" y="${H - 28}" font-size="11" fill="#6B7280">Questions? support@northwind.example</text>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><clipPath id="card"><rect x="0" y="0" width="${RIGHT}" height="${H}"/></clipPath></defs>`,
    `<rect width="${W}" height="${H}" fill="#FDFBF6"/>`,
    `<g clip-path="url(#card)" font-family="Helvetica, Arial, sans-serif">`,
    ...parts,
    `</g>`,
    `</svg>`,
  ].join("\n");
}
