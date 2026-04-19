"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  showCheckmark?: boolean;
  variant?: "pill" | "underline";
}

export default function TabBar({
  tabs,
  activeId,
  onSelect,
  showCheckmark = false,
  variant = "pill",
}: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      const container = containerRef.current;
      const tab = activeTabRef.current;
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;
      const containerWidth = container.offsetWidth;
      // Center the active tab in the container
      const targetScroll = tabLeft - containerWidth / 2 + tabWidth / 2;
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [activeId]);

  if (variant === "underline") {
    return (
      <div
        ref={containerRef}
        className="flex overflow-x-auto no-scrollbar border-b border-[var(--outline-variant)] shrink-0"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={activeId === tab.id ? activeTabRef : undefined}
            onClick={() => onSelect(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              activeId === tab.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--outline)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex overflow-x-auto no-scrollbar gap-2 px-3 py-2 shrink-0"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={activeId === tab.id ? activeTabRef : undefined}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
            activeId === tab.id
              ? "bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]"
              : "border-[var(--outline-variant)] text-[var(--outline)]"
          }`}
        >
          {showCheckmark && activeId === tab.id && <Check size={14} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
