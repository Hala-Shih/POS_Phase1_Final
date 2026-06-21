"use client";

import { useState, useEffect, useCallback } from "react";
import { Map, ClipboardList, FileText } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import LoginScreen from "@/components/screens/LoginScreen";
import TablesScreen from "@/components/screens/TablesScreen";
import GuestCountScreen from "@/components/screens/GuestCountScreen";
import CheckSummaryScreen from "@/components/screens/CheckSummaryScreen";
import OrderScreen from "@/components/screens/OrderScreen";
import PaymentScreen from "@/components/screens/PaymentScreen";
import OrdersScreen from "@/components/screens/OrdersScreen";
import ActionDrawer from "@/components/action/ActionDrawer";

const pivotScreens = ["tables", "orders"];

// Rule 1 (System-Wide Rules): only one drawer may be open at a time.
// All drawer state is centralized here as a single `activeDrawer` value so
// opening one drawer mechanically closes any other.
type ActiveDrawer = "none" | "menu" | "search" | "action";

const DRAWER_TO_TAB: Record<Exclude<ActiveDrawer, "none">, FooterTab> = {
  menu: "menu",
  search: "search",
  action: "action",
};

export default function App() {
  const currentScreen = useOrderStore((s) => s.currentScreen);
  const setScreen = useOrderStore((s) => s.setScreen);
  const language = useOrderStore((s) => s.language);
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const transferSheetOpen = useOrderStore((s) => s.transferSheetOpen);

  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [actionItem, setActionItem] = useState<{ id: string; name: string } | null>(null);

  // Fullscreen payment flow overlay — opened by "Pay" button, closed by back.
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);

  // Derived drawer flags (kept for prop compatibility with child screens).
  const menuOpen = activeDrawer === "menu";
  const searchOpen = activeDrawer === "search";
  const actionOpen = activeDrawer === "action";

  // Footer tab is derived from active drawer to satisfy Rule 3 (tab/drawer sync).
  const showPivot = pivotScreens.includes(currentScreen) && !showPaymentFlow;

  // Rule 1 enforcement: a single entry point for opening drawers.
  // Switching drawers is a handoff — the previous drawer is replaced atomically.
  const openDrawer = useCallback((next: ActiveDrawer) => {
    setActiveDrawer((prev) => {
      if (prev === next) return next;
      if (next !== "action") setActionItem(null);
      return next;
    });
  }, []);

  const closeDrawers = useCallback(() => {
    setActiveDrawer("none");
    setActionItem(null);
  }, []);

  // Rule 4: screen transitions must clean up incompatible drawer state.
  const openPaymentOnArrival = useOrderStore((s) => s.openPaymentOnArrival);
  const setOpenPaymentOnArrival = useOrderStore((s) => s.setOpenPaymentOnArrival);

  useEffect(() => {
    // App-shell drawers are only meaningful on `check`. Close on any other screen.
    if (currentScreen !== "check" && activeDrawer !== "none") {
      closeDrawers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // Auto-open payment flow when navigating to check from an open order.
  useEffect(() => {
    if (currentScreen === "check" && openPaymentOnArrival) {
      setOpenPaymentOnArrival(false);
      closeDrawers();
      setShowPaymentFlow(true);
    }
  }, [currentScreen, openPaymentOnArrival, setOpenPaymentOnArrival, closeDrawers]);

  // Open the fullscreen payment flow overlay.
  const openPaymentFlow = useCallback(() => {
    closeDrawers();
    setShowPaymentFlow(true);
  }, [closeDrawers]);

  // Close the payment flow overlay and return to the check/menu/actions flow.
  const closePaymentFlow = useCallback(() => {
    setShowPaymentFlow(false);
  }, []);

  const handleSetMenuOpen = (open: boolean) => {
    if (open) openDrawer("menu");
    else if (menuOpen) closeDrawers();
  };

  const handleSetSearchOpen = (open: boolean) => {
    if (open) openDrawer("search");
    else if (searchOpen) closeDrawers();
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "login":
        return <LoginScreen />;
      case "home":
        return <TablesScreen />;
      case "tables":
        return <TablesScreen />;
      case "guest-count":
        return <GuestCountScreen />;
      case "check":
        return (
          <CheckSummaryScreen
            menuOpen={menuOpen}
            setMenuOpen={handleSetMenuOpen}
            searchOpen={searchOpen}
            setSearchOpen={handleSetSearchOpen}
            itemActionOpen={actionOpen && !!actionItem}
            externalDrawerType={actionOpen ? "action" : "none"}
            onOpenItemActions={(item) => {
              setActionItem(item);
              openDrawer("action");
            }}
            onOpenPaymentDrawer={openPaymentFlow}
          />
        );
      case "order":
        return <OrderScreen />;
      case "orders":
        return <OrdersScreen />;
      default:
        return <LoginScreen />;
    }
  };

  if (!showPivot && !showPaymentFlow) return renderScreen();

  const pivotItems = [
    { id: "tables", label: language === "zh" ? "樓面圖" : "Floormap", icon: Map },
    { id: "orders", label: language === "zh" ? "訂單" : "Orders", icon: ClipboardList },
    { id: "check", label: language === "zh" ? "總結" : "Summary", icon: FileText },
  ] as const;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        {renderScreen()}
        <ActionDrawer
          open={actionOpen}
          onClose={closeDrawers}
          onPay={openPaymentFlow}
          onSplitCheck={openPaymentFlow}
          onMultiplePayment={openPaymentFlow}
          itemContext={actionItem ?? undefined}
        />
        {/* Fullscreen payment flow overlay */}
        {showPaymentFlow && (
          <div className="absolute inset-0 z-[100] bg-white">
            <PaymentScreen onClose={closePaymentFlow} />
          </div>
        )}
      </div>
      {showPivot && (
        <nav className="h-14 shrink-0 border-t border-[var(--outline-variant)] bg-white flex items-center justify-around px-2">
          {pivotItems.map((item) => {
            const active = currentScreen === item.id;
            const isSummary = item.id === "check";
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSummary) return;
                  setScreen(item.id);
                }}
                className={`h-9 px-4 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                  active
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "text-[var(--outline)] active:bg-gray-100"
                }`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
