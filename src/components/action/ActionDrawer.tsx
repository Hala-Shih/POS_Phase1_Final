"use client";

import { useState } from "react";
import { X, Send, PauseCircle, Tag, Trash2, Users, CreditCard, Split, WalletCards, AlertTriangle, Check, StickyNote, Minus, Plus, Pencil, DollarSign, ArrowDownToLine, ChevronLeft, Banknote, Printer } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem, Modifier, CartItemModifier } from "@/lib/types";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";
import DragHandle from "@/components/ui/DragHandle";
import { getPriceBreakdown, formatCurrency, formatSignedCurrency } from "@/lib/pricing";

const allMenuItems: MenuItem[] = (menuData as MenuBook[]).flatMap((b) =>
  b.categories.flatMap((c) => c.items)
);

const TAX_RATE = 0.08875;

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
  const { cartItems, cartTotal, checkTip, checkDiscount, setCheckTip, markAllSent, resetOrder, setItemDiscount, setCheckDiscount, removeItem, updateQuantity, updateNote, updatePriceAdjustment, setItemPriceOverride, toggleBreakline, updateItemModifiers, updateComboSelections, splitAndUpdateNotes, splitCartItemToSingleItems, splitOneAndUpdateModifiers, consolidateCart, addItem, language } = useOrderStore();



  // Localisation helpers
  const n = (item: { name: string; nameCn?: string; menuItemId?: string }) => {
    if (language !== "zh") return item.name;
    if (item.nameCn) return item.nameCn;
    if (item.menuItemId) {
      const mi = allMenuItems.find((m) => m.id === item.menuItemId);
      if (mi?.nameCn) return mi.nameCn;
    }
    return item.name;
  };
  const L = language === "zh" ? {
    order: "訂單", cancel: "取消", saveNote: "儲存備註", saveChanges: "儲存修改",
    addToOrder: "加入訂單", addNoteForKitchen: "新增廚房備註", addNotes: "輸入備註",
    priceAdj: "價格調整", enterNewPrice: "輸入此品項新價格", apply: "套用",
    required: "必選", optional: "選填", custom: "自訂", back: "返回",
    selectPreset: "選擇預設折扣", removeDiscount: "移除折扣",
    modify: "修改", notes: "備註", addBreakline: "加分隔線", off: "關閉",
    applyDiscount: "套用折扣", priceOverride: "覆蓋價格", removeItem: "刪除品項",
    applyDiscountTitle: "套用折扣", addTip: "新增小費", voidOrder: "取消訂單", actions: "操作",
    applyToFullCheck: "套用至整張帳單",
    sendToKitchen: "送至廚房", sent: "已送出", unsent: "未送出", allItemsSent: "全部已送出",
    splitCheck: "分帳", divideBill: "將帳單分給客人",
    hold: "保留", pauseFiring: "暫停出餐",
    multiPay: "多方付款", collectSeparately: "分開收款",
    applyToAllItems: "套用至所有品項",
    print: "列印", sentToPrinter: "已送至印表機", printCheckReceipt: "列印帳單收據",
    addTipLabel: "新增小費", tipAmount: "小費", prePaymentGratuity: "付款前小費",
    voidOrderAction: "取消訂單", cancelEntireOrder: "取消整張訂單",
    pay: "結帳", thisWillErase: "此操作將清除所有品項且無法復原。",
    tipDesc: "小費將在付款前加入帳單總額。",
    currentTip: "目前小費",
    selectPresetTip: "選擇預設或輸入自訂小費",
    selectPresetDiscount: "選擇預設或輸入自訂折扣",
    removeTip: "移除小費",
    customPercent: "自訂 %", customDollar: "自訂 $",
  } : {
    order: "Order", cancel: "Cancel", saveNote: "Save note", saveChanges: "Save changes",
    addToOrder: "Add to order", addNoteForKitchen: "Add a note for the kitchen", addNotes: "Add notes",
    priceAdj: "Price adjustment", enterNewPrice: "Enter new price for this item", apply: "Apply",
    required: "Required", optional: "Optional", custom: "Custom", back: "Back",
    selectPreset: "Select a preset discount", removeDiscount: "Remove discount",
    modify: "Modify", notes: "Notes", addBreakline: "Add breakline", off: "Off",
    applyDiscount: "Apply discount", priceOverride: "Price override", removeItem: "Remove item",
    applyDiscountTitle: "Apply Discount", addTip: "Add Tip", voidOrder: "Void Order", actions: "Actions",
    applyToFullCheck: "Apply to full check",
    sendToKitchen: "Send to kitchen", sent: "Sent!", unsent: "unsent", allItemsSent: "All items sent",
    splitCheck: "Split check", divideBill: "Divide bill among guests",
    hold: "Hold", pauseFiring: "Pause firing course",
    multiPay: "Multi-pay", collectSeparately: "Collect separately",
    applyToAllItems: "Apply to all items",
    print: "Print", sentToPrinter: "Sent to printer", printCheckReceipt: "Print check receipt",
    addTipLabel: "Add tip", tipAmount: "Tip", prePaymentGratuity: "Pre-payment gratuity",
    voidOrderAction: "Void order", cancelEntireOrder: "Cancel entire order",
    pay: "Pay", thisWillErase: "This will erase all items and cannot be undone.",
    tipDesc: "Tip is added to the check total before sending to payment.",
    currentTip: "Current tip",
    selectPresetTip: "Select a preset or enter a custom discount",
    selectPresetDiscount: "Select a preset or enter a custom discount",
    removeTip: "Remove tip",
    customPercent: "Custom %", customDollar: "Custom $",
  };

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
  // Per-order modifier selections when qty > 1 (mirrors MenuSheet order tabs pattern).
  const [activeModifyOrderIndex, setActiveModifyOrderIndex] = useState(0);
  const [modifyOrderSelections, setModifyOrderSelections] = useState<Record<string, Modifier[]>[]>([]);
  const [originalOrderSelections, setOriginalOrderSelections] = useState<Record<string, Modifier[]>[]>([]);
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
            label: `${L.order} ${idx + 1}`,
            note: cartItem.note || "",
          }))
        : [{ key: cartItem.id, cartItemId: cartItem.id, label: `${L.order} 1`, note: cartItem.note || "" }]
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
    setActiveModifyOrderIndex(0);
    setModifyOrderSelections([]);
    setOriginalOrderSelections([]);
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

  const handleRemoveDiscount = () => {
    if (itemContext) {
      setItemDiscount(itemContext.id, null);
    } else {
      setCheckDiscount(null);
    }
    setShowDiscountPanel(false);
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
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
    if (hasQuantityBasedOrders && cartItem) {
      // Build notesPerTabIndex: tab index -> note text
      const notesPerTabIndex: Record<number, string> = {};
      noteOrderTabs.forEach((tab, idx) => {
        const nextNote = (noteDrafts[tab.key] ?? "").trim();
        notesPerTabIndex[idx] = nextNote;
      });
      splitAndUpdateNotes(cartItem.id, notesPerTabIndex);
      setShowNoteInput(false);
      setActiveNoteOrderKey(null);
      setNoteDrafts({});
      handleClose();
      return;
    }

    if (selectedNoteTab) {
      const nextNote = (noteDrafts[selectedNoteTab.key] ?? "").trim();
      updateNote(selectedNoteTab.cartItemId, nextNote);
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
    setActiveModifyOrderIndex(0);
    setModifyOrderSelections([]);
    setOriginalOrderSelections([]);
    setModifyComboCartItemIds([]);
  };
  // Shared function: open modify panel with pre-populated selections
  const openModifyPanel = () => {
    if (!cartItem) return;
    const initial: Record<string, Modifier[]> = {};
    cartItem.modifiers.forEach((cm) => { initial[cm.groupId] = [...cm.modifiers]; });
    setLocalModSelections(initial);
    setOriginalModSelections(initial);
    // For non-combo items, initialise per-order selections
    // so each unit can be modified independently via order tabs.
    if (!isCombo) {
      const perOrder = Array.from({ length: cartItem.quantity }, () => {
        const copy: Record<string, Modifier[]> = {};
        cartItem.modifiers.forEach((cm) => { copy[cm.groupId] = [...cm.modifiers]; });
        return copy;
      });
      setModifyOrderSelections(perOrder);
      setOriginalOrderSelections(perOrder.map((o) => {
        const copy: Record<string, Modifier[]> = {};
        Object.entries(o).forEach(([gid, mods]) => { copy[gid] = [...mods]; });
        return copy;
      }));
      setActiveModifyOrderIndex(0);
    } else {
      setModifyOrderSelections([]);
      setOriginalOrderSelections([]);
      setActiveModifyOrderIndex(0);
    }
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

  // Whether any order tab has changed modifiers (for per-order modify).
  // New orders (idx >= originalOrderSelections.length) are always considered changed
  // if they have at least one required group filled.
  const isAnyOrderModifyChanged = modifyOrderSelections.length > 0 && modifyOrderSelections.some((sel, idx) => {
    if (idx >= originalOrderSelections.length) {
      // New order — consider changed (needs saving) if it has any selections
      return Object.values(sel).some((mods) => mods.length > 0);
    }
    const orig = originalOrderSelections[idx] || {};
    const groupIds = new Set([...Object.keys(sel), ...Object.keys(orig)]);
    for (const gid of Array.from(groupIds)) {
      const origMods = (orig[gid] || []).map((m) => m.id).sort().join(",");
      const currMods = (sel[gid] || []).map((m) => m.id).sort().join(",");
      if (origMods !== currMods) return true;
    }
    return false;
  });

  // Are there any new (not-yet-in-cart) order tabs?
  const hasNewOrders = modifyOrderSelections.length > originalOrderSelections.length;

  // Check if every new order has all required modifier groups filled
  const allNewOrdersComplete = modifyOrderSelections.every((sel, idx) => {
    if (idx < originalOrderSelections.length) return true; // existing order, skip
    if (!menuItem) return false;
    return menuItem.modifierGroups
      .filter((g) => g.required)
      .every((g) => (sel[g.id] || []).length >= g.minSelect);
  });

  // Active order selections for the modify panel (per-order mode).
  const activeOrderModSelections = modifyOrderSelections[activeModifyOrderIndex] || localModSelections;

  if (!open) return null;

  // ── Item-level drawer ──────────────────────────────────────────────────────
  if (itemContext && cartItem) {
    return (
      <>
        {/* Transparent backdrop — tap outside drawer to dismiss */}
        <div className="absolute inset-0 z-40" onClick={handleClose} />
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
          style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
        >
          {/* Drag handle (tap or swipe-down to dismiss) */}
          <DragHandle onDismiss={handleClose} />

          {/* Item header + order tabs — unified section matching combo sheet pattern */}
          <div className="border-b border-gray-100 shrink-0">
            {/* Title row */}
            <div className="flex items-center gap-2 px-4 pb-2">
              {isItemLevel2PanelOpen && (
                <button
                  onClick={handleBackFromItemLevel2}
                  className={`flex items-center justify-center rounded-full active:bg-gray-100 shrink-0 ${showModifySheet ? "w-8 h-8 -ml-2" : "w-7 h-7"}`}
                  aria-label="Back"
                >
                  <ChevronLeft size={showModifySheet ? 20 : 16} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={showModifySheet ? "text-[15px] font-semibold text-[#1D1B20] leading-tight break-words" : "text-[13px] font-medium leading-snug truncate"}
                  style={showModifySheet ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : undefined}
                >{n(cartItem)}</p>
              </div>
              {!showModifySheet && (
                <>
                  <ActionPriceColumn item={cartItem} />
                  <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
                    <X size={16} />
                  </button>
                </>
              )}
            </div>

            {showModifySheet ? (
              /* Order tabs row — matches MenuSheet Level 3 pattern */
              modifyOrderSelections.length > 0 ? (
                <div className="flex items-center px-4 pb-2">
                  <button
                    onClick={() => {
                      if (!cartItem || !menuItem) return;
                      // Add a new empty order tab — only auto-fill required single-option groups
                      const autoSel: Record<string, Modifier[]> = {};
                      menuItem.modifierGroups?.forEach((g) => {
                        if (g.required && g.options.length === 1) autoSel[g.id] = [g.options[0]];
                      });
                      setModifyOrderSelections((prev) => [...prev, autoSel]);
                      // Do NOT extend originalOrderSelections — new orders are pending
                      setActiveModifyOrderIndex(modifyOrderSelections.length);
                    }}
                    className="w-7 h-7 rounded-full border border-dashed border-[var(--outline-variant)] flex items-center justify-center shrink-0 transition-colors active:bg-gray-50 mr-[12px] disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
                    {modifyOrderSelections.map((sel, i) => {
                      const isNewOrder = i >= originalOrderSelections.length;
                      let showCheck = false;
                      if (isNewOrder) {
                        // New order — show check when all required groups are filled
                        showCheck = !!menuItem && menuItem.modifierGroups
                          .filter((g) => g.required)
                          .every((g) => (sel[g.id] || []).length >= g.minSelect);
                      } else {
                        const orig = originalOrderSelections[i] || {};
                        showCheck = Object.keys(sel).some((gid) => {
                          const origMods = (orig[gid] || []).map((m) => m.id).sort().join(",");
                          const currMods = (sel[gid] || []).map((m) => m.id).sort().join(",");
                          return origMods !== currMods;
                        });
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveModifyOrderIndex(i)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 transition-colors ${
                            i === activeModifyOrderIndex
                              ? "border-[var(--primary)] bg-[var(--primary-light)]"
                              : "border-[var(--outline-variant)]"
                          }`}
                        >
                          {showCheck && <Check size={12} className="text-[var(--primary)]" />}
                          {L.order} {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null
            ) : (
              /* Quantity editor + note order tabs */
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
            )}
          </div>

          {/* Modifier / combo / note / discount details with inline deltas
              per Rule 15. Tap to drill into the modifier panel. */}
          {!showNoteInput && (hasModifiers || cartItem.note || cartItem.discount || cartItem.priceOverride != null) && (
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
              <div className="px-4 py-3 flex flex-col h-full">
                {/* Large full-width note field */}
                <p className="text-[11px] text-[var(--outline)] mb-1.5">{L.addNotes}</p>
                <textarea
                  autoFocus
                  value={selectedNoteTab ? (noteDrafts[selectedNoteTab.key] ?? "") : ""}
                  onChange={(e) => {
                    if (!selectedNoteTab) return;
                    const next = e.target.value;
                    setNoteText(next);
                    setNoteDrafts((prev) => ({ ...prev, [selectedNoteTab.key]: next }));
                  }}
                  placeholder={L.addNotes}
                  rows={2}
                  className="flex-1 min-h-0 rounded-2xl border border-[var(--outline-variant)] px-4 py-3 text-[14px] outline-none resize-none focus:border-[var(--primary)]"
                />

                <div className="flex gap-2 mt-2 shrink-0">
                  <button
                    onClick={() => setShowNoteInput(false)}
                    className="flex-1 h-9 rounded-xl border border-[var(--outline-variant)] text-[12px] font-medium active:bg-gray-50"
                    style={{ color: "#49454F" }}
                  >
                    {L.cancel}
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={(() => {
                      if (!selectedNoteTab) return true;
                      const noteFilled = (noteDrafts[selectedNoteTab.key] ?? selectedNoteTab.note ?? "").trim().length > 0;
                      return !noteFilled;
                    })()}
                    className="flex-1 h-9 rounded-xl text-[12px] font-semibold text-white active:opacity-80 disabled:opacity-40"
                    style={{ background: "#6750A4" }}
                  >
                    {L.saveNote}
                  </button>
                </div>
              </div>
            ) : showPriceOverride ? (
              /* Price override panel */
              <div className="px-4 py-4">
                <p className="text-[12px] text-[var(--outline)] mb-2">{L.enterNewPrice}</p>
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
                    {L.cancel}
                  </button>
                  <button
                    onClick={handleSavePriceOverride}
                    className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white active:opacity-80"
                    style={{ background: "#6750A4" }}
                  >
                    {L.apply}
                  </button>
                </div>
              </div>
            ) : showModifySheet && menuItem && !isCombo ? (
              /* Modifier editor — matches MenuSheet Level 3 */
              <div className="px-4 pb-2">
                {menuItem.modifierGroups?.map((group) => {
                  const selected = activeOrderModSelections[group.id] || [];
                  return (
                    <div key={group.id} className="mb-3">
                      <p className="text-xs font-semibold mb-1.5 text-[#1D1B20]">
                        {n(group)}
                        <span className="font-normal ml-1 text-[12px] text-[var(--outline)]">
                          {group.required ? L.required : L.optional}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.options.map((option) => {
                          const isSelected = selected.some((m) => m.id === option.id);
                          return (
                            <button
                              key={option.id}
                              onClick={() => {
                                const updateSelections = (prev: Record<string, Modifier[]>) => {
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
                                };
                                if (modifyOrderSelections.length > 0) {
                                  setModifyOrderSelections((prev) => {
                                    const copy = [...prev];
                                    copy[activeModifyOrderIndex] = updateSelections(copy[activeModifyOrderIndex]);
                                    return copy;
                                  });
                                } else {
                                  setLocalModSelections(updateSelections);
                                }
                              }}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                                isSelected
                                  ? "border-[var(--primary)] bg-[var(--primary-light)]"
                                  : "border-[var(--outline-variant)]"
                              }`}
                            >
                              <span className="text-xs leading-snug">{n(option)}</span>
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
                <p className="text-[12px] text-[var(--outline)] mb-3">{L.selectPreset}</p>
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
                    {L.custom}
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
                      placeholder={discountInputType === "percent" ? L.customPercent : L.customDollar}
                      className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      onClick={handleApplyCustomDiscount}
                      disabled={!customDiscountInput || Number(customDiscountInput) <= 0}
                      className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                      style={{ background: "#6750A4" }}
                    >
                      {L.apply}
                    </button>
                  </div>
                )}
                {cartItem?.discount && (
                  <button
                    onClick={handleRemoveDiscount}
                    className="w-full h-10 rounded-xl text-sm font-medium mb-2 border border-[#E7E0EC] active:bg-gray-100"
                    style={{ color: "#B3261E" }}
                  >
                    {L.removeDiscount}
                  </button>
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
                  {L.back}
                </button>
              </div>
            ) : (
              /* Action list */
              <div className="p-3 grid grid-cols-2 gap-2">
                <ItemActionButton
                  icon={<Pencil size={16} />}
                  label={L.modify}
                  onClick={openModifyPanel}
                  disabled={!hasModifiers && !isCombo}
                />
                <ItemActionButton
                  icon={<StickyNote size={16} />}
                  label={L.notes}
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
                  label={L.addBreakline}
                  active={!!cartItem.breaklineBelow}
                  activeLabel={language === "zh" ? "開啟" : "On"}
                  value={L.off}
                  onClick={() => { toggleBreakline(cartItem.id, "below"); }}
                />
                <ItemActionButton
                  icon={<Tag size={16} />}
                  label={L.applyDiscount}
                  value={cartItem.discount ? (cartItem.discount.type === "percent" ? `${cartItem.discount.value}%` : `$${cartItem.discount.value.toFixed(2)}`) : undefined}
                  onClick={openDiscountPanel}
                />
                <ItemActionButton
                  icon={<DollarSign size={16} />}
                  label={L.priceOverride}
                  value={cartItem.priceOverride != null ? `$${cartItem.priceOverride.toFixed(2)}` : undefined}
                  onClick={() => { setPriceInput(cartItem.priceOverride?.toFixed(2) ?? ""); setShowPriceOverride(true); }}
                />
                <ItemActionButton
                  icon={<Trash2 size={16} />}
                  label={L.removeItem}
                  destructive
                  onClick={() => { removeItem(cartItem.id); handleClose(); }}
                />
              </div>
            )}
          </div>
          {showModifySheet && menuItem && !isCombo && (() => {
            const activeIsNew = activeModifyOrderIndex >= originalOrderSelections.length;
            return (
            <div className="border-t border-[var(--outline-variant)] px-4 py-3 shrink-0 flex gap-2">
              {activeIsNew ? (
                <button
                  onClick={() => {
                    const idx = activeModifyOrderIndex;
                    setModifyOrderSelections((prev) => prev.filter((_, i) => i !== idx));
                    if (idx >= modifyOrderSelections.length - 1) {
                      setActiveModifyOrderIndex(Math.max(0, idx - 1));
                    }
                  }}
                  className="h-10 px-4 rounded-xl border-2 border-[var(--outline-variant)] text-[var(--outline)] flex items-center justify-center gap-1.5 text-sm font-semibold active:opacity-80 transition-opacity"
                >
                  {L.cancel}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (modifyOrderSelections.length > 1) {
                      const idx = activeModifyOrderIndex;
                      setModifyOrderSelections((prev) => prev.filter((_, i) => i !== idx));
                      setOriginalOrderSelections((prev) => prev.filter((_, i) => i !== idx));
                      updateQuantity(cartItem.id, -1);
                      if (idx >= modifyOrderSelections.length - 1) {
                        setActiveModifyOrderIndex(Math.max(0, idx - 1));
                      }
                    } else {
                      removeItem(cartItem.id);
                      handleClose();
                    }
                  }}
                  className="h-10 px-4 rounded-xl border-2 border-[var(--error)] text-[var(--error)] flex items-center justify-center gap-1.5 text-sm font-semibold active:opacity-80 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                disabled={modifyOrderSelections.length > 0 ? (hasNewOrders ? !allNewOrdersComplete : !isAnyOrderModifyChanged) : !isModifySelectionChanged}
                onClick={() => {
                  if (modifyOrderSelections.length > 0) {
                    // Per-order modify: apply per-order modifiers
                    // each order's modifiers independently.
                    modifyOrderSelections.forEach((sel, idx) => {
                      const isNewOrder = idx >= originalOrderSelections.length;
                      if (isNewOrder) {
                        // New order — add to cart as a new item
                        const modifiers: CartItemModifier[] = Object.entries(sel)
                          .filter(([, mods]) => mods.length > 0)
                          .map(([groupId, mods]) => {
                            const group = menuItem.modifierGroups.find((g) => g.id === groupId)!;
                            return { groupId, groupName: group.name, modifiers: mods };
                          });
                        addItem({
                          menuItemId: cartItem.menuItemId,
                          name: cartItem.name,
                          basePrice: cartItem.basePrice,
                          modifiers,
                        });
                      } else {
                        const orig = originalOrderSelections[idx] || {};
                        const groupIds = new Set([...Object.keys(sel), ...Object.keys(orig)]);
                        let changed = false;
                        for (const gid of Array.from(groupIds)) {
                          const origMods = (orig[gid] || []).map((m) => m.id).sort().join(",");
                          const currMods = (sel[gid] || []).map((m) => m.id).sort().join(",");
                          if (origMods !== currMods) { changed = true; break; }
                        }
                        if (changed) {
                          const modifiers: CartItemModifier[] = Object.entries(sel)
                            .filter(([, mods]) => mods.length > 0)
                            .map(([groupId, mods]) => {
                              const group = menuItem.modifierGroups.find((g) => g.id === groupId)!;
                              return { groupId, groupName: group.name, modifiers: mods };
                            });
                          if (originalOrderSelections.length === 1) {
                            updateItemModifiers(cartItem.id, modifiers);
                          } else {
                            splitOneAndUpdateModifiers(cartItem.id, modifiers);
                          }
                        }
                      }
                    });
                  } else {
                    const modifiers: CartItemModifier[] = Object.entries(localModSelections)
                      .filter(([, mods]) => mods.length > 0)
                      .map(([groupId, mods]) => {
                        const group = menuItem.modifierGroups.find((g) => g.id === groupId)!;
                        return { groupId, groupName: group.name, modifiers: mods };
                      });
                    if (cartItem.quantity > 1) {
                      splitOneAndUpdateModifiers(cartItem.id, modifiers);
                    } else {
                      updateItemModifiers(cartItem.id, modifiers);
                    }
                  }
                  handleClose();
                }}
                className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
              >
                {hasNewOrders ? L.addToOrder : L.saveChanges}
              </button>
            </div>
            );
          })()}
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
      {/* Transparent backdrop — tap outside drawer to dismiss */}
      <div className="absolute inset-0 z-40" onClick={handleClose} />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
        style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
      >
        {/* Drag handle (tap or swipe-down to dismiss) */}
        <DragHandle onDismiss={handleClose} />

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">
                {showDiscountPanel ? L.applyDiscountTitle : showTipPanel ? L.addTip : showVoidConfirm ? L.voidOrder : L.actions}
              </span>
              {!showDiscountPanel && !showTipPanel && !showVoidConfirm && (
                <span className="text-[11px] text-[var(--outline)] truncate">{L.applyToFullCheck}</span>
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
                title={L.sendToKitchen}
                subtitle={sentFeedback ? L.sent : hasUnsentItems ? `${unsentItems.length} ${L.unsent}` : L.allItemsSent}
                disabled={!hasUnsentItems || sentFeedback}
                onClick={handleSendToKitchen}
              />
              <ActionTile
                icon={<Split size={16} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title={L.splitCheck}
                subtitle={L.divideBill}
                disabled={!hasItems}
                onClick={() => { if (hasUnsentItems) markAllSent(); onSplitCheck(); handleClose(); }}
              />
              <ActionTile
                icon={<PauseCircle size={16} />}
                iconBg="#FEF9C3"
                iconColor="#CA8A04"
                title={L.hold}
                subtitle={L.pauseFiring}
                disabled={!hasUnsentItems}
                onClick={handleClose}
              />
              <ActionTile
                icon={<WalletCards size={16} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title={L.multiPay}
                subtitle={L.collectSeparately}
                disabled={!hasItems}
                onClick={() => { if (hasUnsentItems) markAllSent(); onMultiplePayment(); handleClose(); }}
              />
              <ActionTile
                icon={<Tag size={16} />}
                iconBg="#EFF6FF"
                iconColor="#2563EB"
                title={L.applyDiscount}
                subtitle={L.applyToAllItems}
                disabled={!hasItems}
                onClick={openDiscountPanel}
              />
              <ActionTile
                icon={printFeedback ? <Check size={16} /> : <Printer size={16} />}
                iconBg="#E0F2FE"
                iconColor="#0369A1"
                title={L.print}
                subtitle={printFeedback ? L.sentToPrinter : L.printCheckReceipt}
                disabled={!hasItems || printFeedback}
                onClick={handlePrint}
              />
              <ActionTile
                icon={<Banknote size={16} />}
                iconBg="#FEF3C7"
                iconColor="#B45309"
                title={L.addTipLabel}
                subtitle={checkTip > 0 ? `${L.tipAmount} ${checkTip.toFixed(2)}` : L.prePaymentGratuity}
                disabled={!hasItems}
                onClick={openTipPanel}
              />
              <ActionTile
                icon={<Trash2 size={16} />}
                iconBg="#FEE2E2"
                iconColor="#DC2626"
                title={L.voidOrderAction}
                subtitle={L.cancelEntireOrder}
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
              {L.pay} ${payTotal.toFixed(2)}
            </button>
          </div>
        )}

        {/* Discount panel */}
        {showDiscountPanel && (
          <div className="px-4 py-4">
            <p className="text-[12px] text-[#79747E] mb-3">{L.selectPresetDiscount}</p>
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
                {L.custom}
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
                  placeholder={discountInputType === "percent" ? L.customPercent : L.customDollar}
                  className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleApplyCustomDiscount}
                  disabled={!customDiscountInput || Number(customDiscountInput) <= 0}
                  className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "#6750A4" }}
                >
                  {L.apply}
                </button>
              </div>
            )}
            {checkDiscount && (
              <button
                onClick={handleRemoveDiscount}
                className="w-full h-10 rounded-xl text-sm font-medium mb-2 border border-[#E7E0EC] active:bg-gray-100"
                style={{ color: "#B3261E" }}
              >
                {L.removeDiscount}
              </button>
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
              {L.back}
            </button>
          </div>
        )}

        {/* Tip panel — applies a check-level tip before payment.
            Mirrors the discount panel pattern (% / $ toggle, presets,
            custom input) plus a Remove tip option when a tip is set. */}
        {showTipPanel && (
          <div className="px-4 py-4">
            <p className="text-[12px] text-[#79747E] mb-3">
              {L.tipDesc}
              {checkTip > 0 ? ` ${L.currentTip}: ${checkTip.toFixed(2)}` : ""}
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
                {L.custom}
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
                  placeholder={tipInputType === "percent" ? L.customPercent : L.customDollar}
                  className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] px-3 text-[14px] outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleApplyCustomTip}
                  disabled={!customTipInput || Number(customTipInput) <= 0}
                  className="h-10 px-3 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "#6750A4" }}
                >
                  {L.apply}
                </button>
              </div>
            )}
            {checkTip > 0 && (
              <button
                onClick={handleRemoveTip}
                className="w-full h-10 rounded-xl text-sm font-medium mb-2 border border-[#E7E0EC] active:bg-gray-100"
                style={{ color: "#B3261E" }}
              >
                {L.removeTip}
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
              {L.back}
            </button>
          </div>
        )}

        {/* Void confirmation */}
        {showVoidConfirm && (
          <div className="px-4 py-4">
            <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-red-50">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 leading-snug">
                {L.thisWillErase}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleVoidOrder}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center active:opacity-80"
                style={{ background: "#DC2626" }}
              >
                {L.voidOrderAction}
              </button>
              <button
                onClick={() => setShowVoidConfirm(false)}
                className="w-full h-11 rounded-xl text-sm font-medium active:bg-gray-100"
                style={{ color: "#49454F" }}
              >
                {L.cancel}
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
  activeLabel,
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
  activeLabel?: string;
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
              {active ? (activeLabel || "On") : value}
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

  return (
    <span className="text-[13px] font-semibold text-[#1D1B20] shrink-0 tabular-nums">
      {formatCurrency(breakdown.effectiveUnitPrice)}
    </span>
  );
}

/**
 * Rule 15 inline-delta description for the Action Drawer item header.
 * Modifiers, combo selections, notes show their `+$X`/`−$X` deltas inline.
 * Discount renders as its own line. Override suppresses inline deltas and
 * shows a single "Override" label.
 */
function ActionItemDescription({ item }: { item: import("@/lib/types").CartItem }) {
  const language = useOrderStore((s) => s.language);
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
                {language === "zh" && m.nameCn ? m.nameCn : m.name}
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
                {language === "zh" && s.component.nameCn ? s.component.nameCn : s.component.name}
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
                          {language === "zh" && m.nameCn ? m.nameCn : m.name}
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
          {language === "zh" ? "備註" : "Note"}: {item.note}
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
        <p className="text-[11px] text-[var(--primary)] italic leading-relaxed">{language === "zh" ? "改價" : "Override"}</p>
      )}
    </>
  );
}
