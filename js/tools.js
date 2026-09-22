    const Whiteboard = {
        canvas: null, ctx: null, isDrawing: false,
        init() {
            this.canvas = document.getElementById('wb-canvas'); this.ctx = this.canvas.getContext('2d'); this.resize();
            const h = (e) => { e.preventDefault(); this.start(e.touches?e.touches[0]:e); };
            const m = (e) => { e.preventDefault(); this.draw(e.touches?e.touches[0]:e); };
            const e = () => this.stop();
            this.canvas.onmousedown = h; this.canvas.onmousemove = m; this.canvas.onmouseup = e; this.canvas.onmouseout = e;
            this.canvas.ontouchstart = h; this.canvas.ontouchmove = m; this.canvas.ontouchend = e;
        },
        open() { document.getElementById('wb-modal').classList.add('show'); this.resize(); },
        close() { document.getElementById('wb-modal').classList.remove('show'); },
        resize() { const p = this.canvas.parentElement; this.canvas.width = p.clientWidth; this.canvas.height = 350; this.ctx.lineCap = 'round'; this.ctx.lineWidth = 3; this.ctx.strokeStyle = '#2B3674'; },
        start(e) { this.isDrawing = true; this.ctx.beginPath(); const r = this.canvas.getBoundingClientRect(); this.ctx.moveTo(e.clientX - r.left, e.clientY - r.top); },
        draw(e) { if(!this.isDrawing) return; const r = this.canvas.getBoundingClientRect(); this.ctx.lineTo(e.clientX - r.left, e.clientY - r.top); this.ctx.stroke(); },
        stop() { this.isDrawing = false; },
        clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); },
        toggle() { this.open(); SoundSys.play('click'); }
    };

    const Calc = {
        current: '',
        history: JSON.parse(localStorage.getItem('calcHistory') || '[]'),
        mode: 'basic',
        _keyHandler: null,

        toggle() {
            const m = document.getElementById('calc-modal');
            m.classList.toggle('show');
            if (m.classList.contains('show')) {
                this.clear();
                this._bindKeyboard();
            } else {
                this._unbindKeyboard();
            }
            SoundSys.play('click');
        },

        append(val) {
            if (this.current.length > 60) return;
            // Если последний результат — начать новый ввод
            if (this._lastResult && /^[0-9.]/.test(val)) {
                this.current = '';
                this._lastResult = false;
            }
            this.current += val;
            this._lastResult = false;
            this.update();
            SoundSys.play('click');
        },

        insertFn(fn) {
            if (this._lastResult) {
                this.current = '';
                this._lastResult = false;
            }
            this.current += fn;
            this.update();
            SoundSys.play('click');
        },

        clear() {
            this.current = '';
            this._lastResult = false;
            this.update();
        },

        backspace() {
            this.current = this.current.slice(0, -1);
            this._lastResult = false;
            this.update();
            SoundSys.play('click');
        },

        negate() {
            if (!this.current) return;
            if (this.current.startsWith('-')) {
                this.current = this.current.slice(1);
            } else {
                this.current = '-' + this.current;
            }
            this.update();
            SoundSys.play('click');
        },

        solve() {
            try {
                let expr = this.current;
                if (!expr) return;

                // Безопасная обработка科学 функций (не дублируем Math.)
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])sin\(/g, 'Math.sin(');
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])cos\(/g, 'Math.cos(');
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])tan\(/g, 'Math.tan(');
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])sqrt\(/g, 'Math.sqrt(');
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])log\(/g, 'Math.log10(');
                expr = expr.replace(/(?<!Math\.)(?<![a-zA-Z])ln\(/g, 'Math.log(');
                expr = expr.replace(/\^2/g, '**2');
                expr = expr.replace(/\^/g, '**');
                expr = expr.replace(/%/g, '/100');

                // Безопасная проверка (только математика)
                if (/^[0-9+\-*/.()%,A-Za-z ]*$/.test(expr)) {
                    const result = new Function('return ' + expr)();
                    const display = typeof result === 'number'
                        ? (Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(8)).toString())
                        : 'Error';

                    // Сохраняем в историю
                    this.history.unshift({ expr: this.current, result: display });
                    if (this.history.length > 20) this.history.pop();
                    localStorage.setItem('calcHistory', JSON.stringify(this.history));
                    this.renderHistory();

                    // Показать выражение и результат
                    document.getElementById('calc-expression').textContent = this.current;
                    this.current = display;
                    this._lastResult = true;
                } else {
                    this.current = 'Error';
                }
            } catch {
                this.current = 'Error';
            }
            this.update();
            SoundSys.play('success');
        },

        update() {
            const display = document.getElementById('calc-display');
            display.textContent = this.current || '0';
            display.classList.toggle('error', this.current === 'Error');
            // Авто-скролл влево если текст длинный
            display.scrollLeft = display.scrollWidth;
        },

        setMode(mode) {
            this.mode = mode;
            const sci = document.getElementById('calc-sci');
            const btns = document.querySelectorAll('.calc-mode-btn');
            sci.classList.toggle('show', mode === 'sci');
            btns.forEach(b => b.classList.remove('active'));
            btns[mode === 'basic' ? 0 : 1].classList.add('active');
            SoundSys.play('click');
        },

        toggleHistory() {
            const h = document.getElementById('calc-history');
            h.classList.toggle('open');
            this.renderHistory();
            SoundSys.play('click');
        },

        renderHistory() {
            const list = document.getElementById('calc-history-list');
            if (!this.history.length) {
                list.innerHTML = '<div class="calc-history-empty">Пока нет вычислений</div>';
                return;
            }
            list.innerHTML = this.history.slice(0, 10).map(h =>
                `<div class="calc-history-item" onclick="Calc.current='${h.result}';Calc.update();">
                    <span class="expr">${h.expr}</span>
                    <span class="res">= ${h.result}</span>
                </div>`
            ).join('');
        },

        _bindKeyboard() {
            if (this._keyHandler) return;
            this._keyHandler = (e) => {
                if (!document.getElementById('calc-modal').classList.contains('show')) return;
                const key = e.key;
                if (/^[0-9.]+$/.test(key)) this.append(key);
                else if (['+', '-', '*', '/'].includes(key)) this.append(key);
                else if (key === '(' || key === ')') this.append(key);
                else if (key === 'Enter' || key === '=') { e.preventDefault(); this.solve(); }
                else if (key === 'Backspace') this.backspace();
                else if (key === 'Escape' || key === 'Delete') this.clear();
            };
            document.addEventListener('keydown', this._keyHandler);
        },

        _unbindKeyboard() {
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler);
                this._keyHandler = null;
            }
        }
    };

    // --- SUBJECT SYSTEM ---
    const SubjectSys = {
        render() {
            const list = document.getElementById('settings-subject-list'); if(!list) return;
            list.innerHTML = Object.keys(DB.subjects).map(key => { const s = DB.subjects[key]; return `<div class="subject-manage-row"><div class="subject-manage-info"><span style="font-size:20px;">${s.icon}</span> ${s.name}</div><button class="btn-delete" onclick="SubjectSys.delete('${key}')">✕</button></div>`; }).join('');
        },
        addPreset(icon, name) {
            const id = 'subj_' + Date.now(); 
            DB.subjects[id] = { name: name, icon: icon, sec: 0 };
            Data.save(); this.render(); App.renderSubjects(); App.toast(name + " добавлен!");
        },
        delete(key) {
            if(Object.keys(DB.subjects).length <= 1) return App.toast("Нельзя удалить последний предмет!");
            if(!confirm("Удалить этот предмет?")) return;
            delete DB.subjects[key]; if(DB.user.subject === key) { DB.user.subject = Object.keys(DB.subjects)[0]; }
            Data.save(); this.render(); App.renderSubjects(); App.updateUI(); App.toast("Предмет удален");
        }
    };

    // --- DAILY REWARD SYSTEM ---
    const DailySys = {
        // Цикл 1: первые 7 дней (минимальные награды)
        // Цикл 2: после 7 дней (倍率 — награды растут)
        rewards: [10, 20, 30, 40, 50, 75, 100],
        rewardsCycle2: [150, 200, 250, 300, 350, 400, 500],

        // ПРОВЕРКА ПРИ ВХОДЕ
        async check() {
            const today = getUZDate(); // Текущая дата по Ташкенту
            const last = DB.user.lastDailyClaim; // Когда забирал последний раз

            // Если сегодня уже забирал - выходим
            if (last === today) return;

            // ПРОВЕРКА НА СРЫВ СТРИКА (через TimeGuard — timezone-safe)
            if (last) {
                const yesterdayTs = TimeGuard.getTrueTime() - 86400000;
                const yesterdayStr = getUZDate(new Date(yesterdayTs));

                if (last !== yesterdayStr && last !== today) {
                    // Если есть щит — тратим его
                    if (DB.user.inventory && DB.user.inventory.shield > 0) {
                        DB.user.inventory.shield--;
                        App.toast("🛡️ Щит спас твой стрик!");
                    } else {
                        DB.user.dailyStreak = 0; 
                        App.toast("🔥 Стрик сгорел!");
                    }
                }
            }

            // Показываем окно награды
            this.showModal();
        },

        showModal() {
            const modal = document.getElementById('daily-modal'); 
            const grid = document.getElementById('daily-grid'); 
            // Определяем цикл: streak < 7 → cycle1, streak >= 7 → cycle2
            const isCycle2 = (DB.user.dailyStreak || 0) >= 7;
            const activeRewards = isCycle2 ? this.rewardsCycle2 : this.rewards;
            const currentDayIndex = DB.user.dailyStreak % 7;
            
            grid.innerHTML = activeRewards.map((r, i) => { 
                let cls = 'daily-day'; 
                if (i < currentDayIndex) cls += ' claimed';
                if (i === currentDayIndex) cls += ' active';
                return `<div class="${cls}"><div class="daily-coin">💰</div><div>${r}</div></div>`; 
            }).join('');
            
            document.getElementById('daily-reward-amount').innerText = activeRewards[currentDayIndex]; 
            modal.classList.add('show'); 
            FX.confetti(); 
            SoundSys.play('win');
        },

    async claim() {
        const btn = document.querySelector('#daily-modal .btn');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "⏳ Ждите...";
        }

        // Обновляем офсет перед начислением
        await TimeGuard.sync();

        const currentDayIndex = DB.user.dailyStreak % 7;
        const isCycle2 = (DB.user.dailyStreak || 0) >= 7;
        const reward = isCycle2 ? this.rewardsCycle2[currentDayIndex] : this.rewards[currentDayIndex];
        
        DB.user.coins += reward;
        DB.user.dailyStreak++;
        DB.user.lifetimeDailyClaims = (DB.user.lifetimeDailyClaims || 0) + 1;
        
        // Записываем ЧЕСТНУЮ дату получения
        DB.user.lastDailyClaim = getUZDate();

        Data.save();
        App.updateUI();
        
        document.getElementById('daily-modal').classList.remove('show');
        SoundSys.play('coin');
        App.toast(`✅ Получено: ${reward} монет!`);
        
        if (btn) btn.disabled = false;
    }
    };

    // --- DONATION & ONLINE ---
    const Donation = {
        // ВСТАВЬ СЮДА НОМЕРА КАРТ
        uzCard: "9860 1901 0789 6911 (Rustam M.)", 
        worldCard: "4916 9903 0189 0056 (Rustam M.)",
        
        payUz() { 
            prompt("Скопируйте номер карты для перевода (Payme/Click):", this.uzCard);
            alert("После перевода скинь скриншот мне в тг @mathboosterpro, чтобы получить код!");
        },
        
        payWorld() { 
            prompt("Скопируйте номер карты для перевода (Visa):", this.worldCard);
            alert("После перевода скинь скриншот мне в тг @mathboosterpro, чтобы получить код!");
        },
        async enterCode() {
            const c = prompt("Введите промокод:"); 
            const code = c.trim().toUpperCase();
            
            // 1. ПРОВЕРКА ЛОКАЛЬНО: Брал ли я его уже?
            if(DB.user.usedCodes && DB.user.usedCodes.includes(code)) {
                return App.toast("Вы уже активировали этот код!");
            }

            // 3. ПРОВЕРКА В ОБЛАКЕ
            if (!window.DB_Online) return App.toast("Нужен интернет!");
            App.toast("⏳ Проверка кода...");

            try {
                const docRef = window.DB_Online.doc(window.DB_Online.db, "promo_codes", code);
                const snap = await window.DB_Online.getDoc(docRef);

                if (!snap.exists()) throw "Код не существует";
                const data = snap.data();

                // --- ВАРИАНТ А: ВРЕМЕННЫЙ КОД (ДЛЯ ВСЕХ) ---
                if (data.isTimeLimited) {
                    const now = new Date();
                    const expireDate = new Date(data.expiresAt);

                    if (now > expireDate) {
                        throw "⏰ Время действия кода истекло!";
                    }

                    this.applyReward(code, {
                        c: data.coins,
                        vip: data.vip,
                        pro: data.pro,
                        isKing: data.isKing,
                        msg: data.msg || "Временный бонус получен!"
                    });
                } 
                
                // --- ВАРИАНТ Б: ОБЫЧНЫЙ ОДНОРАЗОВЫЙ КОД (ТРАНЗАКЦИЯ) ---
                else {
                    if (data.isUsed) throw "Код уже кем-то активирован!";

                    // Запускаем транзакцию для "сжигания" билета
                    await window.DB_Online.runTransaction(window.DB_Online.db, async (transaction) => {
                        const sfDoc = await transaction.get(docRef);
                        if (!sfDoc.exists()) throw "Код не существует";
                        if (sfDoc.data().isUsed) throw "Код уже активирован!";

                        transaction.update(docRef, { 
                            isUsed: true,
                            usedBy: DB.user.name + ` (${Auth.currentUser.id})`,
                            usedAt: new Date().toISOString()
                        });
                    });

                    // Если транзакция прошла успешно
                    this.applyReward(code, {
                        c: data.coins,
                        vip: data.vip,
                        pro: data.pro,
                        isKing: data.isKing,
                        msg: data.msg
                    });
                }

            } catch (e) {
                console.error(e);
                alert("❌ " + (typeof e === 'string' ? e : "Ошибка сети"));
            }
        },

        // Вспомогательная функция (чтобы не писать одно и то же 2 раза)
        applyReward(code, reward) {
            DB.user.coins += reward.c;
            
            // === VIP СТАТУС (7000 монет) ===
            if (reward.vip) {
                DB.user.isVip = true;
                if (!DB.user.ownedTitles) DB.user.ownedTitles = [];
                if (!DB.user.ownedTitles.includes('vip')) DB.user.ownedTitles.push('vip');
                DB.user.currentTitle = "💎 VIP";
                App.toast("💎 СТАТУС VIP ПОЛУЧЕН!");
            }

            // === PRO СТАТУС (12000 монет) ===
            if (reward.pro) {
                DB.user.isPro = true;
                if (!DB.user.ownedTitles) DB.user.ownedTitles = [];
                if (!DB.user.ownedTitles.includes('pro')) DB.user.ownedTitles.push('pro');
                DB.user.currentTitle = "⭐ PRO";
                App.toast("⭐ СТАТУС PRO ПОЛУЧЕН!");
            }

            // === LEGEND СТАТУС (25000 монет) ===
            if (reward.isKing) {
                DB.user.isKing = true;
                DB.user.isLegend = true;
                if (!DB.user.ownedTitles) DB.user.ownedTitles = [];
                if (!DB.user.ownedTitles.includes('legend')) DB.user.ownedTitles.push('legend');
                DB.user.currentTitle = "👑 LEGEND";
                App.toast("👑 СТАТУС LEGEND ПОЛУЧЕН!");
            }

            // --- СТАРЫЙ СТАТУС TITAN (если нужен) ---
            if (reward.isTitan) {
                DB.user.isTitan = true;
                DB.user.isKing = true;
                if (!DB.user.ownedTitles) DB.user.ownedTitles = [];
                if (!DB.user.ownedTitles.includes('titan')) DB.user.ownedTitles.push('titan');
                DB.user.currentTitle = "⚡ TITAN";
                App.toast("⚡ СТАТУС ТИТАНА ПОЛУЧЕН!");
            }

            if(!DB.user.usedCodes) DB.user.usedCodes = [];
            DB.user.usedCodes.push(code);
            
            Data.save(); 
            App.updateUI(); 
            App.renderShop(); 
            
            FX.confetti(); 
            SoundSys.play('win'); 
            alert(`✅ УСПЕШНО!\n\n${reward.msg}\nНачислено: +${reward.c} 💰`);
        }
    };
