"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft, Check, Minus, Plus,
  CreditCard, DollarSign, Gift, Printer, Split, WalletCards, X,
} from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import type { CartItem } from "@/lib/types";
import { getPriceBreakdown, formatCurrency, formatSignedCurrency } from "@/lib/pricing";

/* ── helpers (mirror PaymentScreen) ── */
const TAX_RATE = 0.0875;
function roundCurrency(v: number) { return Math.round(v * 100) / 100; }

interface ItemizedUnit {
  unitId: string; name: string; unitIndex: number; unitCount: number;
  unitTotal: number; source: CartItem;
}

function buildItemizedUnits(items: CartItem[]): ItemizedUnit[] {
  return items.flatMap((item) => {
    const totalCents = Math.round(item.totalPrice * 100);
    const baseCents = Math.floor(totalCents / item.quantity);
    const remainderCents = totalCents - baseCents * item.quantity;
    return Array.from({ length: item.quantity }, (_, i) => ({
      unitId: `${item.id}:${i}`, name: item.name, unitIndex: i, unitCount: item.quantity,
      unitTotal: (baseCents + (i < remainderCents ? 1 : 0)) / 100,
      source: item,
    }));
  });
}

/**
 * Rule 15 inline-delta description for a payment-drawer unit row.
 */
