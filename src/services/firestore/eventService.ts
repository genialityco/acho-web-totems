import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  Timestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { WALL_SHAPE_DEFAULT_COLORS, WALL_SHAPES, WallShape } from "../../utils/wallShapes";

export const DEFAULT_SCREENSAVER_IDLE_SECONDS = 120;
export const DEFAULT_SCREENSAVER_PHOTO_DURATION_SECONDS = 8;
export const DEFAULT_WALL_EFFECT_COLOR = WALL_SHAPE_DEFAULT_COLORS.sphere;
export const DEFAULT_WALL_SCREENS = 4;
export const DEFAULT_WALL_GAP_CM = 10;

export interface EventInfo {
  slug: string;
  name: string;
  votingOpen: boolean;
  // Programación opcional de la votación (null = sin límite por ese lado). Solo aplica con votingOpen
  // en true, que sigue siendo el interruptor maestro: ver getVotingPhase en utils/votingSchedule.ts.
  votingOpensAt: Date | null;
  votingClosesAt: Date | null;
  // Si están vacíos, el sitio público usa sus valores por defecto (ver PublicShell/HomePage).
  bannerUrl: string | null;
  // Enlaces de la app móvil del evento en Google Play y en la App Store (null = sin app en esa tienda).
  // Con al menos uno, el sitio público muestra el botón del QR (AppQrButton → /<evento>/app).
  appAndroidUrl: string | null;
  appIosUrl: string | null;
  // Fondo animado de pared (WallSphere): una esfera que recorre los tótems del evento puestos uno al lado
  // del otro. Apagado por defecto. Cada tótem indica su posición con ?pos=N en la URL.
  wallEffectEnabled: boolean;
  wallEffectColor: string;
  // Figura que recorre la pared: esfera, plaqueta, célula cancerígena (dibujos propios, ver wallFigures) o una
  // imagen subida (wallEffectImageUrl, PNG transparente).
  wallEffectShape: WallShape;
  wallEffectImageUrl: string | null;
  // Si la figura también se ve sobre el protector de pantalla. Activado por defecto (un campo ausente cuenta como true).
  wallEffectOverScreensaver: boolean;
  // Cantidad de tótems de la pared y separación física entre pantallas (cm, se ajusta en sitio).
  wallScreens: number;
  // Separación física (cm) de cada hueco entre pantallas, de izquierda a derecha: [1–2, 2–3, 3–4…].
  // Siempre tiene wallScreens − 1 valores (los que falten se completan con DEFAULT_WALL_GAP_CM).
  wallGapsCm: number[];
  backgroundUrl: string | null;
  // Protector de pantalla por inactividad (ver ScreensaverOverlay); apagado por defecto
  // porque un evento nuevo no tiene fotos/videos configurados todavía.
  screensaverEnabled: boolean;
  screensaverIdleSeconds: number;
  screensaverPhotoDurationSeconds: number;
  // Botón "¿Por qué este resultado?" en los resultados de la búsqueda conceptual (ver
  // MatchExplanation); apagado por defecto porque cada explicación es una llamada a Gemini.
  searchExplanationsEnabled: boolean;
  // Modo "Preguntar" del buscador público (askPosters): respuesta breve + pósters agrupados por tema.
  // Apagado por defecto, como las explicaciones: cada pregunta es una llamada a Gemini.
  searchQuestionsEnabled: boolean;
  // Teclado en pantalla propio en los tótems (ver TouchKeyboard). Activado por defecto: un evento sin
  // el campo lo tiene. Desactivado, los campos de texto se comportan como en cualquier navegador
  // (en Windows, el teclado táctil del sistema si está configurado).
  touchKeyboardEnabled: boolean;
  // Estilo visual del sitio público: "glass" (oscuro con vidrio y bordes luminosos, por defecto: un
  // evento sin el campo lo usa) o "classic" (el claro anterior). Ver PublicShell/PosterList.
  publicStyle: PublicStyle;
  // "registered" (default): castVote exige que la cédula exista y esté activa en voters/{idNumber}.
  // "open": cualquier cédula puede votar (una sola vez, votes/{idNumber} sigue siendo la clave de
  // deduplicación) sin necesidad de haber sido precargada en "Votantes".
  // "anonymous": no se pide cédula; el cliente genera un id aleatorio y lo guarda en localStorage
  // (ver utils/anonymousVoter.ts), así que la deduplicación es por navegador/dispositivo, no por persona.
  voteMode: VoteMode;
  // Título de la sección de categorías en el sitio público (ej. "Especialización"); null = el
  // texto traducido por defecto ("Categorías"). Es contenido del evento, no se traduce.
  categoriesLabel: string | null;
  // Tipos de estudio del evento, en el orden en que se muestran como filtro público. Cada paper
  // guarda el nombre (Paper.studyType): renombrar uno aquí deja a sus papers sin tipo hasta reasignarlos.
  studyTypes: string[];
}

export type VoteMode = "registered" | "open" | "anonymous";

export type PublicStyle = "glass" | "classic";

const VOTE_MODES: readonly VoteMode[] = ["registered", "open", "anonymous"];

// Compat: antes de añadir el modo "anonymous" existía solo el booleano voteRequiresRegistration.
const toVoteMode = (data: DocumentData): VoteMode => {
  if (VOTE_MODES.includes(data.voteMode)) return data.voteMode;
  return data.voteRequiresRegistration === false ? "open" : "registered";
};

