"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, UtensilsCrossed, Minus, Plus, Check, Trash2 } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem, CartItemModifier, Modifier } from "@/lib/types";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";
import DragHandle from "@/components/ui/DragHandle";

const menuBooks = menuData as MenuBook[];

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
}

interface OrderConfig {
  cartItemId?: string;
  selections: Record<string, Modifier[]>;
}

function formatUpcharge(price: number) {
  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
}

export default function MenuSheet({ open, onClose }: MenuSheetProps) {
  const { addItem, updateItemModifiers, updateComboSelections, updateQuantity, cartItems } = useOrderStore();

  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [comboItem, setComboItem] = useState<MenuItem | null>(null);

  // Modifier config state
  const [orders, setOrders] = useState<OrderConfig[]>([{ selections: {} }]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

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

  const level = configItem ? 3 : activeBookId == null ? 1 : 2;

  const headerTitle =
    level === 1 ? "Menu" : level === 3 ? configItem?.name : activeBook?.name;

  return (
    <>
      {open && (
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
            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {level > 1 && (
                  <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0 -ml-2">
                    <ChevronLeft size={20} />
                  </button>
                )}
                <span className="text-[15px] font-semibold text-[#1D1B20] leading-tight break-words" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{headerTitle}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {level === 3 && configItem && (
                  <div className="flex items-center gap-3">
                    {orders.length <= 1 ? (
                      <button
                        onClick={handleClose}
                        aria-label="Delete item"
                        data-no-tap-target
                        className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={removeOrder}
                        data-no-tap-target
                        className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                    <span className="text-sm font-semibold min-w-[16px] text-center">{quantity}</span>
                    <button
                      onClick={addAnotherOrder}
                      data-no-tap-target
                      className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
                {level !== 3 && (
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

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

                {/* Level 2 — Category pills + item grid */}
                {activeBookId != null && activeBook && (
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0">
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
                            className="shrink-0 px-3.5 h-11 rounded-full text-[13px] font-medium border transition-colors"
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

                    <div className="flex-1 overflow-y-auto thin-scrollbar p-3">
                      {activeCategory && (
                        <div className="grid grid-cols-2 gap-2">
                          {activeCategory.items.map((item) => {
                            const count = getItemCount(item.id);
                            const isCombo = item.isCombo && item.comboGroups && item.comboGroups.length > 0;
                            const hasModifiers = !isCombo && item.modifierGroups.length > 0;

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleItemTap(item)}
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
                      {/* Order tabs row — own row, shown when >1 orders */}
                      {orders.length > 1 && (
                        <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
                          {orders.map((order, i) => {
                            const complete = configItem.modifierGroups
                              .filter((g) => g.required && isGroupVisible(g, order.selections))
                              .every((g) => (order.selections[g.id] || []).length >= g.minSelect);
                            return (
                              <button
                                key={i}
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
                      )}
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
                    <div className="border-t border-[var(--outline-variant)] px-4 py-3 shrink-0">
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
                        className="w-full h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
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