function UnitDescription({ item }: { item: CartItem }) {
  const breakdown = getPriceBreakdown(item);
  const overrideActive = breakdown.hasOverride;

  const modifierEntries = item.modifiers.flatMap((g) =>
    g.modifiers.map((m) => ({ g, m })),
  );

  return (
    <>
      {modifierEntries.length > 0 && (
        <p className="text-xs text-gray-500 mt-0.5">
          {modifierEntries.map(({ g, m }, i) => {
            const d = !overrideActive && m.price ? m.price : 0;
            return (
              <span key={`${g.groupId}-${m.id}`}>
                {i > 0 && ", "}
                {m.name}
                {d ? (
                  <span className="ml-1 font-medium" style={{ color: "#6750A4" }}>
                    {formatSignedCurrency(d)}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      )}

      {item.comboSelections && item.comboSelections.length > 0 && (
        <p className="text-xs text-gray-500 mt-0.5">
          {item.comboSelections.map((s, ci) => {
            const compDelta = !overrideActive && s.component.price ? s.component.price : 0;
            const innerMods = s.modifiers.flatMap((g) => g.modifiers.map((m) => ({ g, m })));
            return (
              <span key={`${s.groupId}-${s.component.id}-${ci}`}>
                {ci > 0 && " · "}
                {s.component.name}
                {compDelta ? (
                  <span className="ml-1 font-medium" style={{ color: "#6750A4" }}>
                    {formatSignedCurrency(compDelta)}
                  </span>
                ) : null}
                {innerMods.length > 0 && (
                  <>
                    {" ("}
                    {innerMods.map(({ g, m }, mi) => {
                      const d = !overrideActive && m.price ? m.price : 0;
                      return (
                        <span key={`${g.groupId}-${m.id}`}>
                          {mi > 0 && ", "}
                          {m.name}
                          {d ? (
                            <span className="ml-1 font-medium" style={{ color: "#6750A4" }}>
                              {formatSignedCurrency(d)}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                    {")"}
                  </>
                )}
              </span>
            );
          })}
        </p>
      )}

      {item.note && (
        <p className="text-xs italic mt-0.5" style={{ color: "#6750A4" }}>
          Note: {item.note}
          {!overrideActive && breakdown.noteAdjustment ? (
            <span className="ml-1 not-italic font-medium">
              {formatSignedCurrency(breakdown.noteAdjustment.amount)}
            </span>
          ) : null}
        </p>
      )}

      {!overrideActive && breakdown.discount && (
        <p className="text-xs italic mt-0.5" style={{ color: "#6750A4" }}>
          {breakdown.discount.label}
          <span className="ml-1 not-italic font-medium">
            {formatSignedCurrency(breakdown.discount.amount)}
          </span>
        </p>
      )}

      {overrideActive && (
        <p className="text-xs italic mt-0.5" style={{ color: "#6750A4" }}>Override</p>
      )}
    </>
  );
}

/**
 * Rule 15 right-column price stack for a payment-drawer unit row.
 */
function UnitPriceColumn({ item }: { item: CartItem }) {
  const breakdown = getPriceBreakdown(item);

  if (!breakdown.hasOverride && breakdown.netAdjustment === 0 && !breakdown.isComped) {
    return (
      <span className="text-sm font-medium text-gray-900 shrink-0">
        {formatCurrency(breakdown.basePrice)}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end shrink-0 leading-tight">
      <span className="text-[12px] text-gray-500 line-through">
        {formatCurrency(breakdown.basePrice)}
      </span>
      <span className="text-sm font-semibold" style={{ color: "#6750A4" }}>
        {formatCurrency(breakdown.effectiveUnitPrice)}
      </span>
    </div>
  );
}

/* ── constants ── */
const TIP_PRESETS = [
  { label: "15%", value: 0.15 },
  { label: "18%", value: 0.18 },
  { label: "20%", value: 0.20 },
];
const DISCOUNT_PRESETS = [
  { label: "-3%", value: 0.03 },
  { label: "-5%", value: 0.05 },
];
const MOCK_GIFT_CARDS: Record<string, { pin: string; balance: number }> = {
  abc1234: { pin: "1234", balance: 150.0 },
};

/* ── types ── */
type ViewType = "main" | "split" | "cash" | "credit" | "gift" | "complete";
type SplitType = "even" | "amount" | "item";

interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSplit: () => void;
  onMultiplePayment: () => void;
  onPrint: () => void;
  onPaymentComplete: () => void;
  /**
   * Called when the drawer enters/exits a dedicated payment-method subview
   * (cash / credit / gift). Parent uses this to hide the footer nav and
   * order summary, so the subview reads as a fullscreen page.
   */
  onSubviewChange?: (active: boolean) => void;
}

const mainButtons = [
  { id: "cash",     label: "Cash",             icon: DollarSign },
  { id: "split",    label: "Split check",      icon: Split      },
  { id: "credit",   label: "Credit Card",      icon: CreditCard },
  { id: "multiple", label: "Multi-pay", icon: WalletCards},
  { id: "gift",     label: "Gift Card",        icon: Gift       },
  { id: "print",    label: "Print",            icon: Printer    },
] as const;

export default function PaymentDrawer({
  open, onClose, onSplit, onMultiplePayment, onPrint, onPaymentComplete,
  onSubviewChange,
}: PaymentDrawerProps) {
  const { cartItems, cartTotal, guestCount } = useOrderStore();

  /* ── view state ── */
  const [view, setView] = useState<ViewType>("main");

  /* ── split state ── */
  const [splitType, setSplitType]             = useState<SplitType | null>(null);
  const [splitGuestCount, setSplitGuestCount] = useState(2);
  const [splitAmountInput, setSplitAmountInput] = useState("");
  const [selectedItemUnitIds, setSelectedItemUnitIds] = useState<Set<string>>(new Set());
  const splitAmountInputRef = useRef<HTMLInputElement>(null);

  /* ── cash state ── */
  const [cashDiscountIdx, setCashDiscountIdx]           = useState<number | null>(null);
  const [cashCustomDiscount, setCashCustomDiscount]     = useState(false);
  const [cashCustomDiscountVal, setCashCustomDiscountVal] = useState("");
  const [cashCustomDiscountMode, setCashCustomDiscountMode] = useState<"$" | "%">("$");
  const [cashTenderIdx, setCashTenderIdx]               = useState<number | null>(null);
  const [cashExact, setCashExact]                       = useState(false);
  const [cashCustomTender, setCashCustomTender]         = useState(false);
  const [cashCustomTenderVal, setCashCustomTenderVal]   = useState("");

  /* ── credit card state ── */
  const [ccStep, setCcStep]   = useState<"tap" | "processing" | "processed" | "tip">("tap");
  const [ccTipIdx, setCcTipIdx] = useState<number | null>(null);
  const ccTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── gift card state ── */
  const [gcSerial, setGcSerial]     = useState("");
  const [gcPin, setGcPin]           = useState("");
  const [gcStep, setGcStep]         = useState<"input" | "processing" | "balance" | "applying" | "done">("input");
  const [gcResult, setGcResult]     = useState<{ success: boolean; balance?: number; message: string } | null>(null);
  const [gcApplyAmount, setGcApplyAmount] = useState("");
  const [gcTipIdx, setGcTipIdx]     = useState<number | null>(null);
  const gcSerialRef                 = useRef<HTMLInputElement>(null);

  /* ── complete state ── */
  const [completedAmount, setCompletedAmount] = useState(0);
  const [completedTotal, setCompletedTotal]   = useState(0);
  const [completedChange, setCompletedChange] = useState<number | null>(null);

  /* notify parent when in a dedicated method subview (Cash/Credit/Gift/Complete) */
  useEffect(() => {
    const isSubview = open && (view === "cash" || view === "credit" || view === "gift" || view === "complete");
    onSubviewChange?.(isSubview);
    return () => { onSubviewChange?.(false); };
  }, [open, view, onSubviewChange]);

  /* reset all state when drawer closes */
  useEffect(() => {
    if (!open) {
      setView("main");
      setSplitType(null); setSplitGuestCount(2); setSplitAmountInput(""); setSelectedItemUnitIds(new Set());
      setCashDiscountIdx(null); setCashCustomDiscount(false); setCashCustomDiscountVal(""); setCashCustomDiscountMode("$");
      setCashTenderIdx(null); setCashExact(false); setCashCustomTender(false); setCashCustomTenderVal("");
      setCcStep("tap"); setCcTipIdx(null);
      if (ccTimerRef.current) clearTimeout(ccTimerRef.current);
      setGcSerial(""); setGcPin(""); setGcStep("input"); setGcResult(null); setGcApplyAmount(""); setGcTipIdx(null);
    }
  }, [open]);

  if (!open) return null;

  /* ── computed ── */
  const rawSubtotal    = cartTotal();
  const orderBaseTotal = roundCurrency(rawSubtotal * (1 + TAX_RATE));
  const payableTotal   = orderBaseTotal;
  const itemizedUnits  = buildItemizedUnits(cartItems);
  const maxGuests      = Math.max(guestCount, 2);

  /* tender presets */
  const tenderPreset1    = Math.ceil(payableTotal / 10) * 10;
  const tenderPreset2Raw = Math.ceil(payableTotal / 20) * 20;
  const tenderPreset2    = tenderPreset2Raw === tenderPreset1 ? tenderPreset1 + 20 : tenderPreset2Raw;

  /* cash computed */
  const cashDiscountAmount = cashCustomDiscount
    ? cashCustomDiscountMode === "%" ? payableTotal * ((parseFloat(cashCustomDiscountVal) || 0) / 100) : (parseFloat(cashCustomDiscountVal) || 0)
    : cashDiscountIdx !== null ? payableTotal * DISCOUNT_PRESETS[cashDiscountIdx].value : 0;
  const discountedTotal  = payableTotal - cashDiscountAmount;
  const cashTenderAmount = cashCustomTender ? (parseFloat(cashCustomTenderVal) || 0)
    : cashExact ? discountedTotal
    : cashTenderIdx === 0 ? tenderPreset1
    : cashTenderIdx === 1 ? tenderPreset2
    : 0;
  const changeDue = cashTenderAmount > 0 ? cashTenderAmount - discountedTotal : null;

  /* split computed */
  const splitEachPay      = splitType === "even" ? roundCurrency(orderBaseTotal / splitGuestCount) : 0;
  const selectedItemUnits = itemizedUnits.filter((u) => selectedItemUnitIds.has(u.unitId));
  const itemizedSelectedTotal = roundCurrency(selectedItemUnits.reduce((s, u) => s + u.unitTotal, 0) * (1 + TAX_RATE));

  /* gift card computed (defined up here so all gcStep branches can use them) */
  const gcCardBalance = gcResult?.balance || 0;
  const gcTipAmount   = gcTipIdx !== null ? payableTotal * TIP_PRESETS[gcTipIdx].value : 0;
  const gcTotalWithTip  = payableTotal + gcTipAmount;
  const gcMaxApply      = Math.min(gcCardBalance, gcTotalWithTip);
  const gcApplyValue    = gcApplyAmount ? parseFloat(gcApplyAmount) || 0 : gcMaxApply;
  const gcEffectiveApply = Math.min(gcApplyValue, gcMaxApply);
  const gcBalanceAfter   = gcCardBalance - gcEffectiveApply;
  const gcOrderRemaining = gcTotalWithTip - gcEffectiveApply;

  const toggleItem = (id: string) => {
    setSelectedItemUnitIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const showComplete = (paid: number, total: number, change: number | null = null) => {
    setCompletedAmount(paid);
    setCompletedTotal(total);
    setCompletedChange(change);
    setView("complete");
  };

  const splitConfirmDisabled =
    splitType === null ||
    (splitType === "amount" && (() => {
      const v = parseFloat(splitAmountInput);
      return !splitAmountInput || isNaN(v) || v <= 0 || v > orderBaseTotal + 0.01;
    })()) ||
    (splitType === "item" && selectedItemUnits.length === 0);

  /* ── shared panel wrapper — Rules 11/12: standard drawer container */
  // Note: maxH is accepted for backwards compatibility but ignored; all views
  // open at the same standard height (Rule 12). Internal scroll handles overflow.
  const Panel = ({ children }: { children: React.ReactNode; maxH?: string }) => (
    <div
      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
      style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
    >
      {/* Drag handle */}
      <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={onClose}>
        <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
      </div>
      {children}
    </div>
  );

  /* ── shared back header ── */
  const BackHeader = ({ title }: { title: string }) => (
    <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setView("main")}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0 -ml-2"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">{title}</h2>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );

  /* ── fullscreen panel for dedicated payment-method pages ── */
  /* Covers the order summary but leaves the screen's top header visible
     (h-12 = 48px). The parent hides the footer nav while a subview is
     active, so only the close button returns the user to the main view. */
  const FullPanel = ({ children }: { children: React.ReactNode }) => (
    <div className="absolute left-0 right-0 bottom-0 bg-white z-50 flex flex-col overflow-hidden" style={{ top: 48 }}>
      {children}
    </div>
  );

  /* Header for fullscreen subviews — title + X (returns to main view). */
  const FullHeader = ({ title }: { title: string }) => (
    <div className="h-12 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
      <h2 className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">{title}</h2>
      <button
        type="button"
        aria-label="Close"
        onClick={() => setView("main")}
        className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0 -mr-2"
      >
        <X size={18} />
      </button>
    </div>
  );

  /* ════════════════════════════════════
     LEVEL 1 — Main payment buttons
  ════════════════════════════════════ */
  if (view === "main") {
    return (
      <Panel>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">Payment</h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 pb-5">
          <div className="grid grid-cols-2 gap-2.5">
            {mainButtons.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  if (id === "split")    { onSplit(); return; }
                  if (id === "cash")     { setView("cash");   return; }
                  if (id === "credit")   { setCcStep("tap"); setCcTipIdx(null); setView("credit"); return; }
                  if (id === "gift")     { setGcSerial(""); setGcPin(""); setGcStep("input"); setGcResult(null); setGcApplyAmount(""); setGcTipIdx(null); setView("gift"); return; }
                  if (id === "multiple") { onMultiplePayment(); return; }
                  if (id === "print")    { onPrint(); return; }
                }}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 h-11 px-3 text-left text-[13px] font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50">
                <span className="inline-flex h-7 w-7 items-center justify-center text-gray-600 shrink-0">
                  <Icon size={16} />
                </span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  /* ════════════════════════════════════
     LEVEL 2 — Split
  ════════════════════════════════════ */
  if (view === "split") {
    return (
      <Panel maxH="calc(var(--device-height) * 0.78)">
        <BackHeader title="Split Check" />

        <div className="flex justify-between items-baseline px-5 pt-1 pb-3 shrink-0 border-b border-gray-100">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-lg font-semibold text-gray-900">${orderBaseTotal.toFixed(2)}</span>
        </div>

        <div className="px-4 pt-4 shrink-0">
          <span className="text-sm font-medium text-gray-700 mb-2 block">Split Check by</span>
          <div className="flex gap-2">
            {(["even", "amount", "item"] as SplitType[]).map((type) => {
              const label = type === "even" ? "Even" : type === "amount" ? "Amount" : "Item";
              const isSel = splitType === type;
              return (
                <button key={type} type="button" onClick={() => setSplitType(isSel ? null : type)}
                  className="flex-1 h-12 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium"
                  style={{ background: isSel ? "#E8DEF8" : "#F9FAFB", border: isSel ? "1.5px solid #6750A4" : "1.5px solid #E5E7EB", color: isSel ? "#4A3880" : "#374151" }}>
                  {isSel && <Check size={14} strokeWidth={2.5} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {splitType === "even" && (
          <div className="px-4 pt-5 flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Split into guests</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSplitGuestCount(Math.max(2, splitGuestCount - 1))} disabled={splitGuestCount <= 2}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-30 active:bg-gray-100"><Minus size={15} /></button>
                <span className="text-sm font-semibold w-4 text-center">{splitGuestCount}</span>
                <button type="button" onClick={() => setSplitGuestCount(Math.min(maxGuests, splitGuestCount + 1))} disabled={splitGuestCount >= maxGuests}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-30 active:bg-gray-100"><Plus size={15} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Each pays</span>
              <span className="text-sm font-semibold text-gray-900">${splitEachPay.toFixed(2)}</span>
            </div>
          </div>
        )}

        {splitType === "amount" && (
          <div className="px-4 pt-5 flex flex-col gap-3 shrink-0">
            <span className="text-sm font-medium text-gray-700">First payment amount</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">$</span>
              <input ref={splitAmountInputRef} type="text" inputMode="decimal" value={splitAmountInput}
                onChange={(e) => setSplitAmountInput(e.target.value)} placeholder="0.00"
                className="flex-1 h-12 px-3 rounded-xl text-sm focus:outline-none" style={{ border: "1.5px solid #6B7280" }} />
            </div>
            <span className="text-xs text-gray-500">Order total: ${orderBaseTotal.toFixed(2)}</span>
          </div>
        )}

        {splitType === "item" && (
          <div className="px-4 pt-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex justify-between shrink-0">
              <span className="text-sm font-medium text-gray-700">Select items for this check</span>
              <span className="text-xs text-gray-500">{selectedItemUnits.length} selected</span>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50">
              {itemizedUnits.map((unit) => {
                const isSel = selectedItemUnitIds.has(unit.unitId);
                return (
                  <button key={unit.unitId} type="button" onClick={() => toggleItem(unit.unitId)}
                    className="w-full px-3 py-2.5 border-b last:border-b-0 border-gray-100 text-left active:opacity-70"
                    style={{ background: isSel ? "#E8DEF8" : "transparent" }}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 flex items-center justify-center"
                        style={{ width: 20, height: 20, borderRadius: 4, border: isSel ? "none" : "2px solid #9CA3AF", background: isSel ? "#6750A4" : "transparent" }}>
                        {isSel && <Check size={13} color="white" strokeWidth={2.5} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">{unit.name}</span>
                          {unit.unitCount > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500">{unit.unitIndex + 1}/{unit.unitCount}</span>
                          )}
                        </div>
                        <UnitDescription item={unit.source} />
                      </div>
                      <UnitPriceColumn item={unit.source} />
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedItemUnits.length > 0 && (
              <div className="flex justify-between shrink-0 pt-1">
                <span className="text-sm font-medium text-gray-700">Current check total</span>
                <span className="text-sm font-semibold text-gray-900">${itemizedSelectedTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="px-4 pt-4 pb-5 shrink-0">
          <button type="button" disabled={splitConfirmDisabled} onClick={() => { onSplit(); setView("main"); }}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white active:opacity-80 disabled:opacity-40"
            style={{ background: splitConfirmDisabled ? "#CFCFCF" : "#00B618" }}>
            Confirm
          </button>
        </div>
      </Panel>
    );
  }

  /* ════════════════════════════════════
     LEVEL 2 — Cash
  ════════════════════════════════════ */
  if (view === "cash") {
    const cashConfirmDisabled = cashTenderIdx === null && !cashExact && (!cashCustomTender || !cashCustomTenderVal);
    return (
      <FullPanel>
        <FullHeader title="Cash" />

        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
            <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>${discountedTotal.toFixed(2)}</span>
          </div>
          {cashDiscountAmount > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-sm text-[#49454F]">Discount</span>
              <span className="text-sm text-[#49454F]">−${cashDiscountAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="px-4 pb-3 shrink-0">
          <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Cash payment</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-6 pb-4">
          {/* Discount */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Discount</span>
              <span className="text-xs text-[#49454F]">Optional</span>
            </div>
            <div className="flex gap-1.5">
              {DISCOUNT_PRESETS.map((preset, idx) => {
                const isSel = cashDiscountIdx === idx && !cashCustomDiscount;
                return (
                  <button key={preset.label} type="button"
                    onClick={() => { setCashDiscountIdx(cashDiscountIdx === idx ? null : idx); setCashCustomDiscount(false); setCashCustomDiscountVal(""); }}
                    className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                    style={{ background: isSel ? "#E8DEF8" : "#FFF", border: isSel ? "1px solid #515151" : "1px solid #DADADA" }}>
                    <span className="text-sm text-black">{preset.label}</span>
                    {isSel && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
                  </button>
                );
              })}
              <button type="button"
                onClick={() => { if (cashCustomDiscount) { setCashCustomDiscount(false); setCashCustomDiscountVal(""); } else { setCashDiscountIdx(null); setCashCustomDiscount(true); } }}
                className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                style={{ background: cashCustomDiscount ? "#E8DEF8" : "#FFF", border: cashCustomDiscount ? "1px solid #515151" : "1px solid #DADADA" }}>
                <span className="text-sm text-black">Other</span>
                {cashCustomDiscount && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
              </button>
            </div>
            {cashCustomDiscount && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-[#515151] shrink-0">
                  {(["$", "%"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setCashCustomDiscountMode(m)}
                      className="w-10 h-[52px] flex items-center justify-center text-sm font-medium"
                      style={{ background: cashCustomDiscountMode === m ? "#E8DEF8" : "white", color: cashCustomDiscountMode === m ? "#4A4459" : "#79747E" }}>
                      {m}
                    </button>
                  ))}
                </div>
                <input type="text" inputMode="decimal" value={cashCustomDiscountVal}
                  onChange={(e) => setCashCustomDiscountVal(e.target.value)} autoFocus
                  placeholder={cashCustomDiscountMode === "$" ? "0.00" : "0"}
                  className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none" style={{ border: "1px solid #515151" }} />
              </div>
            )}
          </div>

          {/* Tender */}
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Tendered</span>
            <div className="flex gap-1.5">
              {[tenderPreset1, tenderPreset2].map((amount, idx) => {
                const isSel = cashTenderIdx === idx && !cashExact && !cashCustomTender;
                return (
                  <button key={`t${idx}`} type="button"
                    onClick={() => { setCashTenderIdx(idx); setCashExact(false); setCashCustomTender(false); setCashCustomTenderVal(""); }}
                    className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                    style={{ background: isSel ? "#E8DEF8" : "#FFF", border: isSel ? "1px solid #515151" : "1px solid #DADADA" }}>
                    <span className="text-sm text-black">${amount.toFixed(0)}</span>
                    {isSel && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
                  </button>
                );
              })}
              <button type="button"
                onClick={() => { setCashTenderIdx(null); setCashExact(true); setCashCustomTender(false); setCashCustomTenderVal(""); }}
                className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                style={{ background: cashExact ? "#E8DEF8" : "#FFF", border: cashExact ? "1px solid #515151" : "1px solid #DADADA" }}>
                <span className="text-sm text-black">Exact</span>
                {cashExact && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
              </button>
              <button type="button"
                onClick={() => { setCashTenderIdx(null); setCashExact(false); setCashCustomTender(true); }}
                className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                style={{ background: cashCustomTender ? "#E8DEF8" : "#FFF", border: cashCustomTender ? "1px solid #515151" : "1px solid #DADADA" }}>
                <span className="text-sm text-black">Other</span>
                {cashCustomTender && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
              </button>
            </div>
            {cashCustomTender && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-base font-medium">$</span>
                <input type="text" inputMode="decimal" value={cashCustomTenderVal}
                  onChange={(e) => setCashCustomTenderVal(e.target.value)} autoFocus placeholder="0.00"
                  className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none" style={{ border: "1px solid #515151" }} />
              </div>
            )}
          </div>

          {/* Change due */}
          {changeDue !== null && (
            <div className="flex items-center justify-between">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>{changeDue >= 0 ? "Change due" : "Balance due"}</span>
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>${Math.abs(changeDue).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-6 shrink-0">
          <button type="button" disabled={cashConfirmDisabled}
            onClick={() => showComplete(cashTenderAmount, discountedTotal, changeDue)}
            className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40"
            style={{ background: "#00B618" }}>
            <span className="text-base font-medium text-white">
              {cashTenderAmount > 0 ? `Collect $${cashTenderAmount.toFixed(2)}` : "Confirm"}
            </span>
          </button>
        </div>
      </FullPanel>
    );
  }

  /* ════════════════════════════════════
     LEVEL 2 — Credit Card
  ════════════════════════════════════ */
  if (view === "credit") {
    const ccTipAmount    = ccTipIdx !== null ? payableTotal * TIP_PRESETS[ccTipIdx].value : 0;
    const ccTotalWithTip = payableTotal + ccTipAmount;
    return (
      <FullPanel>
        <FullHeader title="Credit Card" />

        <div className="flex justify-between items-baseline px-5 pb-4 shrink-0">
          <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
          <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>${payableTotal.toFixed(2)}</span>
        </div>

        {ccStep === "tap" && (
          <>
            <div className="px-4 shrink-0">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Credit Card</span>
            </div>
            <div className="mx-5 mt-3 mb-5 flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
              style={{ height: 220, borderRadius: 29, border: "1px dashed rgba(0,0,0,0.54)" }}
              onClick={() => {
                setCcStep("processing");
                ccTimerRef.current = setTimeout(() => {
                  setCcStep("processed");
                  ccTimerRef.current = setTimeout(() => setCcStep("tip"), 1200);
                }, 2000);
              }}>
              <div className="flex flex-col items-center gap-6">
                <svg width="100" height="100" viewBox="0 0 48 48" fill="none">
                  <path d="M22.8994 10.0001C26.1921 13.9532 27.9952 18.9353 27.9952 24.0801C27.9952 29.2249 26.1921 34.207 22.8994 38.1601M29.9994 2.84009C35.1515 8.68494 37.9941 16.2087 37.9941 24.0001C37.9941 31.7915 35.1515 39.3152 29.9994 45.1601M15.7794 17.0601C17.2219 19.0905 17.9969 21.5194 17.9969 24.0101C17.9969 26.5007 17.2219 28.9297 15.7794 30.9601"
                    stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium text-black" style={{ fontSize: 22, lineHeight: "28px" }}>Tap to pay</span>
              </div>
            </div>
          </>
        )}

        {ccStep === "processing" && (
          <div className="flex flex-col flex-1 pb-4">
            <div className="flex flex-col items-center justify-center flex-1 gap-6">
              <div className="animate-spin" style={{ width: 80, height: 80, borderRadius: "50%", border: "6px solid #E8DEF8", borderTopColor: "#6750A4" }} />
              <span className="font-semibold text-black" style={{ fontSize: 22 }}>Processing payment</span>
            </div>
            <div className="px-5 w-full">
              <button type="button" className="w-full h-14 rounded-full flex items-center justify-center" style={{ background: "#FFCDD2" }}
                onClick={() => { if (ccTimerRef.current) clearTimeout(ccTimerRef.current); setCcStep("tap"); }}>
                <span className="text-base font-medium" style={{ color: "#B71C1C" }}>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {ccStep === "processed" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 pb-8">
            <Check size={72} strokeWidth={2.5} color="#1D1B20" />
            <span className="font-semibold text-black" style={{ fontSize: 22 }}>Payment processed</span>
          </div>
        )}

        {ccStep === "tip" && (
          <div className="flex flex-col flex-1 pb-5">
            <div className="px-4 mt-2">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Add tip</span>
              <div className="flex gap-1.5 mt-2">
                {TIP_PRESETS.map((preset, idx) => {
                  const isSel = ccTipIdx === idx;
                  return (
                    <button key={preset.label} type="button" onClick={() => setCcTipIdx(isSel ? null : idx)}
                      className="flex-1 h-[52px] rounded-lg flex items-center pl-3 relative"
                      style={{ background: isSel ? "#E8DEF8" : "#FFF", border: isSel ? "1px solid #515151" : "1px solid #DADADA" }}>
                      <span className="text-sm text-black">{preset.label}</span>
                      {isSel && <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setCcTipIdx(null)}
                  className="flex-1 h-[52px] rounded-lg flex items-center pl-3" style={{ background: "#FFF", border: "1px solid #DADADA" }}>
                  <span className="text-sm text-black">Other</span>
                </button>
              </div>
            </div>
            {ccTipIdx !== null && (
              <div className="px-4 mt-4 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-sm text-[#49454F]">Tip ({TIP_PRESETS[ccTipIdx].label})</span>
                  <span className="text-sm text-[#49454F]">${ccTipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-black">Total with tip</span>
                  <span className="text-sm font-medium text-black">${ccTotalWithTip.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="px-5 mt-auto pt-6 flex flex-col gap-3">
              <button type="button" className="w-full h-14 rounded-full flex items-center justify-center bg-[#00B618] active:opacity-80"
                onClick={() => showComplete(ccTotalWithTip, ccTotalWithTip)}>
                <span className="text-base font-medium text-white">Confirm Tip</span>
              </button>
              <button type="button" className="w-full h-12 flex items-center justify-center active:opacity-60"
                onClick={() => showComplete(payableTotal, payableTotal)}>
                <span className="text-base font-semibold text-black">Skip Tip</span>
              </button>
            </div>
          </div>
        )}
      </FullPanel>
    );
  }

  /* ════════════════════════════════════
     LEVEL 2 — Gift Card
  ════════════════════════════════════ */
  if (view === "gift") {
    return (
      <FullPanel>
        <FullHeader title="Gift Card" />

        <div className="flex justify-between items-baseline px-5 pb-4 shrink-0">
          <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
          <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>${payableTotal.toFixed(2)}</span>
        </div>

        {gcStep === "input" && (
          <div className="px-4 mt-2 flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Gift Card</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#49454F" }}>Serial number</label>
              <input ref={gcSerialRef} type="text" inputMode="text" autoComplete="off" value={gcSerial}
                onChange={(e) => setGcSerial(e.target.value)} placeholder="Enter serial number"
                className="h-[52px] px-3 rounded-lg text-sm focus:outline-none" style={{ border: "1px solid #515151" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#49454F" }}>PIN</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={6}
                value={gcPin} onChange={(e) => setGcPin(e.target.value.replace(/\D/g, ""))} placeholder="4-6 digit PIN"
                className="h-[44px] w-40 px-3 rounded-lg text-sm focus:outline-none" style={{ border: "1px solid #515151" }} />
            </div>
            {gcResult && !gcResult.success && (
              <span className="text-sm text-red-600 font-medium">{gcResult.message}</span>
            )}
          </div>
        )}

        {(gcStep === "processing" || gcStep === "applying") && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16">
            <div className="animate-spin" style={{ width: 60, height: 60, borderRadius: "50%", border: "5px solid #E8DEF8", borderTopColor: "#6750A4" }} />
            <span className="font-semibold text-black" style={{ fontSize: 18 }}>
              {gcStep === "processing" ? "Verifying gift card..." : "Applying gift card..."}
            </span>
          </div>
        )}

        {gcStep === "balance" && gcResult?.success && (
          <div className="px-4 mt-3 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Card balance</span>
              <span className="text-base font-semibold" style={{ color: "#00B618" }}>${gcCardBalance.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Add tip</span>
              <div className="flex gap-1.5">
                {TIP_PRESETS.map((preset, idx) => {
                  const isSel = gcTipIdx === idx;
                  return (
                    <button key={preset.label} type="button" onClick={() => setGcTipIdx(isSel ? null : idx)}
                      className="flex-1 h-[44px] rounded-lg flex items-center pl-3 relative"
                      style={{ background: isSel ? "#E8DEF8" : "#FFF", border: isSel ? "1px solid #515151" : "1px solid #DADADA" }}>
                      <span className="text-sm text-black">{preset.label}</span>
                      {isSel && <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />}
                    </button>
                  );
                })}
              </div>
              {gcTipIdx !== null && (
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-[#49454F]">Tip ({TIP_PRESETS[gcTipIdx].label})</span>
                  <span className="text-sm text-[#49454F]">${gcTipAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Amount to apply</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">$</span>
                <input type="text" inputMode="decimal" value={gcApplyAmount || gcMaxApply.toFixed(2)}
                  onChange={(e) => setGcApplyAmount(e.target.value)}
                  className="flex-1 h-[44px] px-3 rounded-lg text-sm focus:outline-none" style={{ border: "1px solid #515151" }} />
              </div>
              <span className="text-xs text-[#49454F]">Max: ${gcMaxApply.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
              <div className="flex justify-between">
                <span className="text-sm text-[#49454F]">Card balance after</span>
                <span className="text-sm text-[#49454F]">${gcBalanceAfter.toFixed(2)}</span>
              </div>
              {gcOrderRemaining > 0.01 && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium" style={{ color: "#B71C1C" }}>Remaining to pay</span>
                  <span className="text-sm font-medium" style={{ color: "#B71C1C" }}>${gcOrderRemaining.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {gcStep === "done" && gcResult?.success && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-10">
            <div className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: "50%", background: "#00B618" }}>
              <Check size={32} color="white" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-black" style={{ fontSize: 18 }}>Gift card applied</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm text-[#49454F]">Amount charged: ${gcEffectiveApply.toFixed(2)}</span>
              {gcTipAmount > 0 && <span className="text-sm text-[#49454F]">Includes tip: ${gcTipAmount.toFixed(2)}</span>}
              <span className="text-sm text-[#49454F]">Remaining card balance: ${gcBalanceAfter.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="px-5 pt-4 pb-5 shrink-0">
          {gcStep === "input" && (
            <button type="button" disabled={!gcSerial.trim() || gcPin.length < 4}
              onClick={() => {
                setGcStep("processing"); setGcResult(null);
                setTimeout(() => {
                  const card = MOCK_GIFT_CARDS[gcSerial.toLowerCase().trim()];
                  if (card && card.pin === gcPin) {
                    setGcResult({ success: true, balance: card.balance, message: "Gift card verified" });
                    setGcApplyAmount(""); setGcTipIdx(null); setGcStep("balance");
                  } else {
                    setGcResult({ success: false, message: card ? "Invalid PIN" : "Gift card not found" });
                    setGcStep("input");
                  }
                }, 1500);
              }}
              className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ background: "#00B618" }}>
              <span className="text-base font-medium text-white">Verify Gift Card</span>
            </button>
          )}
          {gcStep === "balance" && gcResult?.success && (
            <button type="button" disabled={gcEffectiveApply <= 0}
              onClick={() => { setGcStep("applying"); setTimeout(() => setGcStep("done"), 1200); }}
              className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40"
              style={{ background: "#00B618" }}>
              <span className="text-base font-medium text-white">Apply ${gcEffectiveApply.toFixed(2)}</span>
            </button>
          )}
          {gcStep === "done" && gcResult?.success && (
            <button type="button"
              onClick={() => {
                if (gcOrderRemaining < 0.01) {
                  showComplete(gcEffectiveApply, gcTotalWithTip);
                } else {
                  setView("main");
                }
              }}
              className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80"
              style={{ background: "#00B618" }}>
              <span className="text-base font-medium text-white">
                {gcOrderRemaining < 0.01 ? "Done" : "Continue to remaining balance"}
              </span>
            </button>
          )}
        </div>
      </FullPanel>
    );
  }

  /* ════════════════════════════════════
     Payment Complete
  ════════════════════════════════════ */
  return (
    <FullPanel>
      <div className="flex justify-between items-baseline px-5 pt-5 shrink-0">
        <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
        <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>${completedTotal.toFixed(2)}</span>
      </div>

      {completedChange !== null && completedChange >= 0 && (
        <div className="px-5 mt-2 flex justify-between shrink-0">
          <span className="text-base font-medium" style={{ color: "#1D1B20" }}>Change due</span>
          <span className="text-base font-medium" style={{ color: "#1D1B20" }}>${completedChange.toFixed(2)}</span>
        </div>
      )}

      <div className="flex flex-col items-center mt-6 gap-4 shrink-0">
        <div className="flex items-center justify-center" style={{ width: 89, height: 89, borderRadius: "50%", background: "#00B618" }}>
          <Check size={44} color="white" strokeWidth={2.5} />
        </div>
        <span className="font-medium text-black" style={{ fontSize: 24, lineHeight: "32px" }}>Payment complete</span>
      </div>

      <div className="px-5 mt-8 shrink-0">
        <button type="button" className="w-full h-14 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: "#F3F3F3", border: "1px solid #D8D8D8" }}>
          <span className="text-base font-medium text-black">Print receipt</span>
        </button>
      </div>

      <div className="px-5 mt-3 pb-6 shrink-0">
        <button type="button" onClick={onPaymentComplete}
          className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80"
          style={{ background: "#00B618" }}>
          <span className="text-base font-medium text-white">Close order</span>
        </button>
      </div>
    </FullPanel>
  );
}
