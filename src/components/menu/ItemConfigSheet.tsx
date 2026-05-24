"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useDragControls } from "framer-motion";
import { Minus, Plus, Check, Trash2 } from "lucide-react";
import { MenuItem, CartItemModifier, Modifier, CartItem } from "@/lib/types";

interface ItemConfigSheetProps {
  item: MenuItem;
  existingCartItems?: CartItem[];
  onClose: () => void;
  onAdd: (modifiers: CartItemModifier[]) => void;
  onUpdateExisting?: (cartItemId: string, modifiers: CartItemModifier[]) => void;
  onDeleteItem?: (cartItemId: string) => void;
}

interface OrderConfig {
  cartItemId?: string; // if editing an existing cart item
  selections: Record<string, Modifier[]>;
}

function formatUpcharge(price: number) {
  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
}

export default function ItemConfigSheet({
  item,
  existingCartItems = [],
  onClose,
  onAdd,
  onUpdateExisting,
  onDeleteItem,
}: ItemConfigSheetProps) {
  const dragControls = useDragControls();
  const [orders, setOrders] = useState<OrderConfig[]>([{ selections: {} }]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

  const activeOrder = orders[activeOrderIndex] || orders[0];
  const quantity = orders.length;

  // Refs for section elements
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Build initial orders from existing cart items (or one new empty order if none exist)
  useEffect(() => {
    const autoSelections = (): Record<string, Modifier[]> => {
      const s: Record<string, Modifier[]> = {};
      item.modifierGroups.forEach((group) => {
        if (group.required && group.options.length === 1) {
          s[group.id] = [group.options[0]];
        }
      });
      return s;
    };

    // Convert existing cart items to OrderConfig — expand quantity > 1 into separate orders
    const existingOrders: OrderConfig[] = existingCartItems.flatMap((ci) => {
      const selections: Record<string, Modifier[]> = {};
      ci.modifiers.forEach((cm) => {
        selections[cm.groupId] = cm.modifiers;
      });
      return Array.from({ length: ci.quantity }, () => ({
        cartItemId: ci.id,
        selections: JSON.parse(JSON.stringify(selections)),
      }));
    });

    if (existingOrders.length > 0) {
      // Only show existing orders; user can add new via "+"
      setOrders(existingOrders);
      setActiveOrderIndex(0);
    } else {
      // No existing orders — start with one new empty order
      const newOrder: OrderConfig = { selections: autoSelections() };
      setOrders([newOrder]);
      setActiveOrderIndex(0);
    }
    setChangedOrderIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const updateSelection = (groupId: string, modifier: Modifier, maxSelect: number) => {
    setOrders((prev) => {
      const updated = [...prev];
      const current = updated[activeOrderIndex].selections[groupId] || [];
      const exists = current.find((m) => m.id === modifier.id);

      let newMods: Modifier[];
      if (exists) {
        newMods = current.filter((m) => m.id !== modifier.id);
      } else if (maxSelect === 1) {
        newMods = [modifier];
      } else if (current.length >= maxSelect) {
        newMods = [...current.slice(1), modifier];
      } else {
        newMods = [...current, modifier];
      }

      updated[activeOrderIndex] = {
        ...updated[activeOrderIndex],
        selections: { ...updated[activeOrderIndex].selections, [groupId]: newMods },
      };
      return updated;
    });
    // Mark this order as changed if it's an existing cart order
    const order = orders[activeOrderIndex];
    if (order?.cartItemId) {
      setChangedOrderIds((prev) => new Set(prev).add(order.cartItemId!));
    }
  };

  const isSelected = (groupId: string, modifierId: string) =>
    (activeOrder.selections[groupId] || []).some((m) => m.id === modifierId);

  // Conditional modifier groups (showIf): a group with `showIf` is only
  // visible when one of the listed modifier ids is selected in the source
  // group. Hidden groups are treated as not required and are cleared.
  const isGroupVisible = (
    group: { showIf?: { groupId: string; modifierIds: string[] } },
    selections: Record<string, Modifier[]>,
  ) => {
    if (!group.showIf) return true;
    const src = selections[group.showIf.groupId] || [];
    return src.some((m) => group.showIf!.modifierIds.includes(m.id));
  };

  // Auto-clear selections of groups that just became hidden so they don't
  // persist into the cart or block completion.
  useEffect(() => {
    setOrders((prev) => {
      let mutated = false;
      const next = prev.map((order) => {
        const cleaned: Record<string, Modifier[]> = { ...order.selections };
        item.modifierGroups.forEach((g) => {
          if (!isGroupVisible(g, order.selections) && cleaned[g.id]?.length) {
            delete cleaned[g.id];
            mutated = true;
          }
        });
        return mutated ? { ...order, selections: cleaned } : order;
      });
      return mutated ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const isOrderComplete = (order: OrderConfig) =>
    item.modifierGroups
      .filter((g) => g.required && isGroupVisible(g, order.selections))
      .every((g) => (order.selections[g.id] || []).length >= g.minSelect);

  // Check if current order has all required modifiers
  // Check if ALL orders are complete
  const allOrdersComplete = orders.every((order) => isOrderComplete(order));

  // Check if any order has been modified from its original state or is new
  const hasNewOrChangedOrders = orders.some((order) => {
    if (!order.cartItemId) return true; // new order
    return changedOrderIds.has(order.cartItemId); // existing order was touched
  });

  // Add another order for the same item
  const addAnotherOrder = () => {
    const autoSelections: Record<string, Modifier[]> = {};
    item.modifierGroups.forEach((group) => {
      if (group.required && group.options.length === 1) {
        autoSelections[group.id] = [group.options[0]];
      }
    });
    const newOrders = [...orders, { selections: autoSelections }];
    setOrders(newOrders);
    const firstIncompleteIndex = newOrders.findIndex((order) => !isOrderComplete(order));
    setActiveOrderIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : newOrders.length - 1);
  };

  // Remove an order (only new ones, not existing)
  const removeOrder = () => {
    if (orders.length <= 1) return;
    // Don't allow removing below the total quantity of existing items
    const minOrders = existingCartItems.reduce((sum, ci) => sum + ci.quantity, 0);
    if (orders.length <= minOrders) return;
    const newOrders = orders.filter((_, i) => i !== activeOrderIndex);
    setOrders(newOrders);
    setActiveOrderIndex(Math.min(activeOrderIndex, newOrders.length - 1));
  };

  const handleAdd = () => {
    const buildModifiers = (selections: Record<string, Modifier[]>): CartItemModifier[] =>
      Object.entries(selections)
        .filter(([, mods]) => mods.length > 0)
        .map(([groupId, mods]) => {
          const group = item.modifierGroups.find((g) => g.id === groupId)!;
          return { groupId, groupName: group.name, modifiers: mods };
        });

    // Group orders by cartItemId so we can figure out what changed
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

    // For each existing cart item, update its modifiers/quantity based on grouped orders
    for (const [cartItemId, groupedOrders] of Object.entries(existingGroups)) {
      if (onUpdateExisting && changedOrderIds.has(cartItemId)) {
        // Use the first order's modifiers as the canonical modifiers for this cart item
        const cartModifiers = buildModifiers(groupedOrders[0].selections);
        onUpdateExisting(cartItemId, cartModifiers);
      }
    }

    // Add new orders
    newOrders.forEach((order) => {
      onAdd(buildModifiers(order.selections));
    });

    onClose();
  };

  const showNextAction = orders.length > 1 && !allOrdersComplete;
  const primaryDisabled = showNextAction
    ? !isOrderComplete(activeOrder)
    : !allOrdersComplete || !hasNewOrChangedOrders;

  const handlePrimaryAction = () => {
    if (showNextAction) {
      const firstIncompleteIndex = orders.findIndex((order) => !isOrderComplete(order));
      if (firstIncompleteIndex >= 0) {
        setActiveOrderIndex(firstIncompleteIndex);
      }
      return;
    }

    handleAdd();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black z-40"
      />

      {/* Sheet - sits above cart bar (~48px) */}
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
        className="absolute bottom-[48px] left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col"
        style={{ maxHeight: "calc(100% - 108px)" }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: "none" }}
          className="flex justify-center pt-2 pb-1"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header: item name */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold flex-1">{item.name}</h2>
        </div>

        {/* Order tabs — always visible */}
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
              const orderComplete = item.modifierGroups
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
                  {orderComplete && <Check size={12} className="text-[var(--primary)]" />}
                  Order {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modifier Groups */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-2">
          {(() => {
            const visibleGroups = item.modifierGroups.filter((group) => isGroupVisible(group, activeOrder.selections));
            return visibleGroups.map((group, gIdx) => {
              const selectedCount = (activeOrder.selections[group.id] || []).length;
              const isSkipped = group.required && selectedCount < group.minSelect &&
                visibleGroups.slice(gIdx + 1).some((g) => (activeOrder.selections[g.id] || []).length > 0);
              return (
              <div key={group.id} ref={(el) => { sectionRefs.current[group.id] = el; }} className="mb-4">
                <h3 className="text-sm font-semibold mb-2">
                  {group.name}
                  {group.required ? (
                    <span className={`text-[12px] font-normal ml-1 ${isSkipped ? "text-[var(--error)]" : "text-[var(--outline)]"}`}>Required</span>
                  ) : (
                    <span className="text-[12px] font-normal ml-1 text-[var(--outline)]">Optional</span>
                  )}
                </h3>

                <div className="grid grid-cols-3 gap-1.5">
                  {group.options.map((option) => {
                    const selected = isSelected(group.id, option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => updateSelection(group.id, option, group.maxSelect)}
                        className={`flex min-h-[44px] items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-[var(--outline-variant)]"
                        }`}
                      >
                        <span className="text-xs leading-snug">{option.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {option.price > 0 && (
                            <span className="text-[10px] text-[var(--outline)]">
                              +${formatUpcharge(option.price)}
                            </span>
                          )}
                          {selected && (
                            <Check size={14} className="text-[var(--primary)]" />
                          )}
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

        {/* Delete / Add to cart / Save changes button */}
        <div className="border-t border-[var(--outline-variant)] px-4 py-3 flex gap-2">
          {activeOrder.cartItemId && onDeleteItem && (
            <button
              onClick={() => {
                onDeleteItem(activeOrder.cartItemId!);
                onClose();
              }}
              className="h-11 px-4 rounded-xl border-2 border-[var(--error)] text-[var(--error)] flex items-center justify-center gap-1.5 text-sm font-semibold active:opacity-80 transition-opacity"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            {showNextAction ? "Next Order" : (activeOrder.cartItemId ? "Save changes" : "Add to cart")}
          </button>
        </div>
      </motion.div>
    </>
  );
}
