import { CANCER, PLATELET, lamellaPath, scalePath, smoothClosedPath, smoothOpenPath, spikePath, spikeTip, toDeg } from "../utils/wallFigureGeometry";

// Figuras originales para el fondo animado de la pared (WallSphere), dibujadas con SVG a partir de un
// color: escalan sin perder nitidez, se tiñen con el color configurado en el panel y no dependen de
// imágenes de terceros (con licencia). Estilo de microscopía de fluorescencia (membrana translúcida con el
// borde encendido, estructuras internas que brillan), a juego con el estilo "glass" del sitio público.
//
// Rendimiento (los tótems son un i5-4200M con gráficos Intel HD 4600 y 4 GB de RAM): estos SVG nunca se
// animan; se rasterizan UNA vez como sprites (texturas, degradados y halos incluidos) y la corriente de
// células solo copia esos sprites en un canvas (ver utils/wallFlow.ts y wallFlowSprites.tsx).
//
// Este archivo solo tiene los dibujos (componentes SVG, uno por parte de la figura); la geometría está en
// utils/wallFigureGeometry.ts.

// Variantes del color base (stopColor/fill admiten color-mix como estilo CSS).
const lighter = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, white)`;
const darker = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, black)`;
const alpha = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

// ---------- Filtros y degradados compartidos ----------

// Halo: la propia figura desenfocada debajo de ella (se pinta una vez, no se anima).
function GlowFilter({ id, std }: { id: string; std: number }) {
  return (
    <filter id={id} x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={std} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

export function BlurFilter({ id, std }: { id: string; std: number }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={std} />
    </filter>
  );
}

// Textura orgánica (ruido) sobre la membrana.
function TextureFilter({ id, frequency, strength }: { id: string; frequency: number; strength: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={3} seed={7} result="noise" />
      <feColorMatrix in="noise" type="saturate" values="0" result="gray" />
      <feComponentTransfer in="gray" result="soft">
        <feFuncA type="linear" slope={strength} />
      </feComponentTransfer>
      <feComposite in="soft" in2="SourceGraphic" operator="in" result="grain" />
      <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
    </filter>
  );
}

// Membrana translúcida: centro tenue y borde encendido (como una célula marcada vista al microscopio).
function MembraneGradient({ id, color, r }: { id: string; color: string; r: number }) {
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={r}>
      <stop offset="0%" style={{ stopColor: alpha(color, 30) }} />
      <stop offset="55%" style={{ stopColor: alpha(color, 42) }} />
      <stop offset="82%" style={{ stopColor: alpha(lighter(color, 20), 72) }} />
      <stop offset="95%" style={{ stopColor: lighter(color, 45) }} />
      <stop offset="100%" style={{ stopColor: lighter(color, 62) }} />
    </radialGradient>
  );
}

// Vesícula fluorescente: interior translúcido y anillo brillante.
function BubbleGradient({ id, color }: { id: string; color: string }) {
  return (
    <radialGradient id={id} cx="45%" cy="42%" r="55%">
      <stop offset="0%" style={{ stopColor: alpha(color, 22) }} />
      <stop offset="70%" style={{ stopColor: alpha(lighter(color, 15), 45) }} />
      <stop offset="92%" style={{ stopColor: lighter(color, 55) }} />
      <stop offset="100%" style={{ stopColor: alpha(lighter(color, 60), 0) }} />
    </radialGradient>
  );
}

// Gránulo/punto que brilla: núcleo claro que se desvanece.
function SpotGradient({ id, core, color }: { id: string; core: string; color: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0%" style={{ stopColor: core }} />
      <stop offset="45%" style={{ stopColor: color }} />
      <stop offset="100%" style={{ stopColor: alpha(color, 0) }} />
    </radialGradient>
  );
}

