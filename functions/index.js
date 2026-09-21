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
const { getAuth } = require("firebase-admin/auth");

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

/**
 * 🧪 TEST PUSH — разовая отправка тестового пуша для проверки доставки.
 * Вызов: https://us-central1-mathbooster-pro.cloudfunctions.net/testPush?token=FCM_TOKEN
 * Или без token — отправит всем, у кого есть fcmToken (как dailyReminder, но без фильтра lastPing).
 * После проверки можно удалить эту функцию.
 */
exports.testPush = functions.https.onRequest(async (req, res) => {
    const { db, messaging } = getAdmin();

    // CORS-заголовки, чтобы можно было вызвать из браузера
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "GET");
        res.status(204).send("");
        return;
    }

    const title = req.query.title || "🧪 Тестовый пуш MathBooster";
    const body = req.query.body || "Если ты видишь ЭТО уведомление ОДИН раз — дубли исправлены! ✅";

    const tokens = [];
    const seen = new Set();

    if (req.query.token) {
        // Режим одной цели
        tokens.push(req.query.token);
    } else {
        // Режим всем — берём все fcmToken из users
        const snap = await db.collection("users").get();
        snap.forEach(doc => {
            const u = doc.data()?.user || {};
            if (u.fcmToken && !seen.has(u.fcmToken)) {
                seen.add(u.fcmToken);
                tokens.push(u.fcmToken);
            }
        });
    }

    if (tokens.length === 0) {
        res.status(404).send("No FCM tokens found");
        return;
    }

    let success = 0, failure = 0;
    for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        try {
            const resp = await messaging.sendEachForMulticast({
                // ⚠️ DATA-ONLY — тот же формат, что и продакшен-пуши
                data: { type: "test_push", title, body, timestamp: String(Date.now()) },
                tokens: batch,
            });
            success += resp.successCount;
            failure += resp.failureCount;
        } catch (e) {
            failure += batch.length;
        }
    }

    console.log(`🧪 Test push: ${success} ok, ${failure} failed`);
    res.json({ ok: true, sent: success, failed: failure, total: tokens.length });
});

/**
 * 🛡️ СЕРВЕРНЫЙ АНТИ-ЧИТ — триггер на запись в users/{userId}
 * Клиент пишет профиль целиком (setDoc), поэтому проверяем ЗНАЧЕНИЯ,
 * а не поля: если coins/totalSec/xp выходят за физически возможные
 * пределы — санитизируем документ обратно.
 *
 * Пределы (консервативные, чтобы не зацепить честных):
 *   coins:   максимум 100_000 — столько не нафармить даже годами;
 *            у честного топа ~1-5к. Монеты выше 100к = чит.
 *   totalSec: прирост за 5 минут не может быть больше 13 часов.
 *   xp:      прирост за 5 минут не может быть больше 50_000.
 */
exports.antiCheat = functions.firestore
    .document("users/{userId}")
    .onWrite(async (change, context) => {
        const { db } = getAdmin();
        const userId = context.params.userId;
        const after = change.after.data();
        if (!after) return null; // удаление — не наша забота

        const u = after.user || {};
        const before = change.before.data() || {};
        const bu = before.user || {};
        const now = Date.now();

        const fixes = {};
        let punish = false;

        // --- 1. МОНЕТЫ: потолок + скорость фарма ---
        const coins = Number(u.coins) || 0;
        const prevCoins = Number(bu.coins) || 0;
        if (coins > 100000) {
            fixes["user.coins"] = 0; // читерский запас — обнуляем целиком
            fixes["user.cheatFlag"] = `coins=${coins} @ ${new Date().toISOString()}`;
            punish = true;
        } else if (before && coins - prevCoins > 50000) {
            // +50к монет за один сейв — невозможно честно (даже PVP даёт десятки)
            fixes["user.coins"] = prevCoins;
            fixes["user.cheatFlag"] = `coinJump+${coins - prevCoins} @ ${new Date().toISOString()}`;
            punish = true;
        }

        // --- 2. ЧАСЫ: скорость ---
        const totalSec = Number(u.totalSec) || 0;
        const prevSec = Number(bu.totalSec) || 0;
        const prevTs = Number(bu.lastSaveTime) || 0;
        const dtMs = prevTs ? Math.max(0, now - prevTs) : 0;
        if (before && dtMs > 0 && dtMs < 5 * 60 * 1000 && totalSec - prevSec > 13 * 3600) {
            // за 5 минут «накрутили» больше 13 часов
            fixes["user.totalSec"] = prevSec;
            fixes["user.cheatFlag"] = `hoursJump+${Math.round((totalSec - prevSec) / 360) / 10}h @ ${new Date().toISOString()}`;
            punish = true;
        }
        if (totalSec < 0) fixes["user.totalSec"] = 0;

        // --- 3. XP: скорость ---
        const xp = Number(u.xp) || 0;
        const prevXp = Number(bu.xp) || 0;
        if (before && xp - prevXp > 50000) {
            fixes["user.xp"] = prevXp;
            fixes["user.cheatFlag"] = `xpJump+${xp - prevXp} @ ${new Date().toISOString()}`;
            punish = true;
        }

        if (!punish) return null;

        fixes["user.lastSaveTime"] = now;
        try {
            await change.after.ref.update(fixes);
            console.log(`🚨 ANTI-CHEAT ${userId}:`, JSON.stringify(fixes));
        } catch (e) {
            console.error(`antiCheat update failed for ${userId}:`, e.message);
        }
        return null;
    });

