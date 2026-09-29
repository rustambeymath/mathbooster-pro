    const getUZDate = (dateObj = null) => {
        const timestamp = dateObj ? dateObj.getTime() : TimeGuard.getTrueTime();
        const tz = (typeof DB !== 'undefined' && DB && DB.user && DB.user.timezone && DB.user.timezone !== 'auto')
            ? DB.user.timezone
            : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent');
        try {
            // Форматируем дату в выбранной зоне и собираем ГГГГ-ММ-ДД из частей
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
            }).formatToParts(new Date(timestamp));
            const get = t => (parts.find(p => p.type === t) || {}).value || '';
            return `${get('year')}-${get('month')}-${get('day')}`;
        } catch(e) {
            return new Date(timestamp).toISOString().slice(0, 10);
        }
    };

    const NameGuard = {
        // Список запрещенных корней (RU, UZ, EN)
        // Мы ищем "корни", чтобы поймать слова типа "сук@", "сууука" и т.д.
        blacklist: [
            // 🇷🇺 RU
            'хуй', 'х у й', 'пизд', 'ебал', 'еблан', 'мудак', 'ганд', 'шлюх', 'бля', 'сука', 'с у к а', 'жопа', 'трах',
            // 🇺🇿 UZ
            'qotoq', 'qo\'toq', 'sik', 's i k', 'jalab', 'j a l a b', 'om', 'gandon', 'kotag', 'k o t a g', 'am',
            // 🇺🇸 EN
            'fuck', 'shit', 'bitch', 'whore', 'dick', 'cock', 'pussy'
        ],

        check(name) {
            // 1. Приводим к нижнему регистру
            const lower = name.toLowerCase();
            
            // 2. Создаем "чистую" версию без символов и пробелов
            // (чтобы поймать "с.у.к.а" или "х-у-й")
            const clean = lower.replace(/[^a-zа-я0-9]/g, '');

            // 3. Проверяем список
            for (let badWord of this.blacklist) {
                // Проверяем, содержится ли плохое слово внутри имени
                if (lower.includes(badWord) || clean.includes(badWord)) {
                    return false; // Имя ПЛОХОЕ
                }
            }
            return true; // Имя ХОРОШЕЕ
        }
    };
    
    let DB = null; 
    let isParentMode = false;

    const Data = {
        currentKey: null,
        listener: null,
        isBusy: false,

        initNewData(userId) { 
            const newDB = JSON.parse(JSON.stringify(DefaultDB)); 
            newDB.achievements = GenAch(); 
            newDB.user.trainerRecords = {
                standard: { easy: 0, medium: 0, hard: 0 },
                sign:     { easy: 0, medium: 0, hard: 0 },
                square:   { easy: 0, medium: 0, hard: 0 }
            };
            newDB.user.lastSaveTime = Date.now();
            localStorage.setItem('MathData_' + userId, JSON.stringify(newDB)); 
        },

        load(userId) { 
            this.currentKey = 'MathData_' + userId; 
            const raw = localStorage.getItem(this.currentKey); 
            
            if (raw) {
                try {
                    // 1. Загружаем данные из памяти
                    DB = JSON.parse(raw);
                    cleanSubjects();
                    // Предметы копятся ПОЖИЗНЕННО и отдельно от сезонов —
                    // их секунды НЕ должны восстанавливать часы текущего сезона.
                    // --- 🛡️ ПРОВЕРКА ЦЕЛОСТНОСТИ МОНЕТ (АНТИ-ЧИТ) ---
                    
                    // 2. 🛡️ ПРОВЕРКА НА ЧИТЕРСТВО (Перевод часов назад)
                    const now = Date.now();
                    if (DB.user.integrityKey) {
                        const expectedKey = btoa(DB.user.coins + "salt" + DB.user.level);
                        if (DB.user.integrityKey !== expectedKey) {
                            console.error("🚨 Взлом данных обнаружен!");
                            this.punish(); // Обнуляем за подделку монет
                            return;
                        }
                    }

                    // 3. Чистим дубликаты предметов (если есть)
                    console.log("✅ Данные загружены и проверены");

                } catch(e) { 
                    console.error("Ошибка чтения базы:", e); 
                }
            }

            // 4. Если профиля нет — создаем новый
            if (!DB || !DB.user) {
                console.log("🆕 Создание нового профиля...");
                this.initNewData(userId);
                DB = JSON.parse(localStorage.getItem(this.currentKey));
            }

            // 5. 🛠️ ЛЕЧЕНИЕ ПОЛЕЙ (Миграция данных)
            // Проверяем наличие всех новых систем, чтобы старые аккаунты не ломались
            if (!DB.user.ownedTitles) DB.user.ownedTitles = [];
            if (!DB.user.ownedFrames) DB.user.ownedFrames = [];
            if (!DB.user.ownedSounds) DB.user.ownedSounds = ['standard'];
            if (!DB.user.activeBattles) DB.user.activeBattles = [];
            if (!DB.achievements || DB.achievements.length < 5) DB.achievements = GenAch();
            if (!DB.user.boosterExpiry) DB.user.boosterExpiry = 0;
            if (!DB.user.lastBoosterPurchase) DB.user.lastBoosterPurchase = "";
            if (!DB.user.ownedRadios) DB.user.ownedRadios = [];
            if (!DB.user.currentRadio) DB.user.currentRadio = null;

            // 6. 📊 Статистика предметов больше НЕ синхронизируется с часами сезона:
            //    предметы — пожизненные, часы — сезонные. Они живут раздельно.

            // 7. Инициализация инвентаря и настроек
            if (!DB.user.inventory) {
                DB.user.inventory = { shield: 0, booster: 0 };
            } else {
                if (DB.user.inventory.shield === undefined) DB.user.inventory.shield = 0;
                if (DB.user.inventory.booster === undefined) DB.user.inventory.booster = 0;
            }
            
            if (DB.user.isMotivationClaimed === undefined) DB.user.isMotivationClaimed = false;
            if (DB.user.isLogoRewardClaimed === undefined) DB.user.isLogoRewardClaimed = false;
            if (DB.user.isVersionRewardClaimed === undefined) DB.user.isVersionRewardClaimed = false;

            if (!DB.settings) {
                DB.settings = { sfx: true, notifications: false, notifyTime: "19:00" };
            }
            
            if (DB.user.coins === undefined) DB.user.coins = 0;
            if (!DB.user.lastSaveTime) DB.user.lastSaveTime = Date.now();

            // 8. Квесты (Гарантируем наличие целей)
            if (!DB.user.dailyQuests || !DB.user.dailyQuests.targets) {
                DB.user.dailyQuests = {
                    date: "", studyMin: 0, mathSolved: 0, pvpDone: 0, claimed: [],
                    targets: { studyMin: 30, mathSolved: 20, pvpDone: 1 }
                };
            }

            // 9. Пожизненная статистика для медалей
            if (DB.user.pvpWins === undefined) DB.user.pvpWins = 0;
            if (DB.user.pvpLosses === undefined) DB.user.pvpLosses = 0;
            if (DB.user.lifetimeMathSolved === undefined) DB.user.lifetimeMathSolved = 0;
            if (DB.user.lifetimeCoinsSpent === undefined) DB.user.lifetimeCoinsSpent = 0;
            if (DB.user.lifetimeStrictSec === undefined) DB.user.lifetimeStrictSec = 0;
            if (DB.user.lifetimeXP === undefined) DB.user.lifetimeXP = DB.user.xp || 0;
            if (DB.user.lifetimeStrictSessions === undefined) DB.user.lifetimeStrictSessions = 0;
            if (DB.user.lifetimeQuestsDone === undefined) DB.user.lifetimeQuestsDone = 0;
            if (DB.user.lifetimePerfectDays === undefined) DB.user.lifetimePerfectDays = 0;
            if (DB.user.lifetimeDailyClaims === undefined) DB.user.lifetimeDailyClaims = 0;
            if (DB.user.visitedParentMode === undefined) DB.user.visitedParentMode = false;
            if (DB.user.multiSubjectSession === undefined) DB.user.multiSubjectSession = false;
            if (DB.user.currentMonthSec === undefined) DB.user.currentMonthSec = 0;
            
            if (!DB.user.monthlyGoal) DB.user.monthlyGoal = 40;
            if (!DB.user.lastWeeklyReportDate) DB.user.lastWeeklyReportDate = ""; 
            if (!DB.user.lastSpinDate) DB.user.lastSpinDate = ""; 
            if (!DB.user.lastNotifyDate) DB.user.lastNotifyDate = "";
            // Принудительное создание недостающих полей для старых игроков
            if (!DB.user.ownedRadios) DB.user.ownedRadios = [];
            if (DB.user.currentRadio === undefined) DB.user.currentRadio = null;
            // 10. Запускаем онлайн-слушатель
            if(window.DB_Online) this.startListening(userId);

            // 🟢 ОНЛАЙН-ПИНГ: обновляем lastActive каждые 15 сек для зеленого кружка в Топе
            if (!isParentMode && window.DB_Online) {
                const topRef = window.DB_Online.doc(window.DB_Online.db, "leaderboard", userId);
                const sendOnline = () => {
                    window.DB_Online.updateDoc(topRef, { lastActive: Date.now() }).catch(() => {});
                };
                const sendOffline = () => {
                    window.DB_Online.updateDoc(topRef, { lastActive: 0 }).catch(() => {});
                };
                sendOnline();
                setInterval(sendOnline, 15000);
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) sendOffline(); else sendOnline();
                });
                window.addEventListener('beforeunload', sendOffline);
            }
            
            // ⚔️ СЛУШАТЕЛЬ ВХОДЯЩИХ ВЫЗОВОВ НА ДУЭЛЬ
            BattleSys.startChallengeListener();
        },
            punish() {
                console.log("Наказание отключено");
            },

            // 📡 УМНЫЙ СЛУШАТЕЛЬ (С ЗАЩИТОЙ ДАННЫХ)
            startListening(userId) {
            if (this.listener) this.listener(); 

            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", userId);

                this.listener = window.DB_Online.onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const cloud = docSnap.data();
            
            // 🛡️ ДВОЙНАЯ защита от отката локальных данных (покупки, начисления):
            // 1) пока идёт наша запись в облако — промежуточные снапшоты игнорируем;
            // 2) 10 сек после последнего сохранения облако не применяем.
            // Раньше lastSaveTime не обновлялся и защита не работала: снапшот
            // эха heartbeat откатывал свежие покупки (вещь есть — монеты целы).
            if (this._savingCloud) return;
            const timeSinceLastSave = Date.now() - (DB.user.lastSaveTime || 0);
            if (timeSinceLastSave < 10000) return; 

            // В остальное время — синхронизируем
            if (JSON.stringify(cloud) !== JSON.stringify(DB)) {
                // 🛡️ Серверные санитизации (cheatFlag/forceUpdate) НЕ должны откатывать
                // локальный прогресс: анти-чит чинит значение в облаке, а клиент
                // продолжает со своего. Монотонные поля берём по максимуму.
                if (cloud.user && DB.user) {
                    ['totalSec', 'coins', 'xp', 'lifetimeXP'].forEach(k => {
                        const srv = Number(cloud.user[k]) || 0;
                        const loc = Number(DB.user[k]) || 0;
                        if (srv > loc) DB.user[k] = srv;
                    });
                }
                // 🔒 Облако больше не хранит rescueCode — не даём снапшоту стереть
                // локальный код (иначе бэкапы по нему перестанут обновляться)
                if (DB.user && DB.user.rescueCode && cloud.user && !cloud.user.rescueCode) {
                    cloud.user.rescueCode = DB.user.rescueCode;
                }
                DB = cloud;
                
                // 🔥 ВОТ ЭТОТ БЛОК УДАЛИТ ПРИЗРАКОВ:
                const masterList = GenAch(); // Список из твоего кода
                if (DB.achievements.length !== masterList.length) {
                    console.log("🧹 Чистка призрачных наград из облака...");
                    // Оставляем только те, что есть в коде, сохраняя прогресс
                    DB.achievements = masterList.map(newA => {
                        const found = cloud.achievements.find(o => o.title === newA.title);
                        if (found) newA.unlocked = found.unlocked;
                        return newA;
                    });
                    // Сразу отправляем чистый список обратно в облако
                    this.save(); 
                }

                cleanSubjects(); 
                localStorage.setItem(this.currentKey, JSON.stringify(DB));
                App.updateUI();
            }
        }
    });
        },

        stopListening() {
            if (this.listener) {
                this.listener();
                this.listener = null;
            }
        },
        cleanSubjects() {
            if (!DB || !DB.subjects) return;
            // Оставляем только те предметы, которые есть в ALL_SUBJECTS (убираем мусор)
            const validIds = ALL_SUBJECTS.map(s => s.id);
            const cleaned = {};
            
            Object.keys(DB.subjects).forEach(key => {
                if (validIds.includes(key)) {
                    cleaned[key] = DB.subjects[key];
                }
            });
            
            DB.subjects = cleaned;
            if (Object.keys(DB.subjects).length === 0) {
                DB.subjects['algebra'] = { name: 'Алгебра', icon: '✖️', sec: 0 };
            }
        },

        async save() {
        if (!DB || !Auth.currentUser || !Auth.currentUser.id) return;
        if (isParentMode) return; // Родитель не может сохранять данные

        // 1. Сохраняем полный профиль локально
        localStorage.setItem(this.currentKey, JSON.stringify(DB));

        // 🛡️ Метка времени СВЕЖЕГО сохранения: она же — ключ защиты слушателя
        // облака от отката (10 сек). Раньше lastSaveTime не обновлялся никогда,
        // защита была мертва, и снапшот облака откатывал покупки/начисления.
        DB.user.lastSaveTime = Date.now();

        if (window.DB_Online) {
            const dbRef = window.DB_Online;
            const userId = Auth.currentUser.id;

            try {
                // 🛡️ Флаг «запись в полёте»: слушатель облака не должен откатывать
                // локальные данные промежуточным снапшотом, пока идёт сохранение
                this._savingCloud = true;
                // 2. Отправляем ПОЛНЫЙ профиль в папку users
                const userDoc = dbRef.doc(dbRef.db, "users", userId);
                // 🔐 Добавляем ownerUID для проверки Firestore Rules
                DB._ownerUID = window._firebaseUID || null;
                // 🛡️ Служебные поля: на сервер не отдаём (держим локально)
                const _lastBackupAt = DB.user._lastBackupAt; delete DB.user._lastBackupAt;
                // 🔒 RESCUE CODE не уезжает в облако: users/{id} могут читать другие
                // вошедшие (родительский дашборд, восстановление), а по коду
                // transferGet отдаёт ВЕСЬ профиль. Код живёт только локально
                // + в серверном private_rescue (недоступном клиентам).
                const _rescue = DB.user.rescueCode; delete DB.user.rescueCode;
                await dbRef.setDoc(userDoc, DB);
                if (_rescue !== undefined) DB.user.rescueCode = _rescue;
                if (_lastBackupAt !== undefined) DB.user._lastBackupAt = _lastBackupAt;

                // 3. Отправляем ЛЕГКУЮ визитку в папку leaderboard
                // Здесь НЕТ журнала сессий и истории, поэтому это будет летать!
            const topDoc = dbRef.doc(dbRef.db, "leaderboard", userId);
                await dbRef.setDoc(topDoc, {
                    name: DB.user.name,
                    totalSec: DB.user.totalSec || 0,
                    season: DB.user.currentSeason || CURRENT_SEASON,
                    avatar: DB.user.avatar,
                    level: DB.user.level,
                    currentTitle: DB.user.currentTitle || "",
                    currentFrame: DB.user.currentFrame || null,
                    isPro: !!DB.user.isPro,
                    isVip: !!DB.user.isVip,
                    isKing: !!DB.user.isKing,
                    isTitan: !!DB.user.isTitan,
                    _ownerUID: window._firebaseUID || null,
                    lastActive: Date.now()
                    // 🛡️ fcmToken в визитку больше не пишется (утечка пуш-токенов);
                    // функции берут токены из users/{uid}.user.fcmToken
                });

                // 🛡️ РЕЗЕРВНАЯ КОПИЯ: uploads/{userId} — закрытая коллекция (read/write = false).
                // Пишет её только Cloud Function transferGet (action=reserve).
                // transfers напрямую клиент больше не пишет (read/list = false).
                if (DB.user.rescueCode && typeof Transfer !== 'undefined' && Transfer.reserveTransfer) {
                    const nowMs = Date.now();
                    if (!DB.user._lastBackupAt || nowMs - DB.user._lastBackupAt > 5 * 60 * 1000) {
                        DB.user._lastBackupAt = nowMs;
                        Transfer.reserveTransfer(DB.user.rescueCode, true).catch(e => console.warn('backup transfer:', e.message));
                    }
                }

                console.log("☁️ Синхронизация (Профиль + Топ) выполнена");
            } catch (e) { 
                console.error("Ошибка сохранения:", e);
                // Понятное сообщение пользователю вместо тихой ошибки в консоли
                const msg = (e && e.code === 'permission-denied')
                    ? "⚠️ Нет доступа к облаку. Проверь интернет и перезайди"
                    : (e && e.code === 'unavailable')
                        ? "📴 Оффлайн — прогресс сохранён локально, отправим позже"
                        : "⚠️ Не удалось синхронизировать — попробуй позже";
                if (typeof App !== 'undefined' && App.toast && !this._lastSaveErrToast) {
                    this._lastSaveErrToast = true;
                    App.toast(msg);
                    setTimeout(() => { this._lastSaveErrToast = false; }, 30000); // не чаще 1 раза в 30 сек
                }
            } finally {
                this._savingCloud = false;
            }
        }
    },

        
        export() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB)); const node = document.createElement('a'); node.setAttribute("href", dataStr); node.setAttribute("download", `${Auth.currentUser.name}_MathData.json`); document.body.appendChild(node); node.click(); node.remove(); },
        import(el) { const fr = new FileReader(); fr.onload = (e) => { try { DB = JSON.parse(e.target.result); this.save(); location.reload(); } catch(x) { alert("Ошибка файла"); } }; fr.readAsText(el.files[0]); }
    };
