"use client";

import { useState } from "react";
import { X, Send, PauseCircle, Tag, Trash2, Users, CreditCard, Split, WalletCards, AlertTriangle, Check, StickyNote, Minus, Plus, Pencil, DollarSign, ArrowDownToLine, ChevronLeft, Banknote, Printer } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem, Modifier, CartItemModifier } from "@/lib/types";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";
import { getPriceBreakdown, formatCurrency, formatSignedCurrency } from "@/lib/pricing";

const allMenuItems: MenuItem[] = (menuData as MenuBook[]).flatMap((b) =>
  b.categories.flatMap((c) => c.items)
);

const TAX_RATE = 0.0875;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

interface ActionDrawerProps {
  open: boolean;
  onClose: () => void;
  onPay: () => void;
  onSplitCheck: () => void;
  onMultiplePayment: () => void;
  itemContext?: { id: string; name: string };
}

export default function ActionDrawer({ open, onClose, onPay, onSplitCheck, onMultiplePayment, itemContext }: ActionDrawerProps) {
  const { cartItems, cartTotal, checkTip, setCheckTip, markAllSent, resetOrder, setItemDiscount, setCheckDiscount, removeItem, updateQuantity, updateNote, updatePriceAdjustment, setItemPriceOverride, toggleBreakline, updateItemModifiers, updateComboSelections, splitAndUpdateNotes, splitCartItemToSingleItems, splitOneAndUpdateModifiers, consolidateCart } = useOrderStore();

  // Check-level states
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [showCustomDiscountInput, setShowCustomDiscountInput] = useState(false);
  const [customDiscountInput, setCustomDiscountInput] = useState("");
  const [discountInputType, setDiscountInputType] = useState<"percent" | "amount">("percent");
  const [sentFeedback, setSentFeedback] = useState(false);

  // Check-level tip panel state. Tip is stored as a flat dollar amount in
  // the order store; the panel converts a chosen percent of subtotal into
  // dollars at apply-time.
  const [showTipPanel, setShowTipPanel] = useState(false);
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [customTipInput, setCustomTipInput] = useState("");
  const [tipInputType, setTipInputType] = useState<"percent" | "amount">("percent");

  // Check-level print feedback
  const [printFeedback, setPrintFeedback] = useState(false);

  // Item-level states
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [, setNoteText] = useState("");
  const [activeNoteOrderKey, setActiveNoteOrderKey] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // Optional per-item price adjustment editable from the Notes panel.
  // Sign and magnitude are tracked separately so the user can flip + / -
  // without retyping. Magnitude is a free-form decimal string while editing.
  const [noteAdjustSign, setNoteAdjustSign] = useState<"+" | "-">("+");
  const [noteAdjustInput, setNoteAdjustInput] = useState("");
  const [showPriceOverride, setShowPriceOverride] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [showModifySheet, setShowModifySheet] = useState(false);
  const [localModSelections, setLocalModSelections] = useState<Record<string, Modifier[]>>({});
  const [originalModSelections, setOriginalModSelections] = useState<Record<string, Modifier[]>>({});
  // For combo modify: cart item ids that should be presented as separate orders
  // (after splitting a stacked combo line so each unit can be modified independently).
  const [modifyComboCartItemIds, setModifyComboCartItemIds] = useState<string[]>([]);

  const unsentItems = cartItems.filter((i) => !i.sent);
  const hasUnsentItems = unsentItems.length > 0;
  const hasItems = cartItems.length > 0;
  const paySubtotal = cartTotal();
  const payTotal = roundCurrency(paySubtotal * (1 + TAX_RATE) + checkTip);

  const cartItem = itemContext ? cartItems.find((i) => i.id === itemContext.id) : null;
  const menuItem = cartItem ? allMenuItems.find((m) => m.id === cartItem.menuItemId) : null;
  // Only show tabs when this single cart item has qty > 1 (stacked orders, not yet split)
  const hasQuantityBasedOrders = !!cartItem && cartItem.quantity > 1;
  const noteOrderTabs = cartItem
    ? hasQuantityBasedOrders
        ? Array.from({ length: cartItem.quantity }, (_, idx) => ({
            key: `${cartItem.id}-${idx}`,
            cartItemId: cartItem.id,
            label: `Order ${idx + 1}`,
            note: cartItem.note || "",
          }))
        : [{ key: cartItem.id, cartItemId: cartItem.id, label: "Order 1", note: cartItem.note || "" }]
    : [];
  const selectedNoteTab = noteOrderTabs.find((t) => t.key === activeNoteOrderKey) || noteOrderTabs[0] || null;
  const hasModifiers = cartItem
    ? (cartItem.modifiers.length > 0 || (cartItem.comboSelections && cartItem.comboSelections.length > 0))
    : false;
  const isCombo = menuItem?.isCombo && (menuItem.comboGroups?.length ?? 0) > 0;
  const isModifySelectionChanged = (() => {
    const groupIds = new Set([
      ...Object.keys(originalModSelections),
      ...Object.keys(localModSelections),
    ]);
    for (const gid of Array.from(groupIds)) {
      const orig = (originalModSelections[gid] || []).map((m) => m.id).sort().join(",");
      const curr = (localModSelections[gid] || []).map((m) => m.id).sort().join(",");
      if (orig !== curr) return true;
    }
    return false;
  })();

  const handleClose = () => {
    setShowVoidConfirm(false);
    setShowDiscountPanel(false);
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
    setDiscountInputType("percent");
    setSentFeedback(false);
    setShowTipPanel(false);
    setShowCustomTipInput(false);
    setCustomTipInput("");
    setTipInputType("percent");
    setPrintFeedback(false);
    setShowNoteInput(false);
    setNoteText("");
    setActiveNoteOrderKey(null);
    setNoteDrafts({});
    setNoteAdjustSign("+");
    setNoteAdjustInput("");
    setShowPriceOverride(false);
    setPriceInput("");
    setShowModifySheet(false);
    setLocalModSelections({});
    setOriginalModSelections({});
    onClose();
  };

  const handleSendToKitchen = () => {
    markAllSent();
    setSentFeedback(true);
    setTimeout(() => {
      setSentFeedback(false);
      handleClose();
    }, 900);
  };

  const handleApplyDiscount = (value: number, type: "percent" | "amount" = discountInputType) => {
    const normalizedValue = type === "percent" ? Math.min(100, value) : value;
    if (itemContext) {
      setItemDiscount(itemContext.id, { type, value: normalizedValue });
    } else {
      // Check-level: clear any per-item discounts so the cart lines no longer
      // show per-item "% off" / "$ off" badges, then apply a single check-wide
      // discount that simply subtracts from the subtotal in the totals row.
      cartItems.forEach((item) => {
        if (item.discount) setItemDiscount(item.id, null);
      });
      setCheckDiscount({ type, value: normalizedValue });
    }
    setShowDiscountPanel(false);
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
    handleClose();
  };

  const handleApplyCustomDiscount = () => {
    const value = parseFloat(customDiscountInput);
    if (!isNaN(value) && value > 0) {
      handleApplyDiscount(value, discountInputType);
    }
  };

  const handleCustomDiscountInputChange = (value: string) => {
    // Percent accepts whole numbers; amount accepts up to 2 decimals.
    const sanitized = discountInputType === "percent"
      ? value.replace(/\D/g, "")
      : value
          .replace(/[^\d.]/g, "")
          .replace(/(\..*)\./g, "$1")
          .replace(/^(\d+\.\d{0,2}).*$/, "$1");
    setCustomDiscountInput(sanitized);
  };

  const openDiscountPanel = () => {
    setDiscountInputType("percent");
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
    setShowDiscountPanel(true);
  };

  const openTipPanel = () => {
    setTipInputType("percent");
    setShowCustomTipInput(false);
    setCustomTipInput("");
    setShowTipPanel(true);
  };

  const handleApplyTip = (value: number, type: "percent" | "amount" = tipInputType) => {
    if (type === "percent") {
      const pct = Math.max(0, value) / 100;
      setCheckTip(paySubtotal * pct);
    } else {
      setCheckTip(Math.max(0, value));
    }
    setShowTipPanel(false);
    setShowCustomTipInput(false);
    setCustomTipInput("");
    handleClose();
  };

  const handleApplyCustomTip = () => {
    const value = parseFloat(customTipInput);
    if (!isNaN(value) && value > 0) {
      handleApplyTip(value, tipInputType);
    }
  };

  const handleCustomTipInputChange = (value: string) => {
    const sanitized = tipInputType === "percent"
      ? value.replace(/\D/g, "")
      : value
          .replace(/[^\d.]/g, "")
          .replace(/(\..*)\./g, "$1")
          .replace(/^(\d+\.\d{0,2}).*$/, "$1");
    setCustomTipInput(sanitized);
  };

  const handleRemoveTip = () => {
    setCheckTip(0);
    setShowTipPanel(false);
    handleClose();
  };

  const handlePrint = () => {
    // Mock: in a real build this would dispatch a print job. Show brief
    // feedback then close, mirroring "Send to kitchen".
    setPrintFeedback(true);
    setTimeout(() => {
      setPrintFeedback(false);
      handleClose();
    }, 900);
  };

  const handleVoidOrder = () => {
    resetOrder();
    handleClose();
  };

  const handleSaveNote = () => {
    // Compute optional signed price adjustment from the Notes panel.
    const adjMagnitude = parseFloat(noteAdjustInput);
    const signedAdjustment = !isNaN(adjMagnitude) && adjMagnitude > 0
      ? (noteAdjustSign === "-" ? -adjMagnitude : adjMagnitude)
      : 0;

    if (hasQuantityBasedOrders && cartItem) {
      // Build notesPerTabIndex: tab index -> note text
      const notesPerTabIndex: Record<number, string> = {};
      noteOrderTabs.forEach((tab, idx) => {
        const nextNote = (noteDrafts[tab.key] ?? "").trim();
        notesPerTabIndex[idx] = nextNote;
      });
      splitAndUpdateNotes(cartItem.id, notesPerTabIndex);
      // Adjustment applies to the whole original cart line; preserved by split.
      updatePriceAdjustment(cartItem.id, signedAdjustment);
      setShowNoteInput(false);
      setActiveNoteOrderKey(null);
      setNoteDrafts({});
      setNoteAdjustSign("+");
      setNoteAdjustInput("");
      handleClose();
      return;
    }

    if (selectedNoteTab) {
      const nextNote = (noteDrafts[selectedNoteTab.key] ?? "").trim();
      updateNote(selectedNoteTab.cartItemId, nextNote);
      updatePriceAdjustment(selectedNoteTab.cartItemId, signedAdjustment);
    }
    setShowNoteInput(false);
    setActiveNoteOrderKey(null);
    setNoteDrafts({});
    setNoteAdjustSign("+");
    setNoteAdjustInput("");
    handleClose();
  };

  const handleSavePriceOverride = () => {
    if (!itemContext) return;
    const val = parseFloat(priceInput);
    if (!isNaN(val) && val >= 0) setItemPriceOverride(itemContext.id, val);
    setShowPriceOverride(false);
    handleClose();
  };

  const isItemLevel2PanelOpen = showNoteInput || showPriceOverride || showDiscountPanel || showModifySheet;

  const handleBackFromItemLevel2 = () => {
    setShowNoteInput(false);
    setActiveNoteOrderKey(null);
    setNoteDrafts({});
    setNoteAdjustSign("+");
    setNoteAdjustInput("");
    setShowPriceOverride(false);
    setShowDiscountPanel(false);
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
    setDiscountInputType("percent");
    setShowModifySheet(false);
    setLocalModSelections({});
    setOriginalModSelections({});
    setModifyComboCartItemIds([]);
  };
  // Shared function: open modify panel with pre-populated selections
  const openModifyPanel = () => {
    if (!cartItem) return;
    const initial: Record<string, Modifier[]> = {};
    cartItem.modifiers.forEach((cm) => { initial[cm.groupId] = [...cm.modifiers]; });
    setLocalModSelections(initial);
    setOriginalModSelections(initial);
    // For combos with stacked qty > 1, split into individual cart items so
    // each unit can be modified independently in the combo config sheet.
    if (isCombo && cartItem.quantity > 1) {
      const ids = splitCartItemToSingleItems(cartItem.id);
      setModifyComboCartItemIds(ids);
    } else {
      setModifyComboCartItemIds([cartItem.id]);
    }
    setShowModifySheet(true);
  };

  if (!open) return null;

  // ── Item-level drawer ──────────────────────────────────────────────────────
  if (itemContext && cartItem) {
    return (
      <>
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
          style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
        >
          {/* Drag handle */}
          <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={handleClose}>
            <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
          </div>

          {/* Item header + order tabs — unified section matching combo sheet pattern */}
          <div className="border-b border-gray-100 shrink-0">
            {/* Title row */}
            <div className="flex items-center gap-2 px-4 pb-2">
              {isItemLevel2PanelOpen && (
                <button
                  onClick={handleBackFromItemLevel2}
                  className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0"
                  aria-label="Back"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium leading-snug truncate">{cartItem.name}</p>
              </div>
              <ActionPriceColumn item={cartItem} />
              <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Quantity editor + order tabs — share one row to save space */}
            <div className="flex items-center gap-3 px-4 pb-2">
              <button
                onClick={() => {
                  if (cartItem.sent) return;
                  if (cartItem.quantity <= 1) { removeItem(cartItem.id); handleClose(); }
                  else updateQuantity(cartItem.id, -1);
                }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100 disabled:opacity-30 shrink-0"
                disabled={cartItem.sent}
              >
                {cartItem.quantity <= 1 ? <Trash2 size={12} className="text-[var(--error)]" /> : <Minus size={12} />}
              </button>
              <span className="text-[13px] font-semibold min-w-[16px] text-center shrink-0">{cartItem.quantity}</span>
              <button
                onClick={() => {
                  if (cartItem.sent) return;
                  updateQuantity(cartItem.id, 1);
                }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100 disabled:opacity-30 shrink-0"
                disabled={cartItem.sent}
              >
                <Plus size={12} />
              </button>

              {/* Order tabs — inline, horizontally scrollable when overflowing */}
              {noteOrderTabs.length > 1 && isItemLevel2PanelOpen && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1">
                  {noteOrderTabs.map((tab) => {
                    const hasOrderNote = ((noteDrafts[tab.key] ?? tab.note ?? "").trim().length > 0);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setActiveNoteOrderKey(tab.key);
                          setNoteText(noteDrafts[tab.key] ?? tab.note ?? "");
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 transition-colors ${
                          tab.key === selectedNoteTab?.key
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-[var(--outline-variant)]"
                        }`}
                      >
                        {hasOrderNote && <Check size={12} className="text-[var(--primary)]" />}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modifier / combo / note / discount details with inline deltas
              per Rule 15. Tap to drill into the modifier panel. */}
          {(hasModifiers || cartItem.note || cartItem.discount || cartItem.priceOverride != null) && (
            <button
              onClick={hasModifiers ? openModifyPanel : undefined}
              disabled={!hasModifiers}
              className="w-full px-4 py-2 border-b border-gray-100 shrink-0 text-left active:bg-[var(--surface)] transition-colors disabled:active:bg-transparent"
            >
              <ActionItemDescription item={cartItem} />
            </button>
          )}

          {/* Scrollable action area */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">

            {/* Notes input (expanded inline) */}
            {showNoteInput ? (
              <div className="px-4 py-4">
                <div className="flex gap-3 items-start">
                  {/* Note column */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[var(--outline)] mb-2">Add a note for the kitchen</p>
                    <textarea
                      autoFocus
                      value={selectedNoteTab ? (noteDrafts[selectedNoteTab.key] ?? "") : ""}
                      onChange={(e) => {
                        if (!selectedNoteTab) return;
                        const next = e.target.value;
                        setNoteText(next);
                        setNoteDrafts((prev) => ({ ...prev, [selectedNoteTab.key]: next }));
                      }}
                      placeholder="Add notes"
                      rows={1}
                      className="w-full h-11 rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-[13px] outline-none resize-none focus:border-[var(--primary)]"
                    />
                  </div>

                  {/* Optional price adjustment for this item. Sign toggle + numeric
                      input — `inputMode="decimal"` triggers the Android numeric
                      keypad. Leave blank for no adjustment. */}
                  <div className="shrink-0">
                    <p className="text-[12px] text-[var(--outline)] mb-2">Price adjustment</p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex rounded-xl border border-[var(--outline-variant)] overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setNoteAdjustSign("+")}
                          className={`w-9 h-11 flex items-center justify-center text-[15px] font-semibold ${
                            noteAdjustSign === "+"
                              ? "bg-[var(--primary-light)] text-[var(--primary)]"
                              : "text-[var(--outline)] active:bg-gray-50"
                          }`}
                          aria-pressed={noteAdjustSign === "+"}
                          aria-label="Increase price"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoteAdjustSign("-")}
                          className={`w-9 h-11 flex items-center justify-center text-[15px] font-semibold border-l border-[var(--outline-variant)] ${
                            noteAdjustSign === "-"
                              ? "bg-[var(--primary-light)] text-[var(--primary)]"
                              : "text-[var(--outline)] active:bg-gray-50"
                          }`}
                          aria-pressed={noteAdjustSign === "-"}
                          aria-label="Decrease price"
                        >
                          −
                        </button>
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        pattern="[0-9]*"
                        min="0"
                        step="0.01"
                        value={noteAdjustInput}
                        onChange={(e) => {
                          const sanitized = e.target.value
                            .replace(/[^\d.]/g, "")
                            .replace(/(\..*)\./g, "$1")
                            .replace(/^(\d+\.\d{0,2}).*$/, "$1");
                          setNoteAdjustInput(sanitized);
                        }}
                        placeholder="0.00"
                        className="w-16 h-11 rounded-xl border border-[var(--outline-variant)] px-2 text-[13px] outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowNoteInput(false)}
                    className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] text-[13px] font-medium active:bg-gray-50"
                    style={{ color: "#49454F" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={(() => {
                      if (!selectedNoteTab) return true;
                      const noteFilled = (noteDrafts[selectedNoteTab.key] ?? selectedNoteTab.note ?? "").trim().length > 0;
                      const adjVal = parseFloat(noteAdjustInput);
                      const adjFilled = !isNaN(adjVal) && adjVal > 0;
                      const existingAdj = cartItem?.priceAdjustment || 0;
                      const adjChanged = adjFilled
                        ? (noteAdjustSign === "-" ? -adjVal : adjVal) !== existingAdj
                        : existingAdj !== 0;
                      return !(noteFilled || adjChanged);
                    })()}
                    className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-40"
                    style={{ background: "#6750A4" }}
                  >
                    Save note
                  </button>
                </div>
              </div>
            ) : showPriceOverride ? (
              /* Price override panel */
              <div className="px-4 py-4">
                <p className="text-[12px] text-[var(--outline)] mb-2">Enter new price for this item</p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[15px] font-semibold text-[var(--outline)]">$</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder={cartItem.basePrice.toFixed(2)}
                    className="flex-1 h-12 rounded-xl border border-[var(--outline-variant)] px-3 text-[15px] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPriceOverride(false)}
                    className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] text-[13px] font-medium active:bg-gray-50"
                    style={{ color: "#49454F" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePriceOverride}
                    className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white active:opacity-80"
                    style={{ background: "#6750A4" }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : showModifySheet && menuItem && !isCombo ? (
              /* Inline modifier editor */
              <div className="px-4 py-3">
                {menuItem.modifierGroups?.map((group) => {
                  const selected = localModSelections[group.id] || [];
                  return (
                    <div key={group.id} className="mb-4">
                      <p className="text-[12px] font-semibold mb-2">
                        {group.name}
                        <span className="font-normal text-[var(--outline)] ml-1">
                          ({group.required ? "Required" : "Optional"})
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.options.map((option) => {
                          const isSelected = selected.some((m) => m.id === option.id);
                          return (
                            <button
                              key={option.id}
                              onClick={() => {
                                setLocalModSelections((prev) => {
                                  const cur = prev[group.id] || [];
                                  const exists = cur.find((m) => m.id === option.id);
                                  let next: Modifier[];
                                  if (exists) {
                                    next = cur.filter((m) => m.id !== option.id);
                                  } else if (group.maxSelect === 1) {
                                    next = [option];
                                  } else if (group.maxSelect > 1 && cur.length >= group.maxSelect) {
                                    next = [...cur.slice(1), option];
                                  } else {
                                    next = [...cur, option];
                                  }
                                  return { ...prev, [group.id]: next };
                                });
                              }}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                                isSelected
                                  ? "border-[var(--primary)] bg-[var(--primary-light)]"
                                  : "border-[var(--outline-variant)]"
                              }`}
                            >
                              <span className="text-xs leading-snug">{option.name}</span>
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {option.price > 0 && (
                                  <span className="text-[10px] text-[var(--outline)]">+${option.price}</span>
                                )}
                                {isSelected && <Check size={14} className="text-[var(--primary)]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : showDiscountPanel ? (
              /* Discount panel */
              <div className="px-4 py-4">
                <p className="text-[12px] text-[var(--outline)] mb-3">Select a preset discount</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => {
                      setDiscountInputType("percent");
                      setShowCustomDiscountInput(false);
                      setCustomDiscountInput("");
                    }}
                    className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                      discountInputType === "percent"
                        ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                        : "border-[#E7E0EC] text-[var(--outline)]"
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => {
                      setDiscountInputType("amount");
                      setShowCustomDiscountInput(false);
                      setCustomDiscountInput("");
                    }}
                    className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                      discountInputType === "amount"
                        ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                        : "border-[#E7E0EC] text-[var(--outline)]"
                    }`}
                  >
                    $
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {(discountInputType === "percent" ? [10, 15, 20] : [5, 10, 20]).map((value) => (
                    <button
                      key={value}
                      onClick={() => handleApplyDiscount(value, discountInputType)}
                      className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                      style={{ color: "#6750A4" }}
                    >
                      {discountInputType === "percent" ? `${value}%` : `$${value}`}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomDiscountInput(true)}
                    className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                    style={{ color: "#6750A4" }}
                  >
                    Custom
                  </button>
                </div>
                {showCustomDiscountInput && (
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      autoFocus
                      type="text"
                      inputMode={discountInputType === "percent" ? "numeric" : "decimal"}
                      pattern={discountInputType === "percent" ? "[0-9]*" : "[0-9]*[.]?[0-9]{0,2}"}
                      value={customDiscountInput}
                      onChange={(e) => handleCustomDiscountInputChange(e.target.value)}
                      placeholder={discountInputType === "percent" ? "Custom %" : "Custom $"}
                      className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      onClick={handleApplyCustomDiscount}
                      disabled={!customDiscountInput || Number(customDiscountInput) <= 0}
                      className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                      style={{ background: "#6750A4" }}
                    >
                      Apply
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowCustomDiscountInput(false);
                    setCustomDiscountInput("");
                    setShowDiscountPanel(false);
                  }}
                  className="w-full h-10 rounded-xl border border-[var(--outline-variant)] text-sm font-medium active:bg-gray-100"
                  style={{ color: "#49454F" }}
                >
                  Back
                </button>
              </div>
            ) : (
              /* Action list */
              <div className="p-3 grid grid-cols-2 gap-2">
                <ItemActionButton
                  icon={<Pencil size={16} />}
                  label="Modify"
                  onClick={openModifyPanel}
                  disabled={!hasModifiers && !isCombo}
                />
                <ItemActionButton
                  icon={<StickyNote size={16} />}
                  label="Notes"
                  value={cartItem.note || undefined}
                  onClick={() => {
                    const initialDrafts: Record<string, string> = {};
                    noteOrderTabs.forEach((tab) => {
                      initialDrafts[tab.key] = tab.note;
                    });
                    setNoteDrafts(initialDrafts);
                    setActiveNoteOrderKey(noteOrderTabs[0]?.key || cartItem.id);
                    setNoteText(cartItem.note || "");
                    const adj = cartItem.priceAdjustment || 0;
                    setNoteAdjustSign(adj < 0 ? "-" : "+");
                    setNoteAdjustInput(adj === 0 ? "" : Math.abs(adj).toFixed(2));
                    setShowNoteInput(true);
                  }}
                />
                <ItemActionButton
                  icon={<ArrowDownToLine size={16} />}
                  label="Add breakline"
                  active={!!cartItem.breaklineBelow}
                  value="Off"
                  onClick={() => { toggleBreakline(cartItem.id, "below"); }}
                />
                <ItemActionButton
                  icon={<Tag size={16} />}
                  label="Apply discount"
                  value={cartItem.discount ? (cartItem.discount.type === "percent" ? `${cartItem.discount.value}%` : `$${cartItem.discount.value.toFixed(2)}`) : undefined}
                  onClick={openDiscountPanel}
                />
                <ItemActionButton
                  icon={<DollarSign size={16} />}
                  label="Price override"
                  value={cartItem.priceOverride != null ? `$${cartItem.priceOverride.toFixed(2)}` : undefined}
                  onClick={() => { setPriceInput(cartItem.priceOverride?.toFixed(2) ?? ""); setShowPriceOverride(true); }}
                />
                <ItemActionButton
                  icon={<Trash2 size={16} />}
                  label="Remove item"
                  destructive
                  onClick={() => { removeItem(cartItem.id); handleClose(); }}
                />
              </div>
            )}
          </div>
          {showModifySheet && menuItem && !isCombo && (
            <div className="border-t border-[var(--outline-variant)] px-4 py-3 shrink-0">
              <button
                disabled={!isModifySelectionChanged}
                onClick={() => {
                  const modifiers: CartItemModifier[] = Object.entries(localModSelections)
                    .filter(([, mods]) => mods.length > 0)
                    .map(([groupId, mods]) => {
                      const group = menuItem.modifierGroups.find((g) => g.id === groupId)!;
                      return { groupId, groupName: group.name, modifiers: mods };
                    });
                  // If the item has qty > 1, split off one unit with the new modifiers
                  // so the previously-modified units stay intact (e.g. medium rare stays
                  // when the new unit is changed to well done).
                  if (cartItem.quantity > 1) {
                    splitOneAndUpdateModifiers(cartItem.id, modifiers);
                  } else {
                    updateItemModifiers(cartItem.id, modifiers);
                  }
                  handleClose();
                }}
                className="w-full h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center text-sm font-semibold active:opacity-80 disabled:opacity-40 transition-opacity"
              >
                Save changes
              </button>
            </div>
          )}
          <div style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2px)" }} />
        </div>

        {showModifySheet && menuItem && isCombo && (
          <ComboConfigSheet
            item={menuItem}
            existingCartItems={(modifyComboCartItemIds.length > 0
              ? modifyComboCartItemIds
                  .map((id) => cartItems.find((i) => i.id === id))
                  .filter((i): i is NonNullable<typeof i> => !!i)
              : [cartItem])}
            onClose={() => { setShowModifySheet(false); setModifyComboCartItemIds([]); consolidateCart(); handleClose(); }}
            onAdd={() => { setShowModifySheet(false); setModifyComboCartItemIds([]); consolidateCart(); }}
            onUpdateExisting={(cartItemId, comboSelections) => {
              updateComboSelections(cartItemId, comboSelections);
            }}
          />
        )}
      </>
    );
  }

  // ── Check-level drawer ─────────────────────────────────────────────────────
  return (
    <>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
        style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={handleClose}>
          <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">
                {showDiscountPanel ? "Apply Discount" : showTipPanel ? "Add Tip" : showVoidConfirm ? "Void Order" : "Actions"}
              </span>
              {!showDiscountPanel && !showTipPanel && !showVoidConfirm && (
                <span className="text-[11px] text-[var(--outline)] truncate">Apply to full check</span>
              )}
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main actions grid */}
        {!showVoidConfirm && !showDiscountPanel && !showTipPanel && (
          <div className="flex-1 overflow-y-auto thin-scrollbar p-4 pb-5">
            <div className="grid grid-cols-2 gap-2.5">
              <ActionTile
                icon={sentFeedback ? <Check size={16} /> : <Send size={16} />}
                iconBg="#DCFCE7"
                iconColor="#16A34A"
                title="Send to kitchen"
                subtitle={sentFeedback ? "Sent!" : hasUnsentItems ? `${unsentItems.length} unsent` : "All items sent"}
                disabled={!hasUnsentItems || sentFeedback}
                onClick={handleSendToKitchen}
              />
              <ActionTile
                icon={<Split size={16} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title="Split check"
                subtitle="Divide bill among guests"
                disabled={!hasItems}
                onClick={() => { if (hasUnsentItems) markAllSent(); onSplitCheck(); handleClose(); }}
              />
              <ActionTile
                icon={<PauseCircle size={16} />}
                iconBg="#FEF9C3"
                iconColor="#CA8A04"
                title="Hold"
                subtitle="Pause firing course"
                disabled={!hasUnsentItems}
                onClick={handleClose}
              />
              <ActionTile
                icon={<WalletCards size={16} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title="Multi-pay"
                subtitle="Collect separately"
                disabled={!hasItems}
                onClick={() => { if (hasUnsentItems) markAllSent(); onMultiplePayment(); handleClose(); }}
              />
              <ActionTile
                icon={<Tag size={16} />}
                iconBg="#EFF6FF"
                iconColor="#2563EB"
                title="Apply discount"
                subtitle="Apply to all items"
                disabled={!hasItems}
                onClick={openDiscountPanel}
              />
              <ActionTile
                icon={printFeedback ? <Check size={16} /> : <Printer size={16} />}
                iconBg="#E0F2FE"
                iconColor="#0369A1"
                title="Print"
                subtitle={printFeedback ? "Sent to printer" : "Print check receipt"}
                disabled={!hasItems || printFeedback}
                onClick={handlePrint}
              />
              <ActionTile
                icon={<Banknote size={16} />}
                iconBg="#FEF3C7"
                iconColor="#B45309"
                title="Add tip"
                subtitle={checkTip > 0 ? `Tip $${checkTip.toFixed(2)}` : "Pre-payment gratuity"}
                disabled={!hasItems}
                onClick={openTipPanel}
              />
              <ActionTile
                icon={<Trash2 size={16} />}
                iconBg="#FEE2E2"
                iconColor="#DC2626"
                title="Void order"
                subtitle="Cancel entire order"
                disabled={!hasItems}
                onClick={() => setShowVoidConfirm(true)}
                destructive
              />
            </div>
          </div>
        )}

        {!showVoidConfirm && !showDiscountPanel && !showTipPanel && (
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
            <button
              onClick={() => {
                // Auto-send any unsent items to the kitchen before entering
                // the payment flow, so the kitchen always has the full order.
                if (hasUnsentItems) {
                  markAllSent();
                }
                onPay();
              }}
              disabled={!hasItems}
              className="w-full h-12 rounded-2xl text-sm font-semibold text-white active:opacity-80 disabled:opacity-40 transition-opacity"
              style={{ background: "#6750A4" }}
            >
              Pay ${payTotal.toFixed(2)}
            </button>
          </div>
        )}

        {/* Discount panel */}
        {showDiscountPanel && (
          <div className="px-4 py-4">
            <p className="text-[12px] text-[#79747E] mb-3">Select a preset or enter a custom discount</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setDiscountInputType("percent");
                  setShowCustomDiscountInput(false);
                  setCustomDiscountInput("");
                }}
                className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                  discountInputType === "percent"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[#E7E0EC] text-[var(--outline)]"
                }`}
              >
                %
              </button>
              <button
                onClick={() => {
                  setDiscountInputType("amount");
                  setShowCustomDiscountInput(false);
                  setCustomDiscountInput("");
                }}
                className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                  discountInputType === "amount"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[#E7E0EC] text-[var(--outline)]"
                }`}
              >
                $
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {(discountInputType === "percent" ? [10, 15, 20] : [5, 10, 20]).map((value) => (
                <button
                  key={value}
                  onClick={() => handleApplyDiscount(value, discountInputType)}
                  className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                  style={{ color: "#6750A4" }}
                >
                  {discountInputType === "percent" ? `${value}%` : `$${value}`}
                </button>
              ))}
              <button
                onClick={() => setShowCustomDiscountInput(true)}
                className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                style={{ color: "#6750A4" }}
              >
                Custom
              </button>
            </div>
            {showCustomDiscountInput && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  autoFocus
                  type="text"
                  inputMode={discountInputType === "percent" ? "numeric" : "decimal"}
                  pattern={discountInputType === "percent" ? "[0-9]*" : "[0-9]*[.]?[0-9]{0,2}"}
                  value={customDiscountInput}
                  onChange={(e) => handleCustomDiscountInputChange(e.target.value)}
                  placeholder={discountInputType === "percent" ? "Custom %" : "Custom $"}
                  className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleApplyCustomDiscount}
                  disabled={!customDiscountInput || Number(customDiscountInput) <= 0}
                  className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "#6750A4" }}
                >
                  Apply
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setShowCustomDiscountInput(false);
                setCustomDiscountInput("");
                setShowDiscountPanel(false);
              }}
              className="w-full h-10 rounded-xl text-sm font-medium active:bg-gray-100"
              style={{ color: "#49454F" }}
            >
              Back
            </button>
          </div>
        )}

        {/* Tip panel — applies a check-level tip before payment.
            Mirrors the discount panel pattern (% / $ toggle, presets,
            custom input) plus a Remove tip option when a tip is set. */}
        {showTipPanel && (
          <div className="px-4 py-4">
            <p className="text-[12px] text-[#79747E] mb-3">
              Tip is added to the check total before sending to payment.
              {checkTip > 0 ? ` Current tip: $${checkTip.toFixed(2)}` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setTipInputType("percent");
                  setShowCustomTipInput(false);
                  setCustomTipInput("");
                }}
                className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                  tipInputType === "percent"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[#E7E0EC] text-[var(--outline)]"
                }`}
              >
                %
              </button>
              <button
                onClick={() => {
                  setTipInputType("amount");
                  setShowCustomTipInput(false);
                  setCustomTipInput("");
                }}
                className={`h-9 rounded-xl border text-[13px] font-semibold transition-colors ${
                  tipInputType === "amount"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[#E7E0EC] text-[var(--outline)]"
                }`}
              >
                $
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {(tipInputType === "percent" ? [15, 18, 20] : [5, 10, 20]).map((value) => (
                <button
                  key={value}
                  onClick={() => handleApplyTip(value, tipInputType)}
                  className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                  style={{ color: "#6750A4" }}
                >
                  {tipInputType === "percent" ? `${value}%` : `$${value}`}
                </button>
              ))}
              <button
                onClick={() => setShowCustomTipInput(true)}
                className="h-12 rounded-xl border border-[#E7E0EC] text-[15px] font-semibold active:bg-[#F3EDF7] transition-colors"
                style={{ color: "#6750A4" }}
              >
                Custom
              </button>
            </div>
            {showCustomTipInput && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  autoFocus
                  type="text"
                  inputMode={tipInputType === "percent" ? "numeric" : "decimal"}
                  pattern={tipInputType === "percent" ? "[0-9]*" : "[0-9]*[.]?[0-9]{0,2}"}
                  value={customTipInput}
                  onChange={(e) => handleCustomTipInputChange(e.target.value)}
                  placeholder={tipInputType === "percent" ? "Custom %" : "Custom $"}
                  className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleApplyCustomTip}
                  disabled={!customTipInput || Number(customTipInput) <= 0}
                  className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "#6750A4" }}
                >
                  Apply
                </button>
              </div>
            )}
            {checkTip > 0 && (
              <button
                onClick={handleRemoveTip}
                className="w-full h-10 rounded-xl text-sm font-medium mb-2 border border-[#E7E0EC] active:bg-gray-100"
                style={{ color: "#B3261E" }}
              >
                Remove tip
              </button>
            )}
            <button
              onClick={() => {
                setShowCustomTipInput(false);
                setCustomTipInput("");
                setShowTipPanel(false);
              }}
              className="w-full h-10 rounded-xl text-sm font-medium active:bg-gray-100"
              style={{ color: "#49454F" }}
            >
              Back
            </button>
          </div>
        )}

        {/* Void confirmation */}
        {showVoidConfirm && (
          <div className="px-4 py-4">
            <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-red-50">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 leading-snug">
                This will erase all items and cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleVoidOrder}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center active:opacity-80"
                style={{ background: "#DC2626" }}
              >
                Void order
              </button>
              <button
                onClick={() => setShowVoidConfirm(false)}
                className="w-full h-11 rounded-xl text-sm font-medium active:bg-gray-100"
                style={{ color: "#49454F" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ItemActionButton({
  icon,
  label,
  value,
  active,
  destructive,
  centered,
  className,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  active?: boolean;
  destructive?: boolean;
  centered?: boolean;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[44px] rounded-xl border border-[#E7E0EC] px-3 py-2.5 active:bg-[var(--surface)] transition-colors text-left disabled:opacity-40 ${className || ""}`}
    >
      <div className={`flex gap-2 ${centered ? "items-center justify-center" : "items-center"}`}>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#F3EDF7", color: destructive ? "#B3261E" : "#6750A4" }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className={`text-[13px] font-medium leading-tight ${centered ? "text-center" : ""}`} style={{ color: destructive ? "#B3261E" : "#1D1B20" }}>
            {label}
          </p>
          {(active || value) && (
            <p className={`text-[11px] mt-0.5 ${centered ? "text-center" : ""}`} style={{ color: active ? "#6750A4" : "#79747E" }}>
              {active ? "On" : value}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function ActionTile({
  icon,
  title,
  disabled,
  onClick,
  destructive,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 h-11 px-3 text-left transition hover:bg-gray-100 disabled:opacity-40"
    >
      {icon && (
        <span className="inline-flex h-7 w-7 items-center justify-center text-gray-600 shrink-0">
          {icon}
        </span>
      )}
      <span
        className="truncate text-[13px] font-medium"
        style={{ color: destructive ? "#DC2626" : "#1F2937" }}
      >
        {title}
      </span>
    </button>
  );
}

/**
 * Rule 15 right-column price stack for the Action Drawer item header.
 * Mirrors the row-level visual: original price strikethrough above the
 * final unit price in accent color when adjusted/overridden; otherwise a
 * single neutral price.
 */
function ActionPriceColumn({ item }: { item: import("@/lib/types").CartItem }) {
  const breakdown = getPriceBreakdown(item);

  if (!breakdown.hasOverride && breakdown.netAdjustment === 0 && !breakdown.isComped) {
    return (
      <span className="text-[13px] font-semibold text-[#1D1B20] shrink-0 tabular-nums">
        {formatCurrency(breakdown.basePrice)}
      </span>
    );
  }

  return (
    <div className="shrink-0 text-right leading-tight tabular-nums">
      <div className="text-[11px] text-[var(--outline)] line-through">
        {formatCurrency(breakdown.basePrice)}
      </div>
      <div className="text-[13px] font-semibold text-[#6750A4]">
        {formatCurrency(breakdown.effectiveUnitPrice)}
      </div>
    </div>
  );
}

/**
 * Rule 15 inline-delta description for the Action Drawer item header.
 * Modifiers, combo selections, notes show their `+$X`/`−$X` deltas inline.
 * Discount renders as its own line. Override suppresses inline deltas and
 * shows a single "Override" label.
 */
function ActionItemDescription({ item }: { item: import("@/lib/types").CartItem }) {
  const breakdown = getPriceBreakdown(item);
  const overrideActive = breakdown.hasOverride;

  const modifierEntries = item.modifiers.flatMap((g) =>
    g.modifiers.map((m) => ({ g, m })),
  );

  return (
    <>
      {modifierEntries.length > 0 && (
        <p className="text-[11px] text-[var(--outline)] leading-relaxed">
          {modifierEntries.map(({ g, m }, i) => {
            const d = !overrideActive && m.price ? m.price : 0;
            return (
              <span key={`${g.groupId}-${m.id}`}>
                {i > 0 && ", "}
                {m.name}
                {d ? (
                  <span className="ml-1 text-[var(--primary)] font-medium">
                    {formatSignedCurrency(d)}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      )}

      {item.comboSelections && item.comboSelections.length > 0 && (
        <p className="text-[11px] text-[var(--outline)] leading-relaxed">
          {item.comboSelections.map((s, ci) => {
            const compDelta = !overrideActive && s.component.price ? s.component.price : 0;
            const innerMods = s.modifiers.flatMap((g) => g.modifiers.map((m) => ({ g, m })));
            return (
              <span key={`${s.groupId}-${s.component.id}-${ci}`}>
                {ci > 0 && " · "}
                {s.component.name}
                {compDelta ? (
                  <span className="ml-1 text-[var(--primary)] font-medium">
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
                            <span className="ml-1 text-[var(--primary)] font-medium">
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
        <p className="text-[11px] text-[var(--primary)] italic leading-relaxed">
          Note: {item.note}
          {!overrideActive && breakdown.noteAdjustment ? (
            <span className="ml-1 not-italic font-medium">
              {formatSignedCurrency(breakdown.noteAdjustment.amount)}
            </span>
          ) : null}
        </p>
      )}

      {!overrideActive && breakdown.discount && (
        <p className="text-[11px] text-[var(--primary)] italic leading-relaxed">
          {breakdown.discount.label}
          <span className="ml-1 not-italic font-medium">
            {formatSignedCurrency(breakdown.discount.amount)}
          </span>
        </p>
      )}

      {overrideActive && (
        <p className="text-[11px] text-[var(--primary)] italic leading-relaxed">Override</p>
      )}
    </>
  );
}
