import { RefObject, useCallback, useEffect, useState } from "react";

// Pantalla completa de un elemento. Usa la Fullscreen API nativa cuando existe; en los
// navegadores que no la soportan para elementos (ej. Safari en iPhone) cae a una capa fija
// que cubre el viewport: `isOverlay` es true en ese caso y quien lo use debe darle ese estilo
// (position: fixed; inset: 0). En modo nativo el navegador se encarga del estilo.
export function useElementFullscreen(ref: RefObject<HTMLElement>) {
  const [isNative, setIsNative] = useState(false);
  const [isOverlay, setIsOverlay] = useState(false);

  // Sincroniza el estado cuando el navegador entra/sale por su cuenta (ej. tecla Esc).
  useEffect(() => {
    const handleChange = () => setIsNative(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [ref]);

  // Si el componente se desmonta en pantalla completa nativa (ej. navegación con el botón
  // atrás), se sale para no dejar la página siguiente atrapada en ese modo.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen();
    },
    []
  );

  // Modo capa: sin scroll de fondo y con Esc para salir (con el foco dentro del iframe el Esc
  // no llega a window, por eso el botón de salir siempre queda visible).
  useEffect(() => {
    if (!isOverlay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOverlay(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlay]);

  const toggle = useCallback(async () => {
    if (isNative) {
      await document.exitFullscreen();
      return;
    }
    if (isOverlay) {
      setIsOverlay(false);
      return;
    }
    const element = ref.current;
    if (!element) return;
    if (document.fullscreenEnabled && element.requestFullscreen) {
      try {
        await element.requestFullscreen();
        return;
      } catch {
        // El navegador lo rechazó: se usa la capa como respaldo.
      }
    }
    setIsOverlay(true);
  }, [isNative, isOverlay, ref]);

  return { isFullscreen: isNative || isOverlay, isOverlay, toggle };
}
