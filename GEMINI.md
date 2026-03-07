# InstaArchive Technical Documentation

## Project Overview

**InstaArchive** is a high-performance, React-based Progressive Web App (PWA) designed to browse and explore archived Instagram data with a native-feeling interface. It supports both local directory loading and self-hosted server modes.

### Key Technical Features
- **Persistent Caching:** Uses `idb-keyval` (IndexedDB) to cache parsed metadata and server-side media URLs. Subsequent loads of the same archive are instant.
- **Glassy Scanner UI:** A custom-built glassmorphism scanning dashboard with throttled (1s) dynamic blurred backgrounds and a high-density system log.
- **Support for Multiple Formats:** Recognizes official Instagram export structures and Instaloader regex-based naming conventions.
- **Compressed Metadata:** Support for `.json.xz` file decompression using `xz-decompress` (WASM-powered).
- **Navigation Protection:** Intercepts browser history (`popstate`) and exit events (`beforeunload`) to prevent session loss while maintaining a "Back to Explorer" SPA flow.
- **Production-Ready Docker:** Multi-stage Docker builds using `node:slim` to serve both the Express API and the Vite-built frontend.

### Main Technologies
- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS (v4)
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Persistence:** IndexedDB (`idb-keyval`)
- **Backend:** Express, tsx (for server-side scanning)
- **Decompression:** xz-decompress (WASM)

## Known Issues
- **Generic Collection Parser:** Currently unreliable for non-Instagram archive structures (e.g., folders with arbitrary media filenames). It may fail to correctly identify or group posts in some environments.

## Commands
- `npm install`: Install project dependencies.
- `npm run dev`: Start the local development server on port 3000.
- `npm run build`: Generate the production-ready build in the `dist` folder.
- `npm run server`: Start the backend server to scan `./_sample-archives`.
- `npm run lint`: Execute TypeScript type-checking.

## Production Deployment
The project is containerized and available on GHCR. It expects a volume mount at `/archives` containing subdirectories for each user.

### Key Environment Variables
- `PORT`: Server port (default: 3000)
- `ARCHIVES_DIR`: Path to the archives collection (default: /archives)

## Development Conventions
- **Username Logic:** The directory name is the definitive source of truth for the account username.
- **State Management:** React `useState`, `useMemo`, and `useCallback` for optimized performance.
- **File Handling:** Uses `RemoteArchiveFile` and `LocalArchiveFile` classes to provide a unified `ArchiveFile` interface for the parser.
