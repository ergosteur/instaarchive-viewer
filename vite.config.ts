import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'InstaArchive',
          short_name: 'InstaArchive',
          description: 'Browse your archived Instagram data with a native-feeling interface.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api/, /^\/archives/],
          // Fonts and icons are bundled locally, so everything the shell needs
          // is precached and no runtime third-party caching rule is required.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://localhost:3001',
        '/archives': 'http://localhost:3001',
      },
    },
  };
});
