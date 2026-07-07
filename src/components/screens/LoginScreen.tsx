"use client";

import { useState } from "react";
import { Globe, Settings } from "lucide-react";
import NumPad from "@/components/ui/NumPad";
import { useOrderStore } from "@/store/order-store";
import staffData from "@/data/staff.json";
import { Staff } from "@/lib/types";

export default function LoginScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const { setStaff, setScreen, language, toggleLanguage } = useOrderStore();
  const settingsLabel = language === "zh" ? "設定" : "Settings";

  const handleSettingsClick = () => {
    // Reserved for future settings flow.
  };

  const handleLogin = () => {
    const staff = (staffData as Staff[]).find((s) => s.pin === pin);
    if (staff) {
      setStaff(staff);
      setError(false);
      setScreen("tables");
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="relative h-full">
      <div className="absolute left-4 top-4 z-10">
        <button
          onClick={toggleLanguage}
          className="box-border flex flex-row items-center gap-[11px] w-[95px] min-w-[95px] h-11 px-3 py-3 bg-white border border-[#D9D9D9] rounded-[21px] active:bg-gray-100 transition-colors"
        >
          <Globe size={20} className="text-[#1E1E1E] shrink-0" />
          <span className="text-base leading-6 tracking-[0.15px] font-medium text-black">{language === "zh" ? "EN" : "中文"}</span>
        </button>
      </div>

      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={handleSettingsClick}
          aria-label={settingsLabel}
          title={settingsLabel}
          className="box-border flex items-center justify-center w-11 h-11 bg-white border border-[#D9D9D9] rounded-full active:bg-gray-100 transition-colors"
        >
          <Settings size={20} className="text-[#1E1E1E]" />
        </button>
      </div>

      <div className="h-full flex flex-col items-center justify-center">
        <h1 className="text-lg font-medium text-[var(--foreground)] mb-2">
          {language === "zh" ? "輸入PIN碼" : "Enter pin"}
        </h1>

        {error && (
          <p className="text-sm text-[var(--error)] mb-2">{language === "zh" ? "PIN碼錯誤，請再試一次。" : "Invalid PIN. Try again."}</p>
        )}

        <NumPad
          value={pin}
          onChange={(v) => {
            setPin(v);
            setError(false);
          }}
          maxLength={4}
          actionLabel={language === "zh" ? "登入" : "Login"}
          onAction={handleLogin}
          showRefresh={true}
          onRefresh={() => setPin(pin.slice(0, -1))}
        />
      </div>
    </div>
  );
}
