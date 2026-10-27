// Service worker mínimo do Buba Promo: necessário para mostrar notificações no celular (Android)
// e para abrir a promoção quando o usuário toca na notificação.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || '/notificar.html';
  evento.waitUntil(self.clients.openWindow(url));
});
