import { useId } from "react";

// Figuras originales para el fondo animado de la pared (WallSphere), dibujadas con SVG a partir de un
// color: escalan a cualquier tamaño sin perder nitidez, se tiñen con el color configurado en el panel y
// no dependen de imágenes de terceros (con licencia). Inspiradas en las referencias del congreso: una
// "plaqueta" en forma de disco con el centro hundido (hematología) y una célula cancerígena con
// prolongaciones terminadas en vesículas (oncología).

// Variantes del color base para dar volumen (stopColor admite color-mix como estilo CSS).
const lighter = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, white)`;
const darker = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, black)`;

// Generador pseudoaleatorio con semilla: la célula se ve siempre igual (y en todos los tótems).
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Contorno cerrado y suave que pasa por los puntos (curvas cuadráticas entre puntos medios).
const smoothClosedPath = (points: Array<[number, number]>) => {
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[points.length - 1], points[0]);
  let d = `M${start[0].toFixed(1)},${start[1].toFixed(1)}`;
  points.forEach((p, i) => {
    const m = mid(p, points[(i + 1) % points.length]);
    d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  });
  return `${d} Z`;
};

// Textura orgánica sutil (ruido) que se aplica sobre el cuerpo de la figura.
function TextureFilter({ id, frequency }: { id: string; frequency: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={3} seed={7} result="noise" />
      <feColorMatrix in="noise" type="saturate" values="0" result="gray" />
      <feComponentTransfer in="gray" result="soft">
        <feFuncA type="linear" slope={0.35} />
      </feComponentTransfer>
      <feComposite in="soft" in2="SourceGraphic" operator="in" result="grain" />
      <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
    </filter>
  );
}

