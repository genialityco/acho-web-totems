import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

// true hasta la primera interacción del visitante (banner grande, primera impresión);
// pasa a false en cuanto hay actividad (banner compacto) y vuelve a true tras
// idleSeconds sin más actividad — mismo patrón de eventos que useIdleTimer, pero con
// la polaridad invertida (acá "true" es el estado inicial/inactivo, no el de reposo
// tras el timeout).
export const useBannerExpanded = (idleSeconds: number): boolean => {
  const [expanded, setExpanded] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleActivity = () => {
      setExpanded(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setExpanded(true), idleSeconds * 1000);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [idleSeconds]);

  return expanded;
};
