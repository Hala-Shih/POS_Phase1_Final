"use client";

import { useState, useEffect } from "react";
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

const screensWithFooter = ["check", "order", "payment", "orders"];

export default function App() {
  const currentScreen = useOrderStore((s) => s.currentScreen);
  const setScreen = useOrderStore((s) => s.setScreen);
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const [footerTab, setFooterTab] = useState<FooterTab>("check");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionItem, setActionItem] = useState<{ id: string; name: string } | null>(null);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [splitCheckOnOpen, setSplitCheckOnOpen] = useState(false);

  const showFooter = screensWithFooter.includes(currentScreen);

  // Sync footer tab and split trigger with payment screen
  useEffect(() => {
    if (currentScreen === "payment") {
      setFooterTab("payment");
      setPaymentDrawerOpen(false);
    } else {
      if (footerTab === "payment") setFooterTab("check");
      setSplitCheckOnOpen(false);
    }
  }, [currentScreen]);

  const handleSetMenuOpen = (open: boolean) => {
    setMenuOpen(open);
    if (open) setPaymentDrawerOpen(false);
    if (open) {
      setFooterTab("menu");
    } else {
      setFooterTab("check");
    }
  };

  const handleSetSearchOpen = (open: boolean) => {
    setSearchOpen(open);
    if (open) setPaymentDrawerOpen(false);
    if (!open) {
      setFooterTab("check");
    }
  };

  const handleFooterSelect = (tab: FooterTab) => {
    setFooterTab(tab);
    if (tab === "menu") {
      if (currentScreen === "payment") setScreen("check");
      setMenuOpen(true);
      setSearchOpen(false);
      setActionOpen(false);
      setActionItem(null);
      setPaymentDrawerOpen(false);
    } else if (tab === "search") {
      if (currentScreen === "payment") setScreen("check");
      setSearchOpen(true);
      setMenuOpen(false);
      setActionOpen(false);
      setActionItem(null);
      setPaymentDrawerOpen(false);
    } else if (tab === "action") {
      setActionOpen(true);
      setActionItem(null);
      setMenuOpen(false);
      setSearchOpen(false);
      setPaymentDrawerOpen(false);
    } else if (tab === "payment") {
      if (currentScreen === "payment") setScreen("check");
      setMenuOpen(false);
      setSearchOpen(false);
      setActionOpen(false);
      setActionItem(null);
      setPaymentDrawerOpen(true);
    } else {
      setMenuOpen(false);
      setSearchOpen(false);
      setActionOpen(false);
      setActionItem(null);
      setPaymentDrawerOpen(false);
      if (currentScreen === "payment") {
        setScreen("check");
      }
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
              setActionOpen(true);
              setFooterTab("action");
              setMenuOpen(false);
              setSearchOpen(false);
              setPaymentDrawerOpen(false);
            }}
            onOpenPaymentDrawer={() => {
              setActionOpen(false);
              setActionItem(null);
              setMenuOpen(false);
              setSearchOpen(false);
              setPaymentDrawerOpen(true);
              setFooterTab("payment");
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
          onClose={() => {
            setActionOpen(false);
            setActionItem(null);
            setFooterTab("check");
          }}
          onPay={() => {
            if (currentScreen === "payment") setScreen("check");
            setActionOpen(false);
            setActionItem(null);
            setMenuOpen(false);
            setSearchOpen(false);
            setPaymentDrawerOpen(true);
            setFooterTab("payment");
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
          onClose={() => {
            setPaymentDrawerOpen(false);
            setFooterTab("check");
          }}
          onSplit={() => {
            setPaymentDrawerOpen(false);
            setSplitCheckOnOpen(true);
            setScreen("payment");
          }}
          onMultiplePayment={() => {
            setPaymentDrawerOpen(false);
            setSplitCheckOnOpen(false);
            setScreen("payment");
          }}
          onPrint={() => {
            setPaymentDrawerOpen(false);
            setFooterTab("check");
          }}
          onPaymentComplete={() => {
            resetOrder();
            setPaymentDrawerOpen(false);
            setFooterTab("check");
            setScreen("login");
          }}
        />
      </div>
      <FooterNav activeTab={footerTab} onSelect={handleFooterSelect} />
    </div>
  );
}
