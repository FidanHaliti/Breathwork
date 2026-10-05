import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, existsSync } from 'node:fs';

function offlineCache() {
  return {
    name: 'breathwork-offline',
    generateBundle(_, bundle) {
      const audioFiles = existsSync('public/audio') ? readdirSync('public/audio', { recursive: true }).filter(file => /\.(mp3|wav|ogg|m4a|flac)$/i.test(file)).map(file => `/audio/${file.replaceAll('\\', '/')}`) : [];
      const files = ['/', '/index.html', '/favicon.svg', ...audioFiles, ...Object.keys(bundle).map((file) => `/${file}`)];
      // A fresh cache version also updates audio when only an audio file changes.
      const version = `${Object.keys(bundle).filter((file) => file.endsWith('.js')).join('|')}-${Date.now()}`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify(`breathwork-${version}`)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('breathwork-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Serve full cached audio responses for range requests too; browsers can play them offline.
  event.respondWith(caches.match(event.request.url).then(cached => cached || fetch(event.request)));
});
` });
    },
  };
}

export default defineConfig({ plugins: [react(), offlineCache()] });
