# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Root package manager is Yarn (Berry, `yarn@4.5.1` via corepack — do not use npm/pnpm lockfiles at the root). `functions/` is a separate **npm** project (its own `package-lock.json`); run npm there, not yarn.

- `yarn dev` — Vite dev server on port 3001 (Vite silently picks the next free port if 3001 is taken — check its output, or pass `--port N --strictPort`, before pointing tests at a URL)
- `yarn build` — type-check (`tsc`) then build the production bundle
- `yarn lint` — ESLint over `src`, zero warnings allowed (currently clean)
- `cd functions && npm run build` — compile Cloud Functions (`tsc` → `functions/lib`)
- `firebase deploy --only firestore:rules,firestore:indexes,functions,storage` — deploy rules and functions to the `gen-papers` project. The Firebase project belongs to `contactogeniality@gmail.com`; pass `--account contactogeniality@gmail.com` (or `firebase login:use`) if the CLI's default account differs. Note the bare `storage` target, not `storage:rules` — firebase-tools 15.4.0 rejects `storage:rules` with "Could not find rules for the following storage targets: rules" (it parses the part after `:` as a deploy target name, which only exists if bound via `firebase target:apply`); Storage has no rules/indexes split the way Firestore does, so `--only storage` alone deploys `storage.rules`.

There is no test runner. Local end-to-end runs use the Firebase emulators with an isolated `demo-` project so nothing touches production:

```
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase emulators:start --only firestore,functions,auth,storage --project demo-gen-papers
VITE_FIREBASE_PROJECT_ID=demo-gen-papers VITE_USE_FIREBASE_EMULATORS=true yarn dev
```

`FUNCTIONS_DISCOVERY_TIMEOUT` is needed on this Windows machine: the CLI's default 10 s wait for function discovery times out (`User code failed to load ... Timeout after 10000`) although the code itself loads in under a second — the same applies to `firebase deploy`. Emulator data is per project id, so seed data and the app must use the same one (`demo-gen-papers`). Emulator ports are in `firebase.json`; Firestore needs Java. To use the admin panel locally, create a user in the Auth emulator and an `admins/<uid>` doc in the Firestore emulator. Vite's first dev load is slow on this machine (minutes on a cold cache); give browser automation generous timeouts.

## Architecture

"Gen. Papers": a multi-event conference poster (paper) viewing/voting SPA with an embedded admin panel — Vite + React 18 + TypeScript + Mantine 7 — backed by its own Firebase project (`gen-papers`: Firestore + callable Cloud Functions + Auth for admins). It was split off from a shared ACHO Mongo backend (`achoapi.geniality.com.co`); that split is complete — nothing in this repo calls that API anymore, and `axios` is not a dependency.

### Firestore model (security rules in `firestore.rules`)

```
events/{eventSlug}                        name, votingOpen, bannerUrl, backgroundUrl, screensaverEnabled, screensaverIdleSeconds, screensaverPhotoDurationSeconds
                                           (doc id = URL slug; bannerUrl/backgroundUrl are optional per-event image URLs, null = site defaults; screensaver fields default to off/120s/8s, see below)
  categories/{id}                         name, color, order         (the colored "Categorías" cards; color must be a valid CSS + Mantine color name)
  papers/{id}                             title, authors[], institution, urlPdf, categoryId, theme, voteCount
  voters/{idNumber}                       idNumber, fullName, active (roster; doc id = cédula; admin-only)
  votes/{idNumber}                        paperId, castAt            (doc id = cédula → one vote per person; nobody can write from the client)
  screensaverItems/{id}                   type ("image"|"video"), url, order   (public-read like categories/papers; the idle-screensaver's photo/video rotation)
admins/{uid}                              email                      (existence of the doc = is admin; collection name is `admins`, plural)
```

