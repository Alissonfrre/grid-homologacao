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

const BUILD    = 'h48';
const CACHE    = 'grid-homolog-' + BUILD;
const FALLBACK = './app.html';

const ASSETS = [
  './manifest.json',
];

// ── PRECACHE DE CÓDIGO (05/09, h33) ────────────────────────────────────────
// Por que isto existe: o network-first do h28 só vale DEPOIS que este service
// worker assume a página. No primeiro carregamento após uma publicação, quem
// responde é o cache HTTP do navegador — e o GitHub Pages manda
// `Cache-Control: max-age=600`, então por dez minutos o navegador serve o
// módulo ANTIGO sem perguntar a ninguém. Foi o que aconteceu entre o h31 e o
// h32: `APP_BUILD` dizia h32 e `dados.js` era o do h31.
//
// A correção: no `install` — que roda toda vez que este arquivo muda, e ele
// muda a cada BUILD — buscar cada módulo com `cache: 'reload'`, que ignora o
// cache HTTP, e guardar no cache desta versão. Quando o service worker ativa,
// o código novo já está lá.
//
// Se um arquivo novo for esquecido nesta lista, ele apenas cai no fetch
// normal (network-first) — degrada, não quebra.
const CODIGO = [
  './modulos/crm/acoes.js',
  './modulos/crm/atividades.js',
  './modulos/crm/contatos.js',
  './modulos/crm/conversas.js',
  './modulos/crm/crm.css',
  './modulos/crm/empresa.js',
  './modulos/crm/exemplo.js',
  './modulos/crm/funil.js',
  './modulos/crm/funis.js',
  './modulos/crm/lead.js',
  './modulos/crm/modulo.js',
  './modulos/crm/numeros.js',
  './modulos/crm/painel.js',
  './modulos/treinamentos/modulo.js',
  './nucleo/config.js',
  './nucleo/dados.js',
  './nucleo/design-system-aditivo.css',
  './nucleo/design-system.css',
  './nucleo/estagios.js',
  './nucleo/icones.js',
  './nucleo/navegacao.js',
  './nucleo/plataforma.js',
  './nucleo/sessao.js',
  './nucleo/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all([
        ...ASSETS.map((u) => cache.add(u).catch(() => null)),
        // `cache: 'reload'` é o ponto todo: sem ele, esta busca também sairia
        // do cache HTTP e guardaríamos a versão velha no cache novo.
        ...CODIGO.map((u) => fetch(u, { cache: 'reload' })
          .then((res) => res && res.ok ? cache.put(u, res) : null)
          .catch(() => null))
      ]))
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

  // ── DEFEITO CORRIGIDO EM 05/09 (h28) ──────────────────────────────────────
  // A estrategia era cache-first para TUDO. Como os modulos ES sao importados
  // sem `?v=` (regra do projeto, criada depois do bug do h15), a URL de
  // `nucleo/dados.js` e a mesma em toda versao — entao, uma vez no cache, o
  // arquivo ANTIGO era servido para sempre, mesmo com BUILD novo e cache novo:
  // bastava a pagina pedir o modulo enquanto o service worker antigo ainda
  // controlava, e a copia velha entrava no cache recem-criado.
  //
  // Sintoma real, hoje: o h27 estava publicado, `version.json` e `APP_BUILD`
  // diziam h27, e `dados.js` executando era o do h26 — a correcao de update
  // parcial simplesmente nao existia no navegador.
  //
  // Codigo do app (JS/CSS) passa a ser NETWORK-FIRST: pega da rede e usa o
  // cache so quando ela falha. Continua funcionando offline, e nunca mais
  // mistura versoes. Imagem e fonte seguem cache-first — elas nao mudam sem
  // mudar de nome.
  const ehCodigo = /\.(js|css)$/i.test(url.pathname);

  if (ehCodigo) {
    // `cache: 'reload'` ignora o cache HTTP do proprio navegador. Sem isto, o
    // network-first ainda podia devolver a copia velha: o GitHub Pages manda
    // `Cache-Control: max-age=600`, e por 10 minutos o navegador nem pergunta
    // ao servidor. Sao dois caches em serie, e os dois precisavam ser tratados.
    event.respondWith(
      fetch(req, { cache: 'reload' }).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
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
