"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, UtensilsCrossed, Minus, Plus, Check, Trash2 } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem, CartItemModifier, Modifier } from "@/lib/types";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";
import DragHandle from "@/components/ui/DragHandle";

const menuBooks = menuData as MenuBook[];

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  actionButtons?: React.ReactNode;
}

interface OrderConfig {
  cartItemId?: string;
  selections: Record<string, Modifier[]>;
}

function formatUpcharge(price: number) {
  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
}

export default function MenuSheet({ open, onClose, actionButtons }: MenuSheetProps) {
  const { addItem, updateItemModifiers, updateComboSelections, updateQuantity, removeItem, cartItems } = useOrderStore();

  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [comboItem, setComboItem] = useState<MenuItem | null>(null);

  // Modifier config state
  const [orders, setOrders] = useState<OrderConfig[]>([{ selections: {} }]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

  // Long-press amount editor
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const activeBook = activeBookId ? menuBooks.find((b) => b.id === activeBookId) : null;
  const activeCategory = activeBook
    ? (activeBook.categories.find((c) => c.id === activeCatId) ?? activeBook.categories[0])
    : null;

  // Init modifier config when item selected
  useEffect(() => {
    if (!configItem) return;
    const existingCartItems = cartItems.filter((ci) => ci.menuItemId === configItem.id);

    const autoSelections = (): Record<string, Modifier[]> => {
      const s: Record<string, Modifier[]> = {};
      configItem.modifierGroups.forEach((group) => {
        if (group.required && group.options.length === 1) s[group.id] = [group.options[0]];
      });
      return s;
    };

    const existingOrders: OrderConfig[] = existingCartItems.flatMap((ci) => {
      const selections: Record<string, Modifier[]> = {};
      ci.modifiers.forEach((cm) => { selections[cm.groupId] = cm.modifiers; });
      return Array.from({ length: ci.quantity }, () => ({
        cartItemId: ci.id,
        selections: JSON.parse(JSON.stringify(selections)),
      }));
    });

    if (existingOrders.length > 0) {
      setOrders(existingOrders);
    } else {
      setOrders([{ selections: autoSelections() }]);
    }
    setActiveOrderIndex(0);
    setChangedOrderIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configItem?.id]);

  const activeOrder = orders[activeOrderIndex] ?? orders[0];
  const quantity = orders.length;

  // Refs for auto-scroll in modifier config (Level 3)
  const modGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const modScrollRef = useRef<HTMLDivElement | null>(null);
  const prevModCompleteRef = useRef<Record<string, boolean>>({});

  const updateSelection = (groupId: string, modifier: Modifier, maxSelect: number) => {
    setOrders((prev) => {
      const updated = [...prev];
      const current = updated[activeOrderIndex].selections[groupId] || [];
      const exists = current.find((m) => m.id === modifier.id);
      let newMods: Modifier[];
      if (exists) newMods = current.filter((m) => m.id !== modifier.id);
      else if (maxSelect === 1) newMods = [modifier];
      else if (current.length >= maxSelect) newMods = [...current.slice(1), modifier];
      else newMods = [...current, modifier];
      updated[activeOrderIndex] = {
        ...updated[activeOrderIndex],
        selections: { ...updated[activeOrderIndex].selections, [groupId]: newMods },
      };
      return updated;
    });
    const order = orders[activeOrderIndex];
    if (order?.cartItemId) setChangedOrderIds((prev) => new Set(prev).add(order.cartItemId!));
  };

  const isSelected = (groupId: string, modifierId: string) =>
    (activeOrder.selections[groupId] || []).some((m) => m.id === modifierId);

  // Conditional modifier groups (showIf): a group with `showIf` is only
  // visible when one of the listed modifier ids is selected in the source
  // group. Hidden groups are treated as not required and are cleared.
  const isGroupVisible = useCallback(
    (group: { showIf?: { groupId: string; modifierIds: string[] } }, selections: Record<string, Modifier[]>) => {
      if (!group.showIf) return true;
      const src = selections[group.showIf.groupId] || [];
      return src.some((m) => group.showIf!.modifierIds.includes(m.id));
    },
    [],
  );

  // Auto-clear selections of groups that just became hidden so they don't
  // persist into the cart or block completion.
  useEffect(() => {
    if (!configItem) return;
    setOrders((prev) => {
      let mutated = false;
      const next = prev.map((order) => {
        const cleaned: Record<string, Modifier[]> = { ...order.selections };
        configItem.modifierGroups.forEach((g) => {
          if (!isGroupVisible(g, order.selections) && cleaned[g.id]?.length) {
            delete cleaned[g.id];
            mutated = true;
          }
        });
        return mutated ? { ...order, selections: cleaned } : order;
      });
      return mutated ? next : prev;
    });
  }, [configItem, orders, isGroupVisible]);

  // Auto-scroll to next incomplete modifier group when a selection completes one
  useEffect(() => {
    if (!configItem) return;
    const visibleGroups = configItem.modifierGroups.filter((g) => isGroupVisible(g, activeOrder.selections));
    const currentComplete: Record<string, boolean> = {};
    visibleGroups.forEach((g) => {
      const mods = activeOrder.selections[g.id] || [];
      currentComplete[g.id] = !g.required || mods.length >= g.minSelect;
    });

    let justCompletedIdx = -1;
    for (let i = 0; i < visibleGroups.length; i++) {
      const gId = visibleGroups[i].id;
      if (currentComplete[gId] && !prevModCompleteRef.current[gId]) {
        justCompletedIdx = i;
      }
    }

    prevModCompleteRef.current = currentComplete;

    if (justCompletedIdx >= 0 && justCompletedIdx + 1 < visibleGroups.length) {
      const nextGroup = visibleGroups[justCompletedIdx + 1];
      const el = modGroupRefs.current[nextGroup.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder.selections]);

  const isOrderComplete = (order: OrderConfig) =>
    configItem
      ? configItem.modifierGroups
          .filter((g) => g.required && isGroupVisible(g, order.selections))
          .every((g) => (order.selections[g.id] || []).length >= g.minSelect)
      : false;

  const allOrdersComplete = orders.every(isOrderComplete);

  const showNextOrder = orders.length > 1 && isOrderComplete(orders[activeOrderIndex]) && !allOrdersComplete;

  const hasNewOrChangedOrders = orders.some((order) =>
    !order.cartItemId ? true : changedOrderIds.has(order.cartItemId)
  );

  const addAnotherOrder = () => {
    if (!configItem) return;
    const auto: Record<string, Modifier[]> = {};
    configItem.modifierGroups.forEach((g) => {
      if (g.required && g.options.length === 1) auto[g.id] = [g.options[0]];
    });
    const next = [...orders, { selections: auto }];
    setOrders(next);
    const firstIncomplete = next.findIndex((o) =>
      !configItem.modifierGroups.filter((g) => g.required && isGroupVisible(g, o.selections)).every((g) => (o.selections[g.id] || []).length >= g.minSelect)
    );
    setActiveOrderIndex(firstIncomplete >= 0 ? firstIncomplete : next.length - 1);
  };

  const removeOrder = () => {
    if (!configItem || orders.length <= 1) return;
    // Always pop the most recently added (last) order.
    const removed = orders[orders.length - 1];
    const next = orders.slice(0, -1);
    setOrders(next);
    setActiveOrderIndex(Math.min(activeOrderIndex, next.length - 1));
    // If the popped order is backed by a cart line, decrement it so the
    // cart/check summary reflects the removal immediately. If no other
    // remaining order shares that cartItemId, fully remove that line.
    if (removed?.cartItemId) {
      // Decrement the underlying cart line; store removes line at qty 0.
      updateQuantity(removed.cartItemId, -1);
      const stillReferenced = next.some((o) => o.cartItemId === removed.cartItemId);
      if (!stillReferenced) {
        setChangedOrderIds((prev) => {
          const s = new Set(prev);
          s.delete(removed.cartItemId!);
          return s;
        });
      }
    }
  };

  const handleAddModifiers = () => {
    if (!configItem) return;
    const buildModifiers = (selections: Record<string, Modifier[]>): CartItemModifier[] =>
      Object.entries(selections)
        .filter(([, mods]) => mods.length > 0)
        .map(([groupId, mods]) => {
          const group = configItem.modifierGroups.find((g) => g.id === groupId)!;
          return { groupId, groupName: group.name, modifiers: mods };
        });

    const existingGroups: Record<string, OrderConfig[]> = {};
    const newOrders: OrderConfig[] = [];
    orders.forEach((order) => {
      if (order.cartItemId) {
        if (!existingGroups[order.cartItemId]) existingGroups[order.cartItemId] = [];
        existingGroups[order.cartItemId].push(order);
      } else {
        newOrders.push(order);
      }
    });
    for (const [cartItemId, grouped] of Object.entries(existingGroups)) {
      if (changedOrderIds.has(cartItemId))
        updateItemModifiers(cartItemId, buildModifiers(grouped[0].selections));
    }
    newOrders.forEach((order) =>
      addItem({ menuItemId: configItem.id, name: configItem.name, basePrice: configItem.price, modifiers: buildModifiers(order.selections) })
    );
    setConfigItem(null);
  };

  const pickBook = (book: MenuBook) => {
    setActiveBookId(book.id);
    setActiveCatId(book.categories[0]?.id ?? null);
  };

  const goBack = () => {
    if (configItem) setConfigItem(null);
    else { setActiveBookId(null); setActiveCatId(null); }
  };

  const handleClose = () => {
    setConfigItem(null);
    onClose();
  };

  const getItemCount = (menuItemId: string) =>
    cartItems.filter((ci) => ci.menuItemId === menuItemId).reduce((s, ci) => s + ci.quantity, 0);

  const handleItemTap = useCallback((item: MenuItem) => {
    if (item.soldOut) return;
    if (comboItem || configItem) return;
    if (item.isCombo && item.comboGroups && item.comboGroups.length > 0) {
      setComboItem(item);
      return;
    }
    if (item.modifierGroups.length > 0) {
      setConfigItem(item);
    } else {
      addItem({ menuItemId: item.id, name: item.name, basePrice: item.price, modifiers: [] });
    }
  }, [addItem, comboItem, configItem]);

  // Long-press handlers
  const startLongPress = useCallback((itemId: string) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setLongPressItemId(itemId);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleEditorAdd = useCallback((item: MenuItem) => {
    const isCombo = item.isCombo && item.comboGroups && item.comboGroups.length > 0;
    if (isCombo || item.modifierGroups.length > 0) {
      setLongPressItemId(null);
      handleItemTap(item);
    } else {
      addItem({ menuItemId: item.id, name: item.name, basePrice: item.price, modifiers: [] });
    }
  }, [addItem, handleItemTap]);

  const handleEditorRemove = useCallback((menuItemId: string) => {
    const matching = cartItems.filter(ci => ci.menuItemId === menuItemId);
    if (matching.length > 0) {
      const last = matching[matching.length - 1];
      const totalCount = matching.reduce((s, ci) => s + ci.quantity, 0);
      updateQuantity(last.id, -1);
      if (totalCount <= 1) setLongPressItemId(null);
    }
  }, [cartItems, updateQuantity]);

  // Clear long-press editor on navigation
  useEffect(() => {
    setLongPressItemId(null);
    return () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };
  }, [activeBookId, activeCatId, configItem]);

  const level = configItem ? 3 : activeBookId == null ? 1 : 2;

  const headerTitle =
    level === 1 ? "Menu" : level === 3 ? configItem?.name : activeBook?.name;

  return (
    <>
      {open && (
        <>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
            style={{ height: "55%", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
          >
            {/* Action buttons banner */}
            <div className="bg-[#F0EFF4] shrink-0 rounded-t-2xl">
              {actionButtons}
            </div>

            {/* Header — at Level 2 the header merges with category pills into one row */}
            {level !== 2 && (
              <div className="flex items-center justify-between pr-2 py-1.5 border-b border-gray-100 shrink-0" style={{ minHeight: 48, paddingLeft: 20 }}>
                <div className="flex items-center gap-1 min-w-0">
                  {level > 1 && (
                    <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0">
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <span className="text-[15px] font-semibold text-[#1D1B20] leading-tight break-words" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{headerTitle}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                </div>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 min-h-0 relative overflow-hidden">

                {/* Level 1 — Book grid */}
                {activeBookId == null && (
                  <div className="absolute inset-0 overflow-y-auto thin-scrollbar p-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      {menuBooks.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => pickBook(book)}
                          className="flex flex-col items-center justify-center py-6 px-3 border border-[#E7E0EC] rounded-2xl bg-white active:bg-[var(--primary-light)] transition-colors text-center"
                          style={{ minHeight: 80 }}
                        >
                          <span className="text-[15px] font-semibold text-[#1D1B20] leading-snug">{book.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 2 — Combined header + category pills row, then item grid */}
                {activeBookId != null && activeBook && (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex items-center gap-1 pl-2 py-1.5 border-b border-gray-100 shrink-0">
                      <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0" style={{ marginRight: -6 }}>
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-[14px] font-semibold text-[#1D1B20] shrink-0 mr-2.5">{activeBook.name}</span>
                      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar pr-2">
                        {activeBook.categories.map((cat) => {
                          const active = (activeCatId ?? activeBook.categories[0]?.id) === cat.id;
                          return (
                            <button
                              key={cat.id}
                              onClick={(e) => {
                                setActiveCatId(cat.id);
                                e.currentTarget.scrollIntoView({
                                  behavior: "smooth",
                                  inline: "center",
                                  block: "nearest",
                                });
                              }}
                              className="shrink-0 px-3 h-9 rounded-full text-[13px] font-medium border transition-colors"
                              style={
                                active
                                  ? { background: "#6750A4", color: "white", borderColor: "#6750A4" }
                                  : { background: "white", color: "#1D1B20", borderColor: "#CAC4D0" }
                              }
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto thin-scrollbar p-3" onClick={() => longPressItemId && setLongPressItemId(null)}>
                      {activeCategory && (
                        <div className="grid grid-cols-2 gap-2">
                          {activeCategory.items.map((item) => {
                            const count = getItemCount(item.id);
                            const isCombo = item.isCombo && item.comboGroups && item.comboGroups.length > 0;
                            const hasModifiers = !isCombo && item.modifierGroups.length > 0;
                            const isEditing = longPressItemId === item.id;

                            if (isEditing) {
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between px-2 rounded-xl"
                                  style={{
                                    height: 44,
                                    border: "2px solid #6750A4",
                                    background: "#F3EDF7",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={() => {
                                    longPressTimerRef.current = setTimeout(() => setLongPressItemId(null), 500);
                                  }}
                                  onPointerUp={cancelLongPress}
                                  onPointerCancel={cancelLongPress}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => handleEditorRemove(item.id)}
                                    disabled={count === 0}
                                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60 disabled:opacity-30"
                                  >
                                    {count <= 1 ? <Trash2 size={16} style={{ color: "#B3261E" }} /> : <Minus size={18} style={{ color: "#6750A4" }} />}
                                  </button>
                                  <span className="text-[16px] font-bold text-[#6750A4] min-w-[24px] text-center">{count}</span>
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => handleEditorAdd(item)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60"
                                  >
                                    <Plus size={18} style={{ color: "#6750A4" }} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                key={item.id}
                                onPointerDown={() => { if (!item.soldOut) startLongPress(item.id); }}
                                onPointerUp={cancelLongPress}
                                onPointerCancel={cancelLongPress}
                                onTouchMove={cancelLongPress}
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (longPressTriggeredRef.current) {
                                    longPressTriggeredRef.current = false;
                                    return;
                                  }
                                  if (longPressItemId) setLongPressItemId(null);
                                  handleItemTap(item);
                                }}
                                disabled={item.soldOut}
                                className="flex items-center gap-1.5 px-3 rounded-xl border transition-colors active:opacity-80"
                                style={{
                                  height: 44,
                                  border: count > 0 ? "1px solid #6750A4" : "1px solid #E7E0EC",
                                  background: count > 0 ? "#F3EDF7" : item.soldOut ? "#F5F5F5" : "white",
                                  opacity: item.soldOut ? 0.5 : 1,
                                }}
                              >
                                <span className="flex-1 text-[13px] font-normal text-[#1D1B20] leading-snug text-left truncate">
                                  {item.name}
                                </span>
                                {item.soldOut && (
                                  <span className="text-[10px] text-[var(--error)] font-medium shrink-0">Sold out</span>
                                )}
                                {count > 0 && (
                                  <span
                                    className="min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 text-[11px] font-bold text-white shrink-0"
                                    style={{ background: "#6750A4" }}
                                  >
                                    {count}
                                  </span>
                                )}
                                {isCombo && !item.soldOut && (
                                  <ChevronRight size={14} className="shrink-0" style={{ color: count > 0 ? "#6750A4" : "#79747e" }} />
                                )}
                                {hasModifiers && !item.soldOut && (
                                  <ChevronRight size={14} className="shrink-0" style={{ color: count > 0 ? "#6750A4" : "#79747e" }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Level 3 — Modifier drill-in, instant (no animation) */}
              {configItem && (
                  <div className="absolute inset-0 bg-white flex flex-col" style={{ zIndex: 10 }}>
                    {/* Qty editor lives in the sheet header (next to X) */}
                    <div className="shrink-0">
                      {/* Order tabs row — always visible */}
                      <div className="flex items-center px-4 pb-2">
                        <button
                          onClick={addAnotherOrder}
                          disabled={!allOrdersComplete || orders.some(o => !o.cartItemId)}
                          className="w-7 h-7 rounded-full border border-dashed border-[var(--outline-variant)] flex items-center justify-center shrink-0 transition-colors active:bg-gray-50 mr-[12px] disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
                          {orders.map((order, i) => {
                            const complete = configItem.modifierGroups
                              .filter((g) => g.required && isGroupVisible(g, order.selections))
                              .every((g) => (order.selections[g.id] || []).length >= g.minSelect);
                            return (
                              <button
                                key={i}
                                ref={(el) => {
                                  if (i === activeOrderIndex && el) {
                                    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                                  }
                                }}
                                onClick={() => setActiveOrderIndex(i)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 transition-colors ${
                                  i === activeOrderIndex
                                    ? "border-[var(--primary)] bg-[var(--primary-light)]"
                                    : "border-[var(--outline-variant)]"
                                }`}
                              >
                                {complete && <Check size={12} className="text-[var(--primary)]" />}
                                Order {i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Modifier groups */}
                    <div ref={modScrollRef} className="flex-1 overflow-y-auto thin-scrollbar px-4 pb-2">
                      {(() => {
                        const visibleGroups = configItem.modifierGroups.filter((g) => isGroupVisible(g, activeOrder.selections));
                        return visibleGroups.map((group, gIdx) => {
                          const selectedCount = (activeOrder.selections[group.id] || []).length;
                          const isSkipped = group.required && selectedCount < group.minSelect &&
                            visibleGroups.slice(gIdx + 1).some((g) => (activeOrder.selections[g.id] || []).length > 0);
                          return (
                          <div key={group.id} ref={(el) => { modGroupRefs.current[group.id] = el; }} className="mb-3">
                            <p className="text-xs font-semibold mb-1.5 text-[#1D1B20]">
                              {group.name}
                              <span className={`font-normal ml-1 text-[12px] ${isSkipped ? "text-[var(--error)]" : "text-[var(--outline)]"}`}>
                                {group.required ? "Required" : "Optional"}
                              </span>
                            </p>

                            <div className="grid grid-cols-2 gap-1.5">
                              {group.options.map((option) => {
                                const selected = isSelected(group.id, option.id);
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => updateSelection(group.id, option, group.maxSelect)}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                                      selected ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--outline-variant)]"
                                    }`}
                                  >
                                    <span className="text-xs leading-snug">{option.name}</span>
                                    <div className="flex items-center gap-1 shrink-0 ml-1">
                                      {option.price > 0 && (
                                        <span className="text-[10px] text-[var(--outline)]">+${formatUpcharge(option.price)}</span>
                                      )}
                                      {selected && <Check size={14} className="text-[var(--primary)]" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                        });
                      })()}
                    </div>

                    {/* Add to order */}
                    <div className="border-t border-[var(--outline-variant)] px-4 py-3 shrink-0 flex gap-2">
                      {activeOrder?.cartItemId ? (
                        <button
                          onClick={() => {
                            removeItem(activeOrder.cartItemId!);
                            setConfigItem(null);
                          }}
                          className="h-10 px-4 rounded-xl border-2 border-[var(--error)] text-[var(--error)] flex items-center justify-center gap-1.5 text-sm font-semibold active:opacity-80 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (orders.length > 1) {
                              const next = orders.filter((_, i) => i !== activeOrderIndex);
                              setOrders(next);
                              setActiveOrderIndex(Math.min(activeOrderIndex, next.length - 1));
                            } else {
                              setConfigItem(null);
                            }
                          }}
                          className="h-10 px-4 rounded-xl border-2 border-[var(--outline-variant)] text-[var(--outline)] flex items-center justify-center gap-1.5 text-sm font-semibold active:opacity-80 transition-opacity"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (showNextOrder) {
                            const nextIncomplete = orders.findIndex((o, i) => i !== activeOrderIndex && !isOrderComplete(o));
                            const nextIdx = nextIncomplete >= 0 ? nextIncomplete : orders.findIndex((_, i) => i !== activeOrderIndex);
                            setActiveOrderIndex(nextIdx >= 0 ? nextIdx : activeOrderIndex);
                            modScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                            return;
                          }
                          handleAddModifiers();
                        }}
                        disabled={showNextOrder ? false : (!allOrdersComplete || !hasNewOrChangedOrders)}
                        className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
                      >
                        {showNextOrder ? "Next Order" : (activeOrder?.cartItemId ? "Save changes" : "Add to order")}
                      </button>
                    </div>
                  </div>
              )}

            </div>
          </div>

          {/* Combo sheet still overlays on top */}
          {comboItem && (
            <ComboConfigSheet
              item={comboItem}
              existingCartItems={cartItems.filter((ci) => ci.menuItemId === comboItem.id)}
              onClose={() => setComboItem(null)}
              onAdd={(comboSelections) => {
                addItem({
                  menuItemId: comboItem.id,
                  name: comboItem.name,
                  basePrice: comboItem.price,
                  modifiers: [],
                  comboSelections,
                });
              }}
              onUpdateExisting={(cartItemId, comboSelections) => {
                updateComboSelections(cartItemId, comboSelections);
              }}
            />
          )}
        </>
      )}
    </>
  );
}
