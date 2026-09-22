
    // 🍎 iOS PWA: раньше здесь была жёсткая очистка ВСЕХ кэшей и разрегистрация SW
    // при каждом открытии — из-за этого приложение на iOS работало медленно,
    // оффлайн-режим не работал, а push-токены слетали.
    // Теперь — одноразовая миграция (если SW устарел, он обновится сам): 
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !localStorage.getItem('sw_migrated_v2')) {
        try {
            if ('caches' in window) {
                caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
            }
            if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())));
            }
            localStorage.setItem('sw_migrated_v2', '1');
        } catch(e) { /* не критично */ }
    }

    // Плавное исчезновение splash через 1.8 секунды после загрузки
    
    