"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CreditCard,
  StickyNote,
  GitFork,
  Send,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import staffData from "@/data/staff.json";
import tablesData from "@/data/tables.json";
import { Staff, Table } from "@/lib/types";
import CartDrawer from "@/components/cart/CartDrawer";
import MenuSheet from "@/components/menu/MenuSheet";
import SearchDrawer from "@/components/menu/SearchDrawer";
import Header from "@/components/ui/Header";

type ExternalDrawerType = "none" | "action" | "payment";

export default function CheckSummaryScreen({ menuOpen: externalMenuOpen, setMenuOpen: externalSetMenuOpen, searchOpen: externalSearchOpen, setSearchOpen: externalSetSearchOpen, itemActionOpen = false, externalDrawerType = "none", onOpenItemActions, onOpenPaymentDrawer }: { menuOpen?: boolean; setMenuOpen?: (v: boolean) => void; searchOpen?: boolean; setSearchOpen?: (v: boolean) => void; itemActionOpen?: boolean; externalDrawerType?: ExternalDrawerType; onOpenItemActions?: (item: { id: string; name: string }) => void; onOpenPaymentDrawer?: () => void } = {}) {
  const {
    currentStaff,
    selectedTable,
    guestCount,
    cartItems,
    cartTotal,
    cartCount,
    markAllSent,
    setScreen,
    resetOrder,
    setStaff,
    setTable,
    openMenuOnArrival,
    setOpenMenuOnArrival,
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
  const discountTotal = Math.max(0, preDiscountSubtotal - subtotal);
  const tax = subtotal * 0.0875;
  const tip = 0;
  const grandTotal = subtotal + tax;
  const fullHeightDrawerOpen = menuOpen || searchOpen || cartOpen;
  const actionDrawerOpen = itemActionOpen || externalDrawerType === "action";
  const paymentDrawerOpen = externalDrawerType === "payment";
  const anyDrawerOpen = fullHeightDrawerOpen || actionDrawerOpen || paymentDrawerOpen;

  const drawerPaddingBottom = fullHeightDrawerOpen
    ? "calc(var(--device-height) * 0.6)"
    : actionDrawerOpen
      ? "calc(var(--device-height) * 0.68)"
      : paymentDrawerOpen
        ? "calc(var(--device-height) * 0.44)"
        : undefined;

  const handlePay = () => {
    if (anyUnsent) markAllSent();
    if (onOpenPaymentDrawer) {
      onOpenPaymentDrawer();
      return;
    }
    setScreen("payment");
  };

  const handleLogout = () => { resetOrder(); setScreen("login"); };
  const handleTransfer = (staff: Staff) => setStaff(staff);
  const handleTransferTable = (table: Table) => setTable(table);
  const handleVoidOrder = () => { resetOrder(); setScreen("tables"); };

  return (
    <div className="h-full flex flex-col relative bg-white">
      {/* Header */}
      <Header
        onBack={() => setScreen("tables")}
        serverName={currentStaff?.name}
        tableName={selectedTable?.name}
        guestCount={guestCount}
        onGuestCountTap={() => setScreen("guest-count")}
        onTableTap={() => setScreen("tables")}
        onLogout={handleLogout}
        onTransfer={handleTransfer}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
        onTransferTable={handleTransferTable}
        onVoidOrder={handleVoidOrder}
        tableList={tablesData as Table[]}
        currentTableId={selectedTable?.id}
      />

      {/* Scrollable check body — scrolls independently; menu drawer overlaps the bottom 60% */}
      <div
        className="flex-1 overflow-y-auto thin-scrollbar"
        style={
          !isEmpty && anyDrawerOpen
            ? {
                paddingBottom: drawerPaddingBottom,
              }
            : undefined
        }
      >
        {isEmpty ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center cursor-pointer active:opacity-70 transition-opacity"
            style={
              anyDrawerOpen
                ? { height: `calc(100% - ${drawerPaddingBottom ?? "0px"})` }
                : undefined
            }
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
                    muted
                    selected={selectedItemId === item.id}
                  />
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="px-4 pt-3 pb-4 border-t border-gray-100 bg-[#FBFAFF]">
              <TotalsRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
              {discountTotal > 0 && (
                <TotalsRow label="Discount" value={`-$${discountTotal.toFixed(2)}`} muted />
              )}
              <TotalsRow label="Tax (8.75%)" value={`$${tax.toFixed(2)}`} muted />
              <TotalsRow label="Tip" value={`$${tip.toFixed(2)}`} muted />
              <div className="h-1.5" />
              <TotalsRow label="Total" value={`$${grandTotal.toFixed(2)}`} bold large />
              <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--outline)]">
                <span>{count} {count === 1 ? "item" : "items"} · {sentItems.length} sent</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Secondary chip row removed — actions are now inline with selected item */}

      {/* Primary action bar — hidden while menu is open */}
      <div className={`flex gap-2 px-3 pb-3 pt-2.5 bg-white border-t border-gray-200 shrink-0 ${menuOpen ? "hidden" : ""}`}>
        <button
          onClick={markAllSent}
          disabled={unsentItems.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 text-[13px] font-semibold transition-colors active:opacity-70 disabled:opacity-40"
          style={{ borderColor: "#6750A4", color: "#6750A4", background: "white" }}
        >
          <Send size={16} /> Send to kitchen
        </button>
        <button
          onClick={handlePay}
          disabled={isEmpty}
          className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-[13px] font-semibold text-white transition-colors active:opacity-80 disabled:opacity-40"
          style={{ background: "#6750A4" }}
        >
          <CreditCard size={16} /> Pay
        </button>
      </div>

      {/* Menu sheet */}
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Search drawer */}
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Cart drawer (for editing items) */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

    </div>
  );
}

