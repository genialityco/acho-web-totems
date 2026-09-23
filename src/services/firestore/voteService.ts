import { FirebaseError } from "firebase/app";
import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebaseConfig";

interface CastVoteInput {
  eventSlug: string;
  idNumber: string;
  paperId: string;
}

export type VoteErrorCode = "not-found" | "already-exists" | "failed-precondition" | "unknown";

export class VoteError extends Error {
  constructor(
    public code: VoteErrorCode,
    message: string,
    public paperTitle?: string
  ) {
    super(message);
  }
}

const castVoteCallable = httpsCallable<CastVoteInput, { ok: boolean }>(functions, "castVote");

const KNOWN_CODES: VoteErrorCode[] = ["not-found", "already-exists", "failed-precondition"];

export const castVote = async (input: CastVoteInput): Promise<void> => {
  try {
    await castVoteCallable(input);
  } catch (error) {
    if (!(error instanceof FirebaseError)) throw error;
    const code = error.code.replace("functions/", "");
    const details = (error as FirebaseError & { details?: { paperTitle?: string } }).details;
    throw new VoteError(
      KNOWN_CODES.includes(code as VoteErrorCode) ? (code as VoteErrorCode) : "unknown",
      error.message,
      details?.paperTitle
    );
  }
};

export interface VoteRecord {
  voterId: string;
  paperId: string;
  castAt: Date | null;
}

// Solo los administradores pueden leer los votos (ver firestore.rules).
export const subscribeVotes = (
  slug: string,
  onData: (votes: VoteRecord[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "votes"),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            voterId: d.id,
            paperId: typeof data.paperId === "string" ? data.paperId : "",
            castAt: typeof data.castAt?.toDate === "function" ? data.castAt.toDate() : null,
          };
        })
      ),
    onError
  );

const resetVotesCallable = httpsCallable<
  { eventSlug: string },
  { ok: boolean; votesDeleted: number; papersReset: number }
>(functions, "resetVotes");

export const resetVotes = async (eventSlug: string) =>
  (await resetVotesCallable({ eventSlug })).data;
