"use client";

import { ShoppingCart } from "lucide-react";
import { useOrderStore } from "@/store/order-store";

interface CartBarProps {
  onOpen: () => void;
}

export default function CartBar({ onOpen }: CartBarProps) {
  const cartCount = useOrderStore((s) => s.cartCount());
  const cartTotal = useOrderStore((s) => s.cartTotal());
  const sentCount = useOrderStore((s) => s.cartItems.filter((i) => i.sent).length);
  const unsentCount = useOrderStore((s) => s.cartItems.filter((i) => !i.sent).length);

  return (
    <div className="shrink-0 border-t border-[var(--outline-variant)] bg-white">
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-[var(--surface)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart size={20} className="text-[var(--foreground)]" />
          </div>
          <span className="text-sm font-medium">
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </span>
          {sentCount > 0 && unsentCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-medium text-green-600 leading-none">{sentCount} sent</span>
              </span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-medium text-amber-600 leading-none">{unsentCount} unsent</span>
              </span>
            </span>
          ) : sentCount > 0 ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-medium text-green-600 leading-none">Sent</span>
            </span>
          ) : null}
        </div>
        <span className="text-base font-semibold">
          ${cartTotal.toFixed(2)}
        </span>
      </button>
    </div>
  );
}