/* ── Subcomponents ── */

function CheckItem({
  item,
  muted,
  onTap,
  onInteract,
  selected,
}: {
  item: ReturnType<typeof useOrderStore.getState>["cartItems"][number];
  muted: boolean;
  onTap: () => void;
  onInteract?: () => void;
  selected?: boolean;
}) {
  const { updateQuantity, removeItem } = useOrderStore();

  return (
    <>
      {item.breaklineAbove && (
        <div className="px-4 py-1.5">
          <div className="h-px bg-gray-300" />
        </div>
      )}
      <div className={`border-b border-gray-50 transition-colors ${selected ? "bg-[var(--primary-light)]" : ""}`}>
        <button
          onClick={() => {
            onInteract?.();
            onTap();
          }}
          className="w-full flex items-start gap-3 px-4 py-2.5 text-left active:bg-[var(--surface)] transition-colors"
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
            {item.modifiers.length > 0 && (
              <p className="text-[11px] text-[var(--outline)] mt-0.5">
                {item.modifiers.flatMap((g) => g.modifiers.map((m) => m.name)).join(", ")}
              </p>
            )}
            {item.comboSelections && item.comboSelections.length > 0 && (
              <p className="text-[11px] text-[var(--outline)] mt-0.5">
                {item.comboSelections
                  .map((s) => {
                    const mods = s.modifiers.flatMap((g) => g.modifiers.map((m) => m.name));
                    const base = `${s.groupName}: ${s.component.name}`;
                    return mods.length > 0 ? `${base} (${mods.join(", ")})` : base;
                  })
                  .join(" · ")}
              </p>
            )}
            {item.note && (
              <p className="text-[11px] text-[var(--primary)] italic mt-0.5">Note: {item.note}</p>
            )}
            {item.discount && (
              <p className="text-[11px] text-green-700 mt-0.5 font-medium">
                Discount: {item.discount.type === "percent" ? `${item.discount.value}%` : `$${item.discount.value.toFixed(2)}`}
              </p>
            )}
          </div>
          <span className={`text-[13px] font-medium shrink-0 mt-0.5 ${muted ? "text-[var(--outline)]" : ""}`}>
            ${item.totalPrice.toFixed(2)}
          </span>
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
              <button className="flex items-center gap-1 px-2.5 h-[44px] rounded-lg border border-[var(--outline-variant)] text-[11px] font-medium shrink-0 active:bg-gray-100">
                <StickyNote size={11} /> Notes
              </button>
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
      {item.breaklineBelow && (
        <div className="px-4 py-1.5">
          <div className="h-px bg-gray-300" />
        </div>
      )}
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

