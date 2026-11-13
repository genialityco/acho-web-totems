// Margen para que llegue el click del toque (un toque largo tarda más).
const SWALLOW_CLICK_MS = 1000;

// Para elementos que desaparecen en el pointerdown/touchstart (el protector de pantalla al despertar, el
// teclado en pantalla al tocar "Listo"): el click de ese mismo toque, que llega al levantar el dedo, ya
// cae sobre lo que hay debajo (ej. una tarjeta de póster) y lo abre sin querer. stopPropagation en el
// elemento no alcanza: cuando llega el click ya no existe. Se descarta ese click en la fase de captura de
// window, antes de que llegue a React o a un enlace; si no llega (ej. el toque fue un arrastre), el
// listener se retira solo.
export function swallowNextClick() {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };
  const timer = setTimeout(() => cleanup(), SWALLOW_CLICK_MS);
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener("click", swallow, true);
  };
  window.addEventListener("click", swallow, true);
}
