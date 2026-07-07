"use client";

import { useState, useEffect, useRef } from "react";

import { Check, Plus, Minus, ArrowLeft, Trash2 } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import {
  MenuItem,
  ComboGroup,
  ComboComponent,
  Modifier,
  CartComboSelection,
  CartItemModifier,
  CartItem,
} from "@/lib/types";

interface ComboConfigSheetProps {
  item: MenuItem;
  existingCartItems?: CartItem[];
  onClose: () => void;
  onAdd: (comboSelections: CartComboSelection[]) => void;
  onUpdateExisting?: (cartItemId: string, comboSelections: CartComboSelection[]) => void;
}

interface ComboState {
  cartItemId?: string; // if editing existing
  selectedComponent: Record<string, ComboComponent[]>;
  componentModifiers: Record<string, Record<string, Record<string, Modifier[]>>>;
}

function formatUpcharge(price: number) {
  return Number.isInteger(price) ? price.toString() : price.toFixed(2);
}

function buildEmptyState(): ComboState {
  return { selectedComponent: {}, componentModifiers: {} };
}

function buildStateFromCartItem(
  ci: CartItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  comboGroups: ComboGroup[]
): ComboState {
  const selectedComponent: Record<string, ComboComponent[]> = {};
  const componentModifiers: Record<string, Record<string, Record<string, Modifier[]>>> = {};

  (ci.comboSelections || []).forEach((sel) => {
    if (!selectedComponent[sel.groupId]) selectedComponent[sel.groupId] = [];
    selectedComponent[sel.groupId].push(sel.component);
    const compMods: Record<string, Modifier[]> = {};
    sel.modifiers.forEach((cm) => {
      compMods[cm.groupId] = cm.modifiers;
    });
    if (!componentModifiers[sel.groupId]) componentModifiers[sel.groupId] = {};
    componentModifiers[sel.groupId][sel.component.id] = compMods;
  });

  return { cartItemId: ci.id, selectedComponent, componentModifiers };
}

