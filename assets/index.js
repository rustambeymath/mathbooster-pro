import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, getCountFromServer, limit, orderBy, query, getDocs, collection, runTransaction, onSnapshot, deleteDoc, updateDoc, getDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, onMessage, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
  window._authReady = new Promise(async (resolve) => {
    try {
      const cred = await signInAnonymously(auth);
      console.log("✅ Firebase Auth: UID =", cred.user.uid);
      window._firebaseUID = cred.user.uid;
      resolve(cred.user.uid);
    } catch (e) {
      console.warn("⚠️ Анонимный вход не удался, генерируем fallback ID:", e.message);
      window._firebaseUID = "u" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      resolve(window._firebaseUID);
    }
  });
  window.DB_Online = {
    db,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    runTransaction,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    getCountFromServer,
    messaging,
    getToken,
    onMessage,
    auth
    // Добавили auth для проверки владельца
  };
  window.isFirebaseLoaded = true;
  console.log("✅ БД, Auth и Push-сервер подключены");
} catch (e) {
  console.error("Критическая ошибка Firebase:", e);
}
window.addEventListener("load", () => {
  setTimeout(async () => {
    var _a, _b;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      console.warn("❌ [FCM] Push-уведомления не поддерживаются этим браузером");
      return;
    }
    try {
      console.log("🔧 [FCM] Начинаем инициализацию...");
      let attempts = 0;
      while (!((_a = window.DB_Online) == null ? void 0 : _a.messaging) && attempts < 20) {
        console.log(`⏳ [FCM] Ожидание Firebase Messaging... (${attempts + 1}/20)`);
        await new Promise((r) => setTimeout(r, 500));
        attempts++;
      }
      if (!((_b = window.DB_Online) == null ? void 0 : _b.messaging)) {
        console.error("❌ [FCM] Firebase Messaging не загрузился. Проверьте импорты в начале файла.");
        return;
      }
      console.log("✅ [FCM] Firebase Messaging доступен");
      const registration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
      console.log("✅ [FCM] Service Worker зарегистрирован");
      await navigator.serviceWorker.ready;
      console.log("✅ [FCM] Service Worker готов");
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        console.log("📱 [FCM] Разрешение:", permission);
      }
      if (Notification.permission !== "granted") {
        console.warn("⚠️ [FCM] Доступ к уведомлениям отклонен");
        return;
      }
      const { messaging, getToken: getToken2, onMessage: onMessage2 } = window.DB_Online;
      const token = await getToken2(messaging, {
        vapidKey: "BHMScHHyu4ovNRTDndNKTHovdL5SkrSRFjrkZ6GiTLATTDvir7mGp9iFFzZFpaFoVDhLCI7TPuOSZ08ZotWVBrw",
        serviceWorkerRegistration: registration
      });
      if (token) {
        console.log("✅ [FCM] Токен получен:", token);
        localStorage.setItem("fcm_token", token);
        if (window._gameUserReady && typeof Data !== "undefined" && DB && DB.user && DB.user.id) {
          DB.user.fcmToken = token;
          DB.user.fcmTokenDate = Date.now();
          setTimeout(() => {
            if (typeof Data !== "undefined" && typeof Data.save === "function") {
              Data.save();
              console.log("✅ [FCM] Токен привязан к аккаунту в БД");
            }
          }, 2e3);
        }
      } else {
        console.warn("⚠️ [FCM] Токен не получен. Проверьте настройки Firebase Console.");
      }
      onMessage2(messaging, (payload) => {
        var _a2, _b2, _c, _d;
        console.log("📩 [FCM] Получено сообщение:", payload);
        const title = ((_a2 = payload == null ? void 0 : payload.notification) == null ? void 0 : _a2.title) || "MathBooster Pro";
        const body = ((_b2 = payload == null ? void 0 : payload.notification) == null ? void 0 : _b2.body) || "У вас новое уведомление";
        const type = (_c = payload == null ? void 0 : payload.data) == null ? void 0 : _c.type;
        if (type === "duel_challenge") {
          console.log("📩 [FCM] Duel challenge push — modal handles this");
          return;
        }
        if (type === "parent_status") {
          console.log("📩 [FCM] Parent status push — dashboard handles this");
          return;
        }
        if ((_d = window.App) == null ? void 0 : _d.toast) {
          App.toast(`🔔 ${title}: ${body}`);
        }
      });
      console.log("✅ [FCM] Система уведомлений полностью готова");
    } catch (error) {
      console.error("❌ [FCM] Критическая ошибка инициализации:", error);
    }
  }, 3e3);
});
