const CACHE_NAME = "arcadehub-cache-v1";

const ASSETS_TO_CACHE = [
  // Fichiers de base
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",

  // Fichiers des jeux
  "snake.html",
  "pong.html",
  "tetris.html",
  "space-invaders.html",
  "2048.html",
  "demineur.html",
  "solitaire.html",
  "morpion.html",    // NOUVEAU
  "voiture.html",    // NOUVEAU

  // Sons
  "sounds/ambiance.mp3",
  "sounds/click.mp3",
  "sounds/coin.mp3",
  "sounds/died-space.mp3",
  "sounds/game-over.mp3",
  "sounds/laser-space.mp3",
  "sounds/line-tetris.mp3",
  "sounds/score-pong.mp3",
  "sounds/win.mp3",
  "sounds/eat.mp3",
  "sounds/hit.mp3",
  "sounds/switch.mp3",
  "sounds/clip.mp3",
  "sounds/hit-bullet.mp3",
  "sounds/swoosh.mp3",
  "sounds/flag.mp3",
  "sounds/reveal.mp3",
  "sounds/explosion.mp3",
  "sounds/shuffle.mp3",
  "sounds/card-flip.mp3",
  "sounds/card-deal.mp3",
  "sounds/place-piece.mp3" // NOUVEAU SON POUR MORPION
];

// ... (le reste du fichier sw.js ne change pas) ...
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error("Échec de la mise en cache de certains fichiers : ", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
});