/**
 * 🛡️ АНТИ-ЧИТ ЛИДЕРБОРДА — триггер на запись в leaderboard/{userId}
 * Публичная визитка — её видят все, поэтому фейковые часы/уровень здесь
 * заметнее всего. Откатываем: часы > 720 за сезон (месяц учёбы нон-стоп),
 * уровень > 100, имя длиннее 20 символов.
 */
exports.antiCheatLeaderboard = functions.firestore
    .document("leaderboard/{userId}")
    .onWrite(async (change, context) => {
        const { db } = getAdmin();
        const userId = context.params.userId;
        const after = change.after.data();
        if (!after) return null;

        const fixes = {};
        const totalSec = Number(after.totalSec) || 0;
        const level = Number(after.level) || 0;
        const name = String(after.name || "");

        if (totalSec > 720 * 3600) fixes["totalSec"] = 0;
        if (level > 100) fixes["level"] = 1;
        if (name.length > 20 || name.length === 0) fixes["name"] = "Игрок";

        if (Object.keys(fixes).length === 0) return null;

        fixes["cheatFlag"] = `lb ${JSON.stringify(fixes)} @ ${new Date().toISOString()}`;
        try {
            await change.after.ref.update(fixes);
            console.log(`🚨 ANTI-CHEAT LB ${userId}:`, JSON.stringify(fixes));
        } catch (e) {
            console.error(`antiCheatLeaderboard update failed for ${userId}:`, e.message);
        }
        return null;
    });

/**
 * 🧹 PURGE USER — временное средство: удалить читерский профиль и все его
 * карточки из всех коллекций одним вызовом. Admin SDK обходит правила.
 * Вызов: /purgeUser?key=SECRET&uid=AUTH_UID   — удалить по auth UID + его users-докам
 *        /purgeUser?key=SECRET&name=HACKER   — найти и удалить по имени во всех коллекциях
 * После использования функцию удалить из кода.
 */
const PURGE_SECRET = "MB-purge-9f4Kz72mQx";
exports.purgeUser = functions.https.onRequest(async (req, res) => {
    if (req.query.key !== PURGE_SECRET) {
        res.status(403).send("forbidden");
        return;
    }
    const { db } = getAdmin();
    const uid = req.query.uid;   // Firebase Auth UID
    const name = req.query.name; // имя игрока (case-insensitive)
    if (!uid && !name) {
        res.status(400).json({ ok: false, error: "pass uid or name" });
        return;
    }

    const collections = ["users", "leaderboard", "leaderboard_history_1", "leaderboard_history_2"];
    const deleted = [];
    const toDelete = new Set(); // полный путь документа

    for (const col of collections) {
        if (uid) {
            // Точный doc id = auth UID
            toDelete.add(`${col}/${uid}`);
            // users может лежать и под игровым id — ищем по _ownerUID
            if (col === "users") {
                const snap = await db.collection(col).where("_ownerUID", "==", uid).get();
                snap.forEach(d => toDelete.add(`${col}/${d.id}`));
            }
        }
        if (name) {
            const snap = await db.collection(col).get();
            snap.forEach(d => {
                const data = d.data() || {};
                const nm = String(data.name || (data.user || {}).name || "").toLowerCase();
                if (nm === String(name).toLowerCase()) toDelete.add(`${col}/${d.id}`);
            });
        }
    }

    for (const path of toDelete) {
        try {
            await db.doc(path).delete();
            deleted.push(path);
        } catch (e) {
            // документа нет — норм
        }
    }

    console.log(`🧹 PURGE: удалено ${deleted.length}:`, deleted.join(", "));
    res.json({ ok: true, deleted });
});

