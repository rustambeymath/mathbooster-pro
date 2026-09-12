/**
 * 🔔 MathBooster Pro — Push-уведомления родителям
 *
 * ЭТА ФУНКЦИЯ ЗАПУСКАЕТСЯ НА СЕРВЕРЕ Firebase (не в браузере).
 *
 * Триггер: изменение документа transfers/{code}
 * Действие: отправка FCM push-уведомления всем родителям, которые
 *           подписались на этого ребёнка (их токены в parentTokens/{code}/tokens/*).
 *
 * Как развернуть:
 *   1. cd functions && npm install
 *   2. firebase deploy --only functions
 *
 * Файл .firebaserc (в корне проекта):
 *   { "projects": { "default": "mathbooster-pro" } }
 */

const functions = require("firebase-functions/v1"); // v7 SDK: старый API (document().onWrite, pubsub.schedule) живёт в /v1
const admin = require("firebase-admin");
// firebase-admin v14+: top-level admin.firestore()/admin.messaging() УДАЛЕНЫ —
// доступ только через deep-импорты
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// ⚡ ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ — критично для деплоя!
// admin.initializeApp() при загрузке модуля вешает проверку кода CLI
// (Timeout after 10000). Инициализируем только при первом вызове функции.
let _db = null, _messaging = null;
function getAdmin() {
    if (!_db) {
        admin.initializeApp();
        _db = getFirestore();
        _messaging = getMessaging();
    }
    return { db: _db, messaging: _messaging };
}

/**
 * Триггер: запись/обновление transfers/{code}
 * Отправляем push всем родительским токенам, привязанным к этому коду.
 */
exports.notifyParentOnStatusChange = functions.firestore
    .document("transfers/{code}")
    .onWrite(async (change, context) => {
        const { db, messaging } = getAdmin();
        const code = context.params.code;
        const before = change.before.data();
        const after = change.after.data();

        // Если документ удалён — выходим
        if (!after) return null;

        // === ЗАЩИТА ОТ ДУБЛЕЙ: отправляем push ТОЛЬКО когда статус ИЗМЕНИЛСЯ ===
        const beforeUser = before?.user || {};
        const afterUser = after?.user || {};

        const wasActive = !!beforeUser.activeSessionStart && !beforeUser.pausedAt;
        const wasPaused = !!beforeUser.pausedAt;

        const isActive = !!afterUser.activeSessionStart && !afterUser.pausedAt;
        const isPaused = !!afterUser.pausedAt;

        // Если статус НЕ изменился — не отправляем push
        if (wasActive === isActive && wasPaused === isPaused) {
            console.log("Status unchanged — skip push");
            return null;
        }

        const childData = afterUser;
        const childName = childData.name || "Ребёнок";

        let statusEmoji, statusText, statusBody;

        if (isActive) {
            statusEmoji = "✍️";
            statusText = `${childName} начал(а) заниматься!`;
            statusBody = "Таймер запущен — ребёнок учится.";
        } else if (isPaused) {
            statusEmoji = "⏸️";
            statusText = `${childName} поставил(а) паузу`;
            statusBody = "Ребёнок приостановил занятие.";
        } else {
            statusEmoji = "😴";
            statusText = `${childName} закончил(а) занятие`;
            statusBody = "Таймер остановлен.";
        }

        // === Получаем FCM-токены родителей ===
        let tokensSnap;
        try {
            tokensSnap = await db
                .collection("parentTokens")
                .doc(code)
                .collection("tokens")
                .get();
        } catch (e) {
            console.error("Ошибка чтения parentTokens:", e.message);
            return null;
        }

        if (tokensSnap.empty) {
            console.log(`Нет родительских токенов для кода ${code}`);
            return null;
        }

        const tokens = [];
        const staleTokens = [];
        const seenTokens = new Set(); // 🔒 один токен = один push

        tokensSnap.forEach((doc) => {
            const d = doc.data();
            // Пропускаем токены старше 7 дней (неактивные родители)
            if (d.lastSeen && Date.now() - d.lastSeen > 7 * 24 * 3600 * 1000) {
                staleTokens.push(doc.ref);
            } else if (d.token && !seenTokens.has(d.token)) {
                seenTokens.add(d.token);
                tokens.push(d.token);
            }
        });

        // Удаляем протухшие токены
        for (const ref of staleTokens) {
            try { await ref.delete(); } catch(e) {}
        }

        if (tokens.length === 0) {
            console.log("Все токены протухли");
            return null;
        }

        // === Отправляем push-уведомление ===
        // ⚠️ DATA-ONLY сообщение: НЕ используем поле notification!
        // Если присутствуют ОБА поля (notification + data), Firebase SDK на вебе
        // показывает уведомление ДВАЖДЫ: автопоказ notification-пейлоада +
        // ручной показ в onBackgroundMessage. Data-only = один показ в SW.
        const message = {
            data: {
                type: "parent_status",
                code: code,
                status: isActive ? "studying" : isPaused ? "paused" : "idle",
                childName: childName,
                title: `${statusEmoji} ${statusText}`,
                body: statusBody,
                timestamp: String(Date.now()),
            },
            tokens: tokens, // multicast — до 500 токенов за раз
        };

        try {
            const response = await messaging.sendEachForMulticast(message);
            console.log(
                `✅ Push отправлен: ${response.successCount}/${tokens.length} для ${childName} (${code})`
            );
        } catch (e) {
            console.error("Ошибка отправки push:", e.message);
        }

        return null;
    });

