import type { EventInfo } from "../services/firestore/eventService";

// Estado efectivo de la votación de un evento a una hora dada:
// - "closed": el interruptor del admin está apagado (manda sobre la programación).
// - "scheduled": habilitada, pero aún no llega votingOpensAt.
// - "open": se puede votar.
// - "ended": ya pasó votingClosesAt.
// castVote (functions/src/index.ts) aplica la misma regla con la hora del servidor.
export type VotingPhase = "closed" | "scheduled" | "open" | "ended";

type VotingSchedule = Pick<EventInfo, "votingOpen" | "votingOpensAt" | "votingClosesAt">;

export const getVotingPhase = (event: VotingSchedule, now: number): VotingPhase => {
  if (!event.votingOpen) return "closed";
  if (event.votingOpensAt && now < event.votingOpensAt.getTime()) return "scheduled";
  if (event.votingClosesAt && now >= event.votingClosesAt.getTime()) return "ended";
  return "open";
};

// Próximo instante en que cambia la fase (apertura o cierre), o null si no hay ninguno por delante.
export const getNextVotingChange = (event: VotingSchedule, now: number): Date | null => {
  const phase = getVotingPhase(event, now);
  if (phase === "scheduled") return event.votingOpensAt;
  if (phase === "open") return event.votingClosesAt;
  return null;
};
