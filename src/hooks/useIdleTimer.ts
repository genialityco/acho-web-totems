import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

// true cuando pasaron timeoutSeconds sin actividad del visitante (mouse/teclado/touch/scroll).
// Con enabled=false no engancha listeners ni corre el timer, y siempre da false.
export const useIdleTimer = (timeoutSeconds: number, enabled: boolean): boolean => {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) {
      setIsIdle(false);
      return;
    }

    const resetTimer = () => {
      setIsIdle(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsIdle(true), timeoutSeconds * 1000);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutSeconds, enabled]);

  return isIdle;
};
