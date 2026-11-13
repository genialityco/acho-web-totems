import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const STORAGE_KEY = "gp:wallPosition";
const MAX_SCREENS = 12;

// Posición de este tótem en la pared (1 = el de más a la izquierda), para el fondo animado (WallSphere).
// Se configura una vez en el acceso directo del quiosco con ?pos=N y se guarda en el navegador. ?pos=0 lo
// borra. ?calibrar=1 muestra las guías para ajustar la separación entre pantallas y ?fps=1 un medidor de
// cuadros por segundo (rendimiento del fondo animado).
//
// Los enlaces internos (tarjeta → póster, "Volver", anterior/siguiente…) arman rutas sin query, así que al
// navegar la URL perdía ?pos (y ?calibrar/?fps). Aunque la posición siga en memoria y en localStorage, la URL es
// la fuente fiable: localStorage es uno solo por origen (varias pestañas/ventanas con distinto ?pos en el
// mismo equipo se pisan entre sí) y el modo quiosco de Edge (InPrivate) lo borra al reiniciar la sesión.
// Por eso, tras cada navegación, si a la URL le falta el parámetro se vuelve a poner (replace, sin sumar
// entradas al historial). Se hace aquí, en un solo sitio, para que cubra cualquier enlace actual o futuro.
export function useWallPosition(): { position: number | null; calibrate: boolean; showFps: boolean } {
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
    // El parámetro de la URL manda sobre lo guardado (que otra pestaña pudo cambiar).
    const fromUrl = Number.parseInt(raw ?? "", 10);
    const position = fromUrl >= 1 && fromUrl <= MAX_SCREENS ? fromUrl : Number.parseInt(stored ?? "", 10);
    return {
      position: position >= 1 && position <= MAX_SCREENS ? position : null,
      calibrate: params.get("calibrar") === "1",
      showFps: params.get("fps") === "1",
    };
  });

  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (state.position === null) return;
    const params = new URLSearchParams(location.search);
    const missingPos = params.get("pos") !== String(state.position);
    const missingCalibrate = state.calibrate && params.get("calibrar") !== "1";
    const missingFps = state.showFps && params.get("fps") !== "1";
    if (!missingPos && !missingCalibrate && !missingFps) return;
    params.set("pos", String(state.position));
    if (state.calibrate) params.set("calibrar", "1");
    if (state.showFps) params.set("fps", "1");
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}`, hash: location.hash },
      { replace: true, state: location.state },
    );
  }, [location, navigate, state]);

  return state;
}