- Naming: `categoryId` is what the UI calls "Categorías"; `theme` is the free-form "tema" select. (The old backend had these two fields crossed: `topic`/`category`.)
- Public visitors read events/categories/papers (including `voteCount`); voters and votes are admin-read only. Admins (any admin, any event) write events/categories/papers/voters directly from the client under the rules. `voteCount` and everything under `votes/` are written **only** by Cloud Functions (Admin SDK) — rules forbid client writes so a vote (vote doc + counter) stays atomic.
- Cloud Functions (`functions/src/index.ts`, v2 callable, Node 22, region `us-central1`): `castVote({eventSlug, idNumber, paperId})` (transaction: event open, voter exists & active, paper exists, no previous vote; errors are `HttpsError`s with Spanish messages, `already-exists` carries `details.paperTitle`), `resetVotes({eventSlug})` (admin-only; deletes all votes, zeroes `voteCount`) and `grantAdmin({email})` (admin-only; **no UI yet**).
- The first admin must be bootstrapped by hand: create the Auth user, then create `admins/<that UID>` in the console (`grantAdmin` requires already being admin).

### Firebase Storage (security rules in `storage.rules`)

- Papers' PDFs live at `events/{eventSlug}/papers/{timestamp}-{sanitizedFileName}`, event banner/background images at `events/{eventSlug}/images/{kind}-{timestamp}-{sanitizedFileName}`, and screensaver photos/videos at `events/{eventSlug}/screensaver/{type}-{timestamp}-{sanitizedFileName}`, all in the project's default bucket (`gen-papers.firebasestorage.app`, already provisioned). Public read; write/delete gated by an `isAdmin()` check — `request.auth.token.admin == true`, a **custom auth claim** (not a Firestore cross-service rule) that `grantAdmin()` sets via `setCustomUserClaims` alongside creating `admins/{uid}` — no signed URLs, no Cloud Function in the upload path itself, no extra IAM grants needed. Also enforced in rules: papers need `contentType == 'application/pdf'` and size `< 30MB` (mirrored client-side as `MAX_PAPER_FILE_BYTES`); images need `contentType.matches('image/.*')` and size `< 5MB` (mirrored as `MAX_EVENT_IMAGE_BYTES`); screensaver media needs `contentType` matching `image/.*` or `video/.*` and size `< 50MB` (mirrored as `MAX_SCREENSAVER_MEDIA_BYTES`) — all three limits enforced client-side too, in `storageService.ts`, so bad files are rejected before the upload starts, not just by the rule. Deploying rule changes needs `firebase deploy --only storage` — a bare `storage:rules` target isn't valid on this CLI version, see the Commands section.
- `Storage list is not granted` — rules only cover per-object `get`/`write`/`delete`, not bucket-level `list`. Don't rely on the Storage REST `list` endpoint (even from tooling) expecting it to work; use the Admin SDK (bypasses rules, e.g. in a seed/debug script) if you need to enumerate objects.
- `src/services/storageService.ts`: `uploadPaperPdf(eventSlug, file, onProgress?)` / `uploadEventImage(eventSlug, "banner"|"background", file, onProgress?)` / `uploadScreensaverMedia(eventSlug, "image"|"video", file, onProgress?)` (resumable upload, returns `{promise, cancel}`; promise resolves to the public download URL) and `deletePaperPdf(url)` / `deleteEventImage(url)` / `deleteScreensaverMedia(url)` (all three aliases of the same best-effort delete helper; silently no-ops on a URL that isn't a Storage download URL, e.g. an externally-hosted file from before this feature).
- `AdminPapers.tsx`'s paper form uploads directly to Storage (a `FileInput`, not a URL text field): required on create, optional on edit (leaving it empty keeps the paper's current `urlPdf`, shown as a "Ver archivo actual" link). Replacing a file on edit deletes the previous Storage object after the Firestore write succeeds. The papers **bulk upload** (Excel) still takes a `urlPdf` column as a plain URL — Excel rows can't carry file attachments, so bulk-imported papers are expected to already be hosted somewhere (e.g. a URL an admin uploaded through the single-paper form and copied, or an external host).

