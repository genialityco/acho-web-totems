import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

// Con el protector YA activo, solo una acción deliberada lo despierta — un mousemove o scroll
// incidental (temblor de la mano, ruido del sensor, un mouse que alguien roza sin querer) no
// debería cerrarlo solo; sí un click/touch/tecla real.
const WAKE_EVENTS = new Set<string>(["click", "mousedown", "keydown", "touchstart"]);

// Evento en window para forzar el estado "idle" al instante, sin esperar el timeout — ver
// triggerIdleState() y su único emisor, ScreensaverManualTrigger.
const MANUAL_TRIGGER_EVENT = "gp:trigger-idle";

// true cuando pasaron timeoutSeconds sin actividad del visitante (mouse/teclado/touch/scroll),
// o cuando se emite MANUAL_TRIGGER_EVENT (ver triggerIdleState). Con enabled=false no engancha
// listeners ni corre el timer, y siempre da false.
export const useIdleTimer = (timeoutSeconds: number, enabled: boolean): boolean => {
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) {
      isIdleRef.current = false;
      setIsIdle(false);
      return;
    }

    const armTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isIdleRef.current = true;
        setIsIdle(true);
      }, timeoutSeconds * 1000);
    };

    const handleActivity = (event: Event) => {
      if (isIdleRef.current && !WAKE_EVENTS.has(event.type)) return;
      isIdleRef.current = false;
      setIsIdle(false);
      armTimer();
    };

    const forceIdle = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isIdleRef.current = true;
      setIsIdle(true);
    };

    armTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    window.addEventListener(MANUAL_TRIGGER_EVENT, forceIdle);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      window.removeEventListener(MANUAL_TRIGGER_EVENT, forceIdle);
    };
  }, [timeoutSeconds, enabled]);

  return isIdle;
};

// Fuerza el protector de pantalla a activarse ya, sin esperar el timeout de inactividad.
export const triggerIdleState = () => window.dispatchEvent(new Event(MANUAL_TRIGGER_EVENT));
