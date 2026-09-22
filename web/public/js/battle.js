    const BattleSys = {
    bet: 15,
    currentCode: null,
    listener: null,
    myRole: null,
    gameStarted: false,
    _betReserved: false,   // 🛡️ ставка зарезервирована (списана, ждёт исхода)
    _closing: false,       // 🛡️ защита от двойного закрытия/возврата
    
    selectedMode: 'standard',
    selectedDiff: 'easy',
    
    // 🛡️ ЕДИНАЯ ТОЧКА РЕЗЕРВИРОВАНИЯ СТАВКИ
    // Списывает монеты ОДИН раз и помечает сессию как активную
    reserveBet(amount) {
        if (this._betReserved) return true; // уже зарезервировано
        amount = amount || 15;
        if (DB.user.coins < amount) {
            App.toast(`Нужно минимум ${amount} монет!`);
            return false;
        }
        DB.user.coins -= amount;
        this.bet = amount;
        this._betReserved = true;
        this._closing = false;
        Data.save();
        App.updateUI();
        return true;
    },
    
    // 🛡️ ЕДИНАЯ ТОЧКА ВОЗВРАТА СТАВКИ (строго один раз)
    refundBet(msg) {
        if (!this._betReserved || this._closing) return; // уже возвращено/не списано
        this._closing = true;
        DB.user.coins += this.bet || 15;
        this._betReserved = false;
        Data.save();
        App.updateUI();
        if (msg) App.toast(msg);
    },
    
    // 🛡️ ЗАВЕРШЕНИЕ СЕССИИ — сброс всех флагов и слушателей
    teardown() {
        if (this.listener) { this.listener(); this.listener = null; }
        this.currentCode = null;
        this.myRole = null;
        this.gameStarted = false;
        this._betReserved = false;
        this._closing = false;
    },
    
    // Генерация кода (4 цифры, непустой)
    generateCode() {
        const rand = Math.floor(Math.random() * 9000) + 1000;
        document.getElementById('battle-code-create').value = rand;
    },
    
    // Создать бой
    async createBattle() {
        let code = document.getElementById('battle-code-create').value.trim();
        if (!code || code.length < 3) {
            this.generateCode();
            code = document.getElementById('battle-code-create').value.trim();
        }
        
        // 🛡️ Защита от самому с собой: тот же код уже ждёт с моим p1_id
        try {
            const existing = await window.DB_Online.getDoc(window.DB_Online.doc(window.DB_Online.db, "battles_v2", code));
            if (existing.exists()) {
                const d = existing.data();
                if (d.p1_id === Auth.currentUser.id && !d.p2) {
                    // Моя же живая комната — просто возвращаюсь в лобби
                    this.currentCode = code;
                    this.myRole = 'p1';
                    this.showLobby();
                    this.startListening(window.DB_Online.doc(window.DB_Online.db, "battles_v2", code));
                    return App.toast("⚔️ Ты уже ждёшь соперника в этой комнате");
                }
                return App.toast("❌ Этот код уже занят. Сгенерируй другой!");
            }
        } catch (e) { /* сеть — продолжим, connect() откатит */ }
        
        this.currentCode = code;
        await this.connect();
    },
    
    // Присоединиться к бою
    async joinBattle() {
        const code = document.getElementById('battle-code-join').value.trim();
        if (!code || code.length < 3) {
            return App.toast("❌ Введи код комнаты!");
        }
        
        // 🛡️ Нельзя присоединиться к СВОЕЙ комнате waiting (само-дуэль баг)
        try {
            const existing = await window.DB_Online.getDoc(window.DB_Online.doc(window.DB_Online.db, "battles_v2", code));
            if (existing.exists()) {
                const d = existing.data();
                if (d.p1_id === Auth.currentUser.id) {
                    return App.toast("❌ Это твоя же комната! Жди соперника.");
                }
                if (d.p2 && d.p2 !== null) {
                    return App.toast("⛔️ Комната уже полная!");
                }
            } else {
                return App.toast("❌ Комната не найдена. Проверь код!");
            }
        } catch (e) { /* сеть */ }
        
        this.currentCode = code;
        await this.connect();
    },
    
    openMenu() {
        if (!window.DB_Online) return App.toast("Нужен интернет!");
        document.getElementById('battle-modal').classList.add('show');
        document.getElementById('battle-login-view').style.display = 'block';
        document.getElementById('battle-lobby-view').style.display = 'none';
        
        this.gameStarted = false;
        if (this.listener) this.listener();
    },

    selectMode(mode, btn) {
        this.selectedMode = mode;
        document.querySelectorAll('.battle-mode-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'transparent';
        });
        btn.classList.add('active');
        btn.style.borderColor = 'var(--primary)';
    },

    selectDiff(diff, btn) {
        this.selectedDiff = diff;
        const colors = { easy: 'var(--success)', medium: '#F39C12', hard: '#E74C3C' };
        document.querySelectorAll('.battle-diff-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'transparent';
        });
        btn.classList.add('active');
        btn.style.borderColor = colors[diff];
    },

    getModeLabel(mode) {
        const labels = { 
            'standard': '🔢 Классика', 
            'sign': '🧩 Найди знак', 
            'square': '📐 Степени', 
            'fractions': '🍰 Дроби' 
        };
        return labels[mode] || mode;
    },

    getDiffLabel(diff) {
        const labels = { 
            'easy': '🟢 Легко', 
            'medium': '🟡 Средне', 
            'hard': '🔴 Сложно' 
        };
        return labels[diff] || diff;
    },

    // ГЛАВНАЯ ФУНКЦИЯ ВХОДА
    async connect() {
        // this.currentCode уже установлен в createBattle() или joinBattle()
        const code = this.currentCode;

        // 2. Проверка монет (динамическая ставка по уровню) + 🛡️ резервирование ОДИН раз
        const bet = Math.max(15, Math.floor((DB.user.level || 1) * 10));
        if (!this.reserveBet(bet)) return;

        App.toast("⏳ Подключение...");

        try {
            const docRef = window.DB_Online.doc(window.DB_Online.db, "battles_v2", code);
            const snap = await window.DB_Online.getDoc(docRef);

            if (!snap.exists()) {
                this.myRole = 'p1';
                await this.createRoom(docRef);
            } else {
                const data = snap.data();
                if (data.p2) {
                    this.refundBet();
                    return alert("⛔️ Комната уже полная!");
                }
                
                this.myRole = 'p2';
                await this.joinRoom(docRef, data);
            }

            this.showLobby();
            this.startListening(docRef);

        } catch (e) {
            console.error(e);
            this.refundBet("Ошибка сети. Монеты возвращены.");
        }
    },

    async createRoom(docRef) {
        const expiresAt = Date.now() + (5 * 60 * 1000);
        
        await window.DB_Online.setDoc(docRef, {
            p1: DB.user.name,
            p1_id: Auth.currentUser.id,
            p1_score: -1,
            p2: null,
            p2_id: null,
            p2_score: -1,
            bet: this.bet,
            mode: this.selectedMode,
            diff: this.selectedDiff,
            status: 'waiting',
            date: new Date().toISOString(),
            createdAt: Date.now(),
            expiresAt: expiresAt
        });
    },

    async joinRoom(docRef, currentData) {
        await window.DB_Online.updateDoc(docRef, {
            p2: DB.user.name,
            p2_id: Auth.currentUser.id,
            status: 'ready'
        });
    },

    showLobby() {
        document.getElementById('battle-login-view').style.display = 'none';
        document.getElementById('battle-lobby-view').style.display = 'block';
        document.getElementById('lobby-code-display').innerText = this.currentCode;

        if (this.myRole === 'p1') {
            document.getElementById('p1-name').innerText = DB.user.name + " (Вы)";
            document.getElementById('p2-name').innerText = "Ожидание...";
            document.getElementById('lobby-mode-display').innerText = this.getModeLabel(this.selectedMode);
            document.getElementById('lobby-diff-display').innerText = this.getDiffLabel(this.selectedDiff);
        } else {
            document.getElementById('p1-name').innerText = "Соперник";
            document.getElementById('p2-name').innerText = DB.user.name + " (Вы)";
        }
    },

    startListening(docRef) {
        if (this.listener) this.listener(); // 🛡️ старый слушатель — вон
        this.listener = window.DB_Online.onSnapshot(docRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();

            // Проверка истечения времени
            if (data.expiresAt && Date.now() > data.expiresAt && data.status === 'waiting') {
                this.teardown();
                this.refundBet("⏰ Время ожидания истекло. Монеты возвращены.");
                document.getElementById('battle-modal').classList.remove('show');
                return;
            }

            // Обновляем имена
            if (data.p1) document.getElementById('p1-name').innerText = data.p1 + (this.myRole === 'p1' ? " (Вы)" : "");
            if (data.p2) document.getElementById('p2-name').innerText = data.p2 + (this.myRole === 'p2' ? " (Вы)" : "");
            else if (this.myRole === 'p1') document.getElementById('p2-name').innerText = "Ожидание...";

            // Гость видит настройки хоста
            if (this.myRole === 'p2' && data.mode && data.diff) {
                document.getElementById('lobby-mode-display').innerText = this.getModeLabel(data.mode);
                document.getElementById('lobby-diff-display').innerText = this.getDiffLabel(data.diff);
            }

            // Запуск игры
            if (data.status === 'ready' && !this.gameStarted) {
                this.gameStarted = true;
                
                setTimeout(() => {
                    if (this.listener) this.listener();
                    document.getElementById('battle-modal').classList.remove('show');
                    Trainer.startPVP(this.myRole, this.currentCode, data.bet, data.mode, data.diff);
                }, 1000);
            }
        });
    },

    async leaveLobby() {
        const wasReserved = this._betReserved;
        const iAmHost = this.myRole === 'p1' && this.currentCode;
        const code = this.currentCode;
        const started = this.gameStarted;
        
        // 🛡️ Возврат ставки ДО teardown (teardown сбрасывает флаги)
        if (!started && wasReserved) {
            this.refundBet("💰 Монеты возвращены");
        }
        
        this.teardown();
        document.getElementById('battle-modal').classList.remove('show');
        
        // Хост, ушедший из лобби, закрывает комнату (соперник не зависнет в ожидании)
        if (!started && iAmHost && code) {
            try {
                const docRef = window.DB_Online.doc(window.DB_Online.db, "battles_v2", code);
                await window.DB_Online.deleteDoc(docRef);
            } catch (e) {
                console.error("Не удалось удалить комнату:", e);
            }
        }
    },

    // === ВЫЗОВ НА ДУЭЛЬ ИЗ ТОПА ===
    _challengeUnsub: null,
    async challengePlayer(targetId, targetName, targetFcmToken) {
        // Проверки
        if (!window.DB_Online) return App.toast('⚠️ Нет связи с сервером');
        if (targetId === Auth.currentUser.id) return App.toast('❌ Нельзя вызвать самого себя!');
        
        // 🛡️ Резервируем ставку ОДИН раз (защита от двойного клика)
        if (!this.reserveBet(15)) return;
        
        const now = Date.now();
        
        // Если modes/diffs не были выбраны — ставим defaults
        if (!this.selectedMode) this.selectedMode = 'standard';
        if (!this.selectedDiff) this.selectedDiff = 'easy';
        
        // Генерируем код комнаты
        const code = String(Math.floor(Math.random() * 9000) + 1000);
        this.currentCode = code;
        this.myRole = 'p1';
        
        try {
            // 🎯 Проверяем что цель существует и онлайн (иначе вызов уйдёт в никуда)
            let targetProfile = null;
            try {
                const targetSnap = await window.DB_Online.getDoc(
                    window.DB_Online.doc(window.DB_Online.db, 'leaderboard', targetId)
                );
                if (targetSnap.exists()) targetProfile = targetSnap.data();
            } catch(e) {}
            if (!targetProfile || (Date.now() - Number(targetProfile.lastActive || 0)) >= 300000) {
                this.refundBet();
                return App.toast('❌ Игрок не в сети или не найден');
            }

            // Создаём боевую комнату
            const docRef = window.DB_Online.doc(window.DB_Online.db, 'battles_v2', code);
            await window.DB_Online.setDoc(docRef, {
                p1: DB.user.name,
                p1_id: Auth.currentUser.id,
                p1_score: -1,
                p2: null,
                p2_id: null,
                p2_score: -1,
                bet: 15,
                mode: this.selectedMode || 'standard',
                diff: this.selectedDiff || 'easy',
                status: 'waiting',
                createdAt: now,
                expiresAt: now + 300000,
                challengerName: DB.user.name,
                targetId: targetId,
                targetName: targetName
            });
            
            // Создаём документ-вызов для пуша
            const challengeRef = window.DB_Online.doc(window.DB_Online.db, 'pendingChallenges', targetId);
            await window.DB_Online.setDoc(challengeRef, {
                fromId: Auth.currentUser.id,
                fromName: DB.user.name,
                fromAvatar: DB.user.avatar || '\ud83d\ude0e',
                battleCode: code,
                mode: this.selectedMode || 'standard',
                diff: this.selectedDiff || 'easy',
                createdAt: now
            });
            
            // Показываем лобби
            this.showLobby();
            this.startListening(docRef);
            App.toast(`\u2694\ufe0f \u0412\u044b\u0437\u043e\u0432 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d ${targetName}!`);
            SoundSys.play('sword');
        } catch (e) {
            console.error('Challenge error:', e);
            // Возвращаем монеты при ошибке
            this.refundBet('\u274c \u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0434\u0443\u044d\u043b\u0438. \u041c\u043e\u043d\u0435\u0442\u044b \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0435\u043d\u044b.');
        }
    },

    // === СЛУШАТЕЛЬ ВХОДЯЩИХ ВЫЗОВОВ ===
    startChallengeListener() {
        if (!window.DB_Online || !Auth.currentUser) return;
        if (this._challengeUnsub) this._challengeUnsub();
        
        const challengeRef = window.DB_Online.doc(window.DB_Online.db, 'pendingChallenges', Auth.currentUser.id);
        this._challengeUnsub = window.DB_Online.onSnapshot(challengeRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (!data || !data.battleCode) return;
            // 🧹 Просроченные вызовы (>35 сек) удаляем и игнорируем — иначе
            // забытый старый вызов навсегда блокирует приём новых
            if (data.createdAt && (Date.now() - Number(data.createdAt)) > 35000) {
                window.DB_Online.deleteDoc(challengeRef).catch(() => {});
                return;
            }
            // Защита от двойного показа модалки
            if (this._challengeModalShown) return;
            this._challengeModalShown = true;

            
            // === КРАСИВОЕ МОДАЛЬНОЕ ОКНО ===
            const modal = document.getElementById('duel-challenge-modal');
            if (!modal) { console.error('Duel modal not found'); return; }
            
            // Заполняем данные
            document.getElementById('dc-from-avatar').textContent = data.fromAvatar || '😎';
            document.getElementById('dc-from-name').textContent = data.fromName;
            document.getElementById('dc-my-avatar').textContent = DB.user.avatar || '😎';
            document.getElementById('dc-my-name').textContent = DB.user.name;
            document.getElementById('dc-mode').textContent = this.getModeLabel(data.mode);
            document.getElementById('dc-diff').textContent = this.getDiffLabel(data.diff);
            
            // Звук при получении вызова
            SoundSys.play('win');
            
            // Таймер обратного отсчёта (30 сек)
            let countdown = 30;
            const countdownEl = document.getElementById('dc-countdown');
            const interval = setInterval(() => {
                countdown--;
                if (countdownEl) countdownEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(interval);
                    modal.classList.remove('show');
                    window.DB_Online.deleteDoc(challengeRef).catch(() => {});
                    App.toast('⏰ Время вызова истекло');
                }
            }, 1000);
            
            // Кнопки
            const acceptBtn = document.getElementById('dc-accept-btn');
            const declineBtn = document.getElementById('dc-decline-btn');
            
            const cleanup = () => {
                clearInterval(interval);
                modal.classList.remove('show');
                acceptBtn.onclick = null;
                declineBtn.onclick = null;
                this._challengeModalShown = false;
            };
            
            acceptBtn.onclick = async () => {
                cleanup();
                
                // 🛡️ Проверка что комната ещё жива и свободна
                try {
                    const roomSnap = await window.DB_Online.getDoc(window.DB_Online.doc(window.DB_Online.db, 'battles_v2', data.battleCode));
                    if (!roomSnap.exists()) {
                        window.DB_Online.deleteDoc(challengeRef).catch(() => {});
                        return App.toast('⌛ Комната дуэли уже закрыта');
                    }
                    const rd = roomSnap.data();
                    if (rd.p2 && rd.p2 !== null) {
                        window.DB_Online.deleteDoc(challengeRef).catch(() => {});
                        return App.toast('⛔️ Кто-то уже принял этот вызов');
                    }
                    if (rd.p1_id === Auth.currentUser.id) {
                        window.DB_Online.deleteDoc(challengeRef).catch(() => {});
                        return App.toast('❌ Это твой собственный вызов');
                    }
                } catch (e) {
                    return App.toast('⚠️ Ошибка сети');
                }
                
                // 🛡️ Резервируем ставку ОДИН раз
                if (!this.reserveBet(15)) return;
                DB.user.lastBattleTime = Date.now();
                Data.save();
                
                // Присоединяемся к комнате
                try { const docRef = window.DB_Online.doc(window.DB_Online.db, 'battles_v2', data.battleCode);
                    await window.DB_Online.updateDoc(docRef, {
                        p2: DB.user.name,
                        p2_id: Auth.currentUser.id,
                        status: 'ready'
                    });
                    this.currentCode = data.battleCode;
                    this.myRole = 'p2';
                    this.gameStarted = true;
                    this.startListening(docRef);
                    SoundSys.play('success');
                    App.toast('⚔️ Дуэль начинается!');
                } catch(e) { console.error('Accept error:', e); this.refundBet('❌ Ошибка. Монеты возвращены.'); }
                
                // Удаляем документ вызова
                window.DB_Online.deleteDoc(challengeRef).catch(() => {});
            };
            
            declineBtn.onclick = () => {
                cleanup();
                App.toast('❌ Вызов отклонён');
                window.DB_Online.deleteDoc(challengeRef).catch(() => {});
            };
            
            // Показываем модалку
            modal.classList.add('show');
        });
    },
    stopChallengeListener() {
        if (this._challengeUnsub) {
            this._challengeUnsub();
            this._challengeUnsub = null;
        }
    }
};                    
