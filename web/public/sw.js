// Kurulabilir uygulama için en küçük servis çalışanı.
// Bilerek önbelleğe yanıt VERMEZ: canlı fiyatlar ve yeni sürümler her zaman ağdan gelir (eski sürümde takılma olmaz).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
