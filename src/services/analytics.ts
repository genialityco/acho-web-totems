declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEventParams = Record<string, string | number | boolean>;

// Envía un evento custom a Google Analytics (gtag.js, cargado en index.html). No-op si
// gtag no está disponible (bloqueador de anuncios, fallo de red al cargar el script, etc.)
// para que el tracking nunca rompa la interacción real del visitante.
export const trackEvent = (name: string, params?: AnalyticsEventParams) => {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
};
