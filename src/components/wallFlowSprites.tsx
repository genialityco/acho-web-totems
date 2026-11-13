import type { ReactNode } from "react";
import { CANCER, PLATELET, VIEW } from "../utils/wallFigureGeometry";
import { FLOW_SPRITE_PAD, type FlowSpriteKey } from "../utils/wallFlow";
import type { WallShape } from "../utils/wallShapes";
import { CancerBody, CancerNucleus, CancerPods, LightContent, PlateletBody, PlateletFilopodia } from "./wallFigures";

// Dibujos de los que se sacan los sprites de la corriente de células (ver utils/wallFlow.ts): WallSphere los
// monta ocultos, los serializa y los rasteriza una vez. Cada SVG lleva width/height explícitos para que,
// cargado como imagen, tenga tamaño propio y cuadrado.

const V = VIEW * FLOW_SPRITE_PAD;
const SPRITE_VIEWBOX = `${-V} ${-V} ${V * 2} ${V * 2}`;
const SVG_PX = 384;

const sprite = (key: FlowSpriteKey, content: ReactNode, viewBox = SPRITE_VIEWBOX) => (
  <svg key={key} data-sprite={key} xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} width={SVG_PX} height={SVG_PX}>
    {content}
  </svg>
);

// p: prefijo único para los id de los SVG (varios SVG en la misma página no deben compartir ids).
export function flowSpriteSources(shape: WallShape, color: string, p: string): ReactNode[] {
  const dust = sprite(
    "dust",
    <>
      <defs>
        <radialGradient id={`${p}dust`}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="35%" style={{ stopColor: `color-mix(in srgb, ${color} 40%, white)` }} />
          <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${color} 0%, transparent)` }} />
        </radialGradient>
      </defs>
      <circle r={10} fill={`url(#${p}dust)`} />
    </>,
    "-10 -10 20 20",
  );

  if (shape === "platelet") {
    return [
      sprite("body", <PlateletBody p={`${p}b`} color={color} />),
      sprite("filopodia", <PlateletFilopodia p={`${p}f`} color={color} />),
      sprite("light", <LightContent p={`${p}l`} r={PLATELET.R * 0.95} />),
      dust,
    ];
  }
  if (shape === "cancerCell") {
    return [
      sprite(
        "body",
        <>
          <CancerPods p={`${p}a`} color={color} group={0} />
          <CancerPods p={`${p}c`} color={color} group={1} />
          <CancerBody p={`${p}b`} color={color} />
          <CancerNucleus p={`${p}n`} color={color} />
        </>,
      ),
      sprite("light", <LightContent p={`${p}l`} r={CANCER.R * 0.95} />),
      dust,
    ];
  }
  if (shape === "sphere") {
    // Esfera de luz: núcleo claro desplazado (volumen) que se funde en el color elegido y se desvanece.
    return [
      sprite(
        "body",
        <>
          <defs>
            <radialGradient
              id={`${p}sph`}
              gradientUnits="userSpaceOnUse"
              cx={-VIEW + 0.38 * 2 * VIEW}
              cy={-VIEW + 0.34 * 2 * VIEW}
              r={0.905 * 2 * VIEW}
            >
              <stop offset="0%" stopColor="#fff" stopOpacity={0.85} />
              <stop offset="22%" style={{ stopColor: color }} />
              <stop offset="46%" style={{ stopColor: `color-mix(in srgb, ${color} 55%, transparent)` }} />
              <stop offset="70%" style={{ stopColor: `color-mix(in srgb, ${color} 0%, transparent)` }} />
            </radialGradient>
          </defs>
          <rect x={-VIEW} y={-VIEW} width={VIEW * 2} height={VIEW * 2} fill={`url(#${p}sph)`} opacity={0.75} />
        </>,
      ),
      dust,
    ];
  }
  // Imagen propia: el cuerpo es la imagen subida (se carga aparte); solo el polvo sale de aquí.
  return [dust];
}
