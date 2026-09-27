import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps the build host-anywhere (GitHub Pages subpath, Netlify, plain file server).
// Routing is hash-based for the same reason: no server rewrite rules needed.
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script', // plain script tag; the virtual:pwa-register import doesn't resolve under Vite 8 yet
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'Shifts',
        short_name: 'Shifts',
        description: 'Log shifts and tips. Works offline, syncs to your Google Sheet.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b1110',
        theme_color: '#0b1110',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ]
});