/**
 * Опционально: удаление старых токенов раз в сутки
 */
exports.cleanupStaleTokens = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
        const { db } = getAdmin();
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
        const snap = await db.collection("parentTokens").get();

        for (const codeDoc of snap.docs) {
            const tokensSnap = await codeDoc.ref.collection("tokens")
                .where("lastSeen", "<", cutoff).get();
            for (const t of tokensSnap.docs) {
                try { await t.ref.delete(); } catch(e) {}
            }
        }
        console.log("🧹 Протухшие токены удалены");
    });

/**
 * 🔔 DAILY REMINDER — ежедневное напоминание в 18:00 по Ташкенту (13:00 UTC)
 * Пишет всем пользователям у которых есть FCM токен и которые не заходили сегодня.
 */
exports.dailyReminder = functions.pubsub
    .schedule("0 13 * * *")  // 13:00 UTC = 18:00 Tashkent
    .timeZone("Asia/Tashkent")
    .onRun(async () => {
        const { db, messaging } = getAdmin();
        const now = Date.now();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        // Берём всех пользователей
        const snap = await db.collection("users").get();
        const tokens = [];
        const seenTokens = new Set(); // 🔒 защита от дублей: один токен = один push
        const phrases = [
            "Пора поучиться! Твой мозг скучает 🧠",
            "Готов стать умнее? Открой MathBooster! 📚",
            "Таймер ждёт! Начни сессию сейчас ⏱️",
            "Не забывай про учёбу! Ты справишься 💪",
            "Каждый день — шаг к мастерству. Поехали! 🚀",
        ];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];

        for (const doc of snap.docs) {
            const data = doc.data();
            const u = data.user || {};
            const fcmToken = u.fcmToken;
            const lastPing = Number(u.lastPing || 0);

            // Пропускаем если:
            // - нет токена
            // - заходил сегодня (lastPing после начала дня)
            // - токен старше 30 дней
            if (!fcmToken) continue;
            if (lastPing > todayMs) continue;
            if (u.fcmTokenDate && (now - Number(u.fcmTokenDate)) > 30 * 86400000) continue;
            if (seenTokens.has(fcmToken)) continue; // этот токен уже получил push
            seenTokens.add(fcmToken);

            tokens.push({ token: fcmToken, name: u.name || "Игрок" });
        }

        if (tokens.length === 0) {
            console.log("Daily reminder: нет кого уведомлять");
            return null;
        }

        // Отправляем пачками по 500
        for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);
            try {
                await messaging.sendEachForMulticast({
                    // ⚠️ DATA-ONLY — защита от двойного показа (см. комментарий выше)
                    data: { type: "daily_reminder", title: "📚 MathBooster Pro", body: phrase, timestamp: String(now) },
                    tokens: batch.map(t => t.token),
                });
            } catch (e) {
                console.error("Daily reminder error:", e.message);
            }
        }

        console.log(`✅ Daily reminder отправлен: ${tokens.length} пользователям`);
        return null;
    });

