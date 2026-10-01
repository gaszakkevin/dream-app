/* Offline cache. Bump VERSION whenever any app file or grammar.json changes. */
var VERSION = "dream-v3";
var CORE = [
  "./", "index.html", "styles.css", "engine.js", "app.js",
  "data/grammar.json", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Network first for the grammar (so edits show up), cache first for everything else.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.endsWith("/data/grammar.json")) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req); }));
    return;
  }

  if (sameOrigin && req.mode === "navigate") {
    e.respondWith(caches.match("index.html").then(function (hit) { return hit || fetch(req); }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      // Also keep Google Fonts once seen, so the typefaces work offline.
      if (res.ok && (sameOrigin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname))) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
