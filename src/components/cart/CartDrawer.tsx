"use client";

import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, Minus, Plus, Trash2, Send, Pause, MoreHorizontal, DollarSign, Percent } from "lucide-react";

function BreaklineIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 40H42M33 6.99996C33.7956 6.20432 34.8748 5.75732 36 5.75732C36.5572 5.75732 37.1088 5.86706 37.6236 6.08028C38.1383 6.29349 38.606 6.606 39 6.99996C39.394 7.39393 39.7065 7.86164 39.9197 8.37638C40.1329 8.89112 40.2426 9.44281 40.2426 9.99996C40.2426 10.5571 40.1329 11.1088 39.9197 11.6236C39.7065 12.1383 39.394 12.606 39 13L14 38L6 40L8 32L33 6.99996Z" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NoteEditIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M14.666 5.33331H5.33268C4.62544 5.33331 3.94716 5.61426 3.44706 6.11436C2.94697 6.61446 2.66602 7.29273 2.66602 7.99998V26.6666C2.66602 27.3739 2.94697 28.0522 3.44706 28.5523C3.94716 29.0524 4.62544 29.3333 5.33268 29.3333H23.9993C24.7066 29.3333 25.3849 29.0524 25.885 28.5523C26.3851 28.0522 26.666 27.3739 26.666 26.6666V17.3333M24.666 3.33331C25.1964 2.80288 25.9159 2.50488 26.666 2.50488C27.4162 2.50488 28.1356 2.80288 28.666 3.33331C29.1964 3.86374 29.4944 4.58316 29.4944 5.33331C29.4944 6.08346 29.1964 6.80288 28.666 7.33331L15.9993 20L10.666 21.3333L11.9993 16L24.666 3.33331Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
import { useOrderStore } from "@/store/order-store";
import { useState, useRef, useEffect } from "react";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const dragControls = useDragControls();
  const { cartItems, cartTotal, cartCount, updateQuantity, removeItem, updateNote, updatePriceAdjustment, setItemDiscount, setItemComped, setItemPriceOverride, toggleBreakline, markAllSent, setScreen } =
    useOrderStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [priceAdjValue, setPriceAdjValue] = useState("");
  const [showUnsentToast, setShowUnsentToast] = useState(false);
  // Price override numpad
  const [priceOverrideId, setPriceOverrideId] = useState<string | null>(null);
  const [priceOverrideInput, setPriceOverrideInput] = useState("");
  // Discount numpad
  const [discountId, setDiscountId] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Reset all inline panels when the drawer opens/closes
  useEffect(() => {
    setExpandedId(null);
    setNoteEditId(null);
    setPriceOverrideId(null);
    setPriceOverrideInput("");
    setDiscountId(null);
    setDiscountInput("");
  }, [open]);

  // Focus note input to trigger mobile keyboard
  useEffect(() => {
    if (noteEditId) {
      setTimeout(() => {
        noteInputRef.current?.focus();
      }, 100);
    }
  }, [noteEditId]);

  // Auto-scroll so the item name stays visible above the inline numpad
  useEffect(() => {
    const targetId = priceOverrideId || discountId;
    if (!targetId || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(`[data-item-id="${targetId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [priceOverrideId, discountId]);

  // Auto-scroll to show expanded action buttons when near bottom
  useEffect(() => {
    if (!expandedId || priceOverrideId || discountId || !scrollContainerRef.current) return;
    setTimeout(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-item-id="${expandedId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }, [expandedId, priceOverrideId, discountId]);

  const total = cartTotal();
  const count = cartCount();
  const unsentItems = cartItems.filter((i) => !i.sent);
  const sentItems = cartItems.filter((i) => i.sent);

  const handleSend = () => {
    markAllSent();
  };

  const handlePay = () => {
    if (unsentItems.length > 0) {
      setShowUnsentToast(true);
      return;
    }
    onClose();
    setScreen("payment");
  };

  const startNoteEdit = (id: string, currentNote?: string, currentPriceAdj?: number) => {
    setNoteEditId(id);
    setNoteValue(currentNote || "");
    setPriceAdjValue(currentPriceAdj ? (currentPriceAdj > 0 ? `+${currentPriceAdj}` : `${currentPriceAdj}`) : "");
  };

  const saveNote = (id: string) => {
    updateNote(id, noteValue);
    const parsed = parseFloat(priceAdjValue.replace(/[^-+\d.]/g, ""));
    updatePriceAdjustment(id, isNaN(parsed) ? 0 : parsed);
    setNoteEditId(null);
    setExpandedId(null);
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col"
            style={{ maxHeight: "calc(100% - 48px)" }}
          >
            {/* Handle + Header */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: "none" }}
              className="px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">Cart ({count})</h2>
                  {unsentItems.length > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-medium text-amber-600 leading-none">Editing</span>
                    </span>
                  ) : sentItems.length > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px] font-medium text-green-600 leading-none">Sent to Kitchen</span>
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Items */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto thin-scrollbar">
              {cartItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-[var(--outline)]">
                  No items in cart
                </div>
              ) : (
                <>
                  {/* Unsent items */}
                  {unsentItems.length > 0 && (
                    <div>
                      {sentItems.length > 0 && (
                        <div className="px-4 py-1.5 bg-gray-50 text-xs font-medium text-[var(--outline)]">
                          New Items
                        </div>
                      )}
                      {unsentItems.map((item) => (
                        <div key={item.id} data-item-id={item.id} className={item.breakline ? "" : "border-b border-gray-50"}>
                          <div
                            className="flex items-start gap-2 px-4 py-2.5"
                            onClick={() => {
                              // If note is open, just close it first
                              if (noteEditId) {
                                setNoteEditId(null);
                                return;
                              }
                              const closing = expandedId === item.id;
                              setExpandedId(closing ? null : item.id);
                              if (closing) { setPriceOverrideId(null); setPriceOverrideInput(""); setDiscountId(null); setDiscountInput(""); }
                            }}
                          >
                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {item.name}
                              </p>
                              {item.modifiers.length > 0 && (
                                <p className="text-xs text-[var(--outline)]">
                                  {item.modifiers
                                    .flatMap((g) =>
                                      g.modifiers.map((m) => m.name)
                                    )
                                    .join(", ")}
                                </p>
                              )}
                              {item.comboSelections && item.comboSelections.length > 0 && (
                                <p className="text-xs text-[var(--outline)]">
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
                              {(item.note || item.priceAdjustment) && (
                                <p className="text-xs text-[var(--primary)] italic">
                                  {item.note && `Note: ${item.note}`}
                                  {item.note && item.priceAdjustment ? " " : ""}
                                  {item.priceAdjustment ? (
                                    <span className="font-medium">
                                      {item.priceAdjustment > 0 ? "+" : ""}${item.priceAdjustment.toFixed(2)}
                                    </span>
                                  ) : null}
                                </p>
                              )}
                              {/* Action icons */}
                              <div className="flex items-center gap-4 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (noteEditId === item.id) {
                                      setNoteEditId(null);
                                    } else {
                                      // Collapse more-actions when opening note
                                      setExpandedId(null);
                                      setPriceOverrideId(null);
                                      setPriceOverrideInput("");
                                      setDiscountId(null);
                                      setDiscountInput("");
                                      startNoteEdit(item.id, item.note, item.priceAdjustment);
                                    }
                                  }}
                                  className="active:opacity-50"
                                  title="Note"
                                >
                                  <NoteEditIcon size={20} className="text-[var(--foreground)]" />
                                </button>
                                {/* Breakline icon — bold B with thick underline */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBreakline(item.id);
                                  }}
                                  className="active:opacity-50"
                                  title="Breakline"
                                >
                                  <BreaklineIcon size={20} color={item.breakline ? "var(--primary)" : "var(--foreground)"} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const closing = expandedId === item.id;
                                    setExpandedId(closing ? null : item.id);
                                    if (closing) { setPriceOverrideId(null); setPriceOverrideInput(""); setDiscountId(null); setDiscountInput(""); }
                                    // Collapse note editor when opening more-actions
                                    if (!closing) { setNoteEditId(null); }
                                  }}
                                  className="active:opacity-50"
                                  title="More"
                                >
                                  <MoreHorizontal size={20} className="text-[var(--foreground)]" />
                                </button>
                              </div>
                            </div>

                            {/* Price + Qty controls */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {(() => {
                                const originalPrice = ((item.basePrice + item.modifiers.reduce((sum, g) => sum + g.modifiers.reduce((s, m) => s + m.price, 0), 0)) * item.quantity);
                                if (item.comped) {
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs line-through text-[var(--outline)]">
                                        ${originalPrice.toFixed(2)}
                                      </span>
                                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#E8DEF8] text-[#6750A4]">
                                        COMP
                                      </span>
                                    </div>
                                  );
                                }
                                if (item.priceOverride != null) {
                                  return (
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-medium text-[#6750A4]">
                                        ${item.totalPrice.toFixed(2)}
                                      </span>
                                      <span className="text-[10px] line-through text-[var(--outline)]">
                                        ${originalPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                }
                                if (item.discount) {
                                  return (
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-medium text-[#6750A4]">
                                        ${item.totalPrice.toFixed(2)}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] line-through text-[var(--outline)]">
                                          ${originalPrice.toFixed(2)}
                                        </span>
                                        <span className="text-[10px] text-green-600 font-medium">
                                          {item.discount.type === "percent" ? `-${item.discount.value}%` : `-$${item.discount.value.toFixed(2)}`}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <span className="text-sm font-medium">
                                    ${item.totalPrice.toFixed(2)}
                                  </span>
                                );
                              })()}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.quantity <= 1) {
                                      removeItem(item.id);
                                    } else {
                                      updateQuantity(item.id, -1);
                                    }
                                  }}
                                  className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-[var(--primary-light)]"
                                >
                                  {item.quantity <= 1 ? (
                                    <Trash2 size={14} className="text-[var(--error)]" />
                                  ) : (
                                    <Minus size={14} />
                                  )}
                                </button>
                                <span className="w-6 text-center text-sm font-medium">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(item.id, 1);
                                  }}
                                  className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-[var(--primary-light)]"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Tier 2 expanded actions — hidden while numpad is open */}
                          {expandedId === item.id && priceOverrideId !== item.id && discountId !== item.id && (
                            <div className="px-4 pb-2 flex gap-2 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDiscountInput(item.discount ? String(item.discount.value) : "");
                                  setDiscountMode(item.discount?.type || "percent");
                                  setDiscountId(item.id);
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                                style={
                                  item.discount
                                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                                }
                              >
                                Discount
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = !item.comped;
                                  if (next) { setItemDiscount(item.id, null); }
                                  setItemComped(item.id, next);
                                  if (next) { setPriceOverrideId(null); setDiscountId(null); setDiscountInput(""); }
                                  setExpandedId(null);
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                                style={
                                  item.comped
                                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                                }
                              >
                                Comp
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPriceOverrideInput(item.priceOverride != null ? String(item.priceOverride) : "");
                                  setPriceOverrideId(item.id);
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                                style={
                                  item.priceOverride != null
                                    ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                    : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                                }
                              >
                                Price Override
                              </button>
                            </div>
                          )}

                          {/* Inline numpad — replaces action buttons */}
                          {priceOverrideId === item.id && (
                            <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                              {/* Live price display */}
                              <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-[var(--surface)]">
                                <span className="text-xs text-[var(--outline)]">New price (per item)</span>
                                <span className="text-base font-semibold text-[var(--primary)]">
                                  ${priceOverrideInput === "" ? "0.00" : parseFloat(priceOverrideInput || "0").toFixed(2)}
                                </span>
                              </div>
                              {/* Numpad */}
                              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                                {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      if (key === "⌫") {
                                        setPriceOverrideInput((v) => v.slice(0, -1));
                                      } else if (key === ".") {
                                        if (!priceOverrideInput.includes(".")) setPriceOverrideInput((v) => v + ".");
                                      } else {
                                        const dotIdx = priceOverrideInput.indexOf(".");
                                        if (dotIdx !== -1 && priceOverrideInput.length - dotIdx > 2) return;
                                        setPriceOverrideInput((v) => v + key);
                                      }
                                    }}
                                    className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                                  >
                                    {key}
                                  </button>
                                ))}
                              </div>
                              {/* Confirm + Clear */}
                              <div className="flex gap-1.5">
                                <button
                                  disabled={item.priceOverride == null}
                                  onClick={() => {
                                    setItemPriceOverride(item.id, null);
                                    setPriceOverrideInput("");
                                    setTimeout(() => {
                                      setPriceOverrideId(null);
                                      setExpandedId(null);
                                    }, 1000);
                                  }}
                                  className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-[var(--surface)] disabled:opacity-40"
                                >
                                  RESET
                                </button>
                                <button
                                  onClick={() => {
                                    const val = parseFloat(priceOverrideInput);
                                    setItemPriceOverride(item.id, isNaN(val) ? null : val);
                                    setPriceOverrideId(null);
                                    setPriceOverrideInput("");
                                    setExpandedId(null);
                                  }}
                                  className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                                  style={{ background: "#6750A4" }}
                                >
                                  Confirm
                                </button>
                              </div>
                            </div>
                          )}


                          {/* Inline discount panel */}
                          {discountId === item.id && (() => {
                            const undiscountedTotal = (() => {
                              const modTotal = item.modifiers.reduce((s, g) => s + g.modifiers.reduce((s2, m) => s2 + m.price, 0), 0);
                              return (item.basePrice + modTotal + (item.priceAdjustment || 0)) * item.quantity;
                            })();
                            const previewValue = parseFloat(discountInput || "0");
                            const previewTotal = discountMode === "percent"
                              ? undiscountedTotal * (1 - (isNaN(previewValue) ? 0 : previewValue) / 100)
                              : Math.max(0, undiscountedTotal - (isNaN(previewValue) ? 0 : previewValue));
                            const savings = undiscountedTotal - previewTotal;

                            return (
                            <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                              {/* Mode toggle + quick presets in one row */}
                              <div className="flex items-center gap-1.5 mb-2">
                                {/* Compact %/$ toggle */}
                                <div className="flex rounded-lg border border-[var(--outline-variant)] overflow-hidden shrink-0">
                                  <button
                                    onClick={() => { setDiscountMode("percent"); setDiscountInput(""); }}
                                    className="w-9 h-9 flex items-center justify-center transition-colors"
                                    style={discountMode === "percent" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                                  >
                                    <Percent size={14} />
                                  </button>
                                  <button
                                    onClick={() => { setDiscountMode("amount"); setDiscountInput(""); }}
                                    className="w-9 h-9 flex items-center justify-center border-l border-[var(--outline-variant)] transition-colors"
                                    style={discountMode === "amount" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                                  >
                                    <DollarSign size={14} />
                                  </button>
                                </div>
                                {/* Quick preset buttons */}
                                {discountMode === "percent"
                                  ? [10, 20].map((pct) => (
                                    <button
                                      key={pct}
                                      onClick={() => setDiscountInput(String(pct))}
                                      className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                                      style={
                                        discountInput === String(pct)
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
                                      onClick={() => setDiscountInput(String(amt))}
                                      className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                                      style={
                                        discountInput === String(amt)
                                          ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                          : { borderColor: "var(--outline-variant)" }
                                      }
                                    >
                                      ${amt}
                                    </button>
                                  ))}
                              </div>

                              {/* Live preview */}
                              <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-[var(--surface)]">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-[var(--outline)]">
                                    {discountMode === "percent" ? "Discount %" : "Discount $"}
                                  </span>
                                  <span className="text-base font-semibold text-[var(--primary)]">
                                    {discountMode === "percent"
                                      ? `${discountInput || "0"}%`
                                      : `$${discountInput === "" ? "0.00" : parseFloat(discountInput || "0").toFixed(2)}`}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-[var(--outline)]">Saves</span>
                                  <span className="text-sm font-medium text-green-600">
                                    -${savings.toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Numpad */}
                              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                                {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      if (key === "⌫") {
                                        setDiscountInput((v) => v.slice(0, -1));
                                      } else if (key === ".") {
                                        if (!discountInput.includes(".")) setDiscountInput((v) => v + ".");
                                      } else {
                                        // Limit percent to 100
                                        if (discountMode === "percent") {
                                          const next = discountInput + key;
                                          if (parseFloat(next) > 100) return;
                                        }
                                        const dotIdx = discountInput.indexOf(".");
                                        if (dotIdx !== -1 && discountInput.length - dotIdx > 2) return;
                                        setDiscountInput((v) => v + key);
                                      }
                                    }}
                                    className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                                  >
                                    {key}
                                  </button>
                                ))}
                              </div>

                              {/* Clear + Confirm */}
                              <div className="flex gap-1.5">
                                <button
                                  disabled={!item.discount}
                                  onClick={() => {
                                    setItemDiscount(item.id, null);
                                    setDiscountInput("");
                                    setTimeout(() => {
                                      setDiscountId(null);
                                      setExpandedId(null);
                                    }, 1000);
                                  }}
                                  className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-[var(--surface)] disabled:opacity-40"
                                >
                                  RESET
                                </button>
                                <button
                                  onClick={() => {
                                    const val = parseFloat(discountInput);
                                    if (!isNaN(val) && val > 0) {
                                      setItemDiscount(item.id, { type: discountMode, value: val });
                                    } else {
                                      setItemDiscount(item.id, null);
                                    }
                                    setDiscountId(null);
                                    setDiscountInput("");
                                    setExpandedId(null);
                                  }}
                                  className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                                  style={{ background: "#6750A4" }}
                                >
                                  Apply Discount
                                </button>
                              </div>
                            </div>
                            );
                          })()}

                          {/* Note editor */}
                          {noteEditId === item.id && (
                            <div className="px-4 pb-2 space-y-2">
                              <div className="flex gap-2">
                                <input
                                  ref={noteInputRef}
                                  type="text"
                                  inputMode="text"
                                  enterKeyHint="done"
                                  value={noteValue}
                                  onChange={(e) => setNoteValue(e.target.value)}
                                  placeholder="e.g. Swap protein to beef"
                                  className="flex-1 px-3 py-1.5 border border-[var(--outline-variant)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)]"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9+\-\.]*"
                                  enterKeyHint="done"
                                  value={priceAdjValue}
                                  onChange={(e) => setPriceAdjValue(e.target.value)}
                                  placeholder="+$0"
                                  className="w-16 px-2 py-1.5 border border-[var(--outline-variant)] rounded-lg text-sm text-center focus:outline-none focus:border-[var(--primary)]"
                                />
                              </div>
                              <button
                                onClick={() => saveNote(item.id)}
                                disabled={!noteValue.trim() && !priceAdjValue.trim()}
                                className="w-full py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-40"
                              >
                                Save
                              </button>
                            </div>
                          )}

                          {/* Breakline separator */}
                          {item.breakline && (
                            <div className="mx-4 mt-1 mb-0" style={{ height: 3, borderRadius: 2, background: "var(--foreground)" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sent items */}
                  {sentItems.length > 0 && (
                    <div>
                      {unsentItems.length > 0 && (
                        <div className="px-4 py-1.5 bg-green-50 text-xs font-medium text-green-600">
                          Sent to Kitchen
                        </div>
                      )}
                      {sentItems.map((item) => (
                        <div key={item.id} data-item-id={item.id} className={item.breakline ? "" : "border-b border-gray-50"}>
                        <div
                          className="flex items-start gap-2 px-4 py-2.5"
                          onClick={() => {
                            if (noteEditId) { setNoteEditId(null); return; }
                            const closing = expandedId === item.id;
                            setExpandedId(closing ? null : item.id);
                            if (closing) { setPriceOverrideId(null); setPriceOverrideInput(""); setDiscountId(null); setDiscountInput(""); }
                          }}
                        >
                          {/* Item info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-[var(--outline)]">
                                {item.name}
                              </p>
                              <span className="px-1.5 py-px rounded text-[9px] font-medium bg-green-50 text-green-600 border border-green-200 leading-tight shrink-0">
                                Sent
                              </span>
                            </div>
                            {item.modifiers.length > 0 && (
                              <p className="text-xs text-[var(--outline)] opacity-60">
                                {item.modifiers
                                  .flatMap((g) =>
                                    g.modifiers.map((m) => m.name)
                                  )
                                  .join(", ")}
                              </p>
                            )}
                            {item.comboSelections && item.comboSelections.length > 0 && (
                              <p className="text-xs text-[var(--outline)] opacity-60">
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
                            {(item.note || item.priceAdjustment) && (
                              <p className="text-xs text-[var(--primary)] italic opacity-60">
                                {item.note && `Note: ${item.note}`}
                                {item.note && item.priceAdjustment ? " " : ""}
                                {item.priceAdjustment ? (
                                  <span className="font-medium">
                                    {item.priceAdjustment > 0 ? "+" : ""}${item.priceAdjustment.toFixed(2)}
                                  </span>
                                ) : null}
                              </p>
                            )}
                            {/* Action icons */}
                            <div className="flex items-center gap-4 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (noteEditId === item.id) {
                                    setNoteEditId(null);
                                  } else {
                                    setExpandedId(null);
                                    setPriceOverrideId(null); setPriceOverrideInput("");
                                    setDiscountId(null); setDiscountInput("");
                                    startNoteEdit(item.id, item.note, item.priceAdjustment);
                                  }
                                }}
                                className="active:opacity-50"
                                title="Note"
                              >
                                <NoteEditIcon size={20} className="text-[var(--foreground)]" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBreakline(item.id);
                                }}
                                className="active:opacity-50"
                                title="Breakline"
                              >
                                <BreaklineIcon size={20} color={item.breakline ? "var(--primary)" : "var(--foreground)"} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const closing = expandedId === item.id;
                                  setExpandedId(closing ? null : item.id);
                                  if (closing) { setPriceOverrideId(null); setPriceOverrideInput(""); setDiscountId(null); setDiscountInput(""); }
                                  if (!closing) { setNoteEditId(null); }
                                }}
                                className="active:opacity-50"
                                title="More"
                              >
                                <MoreHorizontal size={20} className="text-[var(--foreground)]" />
                              </button>
                            </div>
                          </div>

                          {/* Price + Qty */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {(() => {
                              const originalPrice = ((item.basePrice + item.modifiers.reduce((sum, g) => sum + g.modifiers.reduce((s, m) => s + m.price, 0), 0)) * item.quantity);
                              if (item.comped) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs line-through text-[var(--outline)]">${originalPrice.toFixed(2)}</span>
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#E8DEF8] text-[#6750A4]">COMP</span>
                                  </div>
                                );
                              }
                              if (item.priceOverride != null) {
                                return (
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium text-[#6750A4]">${item.totalPrice.toFixed(2)}</span>
                                    <span className="text-[10px] line-through text-[var(--outline)]">${originalPrice.toFixed(2)}</span>
                                  </div>
                                );
                              }
                              if (item.discount) {
                                return (
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium text-[#6750A4]">${item.totalPrice.toFixed(2)}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] line-through text-[var(--outline)]">${originalPrice.toFixed(2)}</span>
                                      <span className="text-[10px] text-green-600 font-medium">
                                        {item.discount.type === "percent" ? `-${item.discount.value}%` : `-$${item.discount.value.toFixed(2)}`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <span className="text-sm font-medium text-[var(--outline)]">${item.totalPrice.toFixed(2)}</span>
                              );
                            })()}
                            <span className="text-xs text-[var(--outline)]">×{item.quantity}</span>
                          </div>
                        </div>

                        {/* Tier 2 expanded actions */}
                        {expandedId === item.id && priceOverrideId !== item.id && discountId !== item.id && (
                          <div className="px-4 pb-2 flex gap-2 flex-wrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiscountInput(item.discount ? String(item.discount.value) : "");
                                setDiscountMode(item.discount?.type || "percent");
                                setDiscountId(item.id);
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                              style={
                                item.discount
                                  ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                  : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                              }
                            >
                              Discount
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = !item.comped;
                                if (next) { setItemDiscount(item.id, null); }
                                setItemComped(item.id, next);
                                if (next) { setPriceOverrideId(null); setDiscountId(null); setDiscountInput(""); }
                                setExpandedId(null);
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                              style={
                                item.comped
                                  ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                  : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                              }
                            >
                              Comp
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPriceOverrideInput(item.priceOverride != null ? String(item.priceOverride) : "");
                                setPriceOverrideId(item.id);
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium border active:opacity-70 transition-colors"
                              style={
                                item.priceOverride != null
                                  ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" }
                                  : { background: "transparent", borderColor: "var(--outline-variant)", color: "inherit" }
                              }
                            >
                              Price Override
                            </button>
                          </div>
                        )}

                        {/* Inline price override numpad */}
                        {priceOverrideId === item.id && (
                          <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-[var(--surface)]">
                              <span className="text-xs text-[var(--outline)]">New price (per item)</span>
                              <span className="text-base font-semibold text-[var(--primary)]">
                                ${priceOverrideInput === "" ? "0.00" : parseFloat(priceOverrideInput || "0").toFixed(2)}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                              {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    if (key === "⌫") { setPriceOverrideInput((v) => v.slice(0, -1)); }
                                    else if (key === ".") { if (!priceOverrideInput.includes(".")) setPriceOverrideInput((v) => v + "."); }
                                    else {
                                      const dotIdx = priceOverrideInput.indexOf(".");
                                      if (dotIdx !== -1 && priceOverrideInput.length - dotIdx > 2) return;
                                      setPriceOverrideInput((v) => v + key);
                                    }
                                  }}
                                  className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                                >{key}</button>
                              ))}
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                disabled={item.priceOverride == null}
                                onClick={() => {
                                  setItemPriceOverride(item.id, null); setPriceOverrideInput("");
                                  setTimeout(() => { setPriceOverrideId(null); setExpandedId(null); }, 1000);
                                }}
                                className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-[var(--surface)] disabled:opacity-40"
                              >RESET</button>
                              <button
                                onClick={() => {
                                  const val = parseFloat(priceOverrideInput);
                                  setItemPriceOverride(item.id, isNaN(val) ? null : val);
                                  setPriceOverrideId(null); setPriceOverrideInput(""); setExpandedId(null);
                                }}
                                className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                                style={{ background: "#6750A4" }}
                              >Confirm</button>
                            </div>
                          </div>
                        )}

                        {/* Inline discount panel */}
                        {discountId === item.id && (() => {
                          const undiscountedTotal = (() => {
                            const modTotal = item.modifiers.reduce((s, g) => s + g.modifiers.reduce((s2, m) => s2 + m.price, 0), 0);
                            return (item.basePrice + modTotal + (item.priceAdjustment || 0)) * item.quantity;
                          })();
                          const previewValue = parseFloat(discountInput || "0");
                          const previewTotal = discountMode === "percent"
                            ? undiscountedTotal * (1 - (isNaN(previewValue) ? 0 : previewValue) / 100)
                            : Math.max(0, undiscountedTotal - (isNaN(previewValue) ? 0 : previewValue));
                          const savings = undiscountedTotal - previewTotal;
                          return (
                          <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="flex rounded-lg border border-[var(--outline-variant)] overflow-hidden shrink-0">
                                <button onClick={() => { setDiscountMode("percent"); setDiscountInput(""); }}
                                  className="w-9 h-9 flex items-center justify-center transition-colors"
                                  style={discountMode === "percent" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                                ><Percent size={14} /></button>
                                <button onClick={() => { setDiscountMode("amount"); setDiscountInput(""); }}
                                  className="w-9 h-9 flex items-center justify-center border-l border-[var(--outline-variant)] transition-colors"
                                  style={discountMode === "amount" ? { background: "#E8DEF8", color: "#6750A4" } : {}}
                                ><DollarSign size={14} /></button>
                              </div>
                              {discountMode === "percent"
                                ? [10, 20].map((pct) => (
                                  <button key={pct} onClick={() => setDiscountInput(String(pct))}
                                    className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                                    style={discountInput === String(pct) ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" } : { borderColor: "var(--outline-variant)" }}
                                  >{pct}%</button>
                                ))
                                : [5, 10].map((amt) => (
                                  <button key={amt} onClick={() => setDiscountInput(String(amt))}
                                    className="flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors active:opacity-70"
                                    style={discountInput === String(amt) ? { background: "#E8DEF8", borderColor: "#6750A4", color: "#6750A4" } : { borderColor: "var(--outline-variant)" }}
                                  >${amt}</button>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mb-2 px-2 py-2 rounded-lg bg-[var(--surface)]">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-[var(--outline)]">{discountMode === "percent" ? "Discount %" : "Discount $"}</span>
                                <span className="text-base font-semibold text-[var(--primary)]">
                                  {discountMode === "percent" ? `${discountInput || "0"}%` : `$${discountInput === "" ? "0.00" : parseFloat(discountInput || "0").toFixed(2)}`}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] text-[var(--outline)]">Saves</span>
                                <span className="text-sm font-medium text-green-600">-${savings.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                              {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                                <button key={key}
                                  onClick={() => {
                                    if (key === "⌫") { setDiscountInput((v) => v.slice(0, -1)); }
                                    else if (key === ".") { if (!discountInput.includes(".")) setDiscountInput((v) => v + "."); }
                                    else {
                                      if (discountMode === "percent") { const next = discountInput + key; if (parseFloat(next) > 100) return; }
                                      const dotIdx = discountInput.indexOf(".");
                                      if (dotIdx !== -1 && discountInput.length - dotIdx > 2) return;
                                      setDiscountInput((v) => v + key);
                                    }
                                  }}
                                  className="h-11 rounded-xl text-sm font-medium bg-white border border-[var(--outline-variant)] active:bg-[var(--primary-light)] transition-colors"
                                >{key}</button>
                              ))}
                            </div>
                            <div className="flex gap-1.5">
                              <button disabled={!item.discount}
                                onClick={() => {
                                  setItemDiscount(item.id, null); setDiscountInput("");
                                  setTimeout(() => { setDiscountId(null); setExpandedId(null); }, 1000);
                                }}
                                className="flex-1 h-10 rounded-xl text-xs font-medium border border-[var(--outline-variant)] active:bg-[var(--surface)] disabled:opacity-40"
                              >RESET</button>
                              <button
                                onClick={() => {
                                  const val = parseFloat(discountInput);
                                  if (!isNaN(val) && val > 0) { setItemDiscount(item.id, { type: discountMode, value: val }); }
                                  else { setItemDiscount(item.id, null); }
                                  setDiscountId(null); setDiscountInput(""); setExpandedId(null);
                                }}
                                className="flex-[2] h-10 rounded-xl text-xs font-medium text-white active:opacity-80"
                                style={{ background: "#6750A4" }}
                              >Apply Discount</button>
                            </div>
                          </div>
                          );
                        })()}

                        {/* Note editor */}
                        {noteEditId === item.id && (
                          <div className="px-4 pb-2 space-y-2">
                            <div className="flex gap-2">
                              <input ref={noteInputRef} type="text" inputMode="text" enterKeyHint="done"
                                value={noteValue} onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="e.g. Swap protein to beef"
                                className="flex-1 px-3 py-1.5 border border-[var(--outline-variant)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)]"
                              />
                              <input type="text" inputMode="numeric" pattern="[0-9+\-\.]*" enterKeyHint="done"
                                value={priceAdjValue} onChange={(e) => setPriceAdjValue(e.target.value)}
                                placeholder="+$0"
                                className="w-16 px-2 py-1.5 border border-[var(--outline-variant)] rounded-lg text-sm text-center focus:outline-none focus:border-[var(--primary)]"
                              />
                            </div>
                            <button onClick={() => saveNote(item.id)}
                              disabled={!noteValue.trim() && !priceAdjValue.trim()}
                              className="w-full py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-40"
                            >Save</button>
                          </div>
                        )}

                          {item.breakline && (
                            <div className="mx-4 mt-1 mb-0" style={{ height: 3, borderRadius: 2, background: "var(--foreground)" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer: minimized when numpad is open, full otherwise */}
            {(priceOverrideId || discountId) ? (
              <div
                onClick={() => {
                  setPriceOverrideId(null);
                  setPriceOverrideInput("");
                  setDiscountId(null);
                  setDiscountInput("");
                }}
                className="border-t border-[var(--outline-variant)] px-4 py-2 flex justify-between items-center cursor-pointer active:bg-gray-50"
              >
                <span className="text-xs text-[var(--outline)]">Total</span>
                <span className="text-sm font-bold">${total.toFixed(2)}</span>
              </div>
            ) : (
              <div className="border-t border-[var(--outline-variant)] px-4 py-3">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-[var(--outline)]">Total</span>
                  <span className="text-lg font-bold">
                    ${total.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 h-11 rounded-xl border border-[var(--outline-variant)] flex items-center justify-center gap-2 text-sm font-medium active:bg-[var(--surface)]">
                    <Pause size={16} />
                    Hold
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={unsentItems.length === 0}
                    className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-40 active:opacity-80"
                  >
                    <Send size={16} />
                    Send
                  </button>
                </div>
                <button
                  onClick={handlePay}
                  disabled={count === 0}
                  className="w-full h-12 mt-2 rounded-xl bg-green-600 text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80"
                >
                  <DollarSign size={16} />
                  Pay
                </button>
              </div>
            )}
          </motion.div>

        </>
      )}
    </AnimatePresence>

    {/* Rich tooltip for unsent items — M3 style */}
    {showUnsentToast && (
      <div
        className="absolute top-3 left-4 right-4 z-[60] flex flex-col rounded-xl animate-[slideDown_0.2s_ease-out]"
        style={{
          maxWidth: 328,
          background: "#F3EDF7",
          boxShadow: "0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)",
        }}
      >
        {/* Content */}
        <div className="px-4 pt-4 pb-1">
          <p className="text-2xl font-medium text-black leading-8">
            You have {unsentItems.length} unsent {unsentItems.length === 1 ? "item" : "items"}
          </p>
          <p className="text-base text-black leading-6 mt-1" style={{ letterSpacing: "0.5px" }}>
            Send items to kitchen before proceeding to pay.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center px-3 pt-3 pb-3 gap-3">
          <button
            onClick={() => {
              setShowUnsentToast(false);
              handleSend();
              // Show "Sent" state briefly, then auto-navigate to payment
              setTimeout(() => {
                onClose();
                setScreen("payment");
              }, 800);
            }}
            className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
            style={{ background: "#6750A4" }}
          >
            <span className="text-sm font-medium text-white tracking-wide">Send now and pay</span>
          </button>
          <button
            onClick={() => {
              setShowUnsentToast(false);
            }}
            className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
            style={{ background: "#E8DEF8" }}
          >
            <span className="text-sm font-medium tracking-wide" style={{ color: "#6750A4" }}>Dismiss</span>
          </button>
        </div>
      </div>
    )}
  </>
  );
}
