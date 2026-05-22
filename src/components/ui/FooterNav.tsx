"use client";

import { BookOpen, Search, Zap, ClipboardList, CreditCard } from "lucide-react";

export type FooterTab = "check" | "menu" | "search" | "action" | "payment";

interface FooterNavProps {
  activeTab: FooterTab;
  onSelect: (tab: FooterTab) => void;
}

const tabs: { id: FooterTab; label: string; icon: typeof BookOpen }[] = [
  { id: "check", label: "Check", icon: ClipboardList },
  { id: "menu", label: "Menu", icon: BookOpen },
  { id: "action", label: "Actions", icon: Zap },
];

export default function FooterNav({ activeTab, onSelect }: FooterNavProps) {
  return (
    <nav className="flex items-center justify-around bg-white border-t border-gray-200 shrink-0 py-1.5">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-1 transition-colors"
            style={{
              color: isActive ? "var(--primary)" : "var(--outline)",
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
            <span
              className="text-[10px] font-medium"
              style={{ fontWeight: isActive ? 600 : 400 }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
