import { seededRandom } from "./wallFigureGeometry";
import type { WallShape } from "./wallShapes";

// Corriente de células que cruza la pared de tótems de izquierda a derecha, "llevadas por el viento":
// entran por el borde izquierdo del tótem 1 y salen por el derecho del último. Todo es función del reloj
// común (t, segundos de serverNow) y de datos generados con semilla fija, así que todos los tótems calculan
// exactamente las mismas posiciones y cada uno dibuja solo su tramo.
//
// Rendimiento (i5-4200M, Intel HD 4600, 4 GB): un solo <canvas> 2D. Cada figura se rasteriza UNA vez como
// "sprite" (con sus texturas, halos y el desenfoque de profundidad ya aplicados) y en cada cuadro solo se
// copian esos sprites con drawImage (posición, giro, escala, transparencia): unas pocas decenas de copias
// por cuadro, sin filtros ni trazados en vivo.

const TAU = Math.PI * 2;

// Ancho físico de la pantalla de un tótem de 50" 16:9 en vertical (50 × 2,54 × 9/√337 ≈ 62,3 cm). Convierte
// la separación entre tótems (configurada en cm) a píxeles de esta pantalla.
export const TOTEM_SCREEN_WIDTH_CM = 62.3;

// Los sprites llevan un margen alrededor de la figura para que el desenfoque no quede cortado: el lienzo
// de la figura (viewBox de wallFigures) ocupa 1/FLOW_SPRITE_PAD del lado del sprite.
export const FLOW_SPRITE_PAD = 1.3;
const SHARP_SPRITE_PX = 384;
const BLURRED_SPRITE_PX = 192;
// Niveles de desenfoque (0 = nítido): desenfoque por nivel, como fracción del lado del sprite.
const BLUR_LEVELS = 4;
const BLUR_PER_LEVEL = 0.012;
// Profundidad enfocada: las células a esta profundidad se ven nítidas; las más cercanas y las más lejanas,
// desenfocadas (profundidad de campo, como en un microscopio o una cámara).
const FOCUS_DEPTH = 0.55;

// Densidad de la corriente, por pantalla de la pared.
const CELLS_PER_SCREEN = 11;
const DUST_PER_SCREEN = 18;
// Lado del lienzo de la figura de la célula más cercana, respecto al ancho de la pantalla (las lejanas
// bajan hasta el 16 % de eso).
const SHAPE_SIZE: Record<WallShape, number> = { sphere: 0.5, platelet: 0.44, cancerCell: 0.55, image: 0.45 };
// Velocidad horizontal (anchos de pantalla por segundo): las lejanas más lentas (paralaje).
const SPEED_FAR = 0.045;
const SPEED_NEAR = 0.2;
// Ciclo de activación de las plaquetas (sacan y retraen los filopodios), desfasado en cada una.
const ACTIVATION_PERIOD_S = 36;

export type FlowSpriteKey = "body" | "filopodia" | "light" | "dust";

type FlowCell = {
  z: number; // profundidad: 0 = lejos, 1 = cerca
  x0: number;
  y0: number;
  phase: number;
  phase2: number;
  tumbleRate: number;
  tumblePhase: number;
  spin: number;
  spin0: number;
  activationOffset: number;
  // Se sigue dibujando en modo reducido (la mitad de las células).
  essential: boolean;
};

type FlowDust = { x0: number; y0: number; speed: number; size: number; phase: number; alpha: number };

export type Flow = { cells: FlowCell[]; dust: FlowDust[] };