const optionalUrl = (value: unknown) => (typeof value === "string" && value ? value : null);

const positiveNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && value > 0 ? value : fallback;

const optionalDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

// Una separación por hueco entre pantallas. Compat: antes había una sola (wallGapCm) para todos los huecos.
const normalizeWallGaps = (data: DocumentData): number[] => {
  const screens =
    typeof data.wallScreens === "number" && data.wallScreens >= 1 && data.wallScreens <= 12
      ? Math.round(data.wallScreens)
      : DEFAULT_WALL_SCREENS;
  const fallback = typeof data.wallGapCm === "number" && data.wallGapCm >= 0 ? data.wallGapCm : DEFAULT_WALL_GAP_CM;
  const stored = Array.isArray(data.wallGapsCm) ? data.wallGapsCm : [];
  return Array.from({ length: screens - 1 }, (_, i) =>
    typeof stored[i] === "number" && stored[i] >= 0 ? stored[i] : fallback
  );
};

const toEvent = (slug: string, data: DocumentData): EventInfo => ({
  slug,
  name: typeof data.name === "string" ? data.name : slug,
  votingOpen: data.votingOpen !== false,
  votingOpensAt: optionalDate(data.votingOpensAt),
  votingClosesAt: optionalDate(data.votingClosesAt),
  bannerUrl: optionalUrl(data.bannerUrl),
  appAndroidUrl: optionalUrl(data.appAndroidUrl),
  appIosUrl: optionalUrl(data.appIosUrl),
  wallEffectEnabled: data.wallEffectEnabled === true,
  wallEffectColor:
    typeof data.wallEffectColor === "string" && /^#[0-9a-f]{6}$/i.test(data.wallEffectColor)
      ? data.wallEffectColor
      : DEFAULT_WALL_EFFECT_COLOR,
  wallEffectShape: WALL_SHAPES.includes(data.wallEffectShape)
    ? data.wallEffectShape
    : "sphere",
  wallEffectImageUrl: optionalUrl(data.wallEffectImageUrl),
  wallEffectOverScreensaver: data.wallEffectOverScreensaver !== false,
  wallScreens:
    typeof data.wallScreens === "number" && data.wallScreens >= 1 && data.wallScreens <= 12
      ? Math.round(data.wallScreens)
      : DEFAULT_WALL_SCREENS,
  wallGapsCm: normalizeWallGaps(data),
  backgroundUrl: optionalUrl(data.backgroundUrl),
  screensaverEnabled: data.screensaverEnabled === true,
  screensaverIdleSeconds: positiveNumber(data.screensaverIdleSeconds, DEFAULT_SCREENSAVER_IDLE_SECONDS),
  screensaverPhotoDurationSeconds: positiveNumber(
    data.screensaverPhotoDurationSeconds,
    DEFAULT_SCREENSAVER_PHOTO_DURATION_SECONDS
  ),
  searchExplanationsEnabled: data.searchExplanationsEnabled === true,
  searchQuestionsEnabled: data.searchQuestionsEnabled === true,
  touchKeyboardEnabled: data.touchKeyboardEnabled !== false,
  publicStyle: data.publicStyle === "classic" ? "classic" : "glass",
  voteMode: toVoteMode(data),
  categoriesLabel: typeof data.categoriesLabel === "string" && data.categoriesLabel.trim() ? data.categoriesLabel.trim() : null,
  studyTypes: Array.isArray(data.studyTypes)
    ? data.studyTypes.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
    : [],
});

// Suscripción en vivo al evento; entrega null si el slug no existe.
export const subscribeEvent = (
  slug: string,
  onData: (event: EventInfo | null) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    doc(db, "events", slug),
    (snap) => onData(snap.exists() ? toEvent(snap.id, snap.data()) : null),
    onError
  );

export const subscribeEvents = (
  onData: (events: EventInfo[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events"),
    (snap) => {
      const events = snap.docs.map((d) => toEvent(d.id, d.data()));
      events.sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(events);
    },
    onError
  );

// El evento nace con la votación cerrada; el admin la abre a propósito.
export const createEvent = async (slug: string, name: string) => {
  const ref = doc(db, "events", slug);
  if ((await getDoc(ref)).exists()) {
    throw new Error("Ya existe un evento con ese identificador.");
  }
  await setDoc(ref, { name, votingOpen: false });
};

export const updateEvent = (
  slug: string,
  changes: Partial<
    Pick<
      EventInfo,
      | "name"
      | "votingOpen"
      | "votingOpensAt"
      | "votingClosesAt"
      | "bannerUrl"
      | "appAndroidUrl"
      | "appIosUrl"
      | "wallEffectEnabled"
      | "wallEffectColor"
      | "wallEffectShape"
      | "wallEffectImageUrl"
      | "wallEffectOverScreensaver"
      | "wallScreens"
      | "wallGapsCm"
      | "backgroundUrl"
      | "screensaverEnabled"
      | "screensaverIdleSeconds"
      | "screensaverPhotoDurationSeconds"
      | "searchExplanationsEnabled"
      | "searchQuestionsEnabled"
      | "touchKeyboardEnabled"
      | "publicStyle"
      | "voteMode"
      | "categoriesLabel"
      | "studyTypes"
    >
  >
) => updateDoc(doc(db, "events", slug), changes);