/**
 * 🔥 STREAK REMINDER — напоминание о стрике
 * Запускается в 20:00 Ташкента (15:00 UTC)
 * Пишет тем кто не заходил 2+ дня — стрик пропадёт!
 */
exports.streakReminder = functions.pubsub
    .schedule("0 15 * * *")  // 15:00 UTC = 20:00 Tashkent
    .timeZone("Asia/Tashkent")
    .onRun(async () => {
        const { db, messaging } = getAdmin();
        const now = Date.now();
        const twoDaysAgo = now - 2 * 86400000;
        const threeDaysAgo = now - 3 * 86400000;

        const snap = await db.collection("users").get();
        const tokens = [];
        const seenTokens = new Set(); // 🔒 защита от дублей

        for (const doc of snap.docs) {
            const data = doc.data();
            const u = data.user || {};
            const fcmToken = u.fcmToken;
            const lastPing = Number(u.lastPing || 0);
            const streak = u.streak || u.dailyStreak || 0;

            // Пишем тем у кого:
            // - есть токен
            // - lastPing 2-3 дня назад (не сегодня и не >3 дней)
            // - есть стрик > 0
            if (!fcmToken) continue;
            if (lastPing < threeDaysAgo || lastPing > twoDaysAgo) continue;
            if (streak <= 0) continue;
            if (seenTokens.has(fcmToken)) continue;
            seenTokens.add(fcmToken);

            tokens.push({ token: fcmToken, streak, name: u.name || "Игрок" });
        }

        if (tokens.length === 0) {
            console.log("Streak reminder: нет кого уведомлять");
            return null;
        }

        for (const t of tokens) {
            try {
                await messaging.send({
                    token: t.token,
                    // ⚠️ DATA-ONLY — защита от двойного показа
                    data: {
                        type: "streak_reminder",
                        title: `🔥 Стрик ${t.streak} дней подряд!`,
                        body: `Ты 2 дня не заходил. Открой приложение чтобы не потерять стрик!`,
                        streak: String(t.streak),
                    },
                });
            } catch (e) {
                console.error(`Streak reminder error for ${t.name}:`, e.message);
            }
        }

        console.log(`✅ Streak reminder отправлен: ${tokens.length} пользователям`);
        return null;
    });

/**
 * 📊 WEEKLY REPORT — еженедельный отчёт
 * Запускается по воскресеньям в 10:00 Ташкента (05:00 UTC)
 */
exports.weeklyReport = functions.pubsub
    .schedule("0 5 * * 0")  // Воскресенье 05:00 UTC = 10:00 Tashkent
    .timeZone("Asia/Tashkent")
    .onRun(async () => {
        const { db, messaging } = getAdmin();
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;

        const snap = await db.collection("users").get();
        const tokens = [];
        const seenTokens = new Set(); // 🔒 защита от дублей

        for (const doc of snap.docs) {
            const data = doc.data();
            const u = data.user || {};
            const fcmToken = u.fcmToken;
            const lastPing = Number(u.lastPing || 0);

            if (!fcmToken) continue;
            if (lastPing < weekAgo) continue; // Не заходил всю неделю
            if (seenTokens.has(fcmToken)) continue;
            seenTokens.add(fcmToken);

            // Считаем статистику из локальных данных
            const totalSec = u.totalSec || 0;
            const level = u.level || 1;
            const coins = u.coins || 0;
            const sessions = (u.sessions || []).length || 0;

            const hours = Math.floor(totalSec / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);

            tokens.push({
                token: fcmToken,
                name: u.name || "Игрок",
                hours, mins, level, coins, sessions
            });
        }

        if (tokens.length === 0) {
            console.log("Weekly report: нет активных пользователей");
            return null;
        }

        for (const t of tokens) {
            const body = `Уровень ${t.level} | ${t.hours}ч ${t.mins}м учёбы | ${t.coins.toLocaleString()} монет`;
            try {
                await messaging.send({
                    token: t.token,
                    // ⚠️ DATA-ONLY — защита от двойного показа
                    data: {
                        type: "weekly_report",
                        title: "📊 Твой еженедельный отчёт",
                        body: body,
                        level: String(t.level),
                    },
                });
            } catch (e) {
                console.error(`Weekly report error for ${t.name}:`, e.message);
            }
        }

        console.log(`✅ Weekly report отправлен: ${tokens.length} пользователям`);
        return null;
    });

