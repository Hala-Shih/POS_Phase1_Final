import { useRef } from "react";

/**
 * Returns props to spread on a "drag handle" element. When the user drags it
 * downward beyond the threshold (or flicks fast), `onDismiss` is called.
 * Works for touch and mouse/pointer.
 */
export function useSwipeDown(onDismiss: () => void, threshold = 60) {
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  const reset = () => {
    startY.current = null;
    startTime.current = 0;
  };

  const begin = (y: number) => {
    startY.current = y;
    startTime.current = Date.now();
  };

  const end = (y: number) => {
    if (startY.current == null) return;
    const dy = y - startY.current;
    const dt = Date.now() - startTime.current;
    const velocity = dy / Math.max(dt, 1); // px per ms
    if (dy > threshold || (dy > 20 && velocity > 0.5)) {
      onDismiss();
    }
    reset();
  };

  return {
    onTouchStart: (e: React.TouchEvent) => begin(e.touches[0].clientY),
    onTouchEnd: (e: React.TouchEvent) => end(e.changedTouches[0].clientY),
    onTouchCancel: reset,
    onPointerDown: (e: React.PointerEvent) => {
      // Only handle primary pointer; ignore touch (handled by onTouchStart)
      if (e.pointerType === "touch") return;
      begin(e.clientY);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      end(e.clientY);
    },
    onPointerCancel: reset,
    style: { touchAction: "none" as const },
  };
}
