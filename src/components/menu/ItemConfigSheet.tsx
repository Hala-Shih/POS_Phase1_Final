"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useDragControls } from "framer-motion";
import { Minus, Plus, Check } from "lucide-react";
import { MenuItem, CartItemModifier, Modifier, CartItem } from "@/lib/types";

interface ItemConfigSheetProps {
  item: MenuItem;
  existingCartItems?: CartItem[];
  onClose: () => void;
  onAdd: (modifiers: CartItemModifier[]) => void;
  onUpdateExisting?: (cartItemId: string, modifiers: CartItemModifier[]) => void;
}

interface OrderConfig {
  cartItemId?: string; // if editing an existing cart item
  selections: Record<string, Modifier[]>;
}

export default function ItemConfigSheet({
  item,
  existingCartItems = [],
  onClose,
  onAdd,
  onUpdateExisting,
}: ItemConfigSheetProps) {
  const dragControls = useDragControls();
  const [orders, setOrders] = useState<OrderConfig[]>([{ selections: {} }]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

  const activeOrder = orders[activeOrderIndex] || orders[0];
  const quantity = orders.length;

  // Refs for auto-scroll
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevCompleteRef = useRef<Record<string, boolean>>({});

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

  // Auto-scroll to next incomplete modifier group when a selection completes one
  useEffect(() => {
    const currentComplete: Record<string, boolean> = {};
    item.modifierGroups.forEach((g) => {
      const mods = activeOrder.selections[g.id] || [];
      currentComplete[g.id] = !g.required || mods.length >= g.minSelect;
    });

    let justCompletedIdx = -1;
    for (let i = 0; i < item.modifierGroups.length; i++) {
      const gId = item.modifierGroups[i].id;
      if (currentComplete[gId] && !prevCompleteRef.current[gId]) {
        justCompletedIdx = i;
      }
    }

    prevCompleteRef.current = currentComplete;

    if (justCompletedIdx >= 0 && justCompletedIdx + 1 < item.modifierGroups.length) {
      const nextGroup = item.modifierGroups[justCompletedIdx + 1];
      const el = sectionRefs.current[nextGroup.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder.selections]);

  // Check if current order has all required modifiers
  // Check if ALL orders are complete
  const allOrdersComplete = orders.every((order) =>
    item.modifierGroups
      .filter((g) => g.required)
      .every((g) => (order.selections[g.id] || []).length >= g.minSelect)
  );

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
    setActiveOrderIndex(newOrders.length - 1);
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

        {/* Header: item name + quantity */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold flex-1">{item.name}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={removeOrder}
              disabled={orders.length <= 1}
              className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center disabled:opacity-30 active:bg-gray-100"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-semibold min-w-[16px] text-center">{quantity}</span>
            <button
              onClick={addAnotherOrder}
              className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Order tabs (shown when >1 order) */}
        {orders.length > 1 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
            {orders.map((order, i) => {
              const orderComplete = item.modifierGroups
                .filter((g) => g.required)
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
        )}

        {/* Modifier Groups */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-2">
          {item.modifierGroups.map((group) => {
            return (
              <div key={group.id} ref={(el) => { sectionRefs.current[group.id] = el; }} className="mb-4">
                <h3 className="text-sm font-semibold mb-2">
                  {group.name}
                  {group.required ? (
                    <span className="text-xs font-normal text-[var(--outline)]"> (Required)</span>
                  ) : (
                    <span className="text-xs font-normal text-[var(--outline)]"> (Optional)</span>
                  )}
                </h3>

                <div className="grid grid-cols-2 gap-1.5">
                  {group.options.map((option) => {
                    const selected = isSelected(group.id, option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => updateSelection(group.id, option, group.maxSelect)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-[var(--outline-variant)]"
                        }`}
                      >
                        <span className="text-xs leading-snug">{option.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {option.price > 0 && (
                            <span className="text-[10px] text-[var(--outline)]">
                              +${option.price.toFixed(2)}
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
          })}
        </div>

        {/* Add to cart / Save changes button */}
        <div className="border-t border-[var(--outline-variant)] px-4 py-3">
          <button
            onClick={handleAdd}
            disabled={!allOrdersComplete || !hasNewOrChangedOrders}
            className="w-full h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            {activeOrder.cartItemId ? "Save changes" : "Add to cart"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
