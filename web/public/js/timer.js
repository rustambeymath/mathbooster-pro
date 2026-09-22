// ТАЙМЕР: запуск/пауза/стоп, автостановка по часу, анти-АФК проверка,
// восстановление после перезагрузки страницы, защита от скачков времени.
const Timer = {
    active: false,
    isRunning: false,
    isPaused: false,
    isStrict: false,
    sessionStartTime: 0, 
    startTime: 0,
    pausedTime: 0,
    totalPausedDuration: 0,
    realSec: 0,
    visualSec: 0,
    
    interval: null,
    checkInterval: null,
    lastCheckTime: 0,
    checkShown: false,
    hardcoreTimeout: null, 
    hardcoreListenerAdded: false, // Флаг, чтобы не дублировать слушателя

    CHECK_AFTER_SECONDS: 3600,
    CHECK_TIMEOUT: 60,
    REWARD_INTERVAL: 600,

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('✅ Экран не будет гаснуть');
            } catch (err) {
                console.warn('Wake Lock не поддерживается');
            }
        }
        // При возвращении экрана — перехватываем visibilitychange
        if (!this._visHandler) {
            this._visHandler = () => {
                if (!document.hidden && this.active && !this.isPaused) {
                    // Экран вернулся — восстанавливаем время из памяти
                    const now = this.getTrueTime();
                    const elapsed = Math.floor((now - this.startTime - this.totalPausedDuration) / 1000);
                    if (elapsed > this.realSec + 5) {
                        this.realSec = elapsed;
                        this.visualSec = elapsed;
                        this.updateDisplay();
                        console.log('⏱️ Таймер восстановлен из фонового режима:', elapsed, 'сек');
                    }
                    // 🛡️ Сразу отправляем heartbeat чтобы stop() не аннулировал сессию
                    if (window.DB_Online && Auth.currentUser) {
                        const ping = Number(this.getTrueTime());
                        if (DB && DB.user) DB.user.lastPing = ping;
                        try {
                            const docRef = window.DB_Online.doc(window.DB_Online.db, 'users', Auth.currentUser.id);
                            window.DB_Online.updateDoc(docRef, { 'user.lastPing': ping }).catch(() => {});
                        } catch(e) {}
                    }
                    // Сбрасываем флаг офлайна
                    this._offlineToastShown = false;
                    // Перезапрашиваем WakeLock (без async — fire and forget)
                    this.requestWakeLock();
                }
            };
            document.addEventListener('visibilitychange', this._visHandler);
        }
    },
    
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    },

    getTrueTime() {
        return TimeGuard.getTrueTime();
    },

    // === ⚡️ АВТОВОССТАНОВЛЕНИЕ ПОСЛЕ ПЕРЕЗАГРУЗКИ СТРАНИЦЫ ===
    // Ученик случайно обновил экран во время сессии — якорь activeSessionStart
    // остался в Firebase. Подхватываем сессию бесшовно: таймер продолжает идти
    // с момента старта, уже оплаченные блоки и записанные чекпоинтами часы
    // не задваиваются.
    resumeInterrupted(sessionStart, lastPing) {
        if (this.active) return false;
        try {
            const start = Number(sessionStart);
            const now = this.getTrueTime();
            let elapsed = Math.floor((now - start) / 1000);
            if (!(elapsed > 0) || elapsed > 6 * 3600) return false;

            // 🛡️ Считаем только время под наблюдением: до последнего пульса
            // (heartbeat каждые 30 сек). Если страницу закрыли надолго, время
            // отсутствия в зачёт не идёт — накрутить «придётся» не выйдет.
            const lp = Number(lastPing || 0);
            if (lp > start) elapsed = Math.min(elapsed, Math.floor((lp - start) / 1000) + 45);
            else elapsed = Math.min(elapsed, 300); // нет пульса — максимум 5 минут доверия
            if (elapsed <= 0) return false;

            this.active = true;
            this.isRunning = true;
            this.isPaused = false;
            this.isStrict = false; // строгий режим после перезагрузки не восстановить — продолжаем обычным
            this.sessionStartTime = start;
            this.startTime = start;
            this.totalPausedDuration = 0;
            this.sessionCoins = 0;
            this.lastPaidBlock = Math.floor(elapsed / this.REWARD_INTERVAL); // блоки до перезагрузки уже оплачены
            this.lastCheckTime = 0;
            this.checkShown = false;
            this.bankedSec = Number(DB?.user?.lastCheckpointSec || 0);
            this.nextCheckAt = this.bankedSec + this.CHECK_AFTER_SECONDS;
            this.realSec = elapsed;
            this.visualSec = elapsed;
            this._offlineToastShown = false;

            // Восстанавливаем UI как при обычном запуске
            this.requestWakeLock();
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.classList.remove('timer-hardcore', 'timer-active-anim');
                timerEl.classList.add('timer-active-anim');
            }
            this.tick();
            const btn = document.getElementById('btn-start');
            if (btn) {
                btn.innerText = '⏸ ПАУЗА';
                btn.style.fontSize = '14px';
                btn.style.opacity = '1';
                btn.disabled = false;
                btn.onclick = () => this.pause();
            }

            // Освежаем пульс и перевзводим push-напоминание, если проверка ещё впереди
            if (window.DB_Online && Auth.currentUser) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, 'users', Auth.currentUser.id);
                window.DB_Online.updateDoc(docRef, { "user.lastPing": Number(now) }).catch(() => {});
                if (this.bankedSec < elapsed) {
                    const remainSec = Math.max(60, this.bankedSec + this.CHECK_AFTER_SECONDS - elapsed);
                    const checkDoc = window.DB_Online.doc(window.DB_Online.db, 'timerChecks', Auth.currentUser.id);
                    window.DB_Online.setDoc(checkDoc, {
                        userId: Auth.currentUser.id,
                        checkAt: Number(now) + remainSec * 1000,
                        fcmToken: localStorage.getItem('fcm_token') || '',
                        sent: false,
                        createdAt: Date.now()
                    }).catch(() => {});
                }
            }

            const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);
            App.toast(`⏱️ Сессия восстановлена после перезагрузки: ${h}ч ${m}м на счету — таймер идёт дальше!`);
            console.log('⚡️ Таймер восстановлен после перезагрузки,Elapsed сек:', elapsed);
            return true;
        } catch (e) {
            console.warn('resumeInterrupted error:', e);
            this.active = false;
            return false;
        }
    },

    // === ⏹️ ЗАКРЫТИЕ ПРЕРВАННОЙ СЕССИИ, ОСТАВШЕЙСЯ НА ПАУЗЕ ===
    // Ученик поставил паузу и перезагрузил/закрыл страницу. Сохраняем
    // наработанное до паузы время и чистим якорь — без показа таймера.
    async closeInterrupted(sessionStart, pausedAt) {
        try {
            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
            const snap = await window.DB_Online.getDoc(docRef);
            const u = (snap.data() || {}).user || {};
            const lastPing = Number(u.lastPing || 0);
            // Время учёбы: от старта до последнего пульса, но не дальше паузы
            const monitoredEnd = Math.min(Number(pausedAt), lastPing > 0 ? lastPing + 45000 : Number(pausedAt));
            let studiedSec = Math.floor((monitoredEnd - Number(sessionStart)) / 1000);
            studiedSec = Math.max(0, Math.min(studiedSec, 6 * 3600));
            const banked = Number(u.lastCheckpointSec || 0);
            const unbanked = Math.max(0, studiedSec - banked);

            if (unbanked >= 60) {
                const savedRealSec = this.realSec, savedStart = this.sessionStartTime;
                this.realSec = unbanked;
                this.sessionStartTime = Number(pausedAt); // дата в журнале = момент паузы
                await this.saveSession();
                this.realSec = savedRealSec;
                this.sessionStartTime = savedStart;
            }

            if (DB && DB.user) { DB.user.activeSessionStart = null; DB.user.lastPing = null; DB.user.pausedAt = null; }
            await window.DB_Online.updateDoc(docRef, { "user.activeSessionStart": null, "user.lastPing": null, "user.pausedAt": null });
            try { localStorage.setItem('MathTimerLastStop', String(Date.now())); } catch(e) {}
            try { localStorage.removeItem('MathTimerState'); } catch(e) {}
            if (Auth.currentUser) {
                const checkRef = window.DB_Online.doc(window.DB_Online.db, 'timerChecks', Auth.currentUser.id);
                window.DB_Online.deleteDoc(checkRef).catch(() => {});
            }
            console.log('⏹️ Прерванная сессия закрыта, сохранено сек:', unbanked);
        } catch (e) {
            console.warn('closeInterrupted error:', e);
        }
    },

    // === PUSH-УВЕДОМЛЕНИЕ: отправляем когда пора проходить проверку ===
    async _sendCheckPush() {
        try {
            // 🔒 ЗАЩИТА ОТ ДУБЛЕЙ: системное уведомление здесь НЕ показываем —
            // его отправляет Cloud Function afkCheckPush (timerChecks). Локальный
            // new Notification() дублировал push, когда приложение открыто.
            // Здесь остаются только звук и вибрация (работают, когда страница видима).
            // 1. Звук "двойной ding" ( Web Audio API)
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const notes = [660, 880, 1100]; // Три нарастающие ноты
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.2);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.2);
                    osc.stop(ctx.currentTime + i * 0.2 + 0.6);
                });
            } catch(e) {}
            // 3. Vibration на телефоне
            if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        } catch(e) { console.warn('Push check notification error:', e); }
    },

    // === Восстановление таймера из фонового режима ===
    restoreFromBackground() {
        try {
            const saved = localStorage.getItem('MathTimerState');
            if (!saved) return;
            const state = JSON.parse(saved);
            if (!state.active) return;

            const now = Date.now();
            const elapsedSinceSave = Math.floor((now - state.lastSave) / 1000);

            // Восстанавливаем чекпоинтные счётчики (иначе после перезагрузки
            // страницы час, записанный чекпоинтом, был бы начислен второй раз)
            this.bankedSec = Number(state.bankedSec || 0);
            this.nextCheckAt = Number(state.nextCheckAt || this.CHECK_AFTER_SECONDS);

            // Если прошло < 5 минут — восстанавливаем таймер
            if (elapsedSinceSave < 300 && this.active) {
                const serverElapsed = Math.floor((this.getTrueTime() - state.startTime - state.pausedDuration) / 1000);
                // Берём максимум из локального и серверного (защита от манипуляций)
                this.realSec = Math.max(state.realSec, serverElapsed);
                this.visualSec = this.realSec;
                this.updateDisplay();
                console.log('⏱️ Таймер восстановлен из фона. Прошло секунд:', this.realSec);
            }
            // Очищаем сохранённое состояние
            localStorage.removeItem('MathTimerState');
        } catch(e) { console.warn('Restore from background error:', e); }
    },

    initHardcoreWatch() {
        if (!this.isStrict || this.hardcoreListenerAdded) return;
        
        this.hardcoreListenerAdded = true; // Ставим метку, что слушатель уже есть
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.active && this.isStrict && !this.isPaused) {
                console.log('⚠️ ХАРДКОР: Экран свёрнут, даём 5 секунд...');
                
                this.hardcoreTimeout = setTimeout(() => {
                    if (document.hidden && this.active) {
                        console.log('❌ ХАРДКОР: Время вышло, сессия аннулирована');
                        SoundSys.play('error');
                        
                        clearInterval(this.interval);
                        this.active = false;
                        this.isRunning = false;
                        this.releaseWakeLock();
                        
                        if (window.DB_Online && Auth.currentUser) {
                            // Обновляем локально чтобы Data.save() не перезаписал старыми
                            if (DB && DB.user) {
                                DB.user.activeSessionStart = null;
                                DB.user.lastPing = null;
                                DB.user.pausedAt = null;
                            }
                            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
                            window.DB_Online.updateDoc(docRef, {
                                "user.activeSessionStart": null,
                                "user.lastPing": null,
                                "user.pausedAt": null
                            });
                        }
                        
                        this.resetTimerUI();
                        App.toast("💀 ХАРДКОР провален! Дисциплина требует полной отдачи.");
                        
                        const modal = document.createElement('div');
                        modal.className = 'modal show';
                        modal.style.zIndex = '99999';
                        modal.innerHTML = `
                            <div class="modal-content" style="text-align:center; background: linear-gradient(135deg, #FF4757, #FF6B81); color: white;">
                                <h2 style="font-size: 28px; margin-bottom: 15px;">❌ Сессия аннулирована</h2>
                                <p style="font-size: 16px; margin-bottom: 20px;">В режиме <b>ХАРДКОР</b> нельзя сворачивать экран.</p>
                                <button class="btn" style="background: white; color: #FF4757; font-weight: bold; width: 100%; padding: 15px;" onclick="this.closest('.modal').remove()">Понятно</button>
                            </div>`;
                        document.body.appendChild(modal);
                    }
                }, 5000);
                
            } else if (!document.hidden && this.hardcoreTimeout) {
                clearTimeout(this.hardcoreTimeout);
                this.hardcoreTimeout = null;
            }
        });
    },

    preStart() {
        if (!navigator.onLine) return App.toast("❌ Нужен интернет для работы таймера");
        if (this.active) return App.toast("Таймер уже запущен");
        // 🛡️ COOLDOWN: минимум 60 сек между сессиями (защита от накрутки)
        const lastStop = Number(localStorage.getItem('MathTimerLastStop') || 0);
        if (lastStop && Date.now() - lastStop <= 60000) {
            const waitSec = Math.ceil((60000 - (Date.now() - lastStop)) / 1000);
            return App.toast(`⏳ Подождите ${waitSec} сек перед следующей сессией`);
        }

        const options = [
            { label: '🎯 Обычный', value: 'normal', reward: '5-20 💰', desc: 'Можно ставить на паузу' },
            { label: '🔥 Хардкор', value: 'strict', reward: '7-30 💰', desc: 'Награда ×1.5, но нельзя паузу' }
        ];

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '15000';
        modal.innerHTML = `
            <div class="modal-content" style="text-align:center; max-width: 340px;">
                <h3 style="margin-bottom: 10px;">⏱️ Выбери режим</h3>
                <div style="display:grid; gap:10px; margin-bottom: 15px;">
                    ${options.map(o => `
                        <div class="mode-btn" onclick="Timer.selectMode('${o.value}')" 
                             style="padding:15px; border:2px solid var(--bg); border-radius:15px; cursor:pointer; text-align:left; background: var(--surface);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-weight: bold;">${o.label}</div>
                                <div style="font-weight: bold; color: var(--primary);">${o.reward}</div>
                            </div>
                            <div style="font-size:12px; color: var(--text-light);">${o.desc}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()" style="width: 100%;">Отмена</button>
            </div>`;
        document.body.appendChild(modal);
    },

    selectMode(mode) {
        this.isStrict = (mode === 'strict');
        document.querySelector('.modal.show')?.remove();
        this.start();
    },

    async start() {
        if (!navigator.onLine) return App.toast("❌ Нужен интернет! Включите Wi-Fi или мобильные данные.");
        if (this.active) return;
        // Проверяем что Firebase подключён
        if (!window.DB_Online) return App.toast("❌ Сервер недоступен. Попробуйте позже.");

        // ⚡️ ВОССТАНОВЛЕНИЕ: если в Firebase жива незакрытая сессия (случайная
        // перезагрузка страницы) — продолжаем её, а не начинаем с нуля.
        try {
            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
            const snap = await window.DB_Online.getDoc(docRef);
            const data = snap.data();
            const serverStart = Number(data?.user?.activeSessionStart || 0);
            const pausedAt = Number(data?.user?.pausedAt || 0);
            if (serverStart > 0) {
                if (pausedAt > 0) {
                    // Сессия стояла на паузе → закрываем её с сохранением наработанного
                    await this.closeInterrupted(serverStart, pausedAt);
                    return App.toast("⏹️ Прошлая сессия закрыта и сохранена. Теперь можно начать новую.");
                }
                if (this.resumeInterrupted(serverStart, Number(data?.user?.lastPing || 0))) return;
            }
        } catch (e) { console.warn('Recovery check failed:', e); }

        await TimeGuard.sync();

        this.active = true;
        this.isRunning = true;
        this.isPaused = false;
        this.sessionStartTime = Number(this.getTrueTime());
        this.startTime = this.sessionStartTime;
        this.totalPausedDuration = 0;
        this.sessionCoins = 0;
        this.lastPaidBlock = 0;
        this.lastCheckTime = 0;
        this.checkShown = false;
        this.bankedSec = 0;                          // сколько секунд уже записано чекпоинтами
        this.nextCheckAt = this.CHECK_AFTER_SECONDS; // следующая проверка через час

        await this.requestWakeLock(); 

        if (window.DB_Online && Auth.currentUser) {
            // Обновляем локально, чтобы Data.save() не перезаписал старыми значениями
            if (DB && DB.user) {
                DB.user.activeSessionStart = Number(this.startTime);
                DB.user.lastPing = Number(this.startTime);
            }
            const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
            await window.DB_Online.updateDoc(docRef, {
                "user.activeSessionStart": Number(this.startTime),
                "user.lastPing": Number(this.startTime)
            });
            // Записываем таймер AFK-проверки в Firebase (для push-уведомления)
            const checkAt = Number(this.startTime) + this.CHECK_AFTER_SECONDS * 1000;
            const fcmToken = localStorage.getItem('fcm_token') || '';
            const checkDoc = window.DB_Online.doc(window.DB_Online.db, 'timerChecks', Auth.currentUser.id);
            window.DB_Online.setDoc(checkDoc, {
                userId: Auth.currentUser.id,
                checkAt: checkAt,
                fcmToken: fcmToken,
                sent: false,
                createdAt: Date.now()
            }).catch(e => console.warn('timerCheck save error:', e));
        }

        // --- ЛОГИКА ЦВЕТА И АНИМАЦИИ ---
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            // Полностью очищаем классы перед выбором
            timerEl.classList.remove('timer-active-anim', 'timer-hardcore');
            
            if (this.isStrict) {
                // Включаем КРАСНЫЙ ПУЛЬС
                timerEl.classList.add('timer-hardcore');
            } else {
                // Включаем ОБЫЧНОЕ ДЫХАНИЕ
                timerEl.classList.add('timer-active-anim');
            }
        }

        this.tick();

        const startPhrases = [
            "🚀 Время становиться умнее!", "🧠 Режим глубокого фокуса включен",
            "⚡️ Протокол обучения запущен", "📈 Твой путь к мастерству начат",
            "📚 Удачной учебы, не отвлекайся!", "🎯 Фокус на максимум!"
        ];
        App.toast(startPhrases[Math.floor(Math.random() * startPhrases.length)]);

        const btn = document.getElementById('btn-start');
        if (btn) {
            if (this.isStrict) {
                btn.innerText = '🔥 ХАРДКОР';
                btn.disabled = true;
                btn.style.opacity = '0.5';
            } else {
                btn.innerText = '⏸ ПАУЗА';
                btn.onclick = () => this.pause();
            }
        }
        this.initHardcoreWatch();
    },

    tick() {
        if (this.interval) clearInterval(this.interval);
        
        // ⚠️ ВАЖНО: callback НЕ async! setInterval с async колбэком
        // блокируется await и вызывает пропуск тиков на мобильных.
        this.interval = setInterval(() => {
            if (!this.isRunning || this.isPaused) return;

            const now = this.getTrueTime();
            const calculatedSec = Math.floor((now - this.startTime - this.totalPausedDuration) / 1000);

            // 🛡️ ДЕТЕКТОР ПРЫЖКОВ (АНТИ-ЧИТ)
            // Если время прыгнуло вперёд более чем на 3 секунды за 1 секунду реальности —
            // значит подменяли часы или сбился офсет
            if (this.realSec > 0 && calculatedSec - this.realSec > 3) {
                console.warn('⚠️ Обнаружен скачок времени! Перепроверка...');
                // Синхронизируем OFSET (fire-and-forget, без await)
                TimeGuard.sync().then(() => {
                    // Пересчитываем с новым офсетом
                    const fixedSec = Math.floor((this.getTrueTime() - this.startTime - this.totalPausedDuration) / 1000);
                    if (fixedSec - this.realSec > 3) {
                        App.toast('🚫 Обнаружена манипуляция временем! Сессия остановлена.');
                        this.stop(false);
                    } else {
                        this.realSec = fixedSec;
                        this.visualSec = this.realSec;
                        this.updateDisplay();
                    }
                }).catch(() => {});
                // Пока sync летит — используем текущее значение
                this.realSec = calculatedSec;
            } else {
                this.realSec = calculatedSec;
            }
            this.visualSec = this.realSec;

            // === ФОНОВЫЙ РЕЖИМ: сохраняем состояние каждые 10 сек ===
            if (this.realSec % 10 === 0) {
                try {
                    localStorage.setItem('MathTimerState', JSON.stringify({
                        startTime: this.startTime,
                        pausedDuration: this.totalPausedDuration,
                        realSec: this.realSec,
                        active: true,
                        lastSave: Date.now(),
                        bankedSec: this.bankedSec || 0,
                        nextCheckAt: this.nextCheckAt || this.CHECK_AFTER_SECONDS
                    }));
                } catch(e) {}
            }

            // === ОТОБРАЖЕНИЕ ===
            const ecoOverlay = document.getElementById('eco-overlay');
            const isEcoActive = ecoOverlay && ecoOverlay.classList.contains('active');

            if (!isEcoActive) {
                this.updateDisplay();
                if (!document.hidden) {
                    document.getElementById('timer').classList.add('timer-active-anim');
                }
            } else {
                const h = Math.floor(this.visualSec / 3600);
                const m = Math.floor((this.visualSec % 3600) / 60);
                const s = this.visualSec % 60;
                const str = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                const ecoDisplay = document.getElementById('eco-timer-display');
                if (ecoDisplay) ecoDisplay.innerText = str;
                document.getElementById('timer').classList.remove('timer-active-anim');
            }

            // === HEARTBEAT каждые 30 сек (экономим батарею) ===
            if (this.realSec % 30 === 0 && navigator.onLine && window.DB_Online && Auth.currentUser) {
                const ping = Number(this.getTrueTime());
                if (DB && DB.user) DB.user.lastPing = ping;
                try {
                    const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
                    window.DB_Online.updateDoc(docRef, { "user.lastPing": ping });
                } catch(e) { console.warn('Heartbeat ping failed:', e); }
            }

            // 🛡️ ПЕРЕСИНХРОНИЗАЦИЯ TimeGuard каждые 5 минут (защита от дрифта)
            // Запускаем ОТДЕЛЬНО, не блокируя основной тик
            if (this.realSec > 0 && this.realSec % 300 === 0 && navigator.onLine) {
                TimeGuard.sync().catch(() => {});
            }

            // === ПОТЕРЯ СВЯЗИ: не останавливаем, а ждём реконнекта ===
            if (!navigator.onLine) {
                // Не показываем тост каждую секунду — только один раз
                if (!this._offlineToastShown) {
                    App.toast("⚠️ Нет интернета. Таймер продолжает работать.");
                    this._offlineToastShown = true;
                }
                // Таймер продолжает в памяти — продолжаем обновлять дисплей
                // Когда интернет вернётся — heartbeat обновит lastPing
            }

            // === АНТИ-AFK: строго после 1 часа, потом каждые 60 минут (чекпоинты) ===
            // ПUSH УВЕДОМЛЕНИЕ: отправляем push когда пора проверять
            if (this.realSec >= this.nextCheckAt && !this.isPaused) {
                this.nextCheckAt = this.realSec; // защита от повторного срабатывания до ответа
                // Отправляем push-уведомление (если разрешено)
                this._sendCheckPush();
                this.showMathCheck();
            }

            let currentBlock = Math.floor(this.realSec / 600);
            if (currentBlock > this.lastPaidBlock) {
                this.giveReward(currentBlock);
                this.lastPaidBlock = currentBlock;
            }
        }, 1000);
    },

    async showMathCheck() {
        this.pause(true);
        SoundSys.play('error');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        const a = Math.floor(Math.random() * 9) + 2;
        const b = Math.floor(Math.random() * 9) + 2;
        const correctAnswer = a * b;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.zIndex = '99999';
        modal.innerHTML = `
            <div class="modal-content" style="text-align:center; background: linear-gradient(135deg, #FF4757, #FF6B81); color: white;">
                <h2 style="color:white;">🚨 ПРОВЕРКА!</h2>
                <p>Реши пример за 60 секунд:</p>
                <div style="font-size:48px; margin:20px 0; font-weight: bold;">${a} × ${b}</div>
                <input type="number" id="check-answer" class="input-field" style="text-align:center; font-size:32px; background: white; color: #333;">
                <div id="check-timer" style="margin-bottom:15px;">Осталось: <b>60</b> сек</div>
                <button class="btn" style="background: white; color: #FF4757; font-weight: bold;" onclick="Timer.checkAnswer(${correctAnswer}, this)">ОТВЕТИТЬ</button>
            </div>`;
        document.body.appendChild(modal);

        let timeLeft = this.CHECK_TIMEOUT;
        const countdown = setInterval(() => {
            timeLeft--;
            const timerEl = document.getElementById('check-timer');
            if (timerEl) timerEl.innerHTML = `Осталось: <b>${timeLeft}</b> сек`;
            if (timeLeft <= 0) { clearInterval(countdown); this.failCheck(modal); }
        }, 1000);
        modal.dataset.countdown = countdown;
    },

    async checkAnswer(correct, btn) {
        const input = document.getElementById('check-answer');
        const userAnswer = parseInt(input.value);
        const modal = btn.closest('.modal');
        clearInterval(parseInt(modal.dataset.countdown));

        if (userAnswer === correct) {
            SoundSys.play('success');
            modal.remove();
            // ✅ ПРОВЕРКА = ЧЕКПОИНТ: час сохраняется, сессия ПРОДОЛЖАЕТСЯ (баг №2)
            await this.checkpointSave();
        } else {
            this.failCheck(modal);
        }
    },

    /**
     * ✅ ЧЕКПОИНТ ПОСЛЕ УСПЕШНОЙ ПРОВЕРКИ (баг №2):
     * — накопленный час записывается в базу (монеты, XP, журнал);
     * — таймер НЕ обнуляется: общий счётчик и экран продолжают идти;
     * — следующая проверка ровно через час.
     */
    async checkpointSave() {
        try {
            // 1. Сохраняем только НЕЗАПИСАННУЮ часть времени (последний час)
            const unbanked = Math.max(0, this.realSec - (this.bankedSec || 0));
            const totalSnapshot = this.realSec;
            if (unbanked > 0) {
                this.realSec = unbanked;
                this.sessionStartTime = Date.now(); // дата записи в журнале = момент чекпоинта
                await this.saveSession();
                this.realSec = totalSnapshot;
                this.bankedSec = totalSnapshot;
                // 💾 Запоминаем границу записанных часов — по ней автовосстановление
                // после перезагрузки страницы поймёт, что повторно начислять нельзя
                if (DB && DB.user) {
                    DB.user.lastCheckpointSec = this.bankedSec;
                    Data.save();
                }
            }

            // 2. Выходим из паузы проверки (activeSessionStart НЕ трогаем —
            //    от него зависит античит-проверка длительности в stop())
            //    Время, проведённое в окне проверки, в учёбу НЕ идёт:
            //    добавляем его к общей длительности пауз
            const now = this.getTrueTime();
            if (this.pausedTime) {
                this.totalPausedDuration += Math.max(0, now - this.pausedTime);
                this.pausedTime = null;
            }
            this.isPaused = false;
            this.isRunning = true;
            if (DB && DB.user) {
                DB.user.pausedAt = null;
                DB.user.lastPing = Number(now);
            }
            if (window.DB_Online && Auth.currentUser) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, 'users', Auth.currentUser.id);
                try {
                    await window.DB_Online.updateDoc(docRef, {
                        'user.pausedAt': null,
                        'user.lastPing': Number(now)
                    });
                } catch(e) {}
                // 3. Перевзводим push-напоминание на СЛЕДУЮЩИЙ час
                const checkAt = Number(now) + this.CHECK_AFTER_SECONDS * 1000;
                const fcmToken = localStorage.getItem('fcm_token') || '';
                const checkDoc = window.DB_Online.doc(window.DB_Online.db, 'timerChecks', Auth.currentUser.id);
                try {
                    await window.DB_Online.setDoc(checkDoc, {
                        userId: Auth.currentUser.id,
                        checkAt: checkAt,
                        fcmToken: fcmToken,
                        sent: false,
                        createdAt: Date.now()
                    });
                } catch(e) { console.warn('timerCheck rearm error:', e); }
            }

            // 4. Следующая проверка — ровно через час после текущей
            this.nextCheckAt = this.realSec + this.CHECK_AFTER_SECONDS;

            this.updateDisplay();
            App.toast("🔥 Час записан! Таймер продолжает идти — следующая проверка через час.");
            FX.confetti();
        } catch(e) {
            console.error('checkpointSave error:', e);
            App.toast("⚠️ Ошибка сохранения часа. Сессия завершена.");
            this.stop(true);
        }
    },

    failCheck(modal) {
        SoundSys.play('error');
        App.toast("⏰ Проверка провалена. Сессия аннулирована.");
        modal.remove();
        // 🛡️ Удвоенный cooldown при провале проверки (120 сек)
        try { localStorage.setItem('MathTimerLastStop', String(Date.now() - 60000)); } catch(e) {}
        this.stop(false);
    },

    pause(isCheckPause = false) {
        if (!this.active || this.isPaused) return;
        if (this.isStrict && !isCheckPause) {
            SoundSys.play('error');
            return App.toast("🔒 В режиме ХАРДКОР нельзя ставить на паузу!");
        }

        this.isPaused = true;
        this.isRunning = false;
        this.pausedTime = this.getTrueTime();
        
        const btn = document.getElementById('btn-start');
        if (btn && !isCheckPause) {
            btn.innerText = '▶️ ПРОДОЛЖИТЬ';
            btn.style.fontSize = '12px';
            btn.onclick = () => this.resume();
        }
        // Сообщаем Firebase что на паузе (чтобы родитель видел сразу)
        if (DB && DB.user) DB.user.pausedAt = Number(this.getTrueTime());
        if (window.DB_Online && Auth.currentUser) {
            const docRef = window.DB_Online.doc(window.DB_Online.db, 'users', Auth.currentUser.id);
            window.DB_Online.updateDoc(docRef, { 'user.pausedAt': Number(this.getTrueTime()) }).catch(() => {});
        }
        App.toast("⏸ Пауза");
    },

    resume() {
        if (!this.active || !this.isPaused) return;

        // Считаем, сколько времени мы пробыли на паузе
        const pauseDuration = this.getTrueTime() - this.pausedTime;
        this.totalPausedDuration += pauseDuration;

        this.isPaused = false;
        this.isRunning = true;
        // Убираем паузу из Firebase
        if (DB && DB.user) {
            DB.user.pausedAt = null;
            DB.user.lastPing = Number(this.getTrueTime());
        }
        if (window.DB_Online && Auth.currentUser) {
            const docRef = window.DB_Online.doc(window.DB_Online.db, 'users', Auth.currentUser.id);
            window.DB_Online.updateDoc(docRef, { 'user.pausedAt': null, 'user.lastPing': Number(this.getTrueTime()) }).catch(() => {});
        }

        const btn = document.getElementById('btn-start');
        if (btn) {
            btn.innerText = '⏸ ПАУЗА';
            btn.style.fontSize = '14px'; 
            btn.onclick = () => this.pause();
        }
        App.toast("▶️ Продолжаем!");
    },

    async stop(saveSession = true) {
        if (!this.active) return;

        if (this.hardcoreTimeout) clearTimeout(this.hardcoreTimeout);

        clearInterval(this.interval);
        this.active = false;
        this.isRunning = false;
        this.releaseWakeLock();
        // 🛡️ Запоминаем время остановки для cooldown
        try { localStorage.setItem('MathTimerLastStop', String(Date.now())); } catch(e) {}

        const docRef = window.DB_Online.doc(window.DB_Online.db, "users", Auth.currentUser.id);
        const snap = await window.DB_Online.getDoc(docRef);
        const data = snap.data();
        
        const serverStart = Number(data.user.activeSessionStart || 0);
        const stopTime = this.getTrueTime();

        // 🛡️ Доверяем клиентскому realSec (анти-чит уже работает в tick())
        // Но проверяем что сессия не дольше чем реальное время с момента старта
        const maxAllowed = Math.floor((stopTime - serverStart) / 1000) + 10; // +10 сек на задержку сети
        const verifiedSec = Math.min(this.realSec, maxAllowed);

        // 💾 Записываем только НЕЗАПИСАННУЮ часть: часы, уже сохранённые
        // чекпоинтами после пройденных проверок, повторно не начисляются
        const unbanked = Math.max(0, verifiedSec - (this.bankedSec || 0));
        if (saveSession && unbanked >= 60) {
            const totalSnapshot = this.realSec;
            this.realSec = unbanked;
            this.sessionStartTime = Date.now();
            await this.saveSession();
            this.realSec = totalSnapshot;
        } else if ((this.bankedSec || 0) === 0) {
            const cancelPhrases = ["⚠️ Слишком коротко!", "🚫 Фокус потерян.", "📉 Сессия аннулирована."];
            App.toast(cancelPhrases[Math.floor(Math.random() * cancelPhrases.length)]);
        }

        // Обновляем локально чтобы Data.save() не перезаписал старыми
        if (DB && DB.user) {
            DB.user.activeSessionStart = null;
            DB.user.lastPing = null;
            DB.user.pausedAt = null;
        }
        await window.DB_Online.updateDoc(docRef, { "user.activeSessionStart": null, "user.lastPing": null, "user.pausedAt": null });
        this.resetTimerUI();
    },

    resetTimerUI() {
        this.realSec = 0;
        this.visualSec = 0;
        this.isPaused = false;
        this.isRunning = false;
        this.isStrict = false;
        this.active = false;
        this._offlineToastShown = false;
        // Граница записанных чекпоинтами часов больше не актуальна (сессия закрыта)
        if (DB && DB.user && DB.user.lastCheckpointSec) {
            delete DB.user.lastCheckpointSec;
        }
        // Очищаем сохранённое состояние фонового таймера
        try { localStorage.removeItem('MathTimerState'); } catch(e) {}
        // Удаляем таймер AFK-проверки из Firebase
        if (window.DB_Online && Auth.currentUser) {
            try {
                const checkRef = window.DB_Online.doc(window.DB_Online.db, 'timerChecks', Auth.currentUser.id);
                window.DB_Online.deleteDoc(checkRef).catch(() => {});
            } catch(e) {}
        }
        this.updateDisplay();
        
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            // Удаляем все анимации
            timerEl.classList.remove('timer-active-anim', 'timer-hardcore');
            // Сбрасываем ручные настройки цвета
            timerEl.style.color = "";
            timerEl.style.webkitTextFillColor = "";
        }
        
        const btn = document.getElementById('btn-start');
        if (btn) {
            btn.innerText = '🚀 СТАРТ';
            btn.style.fontSize = '14px';
            btn.onclick = () => Timer.preStart();
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    },

    giveReward(intervals) {
        let coinsEarned = 5 + Math.min(intervals - 1, 15);
        if (this.isStrict) coinsEarned = Math.floor(coinsEarned * 1.5);
        DB.user.coins += coinsEarned;
        Data.save();
        App.updateUI();
        SoundSys.play('coin');
    },

    async saveSession() {
        const subject = DB.subjects[DB.user.subject];
        const fullIntervals = Math.floor(this.realSec / this.REWARD_INTERVAL);
        const remainingSeconds = this.realSec % this.REWARD_INTERVAL;
        
        let earnedCoins = 0;
        for (let i = 1; i <= fullIntervals; i++) {
            let r = 5 + Math.min(i - 1, 15);
            if (this.isStrict) r = Math.floor(r * 1.5);
            earnedCoins += r;
        }
        
        if (remainingSeconds > 0) {
            let nextR = 5 + Math.min(fullIntervals, 15);
            if (this.isStrict) nextR = Math.floor(nextR * 1.5);
            earnedCoins += Math.floor((remainingSeconds / this.REWARD_INTERVAL) * nextR);
        }

        DB.user.coins += earnedCoins;
        DB.user.totalSec += this.realSec;
        subject.sec += this.realSec;

        // Трекинг для достижений
        if (this.isStrict) {
            DB.user.lifetimeStrictSec = (DB.user.lifetimeStrictSec || 0) + this.realSec;
            DB.user.lifetimeStrictSessions = (DB.user.lifetimeStrictSessions || 0) + 1;
        }
        // Накапливаем время за текущий месяц
        const monthPrefix = getUZDate().slice(0, 7);
        if (!DB.user._monthPrefix || DB.user._monthPrefix !== monthPrefix) {
            DB.user.currentMonthSec = 0;
            DB.user._monthPrefix = monthPrefix;
        }        DB.user.currentMonthSec = (DB.user.currentMonthSec || 0) + this.realSec;

        // Проверяем 3+ предмета за всё время (для достижения "Полиглот")
        if (!DB.user.multiSubjectSession) {
            const studiedCount = Object.values(DB.subjects).filter(s => (s.sec || 0) > 0).length;
            if (studiedCount >= 3) DB.user.multiSubjectSession = true;
        }

        const today = getUZDate();
        if (!DB.history[today]) DB.history[today] = 0;
        DB.history[today] += this.realSec;

        DB.sessions.unshift({
            subject: subject.name,
            sec: this.realSec,
            coins: earnedCoins,
            date: this.sessionStartTime 
        });

        // Сессии хранятся БЕСКОНЕЧНО (показываем только последние 10 в журнале)

        App.addXP(Math.floor(this.realSec / 60) * 10);
        QuestSys.update('studyMin', Math.floor(this.realSec / 60));
        WeeklyQuestSys.update(this.realSec); 

        await Data.save();
        App.updateUI();
        App.renderHistory();
        
        // 🔥 ИСПРАВЛЕНО: Теперь фразы успеха показываются!
        const finishPhrases = [
            "✅ Отличная работа! Ты стал ближе к цели",
            "🧠 Сессия завершена. Мозг прокачан!",
            "💎 Мастерство растет! Так держать",
            "🌟 Прекрасный результат! Горжусь тобой"
        ];
        const h = Math.floor(this.realSec / 3600);
        const m = Math.floor((this.realSec % 3600) / 60);
        App.toast(`${finishPhrases[Math.floor(Math.random() * finishPhrases.length)]} (${h}ч ${m}м, +${earnedCoins} 💰)`);
        
        SoundSys.play('success');
        FX.confetti();
    },

    updateDisplay() {
        const h = Math.floor(this.visualSec / 3600);
        const m = Math.floor((this.visualSec % 3600) / 60);
        const s = this.visualSec % 60;
        const str = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (document.getElementById('timer')) document.getElementById('timer').innerText = str;
        if (document.getElementById('eco-timer-display')) document.getElementById('eco-timer-display').innerText = str;
    }
};
window.Timer = Timer;    
