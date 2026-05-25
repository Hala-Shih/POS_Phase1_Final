"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/ui/Header";
import TabBar from "@/components/ui/TabBar";
import { useOrderStore } from "@/store/order-store";
import menuData from "@/data/menu.json";
import staffData from "@/data/staff.json";
import tablesData from "@/data/tables.json";
import { MenuBook, MenuItem, Staff, Table, Language } from "@/lib/types";
import CartBar from "@/components/cart/CartBar";
import CartDrawer from "@/components/cart/CartDrawer";
import ItemConfigSheet from "@/components/menu/ItemConfigSheet";
import ComboConfigSheet from "@/components/menu/ComboConfigSheet";
import { Search, X, Trash2, Plus, Minus } from "lucide-react";

const categories = menuData as MenuBook[];

export default function OrderScreen() {
  const {
    currentStaff,
    selectedTable,
    guestCount,
    activeBookId,
    activeCategoryId,
    setActiveBook,
    setActiveCategory,
    addItem,
    removeItem,
    updateQuantity,
    updateItemModifiers,
    updateComboSelections,
    cartItems,
    setScreen,
    resetOrder,
    setStaff,
    setTable,
    language,
  } = useOrderStore();

  const n = (item: { name: string; nameCn?: string }) =>
    language === "zh" && item.nameCn ? item.nameCn : item.name;
  const L = language === "zh"
    ? { menu: "菜單", searchItem: "搜尋菜品", popularItems: "熱門菜品", noItems: "找不到菜品", soldOut: "售罄", customizable: "可客製化", combo: "套餐", close: "關閉" }
    : { menu: "Menu", searchItem: "Search item", popularItems: "Popular Items", noItems: "No items found", soldOut: "Sold out", customizable: "Customizable", combo: "Combo", close: "Close" };

  const [cartOpen, setCartOpen] = useState(false);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [comboItem, setComboItem] = useState<MenuItem | null>(null);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrollingToRef = useRef(false);

  // Initialize first category/subcategory
  useEffect(() => {
    if (!activeBookId && categories.length > 0) {
      setActiveBook(categories[0].id);
      if (categories[0].categories.length > 0) {
        setActiveCategory(categories[0].categories[0].id);
      }
    }
  }, [activeBookId, setActiveBook, setActiveCategory]);

  const activeCategory = categories.find((b) => b.id === activeBookId) || categories[0];

  // Scroll listener to track which section is in view
  useEffect(() => {
    if (!activeCategory || !scrollRef.current) return;

    const container = scrollRef.current;

    const handleScroll = () => {
      if (isScrollingToRef.current) return;

      const scrollTop = container.scrollTop;
      let currentSubcat = activeCategory.categories[0]?.id;

      // Find the last section whose top is at or above the scroll position
      for (const cat of activeCategory.categories) {
        const el = sectionRefs.current[cat.id];
        if (el) {
          // offsetTop is relative to the scroll container
          if (el.offsetTop <= scrollTop + 10) {
            currentSubcat = cat.id;
          }
        }
      }

      if (currentSubcat) {
        setActiveCategory(currentSubcat);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [activeCategory, setActiveCategory]);

  const handleCategoryChange = (catId: string) => {
    setActiveBook(catId);
    const cat = categories.find((b) => b.id === catId);
    if (cat && cat.categories.length > 0) {
      setActiveCategory(cat.categories[0].id);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  };

  const handleCategoryTap = useCallback(
    (categoryId: string) => {
      setActiveCategory(categoryId);
      const el = sectionRefs.current[categoryId];
      if (el && scrollRef.current) {
        isScrollingToRef.current = true;
        scrollRef.current.scrollTo({
          top: el.offsetTop,
          behavior: "smooth",
        });
        // Reset flag after scroll animation completes
        setTimeout(() => {
          isScrollingToRef.current = false;
        }, 600);
      }
    },
    [setActiveCategory]
  );

  const handleItemTap = (item: MenuItem) => {
    if (item.soldOut) return;
    // Don't open new sheets while one is already open
    if (comboItem || configItem) return;

    // Combo items with comboGroups get their own sheet
    if (item.isCombo && item.comboGroups && item.comboGroups.length > 0) {
      setCartOpen(false);
      setComboItem(item);
      return;
    }

    const hasRequiredModifiers = item.modifierGroups.some((g) => g.required);
    if (hasRequiredModifiers || item.isCombo) {
      setCartOpen(false);
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

  // Helper: get cart info for a menu item (no modifiers only — for inline +/-)
  const getCartItem = (menuItemId: string) =>
    cartItems.find((ci) => ci.menuItemId === menuItemId && ci.modifiers.length === 0);

  // Helper: count total quantity for a modifier/combo item in cart
  const getItemCartCount = (menuItemId: string) =>
    cartItems.filter((ci) => ci.menuItemId === menuItemId).reduce((sum, ci) => sum + ci.quantity, 0);

  const menuBookLabel = L.menu;

  // Flatten all items for search
  const allItems = categories.flatMap((b) =>
    b.categories.flatMap((c) => c.items)
  );
  const popularItems = allItems.filter((i) => !i.soldOut).slice(0, 5);
  const searchResults = searchQuery.trim()
    ? allItems.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.nameCn && i.nameCn.includes(searchQuery))
      )
    : [];

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleTransfer = (staff: Staff) => {
    setStaff(staff);
  };

  const handleTransferTable = (table: Table) => {
    setTable(table);
  };

  const handleVoidOrder = () => {
    resetOrder();
    setScreen("tables");
  };

  return (
    <div className="h-full flex flex-col relative">
      <Header
        onBack={() => setScreen("tables")}
        serverName={currentStaff?.name}
        tableName={selectedTable?.name}
        guestCount={guestCount}
        onGuestCountTap={() => setScreen("guest-count")}
        onTableTap={() => setScreen("tables")}
        onTransfer={handleTransfer}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
        onTransferTable={handleTransferTable}
        onVoidOrder={handleVoidOrder}
        tableList={tablesData as Table[]}
        currentTableId={selectedTable?.id}
      />

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-base font-semibold">{menuBookLabel}</span>
        <button
          onClick={openSearch}
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100"
        >
          <Search size={18} className="text-[var(--outline)]" />
        </button>
      </div>

      {activeCategory && (
        <TabBar
          tabs={activeCategory.categories.map((c) => ({ id: c.id, label: n(c) }))}
          activeId={activeCategoryId || activeCategory.categories[0]?.id}
          onSelect={handleCategoryTap}
          variant="underline"
        />
      )}

      {/* Scrollable area with ALL categories as sections */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scrollbar relative">
        {activeCategory?.categories.map((category) => (
          <div
            key={category.id}
            ref={(el) => { sectionRefs.current[category.id] = el; }}
            data-category-id={category.id}
          >
            {/* Section header */}
            <div className="sticky top-0 z-10 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-[var(--outline)] uppercase tracking-wider">
                {n(category)}
              </span>
            </div>

            {/* Items */}
            {category.items.map((item) => {
              const cartItem = getCartItem(item.id);
              const hasRequiredMods = item.modifierGroups.some((g) => g.required);
              const isCombo = item.isCombo && item.comboGroups && item.comboGroups.length > 0;
              const needsConfig = hasRequiredMods || isCombo;
              const inCart = cartItem && !needsConfig;
              const modItemCount = needsConfig ? getItemCartCount(item.id) : 0;

              return (
                <div
                  key={item.id}
                  className={`w-full px-4 py-3 border-b border-gray-100 transition-colors ${
                    item.soldOut ? "opacity-40" : ""
                  } ${addedItemId === item.id ? "bg-[var(--primary-light)]" : ""}`}
                >
                  <button
                    onClick={() => handleItemTap(item)}
                    disabled={item.soldOut}
                    className="w-full text-left active:bg-[var(--surface)] transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {n(item)}
                        </p>
                      </div>
                      <span className="text-sm font-medium shrink-0">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    {/* Description + inline qty on same row */}
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex-1 min-w-0">
                        {item.description && (
                          <p className="text-xs text-[var(--outline)] line-clamp-2 max-w-[200px]">
                            {item.description}
                          </p>
                        )}
                        {item.soldOut && (
                          <span className="text-xs text-[var(--error)] font-medium">
                            {L.soldOut}
                          </span>
                        )}
                        {needsConfig && !item.soldOut && (
                          <span className="text-[10px] text-[var(--outline)] block">
                            {isCombo ? L.combo : L.customizable}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Inline quantity control for items in cart (no modifiers) — same row as description */}
                  {inCart && (
                    <div className="flex items-center justify-between -mt-8">
                      <div />
                      <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
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
                      </button>
                      <span className="text-sm font-semibold min-w-[20px] text-center">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(cartItem.id, 1)}
                        className="w-7 h-7 rounded-full border border-[var(--outline-variant)] flex items-center justify-center active:bg-gray-100"
                      >
                        <Plus size={12} className="text-[var(--primary)]" />
                      </button>
                      </div>
                    </div>
                  )}

                  {/* Modifier/combo item count — right-aligned below price */}
                  {needsConfig && modItemCount > 0 && (
                    <div className="flex items-center justify-end -mt-5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold">
                        {modItemCount}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!cartOpen && (
        <div className="relative z-[60]">
          <CartBar onOpen={() => { setConfigItem(null); setComboItem(null); setCartOpen(true); }} />
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

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
          }}
          onUpdateExisting={(cartItemId, modifiers) => {
            updateItemModifiers(cartItemId, modifiers);
          }}
          onDeleteItem={(cartItemId) => {
            removeItem(cartItemId);
          }}
        />
      )}

      {/* Item search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-white z-30 flex flex-col"
          >
            <Header
              onBack={() => setScreen("tables")}
              serverName={currentStaff?.name}
              tableName={selectedTable?.name}
              guestCount={guestCount}
              onGuestCountTap={() => setScreen("guest-count")}
              onTableTap={() => setScreen("tables")}
              onTransfer={handleTransfer}
              staffList={staffData as Staff[]}
              currentStaffId={currentStaff?.id}
              onTransferTable={handleTransferTable}
              onVoidOrder={handleVoidOrder}
              tableList={tablesData as Table[]}
              currentTableId={selectedTable?.id}
            />

            {/* Search input */}
            <div className="px-3 pt-2 pb-2 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[var(--surface)] rounded-2xl px-4 py-3">
                <Search size={20} className="text-[var(--outline)] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={L.searchItem}
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
              <button
                onClick={() => setSearchOpen(false)}
                className="shrink-0 text-sm font-medium text-[var(--primary)] active:opacity-70 px-1"
              >
                {L.close}
              </button>
            </div>

            {/* Results / Popular items */}
            <div className="flex-1 overflow-y-auto thin-scrollbar px-3">
              {searchQuery.trim() ? (
                // Search results
                searchResults.length > 0 ? (
                  searchResults.map((item) => {
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
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{n(item)}</p>
                          </div>
                          <span className="text-sm font-medium shrink-0">${item.price.toFixed(2)}</span>
                        </div>

                        {inCart && (
                          <div className="flex items-center justify-end mt-1">
                            <div className="flex items-center gap-2">
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
                          </div>
                        )}

                        {needsConfig && modItemCount > 0 && (
                          <div className="flex items-center justify-end mt-1">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold">
                              {modItemCount}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--outline)] text-center mt-8">{L.noItems}</p>
                )
              ) : (
                // Popular items
                <>
                  <h3 className="text-sm font-semibold mb-2">{L.popularItems}</h3>
                  {popularItems.map((item) => {
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
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{n(item)}</p>
                          </div>
                          <span className="text-sm font-medium shrink-0">${item.price.toFixed(2)}</span>
                        </div>

                        {inCart && (
                          <div className="flex items-center justify-end mt-1">
                            <div className="flex items-center gap-2">
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
                          </div>
                        )}

                        {needsConfig && modItemCount > 0 && (
                          <div className="flex items-center justify-end mt-1">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold">
                              {modItemCount}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Cart bar stays visible */}
            <CartBar onOpen={() => { setSearchOpen(false); setConfigItem(null); setComboItem(null); setCartOpen(true); }} />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
