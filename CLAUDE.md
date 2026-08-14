# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InstaArchive Viewer is a React 19 + Vite 6 PWA for browsing archived Instagram data (official Instagram exports and Instaloader archives). All archive *parsing* happens client-side in the browser; the Express backend only indexes and serves files from disk, and never parses archive contents.

## Commands

- `npm install` — install dependencies
- `npm run dev` — Vite dev server on port 3000 (proxies `/api` and `/archives` to `http://localhost:3001`)
- `npm run server` — Express backend (`tsx server.ts`) on port 3001, serving `ARCHIVES_DIR` (defaults to `./_sample-archives`)
- `npm run build` — frontend to `dist/`, backend to `dist-server/`
- `npm run lint` — type-check only (`tsc --noEmit`)
- `npm test` / `npm run test:watch` — vitest
- `npx vitest run src/lib/archive-patterns.test.ts` — a single test file
- `npm run jd2 -- --archives <dir> --dry-run` — generate JDownloader `.crawljob`
  files for every profile on disk (see `scripts/jd2-sync.ts` and
  `docs/jdownloader.md`)

Local development usually needs both `npm run dev` and `npm run server`. Local-folder mode works without the backend; server-mode archives do not.

## Architecture

### Two archive sources, one data model

Loading is unified behind the `ArchiveFile` interface (`src/types/index.ts`, implementations in `src/lib/archive-files.ts`):

- **`LocalArchiveFile`** — wraps a browser `File`. `createObjectUrl()` mints a **disk-backed** blob URL directly from the File; never route media through `arrayBuffer()`, which pulls whole files into memory.
- **`RemoteArchiveFile`** — wraps a file served from `/archives/...`, fetched on demand.

`revocable` tells callers whether the returned URL must be revoked. The scanner tracks every minted URL and releases them on archive teardown.

### Sidecar directories

An archive root holds one directory per profile plus *sidecars* that belong to it:

```
4utumn07                                 -> posts (base)
4utumn07 - reels                         -> reels
story - 4utumn07                         -> stories
story highlights - 4utumn07 - Sunstory   -> highlight "Sunstory"
```

`src/lib/archive-grouping.ts` (shared by server and tests) folds these into a single profile with a `sources` list. Sidecars never appear as standalone archives. Each file the server returns carries its `kind`, so the client routes posts / reels / story ring / highlight circles without re-deriving naming rules.

### Server-side archive index (`src/lib/archive-index.ts`)

**Do not reintroduce per-request filesystem walks.** Archives typically live on network storage where per-file `stat` costs ~1.4ms and does not parallelise; a naive walk of a 110k-file root took ~52s per listing. Instead:

- Each source directory is indexed once and cached, keyed by its **directory mtime** (a directory `stat` is effectively free).
- The index is warmed in the background at startup and persisted to `CACHE_DIR` (mount a volume at `/cache`).
- `GET /api/archives` does no file walking at all — it returns directory-mtime `signature`s, which the client uses for cache invalidation instead of a file count.
- Only media files are stat'd (for `size`, which gates thumbnailing) and only highlights need `mtime` (their filenames carry no date).

### Scanning pipeline (`src/hooks/useArchiveScanner.ts`)

`handleFiles` indexes files, detects format, then parses via one of three largely independent paths that all write into a shared `postsMap`:

1. **JSON manifest** (`posts_1.json`, possibly `.json.xz` via `xz-decompress`) — media matched to entries by URI, then ID, then filename heuristic, in that fallback order.
2. **Filename patterns** — see `src/lib/archive-patterns.ts` for the export / Instaloader / highlight regexes, extracted as pure functions and covered by tests. Prefer changing them there.
3. **Generic grouping fallback** — when nothing else matched, files sharing a basename become one carousel.

Results are cached to IndexedDB. Media records store a stable `path`; **`url` is not persistable** for local archives because blob URLs die with the document.

### Cache and local-archive persistence (`src/lib/archive-cache.ts`)

IndexedDB keys are namespaced (`archive:`, `thumb:`, `handle:`) so listing archives does not deserialize every cached thumbnail blob, and thumbnails are scoped per archive to avoid cross-archive collisions.

Restoring an archive **rehydrates URLs from `path`**: server archives rebuild HTTP URLs; local archives re-open a persisted `FileSystemDirectoryHandle` and mint fresh blob URLs. If the folder is unreachable (permission lapsed, or the browser lacks `showDirectoryPicker` — Firefox/Safari), the app re-prompts rather than rendering broken images.

### Thumbnails (`src/hooks/useThumbnailQueue.ts` + `src/lib/thumbnail-worker.ts`)

Images over 1MiB are downscaled in a Web Worker via `OffscreenCanvas`. The queue is **serial on purpose** — decoding several 50MP+ images at once OOMs the tab. `requestThumbnail` must keep a stable identity (it reads cache state through a ref), or every completed thumbnail re-runs the effect in all mounted thumbnails.

### URL state (`src/App.tsx`, `src/lib/routing.ts`)

Paths mirror Instagram: `/<archive>/`, `/<archive>/reels/`, `/<archive>/p/<shortcode>/`. The old `?a=&t=&p=` form is still parsed for existing links but never written. Reserved prefixes (`api`, `archives`, `assets`…) can't be mistaken for a profile name.

A post URL carries no tab, as on Instagram — the tab is re-derived from the post's `source`, so a reel link lands on the Reels tab and pages through reels. Sidecar posts keep directory-scoped ids internally but expose only the shortcode.

Three rules, all learned from real bugs:

- The initial route is captured into a ref on first render; the URL is rewritten from state as soon as anything loads, so reading `window.location` later sees the rewrite, not the user's link.
- URL writing is gated on `hasInitialLoaded`, otherwise it erases the deep link before the loader consumes it.
- Deep-link resolution waits on the archive fetch having *settled* (`archivesFetched`), not on `isServerMode`, which is still false while the request is in flight.

### Mobile feed (`src/components/PostFeed.tsx`)

Below `md`, opening a post renders a scrolling feed page rather than the modal (`useIsMobile` decides). Only a window of posts is mounted; it grows both ways, and prepending corrects `scrollTop` in a `useLayoutEffect` so content doesn't jump. Only the post crossing the viewport centre plays its video and drives the URL. Desktop keeps `PostModal`; both share `MediaCarousel`.

### Backend (`server.ts`)

Serves `/api/archives`, `/api/archives/:name/files`, static `/archives`, and the built SPA. Notes:

- Express decodes route params **after** segment matching, so `..%2f` reaches the handler as `../`. All user-supplied archive names go through `resolveArchivePath`.
- Sets CSP and related security headers. The CSP allows `blob:`/`data:` for media and `unsafe-inline` styles (the animation library sets inline styles); scripts stay same-origin only.
- `os.userInfo()` throws for a UID with no `/etc/passwd` entry, which is what `--user 1234:1234` produces — use `describeUser()`.

### Deployment

Container runs as non-root. The image defaults to `node`, but the archive share must be *listable* by that UID — a mode-711 share owned by another account needs `user: "<uid>:<gid>"` in compose. Mount a volume at `/cache` so the index survives restarts.

### PWA / build quirks

- `vite.config.ts` sets `hmr: process.env.DISABLE_HMR !== 'true'` — intentional, leave it.
- `workbox.navigateFallbackDenylist` excludes `/api` and `/archives` so those hit the real server.
- Fonts and icons are vendored in `public/` — do not reintroduce CDN references; the app advertises offline support and local-only processing.