// Capa de luz: NO gira con la figura (la luz viene siempre de arriba a la izquierda de la pantalla), que es
// lo que hace que la figura se lea como un volumen y no como una calcomanía que da vueltas. Sin bordes
// duros: el sombreado se desvanece antes del contorno.
export function LightContent({ p, r }: { p: string; r: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${p}shade`} cx="36%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.26} />
          <stop offset="40%" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="75%" stopColor="#000" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${p}spec`}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={r} fill={`url(#${p}shade)`} />
      <ellipse
        cx={-r * 0.4}
        cy={-r * 0.44}
        rx={r * 0.34}
        ry={r * 0.15}
        fill={`url(#${p}spec)`}
        transform={`rotate(-32 ${-r * 0.4} ${-r * 0.44})`}
      />
    </>
  );
}

export function PlateletFilopodia({ p, color }: { p: string; color: string }) {
  return (
    <>
      <defs>
        <GlowFilter id={`${p}glow`} std={2.6} />
      </defs>
      <g filter={`url(#${p}glow)`} style={{ fill: lighter(color, 32) }}>
        {PLATELET.filopodia.map(({ angle, r0, len, bend, w0, branch }, i) => {
          const [bx, by] = branch ? spikeTip(r0, len * branch.at, bend) : [0, 0];
          return (
            <g key={i} transform={`rotate(${toDeg(angle)})`}>
              <path d={spikePath(r0, len, bend, w0, 0.9)} />
              {branch && (
                <path d={spikePath(0, branch.len, 0, w0 * 0.55, 0.7)} transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${branch.side * 38})`} />
              )}
            </g>
          );
        })}
      </g>
    </>
  );
}

// Canto del disco: el mismo contorno, más oscuro, un poco por detrás. Al inclinarse la plaqueta asoma como
// el grosor del disco (ver frame: translateZ negativo después de la inclinación).
export function PlateletEdge({ color }: { color: string }) {
  return (
    <path
      d={smoothClosedPath(PLATELET.outline)}
      style={{ fill: alpha(darker(color, 35), 88), stroke: alpha(lighter(color, 10), 80) }}
      strokeWidth={2}
    />
  );
}

export function PlateletBody({ p, color }: { p: string; color: string }) {
  const outline = smoothClosedPath(PLATELET.outline);
  return (
    <>
      <defs>
        <BlurFilter id={`${p}halo`} std={9} />
        <BlurFilter id={`${p}soft`} std={1.6} />
        <TextureFilter id={`${p}tex`} frequency={0.85} strength={0.3} />
        <MembraneGradient id={`${p}mem`} color={color} r={PLATELET.R * 1.06} />
        <SpotGradient id={`${p}gran`} core={lighter(color, 80)} color={lighter(color, 30)} />
        <SpotGradient id={`${p}dense`} core="#fff" color={lighter(color, 70)} />
      </defs>
      <path d={outline} style={{ fill: lighter(color, 20) }} opacity={0.5} filter={`url(#${p}halo)`} />
      <path d={outline} fill={`url(#${p}mem)`} filter={`url(#${p}tex)`} />
      {/* Anillo de microtúbulos que mantiene la forma de disco. */}
      <path
        d={smoothClosedPath(scalePath(PLATELET.outline, 0.84))}
        fill="none"
        style={{ stroke: lighter(color, 50) }}
        strokeWidth={3.5}
        opacity={0.5}
        filter={`url(#${p}soft)`}
      />
      {/* Sistema canalicular abierto. */}
      {PLATELET.canals.map((points, i) => (
        <path
          key={i}
          d={smoothOpenPath(points)}
          fill="none"
          style={{ stroke: alpha(darker(color, 30), 35) }}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ))}
      {PLATELET.granules.map(({ at, r }, i) => (
        <circle key={i} cx={at[0]} cy={at[1]} r={r} fill={`url(#${p}gran)`} />
      ))}
      {PLATELET.dense.map(({ at, r }, i) => (
        <circle key={i} cx={at[0]} cy={at[1]} r={r * 1.6} fill={`url(#${p}dense)`} />
      ))}
      <path d={outline} fill="none" style={{ stroke: lighter(color, 75) }} strokeWidth={1.4} opacity={0.9} />
    </>
  );
}

export function CancerPods({ p, color, group }: { p: string; color: string; group: number }) {
  return (
    <>
      <defs>
        <GlowFilter id={`${p}glow`} std={3} />
        <BubbleGradient id={`${p}bleb`} color={color} />
      </defs>
      <g filter={`url(#${p}glow)`}>
        {CANCER.pods
          .filter((pod) => pod.group === group)
          .map(({ angle, kind, r0, bend, len, bleb, ext, h }, i) => {
            const [tx, ty] = spikeTip(r0, len, bend);
            return (
              <g key={i} transform={`rotate(${toDeg(angle)})`}>
                {kind === "lamella" ? (
                  <path d={lamellaPath(r0, ext, h)} style={{ fill: alpha(lighter(color, 10), 45), stroke: lighter(color, 55) }} strokeWidth={1.2} />
                ) : (
                  <path
                    d={spikePath(r0, len, bend, kind === "filo" ? 3.2 : 5.5, kind === "filo" ? 0.8 : 2.2)}
                    style={{ fill: alpha(lighter(color, 25), 85) }}
                  />
                )}
                {kind === "bleb" && <circle cx={tx + bleb * 0.6} cy={ty} r={bleb} fill={`url(#${p}bleb)`} />}
              </g>
            );
          })}
      </g>
    </>
  );
}

export function CancerBody({ p, color }: { p: string; color: string }) {
  const outline = smoothClosedPath(CANCER.outline);
  return (
    <>
      <defs>
        <BlurFilter id={`${p}halo`} std={9} />
        <TextureFilter id={`${p}tex`} frequency={0.6} strength={0.35} />
        <MembraneGradient id={`${p}mem`} color={color} r={CANCER.R * 1.12} />
        <BubbleGradient id={`${p}bleb`} color={color} />
      </defs>
      <path d={outline} style={{ fill: lighter(color, 20) }} opacity={0.5} filter={`url(#${p}halo)`} />
      <path d={outline} fill={`url(#${p}mem)`} filter={`url(#${p}tex)`} />
      {CANCER.granules.map(({ at, r }, i) => (
        <circle key={i} cx={at[0]} cy={at[1]} r={r} style={{ fill: lighter(color, 55) }} opacity={0.55} />
      ))}
      {CANCER.vesicles.map(({ at, r }, i) => (
        <circle key={i} cx={at[0]} cy={at[1]} r={r} style={{ fill: alpha(color, 15), stroke: lighter(color, 55) }} strokeWidth={1.1} opacity={0.8} />
      ))}
      {CANCER.surfaceBlebs.map(({ x, y, r }, i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={`url(#${p}bleb)`} />
      ))}
      <path d={outline} fill="none" style={{ stroke: lighter(color, 75) }} strokeWidth={1.3} opacity={0.9} />
    </>
  );
}

export function CancerNucleus({ p, color }: { p: string; color: string }) {
  // El núcleo se tiñe hacia el azul (como un marcador de ADN), para que se distinga del citoplasma.
  const nc = `color-mix(in oklch, ${color} 50%, #5c7cfa)`;
  return (
    <>
      <defs>
        <radialGradient id={`${p}nuc`} cx="45%" cy="42%" r="60%">
          <stop offset="0%" style={{ stopColor: alpha(nc, 50) }} />
          <stop offset="80%" style={{ stopColor: alpha(nc, 68) }} />
          <stop offset="100%" style={{ stopColor: lighter(nc, 40) }} />
        </radialGradient>
        <TextureFilter id={`${p}chrom`} frequency={1.2} strength={0.6} />
        <SpotGradient id={`${p}nucleolus`} core="#fff" color={lighter(nc, 50)} />
      </defs>
      <path d={smoothClosedPath(CANCER.nucleus)} fill={`url(#${p}nuc)`} filter={`url(#${p}chrom)`} />
      <path d={smoothClosedPath(CANCER.nucleus)} fill="none" style={{ stroke: lighter(nc, 55) }} strokeWidth={1.4} opacity={0.85} />
      {CANCER.nucleoli.map(({ x, y, r }, i) => (
        <circle key={i} cx={x} cy={y} r={r * 1.5} fill={`url(#${p}nucleolus)`} />
      ))}
    </>
  );
}
