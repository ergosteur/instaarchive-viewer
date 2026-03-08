# InstaArchive Technical Documentation

## Project Overview

**InstaArchive** is a high-performance, React-based Progressive Web App (PWA) designed to browse and explore archived Instagram data with a native-feeling interface. It supports both local directory loading and self-hosted server modes.

### Key Technical Features
- **Permalinks:** Full synchronization between application state and URL query parameters (`?a=`, `?t=`, `?p=`). Supports deep-linking to archives, tabs, and specific posts. URL parameters are automatically cleaned when navigating back to the archive explorer.
- **Persistent Caching:** Uses `idb-keyval` (IndexedDB) to cache parsed metadata. Subsequent loads are near-instant.
  - **Metadata:** Caches profile info and post lists for both remote AND local archives.
  - **Thumbnails:** High-res images (>1MiB) and videos have thumbnails generated and cached in IndexedDB with the `thumb_` prefix.
- **Background Media Processing:**
  - **High-Res Images:** A dedicated Web Worker (`thumbnail-worker.ts`) handles image resizing using `OffscreenCanvas` and `createImageBitmap` to prevent main-thread jank.
  - **Serial Queue:** A memory-safe queue ensures only one high-res image is decoded at a time, preventing Out-of-Memory (OOM) crashes on 50MP+ files.
- **High-Performance Carousel:** Advanced `PostModal` with:
  - **Inter-Post Preloading:** Preloads the first media of adjacent posts for instant navigation.
  - **Intra-Carousel Preloading:** Intelligently preloads the current carousel's slides.
  - **Seamless Transitions:** Zero-latency slide transitions without "black flashes" between images.
- **Glassy Scanner UI:** Custom-built glassmorphism scanning dashboard with double-buffering logic to ensure smooth, flicker-free background crossfades during file indexing.
- **PWA Capabilities:** 
  - **Auto-Updates:** Hourly periodic update checks.
  - **Navigation Fix:** `navigateFallbackDenylist` allows direct server access to `/archives/` and `/api/` (enabling "Open in new tab" for original files).

### Main Technologies
- **Frontend:** React 19, Vite 6, TypeScript
- **Styling:** Tailwind CSS (v4)
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Persistence:** IndexedDB (`idb-keyval`)
- **Backend:** Express, tsx
- **Workers:** Web Workers for background image processing.

## Architecture

### State Management
- **`useArchiveScanner` Hook:** Centralized logic for parsing and caching. It handles folder-name-to-username detection and "Smart Fallback" profile pictures (using the oldest image if no profile pic is found).
- **`useThumbnailQueue` Hook:** Manages the serial processing of high-resolution media.

### Cache Schema
```typescript
interface CacheData {
  name: string;
  isLocal: boolean;
  fileCount: number;
  posts: Post[];      // Cached for all archive types
  stories: Post[];
  profileMetadata: {
    username: string;
    fullName: string;
    bio: string;
    followerCount: number;
    followingCount: number;
    externalUrl: string;
    profilePic: string | null;
    allProfilePics: string[];
  };
  timestamp: number;
}
```

## Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start dev server (Port 3000).
- `npm run build`: Build frontend (`dist/`) and server (`dist-server/`).
- `npm run server`: Start production-ready backend.
- `npm run lint`: Execute TypeScript type-checking.

## Production Deployment
The project is containerized. It expects a volume mount at `/archives` containing subdirectories for each user.
