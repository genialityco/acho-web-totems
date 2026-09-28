import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, WriteBatch } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { db, assertIsAdmin } from "./lib/admin";

export * from "./search/indexPaperSearchTrigger";
export * from "./search/embedSearchQuery";
export * from "./search/explainSearchMatch";
export * from "./search/reindexPaperSearch";

interface CastVoteRequest {
  eventSlug?: string;
  idNumber?: string;
  paperId?: string;
}

type VoteMode = "registered" | "open" | "anonymous";
const isVoteMode = (value: unknown): value is VoteMode =>
  value === "registered" || value === "open" || value === "anonymous";

// Emite un voto de forma atómica: valida evento/votante/póster y evita votos duplicados.
export const castVote = onCall(async (request) => {
  const { eventSlug, idNumber, paperId } = request.data as CastVoteRequest;
  if (!eventSlug || !idNumber || !paperId) {
    throw new HttpsError("invalid-argument", "Faltan datos para registrar el voto.");
  }

  const eventRef = db.doc(`events/${eventSlug}`);
  const voterRef = db.doc(`events/${eventSlug}/voters/${idNumber}`);
  const voteRef = db.doc(`events/${eventSlug}/votes/${idNumber}`);
  const paperRef = db.doc(`events/${eventSlug}/papers/${paperId}`);

  return db.runTransaction(async (tx) => {
    const [eventSnap, voterSnap, voteSnap, paperSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(voterRef),
      tx.get(voteRef),
      tx.get(paperRef),
    ]);

    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "El evento no existe.");
    }
    const eventData = eventSnap.data();
    if (eventData?.votingOpen === false) {
      throw new HttpsError("failed-precondition", "La votación para este evento está cerrada.");
    }
    // "registered" (default, incl. eventos creados antes de existir voteMode): la cédula debe
    // existir y estar activa en el roster precargado. "open"/"anonymous" se saltan esa validación
    // (la diferencia entre ambas es puramente del cliente: pedir cédula o generar un id anónimo);
    // en los dos casos votes/{idNumber} sigue evitando un segundo voto con el mismo id.
    const voteMode = isVoteMode(eventData?.voteMode)
      ? eventData.voteMode
      : eventData?.voteRequiresRegistration === false
        ? "open"
        : "registered";
    if (voteMode === "registered" && (!voterSnap.exists || voterSnap.data()?.active !== true)) {
      throw new HttpsError(
        "not-found",
        "No se encontró un usuario con esta cédula. Regístrate en la App para poder votar."
      );
    }
    if (!paperSnap.exists) {
      throw new HttpsError("not-found", "El póster no existe.");
    }
    if (voteSnap.exists) {
      const votedPaperId = voteSnap.data()?.paperId as string | undefined;
      const votedPaperSnap = votedPaperId
        ? await tx.get(db.doc(`events/${eventSlug}/papers/${votedPaperId}`))
        : null;
      throw new HttpsError(
        "already-exists",
        "Ya has votado por este póster.",
        { paperTitle: votedPaperSnap?.data()?.title ?? "" }
      );
    }

    tx.set(voteRef, { paperId, castAt: FieldValue.serverTimestamp() });
    tx.update(paperRef, { voteCount: FieldValue.increment(1) });
    return { ok: true };
  });
});

interface GrantAdminRequest {
  email?: string;
}

// Otorga permisos de administrador a una cuenta existente de Firebase Auth (admin-only).
export const grantAdmin = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { email } = request.data as GrantAdminRequest;
  if (!email) {
    throw new HttpsError("invalid-argument", "Falta el email.");
  }

  const user = await getAuth()
    .getUserByEmail(email)
    .catch(() => null);
  if (!user) {
    throw new HttpsError("not-found", "No existe una cuenta con ese email.");
  }

  // El doc admins/{uid} respalda las reglas de Firestore y el panel; el custom claim
  // respalda las reglas de Storage (que no dependen de una consulta cross-service a Firestore).
  await Promise.all([
    db.doc(`admins/${user.uid}`).set({
      email,
      createdAt: FieldValue.serverTimestamp(),
    }),
    getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, admin: true }),
  ]);
  return { ok: true, uid: user.uid };
});

