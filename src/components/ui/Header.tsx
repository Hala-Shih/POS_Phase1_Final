"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Users, MapPin, ArrowRightLeft, X, Ban, Check } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Staff, Table } from "@/lib/types";
import { useOrderStore } from "@/store/order-store";

interface HeaderProps {
  onBack?: () => void;
  serverName?: string;
  tableName?: string;
  guestCount?: number;
  title?: string;
  onGuestCountTap?: () => void;
  onTableTap?: () => void;
  onTransfer?: (staff: Staff) => void;
  staffList?: Staff[];
  currentStaffId?: string;
  onTransferTable?: (table: Table) => void;
  onVoidOrder?: () => void;
  tableList?: Table[];
  currentTableId?: string;
}

export default function Header({
  onBack,
  serverName,
  tableName,
  guestCount,
  title,
  onGuestCountTap,
  onTableTap,
  onTransfer,
  staffList,
  currentStaffId,
  onTransferTable,
  onVoidOrder,
  tableList,
  currentTableId,
}: HeaderProps) {
  const transferStaffDrag = useDragControls();
  const transferTableDrag = useDragControls();
  const [showMenu, setShowMenu] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showTableTransfer, setShowTableTransfer] = useState(false);
  const [selectedTransferStaffId, setSelectedTransferStaffId] = useState<string | null>(null);
  const [selectedTransferTableId, setSelectedTransferTableId] = useState<string | null>(null);
  const [transferArea, setTransferArea] = useState("All");
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const setTransferSheetOpen = useOrderStore((s) => s.setTransferSheetOpen);

  // Sync transfer-table sheet open state with the global store so app-level
  // chrome (e.g., FooterNav) can react to it.
  useEffect(() => {
    setTransferSheetOpen(showTableTransfer);
    return () => setTransferSheetOpen(false);
  }, [showTableTransfer, setTransferSheetOpen]);

  // Close menus on outside click
  useEffect(() => {
    if (!showMenu && !showTableMenu) return;
    const handler = (e: MouseEvent) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (showTableMenu && tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showTableMenu]);

  return (
    <>
      <div className="h-12 flex items-center px-3 border-b border-[var(--outline-variant)] bg-white shrink-0">
        {onBack && (
          <button
            onClick={() => {
              if (showTableTransfer) {
                // While the transfer-to-table sheet is open, the back button
                // should dismiss the sheet (returning to the order view)
                // rather than navigating away from the screen.
                setShowTableTransfer(false);
                setSelectedTransferTableId(null);
                setTransferArea("All");
                return;
              }
              onBack();
            }}
            className="w-10 h-10 flex items-center justify-center -ml-1 rounded-full active:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {title && (
          <span className="text-base font-medium ml-1 flex-1">{title}</span>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {guestCount != null && guestCount > 0 && (
            <button
              onClick={onGuestCountTap}
              className="flex items-center gap-1 text-sm text-[var(--outline)] active:opacity-70"
            >
              <Users size={14} />
              <span>{guestCount}</span>
            </button>
          )}
          {tableName && (
            <div className="relative" ref={tableMenuRef}>
              <button
                onClick={() => {
                  if (onTransferTable || onVoidOrder) {
                    setShowTableMenu((v) => !v);
                  } else {
                    onTableTap?.();
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-xs font-medium text-[var(--primary)] active:opacity-70"
              >
                <MapPin size={12} />
                {tableName}
              </button>

              {/* Table dropdown menu */}
              {showTableMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-[var(--outline-variant)] overflow-hidden z-50">
                  {onTransferTable && (
                    <button
                      onClick={() => {
                        setShowTableMenu(false);
                        setShowTableTransfer(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-gray-50 active:bg-gray-100"
                    >
                      <ArrowRightLeft size={16} className="text-[var(--outline)]" />
                      Transfer table
                    </button>
                  )}
                  {onVoidOrder && (
                    <button
                      onClick={() => {
                        setShowTableMenu(false);
                        setShowVoidConfirm(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <Ban size={16} />
                      Void order
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {serverName && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="text-sm text-[var(--foreground)] font-medium truncate max-w-[80px] active:opacity-70"
              >
                {serverName}
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-[var(--outline-variant)] overflow-hidden z-50">
                  {onTransfer && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowTransfer(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-gray-50 active:bg-gray-100"
                    >
                      <ArrowRightLeft size={16} className="text-[var(--outline)]" />
                      Transfer server
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer drawer */}
      <AnimatePresence>
      {showTransfer && (
        <div className="absolute inset-0 z-50 flex flex-col">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowTransfer(false)}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={transferStaffDrag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                setShowTransfer(false);
              }
            }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70%] flex flex-col z-10"
          >
            <div
              onPointerDown={(e) => transferStaffDrag.start(e)}
              style={{ touchAction: "none" }}
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--outline-variant)]"
            >
              <span className="text-base font-medium">Transfer to</span>
              <button
                onClick={() => setShowTransfer(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {staffList
                ?.filter((s) => s.id !== currentStaffId)
                .map((staff) => {
                  const isSelected = selectedTransferStaffId === staff.id;
                  return (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setSelectedTransferStaffId(staff.id);
                        setTimeout(() => {
                          setShowTransfer(false);
                          setSelectedTransferStaffId(null);
                          onTransfer?.(staff);
                        }, 400);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected ? "bg-[var(--primary-light)]" : "active:bg-gray-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isSelected
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--primary-light)] text-[var(--primary)]"
                      }`}>
                        {staff.name.charAt(0)}
                      </div>
                      <div className="flex flex-col items-start flex-1">
                        <span className="text-sm font-medium text-[var(--foreground)]">{staff.name}</span>
                        <span className="text-xs text-[var(--outline)] capitalize">{staff.role}</span>
                      </div>
                      {isSelected && (
                        <Check size={18} className="text-[var(--primary)]" />
                      )}
                    </button>
                  );
                })}
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      <AnimatePresence>
      {showTableTransfer && (() => {
        const areas = ["All", ...Array.from(new Set(tableList?.map((t) => t.area) ?? []))];
        const filteredTables = tableList?.filter(
          (t) => t.id !== currentTableId && (transferArea === "All" || t.area === transferArea)
        ) ?? [];
        const selectedTable = tableList?.find((t) => t.id === selectedTransferTableId);

        const MAP_W = 360;
        const AREA_H = 420;
        const LABEL_H = 24;
        const AREA_GAP = 30;

        const areasToShow = transferArea === "All" ? areas.filter((a) => a !== "All") : [transferArea];
        const areaOffsets: Record<string, number> = {};
        let totalCanvasH = 0;
        if (transferArea === "All") {
          const allAreas = areas.filter((a) => a !== "All");
          allAreas.forEach((area, i) => {
            areaOffsets[area] = i * (AREA_H + AREA_GAP + LABEL_H);
          });
          totalCanvasH = allAreas.length * (AREA_H + AREA_GAP + LABEL_H);
        } else {
          areaOffsets[transferArea] = 0;
          totalCanvasH = AREA_H;
        }

        const getTableBg = (t: Table) => {
          if (t.status === "available") return { background: "white", border: "1.5px solid var(--outline-variant)" };
          if (t.status === "occupied" && t.orderStatus === "sent") return { background: "#E8F5E9", border: "2px solid #00B618", color: "#00B618" };
          if (t.status === "occupied") return { background: "#FFF8E1", border: "2px solid #F5A623", color: "#F5A623" };
          if (t.status === "checkout") return { background: "var(--primary)", border: "none", color: "white" };
          return { background: "transparent", border: "2px dashed var(--outline-variant)" };
        };

        const tablesByArea = areasToShow.map((area) => ({
          area,
          tables: filteredTables.filter((t) => t.area === area),
        }));

        return (
          <div className="absolute left-0 right-0 z-50 flex flex-col" style={{ top: 48, bottom: 0 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => { setShowTableTransfer(false); setSelectedTransferTableId(null); setTransferArea("All"); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={transferTableDrag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowTableTransfer(false);
                  setSelectedTransferTableId(null);
                  setTransferArea("All");
                }
              }}
              className="absolute inset-0 bg-white flex flex-col z-10"
            >
              {/* Header */}
              <div
                onPointerDown={(e) => transferTableDrag.start(e)}
                style={{ touchAction: "none" }}
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--outline-variant)] shrink-0"
              >
                <span className="text-base font-medium">Transfer to table</span>
                <button
                  onClick={() => { setShowTableTransfer(false); setSelectedTransferTableId(null); setTransferArea("All"); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Area tabs */}
              <div className="flex overflow-x-auto no-scrollbar gap-2 px-3 py-2 shrink-0">
                {areas.map((area) => (
                  <button
                    key={area}
                    onClick={() => setTransferArea(area)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
                      transferArea === area
                        ? "bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]"
                        : "border-[var(--outline-variant)] text-[var(--outline)]"
                    }`}
                  >
                    {transferArea === area && <Check size={14} />}
                    {area}
                  </button>
                ))}
              </div>

              {/* Floor map — matches TablesScreen */}
              <div className="flex-1 overflow-hidden touch-none">
                <div
                  style={{
                    width: MAP_W,
                    height: totalCanvasH,
                    position: "relative",
                  }}
                >
                  {tablesByArea.map(({ area, tables: areaTables }) => {
                    const yOff = areaOffsets[area] || 0;
                    return (
                      <div key={area} style={{ position: "absolute", top: yOff, left: 0, width: "100%" }}>
                        {areasToShow.length > 1 && (
                          <div className="px-3" style={{ height: LABEL_H, display: "flex", alignItems: "center" }}>
                            <span className="text-sm font-semibold text-[var(--outline)]">{area}</span>
                          </div>
                        )}
                        <div className="relative w-full" style={{ height: AREA_H, top: areasToShow.length > 1 ? 0 : -LABEL_H }}>
                          {areaTables.map((table) => {
                            const isAvailable = table.status === "available";
                            const isSelected = table.id === selectedTransferTableId;
                            return (
                              <button
                                key={table.id}
                                disabled={!isAvailable}
                                onClick={() => setSelectedTransferTableId(isSelected ? null : table.id)}
                                className={`absolute flex flex-col items-center justify-center transition-transform ${
                                  !isAvailable ? "opacity-40 cursor-default" : "active:scale-95"
                                }`}
                                style={{
                                  left: `${table.x}%`,
                                  top: `${table.y}%`,
                                  width: table.w,
                                  height: table.h,
                                  borderRadius: table.shape === "circle" ? "50%" : 8,
                                  ...getTableBg(table),
                                }}
                              >
                                {/* Selected checkmark */}
                                {isSelected && (
                                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center z-10">
                                    <Check size={12} className="text-white" />
                                  </span>
                                )}

                                {/* Occupied badge */}
                                {table.guestCount && table.status === "occupied" && (
                                  <span
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                                    style={{ background: table.orderStatus === "sent" ? "#00B618" : "#F5A623" }}
                                  >
                                    {table.guestCount}
                                  </span>
                                )}

                                {/* Checkout outer ring */}
                                {table.status === "checkout" && (
                                  <span
                                    className="absolute inset-[-4px] border border-[var(--primary)]"
                                    style={{ borderRadius: table.shape === "circle" ? "50%" : 10 }}
                                  />
                                )}

                                {/* Checkout badge */}
                                {table.status === "checkout" && table.guestCount && (
                                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-black flex items-center justify-center">
                                    <span className="text-[10px] font-bold leading-none text-black">
                                      {table.guestCount}
                                    </span>
                                  </span>
                                )}

                                <span className={`text-xs font-semibold ${
                                  table.status === "checkout" ? "text-white" : ""
                                }`}>
                                  {table.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sticky confirm button */}
              <div className="px-4 py-3 border-t border-[var(--outline-variant)] bg-white shrink-0">
                <button
                  disabled={!selectedTransferTableId}
                  onClick={() => {
                    if (selectedTable) {
                      setShowTableTransfer(false);
                      setSelectedTransferTableId(null);
                      setTransferArea("All");
                      onTransferTable?.(selectedTable);
                    }
                  }}
                  className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors ${
                    selectedTransferTableId
                      ? "bg-[var(--primary)] text-white active:opacity-90"
                      : "bg-[var(--surface)] text-[var(--outline)]"
                  }`}
                >
                  {selectedTransferTableId
                    ? `Confirm transfer to ${selectedTable?.name ?? ""}`
                    : "Select a table"}
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
      </AnimatePresence>

      {/* Void order confirmation toast — M3 style */}
      {showVoidConfirm && (
        <div
          className="absolute top-3 left-4 right-4 z-[60] flex flex-col rounded-xl animate-[slideDown_0.2s_ease-out]"
          style={{
            maxWidth: 328,
            background: "#F3EDF7",
            boxShadow: "0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)",
          }}
        >
          <div className="px-4 pt-4 pb-1">
            <p className="text-2xl font-medium text-black leading-8">
              Void order
            </p>
            <p className="text-base text-black leading-6 mt-1" style={{ letterSpacing: "0.5px" }}>
              You are about to erase this order. This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col items-center px-3 pt-3 pb-3 gap-3">
            <button
              onClick={() => {
                setShowVoidConfirm(false);
                onVoidOrder?.();
              }}
              className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
              style={{ background: "#B3261E" }}
            >
              <span className="text-sm font-medium text-white tracking-wide">Confirm void</span>
            </button>
            <button
              onClick={() => setShowVoidConfirm(false)}
              className="w-full h-12 rounded-md flex items-center justify-center active:opacity-80"
              style={{ background: "#E8DEF8" }}
            >
              <span className="text-sm font-medium tracking-wide" style={{ color: "#6750A4" }}>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
