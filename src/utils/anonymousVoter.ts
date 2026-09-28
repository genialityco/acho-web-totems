const STORAGE_PREFIX = "genpapers_anon_voter_";

const randomId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Id estable por navegador/evento para votar en modo "anonymous" (ver EventInfo.voteMode):
// no se pide cédula, así que votes/{idNumber} se deduplica contra este id en vez de una
// identidad real. Si localStorage no está disponible (incógnito estricto, etc.) se devuelve
// un id nuevo cada vez, lo que en la práctica deja de deduplicar en ese caso puntual.
export const getAnonymousVoterId = (eventSlug: string): string => {
  const key = `${STORAGE_PREFIX}${eventSlug}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
};
