"use client";

import { useState } from "react";
import { Check, Users, MapPin, Plus } from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import Header from "@/components/ui/Header";
import ordersData from "@/data/orders.json";
import staffData from "@/data/staff.json";
import type { Order, OrderStatus, Staff } from "@/lib/types";

const mockOrders = ordersData as Order[];

type CanonicalOrderStatus = "open" | "close" | "void" | "combined";
type FilterKey = "all" | CanonicalOrderStatus;

const toCanonicalStatus = (status: OrderStatus): CanonicalOrderStatus => {
  switch (status) {
    case "editing":
      return "open";
    case "sent":
      return "combined";
    case "closed":
      return "close";
    case "voided":
      return "void";
  }
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "close", label: "Close" },
  { key: "void", label: "Void" },
  { key: "combined", label: "Combined" },
];

const STATUS_CONFIG: Record<CanonicalOrderStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  open: { label: "Open", dot: "#F5A623", bg: "#FFF8E1", text: "#B5790D", border: "#F5D87E" },
  combined: { label: "Combined", dot: "#00B618", bg: "#FFFFFF", text: "#00B618", border: "#00B618" },
  close: { label: "Close", dot: "", bg: "transparent", text: "#79747E", border: "transparent" },
  void: { label: "Void", dot: "", bg: "#FFEBEE", text: "#B71C1C", border: "#FFCDD2" },
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function OrdersScreen() {
  const { currentStaff, setStaff, setScreen, loadTableOrder } = useOrderStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filtered = mockOrders.filter((order) => {
    const canonicalStatus = toCanonicalStatus(order.status);

    switch (activeFilter) {
      case "open":
        return canonicalStatus === "open";
      case "close":
        return canonicalStatus === "close";
      case "void":
        return canonicalStatus === "void";
      case "combined":
        return canonicalStatus === "combined";
      default:
        return true;
    }
  });

  const setOpenPaymentOnArrival = useOrderStore((s) => s.setOpenPaymentOnArrival);

  const handleOrderTap = (order: Order) => {
    loadTableOrder({
      id: order.tableId,
      name: order.tableName,
      area: "",
      status: "occupied",
      shape: "circle",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      guestCount: order.guestCount,
      serverName: order.serverName,
      hasActiveOrder: true,
      orderStatus: order.status,
    });
    const isOpen = order.status === "editing";
    setScreen("check");
  };

  const handleNewOrder = () => {
    setScreen("tables");
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <Header
        onBack={() => setScreen("home")}
        serverName={currentStaff?.name}
        onTransfer={(staff) => setStaff(staff)}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="shrink-0 h-9 px-4 rounded-full flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{
                background: isActive ? "#F3EDF7" : "transparent",
                border: "1px solid",
                borderColor: isActive ? "#E8DEF8" : "var(--outline-variant)",
                color: isActive ? "#1D1B20" : "var(--outline)",
              }}
            >
              {isActive && <Check size={16} strokeWidth={2.5} />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-1 pb-3 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-[var(--outline)]">No orders found</span>
          </div>
        ) : (
          filtered.map((order) => {
            const canonicalStatus = toCanonicalStatus(order.status);
            const cfg = STATUS_CONFIG[canonicalStatus];
            const isClose = canonicalStatus === "close";
            return (
              <button
                key={order.id}
                onClick={() => handleOrderTap(order)}
                className="w-full rounded-2xl border p-4 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: isClose ? "#F3F3F3" : "white",
                  borderColor: "var(--outline-variant)",
                }}
              >
                {/* Top row: order number + status */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-black">{order.orderNumber}</span>
                  {cfg.label !== "Close" ? (
                    <span
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: cfg.bg,
                        color: cfg.text,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      {cfg.dot && (
                        <span
                          className="inline-block rounded-full"
                          style={{ width: 8, height: 8, background: cfg.dot }}
                        />
                      )}
                      {cfg.label}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: "#79747E" }}>Close</span>
                  )}
                </div>

                {/* Info row: guests, table, server */}
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="flex items-center gap-1 text-sm text-black">
                    <Users size={14} />
                    <span>{order.guestCount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-black">
                    <MapPin size={14} />
                    <span>{order.tableName}</span>
                  </div>
                  <span className="text-sm text-black">{order.serverName}</span>
                </div>

                {/* Bottom row: order type, time, total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: "#49454F" }}>
                      {order.orderType === "dine-in" ? "Dine in" : "Takeout"}
                    </span>
                    <span className="text-sm" style={{ color: "#CAC4D0" }}>|</span>
                    <span className="text-sm" style={{ color: "#49454F" }}>
                      {timeAgo(order.createdAt)}
                    </span>
                  </div>
                  <span className="text-base font-bold text-black">
                    Total: ${order.total.toFixed(0)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* New order button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleNewOrder}
          className="w-full bg-white rounded-2xl border border-[var(--outline-variant)] p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <Plus size={20} className="text-black" />
          <span className="text-base font-semibold text-black">New order</span>
        </button>
      </div>
    </div>
  );
}
