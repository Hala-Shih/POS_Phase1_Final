"use client";

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  actionLabel: string;
  onAction: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  masked?: boolean;
}

export default function NumPad({
  value,
  onChange,
  maxLength = 4,
  actionLabel,
  onAction,
  onRefresh,
  showRefresh = false,
  masked = false,
}: NumPadProps) {
  const handleDigit = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const display = masked ? "•".repeat(value.length) : value;

  const digitButton = (digit: string) => (
    <button
      key={digit}
      onClick={() => handleDigit(digit)}
      className="w-[72px] h-[72px] rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-xl font-medium active:bg-[var(--primary-light)] transition-colors"
    >
      {digit}
    </button>
  );

  return (
    <div className="flex flex-col items-center">
      {/* Display */}
      <div className="h-16 flex items-center justify-center">
        <span className="text-3xl font-light tracking-[0.3em]">
          {display || <span className="text-[var(--outline-variant)]">_</span>}
        </span>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex gap-4 justify-center">
          {["1", "2", "3"].map(digitButton)}
        </div>
        <div className="flex gap-4 justify-center">
          {["4", "5", "6"].map(digitButton)}
        </div>
        <div className="flex gap-4 justify-center">
          {["7", "8", "9"].map(digitButton)}
        </div>
        <div className="flex gap-4 justify-center">
          {showRefresh ? (
            <button
              onClick={onRefresh}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-sm text-[var(--outline)] active:bg-gray-100 transition-colors"
            >
              Refresh
            </button>
          ) : (
            <button
              onClick={handleBackspace}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-lg text-[var(--outline)] active:bg-gray-100 transition-colors"
            >
              ⌫
            </button>
          )}
          {digitButton("0")}
          <button
            onClick={onAction}
            disabled={!value}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-sm font-medium bg-[var(--primary)] text-white disabled:opacity-40 active:opacity-80 transition-all"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
