"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Trash2, Plus, Minus } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import { MenuBook, MenuItem } from "@/lib/types";
import ItemConfigSheet from "@/components/menu/ItemConfigSheet";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";

const categories = menuData as MenuBook[];

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDrawer({ open, onClose }: SearchDrawerProps) {
  const { addItem, removeItem, updateQuantity, updateItemModifiers, updateComboSelections, cartItems } = useOrderStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [comboItem, setComboItem] = useState<MenuItem | null>(null);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Flatten all items for search
  const allItems = categories.flatMap((b) =>
    b.categories.flatMap((c) => c.items)
  );
  const searchResults = searchQuery.trim()
    ? allItems.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleItemTap = (item: MenuItem) => {
    if (item.soldOut) return;
    if (comboItem || configItem) return;

    if (item.isCombo && item.comboGroups && item.comboGroups.length > 0) {
      setComboItem(item);
      return;
    }

    const hasRequiredModifiers = item.modifierGroups.some((g) => g.required);
    if (hasRequiredModifiers || item.isCombo) {
      setConfigItem(item);
    } else {
      addItem({
        menuItemId: item.id,
        name: item.name,
        basePrice: item.price,
        modifiers: [],
      });
      setAddedItemId(item.id);
      setTimeout(() => setAddedItemId(null), 400);
    }
  };

  const getCartItem = (menuItemId: string) =>
    cartItems.find((ci) => ci.menuItemId === menuItemId && ci.modifiers.length === 0);

  const getItemCartCount = (menuItemId: string) =>
    cartItems.filter((ci) => ci.menuItemId === menuItemId).reduce((sum, ci) => sum + ci.quantity, 0);

  const renderItem = (item: MenuItem) => {
    const cartItem = getCartItem(item.id);
    const hasRequiredMods = item.modifierGroups.some((g) => g.required);
    const isCombo = item.isCombo && item.comboGroups && item.comboGroups.length > 0;
    const needsConfig = hasRequiredMods || isCombo;
    const inCart = cartItem && !needsConfig;
    const modItemCount = needsConfig ? getItemCartCount(item.id) : 0;

    return (
      <button
        key={item.id}
        onClick={() => handleItemTap(item)}
        disabled={item.soldOut}
        className={`w-full px-4 py-3 border-b border-gray-100 transition-colors text-left active:bg-[var(--surface)] ${
          item.soldOut ? "opacity-40" : ""
        } ${addedItemId === item.id ? "bg-[var(--primary-light)]" : ""}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-normal leading-snug">{item.name}</p>
          </div>

          {inCart && (
            <div className="flex items-center gap-2 shrink-0">
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (cartItem.quantity <= 1) {
                    removeItem(cartItem.id);
                  } else {
                    updateQuantity(cartItem.id, -1);
                  }
                }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
              >
                {cartItem.quantity <= 1 ? (
                  <Trash2 size={12} className="text-[var(--error)]" />
                ) : (
                  <Minus size={12} />
                )}
              </span>
              <span className="text-sm font-semibold min-w-[20px] text-center">
                {cartItem.quantity}
              </span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); updateQuantity(cartItem.id, 1); }}
                className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
              >
                <Plus size={12} className="text-[var(--primary)]" />
              </span>
            </div>
          )}
        </div>

        {needsConfig && modItemCount > 0 && (
          <div className="flex items-center justify-end mt-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold">
              {modItemCount}
            </span>
          </div>
        )}
      </button>
    );
  };

  if (!open) return null;

  return (
    <>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col overflow-hidden"
        style={{ height: "calc(60% + 20px)", boxShadow: "0 -8px 32px -4px rgba(0,0,0,0.18)" }}
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0" onClick={onClose}>
          <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-semibold text-[#1D1B20] leading-tight truncate">Search</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search input (Rule 11) */}
        <div className="px-3 pt-2 pb-2 shrink-0">
          <div className="flex items-center gap-2 bg-[var(--surface)] rounded-2xl px-4 py-2.5">
            <Search size={20} className="text-[var(--outline)] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-[var(--outline-variant)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="w-6 h-6 flex items-center justify-center"
              >
                <X size={18} className="text-[var(--outline)]" />
              </button>
            )}
          </div>
        </div>

        {/* Results / Popular items */}
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          {searchQuery.trim() ? (
            searchResults.length > 0 ? (
              searchResults.map(renderItem)
            ) : (
              <p className="text-sm text-[var(--outline)] text-center mt-8">No items found</p>
            )
          ) : (
            <p className="text-sm text-[var(--outline)] text-center mt-8">No search result</p>
          )}
        </div>
      </div>

      {/* Item config sheet */}
      {configItem && (
        <ItemConfigSheet
          item={configItem}
          existingCartItems={cartItems.filter((ci) => ci.menuItemId === configItem.id)}
          onClose={() => setConfigItem(null)}
          onAdd={(modifiers) => {
            addItem({
              menuItemId: configItem.id,
              name: configItem.name,
              basePrice: configItem.price,
              modifiers,
            });
            setConfigItem(null);
          }}
          onUpdateExisting={(cartItemId, modifiers) => {
            updateItemModifiers(cartItemId, modifiers);
          }}
        />
      )}

      {/* Combo config sheet */}
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
            setComboItem(null);
          }}
          onUpdateExisting={(cartItemId, comboSelections) => {
            updateComboSelections(cartItemId, comboSelections);
          }}
        />
      )}
    </>
  );
}