/**
 * 🛡️ ADMIN ACTION — серверные админ-действия для admin_panel.html.
 * Делает то, что клиент по правилам Firestore не может:
 *   action=ban        &uid=AUTH_UID              — 🚫 бан (динамический список banned_users)
 *   action=unban      &uid=AUTH_UID              — ♻️ разбан
 *   action=status     &gameId=..&pro=1&vip=1&king=0&titan=0[&title=TEXT]
 *                                                — 🏆 выдать статусы PRO/VIP/KING/TITAN
 *   action=fullDelete &uid=AUTH_UID[&name=NAME]  — 💀 полное удаление: профиль, Топ,
 *                        архивы сезонов, дуэли, вызовы, коды восстановления + Auth-аккаунт
 *
 * Все вызовы требуют ключ: &key=ADMIN_SECRET
 */
const ADMIN_SECRET = "MB-purge-9f4Kz72mQx";

exports.adminAction = functions.https.onRequest(async (req, res) => {
    // CORS — панель открывается с file:// и с github.io
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    if (req.query.key !== ADMIN_SECRET) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
    }

    const { db } = getAdmin();
    const action = req.query.action;
    const authUid = req.query.uid;    // Firebase Auth UID
    const gameId = req.query.gameId;  // игровой id (users/{gameId})
    const name = req.query.name;      // имя игрока

    try {
        // ================= 🚫 BAN / ♻️ UNBAN =================
        if (action === "ban" || action === "unban") {
            if (!authUid) { res.status(400).json({ ok: false, error: "pass uid (Firebase Auth UID)" }); return; }
            const ref = db.collection("banned_users").doc(authUid);
            const CARD_COLL = ["leaderboard", "leaderboard_history_1", "leaderboard_history_2", "leaderboard_history_3"];
            if (action === "ban") {
                // 1. Находим все игровые id этого читера (auth UID + профили с _ownerUID)
                const gameIds = new Set([authUid]);
                try {
                    const us = await db.collection("users").where("_ownerUID", "==", authUid).get();
                    us.forEach(d => gameIds.add(d.id));
                } catch (e) { console.warn("ban: users lookup fail", e.message); }

                // 2. Снапшот карточек (для восстановления при разбане) + обнуление
                const cardSnapshot = {};
                let zeroed = 0;
                for (const gid of gameIds) {
                    for (const coll of CARD_COLL) {
                        const cardRef = db.collection(coll).doc(gid);
                        const card = await cardRef.get().catch(() => null);
                        if (!card || !card.exists) continue;
                        if (coll === "leaderboard" && !cardSnapshot[gid]) cardSnapshot[gid] = card.data();
                        await cardRef.set({
                            totalSec: 0,
                            isBanned: true,
                            banReason: req.query.reason || "admin_panel"
                        }, { merge: true });
                        zeroed++;
                    }
                    // 3. Профиль: часы в 0 + метка (игрок и так не может писать — он в бане)
                    const profRef = db.collection("users").doc(gid);
                    const prof = await profRef.get().catch(() => null);
                    if (prof && prof.exists) {
                        await profRef.set({
                            "user.totalSec": 0,
                            "user.isBanned": true,
                            "user.forceUpdate": true
                        }, { merge: true });
                    }
                }

                await ref.set({
                    bannedAt: Date.now(),
                    reason: req.query.reason || "admin_panel",
                    by: "admin_panel",
                    cardSnapshot: cardSnapshot
                }, { merge: true });
                console.log(`🚫 BAN: ${authUid} — обнулено карточек: ${zeroed}`);
                res.json({ ok: true, action: "ban", authUid, zeroedCards: zeroed });
            } else {
                // UNBAN: восстанавливаем карточки из снапшота
                const banDoc = await ref.get().catch(() => null);
                const snap = (banDoc && banDoc.exists) ? (banDoc.data().cardSnapshot || {}) : {};
                const gameIds = new Set([...Object.keys(snap), authUid]);
                let restored = 0;
                for (const gid of gameIds) {
                    for (const coll of CARD_COLL) {
                        // снимаем метку бана со всех карточек
                        await db.collection(coll).doc(gid).set({ isBanned: false, banReason: "" }, { merge: true }).catch(() => {});
                    }
                    if (snap[gid] && typeof snap[gid].totalSec !== "undefined") {
                        await db.collection("leaderboard").doc(gid).set(snap[gid], { merge: true });
                        restored++;
                    }
                    await db.collection("users").doc(gid).set({
                        "user.isBanned": false,
                        "user.forceUpdate": true
                    }, { merge: true }).catch(() => {});
                }
                await ref.delete().catch(() => {});
                console.log(`♻️ UNBAN: ${authUid} — восстановлено карточек: ${restored}`);
                res.json({ ok: true, action: "unban", authUid, restoredCards: restored });
            }
            return;
        }

        // ================= 🏆 STATUS =================
        if (action === "status") {
            if (!gameId) { res.status(400).json({ ok: false, error: "pass gameId" }); return; }
            const pro = req.query.pro === "1";
            const vip = req.query.vip === "1";
            const king = req.query.king === "1";
            const titan = req.query.titan === "1";
            const customTitle = (req.query.title || "").trim();

            // Титул по статусу (если не задан вручную)
            let title = customTitle;
            if (!title) {
                if (king || titan) title = "LEGEND";
                else if (pro) title = "PRO";
                else if (vip) title = "VIP";
                else title = "";
            }

            await db.collection("users").doc(gameId).set({
                "user.isPro": pro,
                "user.isVip": vip,
                "user.isKing": king,
                "user.isTitan": titan,
                "user.currentTitle": title,
                "user.forceUpdate": true
            }, { merge: true });

            await db.collection("leaderboard").doc(gameId).set({
                isPro: pro, isVip: vip, isKing: king, isTitan: titan, currentTitle: title
            }, { merge: true });

            console.log(`🏆 STATUS ${gameId}: pro=${pro} vip=${vip} king=${king} titan=${titan} title=${title}`);
            res.json({ ok: true, action: "status", gameId, title });
            return;
        }

        // ================= 💀 FULL DELETE =================
        if (action === "fullDelete") {
            if (!authUid && !name) { res.status(400).json({ ok: false, error: "pass uid or name" }); return; }

            const deleted = [];
            const gameIds = new Set();

            // 1. Игровые id: auth UID сам часто является doc id (Топ/архивы)
            if (authUid) gameIds.add(authUid);

            // 2. Профили users, привязанные к этому auth UID (_ownerUID)
            if (authUid) {
                const us = await db.collection("users").where("_ownerUID", "==", authUid).get();
                us.forEach(d => gameIds.add(d.id));
            }

            // 3. Профили по имени (на случай легаси без _ownerUID)
            if (name) {
                const byName = await db.collection("users").where("user.name", "==", name).get();
                byName.forEach(d => {
                    gameIds.add(d.id);
                    const o = d.data()._ownerUID;
                    if (o) gameIds.add(o);
                });
            }

            // 4. Удаляем из основных коллекций по всем найденным id
            for (const col of ["users", "leaderboard", "leaderboard_history_1", "leaderboard_history_2"]) {
                for (const gid of gameIds) {
                    try {
                        await db.collection(col).doc(gid).delete();
                        deleted.push(`${col}/${gid}`);
                    } catch (e) { /* нет документа — норм */ }
                }
            }

            // 5. Коды восстановления, дуэли, вызовы — по игровым id
            for (const gid of gameIds) {
                const t = await db.collection("transfers").where("userId", "==", gid).get();
                for (const d of t.docs) {
                    await d.ref.delete();
                    deleted.push(`transfers/${d.id}`);
                }
                const b1 = await db.collection("battles_v2").where("p1_id", "==", gid).get();
                const b2 = await db.collection("battles_v2").where("p2_id", "==", gid).get();
                for (const d of [...b1.docs, ...b2.docs]) {
                    await d.ref.delete();
                    deleted.push(`battles_v2/${d.id}`);
                }
                try {
                    await db.collection("pendingChallenges").doc(gid).delete();
                    deleted.push(`pendingChallenges/${gid}`);
                } catch (e) { /* нет — норм */ }
                const ch = await db.collection("pendingChallenges").where("fromId", "==", gid).get();
                for (const d of ch.docs) {
                    await d.ref.delete();
                    deleted.push(`pendingChallenges/${d.id}`);
                }
            }

            // 6. Сам Firebase Auth аккаунт — самое главное, без него бан бесполезен
            if (authUid) {
                try {
                    await getAuth().deleteUser(authUid);
                    deleted.push(`auth/${authUid}`);
                    console.log(`💀 Auth аккаунт удалён: ${authUid}`);
                } catch (e) {
                    console.log(`Auth удаление пропущено: ${e.message}`);
                }
            }

            console.log(`💀 FULL DELETE: удалено ${deleted.length}:`, deleted.join(", "));
            res.json({ ok: true, action: "fullDelete", deleted });
            return;
        }

        res.status(400).json({ ok: false, error: "unknown action" });
    } catch (e) {
        console.error("adminAction error:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});
