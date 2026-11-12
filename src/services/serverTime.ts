import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseConfig";

// Reloj común de los tótems de una pared (WallSphere). Los relojes de Windows pueden diferir hasta
// segundos entre equipos, lo que rompería la ilusión de una sola esfera cruzando pantallas: cada tótem
// mide su desfase contra la hora del servidor (función serverTime) y usa serverNow() en vez de Date.now().
const serverTimeCallable = httpsCallable<void, { now: number }>(functions, "serverTime");

const SAMPLES = 5;
let offsetMs = 0;

// Estilo NTP: varias muestras, y se queda con la de menor ida y vuelta (la menos afectada por la red y
// por el arranque en frío de la función), suponiendo que la respuesta tardó la mitad en volver.
// Precisión típica: decenas de ms. Si falla (sin red, función no desplegada) se conserva el desfase
// anterior (0 al inicio = reloj local).
export async function syncServerTime(): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < SAMPLES; i += 1) {
    try {
      const sentAt = Date.now();
      const { data } = await serverTimeCallable();
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      if (typeof data?.now !== "number") continue;
      const offset = data.now + rtt / 2 - receivedAt;
      if (!best || rtt < best.rtt) best = { rtt, offset };
    } catch (error) {
      console.warn("No se pudo sincronizar la hora con el servidor:", error);
      return;
    }
  }
  if (best) offsetMs = best.offset;
}

// Hora "de la pared": la misma en todos los tótems sincronizados.
export const serverNow = () => Date.now() + offsetMs;
