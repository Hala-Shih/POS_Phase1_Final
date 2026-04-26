"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrderStore } from "@/store/order-store";
import LoginScreen from "@/components/screens/LoginScreen";
import HomeScreen from "@/components/screens/HomeScreen";
import TablesScreen from "@/components/screens/TablesScreen";
import GuestCountScreen from "@/components/screens/GuestCountScreen";
import CheckSummaryScreen from "@/components/screens/CheckSummaryScreen";
import OrderScreen from "@/components/screens/OrderScreen";
import PaymentScreen from "@/components/screens/PaymentScreen";
import OrdersScreen from "@/components/screens/OrdersScreen";
import FooterNav, { type FooterTab } from "@/components/ui/FooterNav";
import ActionDrawer from "@/components/action/ActionDrawer";
import PaymentDrawer from "@/components/payment/PaymentDrawer";

const screensWithFooter = ["check", "order", "payment"];

// Rule 1 (System-Wide Rules): only one drawer may be open at a time.
// All drawer state is centralized here as a single `activeDrawer` value so
// opening one drawer mechanically closes any other.
type ActiveDrawer = "none" | "menu" | "search" | "action" | "payment";

const DRAWER_TO_TAB: Record<Exclude<ActiveDrawer, "none">, FooterTab> = {
  menu: "menu",
  search: "search",
  action: "action",
  payment: "payment",
};

export default function App() {
  const currentScreen = useOrderStore((s) => s.currentScreen);
  const setScreen = useOrderStore((s) => s.setScreen);
  const resetOrder = useOrderStore((s) => s.resetOrder);

  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const [actionItem, setActionItem] = useState<{ id: string; name: string } | null>(null);
  const [splitCheckOnOpen, setSplitCheckOnOpen] = useState(false);

  // Derived drawer flags (kept for prop compatibility with child screens).
  const menuOpen = activeDrawer === "menu";
  const searchOpen = activeDrawer === "search";
  const actionOpen = activeDrawer === "action";
  const paymentDrawerOpen = activeDrawer === "payment";

  // Footer tab is derived from active drawer to satisfy Rule 3 (tab/drawer sync).
  const footerTab: FooterTab =
    activeDrawer === "none" ? "check" : DRAWER_TO_TAB[activeDrawer];

  const showFooter = screensWithFooter.includes(currentScreen);

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
  useEffect(() => {
    if (currentScreen === "payment") {
      // Payment screen owns its own UI; no app-shell drawer should remain open.
      if (activeDrawer !== "none") closeDrawers();
    } else {
      setSplitCheckOnOpen(false);
      // App-shell drawers are only meaningful on `check`. Close on any other screen.
      if (currentScreen !== "check" && activeDrawer !== "none") {
        closeDrawers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  const handleSetMenuOpen = (open: boolean) => {
    if (open) openDrawer("menu");
    else if (menuOpen) closeDrawers();
  };

  const handleSetSearchOpen = (open: boolean) => {
    if (open) openDrawer("search");
    else if (searchOpen) closeDrawers();
  };

  const handleFooterSelect = (tab: FooterTab) => {
    // Rule 3: tapping the active drawer's tab toggles it closed.
    if (tab === "check") {
      if (currentScreen === "payment") setScreen("check");
      closeDrawers();
      return;
    }

    if (currentScreen === "payment" && tab !== "payment") {
      setScreen("check");
    }

    const target: ActiveDrawer = tab;
    if (activeDrawer === target) {
      closeDrawers();
    } else {
      openDrawer(target);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "login":
        return <LoginScreen />;
      case "home":
        return <HomeScreen />;
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
            externalDrawerType={actionOpen ? "action" : paymentDrawerOpen ? "payment" : "none"}
            onOpenItemActions={(item) => {
              setActionItem(item);
              openDrawer("action");
            }}
            onOpenPaymentDrawer={() => {
              openDrawer("payment");
            }}
          />
        );
      case "order":
        return <OrderScreen />;
      case "payment":
        return <PaymentScreen autoOpenSplit={splitCheckOnOpen} />;
      case "orders":
        return <OrdersScreen />;
      default:
        return <LoginScreen />;
    }
  };

  if (!showFooter) return renderScreen();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        {renderScreen()}
        <ActionDrawer
          open={actionOpen}
          onClose={closeDrawers}
          onPay={() => {
            if (currentScreen === "payment") setScreen("check");
            openDrawer("payment");
          }}
          onSplitCheck={() => {
            setSplitCheckOnOpen(true);
            setScreen("payment");
          }}
          onMultiplePayment={() => {
            setSplitCheckOnOpen(false);
            setScreen("payment");
          }}
          itemContext={actionItem ?? undefined}
        />
        <PaymentDrawer
          open={paymentDrawerOpen}
          onClose={closeDrawers}
          onSplit={() => {
            closeDrawers();
            setSplitCheckOnOpen(true);
            setScreen("payment");
          }}
          onMultiplePayment={() => {
            closeDrawers();
            setSplitCheckOnOpen(false);
            setScreen("payment");
          }}
          onPrint={closeDrawers}
          onPaymentComplete={() => {
            resetOrder();
            closeDrawers();
            setScreen("login");
          }}
        />
      </div>
      <FooterNav activeTab={footerTab} onSelect={handleFooterSelect} />
    </div>
  );
}
