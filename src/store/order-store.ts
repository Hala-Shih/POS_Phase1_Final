"use client";

import { create } from "zustand";
import { CartItem, CartItemModifier, CartComboSelection, CartItemDiscount, Staff, Table } from "@/lib/types";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function computeItemTotal(
  basePrice: number,
  quantity: number,
  modifiers: CartItemModifier[],
  comboSelections?: CartComboSelection[],
  priceAdjustment?: number,
  comped?: boolean,
  priceOverride?: number | null,
  discount?: CartItemDiscount | null
): number {
  if (comped) return 0;
  if (priceOverride != null) return priceOverride * quantity;
  const modifierTotal = modifiers.reduce(
    (sum, group) =>
      sum + group.modifiers.reduce((s, m) => s + m.price, 0),
    0
  );
  const comboTotal = (comboSelections || []).reduce((sum, sel) => {
    const compPrice = sel.component.price;
    const modPrice = sel.modifiers.reduce(
      (s, g) => s + g.modifiers.reduce((s2, m) => s2 + m.price, 0),
      0
    );
    return sum + compPrice + modPrice;
  }, 0);
  let total = (basePrice + modifierTotal + comboTotal + (priceAdjustment || 0)) * quantity;
  if (discount) {
    if (discount.type === "percent") {
      total = total * (1 - discount.value / 100);
    } else {
      total = Math.max(0, total - discount.value);
    }
  }
  return Math.round(total * 100) / 100; // avoid floating-point drift
}

// ── Cart line merge / split rule (System Rule 18) ────────────────────────
// A line is "stackable" only when it has no per-line customizations that
// would be lost or mis-applied if it were merged with another line.
function isStackableLine(item: CartItem): boolean {
  return (
    !item.sent &&
    !item.comped &&
    item.priceOverride == null &&
    !item.discount &&
    !item.note &&
    !item.priceAdjustment &&
    !item.breaklineAbove &&
    !item.breaklineBelow
  );
}

function modifiersSignature(mods: CartItemModifier[]): string {
  // Order-independent signature so { Rare, No salt } === { No salt, Rare }
  return mods
    .map((g) => ({
      g: g.groupId,
      m: g.modifiers.map((m) => m.id).sort().join(","),
    }))
    .sort((a, b) => a.g.localeCompare(b.g))
    .map((x) => `${x.g}:${x.m}`)
    .join("|");
}

function comboSelectionsSignature(sels: CartComboSelection[] | undefined): string {
  if (!sels || sels.length === 0) return "";
  return sels
    .map((s) => `${s.groupId}:${s.component.id}:${modifiersSignature(s.modifiers)}`)
    .sort()
    .join("||");
}

// Find an existing cart line that should be merged with `target`.
function findMergeTarget(items: CartItem[], target: CartItem): CartItem | undefined {
  if (!isStackableLine(target)) return undefined;
  const targetModSig = modifiersSignature(target.modifiers);
  const targetComboSig = comboSelectionsSignature(target.comboSelections);
  return items.find(
    (i) =>
      i.id !== target.id &&
      i.menuItemId === target.menuItemId &&
      isStackableLine(i) &&
      modifiersSignature(i.modifiers) === targetModSig &&
      comboSelectionsSignature(i.comboSelections) === targetComboSig
  );
}

// Merge `source` into `dest` (dest absorbs source's quantity; source is removed).
function mergeLines(items: CartItem[], destId: string, sourceId: string): CartItem[] {
  const dest = items.find((i) => i.id === destId);
  const source = items.find((i) => i.id === sourceId);
  if (!dest || !source) return items;
  const newQty = dest.quantity + source.quantity;
  return items
    .filter((i) => i.id !== sourceId)
    .map((i) =>
      i.id === destId
        ? {
            ...i,
            quantity: newQty,
            totalPrice: computeItemTotal(
              i.basePrice,
              newQty,
              i.modifiers,
              i.comboSelections,
              i.priceAdjustment,
              i.comped,
              i.priceOverride,
              i.discount,
            ),
          }
        : i
    );
}

