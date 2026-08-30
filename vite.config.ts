import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const basePath = process.env.VITE_BASE_PATH || '/';
const cardsPath = resolve(process.cwd(), 'data/cards.json');

function runtimeCardsPlugin(): Plugin {
  return {
    name: 'flash-refresh-runtime-cards',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://flash-refresh.local').pathname;
        if (!pathname.endsWith('/data/cards.json')) return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(readFileSync(cardsPath));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'data/cards.json', source: readFileSync(cardsPath) });
    },
  };
}

function socialMetadataPlugin(): Plugin {
  return {
    name: 'flash-refresh-social-metadata',
    transformIndexHtml(html) {
      const publicOrigin = process.env.VITE_PUBLIC_ORIGIN?.replace(/\/$/, '');
      if (!publicOrigin) return html;
      const imageUrl = `${publicOrigin}/og.png`;
      return html.replace('</head>', `    <meta property="og:image" content="${imageUrl}" />\n    <meta name="twitter:image" content="${imageUrl}" />\n  </head>`);
    },
  };
}

export default defineConfig({
  base: basePath,
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [
    react(),
    runtimeCardsPlugin(),
    socialMetadataPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifestFilename: 'manifest.json',
      includeManifestIcons: false,
      manifest: {
        id: '.',
        name: 'Flash Refresh',
        short_name: 'Flash Refresh',
        description: 'A focused, private flashcard study companion.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: '#F8F7F4',
        background_color: '#F8F7F4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,woff2}'],
        globIgnores: ['data/cards.json', 'og.png'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.method === 'GET' && url.pathname.endsWith('/data/cards.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'flash-refresh-cards',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    sites(),
  ],
});
