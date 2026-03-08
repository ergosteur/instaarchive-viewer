# InstaArchive Viewer

A high-performance React PWA for browsing archived Instagram data with a native-feeling interface. Supports both official Instagram exports and Instaloader archives.

## Features

- **Advanced Carousel**: Seamless, zero-latency transitions between slides with intelligent preloading. Images use asynchronous decoding to keep the UI smooth during motion.
- **Persistent Caching**: Uses IndexedDB to store parsed archives locally. Subsequent loads are near-instant, with full support for profile metadata and profile picture history.
- **Permalinks**: State is synchronized with the URL, allowing you to share direct links to archives, tabs, or specific posts. Navigating back to the explorer cleans up URL parameters automatically.
- **Glassy Scanning UI**: A modern, translucent white terminal experience with a dynamic blurred background generated from your media during scanning.
- **PWA with Auto-Update**: Fully offline-capable and installable. Clients automatically receive updates when a new version is deployed to the server.
- **Local Privacy**: All processing is done client-side. Even when using the self-hosted version, your media is processed locally in your browser and never uploaded.
- **Story Viewer**: Native-like story experience with segmented progress bars, auto-playback, and audio controls.
- **Customizable Grid**: 1:1 or 3:4 aspect ratios with adjustable "bumps" for aesthetic alignment.
- **Navigation Protection**: Intercepts accidental browser "Back" or "Refresh" actions to protect your current session.

## Deployment

### Docker (Recommended)

The easiest way to run InstaArchive is using Docker.

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/your/archives:/archives:ro \
  ghcr.io/ergosteur/instaarchive-viewer:latest
```

> **Note for Linux/SELinux users:** If you see "Permission Denied" in the logs, append `,z` to your volume mount: `-v /path/to/archives:/archives:ro,z`

### Docker Compose

Create a `compose.yml` file:

```yaml
services:
  instaarchive:
    image: ghcr.io/ergosteur/instaarchive-viewer:latest
    ports:
      - "3000:3000"
    volumes:
      - ./archives:/archives:ro,z # ,z handles SELinux permissions
```

### Troubleshooting Permissions

If the app shows "No Archives Found" and logs `EACCES: permission denied`:

1. **Check Directory Permissions**: Ensure the archive folder is world-readable:
   ```bash
   chmod -R 755 /path/to/archives
   ```
2. **SELinux (Fedora/RHEL/CentOS)**: Use the `:z` flag in your volume mount as shown above.
3. **User Mapping**: You can force the container to run as your host user:
   ```bash
   docker run --user $(id -u):$(id -g) ...
   ```

## Supported Archive Structure

Place your archive folders inside the mounted `/archives` directory. The directory name will be used as the account username.

### Example Structure:
```text
archives/
├── wanderlust_explorer/          # Instaloader format
│   ├── 2024-01-01_12-00-00_UTC.jpg
│   ├── 2024-01-01_12-00-00_UTC.json.xz
│   └── wanderlust_explorer_profile_pic.jpg
└── pixel_architect/             # Instagram Export format
    ├── 2023-12-25_pixel_architect - post_123.jpg
    ├── 2023-12-25_pixel_architect - post_123.json
    └── pixel_architect.jpg
```

## Local Development

**Prerequisites:** Node.js (LTS recommended)

1. **Install dependencies:** `npm install`
2. **Start dev server:** `npm run dev` (Frontend on port 3000)
3. **Start local backend:** `npm run server` (Optional, serves `./_sample-archives` on port 3001)
4. **Build production:** `npm run build` (Generates `./dist` for frontend and `./dist-server` for the API)