### Frontend data flow

- `src/services/firebaseConfig.ts` — initializes the app from `VITE_FIREBASE_*` env vars (see `.env.example`; real values in the git-ignored `.env.local`) and exports `auth`, `db`, `functions`. With `VITE_USE_FIREBASE_EMULATORS=true` in dev it connects to the local emulators.
- `src/services/firestore/*Service.ts` — one file per resource (event, category, paper, voter, vote, admin). Reads are live `onSnapshot` subscriptions that normalize/validate documents at the boundary; writes are plain Firestore writes, with `batch.ts` chunking bulk writes into ≤450-op batches. `voteService.castVote` wraps the callable and throws a typed `VoteError` (`not-found | already-exists | failed-precondition | unknown`); `resetVotes` wraps the admin callable.
- Contexts follow a split that keeps `react-refresh` lint happy: the context object + hook live in `useX.ts`, the provider component in `XContext.tsx`.
  - Public: `PostersProvider` (`PostersContext.tsx`, hook `usePosters`) is per event: subscribes to the event, its categories, papers and `screensaverItems`, and does all filtering client-side (accent-insensitive search on title/authors, category, theme; category counts ignore the category filter itself; page size starts at 10 and scales up on large/TV screens, see below). Exposes `eventStatus` (`loading | ready | not-found | error`).
  - `src/hooks/useIdleTimer.ts` (`useIdleTimer(timeoutSeconds, enabled): boolean`) tracks visitor inactivity via `window`-level mouse/keyboard/touch/scroll listeners; `EventGate` (`EventLayout.tsx`) mounts `ScreensaverOverlay` as a sibling of `PublicShell` (not inside it — `PublicShell` is also used by `NotFoundPage`, which has no `PostersProvider`) whenever `event.screensaverEnabled` and there's at least one `screensaverItem`, so it covers both the poster list and the poster detail page. The overlay rotates photos (auto-advance after `screensaverPhotoDurationSeconds`) and videos (advance on `onEnded`; a single video item `loop`s instead, since `onEnded` re-setting the same index wouldn't re-render). Any click/touch/key dismisses it. `PosterDetail.tsx` has a `window` blur/focus-based workaround that synthesizes activity while focus sits inside the cross-origin PDF iframe, so reading a poster doesn't get interrupted (best-effort — the iframe's own activity can't bubble to `window`).
  - Admin: `AdminAuthProvider` (`useAdminAuth`: email/password sign-in, `isAdmin` = `admins/{uid}` exists) and `AdminEventProvider` (`useAdminEvent`: one shared subscription to the event, categories, papers, voters and votes for all tabs of an event).
- The domain type `Paper` shares its name with Mantine's `Paper` component — don't import both unaliased.

### Routes (`src/App.tsx`)