// Disco con borde engrosado y centro hundido, brillo especular y textura.
export function PlateletFigure({ color }: { color: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={`${id}body`} cx="48%" cy="46%" r="58%">
          <stop offset="0%" style={{ stopColor: darker(color, 45) }} />
          <stop offset="30%" style={{ stopColor: color }} />
          <stop offset="64%" style={{ stopColor: lighter(color, 22) }} />
          <stop offset="84%" style={{ stopColor: color }} />
          <stop offset="100%" style={{ stopColor: darker(color, 50) }} />
        </radialGradient>
        <radialGradient id={`${id}shine`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <filter id={`${id}blur`}>
          <feGaussianBlur stdDeviation={6} />
        </filter>
        <TextureFilter id={`${id}tex`} frequency={0.9} />
      </defs>
      <g transform="rotate(-18 100 100)">
        <ellipse cx={100} cy={100} rx={86} ry={74} fill={`url(#${id}body)`} filter={`url(#${id}tex)`} />
        {/* Centro hundido: sombra difusa algo desplazada hacia abajo a la derecha. */}
        <ellipse cx={104} cy={106} rx={38} ry={30} style={{ fill: darker(color, 55) }} opacity={0.45} filter={`url(#${id}blur)`} />
        {/* Brillo del borde superior y reflejo especular. */}
        <path d="M30,92 A72,62 0 0 1 150,40" fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={66} cy={64} rx={30} ry={14} fill={`url(#${id}shine)`} transform="rotate(-28 66 64)" />
      </g>
    </svg>
  );
}

// Cuerpo rugoso con microvellosidades, vesículas en la superficie y prolongaciones con una vesícula
// en la punta. Geometría procedural con semilla fija.
export function CancerCellFigure({ color }: { color: string }) {
  const id = useId().replace(/:/g, "");
  const rand = seededRandom(20261113);

  const pods = Array.from({ length: 11 }, (_, i) => {
    const angle = (i / 11) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const length = 78 + rand() * 24;
    const bleb = 13 + rand() * 6;
    return { angle, length, bleb };
  });
  const microvilli = Array.from({ length: 34 }, () => {
    const angle = rand() * Math.PI * 2;
    return { angle, length: 7 + rand() * 9, width: 2 + rand() * 1.5 };
  });
  const phaseA = rand() * 6;
  const phaseB = rand() * 6;
  const phaseC = rand() * 6;
  const bodyPoints = Array.from({ length: 64 }, (_, k): [number, number] => {
    const theta = (k / 64) * Math.PI * 2;
    const r =
      56 + 4 * Math.sin(3 * theta + phaseA) + 3 * Math.sin(5 * theta + phaseB) + 2 * Math.sin(9 * theta + phaseC) + rand() * 1.6;
    return [r * Math.cos(theta), r * Math.sin(theta)];
  });
  const bumps = Array.from({ length: 34 }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 46;
    return { x: d * Math.cos(a), y: d * Math.sin(a), r: 2 + rand() * 5 };
  });
  const surfaceBlebs = [
    { x: -6, y: -12, r: 17 },
    { x: 26, y: 22, r: 15 },
    { x: -28, y: 26, r: 12 },
  ];

  return (
    <svg viewBox="-125 -125 250 250" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        {/* Cuerpo: luz arriba a la izquierda y borde en sombra, para que se lea como un volumen. */}
        <radialGradient id={`${id}body`} cx="38%" cy="34%" r="72%">
          <stop offset="0%" style={{ stopColor: lighter(color, 42) }} />
          <stop offset="32%" style={{ stopColor: color }} />
          <stop offset="72%" style={{ stopColor: darker(color, 28) }} />
          <stop offset="100%" style={{ stopColor: darker(color, 58) }} />
        </radialGradient>
        <radialGradient id={`${id}bleb`} cx="38%" cy="34%" r="66%">
          <stop offset="0%" style={{ stopColor: lighter(color, 70) }} />
          <stop offset="38%" style={{ stopColor: lighter(color, 30) }} />
          <stop offset="82%" style={{ stopColor: color }} />
          <stop offset="100%" style={{ stopColor: darker(color, 45) }} />
        </radialGradient>
        <linearGradient id={`${id}stalk`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" style={{ stopColor: darker(color, 45) }} />
          <stop offset="100%" style={{ stopColor: darker(color, 10) }} />
        </linearGradient>
        <TextureFilter id={`${id}tex`} frequency={0.55} />
      </defs>

      {/* Prolongaciones (detrás del cuerpo): tallo que se afina y vesícula en la punta. */}
      {pods.map(({ angle, length, bleb }, i) => {
        const deg = (angle * 180) / Math.PI;
        return (
          <g key={i} transform={`rotate(${deg.toFixed(1)})`}>
            <path d={`M40,-5 L${length - bleb * 0.6},-1.8 L${length - bleb * 0.6},1.8 L40,5 Z`} fill={`url(#${id}stalk)`} />
            <circle cx={length} cy={0} r={bleb} fill={`url(#${id}bleb)`} filter={`url(#${id}tex)`} />
          </g>
        );
      })}

      {/* Microvellosidades: espículas cortas que asoman del borde. */}
      {microvilli.map(({ angle, length, width }, i) => {
        const deg = (angle * 180) / Math.PI;
        return (
          <rect
            key={i}
            x={50}
            y={-width / 2}
            width={length + 6}
            height={width}
            rx={width / 2}
            transform={`rotate(${deg.toFixed(1)})`}
            style={{ fill: darker(color, 15) }}
          />
        );
      })}

      {/* Cuerpo rugoso con textura, relieve y vesículas en la superficie. */}
      <path
        d={smoothClosedPath(bodyPoints)}
        fill={`url(#${id}body)`}
        filter={`url(#${id}tex)`}
        style={{ stroke: darker(color, 55) }}
        strokeOpacity={0.5}
        strokeWidth={1.2}
      />
      {bumps.map(({ x, y, r }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          style={{ fill: lighter(color, 40), stroke: darker(color, 45) }}
          fillOpacity={0.35}
          strokeOpacity={0.45}
          strokeWidth={0.8}
        />
      ))}
      {surfaceBlebs.map(({ x, y, r }, i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={`url(#${id}bleb)`} filter={`url(#${id}tex)`} />
      ))}
    </svg>
  );
}
