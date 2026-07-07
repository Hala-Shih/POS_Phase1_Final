"use client";

import { useState, useEffect, useCallback } from "react";
import { Map, ClipboardList, FileText, Settings } from "lucide-react";
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
type ReturnDrawer = "none" | "menu" | "search";
type PaymentStartMode = "default" | "split";

export default function App() {
  const currentScreen = useOrderStore((s) => s.currentScreen);
  const setScreen = useOrderStore((s) => s.setScreen);
  const language = useOrderStore((s) => s.language);
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const transferSheetOpen = useOrderStore((s) => s.transferSheetOpen);

  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [returnDrawer, setReturnDrawer] = useState<ReturnDrawer>("none");
  const [actionItem, setActionItem] = useState<{ id: string; name: string } | null>(null);

  // Fullscreen payment flow overlay — opened by "Pay" button, closed by back.
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [paymentStartMode, setPaymentStartMode] = useState<PaymentStartMode>("default");

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
    setReturnDrawer("none");
    setActionItem(null);
  }, []);

  const closeActionDrawer = useCallback(() => {
    if (currentScreen === "check" && activeDrawer === "action" && returnDrawer !== "none") {
      setActiveDrawer(returnDrawer);
      setReturnDrawer("none");
      setActionItem(null);
      return;
    }
    closeDrawers();
  }, [activeDrawer, closeDrawers, currentScreen, returnDrawer]);

  // Rule 4: screen transitions must clean up incompatible drawer state.
  const openPaymentOnArrival = useOrderStore((s) => s.openPaymentOnArrival);
  const setOpenPaymentOnArrival = useOrderStore((s) => s.setOpenPaymentOnArrival);

  useEffect(() => {
    // App-shell drawers are meaningful on both `check` and `order`.
    if (currentScreen !== "check" && currentScreen !== "order" && activeDrawer !== "none") {
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
  const openPaymentFlow = useCallback((mode: PaymentStartMode = "default") => {
    closeDrawers();
    setPaymentStartMode(mode);
    setShowPaymentFlow(true);
  }, [closeDrawers]);

  // Close the payment flow overlay and return to the check/menu/actions flow.
  const closePaymentFlow = useCallback(() => {
    setShowPaymentFlow(false);
    setPaymentStartMode("default");
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
              setReturnDrawer(activeDrawer === "menu" || activeDrawer === "search" ? activeDrawer : "none");
              openDrawer("action");
            }}
            onOpenPaymentDrawer={openPaymentFlow}
          />
        );
      case "order":
        return (
          <OrderScreen
            onOpenItemActions={(item) => {
              setActionItem(item);
              setReturnDrawer("none");
              openDrawer("action");
            }}
          />
        );
      case "orders":
        return <OrdersScreen />;
      default:
        return <LoginScreen />;
    }
  };

  const pivotItems = [
    { id: "tables", label: language === "zh" ? "樓面圖" : "Floormap", icon: Map },
    { id: "orders", label: language === "zh" ? "訂單" : "Orders", icon: ClipboardList },
    { id: "check", label: language === "zh" ? "總結" : "Summary", icon: FileText },
    { id: "settings", label: language === "zh" ? "設定" : "Settings", icon: Settings },
  ] as const;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        {renderScreen()}
        <ActionDrawer
          open={actionOpen}
          onClose={closeActionDrawer}
          onPay={openPaymentFlow}
          onSplitCheck={openPaymentFlow}
          onMultiplePayment={openPaymentFlow}
          itemContext={actionItem ?? undefined}
        />
        {/* Fullscreen payment flow overlay */}
        {showPaymentFlow && (
          <div className="absolute inset-0 z-[100] bg-white">
            <PaymentScreen onClose={closePaymentFlow} startMode={paymentStartMode} />
          </div>
        )}
      </div>
      {showPivot && (
        <nav className="h-14 shrink-0 border-t border-[var(--outline-variant)] bg-white flex items-center justify-around px-2">
          {pivotItems.map((item) => {
            const active = currentScreen === item.id;
            const isSummary = item.id === "check";
            const isSettings = item.id === "settings";
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isSummary || isSettings) return;
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
