export type AppPlatform = "android" | "ios" | "other";

// Sistema del dispositivo que abrió el enlace de la app (página /<evento>/app, a la que lleva el QR).
// iPadOS se presenta como "Macintosh" en Safari: se distingue de una Mac por la pantalla táctil.
export const detectAppPlatform = (): AppPlatform => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
};

// Enlace que codifica el QR: una página del propio sitio que redirige a la tienda según el dispositivo.
// Así un solo QR sirve para Android y iOS, y no cambia aunque cambien los enlaces de las tiendas.
export const appLinkUrl = (eventSlug: string) => `${window.location.origin}/${eventSlug}/app`;
