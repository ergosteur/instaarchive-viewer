import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ARCHIVES_DIR = process.env.ARCHIVES_DIR || path.join(__dirname, '_sample-archives');

// Ensure archives directory exists
if (!fs.existsSync(ARCHIVES_DIR)) {
  console.warn(`Warning: Archives directory not found at ${ARCHIVES_DIR}. Creating it...`);
  fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}

app.use(express.json());

// API: List archives (subdirectories in ARCHIVES_DIR)
app.get('/api/archives', (req, res) => {
  try {
    const items = fs.readdirSync(ARCHIVES_DIR, { withFileTypes: true });
    const archives = items
      .filter(item => item.isDirectory())
      .map(item => {
        // Try to find a profile pic or first image for the thumbnail
        const archivePath = path.join(ARCHIVES_DIR, item.name);
        const files = fs.readdirSync(archivePath);
        
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
      });
    res.json(archives);
  } catch (err) {
    console.error('Error listing archives:', err);
    res.status(500).json({ error: 'Failed to list archives' });
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
