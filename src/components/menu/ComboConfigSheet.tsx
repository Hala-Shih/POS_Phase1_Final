"use client";

import { useState, useEffect, useRef } from "react";

import { Check, Minus, Plus, ArrowLeft } from "lucide-react";
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

  const [orders, setOrders] = useState<ComboState[]>([buildEmptyState()]);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  // Track whether user has made any change to existing orders
  const [changedOrderIds, setChangedOrderIds] = useState<Set<string>>(new Set());

  const activeOrder = orders[activeOrderIndex] || orders[0];
  const quantity = orders.length;

  // Refs for auto-scroll (keyed by group id or "groupId:compId:modGroupId")
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCompleteRef = useRef<Record<string, boolean>>({});

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

  const selectComponent = (group: ComboGroup, component: ComboComponent) => {
    const firstRequiredModGroup =
      component.modifierGroups.find((mg) => mg.required) || component.modifierGroups[0];

    updateActiveOrder((prev) => {
      const current = prev.selectedComponent[group.id] || [];
      const idx = current.findIndex((c) => c.id === component.id);
      let newList: ComboComponent[];
      if (idx >= 0) {
        // Deselect
        newList = current.filter((_, i) => i !== idx);
      } else if (group.maxSelect === 1) {
        // Single-select: replace
        newList = [component];
      } else if (current.length >= group.maxSelect) {
        // At max: replace oldest
        newList = [...current.slice(1), component];
      } else {
        newList = [...current, component];
      }
      return {
        ...prev,
        selectedComponent: { ...prev.selectedComponent, [group.id]: newList },
      };
    });

    // When a selected component has required modifiers, anchor to that section first.
    if (firstRequiredModGroup) {
      const sectionKey = `${group.id}:${component.id}:${firstRequiredModGroup.id}`;
      setTimeout(() => {
        const target = sectionRefs.current[sectionKey];
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 0);
    }
  };

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
    return Object.values(compMods).flatMap((mods) => mods.map((m) => m.name));
  };

  const formatSelectionLine = (groupName: string, component: ComboComponent, modifierNames: string[]) => {
    const left = `${shortGroupName(groupName)}: ${component.name}`;
    return modifierNames.length > 0 ? `${left} (${modifierNames.join(", ")})` : left;
  };

  // Auto-scroll to next incomplete section (group or modifier) when a section becomes complete
  useEffect(() => {
    // Build flat list of sections: each combo group component selection + each modifier group
    const sections: { key: string; complete: boolean }[] = [];
    comboGroups.forEach((g) => {
      const selected = activeOrder.selectedComponent[g.id] || [];
      const componentsDone =
        selected.length >= g.minSelect && selected.every((comp) => isComponentComplete(activeOrder, g.id, comp));
      sections.push({ key: g.id, complete: componentsDone });

      // For each selected component, add its required modifier groups
      selected.forEach((comp) => {
        comp.modifierGroups.forEach((mg) => {
          const mods = activeOrder.componentModifiers[g.id]?.[comp.id]?.[mg.id] || [];
          const modComplete = !mg.required || mods.length >= mg.minSelect;
          sections.push({ key: `${g.id}:${comp.id}:${mg.id}`, complete: modComplete });
        });
      });
    });

    const currentComplete: Record<string, boolean> = {};
    sections.forEach((s) => { currentComplete[s.key] = s.complete; });

    // Find the last section that just became complete
    let justCompletedIdx = -1;
    for (let i = 0; i < sections.length; i++) {
      if (currentComplete[sections[i].key] && !prevCompleteRef.current[sections[i].key]) {
        justCompletedIdx = i;
      }
    }

    prevCompleteRef.current = currentComplete;

    if (justCompletedIdx >= 0 && justCompletedIdx + 1 < sections.length) {
      const nextSection = sections[justCompletedIdx + 1];
      const el = sectionRefs.current[nextSection.key];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder.selectedComponent, activeOrder.componentModifiers]);

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
        onUpdateExisting(order.cartItemId, selections);
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

  const getFirstMissingSectionKey = (order: ComboState) => {
    for (const group of comboGroups) {
      if (!group.required) continue;

      const selected = order.selectedComponent[group.id] || [];
      if (selected.length < group.minSelect) {
        return group.id;
      }

      for (const comp of selected) {
        for (const mg of comp.modifierGroups) {
          if (!mg.required) continue;
          const mods = order.componentModifiers[group.id]?.[comp.id]?.[mg.id] || [];
          if (mods.length < mg.minSelect) {
            return `${group.id}:${comp.id}:${mg.id}`;
          }
        }
      }
    }

    return null;
  };

  const anchorToFirstMissingForOrder = (order: ComboState) => {
    const missingKey = getFirstMissingSectionKey(order);
    if (!missingKey) return;

    setTimeout(() => {
      const target = sectionRefs.current[missingKey];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  const handlePrimaryAction = () => {
    if (showNextAction) {
      const firstIncompleteIndex = orders.findIndex((order) => !isOrderComplete(order));
      if (firstIncompleteIndex >= 0) {
        setActiveOrderIndex(firstIncompleteIndex);
        anchorToFirstMissingForOrder(orders[firstIncompleteIndex]);
      }
      return;
    }

    handleAdd();
  };

  return (
    <>
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
            <h2 className="text-base font-semibold">{item.name}</h2>
          </div>
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
                  Order {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Combo groups — scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto thin-scrollbar px-4 py-2">
          {comboGroups.map((group) => {
            const selectedList = activeOrder.selectedComponent[group.id] || [];
            const complete = isGroupCompleteForOrder(activeOrder, group);
            const isMulti = group.maxSelect > 1;
            const remainingRequired = Math.max(0, group.minSelect - selectedList.length);

            return (
              <div key={group.id} ref={(el) => { sectionRefs.current[group.id] = el; }} className="mb-3">
                {/* Group header */}
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    {complete && (
                      <Check size={14} className="text-[var(--primary)]" />
                    )}
                    <h3 className="text-sm font-semibold">{group.name}</h3>
                    {group.required && (
                      <span className="text-[10px] text-[var(--outline)]">
                        Required
                      </span>
                    )}
                    {isMulti && (
                      <span className="text-[10px] text-[var(--outline)]">
                        {selectedList.length}/{group.maxSelect}
                      </span>
                    )}
                    {!isMulti && group.required && (
                      <span className="text-[10px] text-[var(--outline)]">
                        {remainingRequired > 0 ? `Choose ${remainingRequired} more` : "Ready"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Components grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {group.components.map((comp) => {
                    const isSelected = selectedList.some((c) => c.id === comp.id);

                    return (
                      <button
                        key={comp.id}
                        onClick={() => selectComponent(group, comp)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary-light)]"
                            : "border-[var(--outline-variant)]"
                        }`}
                      >
                        <span className="text-xs leading-snug">{comp.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {comp.price > 0 && (
                            <span className="text-[10px] text-[var(--outline)]">
                              +${formatUpcharge(comp.price)}
                            </span>
                          )}
                          {isSelected && (
                            <Check size={14} className="text-[var(--primary)]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Modifier groups for selected components */}
                {selectedList.filter((comp) => comp.modifierGroups.length > 0).map((comp) => (
                  <div key={comp.id} className="mt-2 mb-1 pl-1">
                    {comp.modifierGroups.map((mg) => (
                      <div key={mg.id} ref={(el) => { sectionRefs.current[`${group.id}:${comp.id}:${mg.id}`] = el; }} className="mb-2">
                        <p className="text-xs font-semibold text-[var(--outline)] mb-1.5">
                          {shortGroupName(group.name)}: {comp.name} - {mg.name}
                          {mg.required && (
                            <span className="font-normal"> (Required)</span>
                          )}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {mg.options.map((opt) => {
                            const modSelected = isModSelected(
                              group.id, comp.id, mg.id, opt.id
                            );
                            return (
                              <button
                                key={opt.id}
                                onClick={() =>
                                  selectModifier(group.id, comp.id, mg.id, opt, mg.maxSelect)
                                }
                                className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors text-left ${
                                  modSelected
                                    ? "border-[var(--primary)] bg-[var(--primary-light)]"
                                    : "border-[var(--outline-variant)]"
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  {opt.name}
                                  {modSelected && (
                                    <Check size={10} className="text-[var(--primary)]" />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
                    {formatSelectionLine(group.name, comp, modNames)}
                  </p>
                );
              });
            })}
          </div>
          <button
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            className="w-full h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            {showNextAction ? "Next Order" : (activeOrder.cartItemId ? "Save changes" : "Add to cart")}
          </button>
        </div>
      </div>
    </>
  );
}
