import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { validateDeckFiles } from './src/lib/content.ts';

const basePath = process.env.VITE_BASE_PATH || '/';
const decksDirectory = resolve(process.cwd(), 'data/decks');

type DeckAsset = {
  fileName: string;
  source: string;
};

function readDeckAssets(): DeckAsset[] {
  if (!existsSync(decksDirectory)) throw new Error('The data/decks directory is missing.');

  const assets = readdirSync(decksDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => ({ fileName: entry.name, source: readFileSync(resolve(decksDirectory, entry.name), 'utf8') }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));

  const parsed = assets.map(({ fileName, source }) => {
    try {
      return JSON.parse(source) as unknown;
    } catch {
      throw new Error(`Deck file ${fileName} is not valid JSON.`);
    }
  });
  validateDeckFiles(parsed);
  return assets;
}

function manifestSource(assets: DeckAsset[]): string {
  return `${JSON.stringify({ files: assets.map(({ fileName }) => `data/decks/${fileName}`) }, null, 2)}\n`;
}

function runtimeDecksPlugin(): Plugin {
  return {
    name: 'flash-refresh-runtime-decks',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://flash-refresh.local').pathname;
        if (!pathname.endsWith('/data/decks.json') && !pathname.includes('/data/decks/')) return next();
        const assets = readDeckAssets();
        const requestedFile = pathname.split('/data/decks/')[1];
        const asset = requestedFile ? assets.find(({ fileName }) => fileName === decodeURIComponent(requestedFile)) : undefined;
        if (requestedFile && !asset) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(asset?.source ?? manifestSource(assets));
      });
    },
    generateBundle() {
      const assets = readDeckAssets();
      this.emitFile({ type: 'asset', fileName: 'data/decks.json', source: manifestSource(assets) });
      assets.forEach(({ fileName, source }) => {
        this.emitFile({ type: 'asset', fileName: `data/decks/${fileName}`, source });
      });
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
    runtimeDecksPlugin(),
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
        globIgnores: ['data/decks.json', 'data/decks/*.json', 'og.png'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.method === 'GET' && (
              url.pathname.endsWith('/data/decks.json') || /\/data\/decks\/[^/]+\.json$/.test(url.pathname)
            ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'flash-refresh-decks',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    sites(),
  ],
});
