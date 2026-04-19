"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CreditCard,
  StickyNote,
  GitFork,
  Send,
  AlertCircle,
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

export default function CheckSummaryScreen({ menuOpen: externalMenuOpen, setMenuOpen: externalSetMenuOpen, searchOpen: externalSearchOpen, setSearchOpen: externalSetSearchOpen }: { menuOpen?: boolean; setMenuOpen?: (v: boolean) => void; searchOpen?: boolean; setSearchOpen?: (v: boolean) => void } = {}) {
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
      setMenuOpen(true);
      setOpenMenuOnArrival(false);
    }
  }, [openMenuOnArrival, setOpenMenuOnArrival]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showUnsentWarning, setShowUnsentWarning] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const total = cartTotal();
  const count = cartCount();
  const unsentItems = cartItems.filter((i) => !i.sent);
  const sentItems = cartItems.filter((i) => i.sent);
  const allSent = cartItems.length > 0 && unsentItems.length === 0;
  const anyUnsent = unsentItems.length > 0;
  const isEmpty = cartItems.length === 0;

  const subtotal = cartItems.reduce((s, i) => s + i.totalPrice, 0);
  const tax = subtotal * 0.0875;
  const grandTotal = subtotal + tax;

  const handlePay = () => {
    if (anyUnsent) {
      setShowUnsentWarning(true);
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
      <div className="flex-1 overflow-y-auto thin-scrollbar" style={(menuOpen || searchOpen || cartOpen) ? { paddingBottom: 'calc(var(--device-height) * 0.6)' } : undefined}>
        {isEmpty ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center pb-10 cursor-pointer active:opacity-70 transition-opacity"
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
                  <CheckItem key={item.id} item={item} onTap={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)} muted={false} selected={selectedItemId === item.id} />
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
                  <CheckItem key={item.id} item={item} onTap={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)} muted selected={selectedItemId === item.id} />
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="px-4 pt-3 pb-4 border-t border-gray-100 bg-[#FBFAFF]">
              <TotalsRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
              <TotalsRow label="Tax (8.75%)" value={`$${tax.toFixed(2)}`} muted />
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
          <CreditCard size={16} /> Pay ${grandTotal.toFixed(0)}
        </button>
      </div>

      {/* Menu sheet */}
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Search drawer */}
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Cart drawer (for editing items) */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Unsent items warning */}
      <AnimatePresence>
        {showUnsentWarning && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-3 left-3 right-3 z-[70] rounded-2xl overflow-hidden"
            style={{ background: "#F3EDF7", boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
          >
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={18} className="text-[var(--primary)] shrink-0" />
                <p className="text-base font-semibold text-black">
                  {unsentItems.length} unsent {unsentItems.length === 1 ? "item" : "items"}
                </p>
              </div>
              <p className="text-sm text-black leading-snug" style={{ letterSpacing: "0.3px" }}>
                Send items to kitchen before proceeding to pay.
              </p>
            </div>
            <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
              <button
                onClick={() => {
                  setShowUnsentWarning(false);
                  markAllSent();
                  setTimeout(() => setScreen("payment"), 600);
                }}
                className="w-full h-11 rounded-xl text-sm font-medium text-white flex items-center justify-center active:opacity-80"
                style={{ background: "#6750A4" }}
              >
                Send now and pay
              </button>
              <button
                onClick={() => setShowUnsentWarning(false)}
                className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center active:opacity-80"
                style={{ background: "#E8DEF8", color: "#6750A4" }}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Subcomponents ── */

function StatusPill({
  tone,
  pulse,
  children,
}: {
  tone: "amber" | "green" | "purple";
  pulse?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    amber: { bg: "#FFF8E1", border: "#F5A623", dot: "#F5A623", text: "#B5790D" },
    green: { bg: "#E8F5E9", border: "#00B618", dot: "#00B618", text: "#14702B" },
    purple: { bg: "#E8DEF8", border: "#6750A4", dot: "#6750A4", text: "#6750A4" },
  };
  const s = styles[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, border: `1px solid ${s.border}40`, color: s.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: s.dot,
          animation: pulse ? "pulse 1.6s ease-in-out infinite" : "none",
        }}
      />
      {children}
    </span>
  );
}

function CheckItem({
  item,
  muted,
  onTap,
  selected,
}: {
  item: ReturnType<typeof useOrderStore.getState>["cartItems"][number];
  muted: boolean;
  onTap: () => void;
  selected?: boolean;
}) {
  const { updateQuantity, removeItem } = useOrderStore();

  return (
    <div className={`border-b border-gray-50 transition-colors ${selected ? "bg-[var(--primary-light)]" : ""}`}>
      <button
        onClick={onTap}
        className="w-full flex items-start gap-3 px-4 py-2.5 text-left active:bg-[var(--surface)] transition-colors"
      >
        {/* Qty badge */}
        <span
          className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: "#F3EDF7", color: "#6750A4" }}
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
                  return mods.length > 0 ? `${s.component.name} (${mods.join(", ")})` : s.component.name;
                })
                .join(" · ")}
            </p>
          )}
          {item.note && (
            <p className="text-[11px] text-[var(--primary)] italic mt-0.5">Note: {item.note}</p>
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
              onClick={(e) => { e.stopPropagation(); if (item.quantity <= 1) removeItem(item.id); else updateQuantity(item.id, -1); }}
              className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
            >
              {item.quantity <= 1 ? <Trash2 size={13} className="text-[var(--error)]" /> : <Minus size={13} />}
            </button>
            <span className="text-sm font-semibold min-w-[16px] text-center">{item.quantity}</span>
            <button
              onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
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

function SecondaryChip({
  icon,
  label,
  onClick,
  highlighted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-medium border whitespace-nowrap shrink-0 active:opacity-70 transition-colors h-[44px]"
      style={
        highlighted
          ? { background: "#6750A4", color: "white", borderColor: "#6750A4" }
          : { background: "white", color: "#1c1c1e", borderColor: "#CAC4D0" }
      }
    >
      {icon}
      {label}
    </button>
  );
}
