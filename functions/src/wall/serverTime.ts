import { onCall } from "firebase-functions/v2/https";

// Hora del servidor (ms desde epoch) para sincronizar los tótems de una pared (WallSphere): cada tótem
// mide su desfase contra esta hora y calcula la posición de la esfera con el mismo reloj, sin mensajes
// entre tótems. Pública y sin estado; el cliente toma varias muestras y se queda con la de menor
// tiempo de ida y vuelta, así que el arranque en frío de la primera llamada no afecta la precisión.
export const serverTime = onCall({ region: "us-central1", memory: "128MiB", maxInstances: 10 }, () => ({
  now: Date.now(),
}));