export function makeFlow(screens: number): Flow {
  const rnd = seededRandom(20261113);
  const cells: FlowCell[] = Array.from({ length: CELLS_PER_SCREEN * screens }, (_, i) => ({
    // Más células lejanas (pequeñas) que cercanas.
    z: Math.pow(rnd(), 1.3),
    x0: rnd(),
    y0: 0.05 + rnd() * 0.9,
    phase: rnd() * TAU,
    phase2: rnd() * TAU,
    tumbleRate: 0.2 + rnd() * 0.4,
    tumblePhase: rnd() * TAU,
    spin: (rnd() - 0.5) * 0.5,
    spin0: rnd() * TAU,
    activationOffset: rnd() * ACTIVATION_PERIOD_S,
    essential: i % 2 === 0,
  }));
  // De atrás hacia adelante.
  cells.sort((a, b) => a.z - b.z);
  // Reparto parejo: con x0 al azar, células de profundidad (y velocidad) parecida podían ir juntas para
  // siempre y dejar pantallas vacías. En orden de profundidad, x0 sigue una secuencia de baja discrepancia
  // (razón áurea) y y0 otra (√2): las vecinas en velocidad quedan lejos entre sí, en x y en altura.
  cells.forEach((c, i) => {
    c.x0 = (0.37 + i * 0.6180339887) % 1;
    c.y0 = 0.05 + 0.9 * ((0.21 + i * 0.4142135624) % 1);
  });
  const dust: FlowDust[] = Array.from({ length: DUST_PER_SCREEN * screens }, () => ({
    x0: rnd(),
    y0: rnd(),
    speed: 0.02 + rnd() * 0.05,
    size: 0.004 + rnd() * 0.007,
    phase: rnd() * TAU,
    alpha: 0.25 + rnd() * 0.35,
  }));
  return { cells, dust };
}

export type FlowSprites = {
  // Un sprite por nivel de desenfoque.
  body: HTMLCanvasElement[];
  // Plaqueta: filopodios aparte, para que aparezcan y desaparezcan (solo nítidos).
  filopodia: HTMLCanvasElement | null;
  // Luz que no gira con la figura (siempre de arriba a la izquierda): da volumen.
  light: HTMLCanvasElement | null;
  dust: HTMLCanvasElement | null;
};

