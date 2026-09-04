importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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

function playSound(type) {
    try {
        var ctx = new (self.AudioContext || self.webkitAudioContext)();
        if (type === 'check') {
            [660, 880, 1100].forEach(function(freq, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.2);
                osc.stop(ctx.currentTime + i * 0.2 + 0.6);
            });
        } else if (type === 'duel') {
            // ⚔️ Звук вызова на дуэль (металлический звон)
            [1800, 1200, 800, 1200].forEach(function(freq, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.12);
                osc.stop(ctx.currentTime + i * 0.12 + 0.35);
            });
        } else {
            [880, 1100].forEach(function(freq, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.5);
            });
        }
    } catch(e) {}
}

messaging.onBackgroundMessage(function(payload) {
    console.log('[SW] Background message:', payload);
    
    // Если приложение открыто — НЕ показываем уведомление (onMessage в странице покажет тост)
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
        var appOpen = false;
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].visibilityState === 'visible') {
                appOpen = true;
                break;
            }
        }
        if (appOpen) {
            console.log('[SW] App is open — skip notification (page handles it)');
            return;
        }
        
        // Приложение закрыто — показываем системное уведомление
        var data = payload.data || {};
        var type = data.type || 'default';
        var title = (payload.notification && payload.notification.title) || 'MathBooster PRO';
        var body = (payload.notification && payload.notification.body) || '';
        var isDuel = (type === 'duel_challenge');
        var isCheck = (type === 'afk_check' || title.indexOf('роверк') > -1);
        var soundType = isCheck ? 'check' : (isDuel ? 'duel' : 'status');
        playSound(soundType);
        self.registration.showNotification(title, {
            body: body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: isDuel ? 'duel-challenge' : (isCheck ? 'afk-check' : 'parent-status'),
            requireInteraction: isDuel || isCheck,
            vibrate: isDuel ? [200, 50, 200, 50, 400] : (isCheck ? [300, 100, 300, 100, 300] : [200, 100, 200]),
            data: { url: '/', type: type, battleCode: data.battleCode || null }
        });
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].url.indexOf('mathbooster') > -1 && 'focus' in list[i]) {
                    return list[i].focus();
                }
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});

self.addEventListener('message', function(event) {
    var data = event.data;
    if (data && data.type === 'check-sound') playSound('check');
    else if (data && data.type === 'status-sound') playSound('status');
});
