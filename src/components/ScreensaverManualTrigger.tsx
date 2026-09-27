import { useRef } from "react";
import { triggerIdleState } from "../hooks/useIdleTimer";

const REQUIRED_TAPS = 5;
const WINDOW_MS = 3000;

// Activador manual "oculto" del protector de pantalla: una zona invisible en la esquina
// inferior izquierda que, tras varios toques seguidos, lo dispara sin esperar el timeout de
// inactividad (útil para el staff en un evento). stopPropagation en cada toque evita que
// cuenten como actividad normal para useIdleTimer/useBannerExpanded.
export default function ScreensaverManualTrigger() {
  const tapTimestamps = useRef<number[]>([]);

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const recentTaps = tapTimestamps.current.filter((t) => now - t < WINDOW_MS);
    recentTaps.push(now);
    if (recentTaps.length >= REQUIRED_TAPS) {
      tapTimestamps.current = [];
      triggerIdleState();
    } else {
      tapTimestamps.current = recentTaps;
    }
  };

  return (
    <div
      onClick={handleTap}
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: 56,
        height: 56,
        zIndex: 1000,
        cursor: "default",
      }}
    />
  );
}