const svgUrl = (markup: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// Rasteriza una imagen en un sprite cuadrado, con desenfoque opcional. contain: imagen propia (cualquier
// proporción), que se ajusta dentro del lienzo de la figura dejando el margen del desenfoque.
function raster(img: HTMLImageElement, size: number, blurLevel: number, contain: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  if (blurLevel > 0) g.filter = `blur(${(blurLevel * BLUR_PER_LEVEL * size).toFixed(1)}px)`;
  if (contain) {
    const box = size / FLOW_SPRITE_PAD;
    const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    g.drawImage(img, 0, 0, size, size);
  }
  return canvas;
}

// markups: SVG serializados de los dibujos (ver wallFlowSprites.tsx); imageUrl: la imagen propia.
export async function buildFlowSprites(
  markups: Partial<Record<FlowSpriteKey, string>>,
  imageUrl: string | null,
): Promise<FlowSprites> {
  const load = (key: FlowSpriteKey) => (markups[key] ? loadImage(svgUrl(markups[key])) : Promise.resolve(null));
  const [bodySvg, filopodiaSvg, lightSvg, dustSvg, ownImage] = await Promise.all([
    load("body"),
    load("filopodia"),
    load("light"),
    load("dust"),
    imageUrl ? loadImage(imageUrl) : Promise.resolve(null),
  ]);
  const bodySource = ownImage ?? bodySvg;
  const contain = ownImage !== null;
  return {
    body: bodySource
      ? Array.from({ length: BLUR_LEVELS }, (_, lv) =>
          raster(bodySource, lv === 0 ? SHARP_SPRITE_PX : BLURRED_SPRITE_PX, lv, contain),
        )
      : [],
    filopodia: filopodiaSvg ? raster(filopodiaSvg, SHARP_SPRITE_PX, 0, false) : null,
    light: lightSvg ? raster(lightSvg, BLURRED_SPRITE_PX, 0, false) : null,
    dust: dustSvg ? raster(dustSvg, 32, 0, false) : null,
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
// En reposo un rato, saca los filopodios, los mantiene y los retrae.
const activation = (t: number) => {
  const u = (((t % ACTIVATION_PERIOD_S) + ACTIVATION_PERIOD_S) % ACTIVATION_PERIOD_S) / ACTIVATION_PERIOD_S;
  return smoothstep(0.3, 0.48, u) * (1 - smoothstep(0.8, 0.96, u));
};

export type FlowFrame = {
  t: number;
  // Tamaño de la pantalla (px CSS).
  width: number;
  height: number;
  // Borde izquierdo de este tótem y ancho total de la pared (pantallas + separaciones), en px.
  screenStart: number;
  wallWidth: number;
  shape: WallShape;
  // Modo reducido (el equipo no da abasto): la mitad de las células y sin polvo.
  reduced: boolean;
  // Sobre el protector de pantalla: solo las células cercanas, sin polvo (menos cosas tapando sus fotos).
  sparse: boolean;
};

export function drawFlow(ctx: CanvasRenderingContext2D, sprites: FlowSprites, flow: Flow, f: FlowFrame) {
  const { t, width, height, screenStart, shape } = f;
  ctx.clearRect(0, 0, width, height);
  if (sprites.body.length === 0) return;
  // Margen fuera de los extremos de la pared: las células entran y salen enteras antes de dar la vuelta.
  const margin = width * 0.5;
  const span = f.wallWidth + 2 * margin;
  // Posición en la pared (px) de algo que avanza a `speed` px/s desde x0 (fracción del recorrido).
  const wallX = (x0: number, speed: number) => {
    const x = (x0 * span + speed * t) % span;
    return (x < 0 ? x + span : x) - margin;
  };

  // Polvo: puntitos brillantes muy lentos, al fondo.
  if (sprites.dust && !f.reduced && !f.sparse) {
    for (const d of flow.dust) {
      const x = wallX(d.x0, width * d.speed) - screenStart;
      const r = width * d.size;
      if (x < -r || x > width + r) continue;
      const y = height * d.y0 + height * 0.01 * Math.sin(0.3 * t + d.phase);
      ctx.globalAlpha = d.alpha;
      ctx.drawImage(sprites.dust, x - r, y - r, 2 * r, 2 * r);
    }
  }

  const tumbles = shape === "platelet" ? 0.65 : shape === "sphere" ? 0 : 0.18;
  for (const c of flow.cells) {
    if (f.reduced && !c.essential) continue;
    if (f.sparse && c.z < 0.3) continue;
    const half = (width * SHAPE_SIZE[shape] * (0.16 + 0.84 * c.z * c.z) * FLOW_SPRITE_PAD) / 2;
    const wx = wallX(c.x0, width * (SPEED_FAR + (SPEED_NEAR - SPEED_FAR) * c.z));
    const x = wx - screenStart;
    if (x < -half || x > width + half) continue;
    // Vaivén propio más una "ráfaga": una onda que depende de la posición en la pared, así la corriente
    // serpentea como llevada por el viento.
    const y =
      height * c.y0 +
      height * (0.015 + 0.03 * c.z) * Math.sin(0.35 * t + c.phase) +
      height * 0.035 * Math.sin((wx / width) * 1.2 + 0.12 * t + c.phase2);
    const level = Math.min(BLUR_LEVELS - 1, Math.round(Math.abs(c.z - FOCUS_DEPTH) * 7));
    const alpha = Math.min(1, 0.3 + c.z * 1.1);
    const rotation = shape === "sphere" ? 0 : c.spin0 + c.spin * t;
    // Tumbos: la figura se aplana al girar sobre sí misma (la plaqueta, un disco, mucho más).
    const tumble = 1 - tumbles * (1 - Math.abs(Math.cos(c.tumbleRate * t + c.tumblePhase)));
    const breath = shape === "cancerCell" ? 1 + 0.03 * Math.sin((TAU * t) / 7 + c.phase) : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(breath, breath * tumble);
    if (shape === "platelet" && sprites.filopodia && level <= 1) {
      const a = activation(t + c.activationOffset);
      if (a > 0.01) {
        const k = 0.8 + 0.2 * a;
        ctx.globalAlpha = alpha * a;
        ctx.drawImage(sprites.filopodia, -half * k, -half * k, 2 * half * k, 2 * half * k);
      }
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites.body[level], -half, -half, 2 * half, 2 * half);
    if (sprites.light && level <= 1) {
      // Se deshace el giro (no el aplanamiento): la luz sigue arriba a la izquierda.
      ctx.rotate(-rotation);
      ctx.drawImage(sprites.light, -half, -half, 2 * half, 2 * half);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
