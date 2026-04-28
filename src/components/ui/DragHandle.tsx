"use client";

import { useSwipeDown } from "@/lib/useSwipeDown";

/**
 * Drawer drag handle. Tap or swipe down to dismiss.
 * Use as the first child of any bottom-sheet drawer.
 */
export default function DragHandle({ onDismiss }: { onDismiss: () => void }) {
  const swipe = useSwipeDown(onDismiss);
  return (
    <div
      {...swipe}
      onClick={onDismiss}
      className="pt-2.5 pb-1 flex justify-center cursor-pointer shrink-0"
    >
      <div className="w-9 h-1 rounded-full bg-[#CAC4D0]" />
    </div>
  );
}
