# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InstaArchive Viewer is a React 19 + Vite 6 PWA for browsing archived Instagram data (both official Instagram exports and Instaloader archives). All archive parsing and media processing happens client-side in the browser — the Express backend only lists/serves files from disk, it never parses archive contents.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start Vite dev server on port 3000 (proxies `/api` and `/archives` to `http://localhost:3001`)
- `npm run server` — start the Express backend (`tsx server.ts`) on port 3001, serving archives from `ARCHIVES_DIR` (defaults to `./_sample-archives`)
- `npm run build` — build frontend to `dist/` (`vite build`) and backend to `dist-server/` (`tsc server.ts ...`)
- `npm run lint` — type-check only (`tsc --noEmit`); there is no separate test suite or linter config
- `npm run clean` — remove `dist/`

For local development you typically need both `npm run dev` and `npm run server` running concurrently — the frontend alone has nothing to talk to for server-mode archives (local-folder mode works without the backend).

## Architecture

### Two archive sources, one data model

The app supports loading archives two ways, unified behind the `ArchiveFile` interface (`src/types/index.ts`, implementations in `src/lib/archive-files.ts`):

- **`LocalArchiveFile`** — wraps a browser `File` from a local folder picker (`webkitdirectory`). Fully offline, media is never uploaded anywhere.
- **`RemoteArchiveFile`** — wraps a file served from the Express backend's `/archives/:name/...` static route, fetched on demand.

All downstream parsing code (`useArchiveScanner`) operates only on `ArchiveFile[]` and doesn't care which backing implementation it got.

### Scanning pipeline (`src/hooks/useArchiveScanner.ts`)

This is the core of the app — a single large `handleFiles` function that:
1. **Indexes** all files, detecting archive format by filename regex: Instagram "export" format (`YYYY-MM-DD_user - post_id[- idx][- story].ext`), Instaloader format (`YYYY-MM-DD_HH-MM-SS_UTC[_idx][_story].ext`), or a generic JSON-manifest format (`posts_1.json`, `reels_1.json`, `stories_1.json`, possibly `.json.xz`-compressed via `xz-decompress`).
2. **Parses** according to detected format, building a `Map<postId, Partial<Post>>`. For JSON-manifest format, media files are matched to JSON entries by URI substring match, then by ID substring match, then by filename-derived heuristic — in that fallback order.
3. **Falls back** to generic filename-prefix grouping when no posts were found via regex/JSON matching (treats files sharing a common basename as one carousel post, chunked into groups of 20).
4. Detects a **profile picture** from `*_profile_pic.jpg` / `<username>.jpg` files, or falls back to the oldest image in the archive by filename sort ("Smart Fallback").
5. **Caches** the final `{ posts, stories, profileMetadata, ... }` result to IndexedDB via `idb-keyval`, keyed by archive name (or `local_archive` for unnamed local folders) — this is what makes repeat visits load instantly. Both server and local archives are cached; the cache shape is documented inline in `useArchiveScanner`'s state (mirrors the `CacheData` interface in `GEMINI.md`).

When modifying format-detection or media-matching logic, be aware the three code paths (JSON-manifest, filename-regex export/instaloader, generic fallback) are largely independent and a change to one rarely needs to touch the others — but all three write into the same `postsMap`.

### Thumbnail generation (`src/hooks/useThumbnailQueue.ts` + `src/lib/thumbnail-worker.ts`)

High-res images (>1MiB) are downscaled off the main thread:
- `useThumbnailQueue` maintains a **serial** (one-at-a-time) queue — this is deliberate, not a bug: decoding multiple 50MP+ images concurrently causes OOM crashes in the browser.
- Actual resizing happens in `thumbnail-worker.ts` using `OffscreenCanvas`/`createImageBitmap` inside a Web Worker.
- Results are cached in IndexedDB under a `thumb_<id>` key, checked before falling back to the worker, so thumbnails persist across sessions.

### URL state sync (`src/App.tsx`)

App state (selected archive, active tab, selected post) is synchronized with URL query params (`?a=`, `?t=`, `?p=`) via `URLSearchParams` + `window.history.replaceState` in a cluster of `useEffect` hooks — this is what enables permalinks/deep-linking. When adding new shareable state, follow this pattern rather than introducing a router.

### Backend (`server.ts`)

Minimal Express server, three responsibilities only:
- `GET /api/archives` — lists subdirectories of `ARCHIVES_DIR` (skipping dotfiles/`@`/`_`-prefixed dirs) as `ServerArchive[]`, guessing a thumbnail per archive.
- `GET /api/archives/:name/files` — recursively lists all files in one archive directory.
- Static-serves `ARCHIVES_DIR` under `/archives` and, in production, serves the built `dist/` frontend with an SPA fallback.

It does no parsing of archive/JSON contents — that's entirely client-side in `useArchiveScanner`. `ARCHIVES_DIR` is resolved from the `ARCHIVES_DIR` env var (see `.env` / Docker volume mount at `/archives`).

### PWA / build quirks

- `vite.config.ts` sets `hmr: process.env.DISABLE_HMR !== 'true'` — this is intentionally left alone; it exists to disable file-watch flicker when running under AI Studio-style agent editing. Don't "clean up" or remove it.
- `workbox.navigateFallbackDenylist` excludes `/api` and `/archives` from the SPA fallback so those routes hit the real server/static files instead of `index.html` (needed for "open original file in new tab").
- Service worker uses `registerType: 'autoUpdate'` with hourly periodic checks — new deployments propagate to open clients automatically.
