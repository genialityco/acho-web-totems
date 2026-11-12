import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { serverNow, syncServerTime } from "../services/serverTime";
import { CancerCellFigure, PlateletFigure } from "./wallFigures";
import type { WallShape } from "../utils/wallShapes";

// Fondo animado de una "pared" de tótems puestos uno al lado del otro: una sola esfera de luz que
// recorre las N pantallas como si fueran un único fondo.
//
// Sin mensajes entre tótems: la posición de la esfera es una función del tiempo (serverNow, el reloj
// común sincronizado con el servidor) sobre un lienzo virtual de N pantallas más las separaciones entre
// ellas. Cada tótem conoce su posición (?pos=N, ver useWallPosition) y dibuja solo su tramo. Así no hay
// tótem "líder", y uno que se reinicia retoma al instante en el punto correcto.

// Ancho físico de la pantalla de un tótem de 50" 16:9 en vertical (50 × 2,54 × 9/√337 ≈ 62,3 cm). Convierte
// la separación entre tótems (configurada en cm) a píxeles de esta pantalla.
const TOTEM_SCREEN_WIDTH_CM = 62.3;
// Segundos que tarda la esfera en ir de un extremo de la pared al otro y volver, por pantalla: con 4
// pantallas, una vuelta completa por minuto, a la misma velocidad aparente sin importar cuántas sean.
const SECONDS_PER_SCREEN = 15;
// Período del vaivén vertical (no múltiplo del horizontal, para que la trayectoria no se repita igual).
const VERTICAL_PERIOD_S = 23;
const RESYNC_MS = 5 * 60 * 1000;
// Tamaño de cada figura respecto al ancho de la pantalla.
const SHAPE_SIZE: Record<WallShape, number> = { sphere: 0.55, platelet: 0.42, cancerCell: 0.62, image: 0.55 };
// Giro lento de las figuras (s por vuelta), también función del reloj común: todos los tótems la ven igual.
const ROTATION_PERIOD_S = 80;
// La "plaqueta" además se inclina (aplanamiento vertical periódico), como un disco que da tumbos.
const TUMBLE_PERIOD_S = 13;

export default function WallSphere({
  position,
  screens,
  gapsCm,
  color,
  shape,
  imageUrl,
  calibrate,
  aboveScreensaver = false,
}: {
  // Posición de este tótem en la pared (1 = el de más a la izquierda).
  position: number;
  screens: number;
  // Separación (cm) de cada hueco entre pantallas, de izquierda a derecha (screens − 1 valores).
  gapsCm: number[];
  color: string;
  // Figura que recorre la pared; "image" usa imageUrl (PNG transparente subido en el panel).
  shape: WallShape;
  imageUrl: string | null;
  calibrate: boolean;
  // true mientras se ve el protector de pantalla: la capa sube por encima de él (zIndex 9999) para que la
  // figura también se vea ahí. Sin eventos de puntero, así que tocar la pantalla sigue cerrando el protector.
  // Es la misma instancia (no se vuelve a montar), así que la animación sigue sin cortes.
  aboveScreensaver?: boolean;
}) {
  const { t } = useTranslation();
  const sphereRef = useRef<HTMLDivElement>(null);

  // Reloj común: al montar y cada pocos minutos (los relojes de los equipos se desvían con el tiempo).
  useEffect(() => {
    void syncServerTime();
    const timer = setInterval(() => void syncServerTime(), RESYNC_MS);
    return () => clearInterval(timer);
  }, []);

  // Clave estable de las separaciones (el arreglo cambia de identidad en cada lectura del evento).
  const gapsKey = gapsCm.join(",");
  useEffect(() => {
    const gaps = gapsKey ? gapsKey.split(",").map(Number) : [];
    let frame = 0;
    const draw = () => {
      const sphere = sphereRef.current;
      if (sphere) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const diameter = width * SHAPE_SIZE[shape];
        const radius = diameter / 2;
        const gapsPx = gaps.map((cm) => (Math.max(0, cm) * width) / TOTEM_SCREEN_WIDTH_CM);
        const wallWidth = screens * width + gapsPx.reduce((sum, g) => sum + g, 0);
        // Borde izquierdo de este tótem en la pared: las pantallas y los huecos que tiene a su izquierda.
        const screenStart = (position - 1) * width + gapsPx.slice(0, position - 1).reduce((sum, g) => sum + g, 0);
        const now = serverNow() / 1000;

        // Horizontal: va y vuelve a lo largo de toda la pared, frenando suave en los extremos.
        const horizontalPeriod = SECONDS_PER_SCREEN * screens;
        const x = radius + (wallWidth - diameter) * (0.5 - 0.5 * Math.cos((2 * Math.PI * now) / horizontalPeriod));
        // Vertical: vaivén amplio más una ondulación menor, siempre dentro de la pantalla.
        const y =
          height *
          (0.5 +
            0.3 * Math.sin((2 * Math.PI * now) / VERTICAL_PERIOD_S) +
            0.08 * Math.sin((2 * Math.PI * now) / (VERTICAL_PERIOD_S * 0.37) + 1));

        // Tramo de este tótem: desplaza el lienzo por las pantallas (y separaciones) de su izquierda.
        const left = x - radius - screenStart;
        const top = y - radius;
        const visible = left > -diameter && left < width;
        sphere.style.width = `${diameter}px`;
        sphere.style.height = `${diameter}px`;
        // Las figuras giran (y la plaqueta se inclina); la esfera es simétrica y no lo necesita.
        const rotation = shape === "sphere" ? 0 : ((now / ROTATION_PERIOD_S) % 1) * 360;
        const tumble = shape === "platelet" ? 0.72 + 0.28 * Math.cos((2 * Math.PI * now) / TUMBLE_PERIOD_S) : 1;
        sphere.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(${rotation}deg) scale(1, ${tumble})`;
        sphere.style.visibility = visible ? "visible" : "hidden";
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [position, screens, gapsKey, shape]);

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: aboveScreensaver ? 10000 : 0, pointerEvents: "none", overflow: "hidden" }}
    >
      <div
        ref={sphereRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          willChange: "transform",
          ...(shape === "sphere"
            ? {
                borderRadius: "50%",
                // Esfera de luz: núcleo claro desplazado (volumen) que se funde en el color elegido y se desvanece.
                background: `radial-gradient(circle at 38% 34%, rgba(255, 255, 255, 0.85) 0%, ${color} 22%, color-mix(in srgb, ${color} 55%, transparent) 46%, transparent 70%)`,
                opacity: 0.6,
              }
            : { opacity: 0.85, filter: `drop-shadow(0 0 28px color-mix(in srgb, ${color} 45%, transparent))` }),
        }}
      >
        {shape === "platelet" && <PlateletFigure color={color} />}
        {shape === "cancerCell" && <CancerCellFigure color={color} />}
        {shape === "image" && imageUrl && (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
      </div>
      {calibrate && (
        // Guías para ajustar la separación entre pantallas en sitio: bordes de la pantalla y datos del tótem.
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "4px dashed rgba(255, 255, 255, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 56,
            fontWeight: 800,
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.8)",
            textAlign: "center",
          }}
        >
          {t("wall.calibrationScreen", { position, screens })}
          <br />
          {/* Separaciones a la izquierda y a la derecha de este tótem (— en los extremos de la pared). */}
          {t("wall.calibrationGaps", {
            left: position > 1 && gapsCm[position - 2] !== undefined ? `${gapsCm[position - 2]} cm` : "—",
            right: position < screens && gapsCm[position - 1] !== undefined ? `${gapsCm[position - 1]} cm` : "—",
          })}
        </div>
      )}
    </div>
  );
}
