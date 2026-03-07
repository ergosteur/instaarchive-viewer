# InstaArchive Technical Documentation

## Project Overview

**InstaArchive** is a high-performance, React-based Progressive Web App (PWA) designed to browse and explore archived Instagram data with a native-feeling interface. It allows users to load local archive directories (either official Instagram exports or Instaloader format) and browse posts, reels, and stories.

### Key Technical Features
- **Local Archive Loading:** Uses the `webkitdirectory` API to scan and process local files securely on the client-side.
- **Support for Multiple Formats:** Recognizes official Instagram export structures and Instaloader regex-based naming conventions.
- **Compressed Metadata**: Support for `.json.xz` file decompression using `xz-decompress` (WASM-powered).
- **Dynamic Media Grid**: Customizable grid layouts (1:1 and 3:4 aspect ratios) with adjustable offsets ("bumps") for aesthetic alignment.
- **Story Viewer**: Native-like story experience with segmented progress bars, automated playback, audio controls, and chronological sorting.
- **Auto-Unmute**: Videos default to unmuted when opened in full view for a better user experience.
- **PWA Ready**: Built with `vite-plugin-pwa` for offline capabilities and a standalone application experience.

### Main Technologies
- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS (v4)
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Utility:** Date-fns, clsx, tailwind-merge
- **Decompression**: xz-decompress (WASM)

## Commands
- `npm install`: Install project dependencies.
- `npm run dev`: Start the local development server on port 3000.
- `npm run build`: Generate the production-ready build in the `dist` folder.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Execute TypeScript type-checking (`tsc --noEmit`).

## Development Conventions
- **Component Architecture:** Functional components with modern hooks.
- **State Management**: React `useState`, `useMemo`, and `useCallback` for optimized performance during large archive scans.
- **File Handling:** Privacy-focused client-side scanning of archive directories.
- **Project Structure:**
  - `src/App.tsx`: Main entry point containing application logic and UI components.
  - `src/main.tsx`: React DOM mounting.
  - `src/index.css`: Global styles and Tailwind imports.
  - `vite.config.ts`: Project build and PWA configuration.
