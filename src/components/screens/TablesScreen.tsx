"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Header from "@/components/ui/Header";
import TabBar from "@/components/ui/TabBar";
import { useOrderStore } from "@/store/order-store";
import tablesData from "@/data/tables.json";
import staffData from "@/data/staff.json";
import { Table, Staff } from "@/lib/types";
import { Map, Keyboard } from "lucide-react";

const tables = tablesData as Table[];
const areas = ["All", ...Array.from(new Set(tables.map((t) => t.area)))];

// Area prefix buttons for table search keypad
const areaPrefixes = [
  { label: "P", prefix: "P" },
  { label: "M", prefix: "M" },
  { label: "R", prefix: "R" },
  { label: "B", prefix: "B" },
  { label: "T", prefix: "T" },
];

const AREA_CN: Record<string, string> = { All: "全部", Main: "大廳", Bar: "吧台", Patio: "露台" };

export default function TablesScreen() {
  const [activeArea, setActiveArea] = useState("All");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadPrefix, setKeypadPrefix] = useState("");
  const [keypadError, setKeypadError] = useState(false);
  const { currentStaff, setStaff, setTable, resetOrder, setScreen, loadTableOrder, setOpenMenuOnArrival, language } = useOrderStore();

  const L = language === "zh"
    ? { enterTable: "輸入桌號", refresh: "清除", select: "選擇", tableNotFound: "找不到桌位", guests: "位客人",
        occupied: "使用中", checkout: "結帳中", closed: "已關閉", available: "空桌" }
    : { enterTable: "Enter table", refresh: "Refresh", select: "Select", tableNotFound: "Table not found", guests: "guests",
        occupied: "Occupied", checkout: "Checkout", closed: "Closed", available: "Available" };

  // Group tables by area for map rendering
  const areasToShow = activeArea === "All"
    ? areas.filter((a) => a !== "All")
    : [activeArea];
  const tablesByArea = areasToShow.map((area) => ({
    area,
    tables: tables.filter((t) => t.area === area),
  }));

  const handleTableSelect = (table: Table) => {
    if (table.hasActiveOrder) {
      loadTableOrder(table);
      setScreen("check");
    } else {
      resetOrder();
      setTable(table);
      setOpenMenuOnArrival(true);
      setScreen("guest-count");
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (keypadValue.length < 4) {
      setKeypadValue(keypadValue + digit);
      setKeypadError(false);
    }
  };

  const handleKeypadPrefix = (prefix: string) => {
    setKeypadPrefix(keypadPrefix === prefix ? "" : prefix);
    setKeypadError(false);
  };

  const handleKeypadSelect = () => {
    if (!keypadValue) return;
    const searchName = keypadPrefix + keypadValue;
    const found = tables.find(
      (t) => t.name.toUpperCase() === searchName.toUpperCase()
    );
    if (found) {
      setShowKeypad(false);
      setKeypadValue("");
      setKeypadPrefix("");
      handleTableSelect(found);
    } else {
      setKeypadError(true);
    }
  };

  const handleKeypadClear = () => {
    setKeypadValue("");
    setKeypadPrefix("");
    setKeypadError(false);
  };

  const toggleView = () => {
    if (showKeypad) {
      handleKeypadClear();
    }
    setShowKeypad(!showKeypad);
  };

  // Pinch-to-zoom & pan state
  const MAP_W = 360;
  const AREA_H = 420; // height per area section
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ startDist: number; startScale: number; midX: number; midY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const isDraggingRef = useRef(false);
  const DRAG_THRESHOLD = 8;
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // For "All" view, compute y offsets per area so all areas render on one canvas
  const areaOffsets: Record<string, number> = {};
  const AREA_GAP = 30; // gap between areas
  const LABEL_H = 24; // height for area label
  let totalCanvasH = 0;
  if (activeArea === "All") {
    const allAreas = areas.filter(a => a !== "All");
    allAreas.forEach((area, i) => {
      areaOffsets[area] = i * (AREA_H + AREA_GAP + LABEL_H);
    });
    totalCanvasH = allAreas.length * (AREA_H + AREA_GAP + LABEL_H);
  } else {
    areaOffsets[activeArea] = 0;
    totalCanvasH = AREA_H;
  }

  // Compute default scale to fill available space when area changes
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const containerW = mapContainerRef.current.clientWidth;
    const containerH = mapContainerRef.current.clientHeight;

    // Find tight bounding box of all visible tables
    const currentTables = activeArea === "All" ? tables : tables.filter(t => t.area === activeArea);
    if (currentTables.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    currentTables.forEach(t => {
      const areaOff = areaOffsets[t.area] || 0;
      const left = (t.x / 100) * MAP_W;
      const top = areaOff + LABEL_H + (t.y / 100) * AREA_H;
      const right = left + t.w;
      const bottom = top + t.h;
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    const PAD = 16;
    const contentW = maxX - minX + PAD * 2;
    const contentH = maxY - minY + PAD * 2;

    if (activeArea === "All") {
      // For "All" view: fit width, start from top, allow pan to scroll down
      const scaleToFitW = containerW / (maxX + PAD * 2);
      const fitScale = Math.max(Math.min(scaleToFitW, MAX_SCALE), MIN_SCALE);
      setScale(fitScale);
      const cx = (containerW - (maxX + PAD * 2) * fitScale) / 2;
      setTranslate({ x: cx + PAD * fitScale, y: 0 });
    } else {
      // For single area: zoom to fill the available space
      const scaleX = containerW / contentW;
      const scaleY = containerH / contentH;
      const fitScale = Math.max(Math.min(scaleX, scaleY, MAX_SCALE), MIN_SCALE);
      setScale(fitScale);
      const cx = (containerW - contentW * fitScale) / 2 - (minX - PAD) * fitScale;
      const cy = (containerH - contentH * fitScale) / 2 - (minY - PAD) * fitScale;
      setTranslate({ x: cx, y: cy });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArea]);

  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    const containerW = mapContainerRef.current?.clientWidth || MAP_W;
    const containerH = mapContainerRef.current?.clientHeight || 500;
    const scaledW = MAP_W * s;
    const scaledH = totalCanvasH * s;
    // Allow panning so content edge meets container edge, but no further
    const minX = Math.min(0, containerW - scaledW);
    const maxX = Math.max(0, containerW - scaledW);
    const minY = Math.min(0, containerH - scaledH);
    const maxY = Math.max(0, containerH - scaledH);
    return {
      x: Math.max(minX, Math.min(maxX, tx)),
      y: Math.max(minY, Math.min(maxY, ty)),
    };
  }, [totalCanvasH]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = false;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scale, midX, midY };
      panRef.current = null;
    } else if (e.touches.length === 1) {
      panRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: translate.x,
        startTy: translate.y,
      };
      pinchRef.current = null;
    }
  }, [scale, translate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      isDraggingRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
        pinchRef.current.startScale * (dist / pinchRef.current.startDist)
      ));
      setScale(newScale);
      setTranslate(prev => clampTranslate(prev.x, prev.y, newScale));
    } else if (e.touches.length === 1 && panRef.current) {
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      // Only start panning after exceeding drag threshold
      if (!isDraggingRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current) {
        e.preventDefault();
        setTranslate(clampTranslate(
          panRef.current.startTx + dx,
          panRef.current.startTy + dy,
          scale
        ));
      }
    }
  }, [scale, clampTranslate]);

  const handleTouchEnd = useCallback(() => {
    // Keep isDraggingRef.current true briefly so onClick can check it
    const wasDragging = isDraggingRef.current;
    if (wasDragging) {
      setTimeout(() => { isDraggingRef.current = false; }, 0);
    }
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  // Mouse wheel scroll for desktop testing
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTranslate(prev => clampTranslate(
      prev.x - e.deltaX,
      prev.y - e.deltaY,
      scale
    ));
  }, [scale, clampTranslate]);

  const getTableStyle = (table: Table): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: `${table.x}%`,
      top: `${table.y}%`,
      width: table.w,
      height: table.h,
      borderRadius: table.shape === "circle" ? "50%" : 8,
    };

    switch (table.status) {
      case "occupied":
        if (table.orderStatus === "sent") {
          return { ...base, background: "#E8F5E9", border: "2px solid #00B618", color: "#00B618" };
        }
        // editing or no orderStatus → yellow/orange
        return { ...base, background: "#FFF8E1", border: "2px solid #F5A623", color: "#F5A623" };
      case "checkout":
        return { ...base, background: "var(--primary)", border: "none", color: "white" };
      case "unavailable":
        return { ...base, background: "transparent", border: "2px dashed var(--outline-variant)" };
      default: // available
        return { ...base, background: "white", border: "1.5px solid var(--outline-variant)" };
    }
  };

  const displayValue = keypadPrefix + keypadValue;

  // Live table lookup for status display
  const matchedTable = displayValue
    ? tables.find((t) => t.name.toUpperCase() === displayValue.toUpperCase())
    : null;

  const getStatusLabel = (table: Table) => {
    switch (table.status) {
      case "occupied": return L.occupied;
      case "checkout": return L.checkout;
      case "unavailable": return L.closed;
      default: return L.available;
    }
  };

  const getStatusColor = (table: Table) => {
    switch (table.status) {
      case "occupied": return table.orderStatus === "sent" ? "#00B618" : "#F5A623";
      case "checkout": return "var(--primary)";
      case "unavailable": return "var(--outline)";
      default: return "#00B618";
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <Header
        onBack={() => {
          resetOrder();
          setScreen("home");
        }}
        serverName={currentStaff?.name}
        onTransfer={(staff) => setStaff(staff)}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
      />

      {!showKeypad && (
        <TabBar
          tabs={areas.map((a) => ({ id: a, label: language === "zh" ? (AREA_CN[a] || a) : a }))}
          activeId={activeArea}
          onSelect={setActiveArea}
          showCheckmark
        />
      )}

      {/* Content area: toggles between floor map and keypad */}
      {showKeypad ? (
        <div className="flex-1 flex flex-col items-center pt-4">
          <h2 className="text-lg font-medium mb-1">{L.enterTable}</h2>

          {/* Display */}
          <div className="h-14 flex items-center justify-center">
            <span className="text-3xl font-light tracking-[0.2em]">
              {displayValue || (
                <span className="text-[var(--outline-variant)]">|</span>
              )}
            </span>
          </div>

          {keypadError && (
            <p className="text-xs text-[var(--error)] mb-1">
              {L.tableNotFound}
            </p>
          )}

          {/* Area prefix buttons */}
          <div className="flex gap-2 mb-4 px-4">
            {areaPrefixes.map((ap) => (
              <button
                key={ap.prefix}
                onClick={() => handleKeypadPrefix(ap.prefix)}
                className={`w-12 h-10 rounded-lg text-sm font-semibold border transition-colors ${
                  keypadPrefix === ap.prefix
                    ? "bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]"
                    : "border-[var(--outline-variant)] text-[var(--foreground)]"
                }`}
              >
                {ap.label}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="flex flex-col gap-3">
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
            ].map((row, ri) => (
              <div key={ri} className="flex gap-4 justify-center">
                {row.map((d) => (
                  <button
                    key={d}
                    onClick={() => handleKeypadDigit(d)}
                    className="w-[72px] h-[72px] rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-xl font-medium active:bg-[var(--primary-light)] transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleKeypadClear}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-sm text-[var(--outline)] active:bg-gray-100 transition-colors"
              >
                {L.refresh}
              </button>
              <button
                onClick={() => handleKeypadDigit("0")}
                className="w-[72px] h-[72px] rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-xl font-medium active:bg-[var(--primary-light)] transition-colors"
              >
                0
              </button>
              <button
                onClick={handleKeypadSelect}
                disabled={!keypadValue}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40 active:opacity-80 transition-all"
              >
                {L.select}
              </button>
            </div>
          </div>

          {/* Table status indicator */}
          {matchedTable && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: getStatusColor(matchedTable) }}
              />
              <span className="text-sm font-medium" style={{ color: getStatusColor(matchedTable) }}>
                {matchedTable.name} — {getStatusLabel(matchedTable)}
              </span>
              {matchedTable.guestCount && (
                <span className="text-sm text-[var(--outline)]">
                  · {matchedTable.guestCount} {L.guests}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          className="flex-1 overflow-hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div
            style={{
              width: MAP_W,
              height: totalCanvasH,
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              transition: pinchRef.current || panRef.current ? "none" : "transform 0.2s ease",
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
                  {areaTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => {
                        if (isDraggingRef.current) return;
                        if (table.status !== "unavailable") handleTableSelect(table);
                      }}
                      style={getTableStyle(table)}
                      className={`flex flex-col items-center justify-center active:scale-95 transition-transform ${
                        table.status === "unavailable" ? "opacity-60 cursor-default" : ""
                      }`}
                    >
                      {/* Occupied badge: color matches table state */}
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

                      {/* Checkout badge: white circle with number */}
                      {table.status === "checkout" && table.guestCount && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-black flex items-center justify-center">
                          <span className="text-[10px] font-bold leading-none text-black">
                            {table.guestCount}
                          </span>
                        </span>
                      )}

                      <span
                        className={`text-xs font-semibold ${
                          table.status === "checkout" ? "text-white" : ""
                        }`}
                      >
                        {table.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Floating toggle button - bottom right */}
      <button
        onClick={toggleView}
        className="absolute bottom-4 right-4 w-12 h-12 rounded-xl border border-[var(--outline-variant)] bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform z-20"
      >
        {showKeypad ? (
          <Map size={22} className="text-[var(--outline)]" />
        ) : (
          <Keyboard size={22} className="text-[var(--outline)]" />
        )}
      </button>
    </div>
  );
}
