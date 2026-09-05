// GRID — service worker do AMBIENTE DE HOMOLOGAÇÃO
//
// Cópia do sw.js de produção com duas diferenças de propósito:
//   1. BUILD tem prefixo "h" — o nome do cache nunca coincide com o de
//      produção, mesmo por acidente.
//   2. Nada aqui é publicado no site de produção.
//
// AO PUBLICAR UMA VERSÃO NOVA EM HOMOLOGAÇÃO: atualize BUILD aqui, o
// `version` em version.json e o `APP_BUILD` dentro do app.html — os três com
// o mesmo número, exatamente como em produção. A disciplina é a mesma; o que
// muda é o lugar.

const BUILD    = 'h17';
const CACHE    = 'grid-homolog-' + BUILD;
const FALLBACK = './app.html';

const ASSETS = [
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(FALLBACK, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(FALLBACK))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    }))
  );
});
