import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

// Evento en window para forzar el estado "idle" al instante, sin esperar el timeout — ver
// triggerIdleState() y su único emisor, ScreensaverManualTrigger.
const MANUAL_TRIGGER_EVENT = "gp:trigger-idle";

// true cuando pasaron timeoutSeconds sin actividad del visitante (mouse/teclado/touch/scroll),
// o cuando se emite MANUAL_TRIGGER_EVENT (ver triggerIdleState). Con enabled=false no engancha
// listeners ni corre el timer, y siempre da false.
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

    const forceIdle = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsIdle(true);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    window.addEventListener(MANUAL_TRIGGER_EVENT, forceIdle);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener(MANUAL_TRIGGER_EVENT, forceIdle);
    };
  }, [timeoutSeconds, enabled]);

  return isIdle;
};

// Fuerza el protector de pantalla a activarse ya, sin esperar el timeout de inactividad.
export const triggerIdleState = () => window.dispatchEvent(new Event(MANUAL_TRIGGER_EVENT));