// Re-evaluate the cart and merge `targetId` into any sibling line that
// matches the System Rule 18 merge criteria. Returns the surviving id.
function consolidateMatchingLine(items: CartItem[], targetId: string): { items: CartItem[]; survivorId: string } {
  const target = items.find((i) => i.id === targetId);
  if (!target) return { items, survivorId: targetId };
  const dest = findMergeTarget(items, target);
  if (!dest) return { items, survivorId: targetId };
  return { items: mergeLines(items, dest.id, target.id), survivorId: dest.id };
}

export type Screen = "login" | "home" | "tables" | "guest-count" | "check" | "order" | "payment" | "orders";
export type Language = "en" | "zh";

interface OrderState {
  // Navigation
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;

  // Language
  language: Language;
  toggleLanguage: () => void;

  // Auth
  currentStaff: Staff | null;
  setStaff: (staff: Staff | null) => void;

  // Table
  selectedTable: Table | null;
  setTable: (table: Table | null) => void;

  // Guest count
  guestCount: number;
  setGuestCount: (count: number) => void;

  // Cart
  cartItems: CartItem[];
  addItem: (item: {
    menuItemId: string;
    name: string;
    basePrice: number;
    modifiers: CartItemModifier[];
    comboSelections?: CartComboSelection[];
  }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  updateNote: (cartItemId: string, note: string) => void;
  updatePriceAdjustment: (cartItemId: string, amount: number) => void;
  setItemDiscount: (cartItemId: string, discount: CartItemDiscount | null) => void;
  setItemComped: (cartItemId: string, comped: boolean) => void;
  setItemPriceOverride: (cartItemId: string, price: number | null) => void;
  toggleBreakline: (cartItemId: string, position: "above" | "below") => void;
  updateItemModifiers: (cartItemId: string, modifiers: CartItemModifier[]) => void;
  splitOneAndUpdateModifiers: (cartItemId: string, modifiers: CartItemModifier[]) => string;
  updateComboSelections: (cartItemId: string, comboSelections: CartComboSelection[]) => void;
  consolidateCart: () => void;
  splitCartItemToSingleItems: (cartItemId: string) => string[];
  splitAndUpdateNotes: (cartItemId: string, notesPerTabIndex: Record<number, string>) => void;
  clearCart: () => void;
  markItemSent: (cartItemId: string) => void;
  markAllSent: () => void;

  // Computed
  cartTotal: () => number;
  cartCount: () => number;

  // Check-level tip applied before sending the order to payment.
  // Stored as a flat dollar amount; the Action Drawer converts a chosen
  // percent into dollars at the time of selection so the value is stable
  // even if subtotal changes afterwards.
  checkTip: number;
  setCheckTip: (value: number) => void;

  // Check-level discount applied to the entire check (after item subtotal,
  // before tax). Set via the check-level Actions drawer.
  checkDiscount: CartItemDiscount | null;
  setCheckDiscount: (discount: CartItemDiscount | null) => void;

  // Menu navigation state
  activeMenuBook: string;
  setActiveMenuBook: (name: string) => void;
  activeBookId: string | null;
  activeCategoryId: string | null;
  setActiveBook: (id: string) => void;
  setActiveCategory: (id: string) => void;

  // Auto-open menu on check screen arrival
  openMenuOnArrival: boolean;
  setOpenMenuOnArrival: (val: boolean) => void;

  // Combo configuration sheet open flag (taller than the standard
  // 60% drawer; CheckSummaryScreen uses this to reserve more space
  // so the totals stay visible above it).
  comboSheetOpen: boolean;
  setComboSheetOpen: (val: boolean) => void;

  // Transfer-to-table sheet open flag — used to hide the global FooterNav
  // while the floor-map transfer overlay is shown.
  transferSheetOpen: boolean;
  setTransferSheetOpen: (val: boolean) => void;

  // Reset all
  resetOrder: () => void;
  loadTableOrder: (table: Table) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentScreen: "login",
  setScreen: (screen) => set({ currentScreen: screen }),

  openMenuOnArrival: false,
  setOpenMenuOnArrival: (val) => set({ openMenuOnArrival: val }),

  comboSheetOpen: false,
  setComboSheetOpen: (val) => set({ comboSheetOpen: val }),

  transferSheetOpen: false,
  setTransferSheetOpen: (val) => set({ transferSheetOpen: val }),

  language: "en",
  toggleLanguage: () =>
    set((s) => ({ language: s.language === "en" ? "zh" : "en" })),

  currentStaff: null,
  setStaff: (staff) => set({ currentStaff: staff }),

  selectedTable: null,
  setTable: (table) => set({ selectedTable: table }),

  guestCount: 0,
  setGuestCount: (count) => set({ guestCount: count }),

  cartItems: [],

  addItem: ({ menuItemId, name, basePrice, modifiers, comboSelections }) => {
    const { cartItems } = get();
    const candidate: CartItem = {
      id: generateId(),
      menuItemId,
      name,
      basePrice,
      quantity: 1,
      modifiers,
      comboSelections,
      sent: false,
      totalPrice: computeItemTotal(basePrice, 1, modifiers, comboSelections),
    };
    // System Rule 18: merge into an existing matching stackable line, otherwise insert.
    const existing = findMergeTarget(cartItems, candidate);
    if (existing) {
      const newQty = existing.quantity + 1;
      set({
        cartItems: cartItems.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                quantity: newQty,
                totalPrice: computeItemTotal(
                  item.basePrice,
                  newQty,
                  item.modifiers,
                  item.comboSelections,
                  item.priceAdjustment,
                  item.comped,
                  item.priceOverride,
                  item.discount,
                ),
              }
            : item
        ),
      });
    } else {
      set({ cartItems: [candidate, ...cartItems] });
    }
  },

  removeItem: (cartItemId) =>
    set({ cartItems: get().cartItems.filter((i) => i.id !== cartItemId) }),

  updateQuantity: (cartItemId, delta) => {
    const { cartItems } = get();
    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      set({ cartItems: cartItems.filter((i) => i.id !== cartItemId) });
    } else {
      set({
        cartItems: cartItems.map((i) =>
          i.id === cartItemId
            ? {
                ...i,
                quantity: newQty,
                totalPrice: computeItemTotal(i.basePrice, newQty, i.modifiers, i.comboSelections, i.priceAdjustment, i.comped, i.priceOverride, i.discount),
              }
            : i
        ),
      });
    }
  },

  updateNote: (cartItemId, note) =>
    set({
      cartItems: get().cartItems.map((i) =>
        i.id === cartItemId ? { ...i, note } : i
      ),
    }),

  updatePriceAdjustment: (cartItemId, amount) => {
    const item = get().cartItems.find((i) => i.id === cartItemId);
    if (!item) return;
    set({
      cartItems: get().cartItems.map((i) =>
        i.id === cartItemId
          ? {
              ...i,
              priceAdjustment: amount,
              totalPrice: computeItemTotal(i.basePrice, i.quantity, i.modifiers, i.comboSelections, amount, i.comped, i.priceOverride, i.discount),
            }
          : i
      ),
    });
  },

  setItemDiscount: (cartItemId, discount) => {
    const item = get().cartItems.find((i) => i.id === cartItemId);
    if (!item) return;
    set({
      cartItems: get().cartItems.map((i) =>
        i.id === cartItemId
          ? {
              ...i,
              discount,
              totalPrice: computeItemTotal(i.basePrice, i.quantity, i.modifiers, i.comboSelections, i.priceAdjustment, i.comped, i.priceOverride, discount),
            }
          : i
      ),
    });
  },

  setItemComped: (cartItemId, comped) => {
    const { cartItems } = get();
    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return;

    // If comping an item with qty > 1, split off a single-unit comped line
    if (comped && item.quantity > 1) {
      const remainder: CartItem = {
        ...item,
        quantity: item.quantity - 1,
        totalPrice: computeItemTotal(item.basePrice, item.quantity - 1, item.modifiers, item.comboSelections, item.priceAdjustment, undefined, undefined, item.discount),
      };
      const compedLine: CartItem = {
        ...item,
        id: generateId(),
        quantity: 1,
        comped: true,
        priceOverride: null,
        totalPrice: 0,
      };
      const idx = cartItems.indexOf(item);
      const updated = [...cartItems];
      updated.splice(idx, 1, remainder, compedLine);
      set({ cartItems: updated });
      return;
    }

    set({
      cartItems: cartItems.map((i) =>
        i.id === cartItemId
          ? {
              ...i,
              comped,
              priceOverride: comped ? null : i.priceOverride,
              totalPrice: computeItemTotal(i.basePrice, i.quantity, i.modifiers, i.comboSelections, i.priceAdjustment, comped, comped ? null : i.priceOverride, i.discount),
            }
          : i
      ),
    });
  },

  setItemPriceOverride: (cartItemId, price) => {
    set({
      cartItems: get().cartItems.map((i) =>
        i.id === cartItemId
          ? {
              ...i,
              priceOverride: price,
              comped: price != null ? false : i.comped,
              totalPrice: computeItemTotal(i.basePrice, i.quantity, i.modifiers, i.comboSelections, i.priceAdjustment, price != null ? false : i.comped, price, i.discount),
            }
          : i
      ),
    });
  },

  toggleBreakline: (cartItemId, position) => {
    const key: "breaklineAbove" | "breaklineBelow" =
      position === "above" ? "breaklineAbove" : "breaklineBelow";
    set({
      cartItems: get().cartItems.map((i) =>
        i.id === cartItemId ? { ...i, [key]: !i[key] } : i
      ),
    });
  },

  updateItemModifiers: (cartItemId, modifiers) => {
    const item = get().cartItems.find((i) => i.id === cartItemId);
    if (!item) return;
    const updated = get().cartItems.map((i) =>
      i.id === cartItemId
        ? { ...i, modifiers, totalPrice: computeItemTotal(i.basePrice, i.quantity, modifiers, i.comboSelections, i.priceAdjustment, i.comped, i.priceOverride, i.discount) }
        : i
    );
    // System Rule 18: re-evaluate merge after a modifier change.
    const { items } = consolidateMatchingLine(updated, cartItemId);
    set({ cartItems: items });
  },

  splitOneAndUpdateModifiers: (cartItemId, modifiers) => {
    const { cartItems } = get();
    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return cartItemId;
    // If qty is 1, just update in place; then re-evaluate merge.
    if (item.quantity <= 1) {
      const updatedSingle = cartItems.map((i) =>
        i.id === cartItemId
          ? { ...i, modifiers, totalPrice: computeItemTotal(i.basePrice, i.quantity, modifiers, i.comboSelections, i.priceAdjustment, i.comped, i.priceOverride, i.discount) }
          : i
      );
      const { items: merged, survivorId } = consolidateMatchingLine(updatedSingle, cartItemId);
      set({ cartItems: merged });
      return survivorId;
    }
    // Otherwise split one unit off as a new line with the new modifiers,
    // and reduce the original line by one.
    const remainder: CartItem = {
      ...item,
      quantity: item.quantity - 1,
      totalPrice: computeItemTotal(item.basePrice, item.quantity - 1, item.modifiers, item.comboSelections, item.priceAdjustment, item.comped, item.priceOverride, item.discount),
    };
    const newLine: CartItem = {
      ...item,
      id: generateId(),
      quantity: 1,
      modifiers,
      totalPrice: computeItemTotal(item.basePrice, 1, modifiers, item.comboSelections, item.priceAdjustment, item.comped, item.priceOverride, item.discount),
    };
    const idx = cartItems.indexOf(item);
    const updated = [...cartItems];
    updated.splice(idx, 1, remainder, newLine);
    // System Rule 18: try to merge the new split line into a matching sibling.
    const { items, survivorId } = consolidateMatchingLine(updated, newLine.id);
    set({ cartItems: items });
    return survivorId;
  },

  updateComboSelections: (cartItemId, comboSelections) => {
    const item = get().cartItems.find((i) => i.id === cartItemId);
    if (!item) return;
    const updated = get().cartItems.map((i) =>
      i.id === cartItemId
        ? { ...i, comboSelections, totalPrice: computeItemTotal(i.basePrice, i.quantity, i.modifiers, comboSelections, i.priceAdjustment, i.comped, i.priceOverride, i.discount) }
        : i
    );
    // System Rule 18: re-evaluate merge after a combo selection change.
    const { items } = consolidateMatchingLine(updated, cartItemId);
    set({ cartItems: items });
  },

  // System Rule 18: walk the entire cart and merge any pair of stackable
  // lines that share menu item, modifiers, and combo selections. Used after
  // bulk operations like the combo modify session that may leave several
  // newly-split lines that should re-collapse.
  consolidateCart: () => {
    let items = get().cartItems;
    let didMerge = true;
    while (didMerge) {
      didMerge = false;
      for (const item of items) {
        const target = findMergeTarget(items, item);
        if (target) {
          items = mergeLines(items, target.id, item.id);
          didMerge = true;
          break;
        }
      }
    }
    set({ cartItems: items });
  },

  splitCartItemToSingleItems: (cartItemId) => {
    const { cartItems } = get();
    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return [];
    if (item.quantity <= 1) return [item.id];

    const index = cartItems.findIndex((i) => i.id === cartItemId);
    if (index < 0) return [];

    const singleItems: CartItem[] = Array.from({ length: item.quantity }, (_, idx) => ({
      ...item,
      id: idx === 0 ? item.id : generateId(),
      quantity: 1,
      totalPrice: computeItemTotal(
        item.basePrice,
        1,
        item.modifiers,
        item.comboSelections,
        item.priceAdjustment,
        item.comped,
        item.priceOverride,
        item.discount,
      ),
    }));

    const updated = [...cartItems];
    updated.splice(index, 1, ...singleItems);
    set({ cartItems: updated });

    return singleItems.map((i) => i.id);
  },

  splitAndUpdateNotes: (cartItemId, notesPerTabIndex) => {
    const { cartItems } = get();
    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return;

    if (item.quantity <= 1) {
      const firstNote = Object.values(notesPerTabIndex)[0] ?? "";
      set({
        cartItems: cartItems.map((i) =>
          i.id === cartItemId ? { ...i, note: firstNote } : i
        ),
      });
      return;
    }

    const originalNote = item.note || "";
    const differentNotes: number[] = [];
    const notesMap: Record<number, string> = {};

    Object.entries(notesPerTabIndex).forEach(([idxStr, note]) => {
      const idx = parseInt(idxStr, 10);
      const trimmedNote = (note ?? "").trim();
      notesMap[idx] = trimmedNote;
      if (trimmedNote !== originalNote) {
        differentNotes.push(idx);
      }
    });

    if (differentNotes.length === 0) return; // No changes

    const index = cartItems.findIndex((i) => i.id === cartItemId);
    if (index < 0) return;

    const newItems: CartItem[] = [];

    if (differentNotes.length === item.quantity) {
      // All items need different notes - split them all
      Array.from({ length: item.quantity }, (_, idx) => {
        newItems.push({
          ...item,
          id: idx === 0 ? item.id : generateId(),
          quantity: 1,
          note: notesMap[idx] ?? "",
          totalPrice: computeItemTotal(
            item.basePrice,
            1,
            item.modifiers,
            item.comboSelections,
            item.priceAdjustment,
            item.comped,
            item.priceOverride,
            item.discount,
          ),
        });
      });
    } else {
      // Only some items need different notes
      const keptIndices = new Set<number>();
      for (let i = 0; i < item.quantity; i++) {
        if (!differentNotes.includes(i)) {
          keptIndices.add(i);
        }
      }

      if (keptIndices.size > 0) {
        newItems.push({
          ...item,
          quantity: keptIndices.size,
          totalPrice: computeItemTotal(
            item.basePrice,
            keptIndices.size,
            item.modifiers,
            item.comboSelections,
            item.priceAdjustment,
            item.comped,
            item.priceOverride,
            item.discount,
          ),
        });
      }

      differentNotes.forEach((idx) => {
        newItems.push({
          ...item,
          id: generateId(),
          quantity: 1,
          note: notesMap[idx] ?? "",
          totalPrice: computeItemTotal(
            item.basePrice,
            1,
            item.modifiers,
            item.comboSelections,
            item.priceAdjustment,
            item.comped,
            item.priceOverride,
            item.discount,
          ),
        });
      });
    }

    const updated = [...cartItems];
    updated.splice(index, 1, ...newItems);
    set({ cartItems: updated });
  },

  clearCart: () => set({ cartItems: [] }),

  markItemSent: (cartItemId) =>
    set({
      cartItems: get().cartItems.map((i) => i.id === cartItemId ? { ...i, sent: true } : i),
    }),

  markAllSent: () =>
    set({
      cartItems: get().cartItems.map((i) => ({ ...i, sent: true })),
    }),

  cartTotal: () =>
    get().cartItems.reduce((sum, item) => sum + item.totalPrice, 0),

  cartCount: () =>
    get().cartItems.reduce((sum, item) => sum + item.quantity, 0),

  checkTip: 0,
  setCheckTip: (value) => set({ checkTip: Math.max(0, Math.round(value * 100) / 100) }),

  checkDiscount: null,
  setCheckDiscount: (discount) => set({ checkDiscount: discount }),

  activeMenuBook: "Lunch",
  setActiveMenuBook: (name) => set({ activeMenuBook: name }),
  activeBookId: null,
  activeCategoryId: null,
  setActiveBook: (id) => set({ activeBookId: id }),
  setActiveCategory: (id) => set({ activeCategoryId: id }),

  resetOrder: () =>
    set({
      currentScreen: "tables",
      selectedTable: null,
      guestCount: 0,
      cartItems: [],
      checkTip: 0,
      checkDiscount: null,
      activeMenuBook: "Lunch",
      activeBookId: null,
      activeCategoryId: null,
    }),

  loadTableOrder: (table) => {
    const isSent = table.orderStatus === "sent";
    // Order #0001 (T1) — steak content per design spec.
    if (table.id === "t1") {
      const steakItems: CartItem[] = [
        {
          id: generateId(),
          menuItemId: "item-filet-mignon",
          name: "Filet Mignon",
          basePrice: 56,
          quantity: 1,
          modifiers: [
            {
              groupId: "mg-filet-temp",
              groupName: "Temperature",
              modifiers: [{ id: "mod-filet-mr", name: "Medium Rare", price: 0 }],
            },
            {
              groupId: "mg-filet-sauce",
              groupName: "Sauce",
              modifiers: [{ id: "mod-filet-peppercorn", name: "Peppercorn", price: 0 }],
            },
          ],
          sent: isSent,
          totalPrice: 56,
        },
        {
          id: generateId(),
          menuItemId: "item-calamari",
          name: "Calamari",
          basePrice: 14,
          quantity: 1,
          modifiers: [],
          sent: isSent,
          totalPrice: 14,
        },
        {
          id: generateId(),
          menuItemId: "item-truffle-fries",
          name: "Truffle Fries",
          basePrice: 13,
          quantity: 1,
          modifiers: [],
          sent: isSent,
          totalPrice: 13,
        },
        {
          id: generateId(),
          menuItemId: "item-fully-loaded-burger",
          name: "The Fully Loaded Super Deluxe Double Bacon Cheeseburger",
          basePrice: 32,
          quantity: 1,
          modifiers: [
            {
              groupId: "mg-fully-loaded-temp",
              groupName: "Temperature",
              modifiers: [{ id: "mod-fl-med", name: "Medium", price: 0 }],
            },
          ],
          sent: isSent,
          totalPrice: 32,
        },
      ];
      set({
        selectedTable: table,
        guestCount: table.guestCount || 1,
        cartItems: steakItems,
      });
      return;
    }
    // Mock cart items for other occupied tables
    const mockItems: CartItem[] = [
      {
        id: generateId(),
        menuItemId: "item-calamari",
        name: "Calamari",
        basePrice: 14,
        quantity: 1,
        modifiers: [],
        sent: isSent,
        totalPrice: 14,
      },
      {
        id: generateId(),
        menuItemId: "item-truffle-fries",
        name: "Truffle Fries",
        basePrice: 13,
        quantity: 2,
        modifiers: [],
        sent: isSent,
        totalPrice: 26,
      },
      {
        id: generateId(),
        menuItemId: "item-grilled-salmon",
        name: "Grilled Salmon",
        basePrice: 29,
        quantity: 1,
        modifiers: [],
        sent: isSent,
        totalPrice: 29,
      },
    ];
    set({
      selectedTable: table,
      guestCount: table.guestCount || 1,
      cartItems: mockItems,
    });
  },
}));
