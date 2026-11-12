import { useState } from "react";

const STORAGE_KEY = "gp:wallPosition";
const MAX_SCREENS = 12;

// Posición de este tótem en la pared (1 = el de más a la izquierda), para el fondo animado (WallSphere).
// Se configura una vez en el acceso directo del quiosco con ?pos=N y se guarda en el navegador: al navegar
// entre pósters la URL pierde el parámetro, y el tótem debe seguir sabiendo quién es. ?pos=0 lo borra.
// ?calibrar=1 (solo mientras esté en la URL) muestra las guías para ajustar la separación entre pantallas.
export function useWallPosition(): { position: number | null; calibrate: boolean } {
  const [state] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("pos");
    let stored: string | null = null;
    try {
      if (raw !== null) {
        const n = Number.parseInt(raw, 10);
        if (n >= 1 && n <= MAX_SCREENS) localStorage.setItem(STORAGE_KEY, String(n));
        else localStorage.removeItem(STORAGE_KEY);
      }
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): se usa solo el parámetro de esta carga.
      stored = raw;
    }
    const position = Number.parseInt(stored ?? "", 10);
    return {
      position: position >= 1 && position <= MAX_SCREENS ? position : null,
      calibrate: params.get("calibrar") === "1",
    };
  });
  return state;
}
