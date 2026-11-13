import { useEffect, useId, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { serverNow, syncServerTime } from "../services/serverTime";
import { flowSpriteSources } from "./wallFlowSprites";
import {
  TOTEM_SCREEN_WIDTH_CM,
  buildFlowSprites,
  drawFlow,
  makeFlow,
  type FlowSpriteKey,
  type FlowSprites,
} from "../utils/wallFlow";
import type { WallShape } from "../utils/wallShapes";

// Fondo animado de una "pared" de tótems puestos uno al lado del otro: una corriente de células (o esferas,
// o la imagen propia) que cruza las N pantallas de izquierda a derecha como si fueran un único fondo, a
// distintas profundidades. Lógica y dibujo en utils/wallFlow.ts.
//
// Sin mensajes entre tótems: las posiciones son una función del tiempo (serverNow, el reloj común
// sincronizado con el servidor) sobre un lienzo virtual de N pantallas más las separaciones entre ellas.
// Cada tótem conoce su posición (?pos=N, ver useWallPosition) y dibuja solo su tramo. Así no hay tótem
// "líder", y uno que se reinicia retoma al instante en el punto correcto.

const RESYNC_MS = 5 * 60 * 1000;
// Resolución máxima del lienzo (en pantallas de alta densidad no vale la pena pagar más píxeles).
const MAX_DPR = 1.5;

// Modo reducido automático: si tras el arranque el navegador no sostiene FPS_MIN cuadros por segundo en
// FPS_BAD_WINDOWS ventanas seguidas de FPS_WINDOW_S segundos, se dibuja la mitad de las células y sin polvo
// (hasta recargar la página).
const FPS_WARMUP_S = 10;
const FPS_WINDOW_S = 5;
const FPS_MIN = 40;
const FPS_BAD_WINDOWS = 2;

export default function WallSphere({
  position,
  screens,
  gapsCm,
  color,
  shape,
  imageUrl,
  calibrate,
  showFps = false,
  aboveScreensaver = false,
}: {
  // Posición de este tótem en la pared (1 = el de más a la izquierda).
  position: number;
  screens: number;
  // Separación (cm) de cada hueco entre pantallas, de izquierda a derecha (screens − 1 valores).
  gapsCm: number[];
  color: string;
  // Figura de la corriente; "image" usa imageUrl (PNG transparente subido en el panel).
  shape: WallShape;
  imageUrl: string | null;
  calibrate: boolean;
  // Medidor de cuadros por segundo (?fps=1 en la URL del tótem), para comprobar el rendimiento en sitio.
  showFps?: boolean;
  // true mientras se ve el protector de pantalla: la capa sube por encima de él (zIndex 9999) para que las
  // células también se vean ahí (solo las cercanas). Sin eventos de puntero, así que tocar la pantalla sigue
  // cerrando el protector. Es la misma instancia (no se vuelve a montar), así que la animación sigue sin cortes.
  aboveScreensaver?: boolean;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<FlowSprites | null>(null);
  const reducedRef = useRef(false);
  const fpsRef = useRef<HTMLDivElement>(null);

  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sources = useMemo(() => flowSpriteSources(shape, color, `${idPrefix}s`), [shape, color, idPrefix]);
  const flow = useMemo(() => makeFlow(screens), [screens]);

  // Reloj común: al montar y cada pocos minutos (los relojes de los equipos se desvían con el tiempo).
  useEffect(() => {
    void syncServerTime();
    const timer = setInterval(() => void syncServerTime(), RESYNC_MS);
    return () => clearInterval(timer);
  }, []);

  // Sprites: los dibujos ocultos (ya montados) se serializan y se rasterizan una vez por figura/color/imagen.
  useEffect(() => {
    let cancelled = false;
    spritesRef.current = null;
    const markups: Partial<Record<FlowSpriteKey, string>> = {};
    const serializer = new XMLSerializer();
    sourcesRef.current?.querySelectorAll<SVGSVGElement>("svg[data-sprite]").forEach((svg) => {
      markups[svg.dataset.sprite as FlowSpriteKey] = serializer.serializeToString(svg);
    });
    buildFlowSprites(markups, shape === "image" ? imageUrl : null)
      .then((sprites) => {
        if (!cancelled) spritesRef.current = sprites;
      })
      .catch(() => {
        // Imagen que no carga: no se dibuja nada (el resto del sitio sigue igual).
      });
    return () => {
      cancelled = true;
    };
  }, [sources, shape, imageUrl]);

  // Clave estable de las separaciones (el arreglo cambia de identidad en cada lectura del evento).
  const gapsKey = gapsCm.join(",");
  useEffect(() => {
    const gaps = gapsKey ? gapsKey.split(",").map(Number) : [];
    let frame = 0;
    // Medición de cuadros por segundo (medidor y modo reducido).
    const startedAt = performance.now();
    let secondStart = startedAt;
    let secondFrames = 0;
    let windowStart = startedAt;
    let windowFrames = 0;
    let badWindows = 0;
    const measure = () => {
      const nowMs = performance.now();
      secondFrames++;
      windowFrames++;
      if (nowMs - secondStart >= 1000) {
        const fps = Math.round((secondFrames * 1000) / (nowMs - secondStart));
        if (fpsRef.current) fpsRef.current.textContent = t(reducedRef.current ? "wall.fpsReduced" : "wall.fpsFull", { fps });
        secondStart = nowMs;
        secondFrames = 0;
      }
      if (nowMs - startedAt < FPS_WARMUP_S * 1000) {
        windowStart = nowMs;
        windowFrames = 0;
      } else if (nowMs - windowStart >= FPS_WINDOW_S * 1000) {
        const fps = (windowFrames * 1000) / (nowMs - windowStart);
        badWindows = fps < FPS_MIN ? badWindows + 1 : 0;
        if (badWindows >= FPS_BAD_WINDOWS) reducedRef.current = true;
        windowStart = nowMs;
        windowFrames = 0;
      }
    };
    const draw = () => {
      measure();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const sprites = spritesRef.current;
      if (canvas && ctx && sprites) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const pixelWidth = Math.round(width * dpr);
        const pixelHeight = Math.round(height * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const gapsPx = gaps.map((cm) => (Math.max(0, cm) * width) / TOTEM_SCREEN_WIDTH_CM);
        drawFlow(ctx, sprites, flow, {
          t: serverNow() / 1000,
          width,
          height,
          // Borde izquierdo de este tótem en la pared: las pantallas y los huecos que tiene a su izquierda.
          screenStart: (position - 1) * width + gapsPx.slice(0, position - 1).reduce((sum, g) => sum + g, 0),
          wallWidth: screens * width + gapsPx.reduce((sum, g) => sum + g, 0),
          shape,
          reduced: reducedRef.current,
          sparse: aboveScreensaver,
        });
      } else if (canvas && ctx) {
        // Sprites de otra figura/color en preparación: no dejar el último cuadro congelado.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [position, screens, gapsKey, shape, flow, aboveScreensaver, t]);

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: aboveScreensaver ? 10000 : 0, pointerEvents: "none", overflow: "hidden" }}
    >
      {/* Dibujos de los que salen los sprites; nunca se muestran. */}
      <div ref={sourcesRef} style={{ display: "none" }}>
        {sources}
      </div>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.92 }} />
      {showFps && (
        <div
          ref={fpsRef}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            font: "600 22px monospace",
          }}
        />
      )}
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