export default function ComboConfigSheet({
  item,
  existingCartItems = [],
  onClose,
  onAdd,
  onUpdateExisting,
}: ComboConfigSheetProps) {
  const comboGroups = item.comboGroups || [];

  // Broadcast open state so the underlying CheckSummaryScreen can reserve
  // extra space below its scroll viewport (combo sheet is taller than the
  // standard 60% drawer).
  const setComboSheetOpen = useOrderStore((s) => s.setComboSheetOpen);
  const removeItem = useOrderStore((s) => s.removeItem);
  const language = useOrderStore((s) => s.language);
  const displayName = language === "zh" && item.nameCn ? item.nameCn : item.name;
  const cn = (o: { name: string; nameCn?: string }) =>
    language === "zh" && o.nameCn ? o.nameCn : o.name;
  const L = language === "zh"
    ? { required: "必選", ready: "完成", chooseMore: (n: number) => `還需選 ${n} 項`, order: "份", addToCart: "加入購物車", saveChanges: "保存修改", nextOrder: "下一份" }
    : { required: "Required", ready: "Ready", chooseMore: (n: number) => `Choose ${n} more`, order: "Order", addToCart: "Add to cart", saveChanges: "Save changes", nextOrder: "Next Order" };
  useEffect(() => {
    setComboSheetOpen(true);
    return () => setComboSheetOpen(false);
  }, [setComboSheetOpen]);

  const [orders, setOrders] = useState<ComboState[]>(() =>
    existingCartItems.length > 0
      ? existingCartItems.map((ci) => buildStateFromCartItem(ci, comboGroups))
      : [buildEmptyState()]
  );
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  // Track whether user has made any change to existing orders
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

  // Swipe-to-edit count state (mirrors MenuSheet interaction pattern).
  const [editingCountKey, setEditingCountKey] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; key: string } | null>(null);
  const swipeTriggeredRef = useRef(false);
  const SWIPE_THRESHOLD = 40;

  const activeOrder = orders[activeOrderIndex] || orders[0];
  const quantity = orders.length;

  const startSwipeDetection = (key: string, x: number) => {
    if (swipeTriggeredRef.current) return;
    swipeStartRef.current = { x, key };
    swipeTriggeredRef.current = false;
  };

  const handleSwipeMove = (x: number) => {
    if (!swipeStartRef.current || swipeTriggeredRef.current) return;
    const delta = Math.abs(x - swipeStartRef.current.x);
    if (delta >= SWIPE_THRESHOLD) {
      swipeTriggeredRef.current = true;
      setEditingCountKey(swipeStartRef.current.key);
    }
  };

  const cancelSwipe = () => {
    swipeStartRef.current = null;
    swipeTriggeredRef.current = false;
  };

  // Refs for auto-scroll (keyed by group id or "groupId:compId:modGroupId")
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build initial orders from existing cart items (or one new empty order if none exist)
  useEffect(() => {
    const existingOrders: ComboState[] = existingCartItems.map((ci) =>
      buildStateFromCartItem(ci, comboGroups)
    );

    if (existingOrders.length > 0) {
      setOrders(existingOrders);
      setActiveOrderIndex(0);
    } else {
      setOrders([buildEmptyState()]);
      setActiveOrderIndex(0);
    }
    setChangedOrderIds(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    setEditingCountKey(null);
    cancelSwipe();
  }, [activeOrderIndex]);

  const updateActiveOrder = (updater: (prev: ComboState) => ComboState) => {
    setOrders((prev) => {
      const updated = [...prev];
      updated[activeOrderIndex] = updater(updated[activeOrderIndex]);
      return updated;
    });
    // Mark this order as changed if it's an existing cart order
    const order = orders[activeOrderIndex];
    if (order?.cartItemId) {
      setChangedOrderIds((prev) => new Set(prev).add(order.cartItemId!));
    }
  };

  const getComponentCount = (order: ComboState, groupId: string, componentId: string) =>
    (order.selectedComponent[groupId] || []).filter((c) => c.id === componentId).length;

  const setComponentCount = (group: ComboGroup, component: ComboComponent, nextCount: number) => {
    updateActiveOrder((prev) => {
      const current = prev.selectedComponent[group.id] || [];
      const currentCount = current.filter((c) => c.id === component.id).length;
      const otherCount = current.length - currentCount;
      const bounded = Math.max(0, Math.min(nextCount, Math.max(0, group.maxSelect - otherCount)));
      if (bounded === currentCount) return prev;

      const withoutTarget = current.filter((c) => c.id !== component.id);
      const withTarget = [...withoutTarget, ...Array.from({ length: bounded }, () => component)];

      const nextComponentModifiers = { ...prev.componentModifiers };
      if (bounded === 0 && nextComponentModifiers[group.id]?.[component.id]) {
        const groupMods = { ...(nextComponentModifiers[group.id] || {}) };
        delete groupMods[component.id];
        nextComponentModifiers[group.id] = groupMods;
      }

      return {
        ...prev,
        selectedComponent: { ...prev.selectedComponent, [group.id]: withTarget },
        componentModifiers: nextComponentModifiers,
      };
    });
  };

  const incrementComponent = (group: ComboGroup, component: ComboComponent) => {
    const currentCount = getComponentCount(activeOrder, group.id, component.id);
    setComponentCount(group, component, currentCount + 1);
  };

  const decrementComponent = (group: ComboGroup, component: ComboComponent) => {
    const currentCount = getComponentCount(activeOrder, group.id, component.id);
    setComponentCount(group, component, currentCount - 1);
  };

  const selectComponent = (group: ComboGroup, component: ComboComponent) => {
    if (group.maxSelect > 1) {
      incrementComponent(group, component);
      return;
    }

    updateActiveOrder((prev) => {
      const current = prev.selectedComponent[group.id] || [];
      const idx = current.findIndex((c) => c.id === component.id);
      const newList = idx >= 0 ? [] : [component];
      return {
        ...prev,
        selectedComponent: { ...prev.selectedComponent, [group.id]: newList },
      };
    });
  };

  const getModifierCount = (
    order: ComboState,
    groupId: string,
    componentId: string,
    modGroupId: string,
    modifierId: string
  ) =>
    (order.componentModifiers[groupId]?.[componentId]?.[modGroupId] || []).filter(
      (m) => m.id === modifierId
    ).length;

  const selectModifier = (
    groupId: string,
    componentId: string,
    modGroupId: string,
    modifier: Modifier,
    maxSelect: number
  ) => {
    updateActiveOrder((prev) => {
      const groupMods = prev.componentModifiers[groupId] || {};
      const compMods = groupMods[componentId] || {};
      const current = compMods[modGroupId] || [];
      let newMods: Modifier[];

      if (maxSelect === 1) {
        const exists = current.find((m) => m.id === modifier.id);
        newMods = exists ? [] : [modifier];
      } else {
        if (current.length >= maxSelect) return prev;
        newMods = [...current, modifier];
      }

      return {
        ...prev,
        componentModifiers: {
          ...prev.componentModifiers,
          [groupId]: {
            ...groupMods,
            [componentId]: {
              ...compMods,
              [modGroupId]: newMods,
            },
          },
        },
      };
    });

    // Auto-advance after modifier selection
  };

  const decrementModifier = (
    groupId: string,
    componentId: string,
    modGroupId: string,
    modifier: Modifier
  ) => {
    updateActiveOrder((prev) => {
      const groupMods = prev.componentModifiers[groupId] || {};
      const compMods = groupMods[componentId] || {};
      const current = compMods[modGroupId] || [];
      const idx = current.findIndex((m) => m.id === modifier.id);
      if (idx < 0) return prev;
      const newMods = [...current];
      newMods.splice(idx, 1);

      return {
        ...prev,
        componentModifiers: {
          ...prev.componentModifiers,
          [groupId]: {
            ...groupMods,
            [componentId]: {
              ...compMods,
              [modGroupId]: newMods,
            },
          },
        },
      };
    });
  };

  const isModSelected = (
    groupId: string,
    componentId: string,
    modGroupId: string,
    modId: string
  ) => {
    return (
      activeOrder.componentModifiers[groupId]?.[componentId]?.[modGroupId]?.some(
        (m) => m.id === modId
      ) || false
    );
  };

  const isComponentComplete = (order: ComboState, groupId: string, component: ComboComponent) => {
    if (component.modifierGroups.length === 0) return true;
    return component.modifierGroups
      .filter((mg) => mg.required)
      .every((mg) => {
        const mods = order.componentModifiers[groupId]?.[component.id]?.[mg.id] || [];
        return mods.length >= mg.minSelect;
      });
  };

  const isGroupCompleteForOrder = (order: ComboState, group: ComboGroup) => {
    if (!group.required) return true;
    const selected = order.selectedComponent[group.id] || [];
    if (selected.length < group.minSelect) return false;
    return selected.every((comp) => isComponentComplete(order, group.id, comp));
  };

  const isOrderComplete = (order: ComboState) =>
    comboGroups.every((g) => isGroupCompleteForOrder(order, g));

  const comboDrawerHeight = "75%";

  const shortGroupName = (name: string) =>
    name
      .replace(/^choose\s+your\s+/i, "")
      .replace(/^choose\s+/i, "")
      .replace(/^select\s+/i, "")
      .trim();

  const getComponentModifierNames = (order: ComboState, groupId: string, componentId: string) => {
    const compMods = order.componentModifiers[groupId]?.[componentId] || {};
    return Object.values(compMods).flatMap((mods) => mods.map((m) => cn(m)));
  };

  const formatSelectionLine = (groupName: string, component: ComboComponent, modifierNames: string[]) => {
    const left = `${shortGroupName(groupName)}: ${cn(component)}`;
    return modifierNames.length > 0 ? `${left} (${modifierNames.join(", ")})` : left;
  };



  const allOrdersComplete = orders.every((o) => isOrderComplete(o));

  // Check if any order has been modified from its original state or is new
  const hasNewOrChangedOrders = orders.some((order) => {
    if (!order.cartItemId) return true; // new order (no cartItemId = not yet in cart)
    return changedOrderIds.has(order.cartItemId); // existing order was touched
  });

  // Compute total for active order
  const computeUpcharges = (order: ComboState) =>
    comboGroups.reduce((sum, group) => {
      const comps = order.selectedComponent[group.id] || [];
      return sum + comps.reduce((groupSum, comp) => {
        let compSum = comp.price;
        const mods = order.componentModifiers[group.id]?.[comp.id] || {};
        Object.values(mods).forEach((modArr) => {
          modArr.forEach((m) => { compSum += m.price; });
        });
        return groupSum + compSum;
      }, 0);
    }, 0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeTotal = item.price + computeUpcharges(activeOrder);

  // Add another order
  const addAnotherOrder = () => {
    const newOrders = [...orders, buildEmptyState()];
    setOrders(newOrders);
    const firstIncompleteIndex = newOrders.findIndex((order) => !isOrderComplete(order));
    setActiveOrderIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : newOrders.length - 1);
  };

  // Remove an order
  const removeOrder = () => {
    if (orders.length <= 1) return;
    const minOrders = existingCartItems.length;
    if (orders.length <= minOrders) return;
    const newOrders = orders.filter((_, i) => i !== activeOrderIndex);
    setOrders(newOrders);
    setActiveOrderIndex(Math.min(activeOrderIndex, newOrders.length - 1));
  };

  const buildSelections = (order: ComboState): CartComboSelection[] => {
    const selections: CartComboSelection[] = [];
    comboGroups.forEach((group) => {
      const comps = order.selectedComponent[group.id] || [];
      comps.forEach((comp) => {
        const compMods = order.componentModifiers[group.id]?.[comp.id] || {};
        const cartMods: CartItemModifier[] = Object.entries(compMods)
          .filter(([, mods]) => mods.length > 0)
          .map(([modGroupId, mods]) => {
            const modGroup = comp.modifierGroups.find((mg) => mg.id === modGroupId)!;
            return { groupId: modGroupId, groupName: modGroup.name, modifiers: mods };
          });
        selections.push({
          groupId: group.id,
          groupName: group.name,
          component: comp,
          modifiers: cartMods,
        });
      });
    });
    return selections;
  };

  const handleAdd = () => {
    orders.forEach((order) => {
      const selections = buildSelections(order);
      if (order.cartItemId && onUpdateExisting) {
        // Only push updates for orders the user actually changed. Touching
        // unchanged existing orders would re-trigger the cart's merge logic
        // and could collapse them back into a single line, causing edits
        // made on later orders to be applied to all of them.
        if (changedOrderIds.has(order.cartItemId)) {
          onUpdateExisting(order.cartItemId, selections);
        }
      } else {
        onAdd(selections);
      }
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
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
        style={{ height: comboDrawerHeight, boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 cursor-pointer shrink-0" onClick={onClose}>
          <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
        </div>

        {/* Header: back button + item name + quantity */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:bg-gray-100 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold">{displayName}</h2>
          </div>
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
              const complete = isOrderComplete(order);
              return (
                <button
                  key={i}
                  onClick={() => {
                    setActiveOrderIndex(i);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 transition-colors ${
                    i === activeOrderIndex
                      ? "border-[var(--primary)] bg-[var(--primary-light)]"
                      : "border-[var(--outline-variant)]"
                  }`}
                >
                  {complete && <Check size={12} className="text-[var(--primary)]" />}
                  {L.order} {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Combo groups — scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto thin-scrollbar px-4 py-2">
          {comboGroups.map((group, groupIdx) => {
            const selectedList = activeOrder.selectedComponent[group.id] || [];
            const complete = isGroupCompleteForOrder(activeOrder, group);
            const isMulti = group.maxSelect > 1;
            const remainingRequired = Math.max(0, group.minSelect - selectedList.length);
            // "Skipped" = required group not yet satisfied, but the user has
            // moved on (made selections in a later combo group).
            const laterGroupHasSelection = comboGroups
              .slice(groupIdx + 1)
              .some((g) => (activeOrder.selectedComponent[g.id] || []).length > 0);
            const isGroupSkipped = group.required && !complete && laterGroupHasSelection;

            return (
              <div key={group.id} ref={(el) => { sectionRefs.current[group.id] = el; }} className="mb-3">
                {/* Group header */}
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{cn(group)}</h3>
                    {group.required && (
                      <span className="text-[12px] text-[var(--error)]">
                        {L.required}*
                      </span>
                    )}
                    {isMulti && (
                      <span className="text-[10px] text-[var(--outline)]">
                        {selectedList.length}/{group.maxSelect}
                      </span>
                    )}
                    {!isMulti && group.required && (
                      <span className="text-[10px] text-[var(--outline)]">
                        {remainingRequired > 0 ? L.chooseMore(remainingRequired) : L.ready}
                      </span>
                    )}
                    {complete && (
                      <Check size={14} className="text-[var(--primary)] shrink-0" />
                    )}
                  </div>
                </div>

                {/* Components grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {group.components.map((comp) => {
                    const selectedCount = getComponentCount(activeOrder, group.id, comp.id);
                    const isSelected = selectedCount > 0;
                    const useCountState = group.maxSelect > 1 || group.minSelect > 1;
                    const editorKey = `comp:${group.id}:${comp.id}`;
                    const isEditing = editingCountKey === editorKey;

                    if (useCountState && isEditing) {
                      const totalSelected = selectedList.length;
                      return (
                        <div
                          key={comp.id}
                          className="flex items-center justify-between px-2 rounded-xl"
                          style={{
                            minHeight: 44,
                            border: "2px solid #6750A4",
                            background: "#F3EDF7",
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerUp={cancelSwipe}
                          onPointerCancel={cancelSwipe}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => {
                                      if (selectedCount <= 1) setEditingCountKey(null);
                              decrementComponent(group, comp);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60"
                          >
                                    {selectedCount <= 1 ? (
                                      <Trash2 size={16} style={{ color: "#B3261E" }} />
                                    ) : (
                                      <Minus size={18} style={{ color: "#6750A4" }} />
                                    )}
                          </button>
                                  <button
                                    onClick={() => setEditingCountKey(null)}
                                    className="text-[16px] font-bold text-[#6750A4] min-w-[24px] text-center active:opacity-70"
                                  >
                                    {selectedCount}
                                  </button>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => incrementComponent(group, comp)}
                            disabled={totalSelected >= group.maxSelect}
                            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60 disabled:opacity-30"
                          >
                            <Plus size={18} style={{ color: "#6750A4" }} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={comp.id}
                        onPointerDown={(e) => {
                          if (useCountState && selectedCount > 0) {
                            startSwipeDetection(editorKey, e.clientX);
                          }
                        }}
                        onPointerMove={(e) => {
                          if (useCountState) handleSwipeMove(e.clientX);
                        }}
                        onPointerUp={cancelSwipe}
                        onPointerCancel={cancelSwipe}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => {
                          if (swipeTriggeredRef.current) {
                            swipeTriggeredRef.current = false;
                            return;
                          }
                          selectComponent(group, comp);
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-[var(--outline-variant)]"
                        }`}
                      >
                        <span className="text-xs leading-snug">{cn(comp)}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {comp.price > 0 && (
                            <span className="text-[10px] text-[var(--outline)]">
                              +${formatUpcharge(comp.price)}
                            </span>
                          )}
                          {useCountState && selectedCount > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full border border-[var(--primary)] bg-[var(--primary-light)] text-[10px] leading-[16px] text-center text-[var(--primary)] font-semibold">
                              {selectedCount}
                            </span>
                          )}
                          {!useCountState && isSelected && (
                            <Check size={14} className="text-[var(--primary)]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Modifier groups for selected components */}
                {group.components
                  .filter((comp) => getComponentCount(activeOrder, group.id, comp.id) > 0 && comp.modifierGroups.length > 0)
                  .map((comp) => (
                  <div key={comp.id} className="mt-2 mb-1 pl-1">
                    {comp.modifierGroups.map((mg, mgIdx) => {
                      const mgSelectedCount = (activeOrder.componentModifiers[group.id]?.[comp.id]?.[mg.id] || []).length;
                      const laterMgEngaged = comp.modifierGroups
                        .slice(mgIdx + 1)
                        .some((other) => (activeOrder.componentModifiers[group.id]?.[comp.id]?.[other.id] || []).length > 0);
                      const isModSkipped = mg.required && mgSelectedCount < mg.minSelect &&
                        (laterMgEngaged || laterGroupHasSelection);
                      const useCountState = mg.maxSelect > 1 || mg.minSelect > 1;
                      return (
                      <div key={mg.id} ref={(el) => { sectionRefs.current[`${group.id}:${comp.id}:${mg.id}`] = el; }} className="mb-2">
                        <p className="text-xs font-semibold text-[var(--outline)] mb-1.5">
                          {shortGroupName(cn(group))}: {cn(comp)} - {cn(mg)}
                          {mg.required && (
                            <span className="font-normal ml-1 text-[12px] text-[var(--error)]">{L.required}*</span>
                          )}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {mg.options.map((opt) => {
                            const modCount = getModifierCount(activeOrder, group.id, comp.id, mg.id, opt.id);
                            const modSelected = modCount > 0;
                            const editorKey = `mod:${group.id}:${comp.id}:${mg.id}:${opt.id}`;
                            const isEditing = editingCountKey === editorKey;

                            if (useCountState && isEditing) {
                              const totalSelected = (activeOrder.componentModifiers[group.id]?.[comp.id]?.[mg.id] || []).length;
                              return (
                                <div
                                  key={opt.id}
                                  className="flex items-center justify-between px-2 rounded-lg"
                                  style={{
                                    minHeight: 44,
                                    border: "2px solid #6750A4",
                                    background: "#F3EDF7",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerUp={cancelSwipe}
                                  onPointerCancel={cancelSwipe}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => {
                                      if (modCount <= 1) setEditingCountKey(null);
                                      decrementModifier(group.id, comp.id, mg.id, opt);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60"
                                  >
                                    {modCount <= 1 ? (
                                      <Trash2 size={16} style={{ color: "#B3261E" }} />
                                    ) : (
                                      <Minus size={18} style={{ color: "#6750A4" }} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingCountKey(null)}
                                    className="text-[16px] font-bold text-[#6750A4] min-w-[24px] text-center active:opacity-70"
                                  >
                                    {modCount}
                                  </button>
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => selectModifier(group.id, comp.id, mg.id, opt, mg.maxSelect)}
                                    disabled={totalSelected >= mg.maxSelect}
                                    className="w-8 h-8 flex items-center justify-center rounded-full active:bg-white/60 disabled:opacity-30"
                                  >
                                    <Plus size={18} style={{ color: "#6750A4" }} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                key={opt.id}
                                onPointerDown={(e) => {
                                  if (useCountState && modCount > 0) {
                                    startSwipeDetection(editorKey, e.clientX);
                                  }
                                }}
                                onPointerMove={(e) => {
                                  if (useCountState) handleSwipeMove(e.clientX);
                                }}
                                onPointerUp={cancelSwipe}
                                onPointerCancel={cancelSwipe}
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (swipeTriggeredRef.current) {
                                    swipeTriggeredRef.current = false;
                                    return;
                                  }
                                  selectModifier(group.id, comp.id, mg.id, opt, mg.maxSelect);
                                }}
                                className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors text-left ${
                                  modSelected
                                    ? "border-[var(--primary)] bg-[var(--primary-light)]"
                                    : "border-[var(--outline-variant)]"
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  {cn(opt)}
                                  {useCountState && modCount > 0 && (
                                    <span className="min-w-[16px] h-[16px] px-1 rounded-full border border-[var(--primary)] bg-[var(--primary-light)] text-[10px] leading-[14px] text-center text-[var(--primary)] font-semibold">
                                      {modCount}
                                    </span>
                                  )}
                                  {!useCountState && modSelected && (
                                    <Check size={10} className="text-[var(--primary)]" />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Add to cart / Save changes button */}
        <div className="border-t border-[var(--outline-variant)] px-4 py-3">
          <div className="mb-2 space-y-0.5">
            {comboGroups.map((group) => {
              const selectedList = activeOrder.selectedComponent[group.id] || [];
              if (selectedList.length === 0) return null;

              return selectedList.map((comp) => {
                const modNames = getComponentModifierNames(activeOrder, group.id, comp.id);
                return (
                  <p key={`${group.id}:${comp.id}`} className="text-[11px] text-[var(--outline)] leading-snug truncate">
                    {formatSelectionLine(cn(group), comp, modNames)}
                  </p>
                );
              });
            })}
          </div>
          <div className="flex gap-2">
            {activeOrder.cartItemId && (
              <button
                onClick={() => {
                  removeItem(activeOrder.cartItemId!);
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
              {showNextAction ? L.nextOrder : (activeOrder.cartItemId ? L.saveChanges : L.addToCart)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
