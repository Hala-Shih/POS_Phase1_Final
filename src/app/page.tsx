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

const screensWithFooter = ["guest-count", "check", "order", "payment", "orders"];

export default function App() {
  const currentScreen = useOrderStore((s) => s.currentScreen);
  const setScreen = useOrderStore((s) => s.setScreen);
  const [footerTab, setFooterTab] = useState<FooterTab>("check");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const showFooter = screensWithFooter.includes(currentScreen);

  // When navigating away from payment via store, sync footer tab
  useEffect(() => {
    if (currentScreen !== "payment" && footerTab === "payment") {
      setFooterTab("check");
    }
  }, [currentScreen, footerTab]);

  const handleSetMenuOpen = (open: boolean) => {
    setMenuOpen(open);
    if (open) {
      setFooterTab("menu");
    } else {
      setFooterTab("check");
    }
  };

  const handleSetSearchOpen = (open: boolean) => {
    setSearchOpen(open);
    if (!open) {
      setFooterTab("check");
    }
  };

  const handleFooterSelect = (tab: FooterTab) => {
    setFooterTab(tab);
    if (tab === "menu") {
      setMenuOpen(true);
      setSearchOpen(false);
    } else if (tab === "search") {
      setSearchOpen(true);
      setMenuOpen(false);
    } else if (tab === "payment") {
      setMenuOpen(false);
      setSearchOpen(false);
      setScreen("payment");
    } else {
      setMenuOpen(false);
      setSearchOpen(false);
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
        return <CheckSummaryScreen menuOpen={menuOpen} setMenuOpen={handleSetMenuOpen} searchOpen={searchOpen} setSearchOpen={handleSetSearchOpen} />;
      case "order":
        return <OrderScreen />;
      case "payment":
        return <PaymentScreen />;
      case "orders":
        return <OrdersScreen />;
      default:
        return <LoginScreen />;
    }
  };

  if (!showFooter) return renderScreen();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">{renderScreen()}</div>
      <FooterNav activeTab={footerTab} onSelect={handleFooterSelect} />
    </div>
  );
}
