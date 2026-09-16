# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is Yarn (Berry, `yarn@4.5.1` via corepack — do not use npm/pnpm lockfiles).

- `yarn dev` — start Vite dev server on port 3001
- `yarn build` — type-check (`tsc`) then build production bundle with Vite
- `yarn lint` — ESLint over `src` (`.ts`/`.tsx`), zero warnings allowed
- `yarn preview` — preview the production build locally

There is no test runner configured in this project (no test script, no test files).

## Architecture

This is a single-page React app (Vite + TypeScript + Mantine UI) for ACHO's conference poster voting site, plus a couple of admin utility screens. There is no server-side code here — the backend is a separate API service.

### Data flow

- `src/services/api/api.ts` — a single shared Axios instance (`baseURL: https://achoapi.geniality.com.co`) with pass-through request/response interceptors. All backend calls go through this instance.
- `src/services/api/*Service.ts` — one file per resource (`posterService`, `userService`, `memberService`, `attendeeService`, `speakerService`), each exposing CRUD + `search*` functions. Responses are not consistently shaped: some endpoints return the entity directly, others wrap it in `{ status, data: { items, totalItems, totalPages, currentPage } }`. Check the specific service file's return typing before assuming a shape — several components include local `getItems`/`unwrap*` helpers to normalize this.
- `src/services/firebaseConfig.ts` — Firebase (Auth + Realtime Database) is used only for user account creation during bulk import (`createUserWithEmailAndPassword`), not for the main app's data.
- `src/context/PostersContext.tsx` — loads all posters once (up to 300, `page=1&limit=300`) then does **client-side** filtering/searching/pagination/topic-count aggregation. `topics` is a fixed hardcoded list (Categoría Especial, Estudios Analíticos, Estudios Descriptivos, Reporte de Casos) whose counts are derived from the loaded posters — adding a new topic requires editing `updateTopics` in this file.

### Routes (`src/App.tsx`)

- `/` — `HomePage`: poster grid/search (`PosterList`), with a hidden always-invisible button (opacity 0, top-left) that toggles a fullscreen looping screensaver video overlay.
- `/poster/:id` — `PosterDetail`: shows a poster PDF (via an external viewer iframe, `genpdfviewer.netlify.app`) with next/prev navigation scoped to the currently loaded page of posters (`PostersContext.currentPagePosters`), and an ID-number-based voting flow (looks up a `member` by `idNumber`, checks it's active and hasn't already voted, then calls `voteForPoster`).
- `/masive-users` — `BulkUserUpload`: admin tool. Reads an `.xlsx` file (via the `xlsx` package), then for each row resolves/creates a Firebase user + Mongo `user`/`member`/`attendee` record, upserting `attendee` by `(memberId, eventId)`. `organizationId` and `eventId` are hardcoded constants in this component — update them per event before using this tool for a new conference. Produces a downloadable XLSX report of what happened per row.
- `/speakers` — `SpeakersList`: read-only speaker listing grouped and sorted by `eventId`.

### Notable conventions

- Comments and user-facing strings are in Spanish; keep new UI text consistent with that.
- Business/admin components (e.g. `BulkUserUpload`) disable the `no-explicit-any` ESLint rule inline because upstream API response shapes are inconsistent — prefer adding a typed unwrap helper over spreading `any` further when practical.
- Firebase config (`src/services/firebaseConfig.ts`) contains a client-side Web API key; this is intentionally not secret (see `netlify.toml`, which whitelists it from Netlify's secret scanner) — access control is enforced via Firebase Security Rules, not by hiding this key.
- Deployment is via Netlify (`netlify.toml`, `public/_redirects` rewrites all paths to `index.html` for SPA routing).
