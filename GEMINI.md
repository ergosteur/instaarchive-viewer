# GEMINI.md

## Project Overview

**InstaArchive** is a high-performance, React-based Progressive Web App (PWA) designed to browse and explore archived Instagram data with a native-feeling interface. It allows users to load their local Instagram archive directories (either official Instagram exports or Instaloader format) and browse posts, reels, and stories in a modern, responsive grid view.

### Key Features
- **Local Archive Loading:** Uses the `webkitdirectory` API to scan and process local files securely on the client-side.
- **Support for Multiple Formats:** Recognizes official Instagram export structures and Instaloader regex-based naming conventions.
- **Dynamic Media Grid:** Customizable grid layouts (1:1 and 3:4 aspect ratios) with adjustable offsets ("bumps") for aesthetic alignment.
- **Story Viewer:** Native-like story experience with progress bars, automated playback, and touch/click navigation.
- **Post Detail Modal:** Comprehensive view for posts with media carousels, captions, and seamless navigation between posts.
- **Video Support:** Automatic video thumbnail generation and playback.
- **PWA Ready:** Built with `vite-plugin-pwa` for offline capabilities and a standalone application experience.

### Main Technologies
- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS (v4)
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Utility:** Date-fns, clsx, tailwind-merge
- **PWA:** vite-plugin-pwa

*Note: While `better-sqlite3`, `express`, and `@google/genai` are listed in `package.json`, the current core application logic is entirely frontend-driven.*

## Building and Running

### Prerequisites
- Node.js (Latest LTS recommended)
- npm or yarn

### Commands
- `npm install`: Install project dependencies.
- `npm run dev`: Start the local development server on port 3000.
- `npm run build`: Generate the production-ready build in the `dist` folder.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Execute TypeScript type-checking (`tsc --noEmit`).
- `npm run clean`: Remove the `dist` directory.

### Environment Variables
- `GEMINI_API_KEY`: Required for AI-integrated features (though currently unutilized in core logic).
- `DISABLE_HMR`: If set to `true` (standard in AI Studio environments), Hot Module Replacement is disabled to prevent flickering during agent-driven edits.

## Development Conventions

- **Component Architecture:** Functional components with modern hooks. All main application logic currently resides in `src/App.tsx`.
- **Styling Strategy:** Utility-first CSS using Tailwind CSS v4. Styles are largely co-located with components.
- **Type Safety:** Strict TypeScript usage for all components and utility functions.
- **Iconography:** Consistent use of `lucide-react` for all UI icons.
- **Animations:** Smooth transitions and gestures powered by `motion/react`.
- **File Handling:** Privacy-focused client-side scanning of archive directories using browser-native APIs.
- **Project Structure:**
  - `src/App.tsx`: Main entry point and core application logic.
  - `src/main.tsx`: React DOM mounting.
  - `src/index.css`: Global styles and Tailwind imports.
  - `vite.config.ts`: Project build and PWA configuration.
  - `metadata.json`: Project description for external integration tools.