interface ResetVotesRequest {
  eventSlug?: string;
}

// Borra todos los votos de un evento y reinicia el conteo de cada póster (admin-only).
export const resetVotes = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { eventSlug } = request.data as ResetVotesRequest;
  if (!eventSlug) {
    throw new HttpsError("invalid-argument", "Falta el evento.");
  }

  const [votesSnap, papersSnap] = await Promise.all([
    db.collection(`events/${eventSlug}/votes`).get(),
    db.collection(`events/${eventSlug}/papers`).get(),
  ]);

  const batches: WriteBatch[] = [];
  let batch = db.batch();
  let opCount = 0;

  const addOp = (apply: (b: WriteBatch) => void) => {
    apply(batch);
    opCount += 1;
    if (opCount >= 450) {
      batches.push(batch);
      batch = db.batch();
      opCount = 0;
    }
  };

  votesSnap.docs.forEach((d) => addOp((b) => b.delete(d.ref)));
  papersSnap.docs.forEach((d) => addOp((b) => b.update(d.ref, { voteCount: 0 })));
  if (opCount > 0) {
    batches.push(batch);
  }

  await Promise.all(batches.map((b) => b.commit()));
  return { ok: true, votesDeleted: votesSnap.size, papersReset: papersSnap.size };
});

type PaperMetric = "view" | "download";
const PAPER_METRIC_FIELDS: Record<PaperMetric, string> = {
  view: "viewCount",
  download: "downloadCount",
};

interface IncrementPaperMetricRequest {
  eventSlug?: string;
  paperId?: string;
  metric?: PaperMetric;
}

// Suma 1 a un contador público del póster (vistas o descargas, ver "Búsqueda inteligente" en
// CLAUDE.md para el patrón equivalente de callables públicas). No hace falta transacción:
// FieldValue.increment ya es atómico por sí solo.
export const incrementPaperMetric = onCall(async (request) => {
  const { eventSlug, paperId, metric } = request.data as IncrementPaperMetricRequest;
  const field = metric && PAPER_METRIC_FIELDS[metric];
  if (!eventSlug || !paperId || !field) {
    throw new HttpsError("invalid-argument", "Faltan datos para registrar la métrica.");
  }

  const paperRef = db.doc(`events/${eventSlug}/papers/${paperId}`);
  const paperSnap = await paperRef.get();
  if (!paperSnap.exists) {
    throw new HttpsError("not-found", "El póster no existe.");
  }

  await paperRef.update({ [field]: FieldValue.increment(1) });
  return { ok: true };
});

interface ResetPaperMetricsRequest {
  eventSlug?: string;
}

// Reinicia a 0 las vistas y descargas de todos los papers de un evento (admin-only).
// Independiente de resetVotes: no toca votes/ ni voteCount.
export const resetPaperMetrics = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { eventSlug } = request.data as ResetPaperMetricsRequest;
  if (!eventSlug) {
    throw new HttpsError("invalid-argument", "Falta el evento.");
  }

  const papersSnap = await db.collection(`events/${eventSlug}/papers`).get();

  const batches: WriteBatch[] = [];
  let batch = db.batch();
  let opCount = 0;

  const addOp = (apply: (b: WriteBatch) => void) => {
    apply(batch);
    opCount += 1;
    if (opCount >= 450) {
      batches.push(batch);
      batch = db.batch();
      opCount = 0;
    }
  };

  papersSnap.docs.forEach((d) => addOp((b) => b.update(d.ref, { viewCount: 0, downloadCount: 0 })));
  if (opCount > 0) {
    batches.push(batch);
  }

  await Promise.all(batches.map((b) => b.commit()));
  return { ok: true, papersReset: papersSnap.size };
});