/**
 * 🔔 AFK CHECK PUSH — отправляет push-уведомление пользователю
 * когда пора проходить проверку (через 1 час таймера).
 *
 * Клиент записывает timerChecks/{userId} при старте таймера.
 * Эта функция проверяет каждую минуту и отправляет push.
 */
exports.afkCheckPush = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
        const { db, messaging } = getAdmin();
        const now = Date.now();
        // Запрос только по одному полю (sent == false) — composite index не нужен.
        // checkAt фильтруем в коде: коллекция крошечная (один док на активный таймер).
        const snap = await db.collection("timerChecks")
            .where("sent", "==", false)
            .get();

        for (const doc of snap.docs) {
            const data = doc.data();
            const userId = data.userId;
            const fcmToken = data.fcmToken;

            // Фильтр по времени — в коде (запрос по одному полю не требует index)
            if (Number(data.checkAt) > now) continue;

            if (!fcmToken) {
                await doc.ref.update({ sent: true });
                continue;
            }

            try {
                await messaging.send({
                    token: fcmToken,
                    // ⚠️ DATA-ONLY — защита от двойного показа
                    data: {
                        type: "afk_check",
                        title: "🚨 Время проверки!",
                        body: "Прошёл час! Откройте приложение и решите пример чтобы продолжить.",
                        userId: userId,
                        timestamp: String(now),
                    },
                });
                console.log(`🔔 AFK push отправлен: ${userId}`);
            } catch (e) {
                console.error(`❌ AFK push ошибка для ${userId}:`, e.message);
            }

            await doc.ref.update({ sent: true });
        }

        return null;
    });

/**
 * Триггер: создание документа pendingChallenges/{targetId}
 * Отправляем push вызванному игроку
 */
exports.challengeNotify = functions.firestore
    .document("pendingChallenges/{targetId}")
    .onCreate(async (snap, context) => {
        const { db, messaging } = getAdmin();
        const targetId = context.params.targetId;
        const challenge = snap.data();

        if (!challenge || !challenge.fromName || !challenge.battleCode) {
            console.warn("challengeNotify: неполные данные", challenge);
            return null;
        }

        // Ищем FCM токен цели — сначала в users, потом в leaderboard (fallback)
        let fcmToken = null;

        // 1. Пробуем коллекцию users (основной источник)
        const userDoc = await db.collection("users").doc(targetId).get();
        if (userDoc.exists) {
            fcmToken = userDoc.data()?.user?.fcmToken || null;
        }

        // 2. Fallback — если нет в users, ищем в leaderboard
        if (!fcmToken) {
            const leaderDoc = await db.collection("leaderboard").doc(targetId).get();
            if (leaderDoc.exists) {
                fcmToken = leaderDoc.data()?.fcmToken || null;
            }
        }

        if (!fcmToken) {
            console.warn(`challengeNotify: нет fcmToken у ${targetId} (ни в users, ни в leaderboard)`);
            return null;
        }

        const modeLabels = { standard: "🔢 Классика", sign: "🧩 Найди знак", square: "📐 Степени", fractions: "🍰 Дроби", percent: "📊 Проценты" };
        const diffLabels = { easy: "🟢 Легко", medium: "🟡 Средне", hard: "🔴 Сложно" };

        try {
            await messaging.send({
                token: fcmToken,
                // ⚠️ DATA-ONLY — защита от двойного показа
                data: {
                    type: "duel_challenge",
                    title: `⚔️ ${challenge.fromName} вызвал тебя на дуэль!`,
                    body: `${modeLabels[challenge.mode] || challenge.mode} | ${diffLabels[challenge.diff] || challenge.diff}`,
                    battleCode: challenge.battleCode,
                    fromName: challenge.fromName,
                    mode: challenge.mode,
                    diff: challenge.diff,
                },
            });
            console.log(`🔔 Duel push отправлен: ${challenge.fromName} → ${targetId}`);
        } catch (e) {
            console.error(`❌ Duel push ошибка для ${targetId}:`, e.message);
        }

        return null;
    });
