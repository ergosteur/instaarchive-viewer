import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with automatic updates
// and a periodic check every hour to ensure long-running sessions stay fresh.
const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      // Check for updates every hour
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
      console.log('[PWA] Service Worker registered and update interval set.');
    }
  },
  onNeedRefresh() {
    console.log('[PWA] New content available, reloading...');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
