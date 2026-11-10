import { useEffect, useRef, useState } from "react";

// Actividad que encoge el banner al momento (no forma parte de un toque/clic).
const IMMEDIATE_EVENTS = ["mousemove", "keydown", "scroll"] as const;
// Tras soltar el dedo/botón, cuánto esperar para encoger el banner: lo justo para que el clic de ese
// mismo toque ya se haya entregado a su destino.
const COLLAPSE_AFTER_TAP_MS = 350;
// Los navegadores emiten eventos de mouse "de compatibilidad" (mousemove…) después de un toque; no
// cuentan como movimiento del mouse.
const TOUCH_COMPAT_WINDOW_MS = 1000;

// true hasta la primera interacción del visitante (banner grande, primera impresión);
// pasa a false en cuanto hay actividad (banner compacto) y vuelve a true tras
// idleSeconds sin más actividad — mismo patrón de eventos que useIdleTimer, pero con
// la polaridad invertida (acá "true" es el estado inicial/inactivo, no el de reposo
// tras el timeout).
//
// Un toque NO encoge el banner mientras el dedo está apoyado, sino al soltarlo: si lo hiciera en el
// touchstart (como antes), todo subía ~70px a mitad del toque y el clic caía en otro lugar — en los
// tótems, el primer toque de cada visitante no enfocaba el buscador o tocaba otro elemento.
export const useBannerExpanded = (idleSeconds: number): boolean => {
  const [expanded, setExpanded] = useState(true);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let pointerDown = false;
    let lastTouchAt = 0;

    // Toda actividad reinicia la cuenta para volver a agrandarlo.
    const armExpand = () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => setExpanded(true), idleSeconds * 1000);
    };
    const collapse = () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setExpanded(false);
      armExpand();
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true;
      if (event.pointerType === "touch") lastTouchAt = Date.now();
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      armExpand();
    };
    const onPointerUp = (event: PointerEvent) => {
      pointerDown = false;
      if (event.pointerType === "touch") lastTouchAt = Date.now();
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(collapse, COLLAPSE_AFTER_TAP_MS);
    };
    const onImmediateActivity = (event: Event) => {
      if (pointerDown) return;
      if (event.type === "mousemove" && Date.now() - lastTouchAt < TOUCH_COMPAT_WINDOW_MS) return;
      collapse();
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    IMMEDIATE_EVENTS.forEach((event) => window.addEventListener(event, onImmediateActivity, { passive: true }));
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      IMMEDIATE_EVENTS.forEach((event) => window.removeEventListener(event, onImmediateActivity));
    };
  }, [idleSeconds]);

  return expanded;
};
