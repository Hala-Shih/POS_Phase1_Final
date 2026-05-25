"use client";

import { useState } from "react";
import Header from "@/components/ui/Header";
import NumPad from "@/components/ui/NumPad";
import { useOrderStore } from "@/store/order-store";
import staffData from "@/data/staff.json";
import type { Staff } from "@/lib/types";

export default function GuestCountScreen() {
  const [count, setCount] = useState("");
  const { currentStaff, setStaff, selectedTable, setGuestCount, setScreen, language } = useOrderStore();

  const L = language === "zh"
    ? { enterGuestCount: "輸入人數", save: "儲存" }
    : { enterGuestCount: "Enter guest count", save: "Save" };

  const handleSave = () => {
    const num = parseInt(count, 10);
    if (num > 0) {
      setGuestCount(num);
      setScreen("check");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        onBack={() => setScreen("tables")}
        serverName={currentStaff?.name}
        tableName={selectedTable?.name}
        onTransfer={(staff) => setStaff(staff)}
        staffList={staffData as Staff[]}
        currentStaffId={currentStaff?.id}
      />

      <div className="flex-1 flex flex-col items-center justify-center">
        <svg width="48" height="48" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-1">
          <path d="M13.3334 14V12.6667C13.3334 11.9594 13.0524 11.2811 12.5523 10.781C12.0522 10.281 11.3739 10 10.6667 10H5.33335C4.62611 10 3.94783 10.281 3.44774 10.781C2.94764 11.2811 2.66669 11.9594 2.66669 12.6667V14M10.6667 4.66667C10.6667 6.13943 9.47278 7.33333 8.00002 7.33333C6.52726 7.33333 5.33335 6.13943 5.33335 4.66667C5.33335 3.19391 6.52726 2 8.00002 2C9.47278 2 10.6667 3.19391 10.6667 4.66667Z" stroke="#1E1E1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1 className="text-lg font-medium text-[var(--foreground)] mb-2">
          {L.enterGuestCount}
        </h1>

        <NumPad
          value={count}
          onChange={setCount}
          maxLength={3}
          actionLabel={L.save}
          onAction={handleSave}
          showRefresh={true}
          onRefresh={() => setCount("")}
        />
      </div>
    </div>
  );
}
