"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  CreditCard,
  StickyNote,
  GitFork,
  Send,
  Minus,
  Plus,
  Trash2,
  BookOpen,
  Printer,
  LayoutGrid,
} from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import { getPriceBreakdown, formatCurrency, formatSignedCurrency } from "@/lib/pricing";
import staffData from "@/data/staff.json";
import tablesData from "@/data/tables.json";
import { Staff, Table } from "@/lib/types";
import CartDrawer from "@/components/cart/CartDrawer";
import MenuSheet from "@/components/menu/MenuSheet";
import SearchDrawer from "@/components/menu/SearchDrawer";
import Header from "@/components/ui/Header";

type ExternalDrawerType = "none" | "action" | "payment";

export default function CheckSummaryScreen({ menuOpen: externalMenuOpen, setMenuOpen: externalSetMenuOpen, searchOpen: externalSearchOpen, setSearchOpen: externalSetSearchOpen, itemActionOpen = false, externalDrawerType = "none", onOpenItemActions, onOpenPaymentDrawer, onBack }: { menuOpen?: boolean; setMenuOpen?: (v: boolean) => void; searchOpen?: boolean; setSearchOpen?: (v: boolean) => void; itemActionOpen?: boolean; externalDrawerType?: ExternalDrawerType; onOpenItemActions?: (item: { id: string; name: string }) => void; onOpenPaymentDrawer?: () => void; onBack?: () => void } = {}) {
  const {
    currentStaff,
    selectedTable,
    guestCount,
    cartItems,
    cartTotal,
    cartCount,
    checkTip,
    checkDiscount,
    markAllSent,
    setScreen,
    resetOrder,
    setStaff,
    setTable,
    openMenuOnArrival,
    setOpenMenuOnArrival,
    lastAddedItemId,
    updateNote,
    updatePriceAdjustment,
    toggleBreakline,
  } = useOrderStore();

  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuOpen = externalMenuOpen ?? internalMenuOpen;
  const setMenuOpen = externalSetMenuOpen ?? setInternalMenuOpen;

  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const searchOpen = externalSearchOpen ?? internalSearchOpen;
  const setSearchOpen = externalSetSearchOpen ?? setInternalSearchOpen;

  useEffect(() => {
    if (openMenuOnArrival) {
      setSearchOpen(false);
      setMenuOpen(true);
      setOpenMenuOnArrival(false);
    }
  }, [openMenuOnArrival, setOpenMenuOnArrival, setMenuOpen, setSearchOpen]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showNoteDrawer, setShowNoteDrawer] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  // "general" = order-level note, item id = item-specific note
  const [noteTarget, setNoteTarget] = useState<string>("general");
  // Price adjustment draft: sign (+1 or -1) and value string
  const [priceAdjSign, setPriceAdjSign] = useState<1 | -1>(1);
  const [priceAdjValue, setPriceAdjValue] = useState("");
  const [breaklineDraft, setBreaklineDraft] = useState(false);
  const [showTableActions, setShowTableActions] = useState(false);
  const selectedItemId: string | null = null;

  const collapseToCheck = () => {
    if (menuOpen) setMenuOpen(false);
    if (searchOpen) setSearchOpen(false);
  };

  const total = cartTotal();
  const count = cartCount();
  const unsentItems = cartItems.filter((i) => !i.sent);
  const sentItems = cartItems.filter((i) => i.sent);
  const anyUnsent = unsentItems.length > 0;
  const isEmpty = cartItems.length === 0;

  const preDiscountSubtotal = cartItems.reduce((sum, item) => {
    if (item.comped) return sum;
    if (item.priceOverride != null) return sum + item.priceOverride * item.quantity;
    const modifierTotal = item.modifiers.reduce(
      (modSum, group) => modSum + group.modifiers.reduce((mSum, mod) => mSum + mod.price, 0),
      0
    );
    const comboTotal = (item.comboSelections || []).reduce((comboSum, selection) => {
      const componentPrice = selection.component.price;
      const comboModPrice = selection.modifiers.reduce(
        (gSum, group) => gSum + group.modifiers.reduce((mSum, mod) => mSum + mod.price, 0),
        0
      );
      return comboSum + componentPrice + comboModPrice;
    }, 0);
    const unit = item.basePrice + modifierTotal + comboTotal + (item.priceAdjustment || 0);
    return sum + unit * item.quantity;
  }, 0);
  const subtotal = total;
  const itemDiscountTotal = Math.max(0, preDiscountSubtotal - subtotal);
  // Apply check-level discount on top of any per-item discounts.
  const checkDiscountAmount = checkDiscount
    ? checkDiscount.type === "percent"
      ? Math.round(subtotal * (Math.min(100, checkDiscount.value) / 100) * 100) / 100
      : Math.min(subtotal, checkDiscount.value)
    : 0;
  const discountedSubtotal = Math.max(0, subtotal - checkDiscountAmount);
  const discountTotal = itemDiscountTotal + checkDiscountAmount;
  const tax = Math.round(discountedSubtotal * 0.0875 * 100) / 100;
  const tip = checkTip;
  const grandTotal = discountedSubtotal + tax + tip;
  const fullHeightDrawerOpen = menuOpen || searchOpen || cartOpen;
  const actionDrawerOpen = itemActionOpen || externalDrawerType === "action";
  const paymentDrawerOpen = externalDrawerType === "payment";
  const anyDrawerOpen = fullHeightDrawerOpen || actionDrawerOpen || paymentDrawerOpen;
  const comboSheetOpen = useOrderStore((s) => s.comboSheetOpen);

  // App-shell drawers open at 60% + 20px (Rule 12). The combo configuration
  // sheet is taller (75%), so when it's open we reserve that height instead
  // so totals stay visible above it and the list can scroll fully.
  // When a full-height drawer is open AND there are items, we add extra space
  // for the quick action row which is now rendered inside the drawer.
  const drawerReservedHeight = comboSheetOpen
    ? "calc(var(--device-height) * 0.75)"
    : anyDrawerOpen
    ? `calc(var(--device-height) * 0.55)`
    : undefined;

  const handlePay = () => {
    if (anyUnsent) markAllSent();
    if (onOpenPaymentDrawer) {
      onOpenPaymentDrawer();
      return;
    }
    setScreen("payment");
  };

  const handleTransfer = (staff: Staff) => setStaff(staff);
  const handleTransferTable = (table: Table) => setTable(table);
  const handleVoidOrder = () => { resetOrder(); setScreen("tables"); };

  return (
    <div className="h-full flex flex-col relative bg-white">
      {/* Header */}
      <Header
        onBack={onBack ?? (() => setScreen("tables"))}
        serverName={currentStaff?.name}
        tableName={selectedTable?.name}
        guestCount={guestCount}
        onGuestCountTap={() => setScreen("guest-count")}
        onTableTap={() => setScreen("tables")}
        onTransfer={handleTransfer}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
        onTransferTable={handleTransferTable}
        onVoidOrder={handleVoidOrder}
        tableList={tablesData as Table[]}
        currentTableId={selectedTable?.id}
        onCollapseDrawers={collapseToCheck}
        checkTotal={grandTotal}
      />

      {/* Scrollable check body — viewport is reduced when a drawer is open
          so items never scroll behind the drawer surface. */}
      <div
        className="flex-1 overflow-y-auto thin-scrollbar min-h-0"
        style={
          anyDrawerOpen || comboSheetOpen
            ? { paddingBottom: drawerReservedHeight }
            : undefined
        }
      >
        {isEmpty ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center cursor-pointer active:opacity-70 transition-opacity"
            onClick={() => setMenuOpen(true)}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#F3EDF7", color: "#6750A4" }}
            >
              <CreditCard size={26} />
            </div>
            <p className="text-base font-semibold">Add item</p>
          </div>
        ) : (
          <>
            {/* Unsent group */}
            {unsentItems.length > 0 && (
              <div>
                {sentItems.length > 0 && (
                  <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100">
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">New · Not Sent</span>
                  </div>
                )}
                {unsentItems.map((item) => (
                  <CheckItem
                    key={item.id}
                    item={item}
                    onInteract={collapseToCheck}
                    onTap={() => onOpenItemActions?.({ id: item.id, name: item.name })}
                    drawerOpen={anyDrawerOpen}
                    muted={false}
                    selected={selectedItemId === item.id}
                  />
                ))}
              </div>
            )}

            {/* Sent group */}
            {sentItems.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-green-50 border-b border-green-100">
                  <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Sent to Kitchen</span>
                </div>
                {sentItems.map((item) => (
                  <CheckItem
                    key={item.id}
                    item={item}
                    onInteract={collapseToCheck}
                    onTap={() => onOpenItemActions?.({ id: item.id, name: item.name })}
                    drawerOpen={anyDrawerOpen}
                    muted
                    selected={selectedItemId === item.id}
                  />
                ))}
              </div>
            )}

            {/* General order note */}
            {orderNote && (
              <div className="px-4 py-2.5 border-t border-gray-100 flex items-start gap-2">
                <StickyNote size={14} className="text-[var(--outline)] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[var(--outline)] italic leading-snug">{orderNote}</p>
              </div>
            )}

            {/* Totals */}
            <div className="px-4 pt-3 pb-4 border-t border-gray-100 bg-[#FBFAFF]">
              <TotalsRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
              {discountTotal > 0 && (
                <TotalsRow
                  label={
                    checkDiscount && checkDiscount.type === "percent" && itemDiscountTotal === 0
                      ? `Discount (${checkDiscount.value}%)`
                      : "Discount"
                  }
                  value={`-$${discountTotal.toFixed(2)}`}
                  muted
                />
              )}
              <TotalsRow label="Tax (8.75%)" value={`$${tax.toFixed(2)}`} muted />
              <TotalsRow
                label={tip > 0 && subtotal > 0 ? `Tip (${(tip / subtotal * 100).toFixed(tip / subtotal * 100 >= 10 ? 0 : 1)}%)` : "Tip"}
                value={`$${tip.toFixed(2)}`}
                muted
              />
              <div className="h-1.5" />
              <TotalsRow label="Total" value={`$${grandTotal.toFixed(2)}`} bold large />
            </div>
          </>
        )}
      </div>

      {/* Full action grid — visible on check summary (no drawer open) */}
      <div className={`px-3 pb-3 pt-3 bg-[#F0EFF4] shrink-0 border-t border-gray-300 ${fullHeightDrawerOpen ? "hidden" : ""}`}>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { markAllSent(); }}
            disabled={unsentItems.length === 0}
            className="flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
          >
            <Send size={18} className="text-gray-500 shrink-0" />
            Send
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70"
          >
            <BookOpen size={18} className="text-gray-500 shrink-0" />
            Load menu
          </button>
          <button
            disabled={isEmpty}
            className="flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
          >
            <Printer size={18} className="text-gray-500 shrink-0" />
            Print check
          </button>
          <button
            onClick={handlePay}
            disabled={isEmpty}
            className="flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
          >
            <CreditCard size={18} className="text-gray-500 shrink-0" />
            Pay
          </button>
          <button
            disabled={isEmpty}
            className="flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
          >
            <GitFork size={18} className="text-gray-500 shrink-0" />
            Split check
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTableActions(!showTableActions)}
              className="w-full flex items-center gap-2.5 px-3 h-[48px] rounded-xl border border-gray-200 text-[13px] font-medium bg-white transition-colors active:opacity-70"
            >
              <LayoutGrid size={18} className="text-gray-500 shrink-0" />
              Table actions
            </button>
            {showTableActions && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowTableActions(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-lg border border-gray-200 z-[61] py-1 overflow-hidden">
                  {["Share Table", "Transfer Table", "Clear Table", "Combine Table"].map((action) => (
                    <button
                      key={action}
                      onClick={() => setShowTableActions(false)}
                      className="w-full px-4 py-3 text-left text-[13px] font-medium active:bg-gray-50 transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Menu sheet */}
      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        actionButtons={
            <div className="flex gap-2 px-3 py-3 border-b border-gray-200 shrink-0 bg-white">
              <button
                onClick={() => { markAllSent(); }}
                disabled={isEmpty || unsentItems.length === 0}
                className="flex-1 flex items-center justify-center h-[48px] rounded-xl border border-gray-800 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
              >
                Send
              </button>
              <button
                onClick={() => { setScreen("tables"); }}
                disabled={isEmpty}
                className="flex-1 flex items-center justify-center h-[48px] rounded-xl border border-gray-800 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
              >
                Hold
              </button>
              <button
                onClick={handlePay}
                disabled={isEmpty}
                className="flex-1 flex items-center justify-center h-[48px] rounded-xl border border-gray-800 text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40"
              >
                Pay
              </button>
              <button
                onClick={() => {
                  // Default to the last added item, or "general" if none
                  const defaultTarget = lastAddedItemId && cartItems.find(i => i.id === lastAddedItemId) ? lastAddedItemId : "general";
                  setNoteTarget(defaultTarget);
                  // Load the existing note for that target
                  if (defaultTarget === "general") {
                    setNoteDraft(orderNote);
                    setPriceAdjSign(1);
                    setPriceAdjValue("");
                    setBreaklineDraft(false);
                  } else {
                    const item = cartItems.find(i => i.id === defaultTarget);
                    setNoteDraft(item?.note || "");
                    const adj = item?.priceAdjustment || 0;
                    setPriceAdjSign(adj < 0 ? -1 : 1);
                    setPriceAdjValue(adj !== 0 ? String(Math.abs(adj)) : "");
                    setBreaklineDraft(!!item?.breaklineBelow);
                  }
                  setShowNoteDrawer(true);
                }}
                disabled={isEmpty}
                className={`flex-1 flex items-center justify-center h-[48px] rounded-xl border text-[13px] font-medium bg-white transition-colors active:opacity-70 disabled:opacity-40 ${
                  orderNote || cartItems.some(i => i.note) ? "border-[var(--primary)] text-[var(--primary)]" : "border-gray-800"
                }`}
              >
                Note
              </button>
            </div>
        }
      />

      {/* Search drawer */}
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Cart drawer (for editing items) */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Note drawer with item selector */}
      {showNoteDrawer && (
        <>
          <div className="absolute inset-0 bg-black/30 z-[200]" onClick={() => setShowNoteDrawer(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-[201] bg-white rounded-t-2xl shadow-2xl p-4 pb-6" style={{ maxHeight: "92%" }}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
            <p className="text-[13px] font-semibold mb-2">Add Note</p>

            {/* Target selector - radio list */}
            <div className="flex flex-col gap-1 mb-3 max-h-[220px] overflow-y-auto">
              <label
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  noteTarget === "general" ? "bg-[var(--primary)]/8" : "hover:bg-gray-50"
                }`}
                onClick={() => { setNoteTarget("general"); setNoteDraft(orderNote); setPriceAdjSign(1); setPriceAdjValue(""); setBreaklineDraft(false); }}
              >
                <span className={`w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                  noteTarget === "general" ? "border-[var(--primary)] bg-[var(--primary)]" : "border-gray-300"
                }`}>
                  {noteTarget === "general" && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
                <span className="text-[13px] font-medium">General Note</span>
                {orderNote && <span className="ml-auto text-[11px] text-gray-400 truncate max-w-[100px]">{orderNote}</span>}
              </label>
              {cartItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    noteTarget === item.id ? "bg-[var(--primary)]/8" : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setNoteTarget(item.id);
                    setNoteDraft(item.note || "");
                    const adj = item.priceAdjustment || 0;
                    setPriceAdjSign(adj < 0 ? -1 : 1);
                    setPriceAdjValue(adj !== 0 ? String(Math.abs(adj)) : "");
                    setBreaklineDraft(!!item.breaklineBelow);
                  }}
                >
                  <span className={`w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    noteTarget === item.id ? "border-[var(--primary)] bg-[var(--primary)]" : "border-gray-300"
                  }`}>
                    {noteTarget === item.id && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  <span className="text-[13px] truncate">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</span>
                  {(item.note || item.priceAdjustment) && (
                    <span className="ml-auto text-[11px] text-gray-400 truncate max-w-[100px]">
                      {item.note || (item.priceAdjustment ? `${item.priceAdjustment > 0 ? "+" : ""}${item.priceAdjustment.toFixed(2)}` : "")}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {/* Note + Price adjustment row */}
            <div className={`flex gap-3 items-start ${noteTarget !== "general" ? "" : ""}`}>
              <div className={noteTarget !== "general" ? "flex-1 min-w-0" : "w-full"}>
                <p className="text-[12px] text-[var(--outline)] mb-2">Add a note for the kitchen</p>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add notes"
                  rows={3}
                  className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2.5 text-[13px] outline-none resize-none focus:border-[var(--primary)]"
                />
              </div>
              {noteTarget !== "general" && (
                <div className="shrink-0">
                  <p className="text-[12px] text-[var(--outline)] mb-2">Price adjustment</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex rounded-xl border border-[var(--outline-variant)] overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setPriceAdjSign(1)}
                        className={`w-9 h-11 flex items-center justify-center text-[15px] font-semibold ${
                          priceAdjSign === 1
                            ? "bg-[var(--primary-light)] text-[var(--primary)]"
                            : "text-[var(--outline)] active:bg-gray-50"
                        }`}
                        aria-pressed={priceAdjSign === 1}
                        aria-label="Increase price"
                      >+</button>
                      <button
                        type="button"
                        onClick={() => setPriceAdjSign(-1)}
                        className={`w-9 h-11 flex items-center justify-center text-[15px] font-semibold border-l border-[var(--outline-variant)] ${
                          priceAdjSign === -1
                            ? "bg-[var(--primary-light)] text-[var(--primary)]"
                            : "text-[var(--outline)] active:bg-gray-50"
                        }`}
                        aria-pressed={priceAdjSign === -1}
                        aria-label="Decrease price"
                      >−</button>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={priceAdjValue}
                      onChange={(e) => setPriceAdjValue(e.target.value)}
                      className="w-16 h-11 rounded-xl border border-[var(--outline-variant)] px-2 text-[13px] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Add breakline checkbox (item only) */}
            {noteTarget !== "general" && (
              <label className="flex items-center gap-2.5 mt-1 mb-1 cursor-pointer">
                <span
                  className={`w-[18px] h-[18px] shrink-0 rounded flex items-center justify-center border-2 transition-colors ${
                    breaklineDraft ? "border-[var(--primary)] bg-[var(--primary)]" : "border-gray-300"
                  }`}
                  onClick={(e) => { e.preventDefault(); setBreaklineDraft(!breaklineDraft); }}
                >
                  {breaklineDraft && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </span>
                <span className="text-[13px] text-black">Add breakline below</span>
              </label>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowNoteDrawer(false)}
                className="flex-1 h-10 rounded-xl border border-[var(--outline-variant)] text-[13px] font-medium active:bg-gray-50"
                style={{ color: "#49454F" }}
              >
                Cancel
              </button>
              {((noteTarget === "general" && orderNote) || (noteTarget !== "general" && (cartItems.find(i => i.id === noteTarget)?.note || cartItems.find(i => i.id === noteTarget)?.priceAdjustment))) && (
                <button
                  onClick={() => {
                    if (noteTarget === "general") {
                      setOrderNote("");
                    } else {
                      updateNote(noteTarget, "");
                      updatePriceAdjustment(noteTarget, 0);
                      const currentItem = cartItems.find(i => i.id === noteTarget);
                      if (currentItem?.breaklineBelow) {
                        toggleBreakline(noteTarget, "below");
                      }
                    }
                    setNoteDraft("");
                    setPriceAdjValue("");
                    setBreaklineDraft(false);
                    setShowNoteDrawer(false);
                  }}
                  className="flex-1 h-10 rounded-xl border border-red-300 bg-red-50 text-[13px] font-medium text-red-600 active:bg-red-100"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => {
                  const trimmed = noteDraft.trim();
                  if (noteTarget === "general") {
                    setOrderNote(trimmed);
                  } else {
                    updateNote(noteTarget, trimmed);
                    const numVal = parseFloat(priceAdjValue);
                    const adjAmount = !isNaN(numVal) && numVal > 0 ? numVal * priceAdjSign : 0;
                    updatePriceAdjustment(noteTarget, adjAmount);
                    // Sync breakline state
                    const currentItem = cartItems.find(i => i.id === noteTarget);
                    if (currentItem && !!currentItem.breaklineBelow !== breaklineDraft) {
                      toggleBreakline(noteTarget, "below");
                    }
                  }
                  setShowNoteDrawer(false);
                }}
                disabled={(() => {
                  if (noteTarget === "general") {
                    return noteDraft.trim() === orderNote;
                  } else {
                    const item = cartItems.find(i => i.id === noteTarget);
                    const origNote = item?.note || "";
                    const origAdj = item?.priceAdjustment || 0;
                    const origBreakline = !!item?.breaklineBelow;
                    const numVal = parseFloat(priceAdjValue);
                    const newAdj = !isNaN(numVal) && numVal > 0 ? numVal * priceAdjSign : 0;
                    return noteDraft.trim() === origNote && newAdj === origAdj && breaklineDraft === origBreakline;
                  }
                })()}
                className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-40"
                style={{ background: "#6750A4" }}
              >
                Save changes
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

/* ── Subcomponents ── */

function CheckItem({
  item,
  muted,
  onTap,
  onInteract,
  drawerOpen,
  selected,
}: {
  item: ReturnType<typeof useOrderStore.getState>["cartItems"][number];
  muted: boolean;
  onTap: () => void;
  onInteract?: () => void;
  drawerOpen?: boolean;
  selected?: boolean;
}) {
  const { updateQuantity, removeItem, updateNote } = useOrderStore();
  const [showNoteFlyout, setShowNoteFlyout] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note || "");
  const noteBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div
        className={`border-b border-gray-50 transition-colors ${selected ? "bg-[var(--primary-light)]" : ""}`}
        style={{
          boxShadow: [
            item.breaklineAbove ? "inset 0 1px 0 0 #000" : "",
            item.breaklineBelow ? "inset 0 -1px 0 0 #000" : "",
          ].filter(Boolean).join(", ") || undefined,
        }}
      >
        <button
          onClick={() => {
            // When a drawer is open, ignore taps on cart items entirely.
            // The user must use the check button in the header to return
            // to the full order-summary view.
            if (drawerOpen) {
              return;
            }
            onInteract?.();
            onTap();
          }}
          className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${drawerOpen ? "" : "active:bg-[var(--surface)]"}`}
        >
          {/* Qty badge */}
          <span
            className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{
              background: item.sent ? "#E8F5E9" : "#FFF8E1",
              color: item.sent ? "var(--success)" : "#B5790D",
            }}
          >
            {item.quantity}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-medium leading-snug ${muted ? "text-[var(--outline)]" : ""}`}>
              {item.name}
            </p>
            {/* Rule 15: inline deltas next to each cause. When override is
                active, modifier/combo/note/discount inline deltas are
                suppressed and a single "Override" label is shown instead. */}
            <ItemDescription item={item} />
          </div>
          {/* Rule 15: compact two-line price display — original price on top,
              net adjustment / override line below. Per-unit prices. */}
          <PriceColumn item={item} muted={muted} />
        </button>

        {/* Inline actions + quantity editor when selected */}
        {selected && (
          <div className="px-4 pb-2.5">
            {/* Quantity editor row */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInteract?.();
                  if (item.quantity <= 1) removeItem(item.id);
                  else updateQuantity(item.id, -1);
                }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
              >
                {item.quantity <= 1 ? <Trash2 size={13} className="text-[var(--error)]" /> : <Minus size={13} />}
              </button>
              <span className="text-sm font-semibold min-w-[16px] text-center">{item.quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInteract?.();
                  updateQuantity(item.id, 1);
                }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
              >
                <Plus size={13} />
              </button>
            </div>
            {/* Action buttons row */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <div className="shrink-0">
                <button
                  ref={noteBtnRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteDraft(item.note || "");
                    setShowNoteFlyout(!showNoteFlyout);
                  }}
                  className={`flex items-center gap-1 px-2.5 h-[44px] rounded-lg border text-[11px] font-medium active:bg-gray-100 ${
                    showNoteFlyout || item.note
                      ? "border-[var(--primary)] bg-[var(--primary-light)]"
                      : "border-[var(--outline-variant)]"
                  }`}
                >
                  <StickyNote size={11} /> Notes
                </button>
                {showNoteFlyout && (() => {
                  const rect = noteBtnRef.current?.getBoundingClientRect();
                  const top = rect ? rect.top - 8 : 0;
                  const left = rect ? rect.left : 16;
                  return (
                    <>
                      <div className="fixed inset-0 z-[200]" onClick={() => setShowNoteFlyout(false)} />
                      <div
                        className="fixed z-[201] bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-[260px]"
                        style={{ bottom: `${window.innerHeight - top}px`, left: `${Math.min(left, window.innerWidth - 276)}px` }}
                      >
                        <p className="text-[12px] text-[var(--outline)] mb-1.5">Add a note for the kitchen</p>
                        <textarea
                          autoFocus
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Add notes"
                          rows={2}
                          className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-[13px] outline-none resize-none focus:border-[var(--primary)]"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setShowNoteFlyout(false)}
                            className="flex-1 h-9 rounded-lg border border-[var(--outline-variant)] text-[12px] font-medium active:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              updateNote(item.id, noteDraft.trim());
                              setShowNoteFlyout(false);
                            }}
                            className="flex-1 h-9 rounded-lg text-[12px] font-semibold text-white active:opacity-80"
                            style={{ background: "#6750A4" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button className="flex items-center gap-1 px-2.5 h-[44px] rounded-lg border border-[var(--outline-variant)] text-[11px] font-medium shrink-0 active:bg-gray-100">
                <ArrowLeft size={11} className="rotate-90" /> Breakline
              </button>
              <button className="flex items-center gap-1 px-2.5 h-[44px] rounded-lg border border-[var(--outline-variant)] text-[11px] font-medium shrink-0 active:bg-gray-100">
                <CreditCard size={11} /> Price
              </button>
              <button className="flex items-center gap-1 px-2.5 h-[44px] rounded-lg border border-[var(--outline-variant)] text-[11px] font-medium shrink-0 active:bg-gray-100">
                <GitFork size={11} /> Comp
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TotalsRow({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-baseline py-0.5 ${large ? "text-[17px]" : "text-[13px]"} ${
        bold ? "font-bold" : "font-normal"
      } ${muted ? "text-[var(--outline)]" : "text-[var(--foreground)]"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Rule 15 inline-delta description region.
 * Each price-changing cause shows its `+$X` / `−$X` token next to its own
 * text. When override is active, deltas are suppressed and a single
 * `Override` label is rendered instead.
 */
function ItemDescription({
  item,
}: {
  item: ReturnType<typeof useOrderStore.getState>["cartItems"][number];
}) {
  const breakdown = getPriceBreakdown(item);
  const overrideActive = breakdown.hasOverride;

  // Lookup tables for inline modifier deltas.
  const modDelta = new Map<string, number>();
  if (!overrideActive) {
    item.modifiers.forEach((g) =>
      g.modifiers.forEach((m) => {
        if (m.price) modDelta.set(`${g.groupId}:${m.id}`, m.price);
      }),
    );
  }

  const modifierLine =
    item.modifiers.length > 0 &&
    item.modifiers.flatMap((g) => g.modifiers.map((m) => ({ g, m })));

  return (
    <>
      {modifierLine && modifierLine.length > 0 && (
        <p className="text-[11px] text-[var(--outline)] mt-0.5">
          {modifierLine.map(({ g, m }, i) => {
            const d = modDelta.get(`${g.groupId}:${m.id}`);
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
        <p className="text-[11px] text-[var(--outline)] mt-0.5">
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
        <p className="text-[11px] text-[var(--primary)] italic mt-0.5">
          Note: {item.note}
          {!overrideActive && breakdown.noteAdjustment ? (
            <span className="ml-1 not-italic font-medium">
              {formatSignedCurrency(breakdown.noteAdjustment.amount)}
            </span>
          ) : null}
        </p>
      )}

      {!overrideActive && breakdown.discount && (
        <p className="text-[11px] text-[var(--primary)] italic mt-0.5">
          {breakdown.discount.label}
          <span className="ml-1 not-italic font-medium">
            {formatSignedCurrency(breakdown.discount.amount)}
          </span>
        </p>
      )}

      {overrideActive && (
        <p className="text-[11px] text-[var(--primary)] italic mt-0.5">Override</p>
      )}

      {breakdown.isComped && (
        <p className="text-[11px] text-[var(--primary)] italic mt-0.5">Comped</p>
      )}
    </>
  );
}

/**
 * Rule 15 right-column price stack.
 * - No adjustment & no override: single neutral price.
 * - Otherwise: original price strikethrough on top (muted), final unit
 *   price below in accent color. No literal `Adjustment:` / `→` text.
 */
function PriceColumn({
  item,
  muted,
}: {
  item: ReturnType<typeof useOrderStore.getState>["cartItems"][number];
  muted: boolean;
}) {
  const breakdown = getPriceBreakdown(item);
  const baseTone = muted ? "text-[var(--outline)]" : "text-[var(--foreground)]";

  // Only show strikethrough original price for overrides, discounts, note
  // adjustments, or comps — NOT for modifier-only upcharges.
  const hasNonModifierAdjustment = breakdown.hasOverride || breakdown.isComped || breakdown.noteAdjustment != null || breakdown.discount != null;

  if (!hasNonModifierAdjustment) {
    return (
      <span className={`text-[13px] font-medium shrink-0 mt-0.5 ${baseTone}`}>
        {formatCurrency(breakdown.effectiveUnitPrice)}
      </span>
    );
  }

  return (
    <span className={`text-[13px] font-medium shrink-0 mt-0.5 ${baseTone}`}>
      {formatCurrency(breakdown.effectiveUnitPrice)}
    </span>
  );
}

