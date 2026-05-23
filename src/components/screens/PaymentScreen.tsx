"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronRight, ChevronDown, Check, Minus, Plus, Pencil, MoreHorizontal, DollarSign, Percent, Delete, MoreHorizontal as Ellipsis, Calculator } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useOrderStore } from "@/store/order-store";
import Header from "@/components/ui/Header";
import staffData from "@/data/staff.json";
import tablesData from "@/data/tables.json";
import type { CartItem, Staff, Table } from "@/lib/types";

const TAX_RATE = 0.0875; // 8.75% tax
const TIP_PRESETS = [
  { label: "15%", value: 0.15 },
  { label: "18%", value: 0.18 },
  { label: "20%", value: 0.20 },
];
const DISCOUNT_PRESETS = [
  { label: "-3%", value: 0.03 },
  { label: "-5%", value: 0.05 },
];

// Mock gift card database for demo
const MOCK_GIFT_CARDS: Record<string, { pin: string; balance: number }> = {
  abc1234: { pin: "1234", balance: 150.0 },
};

type SplitType = "even" | "amount" | "item";
type ConfirmedSplit =
  | { type: "even"; guests: number }
  | { type: "amount" }
  | { type: "item" };

interface ItemizedUnit {
  unitId: string;
  cartItemId: string;
  name: string;
  unitIndex: number;
  unitCount: number;
  unitTotal: number;
  modifiers: string[];
  comboSelections: string[];
  note?: string;
  breakline?: boolean;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function buildItemizedUnits(items: CartItem[]): ItemizedUnit[] {
  return items.flatMap((item) => {
    const totalCents = Math.round(item.totalPrice * 100);
    const baseCents = Math.floor(totalCents / item.quantity);
    const remainderCents = totalCents - baseCents * item.quantity;
    const modifiers = item.modifiers.flatMap((group) =>
      group.modifiers.map((modifier) => modifier.name)
    );
    const comboSelections = (item.comboSelections || []).map((selection) => {
      const modifierNames = selection.modifiers.flatMap((group) =>
        group.modifiers.map((modifier) => modifier.name)
      );

      return modifierNames.length > 0
        ? `${selection.component.name} (${modifierNames.join(", ")})`
        : selection.component.name;
    });

    return Array.from({ length: item.quantity }, (_, unitIndex) => ({
      unitId: `${item.id}:${unitIndex}`,
      cartItemId: item.id,
      name: item.name,
      unitIndex,
      unitCount: item.quantity,
      unitTotal: (baseCents + (unitIndex < remainderCents ? 1 : 0)) / 100,
      modifiers,
      comboSelections,
      note: item.note,
      breakline: item.breakline,
    }));
  });
}

export default function PaymentScreen({ onClose: externalClose }: { onClose?: () => void } = {}) {
  const { cartItems, cartTotal, cartCount, guestCount, selectedTable, currentStaff, setScreen, resetOrder, setStaff, setTable } =
    useOrderStore();

  const goBack = externalClose ?? (() => setScreen("check"));

  const giftCardDrag = useDragControls();
  const splitDrag = useDragControls();
  const ccDrag = useDragControls();
  const tipDrag = useDragControls();
  const cashDrag = useDragControls();
  const completeDrag = useDragControls();

  const [showItems, setShowItems] = useState(false);
  const [tip, setTip] = useState(0);
  const [showTipDrawer, setShowTipDrawer] = useState(false);
  const [selectedTipPreset, setSelectedTipPreset] = useState<number | null>(null);
  const [customTipValue, setCustomTipValue] = useState("");
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [customTipMode, setCustomTipMode] = useState<"$" | "%">("$");

  // Cash drawer state
  const [showCashDrawer, setShowCashDrawer] = useState(false);
  const [showCreditCardDrawer, setShowCreditCardDrawer] = useState(false);
  // CC payment flow: tap → processing → processed → tip
  const [ccStep, setCcStep] = useState<"tap" | "processing" | "processed" | "tip">("tap");
  const [ccTipIdx, setCcTipIdx] = useState<number | null>(null);
  const ccTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPaymentComplete, setShowPaymentComplete] = useState(false);
  const [showLeaveToast, setShowLeaveToast] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [numpadMode, setNumpadMode] = useState<"pay" | "discount" | "tips" | "taxExempt" | "priceOverride">("pay");
  const [discountUnit, setDiscountUnit] = useState<"percent" | "amount">("percent");
  const [tipsUnit, setTipsUnit] = useState<"percent" | "amount">("percent");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);
  const [totalSettled, setTotalSettled] = useState(0);
  const [pendingCashAfterTip, setPendingCashAfterTip] = useState(false);
  const [selectedDiscountIdx, setSelectedDiscountIdx] = useState<number | null>(null);
  const [isCustomDiscount, setIsCustomDiscount] = useState(false);
  const [customDiscountValue, setCustomDiscountValue] = useState("");
  const [customDiscountMode, setCustomDiscountMode] = useState<"$" | "%">("$");
  const [selectedTenderIdx, setSelectedTenderIdx] = useState<number | null>(null);
  const [isExactTender, setIsExactTender] = useState(false);
  const [isCustomTender, setIsCustomTender] = useState(false);
  const [customTenderValue, setCustomTenderValue] = useState("");

  // Split check state
  const [showSplitDrawer, setShowSplitDrawer] = useState(false);
  const [splitType, setSplitType] = useState<SplitType | null>(null);
  const [splitGuestCount, setSplitGuestCount] = useState(2);
  // Confirmed split state (persists after drawer closes)
  const [confirmedSplit, setConfirmedSplit] = useState<ConfirmedSplit | null>(null);
  const [activeGuestIdx, setActiveGuestIdx] = useState(0);
  const [paidGuests, setPaidGuests] = useState<Set<number>>(new Set());
  // Amount split state
  const [splitAmountInput, setSplitAmountInput] = useState("");
  const [splitAmountCurrent, setSplitAmountCurrent] = useState(0); // current payment amount for amount split
  const [splitAmountPayments, setSplitAmountPayments] = useState<number[]>([]); // completed payments
  const splitAmountInputRef = useRef<HTMLInputElement>(null);
  const [selectedItemUnitIds, setSelectedItemUnitIds] = useState<Set<string>>(new Set());
  const [paidItemUnitIds, setPaidItemUnitIds] = useState<Set<string>>(new Set());
  const [lastItemizedPayment, setLastItemizedPayment] = useState<{
    paidCount: number;
    remainingCount: number;
    remainingTotal: number;
  } | null>(null);

  // Gift card state
  const [showGiftCardDrawer, setShowGiftCardDrawer] = useState(false);
  const [gcSerial, setGcSerial] = useState("");
  const [gcPin, setGcPin] = useState("");
  const [gcStep, setGcStep] = useState<"input" | "processing" | "balance" | "applying" | "done">("input");
  const [gcResult, setGcResult] = useState<{ success: boolean; balance?: number; message: string } | null>(null);
  const [gcApplyAmount, setGcApplyAmount] = useState("");
  const [gcTipIdx, setGcTipIdx] = useState<number | null>(null);
  const gcSerialRef = useRef<HTMLInputElement>(null);

  // Cumulative payment tracking (for partial payments like gift card)
  const [cumulativePaid, setCumulativePaid] = useState(0);

  // Order-level action states
  const orderActionPanelRef = useRef<HTMLDivElement>(null);
  const orderActionButtonsRef = useRef<HTMLDivElement>(null);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const [orderComped, setOrderComped] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState<{ type: "percent" | "amount"; value: number } | null>(null);
  const [showOrderDiscountPanel, setShowOrderDiscountPanel] = useState(false);
  const [orderDiscountMode, setOrderDiscountMode] = useState<"percent" | "amount">("percent");
  const [orderDiscountInput, setOrderDiscountInput] = useState("");
  const [orderPriceOverride, setOrderPriceOverride] = useState<number | null>(null);
  const [showOrderPriceOverridePanel, setShowOrderPriceOverridePanel] = useState(false);
  const [orderPriceOverrideInput, setOrderPriceOverrideInput] = useState("");

  // Auto-scroll to show action buttons or numpad panel when they open
  useEffect(() => {
    if (showOrderDiscountPanel || showOrderPriceOverridePanel) {
      setTimeout(() => {
        orderActionPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 50);
    } else if (showOrderActions) {
      setTimeout(() => {
        orderActionButtonsRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 50);
    }
  }, [showOrderActions, showOrderDiscountPanel, showOrderPriceOverridePanel]);

  const itemizedUnits = buildItemizedUnits(cartItems);
  const unpaidItemUnits = itemizedUnits.filter((unit) => !paidItemUnitIds.has(unit.unitId));
  const selectedItemUnits = itemizedUnits.filter(
    (unit) => selectedItemUnitIds.has(unit.unitId) && !paidItemUnitIds.has(unit.unitId)
  );
  const itemizedSelectedSubtotal = roundCurrency(
    selectedItemUnits.reduce((sum, unit) => sum + unit.unitTotal, 0)
  );
  const itemizedSelectedBaseTotal = roundCurrency(itemizedSelectedSubtotal * (1 + TAX_RATE));
  const itemizedRemainingSubtotal = roundCurrency(
    unpaidItemUnits.reduce((sum, unit) => sum + unit.unitTotal, 0)
  );
  const itemizedRemainingBaseTotal = roundCurrency(itemizedRemainingSubtotal * (1 + TAX_RATE));
  const itemizedSelectedCount = selectedItemUnits.length;
  const itemizedRemainingCount = unpaidItemUnits.length;

  const rawSubtotal = cartTotal();
  // Apply order-level adjustments
  const adjustedSubtotal = orderComped
    ? 0
    : orderPriceOverride != null
      ? orderPriceOverride
      : orderDiscount
        ? orderDiscount.type === "percent"
          ? roundCurrency(rawSubtotal * (1 - orderDiscount.value / 100))
          : roundCurrency(Math.max(0, rawSubtotal - orderDiscount.value))
        : rawSubtotal;
  const subtotal = adjustedSubtotal;
  const tax = taxExempt ? 0 : subtotal * TAX_RATE;
  const orderBaseTotal = subtotal + tax;
  const total = orderBaseTotal + tip;
  const itemCount = confirmedSplit?.type === "item" ? itemizedSelectedCount : cartCount();

  // Split check computed values
  const splitAmountPaidSoFar = splitAmountPayments.reduce((s, v) => s + v, 0);
  const splitAmountRemaining = orderBaseTotal - splitAmountPaidSoFar;
  const splitEachPay = confirmedSplit
    ? confirmedSplit.type === "even"
      ? roundCurrency(orderBaseTotal / confirmedSplit.guests)
      : confirmedSplit.type === "amount"
        ? splitAmountCurrent
        : itemizedSelectedBaseTotal
    : orderBaseTotal;
  const splitDrawerEachPay = splitType === "even"
    ? roundCurrency(orderBaseTotal / splitGuestCount)
    : 0;

  // The effective total for payment (per-guest when split, full otherwise)
  const payableTotal = roundCurrency((confirmedSplit ? splitEachPay : orderBaseTotal) + tip);

  // Per-guest subtotal base for tip calculation
  const tipBaseSubtotal = confirmedSplit
    ? confirmedSplit.type === "even"
      ? roundCurrency(subtotal / confirmedSplit.guests)
      : confirmedSplit.type === "amount"
        ? orderBaseTotal > 0
          ? roundCurrency(subtotal * (splitAmountCurrent / orderBaseTotal))
          : 0
        : itemizedSelectedSubtotal
    : subtotal;
  const displaySubtotal = confirmedSplit ? tipBaseSubtotal : subtotal;
  const displayTax = confirmedSplit ? roundCurrency(splitEachPay - tipBaseSubtotal) : tax;
  const displayTotal = payableTotal;
  const remainingBalance = confirmedSplit?.type === "item"
    ? itemizedRemainingBaseTotal
    : Math.max(0, payableTotal - cumulativePaid);

  // Tender presets computed from payable total
  const tenderPreset1 = Math.ceil(payableTotal / 10) * 10;
  const tenderPreset2Raw = Math.ceil(payableTotal / 20) * 20;
  const tenderPreset2 = tenderPreset2Raw === tenderPreset1 ? tenderPreset1 + 20 : tenderPreset2Raw;

  // Cash drawer computed values
  const cashDiscountAmount =
    isCustomDiscount
      ? customDiscountMode === "%"
        ? payableTotal * ((parseFloat(customDiscountValue) || 0) / 100)
        : (parseFloat(customDiscountValue) || 0)
      : selectedDiscountIdx !== null
        ? payableTotal * DISCOUNT_PRESETS[selectedDiscountIdx].value
        : 0;
  const discountedTotal = payableTotal - cashDiscountAmount;

  const cashTenderAmount =
    isCustomTender
      ? (parseFloat(customTenderValue) || 0)
      : isExactTender
        ? discountedTotal
        : selectedTenderIdx === 0
          ? tenderPreset1
          : selectedTenderIdx === 1
            ? tenderPreset2
            : 0;

  const changeDue = cashTenderAmount > 0 ? cashTenderAmount - discountedTotal : null;

  const openCashDrawerDirect = () => {
    setSelectedDiscountIdx(null);
    setIsCustomDiscount(false);
    setCustomDiscountValue("");
    setCustomDiscountMode("$");
    setSelectedTenderIdx(null);
    setIsExactTender(false);
    setIsCustomTender(false);
    setCustomTenderValue("");
    setShowCashDrawer(true);
  };

  const handleOpenCashDrawer = () => {
    if (tip === 0) {
      // Show tip drawer first, then transition to cash drawer
      setPendingCashAfterTip(true);
      handleOpenTipDrawer();
    } else {
      openCashDrawerDirect();
    }
  };

  // Tip drawer handlers
  const handleOpenTipDrawer = () => {
    if (tip > 0) {
      const matchedIdx = TIP_PRESETS.findIndex(
        (p) => Math.abs(tipBaseSubtotal * p.value - tip) < 0.01
      );
      if (matchedIdx >= 0) {
        setSelectedTipPreset(matchedIdx);
        setIsCustomTip(false);
        setCustomTipValue("");
      } else {
        setSelectedTipPreset(null);
        setIsCustomTip(true);
        setCustomTipValue(tip.toFixed(2));
      }
    } else {
      setSelectedTipPreset(null);
      setIsCustomTip(false);
      setCustomTipValue("");
    }
    setShowTipDrawer(true);
  };

  const handleSelectPreset = (index: number) => {
    setSelectedTipPreset(index);
    setIsCustomTip(false);
    setCustomTipValue("");
  };

  const handleSelectCustom = () => {
    setSelectedTipPreset(null);
    setIsCustomTip(true);
  };

  const handleAddTip = () => {
    if (isCustomTip) {
      const parsed = parseFloat(customTipValue);
      if (!isNaN(parsed) && parsed > 0) {
        setTip(customTipMode === "%" ? tipBaseSubtotal * (parsed / 100) : parsed);
      } else {
        setTip(0);
      }
    } else if (selectedTipPreset !== null) {
      setTip(tipBaseSubtotal * TIP_PRESETS[selectedTipPreset].value);
    }
    setShowTipDrawer(false);
    if (pendingCashAfterTip) {
      setPendingCashAfterTip(false);
      // Small delay to let tip drawer animate out before opening cash drawer
      setTimeout(() => openCashDrawerDirect(), 300);
    }
  };

  const handleNoTip = () => {
    setTip(0);
    setSelectedTipPreset(null);
    setIsCustomTip(false);
    setCustomTipValue("");
    setShowTipDrawer(false);
    if (pendingCashAfterTip) {
      setPendingCashAfterTip(false);
      setTimeout(() => openCashDrawerDirect(), 300);
    }
  };

  const hasOutstandingBalance = totalSettled > 0 && totalSettled < orderBaseTotal - 0.01;

  const outstandingAmount = roundCurrency(Math.max(0, orderBaseTotal - totalSettled));

  const handleClose = () => {
    if (hasOutstandingBalance) {
      setShowLeaveToast(true);
      return;
    }
    goBack();
  };

  const resetItemizedSplitState = () => {
    setSelectedItemUnitIds(new Set());
    setPaidItemUnitIds(new Set());
    setLastItemizedPayment(null);
  };

  const toggleItemSelection = (unitId: string) => {
    setSelectedItemUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const recordSuccessfulPayment = (amount: number, settledTotal: number) => {
    setPaidAmount(amount);
    setPaidTotal(settledTotal);
    setTotalSettled((prev) => prev + settledTotal);

    if (confirmedSplit?.type === "even") {
      setPaidGuests((prev) => {
        const next = new Set(prev);
        next.add(activeGuestIdx);
        return next;
      });
    }

    if (confirmedSplit?.type === "item") {
      const nextPaidIds = new Set(paidItemUnitIds);
      selectedItemUnitIds.forEach((unitId) => nextPaidIds.add(unitId));
      const remainingUnits = itemizedUnits.filter((unit) => !nextPaidIds.has(unit.unitId));

      setPaidItemUnitIds(nextPaidIds);
      setLastItemizedPayment({
        paidCount: selectedItemUnits.length,
        remainingCount: remainingUnits.length,
        remainingTotal: roundCurrency(
          remainingUnits.reduce((sum, unit) => sum + unit.unitTotal * (1 + TAX_RATE), 0)
        ),
      });
    }

    setShowPaymentComplete(true);
  };

  // Compute preview tip for tip drawer total
  const previewTip = isCustomTip
    ? (() => {
        const parsed = parseFloat(customTipValue) || 0;
        return customTipMode === "%" ? tipBaseSubtotal * (parsed / 100) : parsed;
      })()
    : selectedTipPreset !== null
    ? tipBaseSubtotal * TIP_PRESETS[selectedTipPreset].value
    : 0;
  const drawerTotal = payableTotal + previewTip;

  // Amount input helpers for the numpad
  const displayAmountValue = (parseInt(amountInput || "0") / 100).toFixed(2);
  const handleNumpadKey = (key: string) => {
    if (key === "backspace") {
      setAmountInput((v) => v.slice(0, -1));
    } else if (key === "00") {
      setAmountInput((v) => {
        const next = v + "00";
        return next.length > 8 ? v : next;
      });
    } else {
      setAmountInput((v) => {
        const next = v + key;
        return next.length > 8 ? v : next;
      });
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-white">
      {/* Header */}
      <Header
        onBack={handleClose}
        serverName={currentStaff?.name}
        tableName={selectedTable?.name}
        guestCount={guestCount}
        onGuestCountTap={() => setScreen("guest-count")}
        onTableTap={() => setScreen("tables")}
        onLogout={() => { resetOrder(); setScreen("login"); }}
        onTransfer={(staff) => setStaff(staff)}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
        onTransferTable={(table) => setTable(table)}
        onVoidOrder={() => { resetOrder(); setScreen("tables"); }}
        tableList={tablesData as Table[]}
        currentTableId={selectedTable?.id}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Expanded item list */}
        {showItems && (
          <div className="border-t border-gray-100 bg-[var(--surface)]">
            {confirmedSplit?.type === "item" ? (
              selectedItemUnits.length > 0 ? (
                selectedItemUnits.map((unit) => (
                  <div key={unit.unitId} className={unit.breakline ? "" : "border-b border-gray-100"}>
                    <div className="flex justify-between px-4 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">1x</span>
                          <span className="text-sm">{unit.name}</span>
                          {unit.unitCount > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[var(--outline)]">
                              {unit.unitIndex + 1}/{unit.unitCount}
                            </span>
                          )}
                        </div>
                        {unit.modifiers.length > 0 && (
                          <p className="text-xs text-[var(--outline)] ml-5">{unit.modifiers.join(", ")}</p>
                        )}
                        {unit.comboSelections.length > 0 && (
                          <p className="text-xs text-[var(--outline)] ml-5">{unit.comboSelections.join(" · ")}</p>
                        )}
                        {unit.note && (
                          <p className="text-xs text-[var(--primary)] italic ml-5">Note: {unit.note}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium shrink-0 ml-2">${unit.unitTotal.toFixed(2)}</span>
                    </div>
                    {unit.breakline && (
                      <div className="mx-4 mt-0.5 mb-0" style={{ height: 3, borderRadius: 2, background: "var(--foreground)" }} />
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-[var(--outline)]">
                  Select items in Split to create the current itemized checkout.
                </div>
              )
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className={item.breakline ? "" : "border-b border-gray-100"}>
                  <div className="flex justify-between px-4 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{item.quantity}x</span>
                        <span className="text-sm">{item.name}</span>
                      </div>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-[var(--outline)] ml-5">
                          {item.modifiers
                            .flatMap((g) => g.modifiers.map((m) => m.name))
                            .join(", ")}
                        </p>
                      )}
                      {item.comboSelections && item.comboSelections.length > 0 && (
                        <p className="text-xs text-[var(--outline)] ml-5">
                          {item.comboSelections
                            .map((s) => {
                              const modNames = s.modifiers
                                .flatMap((g) => g.modifiers.map((m) => m.name));
                              return modNames.length > 0
                                ? `${s.component.name} (${modNames.join(", ")})`
                                : s.component.name;
                            })
                            .join(" · ")}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs text-[var(--primary)] italic ml-5">
                          Note: {item.note}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      {(item.comped || item.discount || item.priceOverride != null) && (
                        <span className="text-[10px] line-through text-[var(--outline)]">
                          ${((item.basePrice + item.modifiers.reduce((s, g) => s + g.modifiers.reduce((s2, m) => s2 + m.price, 0), 0)) * item.quantity).toFixed(2)}
                        </span>
                      )}
                      {item.comped ? (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#E8DEF8] text-[#6750A4]">COMP</span>
                      ) : item.discount ? (
                        <span className="text-sm font-medium text-[#6750A4]">
                          ${item.totalPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm font-medium">
                          ${item.totalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.breakline && (
                    <div className="mx-4 mt-0.5 mb-0" style={{ height: 3, borderRadius: 2, background: "var(--foreground)" }} />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="border-t border-[var(--outline-variant)]" />

        {/* Price breakdown */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm">Subtotal</span>
            <div className="flex items-center gap-1.5">
              {(orderComped || orderDiscount || orderPriceOverride != null) && (
                <span className="text-xs line-through text-[var(--outline)]">
                  ${(confirmedSplit ? tipBaseSubtotal : rawSubtotal).toFixed(2)}
                </span>
              )}
              <span className={`text-sm font-medium ${(orderComped || orderDiscount || orderPriceOverride != null) ? "text-[#6750A4]" : ""}`}>
                ${displaySubtotal.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Tax{taxExempt ? " (Exempt)" : ""}</span>
            <span className={`text-sm font-medium ${taxExempt ? "text-[#6750A4]" : ""}`}>${displayTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Tip</span>
            {tip > 0 ? (
              <button
                onClick={handleOpenTipDrawer}
                className="text-sm font-medium text-[var(--primary)] active:opacity-70"
              >
                ${tip.toFixed(2)}
              </button>
            ) : (
              <button
                onClick={handleOpenTipDrawer}
                className="px-3 py-1 rounded-full border border-[var(--outline-variant)] text-xs font-medium active:bg-[var(--surface)]"
              >
                Add tips
              </button>
            )}
          </div>

          {/* Order-level adjustments display */}
          {orderComped && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6750A4] font-medium">Order Comped</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#E8DEF8] text-[#6750A4]">COMP</span>
            </div>
          )}
          {orderDiscount && !orderComped && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6750A4] font-medium">Order Discount</span>
              <span className="text-sm font-medium text-green-600">
                {orderDiscount.type === "percent" ? `-${orderDiscount.value}%` : `-$${orderDiscount.value.toFixed(2)}`}
              </span>
            </div>
          )}
          {orderPriceOverride != null && !orderComped && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6750A4] font-medium">Price Override</span>
              <span className="text-sm font-medium text-[#6750A4]">${orderPriceOverride.toFixed(2)}</span>
            </div>
          )}
          {taxExempt && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6750A4] font-medium">Tax Exempt</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#E8DEF8] text-[#6750A4]">EXEMPT</span>
            </div>
          )}

          <div className="h-px bg-gray-100 !mt-4" />

          <div className="flex justify-between items-center !mt-4">
            <span className="text-base font-semibold">Total</span>
            <span className="text-base font-bold">${displayTotal.toFixed(2)}</span>
          </div>

          {/* Order-level action buttons */}
          {showOrderActions && !showOrderDiscountPanel && !showOrderPriceOverridePanel && (
            <div ref={orderActionButtonsRef} className="flex gap-2 flex-wrap !mt-2">
              <button
                onClick={() => {
                  setOrderDiscountInput(orderDiscount ? String(orderDiscount.value) : "");
                  setOrderDiscountMode(orderDiscount?.type || "percent");
                  setShowOrderDiscountPanel(true);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                style={
                  orderDiscount
                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                }
              >
                Discount
              </button>
              <button
                onClick={() => {
                  setOrderPriceOverrideInput(orderPriceOverride != null ? String(orderPriceOverride) : "");
                  setShowOrderPriceOverridePanel(true);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                style={
                  orderPriceOverride != null
                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                }
              >
                Price Override
              </button>
              <button
                onClick={() => {
                  setTaxExempt(!taxExempt);
                  setShowOrderActions(false);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                style={
                  taxExempt
                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                }
              >
                Tax Exempt
              </button>
            </div>
          )}

          {/* Order-level discount panel */}
          {showOrderDiscountPanel && (() => {
            const previewValue = parseFloat(orderDiscountInput || "0");
            const previewTotal = orderDiscountMode === "percent"
              ? rawSubtotal * (1 - (isNaN(previewValue) ? 0 : previewValue) / 100)
              : Math.max(0, rawSubtotal - (isNaN(previewValue) ? 0 : previewValue));
            const savings = rawSubtotal - previewTotal;
            return (
              <div ref={orderActionPanelRef} className="!mt-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline-variant)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="flex rounded-lg border border-[var(--outline-variant)] overflow-hidden shrink-0">
                    <button
                      onClick={() => { setOrderDiscountMode("percent"); setOrderDiscountInput(""); }}
                      className="w-9 h-9 flex items-center justify-center transition-colors"
                      style={orderDiscountMode === "percent" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                    >
                      <Percent size={14} />
                    </button>
                    <button
                      onClick={() => { setOrderDiscountMode("amount"); setOrderDiscountInput(""); }}
                      className="w-9 h-9 flex items-center justify-center border-l border-[var(--outline-variant)] transition-colors"
                      style={orderDiscountMode === "amount" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                    >
                      <DollarSign size={14} />
                    </button>
                  </div>
                  {orderDiscountMode === "percent"
                    ? [10, 20].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setOrderDiscountInput(String(pct))}
                        className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                        style={
                          orderDiscountInput === String(pct)
                            ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                            : { borderColor: "var(--outline-variant)" }
                        }
                      >
                        {pct}%
                      </button>
                    ))
                    : [5, 10].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setOrderDiscountInput(String(amt))}
                        className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                        style={
                          orderDiscountInput === String(amt)
                            ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                            : { borderColor: "var(--outline-variant)" }
                        }
                      >
                        ${amt}
                      </button>
                    ))
                  }
                </div>
                {/* Preview */}
                <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-white">
                  <span className="text-xs text-[var(--outline)]">Savings</span>
                  <span className="text-sm font-semibold text-green-600">
                    -${(isNaN(savings) ? 0 : savings).toFixed(2)}
                  </span>
                </div>
                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === "⌫") {
                          setOrderDiscountInput((v) => v.slice(0, -1));
                        } else if (key === ".") {
                          if (!orderDiscountInput.includes(".")) setOrderDiscountInput((v) => v + ".");
                        } else {
                          const dotIdx = orderDiscountInput.indexOf(".");
                          if (dotIdx !== -1 && orderDiscountInput.length - dotIdx > 2) return;
                          setOrderDiscountInput((v) => v + key);
                        }
                      }}
                      className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setOrderDiscount(null);
                      setOrderDiscountInput("");
                      setShowOrderDiscountPanel(false);
                      setShowOrderActions(false);
                    }}
                    className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-white"
                  >
                    {orderDiscount ? "RESET" : "Cancel"}
                  </button>
                  <button
                    onClick={() => {
                      const val = parseFloat(orderDiscountInput);
                      if (!isNaN(val) && val > 0) {
                        setOrderDiscount({ type: orderDiscountMode, value: val });
                        setOrderPriceOverride(null);
                        setOrderComped(false);
                      }
                      setShowOrderDiscountPanel(false);
                      setShowOrderActions(false);
                    }}
                    className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                    style={{ background: "#6750A4" }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Order-level price override panel */}
          {showOrderPriceOverridePanel && (
            <div ref={orderActionPanelRef} className="!mt-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline-variant)]">
              <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-white">
                <span className="text-xs text-[var(--outline)]">New order total</span>
                <span className="text-base font-semibold text-[var(--primary)]">
                  ${orderPriceOverrideInput === "" ? "0.00" : parseFloat(orderPriceOverrideInput || "0").toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "⌫") {
                        setOrderPriceOverrideInput((v) => v.slice(0, -1));
                      } else if (key === ".") {
                        if (!orderPriceOverrideInput.includes(".")) setOrderPriceOverrideInput((v) => v + ".");
                      } else {
                        const dotIdx = orderPriceOverrideInput.indexOf(".");
                        if (dotIdx !== -1 && orderPriceOverrideInput.length - dotIdx > 2) return;
                        setOrderPriceOverrideInput((v) => v + key);
                      }
                    }}
                    className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setOrderPriceOverride(null);
                    setOrderPriceOverrideInput("");
                    setShowOrderPriceOverridePanel(false);
                    setShowOrderActions(false);
                  }}
                  className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-white"
                >
                  {orderPriceOverride != null ? "RESET" : "Cancel"}
                </button>
                <button
                  onClick={() => {
                    const val = parseFloat(orderPriceOverrideInput);
                    if (!isNaN(val) && val >= 0) {
                      setOrderPriceOverride(val);
                      setOrderDiscount(null);
                      setOrderComped(false);
                    }
                    setShowOrderPriceOverridePanel(false);
                    setShowOrderActions(false);
                  }}
                  className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                  style={{ background: "#6750A4" }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--outline-variant)]" />
      </div>

      {/* Print / Split / Load row */}
      <div className="shrink-0 px-3 pt-2 pb-3 grid grid-cols-3 gap-2">
        <button className="h-12 rounded-2xl bg-green-100 text-sm font-semibold text-green-700 active:opacity-70 transition-colors">Print</button>
        <button
          onClick={() => {
            setSplitType(null);
            setSplitGuestCount(Math.max(2, guestCount));
            setShowSplitDrawer(true);
          }}
          className="h-12 rounded-2xl bg-green-100 text-sm font-semibold text-green-700 active:opacity-70 transition-colors"
        >
          Split
        </button>
        {(numpadMode === "discount" || numpadMode === "tips") ? (
          <button
            onClick={() => { setAmountInput(""); setNumpadMode("pay"); }}
            className="h-12 rounded-2xl bg-red-100 text-sm font-semibold text-red-600 active:bg-red-200 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <button onClick={handleClose} className="h-12 rounded-2xl bg-white border border-gray-300 text-sm font-medium text-gray-600 active:bg-gray-100 transition-colors">Load</button>
        )}
      </div>

      {/* Numpad + Payment Buttons Footer */}
      <div className="shrink-0 bg-gray-100 px-3 pt-3 pb-3 relative">
        {/* Balance + Amount input */}
        <div className="mb-1.5">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold">Balance</span>
            <span className="text-sm font-bold">${remainingBalance.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            {/* Action button */}
            <div className="relative shrink-0 flex flex-col justify-center">
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="h-10 w-14 rounded-xl bg-gray-300 flex items-center justify-center active:bg-gray-400 transition-colors"><Calculator size={20} /></button>
              <AnimatePresence>
                {showMoreMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.2 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowMoreMenu(false)}
                      className="fixed inset-0 bg-black z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1 min-w-[180px]"
                    >
                      {([
                        { key: "pay" as const, label: "Pay" },
                        { key: "discount" as const, label: "Discount" },
                        { key: "tips" as const, label: "Add Tips" },
                        { key: "taxExempt" as const, label: "Tax Exempt" },
                        { key: "priceOverride" as const, label: "Price Override" },
                      ]).map((mode) => (
                        <button
                          key={mode.key}
                          onClick={() => { setNumpadMode(mode.key); setShowMoreMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium active:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="w-4 shrink-0">
                            {numpadMode === mode.key && <Check size={16} className="text-green-600" />}
                          </span>
                          {mode.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            {/* Input field */}
            <div className="flex-1 min-w-0">
              <div className="border border-gray-800 rounded-md px-3 py-1 flex items-center justify-between h-10">
                <span className="text-sm text-gray-500">{{ pay: "Pay", discount: "Discount", tips: "Add Tips", taxExempt: "Tax Exempt", priceOverride: "Price Override" }[numpadMode]}</span>
                <span className="text-base font-medium">${displayAmountValue}</span>
              </div>
            </div>
          </div>
          {/* Mode-specific action buttons (full width) */}
          {numpadMode === "discount" ? (
            <div className="flex gap-2 mt-1.5">
              <div className="h-12 rounded-full flex overflow-hidden border border-gray-300">
                <button
                  onClick={() => setDiscountUnit("percent")}
                  className="px-4 h-full text-sm font-semibold transition-colors"
                  style={{ background: discountUnit === "percent" ? "#1d4ed8" : "#fff", color: discountUnit === "percent" ? "#fff" : "#6b7280" }}
                >
                  %
                </button>
                <button
                  onClick={() => setDiscountUnit("amount")}
                  className="px-4 h-full text-sm font-semibold transition-colors"
                  style={{ background: discountUnit === "amount" ? "#1d4ed8" : "#fff", color: discountUnit === "amount" ? "#fff" : "#6b7280" }}
                >
                  $
                </button>
              </div>
              <button
                onClick={() => setAmountInput(discountUnit === "percent" ? "5" : "500")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#f3e8ff", color: "#6b21a8" }}
              >
                {discountUnit === "percent" ? "5%" : "$5"}
              </button>
              <button
                onClick={() => setAmountInput(discountUnit === "percent" ? "10" : "1000")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#f3e8ff", color: "#6b21a8" }}
              >
                {discountUnit === "percent" ? "10%" : "$10"}
              </button>
              <button
                onClick={() => setAmountInput(discountUnit === "percent" ? "20" : "2000")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#f3e8ff", color: "#6b21a8" }}
              >
                {discountUnit === "percent" ? "20%" : "$20"}
              </button>
            </div>
          ) : numpadMode === "tips" ? (
            <div className="flex gap-2 mt-1.5">
              <div className="h-12 rounded-full flex overflow-hidden border border-gray-300">
                <button
                  onClick={() => setTipsUnit("percent")}
                  className="px-4 h-full text-sm font-semibold transition-colors"
                  style={{ background: tipsUnit === "percent" ? "#1d4ed8" : "#fff", color: tipsUnit === "percent" ? "#fff" : "#6b7280" }}
                >
                  %
                </button>
                <button
                  onClick={() => setTipsUnit("amount")}
                  className="px-4 h-full text-sm font-semibold transition-colors"
                  style={{ background: tipsUnit === "amount" ? "#1d4ed8" : "#fff", color: tipsUnit === "amount" ? "#fff" : "#6b7280" }}
                >
                  $
                </button>
              </div>
              <button
                onClick={() => setAmountInput(tipsUnit === "percent" ? "18" : "1000")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                {tipsUnit === "percent" ? "18%" : "$10"}
              </button>
              <button
                onClick={() => setAmountInput(tipsUnit === "percent" ? "20" : "2000")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                {tipsUnit === "percent" ? "20%" : "$20"}
              </button>
              <button
                onClick={() => setAmountInput(tipsUnit === "percent" ? "25" : "5000")}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                {tipsUnit === "percent" ? "25%" : "$50"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleOpenCashDrawer}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                Cash
              </button>
              <button
                onClick={() => { setCcStep("tap"); setCcTipIdx(null); setShowCreditCardDrawer(true); }}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                Credit Card
              </button>
              <button
                onClick={() => { setGcSerial(""); setGcPin(""); setGcStep("input"); setGcResult(null); setShowGiftCardDrawer(true); }}
                className="flex-1 h-12 rounded-full text-sm font-semibold active:opacity-80 transition-colors"
                style={{ background: "#dcfce7", color: "#15803d" }}
              >
                Gift Card
              </button>
            </div>
          )}
        </div>


        {/* Numpad grid: 3 rows × 4 columns */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          {/* Row 1 */}
          <button onClick={() => handleNumpadKey("1")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">1</button>
          <button onClick={() => handleNumpadKey("2")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">2</button>
          <button onClick={() => handleNumpadKey("3")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">3</button>
          <button onClick={() => handleNumpadKey("00")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">00</button>
          {/* Row 2 */}
          <button onClick={() => handleNumpadKey("4")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">4</button>
          <button onClick={() => handleNumpadKey("5")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">5</button>
          <button onClick={() => handleNumpadKey("6")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">6</button>
          <button onClick={() => handleNumpadKey("0")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">0</button>
          {/* Row 3 */}
          <button onClick={() => handleNumpadKey("7")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">7</button>
          <button onClick={() => handleNumpadKey("8")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">8</button>
          <button onClick={() => handleNumpadKey("9")} className="h-14 rounded-2xl bg-white text-lg font-medium active:bg-gray-100 transition-colors">9</button>
          <button onClick={() => handleNumpadKey("backspace")} className="h-14 rounded-2xl bg-red-100 flex items-center justify-center active:bg-red-200 transition-colors">
            <Delete size={26} className="text-red-400" />
          </button>
        </div>


      </div>

      {/* Gift Card Drawer */}
      <AnimatePresence>
        {showGiftCardDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGiftCardDrawer(false)}
              className="absolute inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={giftCardDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowGiftCardDrawer(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
              }}
              onAnimationComplete={() => {
                if (gcStep === "input" && gcSerialRef.current) {
                  gcSerialRef.current.focus();
                }
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => giftCardDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total row */}
              <div className="flex justify-between items-baseline px-5 pt-4">
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                  ${payableTotal.toFixed(2)}
                </span>
              </div>

              {/* Step 1: Serial + PIN input */}
              {gcStep === "input" && (
                <div className="px-4 mt-4 flex flex-col gap-5 flex-1">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Gift Card
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" style={{ color: "#49454F" }}>
                      Serial number
                    </label>
                    <input
                      ref={gcSerialRef}
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      value={gcSerial}
                      onChange={(e) => setGcSerial(e.target.value)}
                      placeholder="Enter serial number"
                      className="h-[52px] px-3 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid #515151" }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" style={{ color: "#49454F" }}>
                      PIN
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      maxLength={6}
                      value={gcPin}
                      onChange={(e) => setGcPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="4-6 digit PIN"
                      className="h-[44px] w-40 px-3 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid #515151" }}
                    />
                  </div>

                  {gcResult && !gcResult.success && (
                    <span className="text-sm text-red-600 font-medium">{gcResult.message}</span>
                  )}
                </div>
              )}

              {/* Step 2: Processing spinner */}
              {(gcStep === "processing" || gcStep === "applying") && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16">
                  <div
                    className="animate-spin"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      border: "5px solid #E8DEF8",
                      borderTopColor: "#6750A4",
                    }}
                  />
                  <span className="font-semibold text-black" style={{ fontSize: 18, lineHeight: "24px" }}>
                    {gcStep === "processing" ? "Verifying gift card..." : "Applying gift card..."}
                  </span>
                </div>
              )}

              {/* Step 3: Balance screen — tip + amount to apply */}
              {gcStep === "balance" && gcResult?.success && (() => {
                const cardBalance = gcResult.balance || 0;
                const gcTipAmount = gcTipIdx !== null ? payableTotal * TIP_PRESETS[gcTipIdx].value : 0;
                const totalWithTip = payableTotal + gcTipAmount;
                const maxApply = Math.min(cardBalance, totalWithTip);
                const applyValue = gcApplyAmount ? parseFloat(gcApplyAmount) || 0 : maxApply;
                const effectiveApply = Math.min(applyValue, maxApply);
                const balanceAfter = cardBalance - effectiveApply;
                const orderRemaining = totalWithTip - effectiveApply;

                return (
                  <div className="px-4 mt-3 flex flex-col gap-4 flex-1 overflow-y-auto">
                    {/* Card balance */}
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                        Card balance
                      </span>
                      <span className="text-base font-semibold" style={{ color: "#00B618" }}>
                        ${cardBalance.toFixed(2)}
                      </span>
                    </div>

                    {/* Tip */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                        Add tip
                      </span>
                      <div className="flex gap-1.5">
                        {TIP_PRESETS.map((preset, idx) => {
                          const sel = gcTipIdx === idx;
                          return (
                            <button
                              key={preset.label}
                              onClick={() => setGcTipIdx(sel ? null : idx)}
                              className="flex-1 h-[44px] rounded-lg flex items-center pl-3 relative"
                              style={{
                                background: sel ? "#E8DEF8" : "#FFFFFF",
                                border: sel ? "1px solid #515151" : "1px solid #DADADA",
                              }}
                            >
                              <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                                {preset.label}
                              </span>
                              {sel && (
                                <Check size={14} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {gcTipIdx !== null && (
                        <div className="flex justify-between mt-1">
                          <span className="text-sm" style={{ color: "#49454F" }}>Tip ({TIP_PRESETS[gcTipIdx].label})</span>
                          <span className="text-sm" style={{ color: "#49454F" }}>${gcTipAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Amount to apply */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                        Amount to apply
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-medium">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={gcApplyAmount || maxApply.toFixed(2)}
                          onChange={(e) => setGcApplyAmount(e.target.value)}
                          className="flex-1 h-[44px] px-3 rounded-lg text-sm focus:outline-none"
                          style={{ border: "1px solid #515151" }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: "#49454F" }}>
                        Max: ${maxApply.toFixed(2)}
                      </span>
                    </div>

                    {/* Summary */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                      <div className="flex justify-between">
                        <span className="text-sm" style={{ color: "#49454F" }}>Card balance after</span>
                        <span className="text-sm" style={{ color: "#49454F" }}>${balanceAfter.toFixed(2)}</span>
                      </div>
                      {orderRemaining > 0.01 && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium" style={{ color: "#B71C1C" }}>Remaining to pay</span>
                          <span className="text-sm font-medium" style={{ color: "#B71C1C" }}>${orderRemaining.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Step 4: Done */}
              {gcStep === "done" && gcResult?.success && (() => {
                const gcTipAmount = gcTipIdx !== null ? payableTotal * TIP_PRESETS[gcTipIdx].value : 0;
                const totalWithTip = payableTotal + gcTipAmount;
                const cardBalance = gcResult.balance || 0;
                const maxApply = Math.min(cardBalance, totalWithTip);
                const applyValue = gcApplyAmount ? parseFloat(gcApplyAmount) || 0 : maxApply;
                const effectiveApply = Math.min(applyValue, maxApply);

                return (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4 py-10">
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 64, height: 64, borderRadius: "50%", background: "#00B618" }}
                    >
                      <Check size={32} color="white" strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-black" style={{ fontSize: 18, lineHeight: "24px" }}>
                      Gift card applied
                    </span>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm" style={{ color: "#49454F" }}>
                        Amount charged: ${effectiveApply.toFixed(2)}
                      </span>
                      {gcTipAmount > 0 && (
                        <span className="text-sm" style={{ color: "#49454F" }}>
                          Includes tip: ${gcTipAmount.toFixed(2)}
                        </span>
                      )}
                      <span className="text-sm" style={{ color: "#49454F" }}>
                        Remaining card balance: ${(cardBalance - effectiveApply).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div className="px-5 pt-4 pb-5">
                {gcStep === "input" && (
                  <button
                    disabled={!gcSerial.trim() || gcPin.length < 4}
                    onClick={() => {
                      setGcStep("processing");
                      setGcResult(null);
                      setTimeout(() => {
                        const card = MOCK_GIFT_CARDS[gcSerial.toLowerCase().trim()];
                        if (card && card.pin === gcPin) {
                          setGcResult({ success: true, balance: card.balance, message: "Gift card verified" });
                          setGcApplyAmount("");
                          setGcTipIdx(null);
                          setGcStep("balance");
                        } else {
                          setGcResult({ success: false, message: card ? "Invalid PIN" : "Gift card not found" });
                          setGcStep("input");
                        }
                      }, 1500);
                    }}
                    className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40 transition-colors"
                    style={{ background: "#00B618" }}
                  >
                    <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                      Verify Gift Card
                    </span>
                  </button>
                )}
                {gcStep === "balance" && gcResult?.success && (() => {
                  const cardBalance = gcResult.balance || 0;
                  const gcTipAmount = gcTipIdx !== null ? payableTotal * TIP_PRESETS[gcTipIdx].value : 0;
                  const totalWithTip = payableTotal + gcTipAmount;
                  const maxApply = Math.min(cardBalance, totalWithTip);
                  const applyValue = gcApplyAmount ? parseFloat(gcApplyAmount) || 0 : maxApply;
                  const effectiveApply = Math.min(applyValue, maxApply);

                  return (
                    <button
                      disabled={effectiveApply <= 0}
                      onClick={() => {
                        setGcStep("applying");
                        setTimeout(() => {
                          setGcStep("done");
                        }, 1200);
                      }}
                      className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40 transition-colors"
                      style={{ background: "#00B618" }}
                    >
                      <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                        Apply ${effectiveApply.toFixed(2)}
                      </span>
                    </button>
                  );
                })()}
                {gcStep === "done" && gcResult?.success && (() => {
                  const cardBalance = gcResult.balance || 0;
                  const gcTipAmount = gcTipIdx !== null ? payableTotal * TIP_PRESETS[gcTipIdx].value : 0;
                  const totalWithTip = payableTotal + gcTipAmount;
                  const maxApply = Math.min(cardBalance, totalWithTip);
                  const applyValue = gcApplyAmount ? parseFloat(gcApplyAmount) || 0 : maxApply;
                  const effectiveApply = Math.min(applyValue, maxApply);
                  const orderRemaining = totalWithTip - effectiveApply;
                  const coversFullAmount = orderRemaining < 0.01;

                  return (
                    <button
                      onClick={() => {
                        setCumulativePaid(prev => prev + effectiveApply);
                        if (gcTipAmount > 0) setTip(gcTipAmount);
                        setShowGiftCardDrawer(false);

                        if (coversFullAmount) {
                          recordSuccessfulPayment(effectiveApply, totalWithTip);
                        }
                        // If partial, just close drawer — remaining balance updates automatically
                      }}
                      className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 transition-colors"
                      style={{ background: "#00B618" }}
                    >
                      <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                        {orderRemaining < 0.01 ? "Done" : "Continue to remaining balance"}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Split Check Drawer */}
      <AnimatePresence>
        {showSplitDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSplitDrawer(false)}
              className="absolute inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={splitDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowSplitDrawer(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: splitType === "item" ? "0" : "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
                ...(splitType === "item" ? { top: 48 } : { height: 476 }),
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => splitDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total row */}
              <div className="flex justify-between items-baseline px-5 pt-4">
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                  ${orderBaseTotal.toFixed(2)}
                </span>
              </div>

              {/* Split Check by */}
              <div className="px-4 mt-4 flex flex-col gap-1.5">
                <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                  Split Check by
                </span>
                <div className="flex gap-1.5">
                  {(["even", "amount", "item"] as const).map((type) => {
                    const isSelected = splitType === type;
                    const label = type === "even" ? "Even" : type === "amount" ? "Amount" : "Item";
                    // Lock to the active split method once any sub-payment has been recorded
                    const lockedType =
                      paidGuests.size > 0 ? "even"
                        : splitAmountPayments.length > 0 ? "amount"
                        : paidItemUnitIds.size > 0 ? "item"
                        : null;
                    const isLocked = lockedType !== null && lockedType !== type;
                    return (
                      <button
                        key={type}
                        onClick={() => !isLocked && setSplitType(isSelected ? null : type)}
                        disabled={isLocked}
                        className="flex-1 h-[52px] rounded-lg flex items-center pl-3 relative disabled:opacity-40"
                        style={{
                          background: isSelected ? "#E8DEF8" : "#FFFFFF",
                          border: isSelected ? "1px solid #515151" : "1px solid #DADADA",
                        }}
                      >
                        <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                          {label}
                        </span>
                        {isSelected && (
                          <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Even split options */}
              {splitType === "even" && (
                <div className="px-4 mt-6 flex flex-col gap-4">
                  {/* Split into guests */}
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Split into guests
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSplitGuestCount(Math.max(2, splitGuestCount - 1))}
                        disabled={splitGuestCount <= 2}
                        className="w-8 h-8 rounded-full border border-[#DADADA] flex items-center justify-center disabled:opacity-30 active:bg-gray-100"
                      >
                        <Minus size={16} color="#1D1B20" />
                      </button>
                      <span className="text-base font-medium w-4 text-center" style={{ color: "#1D1B20" }}>
                        {splitGuestCount}
                      </span>
                      <button
                        onClick={() => setSplitGuestCount(Math.min(Math.max(guestCount, 2), splitGuestCount + 1))}
                        disabled={splitGuestCount >= Math.max(guestCount, 2)}
                        className="w-8 h-8 rounded-full border border-[#DADADA] flex items-center justify-center disabled:opacity-30 active:bg-gray-100"
                      >
                        <Plus size={16} color="#1D1B20" />
                      </button>
                    </div>
                  </div>

                  {/* Each pay */}
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Each pay
                    </span>
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      ${splitDrawerEachPay.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount split options */}
              {splitType === "amount" && (() => {
                const amountPaidSoFar = confirmedSplit?.type === "amount" ? splitAmountPaidSoFar : 0;
                const amountRemaining = orderBaseTotal - amountPaidSoFar;
                const isSubsequent = confirmedSplit?.type === "amount" && splitAmountPayments.length > 0;
                return (
                  <div className="px-4 mt-6 flex flex-col gap-4">
                    {isSubsequent && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="text-sm" style={{ color: "#49454F" }}>Paid so far</span>
                          <span className="text-sm font-medium" style={{ color: "#49454F" }}>${amountPaidSoFar.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium" style={{ color: "#1D1B20" }}>Remaining balance</span>
                          <span className="text-sm font-medium" style={{ color: "#1D1B20" }}>${amountRemaining.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                        {isSubsequent ? "Next payment amount" : "First payment amount"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-medium">$</span>
                        <input
                          ref={splitAmountInputRef}
                          type="text"
                          inputMode="decimal"
                          value={splitAmountInput}
                          onChange={(e) => setSplitAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none"
                          style={{ border: "1px solid #515151" }}
                        />
                      </div>
                      {!isSubsequent && (
                        <span className="text-xs" style={{ color: "#49454F" }}>
                          Order total: ${orderBaseTotal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {splitType === "item" && (
                <div className="px-4 mt-4 flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
                  {paidItemUnitIds.size > 0 && (
                    <div className="flex justify-between shrink-0">
                      <span className="text-sm" style={{ color: "#49454F" }}>Items already paid</span>
                      <span className="text-sm font-medium" style={{ color: "#49454F" }}>{paidItemUnitIds.size}</span>
                    </div>
                  )}
                  <div className="flex justify-between shrink-0">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Select items for this check
                    </span>
                    <span className="text-sm" style={{ color: "#49454F" }}>{itemizedSelectedCount} selected</span>
                  </div>
                  <div className="flex-1 overflow-y-auto rounded-xl border border-[#DADADA] bg-[#FAFAFA]">
                    {unpaidItemUnits.length > 0 ? (
                      unpaidItemUnits.map((unit) => {
                        const isSelected = selectedItemUnitIds.has(unit.unitId);
                        return (
                          <button
                            key={unit.unitId}
                            onClick={() => toggleItemSelection(unit.unitId)}
                            className="w-full px-3 py-2.5 border-b last:border-b-0 border-[#E5E5E5] text-left active:bg-white transition-colors"
                            style={{ background: isSelected ? "#E8DEF8" : "transparent" }}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="shrink-0 mt-0.5 flex items-center justify-center"
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  border: isSelected ? "none" : "2px solid #79747E",
                                  background: isSelected ? "#6750A4" : "transparent",
                                }}
                              >
                                {isSelected && <Check size={14} color="white" strokeWidth={2.5} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-black">{unit.name}</span>
                                  {unit.unitCount > 1 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-[#DADADA] text-[#49454F]">
                                      {unit.unitIndex + 1}/{unit.unitCount}
                                    </span>
                                  )}
                                </div>
                                {unit.modifiers.length > 0 && (
                                  <p className="text-xs mt-0.5" style={{ color: "#49454F" }}>{unit.modifiers.join(", ")}</p>
                                )}
                                {unit.comboSelections.length > 0 && (
                                  <p className="text-xs mt-0.5" style={{ color: "#49454F" }}>{unit.comboSelections.join(" · ")}</p>
                                )}
                                {unit.note && (
                                  <p className="text-xs mt-0.5 italic" style={{ color: "#6750A4" }}>Note: {unit.note}</p>
                                )}
                              </div>
                              <span className="text-sm font-medium text-black shrink-0">${unit.unitTotal.toFixed(2)}</span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-sm" style={{ color: "#49454F" }}>
                        All items in this order have already been paid.
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between shrink-0">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Current check total
                    </span>
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      ${itemizedSelectedBaseTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <div className="px-5 mt-auto pb-5 pt-6">
                <button
                  disabled={
                    splitType === null ||
                    (splitType === "amount" && (() => {
                      const val = parseFloat(splitAmountInput);
                      const maxAllowed = confirmedSplit?.type === "amount"
                        ? orderBaseTotal - splitAmountPaidSoFar
                        : orderBaseTotal;
                      return !splitAmountInput || isNaN(val) || val <= 0 || val > maxAllowed + 0.01;
                    })()) ||
                    (splitType === "item" && itemizedSelectedCount === 0)
                  }
                  onClick={() => {
                    if (splitType === "even") {
                      setConfirmedSplit({ type: "even", guests: splitGuestCount });
                      setActiveGuestIdx(0);
                      setTip(0);
                    } else if (splitType === "amount") {
                      const amt = parseFloat(splitAmountInput) || 0;
                      setSplitAmountCurrent(roundCurrency(amt));
                      if (!confirmedSplit || confirmedSplit.type !== "amount") {
                        // First time setting up amount split
                        setSplitAmountPayments([]);
                        setCumulativePaid(0);
                        setTotalSettled(0);
                      }
                      setConfirmedSplit({ type: "amount" });
                      setTip(0);
                    } else if (splitType === "item") {
                      if (!confirmedSplit || confirmedSplit.type !== "item") {
                        setPaidItemUnitIds(new Set());
                        setLastItemizedPayment(null);
                        setCumulativePaid(0);
                        setTotalSettled(0);
                      }
                      setConfirmedSplit({ type: "item" });
                      setTip(0);
                    }
                    setShowSplitDrawer(false);
                  }}
                  className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40 transition-colors"
                  style={{ background: splitType ? "#00B618" : "#CFCFCF" }}
                >
                  <span
                    className="text-base font-medium"
                    style={{ letterSpacing: "0.15px", color: "#FFFFFF" }}
                  >
                    Confirm
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Credit Card Drawer */}
      <AnimatePresence>
        {showCreditCardDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreditCardDrawer(false)}
              className="absolute inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={ccDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowCreditCardDrawer(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
                minHeight: 480,
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => ccDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total row */}
              <div className="flex justify-between items-baseline px-5 pt-4">
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>Total</span>
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                  ${payableTotal.toFixed(2)}
                </span>
              </div>

              {/* Step: Tap to pay */}
              {ccStep === "tap" && (
                <>
                  <div className="px-4 mt-3">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Credit Card
                    </span>
                  </div>
                  <div
                    className="mx-5 mt-3 mb-5 flex items-center justify-center cursor-pointer active:opacity-70"
                    style={{ height: 313, borderRadius: 29, border: "1px dashed rgba(0,0,0,0.54)" }}
                    onClick={() => {
                      setCcStep("processing");
                      ccTimerRef.current = setTimeout(() => {
                        setCcStep("processed");
                        ccTimerRef.current = setTimeout(() => {
                          setCcStep("tip");
                        }, 1200);
                      }, 2000);
                    }}
                  >
                    <div className="flex flex-col items-center gap-6">
                      <svg width="120" height="120" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.8994 10.0001C26.1921 13.9532 27.9952 18.9353 27.9952 24.0801C27.9952 29.2249 26.1921 34.207 22.8994 38.1601M29.9994 2.84009C35.1515 8.68494 37.9941 16.2087 37.9941 24.0001C37.9941 31.7915 35.1515 39.3152 29.9994 45.1601M15.7794 17.0601C17.2219 19.0905 17.9969 21.5194 17.9969 24.0101C17.9969 26.5007 17.2219 28.9297 15.7794 30.9601"
                              stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="font-medium text-black" style={{ fontSize: 24, lineHeight: "32px" }}>
                        Tap to pay
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Step: Processing */}
              {ccStep === "processing" && (
                <div className="flex flex-col items-center flex-1 pb-4">
                  <div className="flex flex-col items-center justify-center flex-1 gap-6">
                    <div
                      className="animate-spin"
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        border: "6px solid #E8DEF8",
                        borderTopColor: "#6750A4",
                      }}
                    />
                    <span className="font-semibold text-black" style={{ fontSize: 22, lineHeight: "28px" }}>
                      Processing payment
                    </span>
                  </div>
                  <div className="px-5 w-full mt-auto">
                    <button
                      className="w-full h-14 rounded-full flex items-center justify-center"
                      style={{ background: "#FFCDD2" }}
                      onClick={() => {
                        if (ccTimerRef.current) clearTimeout(ccTimerRef.current);
                        setCcStep("tap");
                      }}
                    >
                      <span className="text-base font-medium" style={{ color: "#B71C1C", letterSpacing: "0.15px" }}>
                        Cancel
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Payment processed */}
              {ccStep === "processed" && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 pb-8">
                  <Check size={72} strokeWidth={2.5} color="#1D1B20" />
                  <span className="font-semibold text-black" style={{ fontSize: 22, lineHeight: "28px" }}>
                    Payment processed
                  </span>
                </div>
              )}

              {/* Step: Tip */}
              {ccStep === "tip" && (() => {
                const ccTipAmount = ccTipIdx !== null ? payableTotal * TIP_PRESETS[ccTipIdx].value : 0;
                const ccTotalWithTip = payableTotal + ccTipAmount;
                return (
                  <div className="flex flex-col flex-1 pb-5">
                    {/* Tip section */}
                    <div className="px-4 mt-4">
                      <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                        Add tip
                      </span>
                      <div className="flex gap-1.5 mt-2">
                        {TIP_PRESETS.map((preset, idx) => {
                          const sel = ccTipIdx === idx;
                          return (
                            <button
                              key={preset.label}
                              onClick={() => setCcTipIdx(sel ? null : idx)}
                              className="flex-1 h-[52px] rounded-lg flex items-center pl-3 relative"
                              style={{
                                background: sel ? "#E8DEF8" : "#FFFFFF",
                                border: sel ? "1px solid #515151" : "1px solid #DADADA",
                              }}
                            >
                              <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                                {preset.label}
                              </span>
                              {sel && (
                                <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCcTipIdx(null)}
                          className="flex-1 h-[52px] rounded-lg flex items-center pl-3"
                          style={{ background: "#FFFFFF", border: "1px solid #DADADA" }}
                        >
                          <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>Other</span>
                        </button>
                      </div>
                    </div>

                    {/* Tip amount + total with tip */}
                    {ccTipIdx !== null && (
                      <div className="px-4 mt-4 flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="text-sm" style={{ color: "#49454F" }}>
                            Tip amount ({TIP_PRESETS[ccTipIdx].label})
                          </span>
                          <span className="text-sm" style={{ color: "#49454F" }}>${ccTipAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-black">Total with tip</span>
                          <span className="text-sm font-medium text-black">${ccTotalWithTip.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Confirm Tip / Skip Tip */}
                    <div className="px-5 mt-auto pt-6 flex flex-col gap-3">
                      <button
                        className="w-full h-14 rounded-full flex items-center justify-center bg-[#00B618] active:opacity-80"
                        onClick={() => {
                          setTip(ccTipIdx !== null ? payableTotal * TIP_PRESETS[ccTipIdx].value : 0);
                          setShowCreditCardDrawer(false);
                          const ccChargeTotal = payableTotal + (ccTipIdx !== null ? payableTotal * TIP_PRESETS[ccTipIdx].value : 0);
                          recordSuccessfulPayment(ccChargeTotal, ccChargeTotal);
                        }}
                      >
                        <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                          Confirm Tip
                        </span>
                      </button>
                      <button
                        className="w-full h-12 flex items-center justify-center active:opacity-60"
                        onClick={() => {
                          setTip(0);
                          setShowCreditCardDrawer(false);
                          recordSuccessfulPayment(payableTotal, payableTotal);
                        }}
                      >
                        <span className="text-base font-semibold text-black" style={{ letterSpacing: "0.15px" }}>
                          Skip Tip
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tip Drawer */}
      <AnimatePresence>
        {showTipDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowTipDrawer(false); setPendingCashAfterTip(false); }}
              className="absolute inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={tipDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowTipDrawer(false);
                  setPendingCashAfterTip(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => tipDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3 pb-2"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total display */}
              <div className="px-5 pb-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-medium text-black" style={{ lineHeight: "44px" }}>
                    Total
                  </span>
                  <span className="text-4xl font-medium text-black" style={{ lineHeight: "44px" }}>
                    ${drawerTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm text-[#49454F]">Tip</span>
                  <span className="text-sm text-[#49454F]">${previewTip.toFixed(2)}</span>
                </div>
              </div>

              {/* Tip percentage section */}
              <div className="px-4 pb-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    Tip percentage
                  </span>
                  <div className="flex gap-1.5">
                    {TIP_PRESETS.map((preset, idx) => {
                      const isSelected = selectedTipPreset === idx && !isCustomTip;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => handleSelectPreset(idx)}
                          className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                          style={{
                            background: isSelected ? "#E8DEF8" : "#FFFFFF",
                            border: isSelected ? "1px solid #515151" : "1px solid #DADADA",
                          }}
                        >
                          <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                            {preset.label}
                          </span>
                          {isSelected && (
                            <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={handleSelectCustom}
                      className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                      style={{
                        background: isCustomTip ? "#E8DEF8" : "#FFFFFF",
                        border: isCustomTip ? "1px solid #515151" : "1px solid #DADADA",
                      }}
                    >
                      <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                        Other
                      </span>
                      {isCustomTip && (
                        <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Custom tip input */}
                {isCustomTip && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-[#515151] shrink-0">
                      <button
                        onClick={() => setCustomTipMode("$")}
                        className="w-10 h-[52px] flex items-center justify-center text-sm font-medium transition-colors"
                        style={{
                          background: customTipMode === "$" ? "#E8DEF8" : "white",
                          color: customTipMode === "$" ? "#4A4459" : "#79747E",
                        }}
                      >
                        $
                      </button>
                      <div className="w-px bg-[#515151]" />
                      <button
                        onClick={() => setCustomTipMode("%")}
                        className="w-10 h-[52px] flex items-center justify-center text-sm font-medium transition-colors"
                        style={{
                          background: customTipMode === "%" ? "#E8DEF8" : "white",
                          color: customTipMode === "%" ? "#4A4459" : "#79747E",
                        }}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customTipValue}
                      onChange={(e) => setCustomTipValue(e.target.value)}
                      autoFocus
                      placeholder={customTipMode === "$" ? "0.00" : "0"}
                      className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid #515151" }}
                    />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-5 pt-4 pb-5 flex flex-col gap-2">
                <button
                  onClick={handleAddTip}
                  disabled={selectedTipPreset === null && !isCustomTip}
                  className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40 transition-colors"
                  style={{ background: "#00B618" }}
                >
                  <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                    Add tip
                  </span>
                </button>
                <button
                  onClick={handleNoTip}
                  className="w-full h-14 rounded-full flex items-center justify-center active:bg-gray-100 transition-colors bg-white"
                >
                  <span className="text-base font-medium text-black" style={{ letterSpacing: "0.15px" }}>
                    No tip
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cash Payment Drawer */}
      <AnimatePresence>
        {showCashDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCashDrawer(false)}
              className="absolute inset-0 bg-black z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={cashDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowCashDrawer(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => cashDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total display */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                    Total
                  </span>
                  <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                    ${discountedTotal.toFixed(2)}
                  </span>
                </div>
                {cashDiscountAmount > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-[#49454F]">Discount</span>
                    <span className="text-sm text-[#49454F]">−${cashDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="px-4 pb-3">
                <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                  Cash payment
                </span>
              </div>

              {/* Sections */}
              <div className="px-4 flex flex-col gap-6">

                {/* Discount section */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      Discount
                    </span>
                    <span className="text-xs text-[#49454F]">Optional</span>
                  </div>
                  <div className="flex gap-1.5">
                    {DISCOUNT_PRESETS.map((preset, idx) => {
                      const isSelected = selectedDiscountIdx === idx && !isCustomDiscount;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => {
                            setSelectedDiscountIdx(selectedDiscountIdx === idx ? null : idx);
                            setIsCustomDiscount(false);
                            setCustomDiscountValue("");
                          }}
                          className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                          style={{
                            background: isSelected ? "#E8DEF8" : "#FFFFFF",
                            border: isSelected ? "1px solid #515151" : "1px solid #DADADA",
                          }}
                        >
                          <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                            {preset.label}
                          </span>
                          {isSelected && (
                            <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        if (isCustomDiscount) {
                          setIsCustomDiscount(false);
                          setCustomDiscountValue("");
                        } else {
                          setSelectedDiscountIdx(null);
                          setIsCustomDiscount(true);
                        }
                      }}
                      className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                      style={{
                        background: isCustomDiscount ? "#E8DEF8" : "#FFFFFF",
                        border: isCustomDiscount ? "1px solid #515151" : "1px solid #DADADA",
                      }}
                    >
                      <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                        Other
                      </span>
                      {isCustomDiscount && (
                        <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                      )}
                    </button>
                  </div>
                  {isCustomDiscount && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex rounded-lg overflow-hidden border border-[#515151] shrink-0">
                        <button
                          onClick={() => setCustomDiscountMode("$")}
                          className="w-10 h-[52px] flex items-center justify-center text-sm font-medium transition-colors"
                          style={{
                            background: customDiscountMode === "$" ? "#E8DEF8" : "white",
                            color: customDiscountMode === "$" ? "#4A4459" : "#79747E",
                          }}
                        >
                          $
                        </button>
                        <div className="w-px bg-[#515151]" />
                        <button
                          onClick={() => setCustomDiscountMode("%")}
                          className="w-10 h-[52px] flex items-center justify-center text-sm font-medium transition-colors"
                          style={{
                            background: customDiscountMode === "%" ? "#E8DEF8" : "white",
                            color: customDiscountMode === "%" ? "#4A4459" : "#79747E",
                          }}
                        >
                          %
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customDiscountValue}
                        onChange={(e) => setCustomDiscountValue(e.target.value)}
                        autoFocus
                        placeholder={customDiscountMode === "$" ? "0.00" : "0"}
                        className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none"
                        style={{ border: "1px solid #515151" }}
                      />
                    </div>
                  )}
                </div>

                {/* Tender section */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    Tendered
                  </span>
                  <div className="flex gap-1.5">
                    {[tenderPreset1, tenderPreset2].map((amount, idx) => {
                      const isSelected = selectedTenderIdx === idx && !isExactTender && !isCustomTender;
                      return (
                        <button
                          key={`tender-${idx}`}
                          onClick={() => {
                            setSelectedTenderIdx(idx);
                            setIsExactTender(false);
                            setIsCustomTender(false);
                            setCustomTenderValue("");
                          }}
                          className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                          style={{
                            background: isSelected ? "#E8DEF8" : "#FFFFFF",
                            border: isSelected ? "1px solid #515151" : "1px solid #DADADA",
                          }}
                        >
                          <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                            ${amount.toFixed(0)}
                          </span>
                          {isSelected && (
                            <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setSelectedTenderIdx(null);
                        setIsExactTender(true);
                        setIsCustomTender(false);
                        setCustomTenderValue("");
                      }}
                      className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                      style={{
                        background: isExactTender ? "#E8DEF8" : "#FFFFFF",
                        border: isExactTender ? "1px solid #515151" : "1px solid #DADADA",
                      }}
                    >
                      <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                        Exact
                      </span>
                      {isExactTender && (
                        <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTenderIdx(null);
                        setIsExactTender(false);
                        setIsCustomTender(true);
                      }}
                      className="flex-1 h-[52px] rounded-lg flex items-center justify-start pl-3 relative"
                      style={{
                        background: isCustomTender ? "#E8DEF8" : "#FFFFFF",
                        border: isCustomTender ? "1px solid #515151" : "1px solid #DADADA",
                      }}
                    >
                      <span className="text-sm text-black" style={{ letterSpacing: "0.25px" }}>
                        Other
                      </span>
                      {isCustomTender && (
                        <Check size={16} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#4A4459" }} />
                      )}
                    </button>
                  </div>
                  {isCustomTender && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-base font-medium">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customTenderValue}
                        onChange={(e) => setCustomTenderValue(e.target.value)}
                        autoFocus
                        placeholder="0.00"
                        className="flex-1 h-[52px] px-3 rounded-lg text-sm focus:outline-none"
                        style={{ border: "1px solid #515151" }}
                      />
                    </div>
                  )}
                </div>

                {/* Change due row */}
                {changeDue !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      {changeDue >= 0 ? "Change due" : "Balance due"}
                    </span>
                    <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                      ${Math.abs(changeDue).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <div className="px-5 pt-5 pb-6">
                <button
                  disabled={
                    selectedTenderIdx === null &&
                    !isExactTender &&
                    (!isCustomTender || !customTenderValue)
                  }
                  onClick={() => {
                    setShowCashDrawer(false);
                    recordSuccessfulPayment(cashTenderAmount, discountedTotal);
                  }}
                  className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 disabled:opacity-40 transition-colors"
                  style={{ background: "#00B618" }}
                >
                  <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                    {cashTenderAmount > 0
                      ? `Collect $${cashTenderAmount.toFixed(2)}`
                      : "Confirm"}
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Payment Complete Drawer */}
      <AnimatePresence>
        {showPaymentComplete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={completeDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowPaymentComplete(false);
                }
              }}
              className="absolute bottom-0 left-0 right-0 bg-white z-50 flex flex-col"
              style={{
                borderRadius: "20px 20px 0 0",
                boxShadow: "0px -2px 9px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Handle */}
              <div
                onPointerDown={(e) => completeDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex justify-center pt-3"
              >
                <div className="rounded-full" style={{ width: 96, height: 6, background: "#B6B6B6" }} />
              </div>

              {/* Total row — justify-between */}
              <div className="flex justify-between items-baseline px-5 pt-4">
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                  Total
                </span>
                <span className="font-medium text-black" style={{ fontSize: 36, lineHeight: "44px" }}>
                  ${paidTotal.toFixed(2)}
                </span>
              </div>

              {/* Amount paid + Remaining balance */}
              <div className="px-4 mt-2 flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    Amount paid
                  </span>
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    ${paidAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    Remaining balance
                  </span>
                  <span className="text-base font-medium" style={{ color: "#1D1B20", letterSpacing: "0.15px" }}>
                    ${Math.max(0, paidTotal - paidAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Guest label when in even split mode */}
              {confirmedSplit && confirmedSplit.type === "even" && (
                <div className="px-5 mt-2">
                  <span className="text-sm font-medium" style={{ color: "#49454F" }}>
                    Guest {activeGuestIdx + 1} of {confirmedSplit.guests}
                  </span>
                </div>
              )}
              {/* Amount split summary */}
              {confirmedSplit && confirmedSplit.type === "amount" && (
                <div className="px-5 mt-2">
                  <span className="text-sm font-medium" style={{ color: "#49454F" }}>
                    Payment #{splitAmountPayments.length + 1} · Remaining after: ${Math.max(0, splitAmountRemaining - splitAmountCurrent).toFixed(2)}
                  </span>
                </div>
              )}
              {confirmedSplit && confirmedSplit.type === "item" && lastItemizedPayment && (
                <div className="px-5 mt-2">
                  <span className="text-sm font-medium" style={{ color: "#49454F" }}>
                    {lastItemizedPayment.paidCount} item{lastItemizedPayment.paidCount === 1 ? "" : "s"} paid · {lastItemizedPayment.remainingCount} remaining · ${lastItemizedPayment.remainingTotal.toFixed(2)} left
                  </span>
                </div>
              )}

              {/* Check circle + Payment complete — floating, centered */}
              <div className="flex flex-col items-center mt-5 gap-[15px]">
                <div
                  className="flex items-center justify-center"
                  style={{ width: 89, height: 89, borderRadius: "50%", background: "#00B618" }}
                >
                  <Check size={44} color="white" strokeWidth={2.5} />
                </div>
                <span className="font-medium text-black" style={{ fontSize: 24, lineHeight: "32px" }}>
                  Payment complete
                </span>
              </div>

              {/* Print receipt button */}
              <div className="px-5 mt-10">
                <button
                  className="w-full h-14 rounded-full flex items-center justify-center active:opacity-70 transition-colors"
                  style={{ background: "#F3F3F3", border: "1px solid #D8D8D8" }}
                >
                  <span className="text-base font-medium text-black" style={{ letterSpacing: "0.15px" }}>
                    Print receipt
                  </span>
                </button>
              </div>

              {/* Close order / Proceed to next */}
              <div className="px-5 mt-[10px] pb-5">
                {confirmedSplit && confirmedSplit.type === "even" && paidGuests.size < confirmedSplit.guests ? (
                  <button
                    onClick={() => {
                      setShowPaymentComplete(false);
                      // Auto-advance to next unpaid guest
                      for (let i = 0; i < confirmedSplit.guests; i++) {
                        if (!paidGuests.has(i)) {
                          setActiveGuestIdx(i);
                          break;
                        }
                      }
                    }}
                    className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 transition-colors"
                    style={{ background: "#00B618" }}
                  >
                    <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                      Proceed to next payment
                    </span>
                  </button>
                ) : confirmedSplit && confirmedSplit.type === "amount" && (splitAmountRemaining - splitAmountCurrent) > 0.01 ? (
                  <button
                    onClick={() => {
                      setShowPaymentComplete(false);
                      // Record current payment and reset current
                      const prevCurrent = splitAmountCurrent;
                      setSplitAmountPayments(prev => [...prev, prevCurrent]);
                      setSplitAmountCurrent(0);
                      // Open split drawer for next amount input
                      const newRemaining = orderBaseTotal - splitAmountPaidSoFar - prevCurrent;
                      setSplitAmountInput(newRemaining > 0.01 ? newRemaining.toFixed(2) : "");
                      setSplitType("amount");
                      setShowSplitDrawer(true);
                    }}
                    className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 transition-colors"
                    style={{ background: "#00B618" }}
                  >
                    <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                      Enter next payment amount
                    </span>
                  </button>
                ) : confirmedSplit && confirmedSplit.type === "item" && !!lastItemizedPayment && lastItemizedPayment.remainingCount > 0 ? (
                  <button
                    onClick={() => {
                      setShowPaymentComplete(false);
                      setSelectedItemUnitIds(new Set());
                      setTip(0);
                      setSplitType("item");
                      setShowSplitDrawer(true);
                    }}
                    className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 transition-colors"
                    style={{ background: "#00B618" }}
                  >
                    <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                      Select next items
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowPaymentComplete(false);
                      resetOrder();
                      setScreen("login");
                    }}
                    className="w-full h-14 rounded-full flex items-center justify-center active:opacity-80 transition-colors"
                    style={{ background: "#00B618" }}
                  >
                    <span className="text-base font-medium text-white" style={{ letterSpacing: "0.15px" }}>
                      Close order
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Leave payment toast */}
      <AnimatePresence>
        {showLeaveToast && (
          <div
            className="absolute top-3 left-4 right-4 z-[60] flex flex-col rounded-xl animate-[slideDown_0.2s_ease-out]"
            style={{
              maxWidth: 328,
              background: "#F3EDF7",
              boxShadow: "0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)",
            }}
          >
            <div className="px-4 pt-4 pb-1">
              <p className="text-2xl font-medium text-black leading-8">
                Unpaid balance: ${outstandingAmount.toFixed(2)}
              </p>
              <p className="text-base text-black leading-6 mt-1" style={{ letterSpacing: "0.5px" }}>
                Complete payment before leaving.
              </p>
            </div>
            <div className="flex flex-col items-center px-3 pt-3 pb-3 gap-3">
              <button
                onClick={() => setShowLeaveToast(false)}
                className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
                style={{ background: "#6750A4" }}
              >
                <span className="text-sm font-medium text-white tracking-wide">Continue payment</span>
              </button>
              <button
                onClick={() => {
                  setShowLeaveToast(false);
                  goBack();
                }}
                className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
                style={{ background: "#E8DEF8" }}
              >
                <span className="text-sm font-medium tracking-wide" style={{ color: "#6750A4" }}>Leave anyway</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
