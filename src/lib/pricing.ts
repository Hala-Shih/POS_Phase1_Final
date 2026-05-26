// Per-Rule 15 (System-Wide Rules): every per-item price display must show the
// original price plus the adjustments that changed it. This module derives a
// single normalized breakdown from a CartItem so every UI surface can render
// the rule-compliant display without duplicating math.

import type { CartItem } from "@/lib/types";

export interface AdjustmentLine {
  /** Stable key for React lists. */
  key: string;
  /** Human-readable rule, e.g. "Oat Milk", "10% off", "Note adjustment". */
  label: string;
  /** Signed amount applied to the per-unit price. */
  amount: number;
}

export interface PriceBreakdown {
  /** Original menu base price for one unit. */
  basePrice: number;
  /** Modifier upcharges (per unit), one entry per non-zero option. */
  modifierLines: AdjustmentLine[];
  /** Note-based price adjustment (per unit), or null if none. */
  noteAdjustment: AdjustmentLine | null;
  /** Discount line (per unit), or null if none. */
  discount: AdjustmentLine | null;
  /** Override line (per unit), or null if none. */
  override: AdjustmentLine | null;
  /**
   * Net non-override adjustment for the compact display:
   * sum of modifier upcharges + note adjustment + discount, per unit.
   * `0` means no compact adjustment line should be rendered.
   */
  netAdjustment: number;
  /**
   * Final effective per-unit price after applying the override (if set) or
   * the net adjustment.
   */
  effectiveUnitPrice: number;
  /** Whether a price override is active (suppresses other adjustments). */
  hasOverride: boolean;
  /** Whether the item is comped (free). */
  isComped: boolean;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Build a Rule-15-compliant per-unit price breakdown from a cart item.
 * All amounts are per unit (not multiplied by quantity).
 */
export function getPriceBreakdown(item: CartItem, language?: string): PriceBreakdown {
  const zh = language === "zh";
  const basePrice = item.basePrice;

  // Modifier upcharges (only non-zero ones become lines).
  const modifierLines: AdjustmentLine[] = [];
  item.modifiers.forEach((group) => {
    group.modifiers.forEach((m) => {
      if (m.price && m.price !== 0) {
        modifierLines.push({
          key: `mod-${group.groupId}-${m.id}`,
          label: zh && m.nameCn ? m.nameCn : m.name,
          amount: m.price,
        });
      }
    });
  });

  // Combo component upcharges + their nested modifier upcharges (per unit).
  (item.comboSelections || []).forEach((sel) => {
    if (sel.component.price && sel.component.price !== 0) {
      modifierLines.push({
        key: `combo-${sel.groupId}-${sel.component.id}`,
        label: `${sel.groupName}: ${zh && sel.component.nameCn ? sel.component.nameCn : sel.component.name}`,
        amount: sel.component.price,
      });
    }
    sel.modifiers.forEach((group) => {
      group.modifiers.forEach((m) => {
        if (m.price && m.price !== 0) {
          modifierLines.push({
            key: `combo-mod-${sel.component.id}-${group.groupId}-${m.id}`,
            label: zh && m.nameCn ? m.nameCn : m.name,
            amount: m.price,
          });
        }
      });
    });
  });

  const modifierTotal = modifierLines.reduce((s, l) => s + l.amount, 0);

  const noteAdjustment: AdjustmentLine | null =
    item.priceAdjustment && item.priceAdjustment !== 0
      ? {
          key: "note-adjustment",
          label: zh ? "備註調整" : "Note adjustment",
          amount: item.priceAdjustment,
        }
      : null;

  // Pre-discount per-unit subtotal used both to display the discount amount
  // and to compute the effective price when no override is set.
  const preDiscountUnit = basePrice + modifierTotal + (noteAdjustment?.amount || 0);

  let discount: AdjustmentLine | null = null;
  if (item.discount && item.discount.value > 0) {
    if (item.discount.type === "percent") {
      const amount = -round2(preDiscountUnit * (item.discount.value / 100));
      discount = {
        key: "discount",
        label: zh ? `${item.discount.value}% 折扣` : `${item.discount.value}% off`,
        amount,
      };
    } else {
      const amount = -Math.min(preDiscountUnit, item.discount.value);
      discount = {
        key: "discount",
        label: zh ? `$${item.discount.value.toFixed(2)} 折扣` : `$${item.discount.value.toFixed(2)} off`,
        amount: round2(amount),
      };
    }
  }

  const override: AdjustmentLine | null =
    item.priceOverride != null
      ? {
          key: "override",
          label: zh ? "改價" : "Override",
          amount: item.priceOverride,
        }
      : null;

  const netAdjustment = round2(
    modifierTotal + (noteAdjustment?.amount || 0) + (discount?.amount || 0),
  );

  const effectiveUnitPrice = item.comped
    ? 0
    : override
      ? override.amount
      : round2(basePrice + netAdjustment);

  return {
    basePrice,
    modifierLines,
    noteAdjustment,
    discount,
    override,
    netAdjustment,
    effectiveUnitPrice,
    hasOverride: override != null,
    isComped: !!item.comped,
  };
}

/**
 * Format a signed currency amount with explicit + or − sign,
 * suitable for adjustment lines (e.g. "+$1.00", "−$0.65").
 */
export function formatSignedCurrency(amount: number): string {
  const rounded = round2(amount);
  if (rounded === 0) return "$0.00";
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}$${Math.abs(rounded).toFixed(2)}`;
}

/** Format an unsigned currency amount, e.g. "$8.00". */
export function formatCurrency(amount: number): string {
  return `$${Math.abs(round2(amount)).toFixed(2)}`;
}
