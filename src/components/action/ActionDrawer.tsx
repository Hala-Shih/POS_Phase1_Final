"use client";

import { useState } from "react";
import { X, Send, PauseCircle, Tag, Trash2, Users, CreditCard, AlertTriangle, Check, StickyNote, Minus, Plus, Pencil, DollarSign, ArrowDownToLine, ChevronLeft } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem, Modifier, CartItemModifier } from "@/lib/types";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";

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
  const { cartItems, cartTotal, markAllSent, resetOrder, setItemDiscount, removeItem, updateQuantity, updateNote, setItemPriceOverride, toggleBreakline, updateItemModifiers, updateComboSelections, splitAndUpdateNotes } = useOrderStore();

  // Check-level states
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [showCustomDiscountInput, setShowCustomDiscountInput] = useState(false);
  const [customDiscountInput, setCustomDiscountInput] = useState("");
  const [discountInputType, setDiscountInputType] = useState<"percent" | "amount">("percent");
  const [sentFeedback, setSentFeedback] = useState(false);

  // Item-level states
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [, setNoteText] = useState("");
  const [activeNoteOrderKey, setActiveNoteOrderKey] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [showPriceOverride, setShowPriceOverride] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [showModifySheet, setShowModifySheet] = useState(false);
  const [localModSelections, setLocalModSelections] = useState<Record<string, Modifier[]>>({});
  const [originalModSelections, setOriginalModSelections] = useState<Record<string, Modifier[]>>({});

  const unsentItems = cartItems.filter((i) => !i.sent);
  const hasUnsentItems = unsentItems.length > 0;
  const hasItems = cartItems.length > 0;
  const paySubtotal = cartTotal();
  const payTotal = roundCurrency(paySubtotal * (1 + TAX_RATE));

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
    setShowNoteInput(false);
    setNoteText("");
    setActiveNoteOrderKey(null);
    setNoteDrafts({});
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
      cartItems.forEach((item) => {
        setItemDiscount(item.id, { type, value: normalizedValue });
      });
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
    setShowPriceOverride(false);
    setShowDiscountPanel(false);
    setShowCustomDiscountInput(false);
    setCustomDiscountInput("");
    setDiscountInputType("percent");
    setShowModifySheet(false);
    setLocalModSelections({});
    setOriginalModSelections({});
  };
  // Shared function: open modify panel with pre-populated selections
  const openModifyPanel = () => {
    if (!cartItem) return;
    const initial: Record<string, Modifier[]> = {};
    cartItem.modifiers.forEach((cm) => { initial[cm.groupId] = [...cm.modifiers]; });
    setLocalModSelections(initial);
    setOriginalModSelections(initial);
    setShowModifySheet(true);
  };

  if (!open) return null;

  // ── Item-level drawer ──────────────────────────────────────────────────────
  if (itemContext && cartItem) {
    return (
      <>
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
          style={{ height: "68%", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
        >
          {/* Drag handle */}
          <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={handleClose}>
            <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
          </div>

          {/* Item header + order tabs — unified section matching combo sheet pattern */}
          <div className="border-b border-gray-100 shrink-0">
            {/* Title row + qty editor */}
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
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    if (cartItem.sent) return;
                    if (cartItem.quantity <= 1) { removeItem(cartItem.id); handleClose(); }
                    else updateQuantity(cartItem.id, -1);
                  }}
                  className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100 disabled:opacity-30"
                  disabled={cartItem.sent}
                >
                  {cartItem.quantity <= 1 ? <Trash2 size={12} className="text-[var(--error)]" /> : <Minus size={12} />}
                </button>
                <span className="text-[13px] font-semibold min-w-[16px] text-center">{cartItem.quantity}</span>
                <button
                  onClick={() => {
                    if (cartItem.sent) return;
                    updateQuantity(cartItem.id, 1);
                  }}
                  className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100 disabled:opacity-30"
                  disabled={cartItem.sent}
                >
                  <Plus size={12} />
                </button>
              </div>
              <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Order tabs row — only shown when drilled into a sub-panel (notes / discount / price) */}
            {noteOrderTabs.length > 1 && isItemLevel2PanelOpen && (
              <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
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

          {/* Modifier / combo details */}
          {hasModifiers && (
            <button
              onClick={openModifyPanel}
              className="w-full px-4 py-2 border-b border-gray-100 shrink-0 text-left active:bg-[var(--surface)] transition-colors"
            >
              {cartItem.modifiers.length > 0 && (
                <p className="text-[11px] text-[var(--outline)] leading-relaxed">
                  {cartItem.modifiers.flatMap((g) => g.modifiers.map((m) => m.name)).join(", ")}
                </p>
              )}
              {cartItem.comboSelections && cartItem.comboSelections.length > 0 && (
                <p className="text-[11px] text-[var(--outline)] leading-relaxed">
                  {cartItem.comboSelections.map((s) => {
                    const mods = s.modifiers.flatMap((g) => g.modifiers.map((m) => m.name));
                    const base = `${s.groupName}: ${s.component.name}`;
                    return mods.length > 0 ? `${base} (${mods.join(", ")})` : base;
                  }).join(" · ")}
                </p>
              )}
            </button>
          )}

          {/* Scrollable action area */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">

            {/* Notes input (expanded inline) */}
            {showNoteInput ? (
              <div className="px-4 py-4">
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
                  placeholder="e.g. No salt, extra crispy..."
                  rows={3}
                  className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-[13px] outline-none resize-none focus:border-[var(--primary)]"
                />
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
                    disabled={!selectedNoteTab || (noteDrafts[selectedNoteTab.key] ?? selectedNoteTab.note ?? "").trim().length === 0}
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
                  updateItemModifiers(cartItem.id, modifiers);
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
            existingCartItems={[cartItem]}
            onClose={() => setShowModifySheet(false)}
            onAdd={() => setShowModifySheet(false)}
            onUpdateExisting={(cartItemId, comboSelections) => {
              updateComboSelections(cartItemId, comboSelections);
              setShowModifySheet(false);
              handleClose();
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
        style={{ height: "60%", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={handleClose}>
          <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold">
              {showDiscountPanel ? "Apply Discount" : showVoidConfirm ? "Void Order" : "Actions"}
            </span>
            {!showDiscountPanel && !showVoidConfirm && (
              <span className="text-[11px] text-[var(--outline)] mt-0.5">Actions apply to the whole check</span>
            )}
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Main actions grid */}
        {!showVoidConfirm && !showDiscountPanel && (
          <div className="flex-1 overflow-y-auto thin-scrollbar p-3">
            <div className="grid grid-cols-2 gap-2.5">
              <ActionTile
                icon={sentFeedback ? <Check size={20} /> : <Send size={20} />}
                iconBg="#DCFCE7"
                iconColor="#16A34A"
                title="Send to kitchen"
                subtitle={sentFeedback ? "Sent!" : hasUnsentItems ? `${unsentItems.length} unsent` : "All items sent"}
                disabled={!hasUnsentItems || sentFeedback}
                onClick={handleSendToKitchen}
              />
              <ActionTile
                icon={<PauseCircle size={20} />}
                iconBg="#FEF9C3"
                iconColor="#CA8A04"
                title="Hold"
                subtitle="Pause firing course"
                disabled={!hasUnsentItems}
                onClick={handleClose}
              />
              <ActionTile
                icon={<Tag size={20} />}
                iconBg="#EFF6FF"
                iconColor="#2563EB"
                title="Apply discount"
                subtitle="Apply to all items"
                disabled={!hasItems}
                onClick={openDiscountPanel}
              />
              <ActionTile
                icon={<Users size={20} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title="Split check"
                subtitle="Divide bill among guests"
                disabled={!hasItems}
                onClick={() => { onSplitCheck(); handleClose(); }}
              />
              <ActionTile
                icon={<CreditCard size={20} />}
                iconBg="#F3EDF7"
                iconColor="#6750A4"
                title="Multiple payment"
                subtitle="Collect separately"
                disabled={!hasItems}
                onClick={() => { onMultiplePayment(); handleClose(); }}
              />
              <ActionTile
                icon={<Trash2 size={20} />}
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

        {!showVoidConfirm && !showDiscountPanel && (
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
            <button
              onClick={() => {
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

        <div style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }} />
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
      className="flex items-center justify-center rounded-2xl border border-[#E7E0EC] bg-white active:bg-gray-50 transition-colors disabled:opacity-40"
      style={{ height: 44 }}
    >
      <span className="text-[13px] font-semibold" style={{ color: destructive ? "#DC2626" : "#1D1B20" }}>
        {title}
      </span>
    </button>
  );
}
