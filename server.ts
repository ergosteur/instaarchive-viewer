import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ARCHIVES_DIR = path.resolve(process.env.ARCHIVES_DIR || path.join(__dirname, '_sample-archives'));

console.log(`[Server] Initializing...`);
console.log(`[Server] Running as user: ${os.userInfo().username} (UID: ${os.userInfo().uid}, GID: ${os.userInfo().gid})`);
console.log(`[Server] Environment ARCHIVES_DIR: ${process.env.ARCHIVES_DIR}`);
console.log(`[Server] Resolved ARCHIVES_DIR: ${ARCHIVES_DIR}`);

// Ensure archives directory exists
if (!fs.existsSync(ARCHIVES_DIR)) {
  console.warn(`[Server] Warning: Archives directory not found at ${ARCHIVES_DIR}. Creating it...`);
  try {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  } catch (err) {
    console.error(`[Server] Failed to create archives directory:`, err);
  }
} else {
  console.log(`[Server] Archives directory exists.`);
}

app.use(express.json());

// API: List archives (subdirectories in ARCHIVES_DIR)
app.get('/api/archives', (req, res) => {
  try {
    console.log(`[API] Listing archives from ${ARCHIVES_DIR}...`);
    const items = fs.readdirSync(ARCHIVES_DIR, { withFileTypes: true });
    console.log(`[API] Found ${items.length} total items in archives directory.`);
    
    const archives = items
      .filter(item => {
        const isDir = item.isDirectory();
        const isHidden = item.name.startsWith('.') || item.name.startsWith('@') || item.name.startsWith('_');
        if (!isDir) return false;
        if (isHidden) {
          console.log(`[API] Skipping system/hidden directory: ${item.name}`);
          return false;
        }
        return true;
      })
      .map(item => {
        // Try to find a profile pic or first image for the thumbnail
        const archivePath = path.join(ARCHIVES_DIR, item.name);
        try {
          const files = fs.readdirSync(archivePath);
          console.log(`[API] Found archive: ${item.name} (${files.length} files)`);
          
          let thumbnail = '';
          const profilePic = files.find(f => f.toLowerCase().includes('_profile_pic.jpg') || f.toLowerCase() === `${item.name.toLowerCase()}.jpg`);
          if (profilePic) {
            thumbnail = `/archives/${item.name}/${profilePic}`;
          } else {
            const firstImage = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
            if (firstImage) thumbnail = `/archives/${item.name}/${firstImage}`;
          }

          return {
            name: item.name,
            thumbnail,
            path: item.name,
            fileCount: files.length
          };
        } catch (e) {
          console.error(`[API] Could not read subdirectory ${item.name}:`, e);
          return null;
        }
      })
      .filter(Boolean);
    
    console.log(`[API] Returning ${archives.length} validated archives.`);
    res.json(archives);
  } catch (err: any) {
    if (err.code === 'EACCES') {
      console.error(`[API] Permission Denied! The server (UID ${os.userInfo().uid}) cannot read ${ARCHIVES_DIR}.`);
      console.error(`[API] Hint: If using Linux/Docker, check folder permissions (chmod 755) or SELinux context (append :z to your volume mount).`);
    } else {
      console.error('[API] Error listing archives:', err);
    }
    res.status(500).json({ error: 'Permission denied or failed to list archives' });
  }
});

// API: List all files in an archive (recursive)
app.get('/api/archives/:name/files', (req, res) => {
  const archiveName = req.params.name;
  const archivePath = path.join(ARCHIVES_DIR, archiveName);

  if (!fs.existsSync(archivePath)) {
    return res.status(404).json({ error: 'Archive not found' });
  }

  try {
    const walk = (dir: string, base: string = ''): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const filePath = path.join(dir, file);
        const relativePath = path.join(base, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(filePath, relativePath));
        } else {
          results.push(relativePath);
        }
      });
      return results;
    };

    const files = walk(archivePath);
    res.json(files);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Serve archive files
app.use('/archives', express.static(ARCHIVES_DIR));

// Serve production frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving archives from: ${ARCHIVES_DIR}`);
});
