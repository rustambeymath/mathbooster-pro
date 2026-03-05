importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Конфигурация Firebase
firebase.initializeApp({
    apiKey: "AIzaSyAK4kX2dl93WlpEFLg_eGvpvoeAAF935tQ",
    authDomain: "mathbooster-pro.firebaseapp.com",
    projectId: "mathbooster-pro",
    storageBucket: "mathbooster-pro.firebasestorage.app",
    messagingSenderId: "990295839020",
    appId: "1:990295839020:web:ba5bb8cfa471c2c4a89c89",
    measurementId: "G-8N8MYJPCHR"
});

const messaging = firebase.messaging();

// Обработка фоновых уведомлений (когда приложение закрыто/свернуто)
messaging.onBackgroundMessage(function(payload) {
    console.log('[SW] Получено фоновое уведомление:', payload);
    
    const notificationTitle = payload.notification.title || 'MathBooster PRO';
    const notificationOptions = {
        body: payload.notification.body || 'Новое уведомление',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'mathbooster-notification',
        requireInteraction: false
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Клик по уведомлению:', event);
    
    event.notification.close();
    
    // Открываем/фокусируем приложение
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                // Если приложение уже открыто - фокусируемся на нем
                for (let i = 0; i < clientList.length; i++) {
                    let client = clientList[i];
                    if (client.url.includes('mathbooster') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Если не открыто - открываем новое окно
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});
