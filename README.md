# InstaArchive Viewer

A high-performance React PWA for browsing archived Instagram data with a native-feeling interface. Supports both official Instagram exports and Instaloader archives.

## Features

- **Local Privacy**: All processing is done client-side using browser APIs. Your data never leaves your computer.
- **Multiple Formats**: Supports official Instagram JSON exports and Instaloader regex-based naming conventions.
- **Metadata Support**: Robust parsing of `.json` and `.json.xz` files for captions, timestamps, and story metadata.
- **Story Viewer**: Native-like story experience with segmented progress bars, auto-playback, and audio controls.
- **Media Grid**: Customizable 1:1 or 3:4 grid views with adjustable offsets for aesthetic alignment.
- **Auto-Deduplication**: Intelligently prefers video files over thumbnail images for the same post.

## Run Locally

**Prerequisites:** Node.js (LTS recommended)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000` and select your Instagram archive directory.

## Building for Production

To generate a production-ready build in the `dist` folder:

```bash
npm run build
```

To preview the build:

```bash
npm run preview
```
