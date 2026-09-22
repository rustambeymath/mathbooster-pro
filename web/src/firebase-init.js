
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, collection, getDocs, query, orderBy, limit, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    // ДОБАВЛЕН ИМПОРТ СООБЩЕНИЙ
    import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
    // 🔐 FIREBASE AUTHENTICATION (Анонимный вход)
    import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

    const firebaseConfig = {
        apiKey: "AIzaSyAK4kX2dl93WlpEFLg_eGvpvoeAAF935tQ",
        authDomain: "mathbooster-pro.firebaseapp.com",
        projectId: "mathbooster-pro",
        storageBucket: "mathbooster-pro.firebasestorage.app",
        messagingSenderId: "990295839020",
        appId: "1:990295839020:web:ba5bb8cfa471c2c4a89c89",
        measurementId: "G-8N8MYJPCHR"
    };

    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const messaging = getMessaging(app);
        const auth = getAuth(app);

        // 🔐 Анонимный вход — каждый пользователь получает уникальный UID
        window._authReady = new Promise(async (resolve) => {
            try {
                const cred = await signInAnonymously(auth);
                console.log("✅ Firebase Auth: UID =", cred.user.uid);
                window._firebaseUID = cred.user.uid;
                resolve(cred.user.uid);
            } catch(e) {
                console.warn("⚠️ Анонимный вход не удался, генерируем fallback ID:", e.message);
                window._firebaseUID = 'u' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
                resolve(window._firebaseUID);
            }
        });

        window.DB_Online = { 
            db, doc, setDoc, getDoc, updateDoc, deleteDoc, 
            onSnapshot, runTransaction, 
            collection, getDocs, query, orderBy, limit, getCountFromServer,
            messaging, getToken, onMessage,
            auth // Добавили auth для проверки владельца
        };
        
        window.isFirebaseLoaded = true;
        console.log("✅ БД, Auth и Push-сервер подключены");
    } catch(e) {
        console.error("Критическая ошибка Firebase:", e);
    }

    // 🛡️ ЗАЩИТА УБРАНА: dummy window.DB/window.Data только мешали (ломали биндинг FCM-токена
    // и вводили в заблуждение). Реальные данные защищают Firestore Rules + Cloud Functions.

// === FIREBASE CLOUD MESSAGING (ЕДИНСТВЕННЫЙ БЛОК!) ===

window.addEventListener('load', () => {
    // Запускаем инициализацию через 3 секунды после загрузки страницы
    setTimeout(async () => {
        // 1. Проверка поддержки браузером
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
            console.warn('❌ [FCM] Push-уведомления не поддерживаются этим браузером');
            return;
        }
        
        try {
            console.log('🔧 [FCM] Начинаем инициализацию...');
            
            // 2. Ждём загрузки модульного Firebase (максимум 10 секунд)
            let attempts = 0;
            while (!window.DB_Online?.messaging && attempts < 20) {
                console.log(`⏳ [FCM] Ожидание Firebase Messaging... (${attempts + 1}/20)`);
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
            
            if (!window.DB_Online?.messaging) {
                console.error('❌ [FCM] Firebase Messaging не загрузился. Проверьте импорты в начале файла.');
                return;
            }
            
            console.log('✅ [FCM] Firebase Messaging доступен');
            
            // 3. Регистрируем Service Worker (путь БЕЗ слеша в начале для GitHub Pages)
            const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            console.log('✅ [FCM] Service Worker зарегистрирован');
            
            await navigator.serviceWorker.ready;
            console.log('✅ [FCM] Service Worker готов');
            
            // 4. Запрашиваем разрешение на уведомления
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                console.log('📱 [FCM] Разрешение:', permission);
            }
            
            if (Notification.permission !== 'granted') {
                console.warn('⚠️ [FCM] Доступ к уведомлениям отклонен');
                return;
            }
            
            // 5. Получаем токен устройства
            const { messaging, getToken, onMessage } = window.DB_Online;
            
            const token = await getToken(messaging, {
                vapidKey: 'BHMScHHyu4ovNRTDndNKTHovdL5SkrSRFjrkZ6GiTLATTDvir7mGp9iFFzZFpaFoVDhLCI7TPuOSZ08ZotWVBrw',
                serviceWorkerRegistration: registration
            });
            
            if (token) {
                console.log('✅ [FCM] Токен получен:', token);
                localStorage.setItem('fcm_token', token);
                
                // Привязываем токен к игровому профилю, если игрок уже вошёл
                if (window._gameUserReady && typeof Data !== 'undefined' && DB && DB.user && DB.user.id) {
                    DB.user.fcmToken = token;
                    DB.user.fcmTokenDate = Date.now(); // Для Cloud Functions
                    // Сохраняем в облако через 2 секунды
                    setTimeout(() => {
                        if (typeof Data !== 'undefined' && typeof Data.save === 'function') {
                            Data.save();
                            console.log('✅ [FCM] Токен привязан к аккаунту в БД');
                        }
                    }, 2000);
                }
            } else {
                console.warn('⚠️ [FCM] Токен не получен. Проверьте настройки Firebase Console.');
            }
            
            // 6. Слушатель уведомлений, когда приложение ОТКРЫТО
            onMessage(messaging, (payload) => {
                console.log('📩 [FCM] Получено сообщение:', payload);
                const title = payload?.notification?.title || 'MathBooster Pro';
                const body = payload?.notification?.body || 'У вас новое уведомление';
                const type = payload?.data?.type;
                
                // Если это вызов на дуэль — НЕ показываем тост, потому что модалка уже появится через onSnapshot
                if (type === 'duel_challenge') {
                    console.log('📩 [FCM] Duel challenge push — modal handles this');
                    return;
                }
                // parent_status обрабатывает локальный onSnapshot дашборда родителя
                // (ding + тост) — здесь НЕ дублируем, иначе 2 тоста за раз
                if (type === 'parent_status') {
                    console.log('📩 [FCM] Parent status push — dashboard handles this');
                    return;
                }
                
                // Для остальных уведомлений — показываем тост
                if (window.App?.toast) {
                    App.toast(`🔔 ${title}: ${body}`);
                }
                // Системное уведомление НЕ показываем — Service Worker покажет его когда приложение закрыто
            });
            
            console.log('✅ [FCM] Система уведомлений полностью готова');
            
        } catch (error) {
            console.error('❌ [FCM] Критическая ошибка инициализации:', error);
        }
    }, 3000);
});

        