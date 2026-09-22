    const App = {

        getStreakVisual(days) {
            let icon = '🕯️'; // 0-2 дня: маленькая свечка
            let cssClass = '';

            if (days >= 30) {
                icon = '🌋'; // 30+ дней: Вулкан
                cssClass = 'streak-volcano';
            } else if (days >= 14) {
                icon = '⚡'; // 14-29 дней: Электрический разряд (или синий огонь)
                cssClass = 'streak-blue';
            } else if (days >= 7) {
                icon = '💥'; // 7-13 дней: Взрыв
                cssClass = 'streak-mid';
            } else if (days >= 3) {
                icon = '🔥'; // 3-6 дней: Обычный огонь
                cssClass = 'streak-mid';
            }

            return { icon, cssClass };
        },
        // Радио
            radioPlayer: null,
            radioPlaying: false,
        async init() { 
            // 1. Проверяем интернет перед запуском
            if (!navigator.onLine) {
                document.body.innerHTML = this.getOfflineScreen();
                return;
            }
                // Следим за интернетом в реальном времени
                // === ЗАЩИТА ОТ ОФФЛАЙН ЧИТИНГА ===

            // Слушатель потери интернета
            window.addEventListener('offline', () => {
                if (Timer.active) {
                    console.warn("🚨 Интернет отключен - останавливаем таймер");
                    Timer.stop(true); // Останавливаем и сохраняем время
                    
                    // Показываем предупреждение
                    const offlineWarning = document.createElement('div');
                    offlineWarning.id = 'offline-warning';
                    offlineWarning.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: #FF4757;
                        color: white;
                        padding: 30px;
                        border-radius: 20px;
                        text-align: center;
                        z-index: 100000;
                        box-shadow: 0 10px 40px rgba(255, 71, 87, 0.5);
                    `;
                    offlineWarning.innerHTML = `
                        <div style="font-size: 60px; margin-bottom: 15px;">📡</div>
                        <h2 style="margin: 0 0 10px 0;">Интернет отключен</h2>
                        <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                            Таймер остановлен автоматически.<br>
                            Время сохранено: <b>${Math.floor(Timer.realSec / 60)} мин</b>
                        </p>
                    `;
                    document.body.appendChild(offlineWarning);
                    
                    App.toast("❌ Таймер остановлен (нет интернета)");
                    SoundSys.play('error');
                }
            });

            // Слушатель восстановления интернета
            window.addEventListener('online', () => {
                const warning = document.getElementById('offline-warning');
                if (warning) { // ТУТ БЫЛА ОШИБКА
                    warning.style.transition = 'opacity 0.5s';
                    warning.style.opacity = '0';
                    setTimeout(() => warning.remove(), 500);
                }
                
                App.toast("🌐 Интернет восстановлен! Можешь снова запускать таймер.");
                SoundSys.play('success');
            });
            Auth.init(); 
            TimeGuard.sync();
            InstallSys.init(); 
            TimeGuard.verify();

            // Слушаем изменение состояния сети в реальном времени
            // (первый online-listener выше уже показывает тост, дублировать не нужно)
            window.addEventListener('offline', () => {
                App.toast("❌ Связь потеряна. Приложение требует онлайн-режим.");
            });

            // Синхронизация при возврате во вкладку
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden && Auth.currentUser) {
                    try {
                        if (window.DB_Online && Auth.currentUser && Data.currentKey) {
                            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
                            window.DB_Online.getDoc(docRef).then(docSnap => {
                                if (docSnap.exists()) {
                                    DB = docSnap.data();
                                    Data.cleanSubjects();
                                    localStorage.setItem(Data.currentKey, JSON.stringify(DB));
                                    App.updateUI();
                                }
                            }).catch(() => {}); // Молча игнорируем сетевые ошибки
                        }
                    } catch(e) { console.warn('visibility sync error:', e); }
                }
            });

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js?v=2').catch(err => console.log(err));
            }
        },
    async changeTimezone(tz) {
        if (!DB.user) return;
        
        // 🛡️ ЗАЩИТА ОТ +120 МИН: смена пояса во время идущего таймера
        // перевзводит TimeGuard и исторически двигала время сессии.
        // Пояс влияет ТОЛЬКО на отображение дат (журнал), не на ход времени.
        if (Timer.active) {
            // Возвращаем селект к текущему значению
            const sel = document.getElementById('timezone-select');
            const curTZ = DB.user.timezone || 'auto';
            if (sel) sel.value = curTZ;
            return App.toast("⏱️ Сначала останови таймер — потом меняй пояс!");
        }
        
        DB.user.timezone = tz;
        
        App.toast("⏳ Синхронизация пояса...");
        
        // 1. Сохраняем в базу
        Data.save();
        
        // 2. Обновляем отображение дат под новый пояс (ход времени НЕ меняется)
        await TimeGuard.sync();
        
        // 3. Обновляем интерфейс
        this.renderHistory();
        App.toast("✅ Пояс изменен на " + tz);
    },
        async syncWithCloud() {
            if (!Auth.currentUser || !window.DB_Online) return;

            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
            const docSnap = await window.DB_Online.getDoc(docRef);

            if (docSnap.exists()) {
                const cloud = docSnap.data();
                // Жестко заменяем локальные данные облачными
                // (Так как мы теперь строго онлайн, облако — это и есть правда)
                DB = cloud;
                this.cleanSubjects();
                localStorage.setItem(this.currentKey, JSON.stringify(DB));
                App.updateUI();
                console.log("☁️ Облачная синхронизация завершена");
            }
        },
        getOfflineScreen() {
            return `
                <div style="background:#1e1e2e; color:white; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; font-family:sans-serif;">
                    <div style="font-size:80px; margin-bottom:20px;">🌐</div>
                    <h1>Ой! Нужен интернет</h1>
                    <p style="opacity:0.7;">MathBooster PRO теперь работает строго онлайн,<br>чтобы твой прогресс всегда был синхронизирован.</p>
                    <button onclick="location.reload()" style="background:#6C63FF; color:white; border:none; padding:15px 30px; border-radius:12px; font-weight:bold; margin-top:20px;">ПОПРОБОВАТЬ СНОВА</button>
                </div>
            `;
        },

        
        setText(id, text) {
            const el = document.getElementById(id);
            if (el) {
                el.innerText = text;
            }
        },
    // --- ЦИТАТА ДНЯ ---
        updateDailyQuote() {
            const quotes = [
                "Время — это материал, из которого сделана жизнь.",
                "Инвестиции в знания платят лучшие дивиденды.",
                "Тяжело в учении — легко в бою. (Суворов)",
                "Не откладывай на завтра то, что можно выучить сегодня.",
                "Образование — это то, что остается, когда забыто все, чему учили.",
                "Дисциплина — это решение делать то, что не хочется, чтобы достичь того, что хочется.",
                "Сделай сегодня то, что другие не хотят, завтра будешь жить так, как другие не могут.",
                "Успех — это сумма небольших усилий, повторяющихся изо дня в день.",
                "Твой мозг — это твой самый дорогой актив. Качай его!",
                "Гений — это 1% таланта и 99% труда."
            ];

            const el = document.getElementById('daily-quote');
            if (el) {
                // Выбираем цитату по дню месяца (чтобы у всех была одна и та же сегодня)
                const dayIndex = new Date().getDate(); 
                const quote = quotes[dayIndex % quotes.length];
                el.innerText = `"${quote}"`;
            }
        },
        // ЛЕГКИЙ ВХОД (Без лагов)
        async initAfterLogin() {
            // 🏁 Игровой профиль загружен в память — FCM может привязать токен
            window._gameUserReady = true;
            // 🏆 Проверка сезона
            await SeasonSystem.checkAndReset();
            
            // 🧊 Замораживаем итоги Сезона 1 (сам и общая заморозка топа)
            if (window.DB_Online && Auth.currentUser) {
                SeasonSystem.archiveMySeasonCards().catch(e => console.error(e));
                SeasonSystem.sweepOldSeasons().catch(e => console.error(e));
            }
            // 🧹 Новый сезон: вычищаем из журнала сессии прошлого сезона.
            // Итоги прошлого сезона уже лежат в архиве seasonHistory (профиль).
            if (DB && DB.sessions && DB.sessions.length) {
                const seasonStart = SeasonSystem.currentSeasonStart();
                if (seasonStart > 0) {
                    const before = DB.sessions.length;
                    DB.sessions = DB.sessions.filter(s => {
                        let t = Number(s.date);
                        if (!t) { const p = Date.parse(s.date); t = isNaN(p) ? 0 : p; }
                        return t >= seasonStart;
                    });
                    if (DB.sessions.length !== before) {
                        Data.save();
                        console.log(`🧹 Журнал очищен от сессий прошлого сезона: удалено ${before - DB.sessions.length}`);
                    }
                }
            }
            // --- АВТО-ЧИСТКА АНОМАЛЬНЫХ СЕССИЙ (> 10 ЧАСОВ) ---
if (DB && DB.sessions && DB.sessions.length > 0) {
    const MAX_ALLOWED_SEC = 36000; // 10 часов в секундах
    const initialCount = DB.sessions.length;

    // Считаем, сколько секунд реально выбрасываем
    let removedSec = 0;
    DB.sessions.forEach(session => {
        const s = Number(session.sec) || 0;
        if (s > MAX_ALLOWED_SEC) removedSec += s;
    });

    // Оставляем в журнале только те записи, которые меньше или равны 10 часам
    DB.sessions = DB.sessions.filter(session => {
        return (Number(session.sec) || 0) <= MAX_ALLOWED_SEC;
    });

    if (DB.sessions.length < initialCount) {
        // ВАЖНО: вычитаем только удалённое время, а НЕ приравниваем totalSec
        // к сумме журнала. Журнал хранит максимум 50 последних записей,
        // поэтому прежний код обнулял месяцы учёбы у любого,
        // у кого нашлась одна аномальная запись.
        DB.user.totalSec = Math.max(0, (Number(DB.user.totalSec) || 0) - removedSec);

        Data.save();
        App.updateUI();
        console.log(`⚠️ Удалено подозрительных сессий: ${initialCount - DB.sessions.length} (${removedSec} сек.)`);
    }
}
// ------------------------------------------------
            this.updateRadioWidget();
            QuestSys.render();
            WeeklyQuestSys.render();
            this.updateUI();
            this.updateDailyQuote();
            this.renderMonthlyWidget();
// --- СИНХРОНИЗАЦИЯ ЧАСОВ ТЕКУЩЕГО СЕЗОНА ---
// Часы сезона = ТОЛЬКО сессии, начавшиеся после старта текущего сезона
// (старт = конец последнего архивного сезона в seasonHistory).
// Сессии Сезона 1 остаются в журнале навсегда, но в часы Сезона 2 не идут.
if (DB && DB.user) {
    const seasonSec = SeasonSystem.currentSessionSec();
    const current = Number(DB.user.totalSec) || 0;
    // Расхождение больше 1 минуты — чиним в обе стороны:
    // воскрешённые старые часы обнуляются, потерянные сессии восстанавливаются.
    if (Math.abs(seasonSec - current) > 60) {
        DB.user.totalSec = seasonSec;
        Data.save();
        App.updateUI();
        console.log("✅ Часы сезона синхронизированы: " + seasonSec + " сек. (было: " + current + ")");
    }
}
            setTimeout(() => {
                this.renderSubjects();
                SubjectSys.render();
                if (window.Trainer) Trainer.init();
            }, 100);

            setTimeout(() => {
                this.renderHistory();
                
                // 1. Проверяем, новый ли это пользователь (был ли запуск туториала)
                // Мы смотрим на количество сессий. Если их 0, значит юзер только зашел.
                const isNewUser = (!DB.sessions || DB.sessions.length === 0);
                
                // 2. Если юзер старый — показываем награду сразу
                if (window.DailySys && !isNewUser) {
                    DailySys.check();
                }
                
                // Если юзер новый, DailySys.check() сработает только при закрытии туториала
                
                if (window.AchievementSys) AchievementSys.check();
            }, 400);

            // Запуск проверки ежедневного уведомления
            setTimeout(() => {
                if (DB && DB.settings && DB.settings.notifications && window.Notify) {
                    Notify.startDailyCheck();
                }
            }, 2000);
            const quoteEl = document.querySelector('#dashboard .text-light i') || document.querySelector('#dashboard .card div[style*="opacity: 0.8"]');

            if (quoteEl) {
            // Берем случайную
            const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
            quoteEl.innerText = `"${randomQuote}"`;
            }
            WeeklyReportSys.check();

            },

        copyId() {
            if (Auth.currentUser && Auth.currentUser.id) {
                navigator.clipboard.writeText(Auth.currentUser.id)
                    .then(() => App.toast("✅ ID скопирован!"))
                    .catch(() => prompt("Скопируй ID:", Auth.currentUser.id));
            }
            },
        changeNickname() {
            const COST = 500;
            if (DB.user.coins < COST) return App.toast(`❌ Нужно ${COST} монет`);

            const newName = prompt(`Смена ника стоит ${COST} монет.\nВведите новое имя:`, DB.user.name);
            if (!newName) return;
            const cleanName = newName.trim();
            const validChars = /^[a-zA-Z0-9а-яА-ЯёЁ\s._-]+$/;
            if (!validChars.test(cleanName)) {
                return alert("⛔️ Эмодзи и спецсимволы запрещены!\nИспользуйте только буквы и цифры.");
            }
            if (cleanName.length === 0 || cleanName.length > 12) return App.toast("Имя от 1 до 12 символов");
            if (window.NameGuard && !NameGuard.check(cleanName)) return alert("⛔️ Имя запрещено.");

            if (confirm(`Сменить на "${cleanName}" за ${COST} монет?`)) {
                DB.user.coins -= COST;
                DB.user.name = cleanName;
                Data.save();

                // Обновляем список на входе
                try {
                    let users = JSON.parse(localStorage.getItem('MathUsers') || '[]');
                    const index = users.findIndex(u => u.id === Auth.currentUser.id);
                    if (index !== -1) {
                        users[index].name = cleanName;
                        localStorage.setItem('MathUsers', JSON.stringify(users));
                        Auth.users = users;
                        Auth.currentUser.name = cleanName;
                    }
                } catch(e){}

                this.updateUI();
                SoundSys.play('coin');
                App.toast("✅ Никнейм изменен!");
            }
        },

        async resetAllProgress() {
                // 1. Первое предупреждение
                const confirm1 = confirm("⚠️ ВНИМАНИЕ!\n\nЭто полностью обнулит твои монеты, уровень, время и историю.\nЭто действие нельзя отменить.\n\nТы уверен?");
                if (!confirm1) return;

                // 2. Второе предупреждение
                const confirm2 = confirm("ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!\n\nДанные в облаке (Firebase) также будут стерты.\nТы действительно хочешь начать всё с нуля?");
                if (!confirm2) return;

                App.toast("⏳ Сброс данных...");

                // 3. Создаем абсолютно чистый объект данных
                const cleanDB = JSON.parse(JSON.stringify(DefaultDB));
                cleanDB.achievements = GenAch();
                
                // Сохраняем только личность (имя, аватар, ID), чтобы не вылетать из аккаунта
                cleanDB.user.name = DB.user.name;
                cleanDB.user.avatar = DB.user.avatar;
                cleanDB.user.gender = DB.user.gender;
                cleanDB.user.id = Auth.currentUser.id;
                cleanDB.user.rescueCode = DB.user.rescueCode;

                // 4. Заменяем текущую базу в памяти
                DB = cleanDB;

                // 5. Принудительно сохраняем в облако (перезаписываем всё)
                if (window.DB_Online) {
                    const dbRef = window.DB_Online;
                    const userId = Auth.currentUser.id;
                    
                    try {
                        // Перезаписываем основной профиль
                        await dbRef.setDoc(dbRef.doc(dbRef.db, "users", userId), DB);
                        
                        // Обнуляем визитку в Топе
                        await dbRef.setDoc(dbRef.doc(dbRef.db, "leaderboard", userId), {
                            name: DB.user.name,
                            totalSec: 0,
                            avatar: DB.user.avatar,
                            level: 1,
                            currentTitle: "",
                            lastActive: Date.now()
                        });
                        
                        // Очищаем локальную память
                        localStorage.setItem('MathData_' + userId, JSON.stringify(DB));
                        
                        alert("✅ Весь прогресс успешно сброшен!");
                        location.reload(); // Перезагружаем приложение
                        
                    } catch (e) {
                        console.error(e);
                        alert("❌ Ошибка при связи с сервером. Попробуй позже.");
                    }
                }
            },
        toggleDarkMode(enabled) {
            DB.user.darkMode = enabled;
            if (enabled) document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', enabled);
            Data.save();
            this.updateUI();
        },
        renderMonthlyWidget() {
            const goalHours = DB.user.monthlyGoal || 40;
            // Берём текущий месяц ПО ТАШКЕНТУ — строковым сравнением ключей YYYY-MM
            const monthPrefix = getUZDate().slice(0, 7); // 'YYYY-MM'

            let totalMonthSec = 0;

            for (let key in DB.history) {
                if (String(key).slice(0, 7) === monthPrefix) {
                    totalMonthSec += (Number(DB.history[key]) || 0);
                }
            }

            const currentHours = Math.floor(totalMonthSec / 3600);
            const currentMins = Math.floor((totalMonthSec % 3600) / 60);
            const pct = Math.min(100, Math.floor((totalMonthSec / (goalHours * 3600)) * 100));

            // Обновляем UI
            document.getElementById('goal-text').innerText = `${currentHours}ч ${currentMins}м / ${goalHours}ч`;
            document.getElementById('goal-pct').innerText = `${pct}%`;
            document.getElementById('goal-circle').setAttribute('stroke-dasharray', `${pct}, 100`);
        },

        editMonthlyGoal() {
            const newGoal = prompt("Установи свою цель на месяц (в часах):", DB.user.monthlyGoal);
            if (newGoal && !isNaN(newGoal) && newGoal > 0) {
                DB.user.monthlyGoal = parseInt(newGoal);
                Data.save();
                this.renderMonthlyWidget();
                App.toast("✅ Цель обновлена!");
                SoundSys.play('click');
            }
        },
        updateUI() {
            if (!DB || !DB.user || !Auth.currentUser) return;
            const newClass = `theme-${DB.user.theme} ${DB.user.darkMode ? 'dark-mode' : ''}`.trim();
            const tzSelect = document.getElementById('timezone-select');
            if (tzSelect && DB.user.timezone) {
                tzSelect.value = DB.user.timezone;
            }
  
            // Оптимизированная смена классов
            if (document.body.className !== newClass) document.body.className = newClass;
            
            const toggle = document.getElementById('dark-toggle');
            if (toggle) toggle.checked = DB.user.darkMode;

            const notifyToggle = document.getElementById('notify-toggle');
            if (notifyToggle && DB.settings) notifyToggle.checked = DB.settings.notifications;

            const rescueEl = document.getElementById('rescue-code-display');
            
            if (rescueEl && DB.user) {
                // 1. Если кода еще нет — создаем
                if (!DB.user.rescueCode) {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    let code = '';
                    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                    DB.user.rescueCode = code;
                    Data.save();
                }

                // 2. ВСЕГДА пересохраняем код в Firebase (если был удалён)
                if (window.DB_Online && DB.user.rescueCode) {
                    const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", DB.user.rescueCode);
                    window.DB_Online.setDoc(docRef, {
                        userId: Auth.currentUser.id,
                        data: DB,
                        isPermanent: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true }).catch(e => console.warn('rescueCode save:', e));
                }

                // 3. Показываем код на экране
                rescueEl.innerText = DB.user.rescueCode;
            }

            // Обновление текстов
            this.setText('coin-display', DB.user.coins);
            this.setText('streak-display', DB.user.streak);
            this.setText('header-name', DB.user.name || 'Игрок');
            this.setText('header-avatar', DB.user.avatar || '😎');
            this.setText('profile-name-big', DB.user.name || 'Игрок');
            this.setText('profile-avatar-big', DB.user.avatar || '😎');
            // Обновление иконки и счетчика стрика
            const streakInfo = this.getStreakVisual(DB.user.dailyStreak || 0);
            const streakContainer = document.getElementById('streak-display').parentElement;

            if (streakContainer) {
                // Находим эмодзи внутри блока (первый span)
                const iconEl = streakContainer.querySelector('span');
                if (iconEl) {
                    iconEl.innerText = streakInfo.icon;
                    iconEl.className = 'streak-icon ' + streakInfo.cssClass;
                }
                // Обновляем само число
                this.setText('streak-display', DB.user.dailyStreak || 0);
            }            this.setText('profile-id-text', Auth.currentUser ? Auth.currentUser.id : "...");

            // Обновление заголовка предмета под таймером
            const currentSub = DB.subjects[DB.user.subject];
            const titleEl = document.getElementById('subject-title');
            if (titleEl) {
                titleEl.innerText = currentSub ? currentSub.name : "Выбери предмет";
            }

            // --- СТАТУСЫ И ЛИГИ (PRO) ---
            let currentLeague = LEAGUES[0];
            let nextLeague = null;

            // Определяем текущую и следующую лиги
            for (let i = 0; i < LEAGUES.length; i++) {
                if (DB.user.level >= LEAGUES[i].min) {
                    currentLeague = LEAGUES[i];
                    nextLeague = LEAGUES[i + 1] || null;
                }
            }
            
            // 1. Формируем текст статуса
            let statusText = currentLeague.name; 
            if (DB.user.currentTitle) {
                statusText = DB.user.currentTitle; // Приоритет купленному титулу
            }

            // 2. Расчет прогресса до следующей лиги (в профиле)
            const leagueProgressInfo = document.getElementById('league-progress-info');
            if (leagueProgressInfo) {
                if (nextLeague) {
                    const lvlsNeeded = nextLeague.min - DB.user.level;
                    leagueProgressInfo.innerText = `До следующей лиги: ${lvlsNeeded} ур.`;
                } else {
                    leagueProgressInfo.innerText = `🏆 МАКСИМАЛЬНЫЙ РАНГ`;
                }
            }

            // 2. Добавляем Эмодзи Донатера (Приоритет: Титан > Король > VIP)
            if (DB.user.isTitan) {
                statusText = `🌌 ${statusText}`; // Эмодзи космоса/вселенной для Титана
            } else if (DB.user.isKing) {
                statusText = `👑 ${statusText}`; 
            } else if (DB.user.isVip) {
                statusText = `💎 ${statusText}`; 
            }

            // 3. Выводим на экран
            this.setText('header-league', statusText);
            this.setText('profile-league-big', statusText);

            // Блок уведомлений (Безопасный)
            
            const nToggle = document.getElementById('notify-toggle');

            if (DB.settings) {
                if (nToggle) nToggle.checked = DB.settings.notifications || false;
                
            }
            // Аватарки с рамками
            const headerBox = document.getElementById('header-avatar-box');
            const pb = document.getElementById('profile-avatar-box');

            const applyStyles = (el) => {
                if (!el) return;
                el.className = 'profile-img'; 
                el.classList.add(currentLeague.color); 
                if (DB.user.currentFrame) {
                    el.classList.add('framed');
                    el.classList.add(DB.user.currentFrame);
                }
            };
            applyStyles(headerBox);
            applyStyles(pb);

            // Статистика
        
            // 👇 ВОЗВРАЩАЕМ ПЕРЕМЕННУЮ 'h', ЧТОБЫ НЕ БЫЛО ОШИБКИ 👇
            const h = (DB.user.totalSec / 3600).toFixed(1);
            
            // Обновляем текст на экране
            this.setText('stat-total-time', h + 'ч');
            this.setText('timer', new Date((Timer.visualSec || 0) * 1000).toISOString().substr(11, 8))
            this.setText('stat-total-time', h + 'ч');
            this.setText('prof-lvl', DB.user.level);
            this.setText('prof-xp', DB.user.xp);
            this.setText('prof-coins', DB.user.coins);
            
            const xpBar = document.getElementById('prof-xp-bar');
            if(xpBar) xpBar.style.width = (DB.user.xp/DB.user.nextXp*100)+'%';
            this.setText('xp-progress-text', `${DB.user.xp} / ${DB.user.nextXp} XP`);
            
            // Рендер наград (если список пуст - чиним)
            const achList = document.getElementById('ach-list');
            if (achList) {
                if (!DB.achievements || DB.achievements.length === 0) {
                    DB.achievements = GenAch();
                    Data.save();
                }
                achList.innerHTML = DB.achievements.map(a => {
                    let currentVal = 0;
                    if (a.type === 'total') currentVal = DB.user.totalSec;
                    else if (a.type === 'lvl') currentVal = DB.user.level;
                    else if (a.type === 'streak') currentVal = DB.user.dailyStreak;
                    else if (a.type === 'math_total') currentVal = DB.user.lifetimeMathSolved || 0;
                    else if (a.type === 'pvp_wins') currentVal = DB.user.pvpWins || 0;
                    else if (a.type === 'themes_count') currentVal = (DB.user.ownedThemes || []).length;
                    else if (a.type === 'radios_count') currentVal = (DB.user.ownedRadios || []).length;
                    
                    const pct = Math.min(100, (currentVal / a.max) * 100);
                    const isUnlocked = a.unlocked || (pct >= 100);
                    
                    // 🛠️ ИСПРАВЛЕНИЕ: Если редкость не определена, пишем BRONZE
                    const rarityText = (a.rarity || 'bronze').toUpperCase();

                    return `
                    <div class="ach-row ${isUnlocked ? 'unlocked' : ''}">
                        <div class="rarity-tag rarity-${a.rarity || 'bronze'}">${rarityText}</div>
                        
                        <!-- 🔓 ВРЕМЕННО ОТКРЫТО: заменяем '🔒' на a.icon чтобы ты видел ошибки -->
                        <div class="ach-icon">
                            <span style="display: block; line-height: 1;">${a.icon}</span>
                        </div>

                        <div class="ach-info" style="flex-grow:1;">
                            <div class="ach-title" style="font-weight:900; font-size:14px; color:var(--text);">${a.title}</div>
                            <div class="ach-desc" style="font-size:11px; color:var(--text-light); margin-bottom:8px;">${a.desc}</div>
                            <div class="ach-bar-bg" style="height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                                <div class="ach-bar-fill" style="width:${pct}%; height:100%; background:${isUnlocked ? '#FFD700' : 'var(--primary)'}; transition:1s;"></div>
                            </div>
                            <div style="font-size:9px; text-align:right; margin-top:4px; font-weight:bold; opacity:0.6;">
                                ${Math.floor(currentVal)} / ${a.max}
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
            // Применяем золотое свечение для ветеранов
            const profileCard = document.querySelector('#profile .card');
            if (profileCard) {
                if (DB.user.streak >= 14) profileCard.classList.add('veteran-card');
                else profileCard.classList.remove('veteran-card');
            }
            // Индикатор бустера в шапке или профиле
            const isBoosterActive = Date.now() < (DB.user.boosterExpiry || 0);
            const streakEl = document.getElementById('streak-display'); // Ищем огонь в шапке
            
            if (streakEl) {
                if (isBoosterActive) {
                    streakEl.parentElement.style.boxShadow = "0 0 10px #00E0D0";
                    streakEl.parentElement.style.borderColor = "#00E0D0";
                } else {
                    streakEl.parentElement.style.boxShadow = "";
                    streakEl.parentElement.style.borderColor = "";
                }
            }
       },
    // Внутри объекта App:
// 1. Отрисовка радио в магазине
    renderRadioShop() {
        //Радио
        const radioList = document.getElementById('radio-shop-list');
        if (radioList) {
            const isRadioPlaying = this.radioPlaying; // Проверяем, играет ли радио
            
            radioList.innerHTML = SHOP_RADIOS.map(r => {
                const owned = (DB.user.ownedRadios || []).includes(r.id);
                const active = DB.user.currentRadio === r.id;
                const isBlocked = isRadioPlaying && !active; // Блокируем если играет другая станция
                
                return `
                    <div class="shop-item ${active ? 'active' : ''} ${isBlocked ? 'blocked' : ''}" 
                        onclick="App.buyRadio('${r.id}')"
                        style="${isBlocked ? 'opacity: 0.4; pointer-events: none;' : ''}">
                        <div style="font-size: 32px;">${r.icon}</div>
                        <div style="font-weight:bold; font-size:12px;">${r.name}</div>
                        ${!owned ? `<small class="shop-price-tag">${r.price} 💰</small>` : 
                        active && isRadioPlaying ? '<small style="color:var(--accent); font-weight:bold;">⏸ Играет...</small>' :
                        active ? '<small style="color:var(--success); font-weight:bold;">▶️ Включить</small>' : 
                        isBlocked ? '<small style="color:var(--text-light);">🔒 Заблокировано</small>' :
                        '<small style="color:var(--success);">Куплено</small>'}
                    </div>`;
            }).join('');
        }
    },

    // 2. Функция покупки/выбора
    buyRadio(id) {
        const r = SHOP_RADIOS.find(x => x.id === id);
        if (!DB.user.ownedRadios) DB.user.ownedRadios = [];

        if (DB.user.ownedRadios.includes(id)) {
            DB.user.currentRadio = id;
            App.toast(`Выбрано: ${r.name}`);
            
            // Если музыка играет — меняем поток
            if (MusicPlayer.playing) {
                MusicPlayer.audio.pause();
                MusicPlayer.audio.src = r.url;
                MusicPlayer.audio.load();
                MusicPlayer.audio.play();
            }
        } else if (DB.user.coins >= r.price) {
            if (confirm(`Купить ${r.name} за ${r.price} 💰?`)) {
                DB.user.coins -= r.price;
                DB.user.ownedRadios.push(id);
                DB.user.currentRadio = id;
                SoundSys.play('win');
                FX.confetti();
            }
        } else {
            return App.toast("Недостаточно монет");
        }
        
        Data.save();
        this.renderShop(); 
        this.updateRadioWidget();     
    },

    // 3. Виджет на главном экране (ОБНОВЛЕННЫЙ)
    updateRadioWidget() {
        const container = document.getElementById('radio-widget-container');
        if (!container) return;

        const ownedRadios = DB.user.ownedRadios || [];

        // 1. Если ничего не куплено — показываем заглушку с кнопкой в магазин
        if (ownedRadios.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <h3>📻 Радио</h3>
                    <p style="font-size:12px; color:var(--text-light); margin-bottom:15px;">Музыка для фокуса заблокирована.</p>
                    <button class="btn btn-primary" onclick="App.switchTab('shop'); setTimeout(()=>document.getElementById('radio-shop-list').scrollIntoView({behavior:'smooth', block:'center'}), 150);" style="font-size:13px; width: 100%;">
                        В магазин 🛒
                    </button>
                </div>`;
            return;
        }

        // 2. Если есть купленные — показываем плеер и кнопку смены
        const currentId = DB.user.currentRadio || ownedRadios[0];
        const current = SHOP_RADIOS.find(x => x.id === currentId);
        
        container.innerHTML = `
            <div class="card">
                <h3>📻 Радио</h3>
                
                <div class="music-widget" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg); padding: 10px 15px; border-radius: 15px; margin-bottom: 10px;">
                    <div class="music-info" style="display: flex; align-items: center; gap: 10px; font-weight: bold; font-size: 13px;">
                        <span style="font-size: 20px;">${current.icon}</span>
                        <span>${current.name}</span>
                    </div>
                    <div class="visualizer" id="music-vis" style="opacity: ${MusicPlayer.playing ? '1' : '0'}; display: flex; gap: 2px; align-items: flex-end; height: 15px;">
                        <div class="bar" style="animation-duration: 0.5s"></div>
                        <div class="bar" style="animation-duration: 0.7s"></div>
                        <div class="bar" style="animation-duration: 0.4s"></div>
                    </div>
                    <button id="music-btn" class="btn btn-primary" style="width: auto; padding: 5px 15px; font-size: 12px; margin: 0;" onclick="MusicPlayer.toggle()">
                        ${MusicPlayer.playing ? '⏸' : '▶'}
                    </button>
                </div>
                
                <button class="btn btn-outline" style="font-size:11px; width:100%; padding: 8px; border: 1px dashed var(--primary); color: var(--primary);" 
                        onclick="App.switchTab('shop'); setTimeout(()=>document.getElementById('radio-shop-list').scrollIntoView({behavior:'smooth', block:'center'}), 150);">
                    Сменить станцию 🛒
                </button>
            </div>`;
    },
        

        copyRescueCode() {
            const code = DB.user.rescueCode;
            if (!code) return;
            
            navigator.clipboard.writeText(code).then(() => {
                alert(`✅ КОД СКОПИРОВАН: ${code}\n\nСрочно отправь его себе в Телеграм (в Избранное) или запиши в Заметки!\n\nЕсли приложение удалится, нажми "У меня есть код" и введи его.`);
            }).catch(() => {
                prompt("Скопируй этот код и сохрани:", code);
            });
            
            // Принудительно обновляем резервную копию в облаке прямо сейчас
            if(window.DB_Online) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", code);
                window.DB_Online.setDoc(docRef, {
                    userId: Auth.currentUser.id,
                    data: DB,
                    isPermanent: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        },

        regenerateRescueCode() {
            if (!confirm("Создать НОВЫЙ код?\n\nСтарый код перестанет работать.\nУбедись, что родитель получил новый код.")) return;
            
            // 1. Удаляем старый код из Firebase
            if (window.DB_Online && DB.user.rescueCode) {
                const oldRef = window.DB_Online.doc(window.DB_Online.db, "transfers", DB.user.rescueCode);
                window.DB_Online.deleteDoc(oldRef).catch(() => {});
            }
            
            // 2. Создаём новый код
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let newCode = '';
            for (let i = 0; i < 8; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));
            DB.user.rescueCode = newCode;
            Data.save();
            
            // 3. Сохраняем в Firebase
            if (window.DB_Online) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", newCode);
                window.DB_Online.setDoc(docRef, {
                    userId: Auth.currentUser.id,
                    data: DB,
                    isPermanent: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
            
            // 4. Обновляем экран
            const rescueEl = document.getElementById('rescue-code-display');
            if (rescueEl) rescueEl.innerText = newCode;
            App.toast("✅ Новый код создан! " + newCode);
        },
        // МАГАЗИН (Отрисовка)
        renderShop() {
    const userCoins = DB.user.coins || 0;

    // 1. ТЕМЫ
    const themeList = document.getElementById('theme-list');
    if (themeList) {
        themeList.innerHTML = THEMES.map(t => {
            const owned = DB.user.ownedThemes.includes(t.id);
            const active = DB.user.theme === t.id;
            const canAfford = userCoins >= t.price;
            return `
                <div class="shop-item ${active ? 'active' : ''} ${owned ? 'owned-item' : ''}" onclick="App.buyTheme('${t.id}')">
                    <div class="item-icon">${t.icon}</div>
                    <div style="font-weight:800; font-size:12px;">${t.name}</div>
                    ${owned ? 
                        `<div class="shop-price-tag" style="color:var(--success);">${active ? '● Активно' : '✓ Куплено'}</div>` : 
                        `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${t.price} 💰</div>`
                    }
                </div>`;
        }).join('');
    }

    // 2. АВАТАРЫ
    const avatarList = document.getElementById('avatar-shop-list');
    if (avatarList) {
        const userGender = DB.user.gender || 'male';
        const filteredAvatars = SHOP_AVATARS.filter(a => !a.gender || a.gender === userGender);
        avatarList.innerHTML = filteredAvatars.map(a => {
            const owned = DB.user.ownedAvatars.includes(a.id);
            const active = DB.user.avatar === a.icon;
            const canAfford = userCoins >= a.price;
            return `
                <div class="shop-item ${active ? 'active' : ''} ${owned ? 'owned-item' : ''}" onclick="App.buyAvatar('${a.id}')">
                    <div class="item-icon">${a.icon}</div>
                    <div style="font-weight:800; font-size:12px;">${a.name}</div>
                    ${owned ? 
                        `<div class="shop-price-tag" style="color:var(--success);">${active ? '● Выбран' : '✓ Есть'}</div>` : 
                        `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${a.price} 💰</div>`
                    }
                </div>`;
        }).join('');
    }

    // 3. СТАТУСЫ (ТИТУЛЫ)
    const titleList = document.getElementById('title-shop-list');
    if (titleList) {
        const userTitles = DB.user.ownedTitles || [];
        titleList.innerHTML = SHOP_TITLES.map(t => {
            const owned = userTitles.includes(t.id);
            const active = DB.user.currentTitle === t.name;
            const canAfford = userCoins >= t.price;
            
            // Пример для Титулов внутри renderShop
            let priceDisplay = '';
            if (t.price === -1) {
                priceDisplay = `<div class="shop-price-tag" style="background:rgba(255,118,117,0.1); color:var(--accent);">💎 Донат</div>`;
            } else if (owned) {
                priceDisplay = `<div class="shop-price-tag" style="background:rgba(0,210,106,0.1); color:var(--success);">${active ? '● Надет' : 'Выбрать'}</div>`;
            } else {
                priceDisplay = `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${t.price} 💰</div>`;
            }
            return `
                <div class="shop-item ${active ? 'active' : ''}" onclick="${t.price === -1 ? '' : (owned ? `App.equipTitle('${t.name}')` : `App.buyTitle('${t.id}')`)}">
                    <div style="font-weight:900; font-size:14px; margin: 10px 0;">${t.name}</div>
                    ${priceDisplay}
                </div>`;
        }).join('');
    }

    // 4. РАДИО
    const radioList = document.getElementById('radio-shop-list');
    if (radioList) {
        const isRadioPlaying = MusicPlayer.playing;
        radioList.innerHTML = SHOP_RADIOS.map(r => {
            const owned = (DB.user.ownedRadios || []).includes(r.id);
            const active = DB.user.currentRadio === r.id;
            const isBlocked = isRadioPlaying && !active;
            const canAfford = userCoins >= r.price;
            return `
                <div class="shop-item ${active ? 'active' : ''}" onclick="App.buyRadio('${r.id}')" style="${isBlocked ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    <div class="item-icon">${r.icon}</div>
                    <div style="font-weight:800; font-size:12px;">${r.name}</div>
                    ${!owned ? 
                        `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${r.price} 💰</div>` : 
                        `<div class="shop-price-tag" style="color:var(--success);">${active ? '● Выбрано' : 'Включить'}</div>`
                    }
                </div>`;
        }).join('');
    }

    // 5. РАМКИ
    const frameList = document.getElementById('frame-shop-list');
    if (frameList) {
        const userFrames = DB.user.ownedFrames || [];
        frameList.innerHTML = SHOP_FRAMES.map(f => {
            const owned = userFrames.includes(f.id);
            const active = DB.user.currentFrame === f.css;
            const canAfford = userCoins >= f.price;
            return `
                <div class="shop-item ${active ? 'active' : ''}" onclick="App.buyFrame('${f.id}')" style="padding-top: 30px;">
                    <div style="height:45px; width:45px; border-radius:50%; background:var(--bg); position:relative; margin-bottom:5px;" class="${f.css}"></div>
                    <div style="font-weight:800; font-size:12px;">${f.name}</div>
                    ${owned ? 
                        `<div class="shop-price-tag" style="color:var(--success);">${active ? '● Надет' : 'Надеть'}</div>` : 
                        `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${f.price} 💰</div>`
                    }
                </div>`;
        }).join('');
    }

    // 6. ЗВУКИ
    const soundList = document.getElementById('sound-shop-list');
    if (soundList) {
        const userSounds = DB.user.ownedSounds || ['standard'];
        soundList.innerHTML = SHOP_SOUNDS.map(s => {
            const owned = userSounds.includes(s.id);
            const active = DB.user.soundPack === s.id;
            const canAfford = userCoins >= s.price;
            return `
                <div class="shop-item ${active ? 'active' : ''}" onclick="App.buySound('${s.id}')">
                    <div class="item-icon">🔊</div>
                    <div style="font-weight:800; font-size:12px;">${s.name}</div>
                    ${owned ? 
                        `<div class="shop-price-tag" style="color:var(--success);">${active ? '● Активен' : 'Выбрать'}</div>` : 
                        `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${s.price} 💰</div>`
                    }
                </div>`;
        }).join('');
    }

    // 7. УСИЛИТЕЛИ (ПРЕДМЕТЫ)
    const itemList = document.getElementById('item-shop-list');
    if (itemList) {
        itemList.innerHTML = SHOP_ITEMS.map(item => {
            const count = (DB.user.inventory && DB.user.inventory[item.id]) || 0;
            const canAfford = userCoins >= item.price;
            let actionText = `<div class="shop-price-tag ${canAfford ? 'affordable' : ''}">${item.price} 💰</div>`;

            if (item.id === 'booster') {
                const expiry = DB.user.boosterExpiry || 0;
                if (Date.now() < expiry) {
                    const diff = expiry - Date.now();
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    actionText = `<div class="shop-price-tag" style="background:#00E0D0; color:black;">⚡ ${h}ч ${m}м</div>`;
                }
            }

            return `
                <div class="shop-item" onclick="App.buyItem('${item.id}', ${item.price})">
                    <div class="item-icon">${item.icon}</div>
                    <div style="font-weight:800; font-size:12px;">${item.name}</div>
                    <div style="font-size:9px; color:var(--text-light); min-height:22px;">${item.desc}</div>
                    ${actionText}
                    ${item.id === 'shield' && count > 0 ? `<div style="font-size:10px; font-weight:bold; color:var(--primary);">Запас: ${count}</div>` : ''}
                </div>`;
        }).join('');
    }
},
        // ФУНКЦИИ ПОКУПОК
        buyTheme(id) {
            const t = THEMES.find(x=>x.id===id);
            if(DB.user.ownedThemes.includes(id)) { 
                DB.user.theme=id; Data.save(); this.updateUI(); this.renderShop(); SoundSys.play('click'); 
            } else if(DB.user.coins >= t.price && confirm(`Купить за ${t.price}?`)) {
                DB.user.coins -= t.price; 
                DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + t.price;
                DB.user.ownedThemes.push(id); DB.user.theme=id;
                Data.save(); this.updateUI(); this.renderShop(); SoundSys.play('success'); FX.confetti();
            } else { App.toast("Недостаточно монет"); SoundSys.play('error'); }
        },
        buyAvatar(id) {
            const a = SHOP_AVATARS.find(x => x.id === id);
            if (DB.user.ownedAvatars.includes(id)) { 
                DB.user.avatar = a.icon; Data.save(); 
                // Обновляем на входе
                try { let u=JSON.parse(localStorage.getItem('MathUsers')); u.find(x=>x.id===Auth.currentUser.id).avatar=a.icon; localStorage.setItem('MathUsers',JSON.stringify(u)); } catch(e){}
                this.updateUI(); this.renderShop(); SoundSys.play('click');
            } else if (DB.user.coins >= a.price) {
                if(confirm(`Купить "${a.name}"?`)) {
                    DB.user.coins -= a.price; 
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + a.price;
                    DB.user.ownedAvatars.push(id); 
                    DB.user.avatar = a.icon; 
                    Data.save(); 
                    try { let u=JSON.parse(localStorage.getItem('MathUsers')); 
                    u.find(x=>x.id===Auth.currentUser.id).avatar=a.icon; localStorage.setItem('MathUsers',JSON.stringify(u)); } catch(e){}
                    this.updateUI(); 
                    this.renderShop(); 
                    SoundSys.play('success'); 
                    FX.confetti();
                }
            } else { App.toast("Недостаточно монет"); SoundSys.play('error'); }
        },
        buyTitle(id) {
            const t = SHOP_TITLES.find(x => x.id === id);
            if (DB.user.ownedTitles.includes(id)) { this.equipTitle(t.name); } 
            else if (DB.user.coins >= t.price) {
                if (confirm(`Купить статус "${t.name}"?`)) {
                    DB.user.coins -= t.price; 
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + t.price;
                    DB.user.ownedTitles.push(id); this.equipTitle(t.name); FX.confetti();
                }
            } else { App.toast("Недостаточно монет"); }
        },
        equipTitle(name) {
            DB.user.currentTitle = name; Data.save(); this.updateUI(); this.renderShop(); SoundSys.play('click');
        },
        
        buyFrame(id) {
            const f = SHOP_FRAMES.find(x => x.id === id);
            if (DB.user.ownedFrames.includes(id)) { DB.user.currentFrame = f.css; Data.save(); this.updateUI(); this.renderShop(); SoundSys.play('click'); } 
            else if (DB.user.coins >= f.price) {
                if (confirm(`Купить рамку "${f.name}"?`)) {
                    DB.user.coins -= f.price; 
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + f.price;

                    DB.user.ownedFrames.push(id); DB.user.currentFrame = f.css; Data.save(); this.updateUI(); this.renderShop(); SoundSys.play('success'); FX.confetti();
                }
            } else { App.toast("Недостаточно монет"); }
        },
        buySound(id) {
            const s = SHOP_SOUNDS.find(x => x.id === id);
            if (DB.user.ownedSounds.includes(id)) { DB.user.soundPack = id; Data.save(); this.renderShop(); SoundSys.play('success'); App.toast(`Звуки: ${s.name}`); } 
            else if (DB.user.coins >= s.price) {
                if (confirm(`Купить звуки "${s.name}"?`)) {
                    DB.user.coins -= s.price;
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + s.price;

                    DB.user.ownedSounds.push(id); DB.user.soundPack = id; Data.save(); this.renderShop(); SoundSys.play('win');
                }
            } else { App.toast("Недостаточно монет"); }
        },
        async buyItem(id, price) {
            if (DB.user.coins < price) return App.toast("Недостаточно монет");

            const today = getUZDate();

            // ОСОБАЯ ЛОГИКА ДЛЯ БУСТЕРА
            if (id === 'booster') {
                // 1. Проверка лимита (1 раз в день)
                if (DB.user.lastBoosterPurchase === today) {
                    return alert("🚫 Бустер можно покупать только 1 раз в день!");
                }

                if (confirm(`Активировать Двойной Опыт на 24 часа за ${price} 💰?`)) {
                    DB.user.coins -= price;
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + price;
                    
                    // Устанавливаем дату покупки (лимит)
                    DB.user.lastBoosterPurchase = today;
                    
                    // Устанавливаем время истечения (сейчас + 24 часа)
                    DB.user.boosterExpiry = Date.now() + (24 * 60 * 60 * 1000);
                    
                    App.toast("⚡ БУСТЕР АКТИВИРОВАН НА 24 ЧАСА!");
                    SoundSys.play('win');
                    FX.confetti();
                }
            } 
            // Логика для Щита и других предметов (если они есть)
            else {
                if (confirm(`Купить ${id} за ${price} 💰?`)) {
                    DB.user.coins -= price;
                    DB.user.lifetimeCoinsSpent = (DB.user.lifetimeCoinsSpent || 0) + price;
                    if (!DB.user.inventory) DB.user.inventory = {};
                    DB.user.inventory[id] = (DB.user.inventory[id] || 0) + 1;
                    App.toast("✅ Куплено");
                    SoundSys.play('win');
                }
            }

            Data.save();
            this.updateUI();
            this.renderShop();
        },
        addXP(n) { 
            const isBoosterActive = Date.now() < (DB.user.boosterExpiry || 0);
            let finalXP = isBoosterActive ? n * 2 : n;        
            
            DB.user.xp += finalXP; 
            if (!DB.user.lifetimeXP) DB.user.lifetimeXP = 0;
            DB.user.lifetimeXP += finalXP;

            if(DB.user.xp >= DB.user.nextXp){
                DB.user.level++; 
                DB.user.xp = DB.user.xp - DB.user.nextXp; 
                DB.user.nextXp = Math.floor(DB.user.nextXp * 1.2); 
                // ПРОВЕРКА ОТКРЫТИЯ ТИТУЛОВ ЛИГ
                const leagueTitles = {
                    5:  { id: 'silver_rank', name: 'Серебряный Воин' },
                    10: { id: 'gold_rank',   name: 'Золотой Магистр' },
                    20: { id: 'plat_rank',   name: 'Платиновый Лорд' },
                    35: { id: 'diam_rank',   name: 'Алмазный Титан' },
                    50: { id: 'legend_rank', name: 'ЛЕГЕНДА' }
                };

                if (leagueTitles[DB.user.level]) {
                    const reward = leagueTitles[DB.user.level];
                    if (!DB.user.ownedTitles.includes(reward.id)) {
                        DB.user.ownedTitles.push(reward.id);
                        App.toast(`🎖️ Новый титул: ${reward.name}`);
                    }
                }
                // 🔥 ДИНАМИЧЕСКАЯ НАГРАДА: 50 монет + 10 за каждый уровень
                const reward = 50 + (DB.user.level * 10);
                DB.user.coins += reward;

                document.getElementById('lvl-up-new-level').innerText = DB.user.level;
                // Обновим текст награды в модалке (если есть элемент с id="lvl-up-reward")
                const rewardEl = document.querySelector('#levelup-modal b'); 
                if(rewardEl) rewardEl.innerText = `+${reward} 💰`;

                document.getElementById('levelup-modal').classList.add('show');
                FX.confetti(); SoundSys.play('level_up'); 
            } 
            Data.save(); this.updateUI(); AchievementSys.check();
        },

            switchTab(id, btn) {
                // 🔒 ЗАЩИТА ХАРДКОРА
                if (Timer.active && Timer.isStrict && id !== 'dashboard') {
                    SoundSys.play('error');
                    
                    if (navigator.vibrate) {
                        navigator.vibrate([100, 50, 100]);
                    }
                    
                    App.toast("🔒 В режиме ХАРДКОР нельзя уходить с экрана!");
                    return;
                }

                // Мгновенное переключение
                document.querySelectorAll('.section').forEach(e => e.classList.remove('active'));
                const newSection = document.getElementById(id);
                if (newSection) {
                    newSection.classList.add('active');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

                // Обновление активной кнопки
                document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
                if (btn) {
                    btn.classList.add('active');
                    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                } else {
                    const targetBtn = document.querySelector(`.nav-btn[data-tab="${id}"]`);
                    if (targetBtn) {
                        targetBtn.classList.add('active');
                        targetBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }

                // ❌ УБРАЛИ: SoundSys.play('click'); - теперь звук играет автоматически

                // Ленивая загрузка контента
                requestAnimationFrame(() => {
                    if (id === 'dashboard') {
                        this.renderMonthlyWidget();
                        QuestSys.render();
                        WeeklyQuestSys.render();
                        this.renderSubjects();
                    }
                    
                    if (id === 'trainer') Trainer.init();
                    if (id === 'stats') { this.renderHistory(); this.renderStats(); }
                    if (id === 'shop') this.renderShop();
                    if (id === 'profile') this.updateUI();
                    if (id === 'settings') { if (typeof updateSubjectLists === 'function') updateSubjectLists(); }
                });

                // Аналитика
                if (typeof ym !== 'undefined') ym(105919372, 'hit', '#' + id, { title: id.toUpperCase() });
            },
        
        renderStats() {
        const statsSection = document.getElementById('stats');
        if (!statsSection || !statsSection.classList.contains('active')) return;

        // 1. СЧИТАЕМ ТОЛЬКО НЕДЕЛЮ И МЕСЯЦ (timezone-safe)
        let monthSec = 0;
        let weekSec = 0;

        const todayKey = getUZDate(); // 'YYYY-MM-DD' по Ташкенту

        if (DB.history) {
            for (let dateKey in DB.history) {
                const seconds = DB.history[dateKey] || 0;
                if (!seconds) continue;

                // Считаем разницу дней напрямую из строк YYYY-MM-DD
                // (без new Date — timezone-safe)
                const diffDays = Math.floor(
                    (new Date(todayKey + 'T00:00:00Z') - new Date(dateKey + 'T00:00:00Z')) / 86400000
                );

                if (diffDays >= 0 && diffDays < 30) monthSec += seconds;
                if (diffDays >= 0 && diffDays < 7) weekSec += seconds;
            }
        }

        // 🔥 УБРАН БЛОК АВТО-ВОССТАНОВЛЕНИЯ (totalSec)
        // Теперь мы доверяем тому, что записано в профиле

        // 2. ВЫВОД НА ЭКРАН
        const fmtTime = (s) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            return h > 0 ? `${h}ч ${m}м` : `${m}м`;
        };
        
        const estXP = (s) => Math.floor(s / 60) * 10;

        this.setText('stat-week-time', fmtTime(weekSec));
        this.setText('stat-week-xp', `~${estXP(weekSec)} XP`);
        
        this.setText('stat-month-time', fmtTime(monthSec));
        this.setText('stat-month-xp', `~${estXP(monthSec)} XP`);
        
        // Берем "Все время" напрямую из базы
        const totalXP = DB.user.lifetimeXP || DB.user.xp || 0; 
        this.setText('stat-total-time', fmtTime(DB.user.totalSec)); 
        this.setText('stat-total-xp', `${totalXP.toLocaleString()} XP`);

        // 2.5 ИСТОРИЯ СЕЗОНОВ
            SeasonSystem.renderSeasonHistory();
            
            // 3. СПИСОК ПРЕДМЕТОВ
        const breakdownEl = document.getElementById('subject-breakdown');
        if (breakdownEl && DB.subjects) {
            const subjectsArray = Object.values(DB.subjects).sort((a, b) => b.sec - a.sec);
            const maxVal = subjectsArray.length > 0 ? subjectsArray[0].sec : 1;

            const htmlList = subjectsArray.map(s => {
                if (s.sec < 60) return '';
                
                const percent = (s.sec / maxVal) * 100;
                const h = Math.floor(s.sec / 3600);
                const m = Math.floor((s.sec % 3600) / 60);
                const timeStr = h > 0 ? `${h}ч ${m}м` : `${m}м`;

                return `
                <div style="position: relative; margin-bottom: 10px; background: var(--bg); border-radius: 12px; overflow: hidden; min-height: 45px; display: flex; align-items: center;">
                    <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${percent}%; background: rgba(108, 99, 255, 0.1); transition: width 0.5s;"></div>
                    <div style="position: relative; z-index: 2; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">${s.icon || '📚'}</span>
                            <div style="font-weight: bold; font-size: 13px; color: var(--text);">${s.name}</div>
                        </div>
                        <div style="font-weight: 800; font-size: 13px; color: var(--primary);">${timeStr}</div>
                    </div>
                </div>`;
            }).join('');
            
            breakdownEl.innerHTML = htmlList || '<div style="text-align:center; padding:20px; color:var(--text-light); font-size:12px;">Нет данных</div>';
        }

        // 4. ГРАФИКИ
        requestAnimationFrame(() => {
            if (typeof this.renderCharts === 'function')
            
            this.renderCharts(weekSec);
            this.renderHeatmap();
        });
    },
         renderHeatmap() {
        const heatmapEl = document.getElementById('heatmap');
        if (!heatmapEl) return;

        const daysHtml =[];
        const nowMs = Date.now();

        // Генерируем 30 дней (от 29 дней назад до сегодня) — timezone-safe
        for (let i = 29; i >= 0; i--) {
            // Вычисляем timestamp для дня i дней назад, используя getUZDate для ключа
            const dayMs = nowMs - (i * 86400000);
            const dateStr = getUZDate(new Date(dayMs));
            
            const seconds = (DB && DB.history && DB.history[dateStr]) ? DB.history[dateStr] : 0;
            const minutes = Math.floor(seconds / 60);
            
            let opacity = 0.1;
            let color = 'var(--text-light)';
            
            if (minutes > 0) {
                color = 'var(--primary)';
                if (minutes <= 15) opacity = 0.3;
                else if (minutes <= 60) opacity = 0.6;
                else opacity = 1.0;
            }
            
            // Форматируем дату из ключа YYYY-MM-DD (timezone-safe)
            const [y, m, d2] = dateStr.split('-');
            const monthNames = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
            const displayDate = parseInt(d2) + ' ' + monthNames[parseInt(m) - 1];
            const tooltip = `${displayDate}: ${minutes > 0 ? minutes + ' мин' : 'Нет активности'}`;
            
            daysHtml.push(`<div title="${tooltip}" onclick="document.getElementById('heatmap-info').innerText = '${tooltip}'; SoundSys.play('click');" style="aspect-ratio:1; border-radius:6px; background:${color}; opacity:${opacity}; cursor:pointer; transition:transform 0.2s ease, opacity 0.2s; border:${i===29?'2px solid var(--primary)':'none'};" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>`);
        }
        
        heatmapEl.innerHTML = daysHtml.join('');
    },
   
renderCharts(weekSec) {
        if (typeof Chart === 'undefined') return;

        // 1. График истории за неделю (timezone-safe)
        const weekCtx = document.getElementById('weekChart');
        if (weekCtx) {
            const labels = [];
            const data =[];
            const nowMs = Date.now();
            const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

            for (let i = 6; i >= 0; i--) {
                const key = getUZDate(new Date(nowMs - (i * 86400000)));
                const sec = (DB.history && DB.history[key]) ? DB.history[key] : 0;
                // Определяем день недели ИЗ КЛЮЧА (timezone-safe)
                const keyDate = new Date(key + 'T00:00:00Z');
                labels.push(dayNames[keyDate.getUTCDay()]);
                data.push((sec / 60).toFixed(1));
            }

            // Удаляем старый график, если он был (чтобы не дублировался)
            if (window.weekChartInstance) window.weekChartInstance.destroy();
            
            window.weekChartInstance = new Chart(weekCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets:[{
                        label: 'Минут учебы',
                        data: data,
                        backgroundColor: '#6C63FF',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // 🔥 Это самое важное: график будет слушаться высоты контейнера
                    animation: {
                        duration: 0 // Можно отключить анимацию появления, чтобы всё было мгновенно
                    },
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: { precision: 0 } // Только целые числа
                        }
                    }
                }
            });
        }

        // 2. Круговой график по предметам
        const subjectCtx = document.getElementById('subjectChart');
        if (subjectCtx && DB.subjects) {
            const labels = [];
            const data = [];
            const bgColors =['#6C63FF', '#FF7675', '#00d26a', '#FFD700', '#00E0D0', '#DE05F8', '#FF8A65', '#4DD0E1'];

            Object.values(DB.subjects).forEach(s => {
                if (s.sec > 0) {
                    labels.push(s.name);
                    data.push((s.sec / 60).toFixed(1));
                }
            });

            if (window.subjectChartInstance) window.subjectChartInstance.destroy();
            
            if (data.length > 0) {
                window.subjectChartInstance = new Chart(subjectCtx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets:[{
                            data: data,
                            backgroundColor: data.map((_, i) => bgColors[i % bgColors.length]),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
                        }
                    }
                });
            } else {
                // Если данных еще нет, просто очищаем канвас
                const ctx = subjectCtx.getContext('2d');
                ctx.clearRect(0, 0, subjectCtx.width, subjectCtx.height);
            }
        }
    },

    renderSubjects() {
        const grid = document.getElementById('subjects-grid');
        if (!grid || !DB || !DB.subjects) return;

        let html = '';
        ALL_SUBJECTS.forEach(item => {
            if (DB.subjects[item.id]) {
                const isActive = DB.user.subject === item.id;
                
                // Если предмет активен — красим границу в главный цвет темы
                let activeStyle = isActive ? 'border-color: var(--primary); background: rgba(108,99,255,0.08); box-shadow: 0 4px 15px rgba(108,99,255,0.1);' : '';
                
                // Если таймер запущен, блокируем остальные
                let timerStyle = (Timer.active && !isActive) ? 'opacity: 0.3; filter: grayscale(1); pointer-events: none; border-color: transparent;' : '';
                let clickAction = Timer.active ? '' : `App.selectSubject('${item.id}', event)`;

                html += `
                <div class="subject-item-fixed" style="${activeStyle} ${timerStyle}" onclick="${clickAction}">
                    <div class="icon">${item.icon}</div>
                    <div class="name">${item.name}</div>
                </div>`;
            }
        });
        grid.innerHTML = html;
    },

        selectSubject(key, event) {
    // 🛡️ ДВОЙНАЯ ЗАЩИТА
    if (event) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    if (Timer.active) {
        SoundSys.play('error');
        App.toast("⛔️ Сначала остановите таймер!");
        return;
    }

    if (DB.subjects[key]) { 
        DB.user.subject = key; 
        Data.save(); 
        this.renderSubjects(); 
        this.updateUI(); 
        SoundSys.play('click');
    }
},

        renderHistory() {
            const logContainer = document.getElementById('session-log');
            if (!logContainer || !DB || !DB.sessions) return;
            
            // Добавляем класс для стилей, если его нет
            logContainer.className = 'history-list';

            if (DB.sessions.length === 0) {
                logContainer.innerHTML = `
                    <div style="text-align:center; padding: 30px; color:var(--text-light); opacity:0.7;">
                        <div style="font-size: 40px; margin-bottom: 10px;">📜</div>
                        <div>История пуста.<br>Поучись, чтобы здесь появились записи!</div>
                    </div>`;
                return;
            }

            // Показываем только последние 10 сессий (все хранятся в памяти)
            const recentSessions = DB.sessions.slice(0, 10);
            const totalSessions = DB.sessions.length;

            logContainer.innerHTML = recentSessions.map(s => {
                let minutes = Math.floor(s.sec / 60);
                if (minutes < 1) minutes = "< 1";

                // 1. Создаем дату из сохраненного числа
                // Если в записи строка (старая сессия), Date её поймет. Если число — тоже.
                const dateObj = new Date(s.date);

                // 2. Берем часовой пояс из настроек (или Ташкент по умолчанию)
                const userTZ = (DB.user && DB.user.timezone && DB.user.timezone !== 'auto') ? DB.user.timezone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

                // 3. Форматируем время СТРОГО по выбранному поясу
                const dateStr = dateObj.toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short', 
                    timeZone: userTZ 
                });

                const timeStr = dateObj.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    timeZone: userTZ 
                });

                // 3. Ищем иконку предмета по названию
                let icon = '⏱️'; // Иконка по умолчанию
                if (DB.subjects) {
                    // Пробегаем по предметам, ищем совпадение имени
                    const foundKey = Object.keys(DB.subjects).find(k => DB.subjects[k].name === s.subject);
                    if (foundKey) icon = DB.subjects[foundKey].icon;
                }

                // 4. Блок с монетами (показываем только если > 0)
                const coinBadge = s.coins > 0 
                    ? `<div class="history-coins">+${s.coins} 💰</div>` 
                    : '';

                return `
                <div class="history-card">
                    <div class="history-left">
                        <div class="history-icon">${icon}</div>
                        <div class="history-info">
                            <div>${s.subject}</div>
                            <div class="history-date">${dateStr} в ${timeStr}</div>
                        </div>
                    </div>
                    <div class="history-right">
                        <div class="history-time">${minutes} мин</div>
                        ${coinBadge}
                    </div>
                </div>`;
            }).join('');

            // Счётчик если сессий больше 10
            if (totalSessions > 10) {
                logContainer.innerHTML += `<div style="text-align:center; padding:10px; color:var(--text-light); font-size:11px;">Показано 10 из ${totalSessions} сессий</div>`;
            }
        },

        shareApp() {
            const shareData = {
                title: 'MathBooster PRO 🇺🇿',
                text: 'Я качаю мозги в MathBooster Pro! 🧠\nЗаходи, попробуй побить мой рекорд! 🏆',
                url: window.location.href
            };
            if (navigator.share) { navigator.share(shareData).catch((e) => console.log("Отмена")); } 
            else { navigator.clipboard.writeText(shareData.url + "\n\n" + shareData.text); alert("🔗 Ссылка скопирована!"); }
        },

        toggleEcoMode(enable) {
            const overlay = document.getElementById('eco-overlay');
            if (enable) { overlay.classList.add('active'); App.toast("🔋 Эко-режим вкл."); } 
            else { overlay.classList.remove('active'); }
        },

        toast(m) { 
            const container = document.getElementById('toast-container');
            if (container) {
                const t=document.createElement('div'); t.className='toast'; t.innerText=m; 
                container.appendChild(t); 
                setTimeout(()=>t.classList.add('show'),10); 
                setTimeout(()=>{t.classList.remove('show');t.remove()},3000); 
            }
        },
        // Секретный счетчик кликов
        adminClicks: 0,

    // === РЕЖИМ РОДИТЕЛЯ (Дашборд) ===
    initParentView() {
        if (!DB || !DB.user) return;
        // Скрываем всё, показываем дашборд
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').style.display = 'none';
        const ps = document.getElementById('parent-screen');
        if (ps) ps.style.display = 'block';
        // Применяем тему ребёнка
        if (DB.user.theme) {
            const themeClass = `theme-${DB.user.theme}${DB.user.darkMode ? ' dark-mode' : ''}`;
            document.body.className = themeClass;
        }
        // Заполняем базовые данные
        document.getElementById('parent-child-name').innerText = DB.user.name || 'Ребёнок';
        const parentAvatar = document.getElementById('parent-header-avatar');
        if (parentAvatar) parentAvatar.textContent = DB.user.avatar || '😎';
        document.getElementById('parent-level').innerText = DB.user.level || 1;
        document.getElementById('parent-coins').innerText = DB.user.coins || 0;
        document.getElementById('parent-streak').innerText = DB.user.streak || 0;
        // Сегодняшнее время (из subjects)
        let todaySec = 0;
        if (DB.subjects) {
            const today = getUZDate();
            Object.values(DB.subjects).forEach(s => {
                if (s && s.daily && s.daily[today]) todaySec += s.daily[today];
            });
        }
        const todayMin = Math.round(todaySec / 60);
        document.getElementById('parent-today-time').innerText = todayMin + ' мин';
        document.getElementById('parent-progress-label').innerText = todayMin + ' мин из 60 мин';
        document.getElementById('parent-progress-pct').innerText = Math.min(100, Math.round(todayMin / 60 * 100)) + '%';
        document.getElementById('parent-progress-fill').style.width = Math.min(100, Math.round(todayMin / 60 * 100)) + '%';
        // Предметы
        this.renderParentSubjects();
        // Неделя
        this.renderParentWeek();
        // Тепловая карта
        this.renderParentHeatmap();
        // История занятий
        this.renderParentHistory();
        // Графики прогресса
        setTimeout(() => this.renderParentProgress(), 300);
        // Запрашиваем разрешение на уведомления (для оповещений о статусе)
        if ('Notification' in window && Notification.permission === 'default') {
            // Запрашиваем через 2 секунды чтобы не мешать загрузке
            setTimeout(() => Notification.requestPermission().catch(() => {}), 2000);
        }
        // Запускаем мониторинг в реальном времени
        this.startParentMonitoring();
    },
    renderParentSubjects() {
        const el = document.getElementById('parent-subjects');
        if (!el || !DB.subjects) { if(el) el.innerHTML = '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:10px;">Нет данных</div>'; return; }
        const total = Object.values(DB.subjects).reduce((s, sub) => s + (sub && sub.sec ? sub.sec : 0), 0);
        if (total === 0) { el.innerHTML = '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:10px;">Пока нет занятий</div>'; return; }
        el.innerHTML = Object.entries(DB.subjects)
            .filter(([,s]) => s && s.sec > 0)
            .sort((a, b) => (b[1].sec || 0) - (a[1].sec || 0))
            .map(([id, s]) => {
                const pct = Math.round((s.sec / total) * 100);
                // Берём эмодзи и русское имя из DB.subjects (как у ученика)
                // Если в DB нет — ищем в ALL_SUBJECTS по id
                const template = (typeof ALL_SUBJECTS !== 'undefined') ? ALL_SUBJECTS.find(a => a.id === id) : null;
                const icon = s.icon || (template ? template.icon : '📚');
                const name = s.name || (template ? template.name : id);
                return `<div class="parent-subject-row">
                    <div class="parent-subject-icon">${icon}</div>
                    <div class="parent-subject-name">${name}</div>
                    <div class="parent-subject-bar-bg"><div class="parent-subject-bar-fill" style="width:${pct}%"></div></div>
                    <div class="parent-subject-pct">${pct}%</div>
                </div>`;
            }).join('');
    },
    renderParentWeek() {
        const el = document.getElementById('parent-week-chart');
        if (!el) return;
        const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
        const dayOfWeek = (now.getDay() + 6) % 7; // Пн=0
        let maxMin = 1;
        const weekData = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - dayOfWeek + i);
            const dateKey = d.toISOString().slice(0, 10);
            let sec = 0;
            if (DB.subjects) {
                Object.values(DB.subjects).forEach(s => {
                    if (s && s.daily && s.daily[dateKey]) sec += s.daily[dateKey];
                });
            }
            const min = Math.round(sec / 60);
            if (min > maxMin) maxMin = min;
            weekData.push({ day: days[i], min, isToday: i === dayOfWeek });
        }
        el.innerHTML = weekData.map(d => {
            const pct = Math.round((d.min / maxMin) * 100);
            const bold = d.isToday ? 'font-weight:900;color:var(--primary);' : '';
            const barColor = d.isToday ? 'var(--primary)' : 'var(--text-light)';
            return `<div class="parent-week-row" style="${bold}">
                <div class="parent-week-day">${d.day}</div>
                <div class="parent-week-bar-bg"><div class="parent-week-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
                <div class="parent-week-min">${d.min} мин</div>
            </div>`;            }).join('');
    },
    renderParentHeatmap() {
        const el = document.getElementById('parent-heatmap');
        if (!el || !DB) return;
        const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
        const todayKey = now.toISOString().slice(0, 10);
        // Цвета: 0мин = светлый, больше = темнее
        const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
        const levels = [0, 15, 30, 45, 60]; // Пороги в минутах
        // Дни недели
        const dayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        const todayDOW = (now.getDay() + 6) % 7; // Пн=0
        // Собираем 30 дней
        const cells = [];
        let totalMin = 0;
        let activeDays = 0;
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            let sec = 0;
            if (DB.subjects) {
                Object.values(DB.subjects).forEach(s => {
                    if (s && s.daily && s.daily[key]) sec += s.daily[key];
                });
            }
            const min = Math.round(sec / 60);
            totalMin += min;
            if (min > 0) activeDays++;
            // Определяем уровень цвета
            let colorIdx = 0;
            for (let l = levels.length - 1; l >= 0; l--) {
                if (min >= levels[l]) { colorIdx = l; break; }
            }
            const isToday = key === todayKey;
            const dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            cells.push({
                color: colors[colorIdx],
                title: `${dateStr}: ${min} мин`,
                isToday
            });
        }
        // Рисуем сетку
        let html = '<div class="heatmap-days-labels">';
        dayLabels.forEach(l => { html += `<div class="heatmap-day-label">${l}</div>`; });
        html += '</div><div class="heatmap-grid">';
        cells.forEach(c => {
            html += `<div class="heatmap-cell${c.isToday ? ' today' : ''}" style="background:${c.color}" title="${c.title}"></div>`;
        });
        html += '</div>';
        // Легенда
        html += '<div class="heatmap-legend"><span>Меньше</span>';
        colors.forEach(c => { html += `<div class="heatmap-legend-cell" style="background:${c}"></div>`; });
        html += '<span>Больше</span></div>';
        // Итого
        html += `<div style="text-align:center;margin-top:8px;font-size:12px;color:var(--text-light);">
            <b style="color:var(--primary);">${totalMin}</b> мин за 30 дней · 
            <b style="color:var(--primary);">${activeDays}</b> активных дней
        </div>`;
        el.innerHTML = html;
    },
    renderParentHistory() {
        const el = document.getElementById('parent-history');
        if (!el || !DB) { return; }
        // Собираем данные из daily по всем предметам за последние 5 дней
        const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
        const days = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().slice(0, 10);
            const dayEntries = [];
            if (DB.subjects) {
                Object.entries(DB.subjects).forEach(([id, s]) => {
                    if (s && s.daily && s.daily[dateKey] && s.daily[dateKey] > 0) {
                        const template = (typeof ALL_SUBJECTS !== 'undefined') ? ALL_SUBJECTS.find(a => a.id === id) : null;
                        dayEntries.push({
                            icon: s.icon || (template ? template.icon : '📚'),
                            name: s.name || (template ? template.name : id),
                            sec: s.daily[dateKey]
                        });
                    }
                });
            }
            if (dayEntries.length > 0) {
                days.push({ date: d, dateKey, entries: dayEntries });
            }
        }
        if (days.length === 0) {
            el.innerHTML = '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:15px;">Пока нет записей</div>';
            return;
        }
        const userTZ = (DB.user && DB.user.timezone && DB.user.timezone !== 'auto') ? DB.user.timezone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        el.innerHTML = days.map(day => {
            const dateStr = day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: userTZ });
            const totalMin = Math.round(day.entries.reduce((s, e) => s + e.sec, 0) / 60);
            const entriesHtml = day.entries.map(e => {
                const min = Math.round(e.sec / 60);
                return `<div class="parent-history-item">
                    <div class="parent-history-icon">${e.icon}</div>
                    <div class="parent-history-info">
                        <div class="parent-history-name">${e.name}</div>
                        <div class="parent-history-date">${min} мин</div>
                    </div>
                </div>`;
            }).join('');
            return `<div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-weight:700;font-size:13px;color:var(--text);">${dateStr}</span>
                    <span style="font-weight:800;font-size:13px;color:var(--primary);">${totalMin} мин</span>
                </div>
                ${entriesHtml}
            </div>`;
        }).join('');
    },
    renderParentProgress() {
        if (typeof Chart === 'undefined') return;
        // === Месячная сводка ===
        const summaryEl = document.getElementById('parent-month-summary');
        if (summaryEl && DB.subjects) {
            const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
            let thisMonthSec = 0, lastMonthSec = 0;
            for (let i = 0; i < 60; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const month = d.getMonth();
                const thisMonth = now.getMonth();
                Object.values(DB.subjects).forEach(s => {
                    if (s && s.daily && s.daily[key]) {
                        if (month === thisMonth) thisMonthSec += s.daily[key];
                        else if (i < 60) lastMonthSec += s.daily[key];
                    }
                });
            }
            const thisMin = Math.round(thisMonthSec / 60);
            const lastMin = Math.round(lastMonthSec / 60);
            const trend = lastMin > 0 ? Math.round(((thisMin - lastMin) / lastMin) * 100) : 0;
            const trendColor = trend > 0 ? '#2ECC71' : trend < 0 ? '#FF7675' : 'var(--text-light)';
            const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
            summaryEl.innerHTML = `
                <div class="parent-month-card">
                    <div class="parent-month-val">${thisMin}</div>
                    <div class="parent-month-label">мин в этом месяце</div>
                </div>
                <div class="parent-month-card">
                    <div class="parent-month-val">${lastMin}</div>
                    <div class="parent-month-label">мин в прошлом</div>
                </div>
                <div class="parent-month-card">
                    <div class="parent-month-trend" style="color:${trendColor}">${trendIcon} ${trend > 0 ? '+' : ''}${trend}%</div>
                    <div class="parent-month-label">динамика</div>
                </div>`;
        }
        // === Недельный график (Chart.js) ===
        const weekCanvas = document.getElementById('parent-week-canvas');
        if (weekCanvas && DB.subjects) {
            if (window._parentWeekChart) window._parentWeekChart.destroy();
            const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
            const labels = [];
            const data = [];
            const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
            const dayOfWeek = (now.getDay() + 6) % 7;
            for (let i = 0; i < 7; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - dayOfWeek + i);
                const key = d.toISOString().slice(0, 10);
                let sec = 0;
                Object.values(DB.subjects).forEach(s => {
                    if (s && s.daily && s.daily[key]) sec += s.daily[key];
                });
                labels.push(dayNames[i]);
                data.push(Math.round(sec / 60));
            }
            window._parentWeekChart = new Chart(weekCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Минуты',
                        data: data,
                        backgroundColor: data.map((_, i) => i === dayOfWeek ? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() : 'rgba(108,99,255,0.2)'),
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 500 },
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                }
            });
        }
        // === Месячный график (30 дней) ===
        const monthCanvas = document.getElementById('parent-month-canvas');
        if (monthCanvas && DB.subjects) {
            if (window._parentMonthChart) window._parentMonthChart.destroy();
            const now = new Date(TimeGuard.getTrueTime() + 5 * 3600000);
            const labels = [];
            const data = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                let sec = 0;
                Object.values(DB.subjects).forEach(s => {
                    if (s && s.daily && s.daily[key]) sec += s.daily[key];
                });
                labels.push(d.getDate() + '.' + (d.getMonth() + 1));
                data.push(Math.round(sec / 60));
            }
            window._parentMonthChart = new Chart(monthCanvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Минуты',
                        data: data,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6C63FF',
                        backgroundColor: 'rgba(108,99,255,0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 500 },
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { ticks: { maxTicksLimit: 7, font: { size: 10 } } }
                    }
                }
            });
        }
    },
    startParentMonitoring() {
        if (!isParentMode || !DB.user.id || !window.DB_Online) return;
        const dbRef = window.DB_Online;
        const docRef = dbRef.doc(dbRef.db, 'users', DB.user.id);
        const leaderRef = dbRef.doc(dbRef.db, 'leaderboard', DB.user.id);
        const childName = DB.user.name || 'Ребёнок';
        // Флаг для отслеживания первого снимка (чтобы не слать уведомление при подключении)
        let firstSnapshot = true;
        // Предыдущий статус: 'idle' | 'studying' | 'paused'
        this._parentLastStatus = 'idle';
        // === ЗВУК (Web Audio API — без внешних файлов) ===
        const playDing = () => {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const notes = [880, 1100]; // Две ноты — мелодичный "ding"
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.15);
                    osc.stop(ctx.currentTime + i * 0.15 + 0.5);
                });
            } catch(e) {}
        };
        // === УВЕДОМЛЕНИЕ (тост + звук) ===
        // ⚠️ БЕЗ new Notification()! Системное уведомление присылает FCM-пуш
        // (Cloud Function notifyParentOnStatusChange → Service Worker).
        // Локальное создание дублировало пуш: страница показывает своё,
        // SW — пушное = 2 уведомления за раз.
        const notifyParent = (icon, title, body) => {
            // 1. Звук "ding"
            playDing();
            // 2. Toast в приложении (виден когда дашборд открыт)
            App.toast(icon + ' ' + title);
        };
        // Слушаем изменения данных пользователя
        this.parentUnsub1 = dbRef.onSnapshot(docRef, (snap) => {
            if (!snap.exists()) return;
            const u = snap.data().user || {};
            const iconEl = document.getElementById('parent-status-icon');
            const textEl = document.getElementById('parent-status-text');
            const subEl = document.getElementById('parent-status-sub');
            const timerEl = document.getElementById('parent-timer-display');
            if (this.parentTimerInterval) clearInterval(this.parentTimerInterval);
            const isPaused = !!u.pausedAt;
            const isOnline = u.activeSessionStart && (TimeGuard.getTrueTime() - Number(u.lastPing || 0)) < 45000;
            const isActive = isOnline && !isPaused;
            // Определяем текущий статус
            let currentStatus = 'idle';
            if (isActive) currentStatus = 'studying';
            else if (isPaused) currentStatus = 'paused';
            // === Оповещаем родителя при смене статуса (пропускаем первый снимок) ===
            if (!firstSnapshot && currentStatus !== this._parentLastStatus) {
                if (currentStatus === 'studying') {
                    notifyParent('✍️', childName + ' начал(а) заниматься!', 'Таймер запущен — ребёнок учится.');
                } else if (currentStatus === 'paused') {
                    notifyParent('⏸️', childName + ' поставил(а) паузу', 'Ребёнок приостановил занятие.');
                } else if (currentStatus === 'idle' && this._parentLastStatus !== 'idle') {
                    notifyParent('😴', childName + ' закончил(а) занятие', 'Таймер остановлен.');
                }
            }
            this._parentLastStatus = currentStatus;
            firstSnapshot = false;
            // === UI обновление ===
            if (isActive) {
                iconEl.innerText = '✍️';
                textEl.innerText = 'УЧИТСЯ';
                textEl.style.color = '#2ECC71';
                subEl.innerText = 'Таймер запущен';
                timerEl.style.display = 'block';
                this.parentTimerInterval = setInterval(() => {
                    const now = TimeGuard.getTrueTime();
                    if (now - Number(u.lastPing || 0) > 45000 || u.pausedAt) {
                        iconEl.innerText = u.pausedAt ? '⏸️' : '😴';
                        textEl.innerText = u.pausedAt ? 'НА ПАУЗЕ' : 'ОТДЫХАЕТ';
                        textEl.style.color = u.pausedAt ? '#F39C12' : 'var(--text-light)';
                        subEl.innerText = u.pausedAt ? 'Ребёнок поставил паузу' : 'Таймер неактивен';
                        timerEl.style.display = 'none'; clearInterval(this.parentTimerInterval); return;
                    }
                    const elapsed = Math.floor((now - Number(u.activeSessionStart)) / 1000);
                    timerEl.innerText = new Date(Math.max(0, elapsed) * 1000).toISOString().substr(11, 8);
                }, 1000);
            } else if (isPaused) {
                iconEl.innerText = '⏸️';
                textEl.innerText = 'НА ПАУЗЕ';
                textEl.style.color = '#F39C12';
                subEl.innerText = 'Ребёнок поставил паузу';
                timerEl.style.display = 'none';
            } else {
                iconEl.innerText = '😴';
                textEl.innerText = 'ОТДЫХАЕТ';
                textEl.style.color = 'var(--text-light)';
                subEl.innerText = 'Таймер неактивен';
                timerEl.style.display = 'none';
            }
            // Обновляем мини-карточки
            if (u.level) document.getElementById('parent-level').innerText = u.level;
            if (u.coins !== undefined) document.getElementById('parent-coins').innerText = u.coins;
            if (u.streak !== undefined) document.getElementById('parent-streak').innerText = u.streak;
        });
        // Слушаем онлайн-статус
        this.parentUnsub2 = dbRef.onSnapshot(leaderRef, (snap) => {
            if (!snap.exists()) return;
            const la = snap.data().lastActive || 0;
            const isOn = la !== 0 && (TimeGuard.getTrueTime() - la) < 90000;
            const badge = document.getElementById('parent-online-badge');
            const dot = document.getElementById('parent-online-dot');
            const txt = document.getElementById('parent-online-text');
            if (badge) {
                badge.className = 'parent-online-badge ' + (isOn ? 'online' : 'offline');
                dot.innerText = isOn ? '🟢' : '🔴';
                txt.innerText = isOn ? 'В СЕТИ' : 'ВНЕ СЕТИ';
            }
        });
    },
    exitParentMode() {
        // Отписываемся от Firebase
        if (this.parentUnsub1) { this.parentUnsub1(); this.parentUnsub1 = null; }
        if (this.parentUnsub2) { this.parentUnsub2(); this.parentUnsub2 = null; }
        if (this.parentTimerInterval) { clearInterval(this.parentTimerInterval); this.parentTimerInterval = null; }
        isParentMode = false;
        DB = null;
        Auth.currentUser = null;
        // Скрываем дашборд, показываем экран входа
        const ps = document.getElementById('parent-screen');
        if (ps) ps.style.display = 'none';
        document.getElementById('app-container').style.display = 'none';
        const auth = document.getElementById('auth-screen');
        auth.classList.remove('hidden');
        Auth.init();
    },

        
    };

    const Transfer = {
        async generateTransferID() {
            if (!Auth.currentUser) return App.toast("Сначала войдите в аккаунт");
            
            // 1. Меняем текст кнопки
            const btn = document.querySelector("button[onclick*='generateTransferID']");
            const originalText = btn ? btn.innerText : "Создать код";
            if(btn) btn.innerText = "⏳ Ждите...";

            try {
                // Подготовка данных
                if (DB && DB.user) {
                    DB.user.name = Auth.currentUser.name;
                    DB.user.id = Auth.currentUser.id;
                    Data.save(); // Локальное сохранение
                }

                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let id = '';
                for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));

                // 2. Попытка записи в Firebase
                // Если квота кончилась, ошибка вылетит ЗДЕСЬ
                const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", id);
                
                await window.DB_Online.setDoc(docRef, {
                    userId: Auth.currentUser.id,
                    data: DB,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString(),
                    isPermanent: true
                });

                // Успех
                const modal = document.getElementById('transfer-modal');
                const display = document.getElementById('transfer-code-display');
                if (modal && display) {
                    display.innerText = id;
                    modal.classList.add('show');
                } else {
                    prompt("Код готов:", id);
                }
                App.toast("✅ Код создан!");

            } catch (e) {
                console.error("Firebase Error:", e);
                
                // 🔥 ЛОВИМ ОШИБКУ ЛИМИТА
                if (e.code === 'resource-exhausted' || e.message.includes('Quota')) {
                    alert("🛑 ОШИБКА СЕРВЕРА\n\nБесплатный лимит базы данных на сегодня исчерпан.\nФункция заработает завтра после 13:00.");
                } else {
                    alert("❌ Ошибка соединения:\n" + e.message);
                }
            } finally {
                // 🔥 ВОЗВРАЩАЕМ КНОПКУ ОБРАТНО (Чтобы не висела вечно)
                if(btn) btn.innerText = originalText;
            }
        },

        transferByID() {
            const inputID = prompt("Введите код восстановления:");
            if (!inputID) return;
            const cleanID = inputID.trim().toUpperCase();

            App.toast("⏳ Поиск данных...");

            const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", cleanID);

            window.DB_Online.getDoc(docRef).then(docSnap => {
                if (docSnap.exists()) {
                    const transferData = docSnap.data();
                    
                    // 🔥 ПРОВЕРКА СРОКА ГОДНОСТИ
                    // Если код НЕ вечный И у него истек срок
                    if (!transferData.isPermanent && transferData.expiresAt) {
                        if (new Date() > new Date(transferData.expiresAt)) {
                            alert("❌ Срок действия этого кода истек (24 часа).");
                            return;
                        }
                    }

                    // Если код Вечный — мы его НЕ удаляем после использования
                    // Если код Временный — удаляем
                    const shouldDelete = !transferData.isPermanent;

                    DB = transferData.data;

                    // Лечение имени
                    if (!DB.user.name || DB.user.name === "Восстановленный") {
                        let newName = prompt("Введите имя для профиля:", "Игрок");
                        DB.user.name = newName || "Игрок";
                    }
                    
                    // Восстановление списка
                    let usersList = [];
                    try {
                        let stored = localStorage.getItem('MathUsers');
                        if (stored) usersList = JSON.parse(stored);
                    } catch (e) { usersList = []; }

                    usersList = usersList.filter(u => u.id !== DB.user.id);
                    
                    usersList.unshift({ 
                        id: DB.user.id, 
                        name: DB.user.name, 
                        avatar: DB.user.avatar || "😎", 
                        gender: DB.user.gender || 'male' 
                    });

                    localStorage.setItem('MathUsers', JSON.stringify(usersList));
                    Data.currentKey = 'MathData_' + DB.user.id; 
                    localStorage.setItem(Data.currentKey, JSON.stringify(DB));

                    // Если код был временный — удаляем его, чтобы никто не украл
                    if (shouldDelete) {
                        window.DB_Online.deleteDoc(docRef).catch(() => {});
                    } else {
                        console.log("✅ Вечный код восстановления использован. Не удаляем.");
                    }

                    alert(`✅ УСПЕШНО!\nПрофиль "${DB.user.name}" восстановлен.`);
                    setTimeout(() => location.reload(), 500);

                } else {
                    alert("❌ Код не найден.\nПроверьте правильность ввода.");
                }
            }).catch(e => {
                console.error(e);
                alert("❌ Ошибка соединения.");
            });
        },

        // Восстановление по коду из нового экрана (inline, без prompt)
        transferByIDCode(cleanID) {
            App.toast("⏳ Поиск данных...");

            const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", cleanID);

            window.DB_Online.getDoc(docRef).then(docSnap => {
                if (docSnap.exists()) {
                    const transferData = docSnap.data();
                    
                    if (!transferData.isPermanent && transferData.expiresAt) {
                        if (new Date() > new Date(transferData.expiresAt)) {
                            App.toast("❌ Срок действия кода истек.");
                            return;
                        }
                    }

                    const shouldDelete = !transferData.isPermanent;
                    DB = transferData.data;

                    if (!DB.user.name || DB.user.name === "Восстановленный") {
                        DB.user.name = "Игрок";
                    }
                    
                    let usersList = [];
                    try {
                        let stored = localStorage.getItem('MathUsers');
                        if (stored) usersList = JSON.parse(stored);
                    } catch (e) { usersList = []; }

                    usersList = usersList.filter(u => u.id !== DB.user.id);
                    usersList.unshift({ 
                        id: DB.user.id, 
                        name: DB.user.name, 
                        avatar: DB.user.avatar || "😎", 
                        gender: DB.user.gender || 'male' 
                    });

                    localStorage.setItem('MathUsers', JSON.stringify(usersList));
                    Data.currentKey = 'MathData_' + DB.user.id; 
                    localStorage.setItem(Data.currentKey, JSON.stringify(DB));

                    if (shouldDelete) {
                        window.DB_Online.deleteDoc(docRef).catch(() => {});
                    }

                    App.toast("✅ Успешно! Профиль восстановлен.");
                    setTimeout(() => location.reload(), 800);

                } else {
                    App.toast("❌ Код не найден.");
                }
            }).catch(e => {
                console.error(e);
                App.toast("❌ Ошибка соединения.");
            });
        }
    };
        const InstallSys = {
        init() {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            
            // На iOS событие PWA не работает, поэтому мы показываем кнопку вручную
            if (!isStandalone && isIOS) {
                const btn = document.getElementById('install-promo-card');
                if (btn) btn.style.display = 'block';
            }
        },

        startFlow() {
            if (!Auth.currentUser) return App.toast("Сначала создайте профиль!");

            // 1. ЕСЛИ ЭТО ANDROID ИЛИ PC (Быстрая нативная установка)
            if (window.PWA && PWA.prompt) {
                PWA.install();
                return; // Прерываем функцию, код спасения здесь генерировать не нужно
            }

            // 2. ЕСЛИ ЭТО iOS ИЛИ Safari (Генерируем код спасения и показываем инструкцию)
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

            DB.user.name = Auth.currentUser.name;
            DB.user.avatar = Auth.currentUser.avatar;
            DB.user.id = Auth.currentUser.id;
            
            App.toast("⏳ Подготовка к установке...");

            if(window.DB_Online) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", code);
                window.DB_Online.setDoc(docRef, {
                    userId: Auth.currentUser.id,
                    data: DB,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString()
                }).then(() => {
                    navigator.clipboard.writeText(code).then(() => {
                        this.showInstruction();
                    }).catch(() => {
                        prompt("Скопируйте код вручную:", code);
                        this.showInstruction();
                    });
                }).catch(e => {
                    console.error(e);
                    App.toast("Ошибка сети. Попробуйте позже.");
                });
            } else {
                App.toast("⚠️ Нет интернета для создания кода.");
            }
        },

        showInstruction() {
            const modal = document.getElementById('install-modal');
            const iosBlock = document.getElementById('ios-instruction');
            const androidBlock = document.getElementById('android-instruction');

            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isIOS) {
                iosBlock.style.display = 'block';
                androidBlock.style.display = 'none';
            } else {
                iosBlock.style.display = 'none';
                androidBlock.style.display = 'block';
            }

            modal.classList.add('show');
            if (window.FX) FX.confetti(); 
        }
    };

    
    const Notify = {
    isSupported: 'Notification' in window && 'serviceWorker' in navigator,

    async toggle(isChecked) {
        if (!this.isSupported) {
            alert("Ваш браузер не поддерживает уведомления.");
            document.getElementById('notify-toggle').checked = false;
            return;
        }

        if (isChecked) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                DB.settings.notifications = true;
                App.toast("✅ Уведомления включены");
                this.subscribeFCM(); // Получаем токен для рассылок
            } else {
                alert("Разрешите уведомления в настройках браузера.");
                document.getElementById('notify-toggle').checked = false;
                DB.settings.notifications = false;
            }
        } else {
            DB.settings.notifications = false;
            App.toast("🔕 Уведомления выключены");
        }
        Data.save();
    },

    async subscribeFCM() {
        try {
            const { messaging, getToken } = window.DB_Online;
            const currentToken = await getToken(messaging, {
                vapidKey: "BHMScHHyu4ovNRTDndNKTHovdL5SkrSRFjrkZ6GiTLATTDvir7mGp9iFFzZFpaFoVDhLCI7TPuOSZ08ZotWVBrw"
            });

            if (currentToken) {
                console.log("📱 Токен получен");
                DB.user.fcmToken = currentToken;
                Data.save();
            }
            // Слушатель onMessage уже зарегистрирован в FCM.init() — НЕ регистрируем повторно!
        } catch (error) {
            console.error("Ошибка FCM:", error);
        }
    }
};
