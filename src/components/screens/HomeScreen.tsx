"use client";

import { useOrderStore } from "@/store/order-store";
import { ArrowLeft, Globe, Settings } from "lucide-react";

const labels = {
  en: {
    dineIn: "Dine In",
    orders: "Orders",
    summary: "Summary",
    settings: "Settings",
    language: "English",
  },
  zh: {
    dineIn: "內用",
    orders: "訂單",
    summary: "總結",
    settings: "設定",
    language: "中文",
  },
};

export default function HomeScreen() {
  const { currentStaff, language, toggleLanguage, setScreen } = useOrderStore();
  const t = labels[language];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 bg-white border-b border-[var(--outline-variant)]">
        <button
          onClick={() => setScreen("login")}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>

        <button
          onClick={toggleLanguage}
          className="relative h-8 w-24 rounded-full active:bg-gray-100"
        >
          <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]" />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-medium leading-none">{t.language}</span>
        </button>

        <span className="text-sm font-medium truncate max-w-[80px]">
          {currentStaff?.name}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Dine In card */}
        <button
          onClick={() => setScreen("tables")}
          className="bg-white rounded-2xl border border-[var(--outline-variant)] p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span className="text-lg font-semibold">{t.dineIn}</span>
        </button>

        {/* Orders card */}
        <button
          onClick={() => setScreen("orders")}
          className="bg-white rounded-2xl border border-[var(--outline-variant)] p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span className="text-lg font-semibold">{t.orders}</span>
        </button>

        {/* Summary card */}
        <button
          onClick={() => {}}
          className="bg-white rounded-2xl border border-[var(--outline-variant)] p-5 flex items-start active:scale-[0.98] transition-transform"
        >
          <span className="text-lg font-semibold">{t.summary}</span>
        </button>
      </div>

      {/* Settings button at bottom */}
      <div className="px-4 pb-4">
        <button
          onClick={() => {}}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--outline-variant)] bg-white active:bg-gray-50"
        >
          <Settings size={18} className="text-[var(--outline)]" />
          <span className="text-sm font-medium">{t.settings}</span>
        </button>
      </div>
    </div>
  );
}
