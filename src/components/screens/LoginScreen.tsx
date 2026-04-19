"use client";

import { useState } from "react";
import NumPad from "@/components/ui/NumPad";
import { useOrderStore } from "@/store/order-store";
import staffData from "@/data/staff.json";
import { Staff } from "@/lib/types";

export default function LoginScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const { setStaff, setScreen } = useOrderStore();

  const handleLogin = () => {
    const staff = (staffData as Staff[]).find((s) => s.pin === pin);
    if (staff) {
      setStaff(staff);
      setError(false);
      setScreen("home");
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <h1 className="text-lg font-medium text-[var(--foreground)] mb-2">
        Enter pin
      </h1>

      {error && (
        <p className="text-sm text-[var(--error)] mb-2">Invalid PIN. Try again.</p>
      )}

      <NumPad
        value={pin}
        onChange={(v) => {
          setPin(v);
          setError(false);
        }}
        maxLength={4}
        actionLabel="Login"
        onAction={handleLogin}
        showRefresh={true}
        onRefresh={() => setPin("")}
      />
    </div>
  );
}