- `/:eventSlug` — public: `EventLayout` (provider + shared header via `PublicShell`, which shows the event's `bannerUrl` (or the default ACHO logo, `fit="cover"` filling the header edge-to-edge) plus the `LanguageSwitcher`, + not-found/error gate + the idle `ScreensaverOverlay`, see above). `PublicShell` also owns the event's `backgroundUrl`: applied once as a fixed, full-viewport `background-size: cover` layer on its outermost wrapper, so it's behind the header (shown through a translucent+blurred strip so the banner stays legible) and every route below it, not just one page. Routes: `HomePage` (just renders `PosterList`) and `paper/:id` → `PosterDetail` (PDF in an external viewer iframe, prev/next scoped to the current page of results, vote-by-cédula modal; the vote button is disabled when `votingOpen === false`).
- `/admin/*` — `AdminRoot` (auth provider) → `/admin/login`, and behind `ProtectedAdminRoute` (redirects to login, then back to the original URL; non-admin accounts see a "no permissions" message): `/admin` (events list, create event, per-event voting switch) and `/admin/:eventSlug/{categories,papers,papers/bulk-upload,voters,voters/bulk-upload,results,screensaver}` (tabs in `AdminEventLayout`, which also holds the voting open/closed switch and an "Editar evento" modal for name/`bannerUrl`/`backgroundUrl`; both are image uploads — `FileInput` straight to Firebase Storage under `events/{eventSlug}/images/`, max 5 MB, via `uploadEventImage`/`deleteEventImage` in `storageService.ts` — not plain URL fields). The `screensaver` tab (`AdminScreensaver.tsx`) holds the enable switch + idle/photo-duration seconds (switch commits instantly, the two `NumberInput`s commit together via an explicit "Guardar" button) and a table of photo/video items (`FileInput` upload, manual numeric `order`, like `AdminCategories.tsx`'s categories). `/` redirects to `/admin`; anything else is `NotFoundPage`. `admin` is a reserved event slug because static routes win over `/:eventSlug`.
- Admin behaviors worth knowing: new events start with voting **closed**; slugs are immutable (they are the doc id) and events cannot be deleted from the UI (votes can't be cleaned from the client); a paper with votes can't be deleted (reset the event's votes first); deleting a category sets `categoryId: null` on its papers; results has a ranking, an audit list of votes, and "Reiniciar votos" (typed confirmation → `resetVotes`).
- Bulk upload (`components/admin/BulkUploadPanel.tsx`, generic over the row payload): download template → pick .xlsx → per-row validation preview (OK / SKIPPED / ERROR) → import in batches → downloadable report. Papers (`title, authors, institution, categoryName, theme, urlPdf`; authors separated by `;`; unknown `categoryName` is an error, titles that already exist are skipped) and voters (`idNumber, fullName, active`; upsert by cédula).

### i18n (public site only; `/admin` is not translated)

- `i18next` + `react-i18next` + `i18next-browser-languagedetector`, initialized once in `src/i18n/index.ts` (imported from `main.tsx`). Detection order: `localStorage` (key `i18nextLng`, set when a visitor uses the switcher) → `navigator` language → `fallbackLng: "es"`.
- Translations: `src/i18n/locales/es.ts` (source of truth) and `en.ts`. `en.ts` is typed as `typeof es` with values widened to `string`, so adding/renaming/removing a key in one file without doing the same in the other is a **type error**, not a silent missing key at runtime.
- `LanguageSwitcher` (ES/EN `SegmentedControl`) lives in `PublicShell`'s header — public pages only, never rendered in `/admin`.
- Only interface strings are translated (buttons, labels, error messages, including the `castVote` error text, which the client now maps by `VoteError.code` instead of showing the Cloud Function's raw Spanish `error.message`). Content admins type in — event names, category names, paper titles/authors — is never translated; it renders as-is regardless of the selected language.

### Notable conventions

- Code comments are in Spanish. Admin-panel UI strings are hardcoded Spanish literals (not in scope for i18n). Public-site UI strings go through `t("namespace.key")` (see i18n section) — add new public-facing copy to both `es.ts` and `en.ts`, never as a literal in a public component.
- The Firebase web config is not secret; access control lives in Firestore rules and the functions. `netlify.toml` whitelists the API key from Netlify's secret scanner, and the `VITE_FIREBASE_*` vars must also be set in Netlify's environment (`.env.local` is not deployed) — without them the app crashes at startup (`auth/invalid-api-key`).
- ACHO-specific content still hardcoded (not per-event): the app-install QR codes/texts and their promo copy in `PosterDetail`. The banner and landing background are per-event (see above); the default banner (ACHO logo) is the `DEFAULT_BANNER_URL` fallback in `PublicShell`.
- Speakers (conferencistas) and a bulk attendee/account importer existed in an earlier, Mongo-backed version of this app and were removed on purpose — they don't fit the Firestore model (paper authors live in `Paper.authors`; voters are the `voters` roster, no accounts). Don't re-add either without being asked.
- Deployment: frontend on Netlify (`netlify.toml`; `public/_redirects` rewrites everything to `index.html` for SPA routing); backend on Firebase.
