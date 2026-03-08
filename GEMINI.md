# InstaArchive Technical Documentation

## Project Overview

**InstaArchive** is a high-performance, React-based Progressive Web App (PWA) designed to browse and explore archived Instagram data with a native-feeling interface. It supports both local directory loading and self-hosted server modes.

### Key Technical Features
- **Permalinks:** Full synchronization between application state and URL query parameters (`?a=`, `?t=`, `?p=`). Supports deep-linking to archives, tabs, and specific posts. URL parameters are automatically cleaned when navigating back to the archive explorer.
- **Persistent Caching:** Uses `idb-keyval` (IndexedDB) to cache parsed metadata. Subsequent loads of the same archive are near-instant. The cache schema includes `profileMetadata` with consolidated user info and profile picture history.
- **Modular Scanning Logic:** High-performance archive scanning encapsulated in the `useArchiveScanner` hook. It handles multi-format detection (Instagram Export, Instaloader, JSON), batch processing, and yields to the main thread to prevent UI freezing.
- **High-Performance Carousel:** Advanced `PostModal` with:
  - **Preloading:** Intelligently preloads the first two slides immediately, followed by a background preload of the entire carousel.
  - **Seamless Transitions:** Zero-latency slide transitions with optimized Framer Motion variants, removing "black flashes" between images.
  - **Async Decoding:** Utilizes `decoding="async"` to offload image processing from the main thread.
- **Glassy Scanner UI:** Custom-built glassmorphism scanning dashboard with throttled (1s) dynamic blurred backgrounds and a high-density system log.
- **PWA Auto-Updates:** Configured with `autoUpdate` behavior and a periodic (hourly) update check to ensure long-running sessions and installed PWAs always have the latest code.
- **Compressed Metadata:** Support for `.json.xz` file decompression using `xz-decompress` (WASM-powered).
- **Production-Ready Docker:** Multi-stage Docker builds using `node:slim` serving both the Express API and the Vite-built frontend.

### Main Technologies
- **Frontend:** React 19, Vite 6, TypeScript
- **Styling:** Tailwind CSS (v4)
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Persistence:** IndexedDB (`idb-keyval`)
- **Backend:** Express, tsx (for server-side scanning)
- **Decompression:** xz-decompress (WASM)

## Architecture

### State Management
- **`useArchiveScanner` Hook:** Centralized logic for parsing archives and managing results (`allPosts`, `allStories`, `profileMetadata`).
- **Archive Interface:** Unified `ArchiveFile` interface implemented by `LocalArchiveFile` (for browser `File` objects) and `RemoteArchiveFile` (for server-side assets).

### Cache Schema
```typescript
interface CacheData {
  name: string;
  isLocal: boolean;
  fileCount: number;
  posts: Post[];      // Remote archives only (Local archives re-parsed for security)
  stories: Post[];    // Remote archives only
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
- `npm install`: Install project dependencies.
- `npm run dev`: Start the local development server on port 3000.
- `npm run build`: Generate the production-ready build in the `dist` folder and server in `dist-server`.
- `npm run server`: Start the backend server to scan `./_sample-archives`.
- `npm run lint`: Execute TypeScript type-checking.

## Production Deployment
The project is containerized and available on GHCR. It expects a volume mount at `/archives` containing subdirectories for each user.

### Key Environment Variables
- `PORT`: Server port (default: 3000)
- `ARCHIVES_DIR`: Path to the archives collection (default: /archives)
