// Geometría de las figuras del fondo animado de la pared (ver components/wallFigures.tsx): datos puros,
// generados con semilla fija para que todos los tótems dibujen exactamente la misma figura.

export type Pt = [number, number];

export const VIEW = 130;
// Todas las capas de una figura comparten este lienzo (cuerpo + prolongaciones), así que se superponen.
export const FIGURE_VIEWBOX = `${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`;

// Generador pseudoaleatorio con semilla: las figuras se ven siempre igual (y en todos los tótems).
export const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export const fmt = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const toDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);

// Contorno cerrado y suave que pasa por los puntos (curvas cuadráticas entre puntos medios).
export const smoothClosedPath = (points: Pt[]) => {
  let d = `M${fmt(mid(points[points.length - 1], points[0]))}`;
  points.forEach((p, i) => {
    d += ` Q${fmt(p)} ${fmt(mid(p, points[(i + 1) % points.length]))}`;
  });
  return `${d} Z`;
};

export const smoothOpenPath = (points: Pt[]) => {
  let d = `M${fmt(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) d += ` Q${fmt(points[i])} ${fmt(mid(points[i], points[i + 1]))}`;
  return `${d} L${fmt(points[points.length - 1])}`;
};

export const scalePath = (points: Pt[], k: number, [cx, cy]: Pt = [0, 0]) =>
  points.map(([x, y]): Pt => [cx + (x - cx) * k, cy + (y - cy) * k]);

// Prolongación afinada y curva, en un marco local con el eje x hacia afuera: nace en r0 con ancho w0 y
// termina len más allá con ancho w1, desviándose según bend.
export const spikePath = (r0: number, len: number, bend: number, w0: number, w1: number) => {
  const tx = r0 + len;
  const ty = len * Math.sin(bend) * 0.5;
  const cx = r0 + len * 0.5;
  const cy = ty * 0.15;
  const wm = (w0 + w1) / 4;
  return `M${r0},${-w0 / 2} Q${cx.toFixed(1)},${(cy - wm).toFixed(1)} ${tx.toFixed(1)},${(ty - w1 / 2).toFixed(1)} L${tx.toFixed(1)},${(ty + w1 / 2).toFixed(1)} Q${cx.toFixed(1)},${(cy + wm).toFixed(1)} ${r0},${w0 / 2} Z`;
};
export const spikeTip = (r0: number, len: number, bend: number): Pt => [r0 + len, len * Math.sin(bend) * 0.5];

// Lamelipodio: lóbulo ancho y aplanado con el borde ondulado (marco local, eje x hacia afuera).
export const lamellaPath = (r0: number, ext: number, h: number) => {
  const e = r0 + ext;
  return (
    `M${r0},${-h} Q${r0 + ext * 0.5},${-h * 1.5} ${e},${-h * 0.9} Q${e + ext * 0.12},${-h * 0.3} ${e - ext * 0.05},0 ` +
    `Q${e + ext * 0.15},${h * 0.4} ${e},${h * 0.9} Q${r0 + ext * 0.5},${h * 1.5} ${r0},${h} Z`
  );
};

const TAU = Math.PI * 2;

// ---------- Plaqueta ----------
// Una plaqueta de verdad: disco pequeño e irregular (no el bicóncavo de un glóbulo rojo), con el anillo de
// microtúbulos bajo el borde, gránulos alfa y densos, canales del sistema canalicular abierto y, al
// activarse, filopodios finos que salen del borde y se vuelven a retraer.

export const PLATELET = (() => {
  const rand = seededRandom(7310);
  const R = 70;
  const [p1, p2, p3] = [rand() * 6, rand() * 6, rand() * 6];
  const radiusAt = (theta: number) =>
    R * (1 + 0.07 * Math.sin(2 * theta + p1) + 0.04 * Math.sin(3 * theta + p2) + 0.025 * Math.sin(5 * theta + p3));
  const outline = range(60).map((k): Pt => {
    const theta = (k / 60) * TAU;
    const r = radiusAt(theta);
    return [r * Math.cos(theta), r * Math.sin(theta) * 0.93];
  });
  const filopodia = range(11).map((i) => {
    const angle = (i / 11) * TAU + (rand() - 0.5) * 0.45;
    const len = 18 + rand() * 36;
    const bend = (rand() - 0.5) * 0.9;
    const w0 = 3.6 + rand() * 2.4;
    const branch = rand() < 0.35 ? { at: 0.5 + rand() * 0.2, len: len * (0.3 + rand() * 0.2), side: rand() < 0.5 ? -1 : 1 } : null;
    return { angle, r0: radiusAt(angle) * 0.86, len, bend, w0, branch };
  });
  const inside = (maxFrac: number): Pt => {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * R * maxFrac;
    return [d * Math.cos(a), d * Math.sin(a) * 0.93];
  };
  const granules = range(17).map(() => ({ at: inside(0.62), r: 2.6 + rand() * 3.2 }));
  const dense = range(5).map(() => ({ at: inside(0.55), r: 1.6 + rand() * 1.2 }));
  const canals = range(5).map(() => {
    let [x, y] = inside(0.5);
    let heading = rand() * TAU;
    return range(5).map((): Pt => {
      const point: Pt = [x, y];
      heading += (rand() - 0.5) * 1.6;
      x += Math.cos(heading) * 8;
      y += Math.sin(heading) * 8;
      return point;
    });
  });
  return { R, outline, filopodia, granules, dense, canals };
})();

// ---------- Célula cancerígena ----------
// Membrana rugosa con microvellosidades, prolongaciones variadas (filopodios largos, vesículas en la punta
// de tallos de distinto tamaño, lamelipodios), núcleo grande e irregular con nucléolos, gránulos y vesículas.

export const CANCER = (() => {
  const rand = seededRandom(20261113);
  const R = 58;
  const [a, b, c, d] = [rand() * 6, rand() * 6, rand() * 6, rand() * 6];
  const radiusAt = (theta: number) =>
    R + 4 * Math.sin(3 * theta + a) + 3 * Math.sin(5 * theta + b) + 2 * Math.sin(9 * theta + c) + 1.3 * Math.sin(17 * theta + d);
  const outline = range(90).map((k): Pt => {
    const theta = (k / 90) * TAU;
    const r = radiusAt(theta) + rand() * 0.8;
    return [r * Math.cos(theta), r * Math.sin(theta)];
  });
  const pods = range(14).map((i) => {
    const angle = (i / 14) * TAU + (rand() - 0.5) * 0.3;
    const kind: "lamella" | "filo" | "bleb" = i % 5 === 0 ? "lamella" : i % 3 === 0 ? "filo" : "bleb";
    const r0 = radiusAt(angle) * 0.8;
    const bend = (rand() - 0.5) * 1.0;
    return {
      angle,
      kind,
      r0,
      bend,
      group: i % 2,
      len: kind === "filo" ? 44 + rand() * 24 : 24 + rand() * 26,
      bleb: 5 + rand() * 9,
      ext: 18 + rand() * 8,
      h: 12 + rand() * 6,
    };
  });
  const [e, g] = [rand() * 6, rand() * 6];
  const nucleusCenter: Pt = [7, -5];
  const nucleus = range(40).map((k): Pt => {
    const theta = (k / 40) * TAU;
    const r = 27 + 3 * Math.sin(2 * theta + e) + 2 * Math.sin(4 * theta + g) + rand() * 0.6;
    return [nucleusCenter[0] + r * Math.cos(theta), nucleusCenter[1] + r * Math.sin(theta)];
  });
  const nucleoli = range(3).map(() => {
    const ang = rand() * TAU;
    const dist = 4 + rand() * 10;
    return { x: nucleusCenter[0] + dist * Math.cos(ang), y: nucleusCenter[1] + dist * Math.sin(ang), r: 3 + rand() * 2.5 };
  });
  const ring = (minFrac: number, maxFrac: number): Pt => {
    const ang = rand() * TAU;
    const dist = R * (minFrac + rand() * (maxFrac - minFrac));
    return [dist * Math.cos(ang), dist * Math.sin(ang)];
  };
  const granules = range(46).map(() => ({ at: ring(0.5, 0.88), r: 0.8 + rand() * 1.2 }));
  const vesicles = range(7).map(() => ({ at: ring(0.55, 0.8), r: 3 + rand() * 3.5 }));
  const surfaceBlebs = range(4).map(() => {
    const ang = rand() * TAU;
    const dist = radiusAt(ang) * 0.93;
    return { x: dist * Math.cos(ang), y: dist * Math.sin(ang), r: 6 + rand() * 5 };
  });
  return { R, outline, pods, nucleus, nucleoli, granules, vesicles, surfaceBlebs };
})();

