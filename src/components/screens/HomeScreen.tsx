"use client";

import { useOrderStore } from "@/store/order-store";
import tablesData from "@/data/tables.json";
import { Table } from "@/lib/types";
import { ArrowLeft, Globe, Settings } from "lucide-react";

const tables = tablesData as Table[];

const labels = {
  en: {
    dineIn: "Dine In",
    availableTables: "Available tables",
    orders: "Orders",
    open: "Open",
    summary: "Summary",
    settings: "Settings",
    language: "English",
  },
  zh: {
    dineIn: "內用",
    availableTables: "可用桌位",
    orders: "訂單",
    open: "進行中",
    summary: "總結",
    settings: "設定",
    language: "中文",
  },
};

export default function HomeScreen() {
  const { currentStaff, language, toggleLanguage, setScreen } = useOrderStore();
  const t = labels[language];

  const availableCount = tables.filter((t) => t.status === "available").length;
  const openOrderCount = tables.filter((t) => t.hasActiveOrder).length;

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:bg-gray-100"
        >
          <Globe size={16} className="text-[var(--foreground)]" />
          <span className="text-sm font-medium">{t.language}</span>
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
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--outline)]">
              {t.availableTables}
            </span>
            <span className="text-lg font-bold">{availableCount}</span>
          </div>
        </button>

        {/* Orders card */}
        <button
          onClick={() => setScreen("orders")}
          className="bg-white rounded-2xl border border-[var(--outline-variant)] p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span className="text-lg font-semibold">{t.orders}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--outline)]">{t.open}</span>
            <span className="text-lg font-bold">{openOrderCount}</span>
          </div>
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
