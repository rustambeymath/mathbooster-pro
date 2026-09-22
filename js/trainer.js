    const Trainer = { 
        lastAnswerTime: 0,
    
        // Добавили флаг isLocked
        isLocked: false, // Флаг блокировки
        score: 0, time: 60, interval: null, 
        ans: 0, correctSign: '', difficulty: 'easy', mode: 'standard', 
        isLocked: false, // <--- НОВОЕ: Защита от спама

    // --- ДУЭЛЬНЫЕ ПЕРЕМЕННЫЕ ---
        isDuel: false,
        duelRole: null, 
        duelBet: 0,
        duelCode: null, // <--- НОВАЯ ПЕРЕМЕННАЯ

        // ФУНКЦИЯ ЗАПУСКА ДУЭЛИ
        

        // 1. Выбор режима
        selectMode(mode, btn) {
            this.mode = mode;
            document.querySelectorAll('.trainer-mode-card').forEach(b => b.classList.remove('active'));
            if(btn) btn.classList.add('active');
            this.updateMenuRecordDisplay();
            SoundSys.play('click');
        },

        // 2. Выбор сложности
        setDiff(diff, btn) {
            this.difficulty = diff;
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            if(btn) btn.classList.add('active');
            this.updateMenuRecordDisplay();
        },

        updateMenuRecordDisplay() {
            const labels = { 'standard': 'Классика', 'sign': 'Найди знак', 'square': 'Степени', 'fractions': 'Дроби', 'percent': 'Проценты', 'fsu': 'ФСУ' };
            // Защита от сбоев
            if (DB && DB.user && DB.user.trainerRecords && DB.user.trainerRecords[this.mode]) {
                const rec = DB.user.trainerRecords[this.mode][this.difficulty] || 0;
                const el = document.getElementById('trainer-high-score');
                if(el) el.innerText = rec;
                const lbl = document.getElementById('record-mode-label');
                if(lbl) lbl.innerText = labels[this.mode];
            }
        },        // === НУМПАД ===
        numpad(val) {
            const input = document.getElementById('game-input');
            let cur = input.value;
            // Ограничение длины
            if (cur.replace('-','').replace('/','').length >= 8) return;
            // Нельзя начинать с 0 (кроме "0.")
            if (cur === '0' && val !== '.') { input.value = val; this._updateNumpadDisplay(); return; }
            input.value = cur + val;
            this._updateNumpadDisplay();
        },
        numpadBack() {
            const input = document.getElementById('game-input');
            input.value = input.value.slice(0, -1);
            this._updateNumpadDisplay();
        },
        toggleMinus() {
            const input = document.getElementById('game-input');
            let val = input.value;
            if (val === '') input.value = '-';
            else if (val.startsWith('-')) input.value = val.substring(1);
            else input.value = '-' + val;
            this._updateNumpadDisplay();
        },
        addSlash() {
            const input = document.getElementById('game-input');
            let val = input.value;
            if (val.includes('/') || val === '' || val === '-') { this._updateNumpadDisplay(); return; }
            input.value = val + '/';
            this._updateNumpadDisplay();
        },
        _updateNumpadDisplay() {
            const display = document.getElementById('numpad-display');
            const input = document.getElementById('game-input');
            if (display && input) {
                display.textContent = input.value || '0';
                // Подсветка если > 0 символов
                if (input.value) {
                    display.classList.add('active');
                } else {
                    display.classList.remove('active');
                }
            }
        },

        init() { 
            this.unlockControls(); // <--- ЛЕКАРСТВО
            this._duelSettled = false; // 🛡️ сброс при возврате в меню
            // Скрываем Battle HUD если остался
            document.getElementById('battle-hud').classList.remove('active');
            document.getElementById('normal-stats').style.display = '';
            if (this._rivalScoreListener) { this._rivalScoreListener(); this._rivalScoreListener = null; }
            this._prevRivalScore = 0;
            document.getElementById('trainer-menu').style.display = 'block'; 
            document.getElementById('trainer-game').style.display = 'none'; 
            document.getElementById('trainer-result').style.display = 'none'; 
            this.updateMenuRecordDisplay();
        },

        start() {
            this.unlockControls();
            this.score = 0; 
            this.time = 60; 
            
            document.getElementById('trainer-menu').style.display = 'none'; 
            document.getElementById('trainer-game').style.display = 'block';
            document.getElementById('trainer-result').style.display = 'none'; 
            
            document.getElementById('game-score').innerText = 0; 
            document.getElementById('game-time').innerText = 60;
            
            // Сброс Battle HUD для этой сессии
            if (this.isDuel) {
                document.getElementById('battle-hud').classList.add('active');
                document.getElementById('normal-stats').style.display = 'none';
                document.getElementById('battle-me-score').textContent = '0';
                document.getElementById('battle-rival-score').textContent = '0';
                document.getElementById('battle-me-hp').style.width = '100%';
                document.getElementById('battle-rival-hp').style.width = '100%';
            } else {
                document.getElementById('battle-hud').classList.remove('active');
                document.getElementById('normal-stats').style.display = '';
            }
            
            // Сброс полоски времени
            const bar = document.getElementById('timer-bar-fill');
            if (bar) bar.style.width = '100%';

            const inputArea = document.getElementById('input-area');
            const signArea = document.getElementById('sign-area');

            if (this.mode === 'sign') {
                inputArea.style.display = 'none';
                signArea.style.display = 'grid';
            } else {
                inputArea.style.display = 'block';
                signArea.style.display = 'none';
                const input = document.getElementById('game-input'); 
                input.value = ''; input.focus();
            }

            this.nextProblem(); 
            
            if(this.interval) clearInterval(this.interval);
            this.interval = setInterval(() => { 
                this.time--; 
                document.getElementById('game-time').innerText = this.time; 
                
                // Обновление полоски
                const bar = document.getElementById('timer-bar-fill');
                if (bar) bar.style.width = (this.time / 60 * 100) + '%';

                if(this.time <= 0) this.end(); 
            }, 1000);
        },

    fail(el) {
            if (this.isLocked) return;
            this.isLocked = true;

            el.classList.add('error-shake');
            
            // Блокируем визуально
            document.getElementById('input-area').classList.add('input-locked');
            document.getElementById('sign-area').classList.add('input-locked');

            this.time -= 5;
            if (this.time < 0) this.time = 0;
            document.getElementById('game-time').innerText = this.time;

            if (this.time <= 0) {
                this.end();
                return;
            }

            // Разблокировка через 1.2 сек
            setTimeout(() => {
                // Проверяем, идет ли еще игра, прежде чем разблокировать
                if (document.getElementById('trainer-game').style.display !== 'none') {
                    this.unlockControls();
                    // Очистка поля
                    if(el.tagName === 'INPUT') el.value = '';
                }
            }, 1200);
        },

        

        nextProblem() {
            const box = document.getElementById('problem-box');
                if (box) {
                    box.classList.remove('animate-problem');
                    void box.offsetWidth; // Магия для перезапуска анимации
                    box.classList.add('animate-problem');
                }
            // --- 1. РЕЖИМ: НАЙДИ ЗНАК 🧩 ---
            if (this.mode === 'sign') {
                const ops = ['+', '-', '*', '/'];
                const availableOps = this.difficulty === 'easy' ? ['+', '-', '*'] : ops;
                this.correctSign = availableOps[Math.floor(Math.random() * availableOps.length)];
                
                let a, b, res;
                let range = this.difficulty === 'easy' ? 10 : 20;

                if (this.correctSign === '/') {
                    b = Math.floor(Math.random() * 10) + 2; 
                    res = Math.floor(Math.random() * 10) + 2;
                    a = b * res; 
                } else if (this.correctSign === '*') {
                    a = Math.floor(Math.random() * 10) + 2;
                    b = Math.floor(Math.random() * 10) + 2;
                    res = a * b;
                } else {
                    a = Math.floor(Math.random() * range) + 2;
                    b = Math.floor(Math.random() * range) + 2;
                    if (this.correctSign === '+') res = a + b; else res = a - b;
                }
                document.getElementById('game-problem').innerText = `${a} ? ${b} = ${res}`;
            }

            // --- 2. РЕЖИМ: СТЕПЕНИ 📐 ---
            else if (this.mode === 'square') {
                let num, power;
                
                if (this.difficulty === 'easy') {
                // ЛЕГКИЙ: только 2-я степень (от 0 до 20)
                const isRoot = Math.random() < 0.5;
                num = Math.floor(Math.random() * 21); // от 0 до 20
                
                if (isRoot) {
                    // Квадратный корень: √49 = ?
                    this.ans = num;
                    document.getElementById('game-problem').innerText = `√${num * num}`;
                } else {
                    // Квадрат: 7² = ?
                    this.ans = num * num;
                    document.getElementById('game-problem').innerText = `${num}²`;
                }
            }
                else if (this.difficulty === 'medium') {
                    // СРЕДНИЙ: 3-я степень
                    const isRoot = Math.random() < 0.5;
                    num = Math.floor(Math.random() * 7) + 2; // от 2 до 8
                    
                    if (isRoot) {
                        // Кубический корень: ³√125 = ?
                        this.ans = num;
                        document.getElementById('game-problem').innerText = `³√${num * num * num}`;
                    } else {
                        // Куб: 5³ = ?
                        this.ans = num * num * num;
                        document.getElementById('game-problem').innerText = `${num}³`;
                    }
                } 
                else {
                    // СЛОЖНЫЙ: степени 4, 5, 6
                    const isRoot = Math.random() < 0.7;
                    
                    if (isRoot) {
                        // Корень высокой степени
                        power = Math.floor(Math.random() * 3) + 4; // 4, 5 или 6
                        num = Math.floor(Math.random() * 3) + 2; // от 2 до 4
                        this.ans = num;
                        const value = Math.pow(num, power);
                        
                        // Надстрочные символы для степени корня
                        const superscripts = { '4': '⁴', '5': '⁵', '6': '⁶' };
                        document.getElementById('game-problem').innerText = `${superscripts[power]}√${value}`;
                    } else {
                        // Высокая степень
                        power = Math.floor(Math.random() * 3) + 4; // 4, 5 или 6
                        num = Math.floor(Math.random() * 4) + 2; // от 2 до 5
                        this.ans = Math.pow(num, power);
                        
                        // Надстрочные символы для степени
                        const superscripts = { '4': '⁴', '5': '⁵', '6': '⁶' };
                        document.getElementById('game-problem').innerText = `${num}${superscripts[power]}`;
                    }
                }
                
                document.getElementById('game-input').value = '';
            }

// --- 3. РЕЖИМ: ДРОБИ 🍰 ---
else if (this.mode === 'fractions') {
    if (this.difficulty === 'easy') {
        // ЛЕГКИЙ: простые дроби с одинаковыми знаменателями
        const operations = ['+', '-', '*', '/'];
        const op = operations[Math.floor(Math.random() * operations.length)];
        
        if (op === '+' || op === '-') {
            // Сложение/вычитание с одинаковым знаменателем
            const denom = [2, 3, 4, 5, 6][Math.floor(Math.random() * 5)];
            let num1 = Math.floor(Math.random() * (denom - 1)) + 1;
            let num2 = Math.floor(Math.random() * (denom - 1)) + 1;
            
            if (op === '+') {
                const resNum = num1 + num2;
                // Упрощаем результат
                const gcd = this.getGCD(resNum, denom);
                this.ans = (resNum / gcd) / (denom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom} + ${num2}/${denom} = ?`;
            } else {
                // Для вычитания делаем num1 > num2
                if (num1 < num2) [num1, num2] = [num2, num1];
                const resNum = num1 - num2;
                const gcd = this.getGCD(resNum, denom);
                this.ans = resNum === 0 ? 0 : (resNum / gcd) / (denom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom} - ${num2}/${denom} = ?`;
            }
        } else if (op === '*') {
            // Умножение простых дробей
            const num1 = [1, 2, 3][Math.floor(Math.random() * 3)];
            const denom1 = [2, 3, 4][Math.floor(Math.random() * 3)];
            const num2 = [1, 2][Math.floor(Math.random() * 2)];
            const denom2 = [2, 3][Math.floor(Math.random() * 2)];
            
            const resNum = num1 * num2;
            const resDenom = denom1 * denom2;
            const gcd = this.getGCD(resNum, resDenom);
            this.ans = (resNum / gcd) / (resDenom / gcd);
            document.getElementById('game-problem').innerText = `${num1}/${denom1} × ${num2}/${denom2} = ?`;
        } else {
            // Деление простых дробей
            const num1 = [1, 2, 3][Math.floor(Math.random() * 3)];
            const denom1 = [2, 4][Math.floor(Math.random() * 2)];
            const num2 = [1, 2][Math.floor(Math.random() * 2)];
            const denom2 = [2, 3][Math.floor(Math.random() * 2)];
            
            const resNum = num1 * denom2;
            const resDenom = denom1 * num2;
            const gcd = this.getGCD(resNum, resDenom);
            this.ans = (resNum / gcd) / (resDenom / gcd);
            document.getElementById('game-problem').innerText = `${num1}/${denom1} ÷ ${num2}/${denom2} = ?`;
        }
    } 
    else if (this.difficulty === 'medium') {
        // СРЕДНИЙ: дроби с разными знаменателями
        const operations = ['+', '-', '*', '/'];
        const op = operations[Math.floor(Math.random() * operations.length)];
        
        if (op === '+' || op === '-') {
            // Сложение/вычитание с разными знаменателями
            const denom1 = [2, 3, 4, 5, 6][Math.floor(Math.random() * 5)];
            const denom2 = [2, 3, 4, 5, 6][Math.floor(Math.random() * 5)];
            let num1 = Math.floor(Math.random() * denom1) + 1;
            let num2 = Math.floor(Math.random() * denom2) + 1;
            
            // Приводим к общему знаменателю
            const commonDenom = denom1 * denom2;
            const newNum1 = num1 * denom2;
            const newNum2 = num2 * denom1;
            
            if (op === '+') {
                const resNum = newNum1 + newNum2;
                const gcd = this.getGCD(resNum, commonDenom);
                this.ans = (resNum / gcd) / (commonDenom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom1} + ${num2}/${denom2} = ?`;
            } else {
                let resNum = newNum1 - newNum2;
                if (resNum < 0) {
                    // Меняем местами, чтобы результат был положительным
                    [num1, denom1, num2, denom2] = [num2, denom2, num1, denom1];
                    resNum = -resNum;
                }
                const gcd = this.getGCD(resNum, commonDenom);
                this.ans = resNum === 0 ? 0 : (resNum / gcd) / (commonDenom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom1} - ${num2}/${denom2} = ?`;
            }
        } else if (op === '*') {
            // Умножение дробей
            const num1 = Math.floor(Math.random() * 5) + 1;
            const denom1 = Math.floor(Math.random() * 6) + 2;
            const num2 = Math.floor(Math.random() * 4) + 1;
            const denom2 = Math.floor(Math.random() * 5) + 2;
            
            const resNum = num1 * num2;
            const resDenom = denom1 * denom2;
            const gcd = this.getGCD(resNum, resDenom);
            this.ans = (resNum / gcd) / (resDenom / gcd);
            document.getElementById('game-problem').innerText = `${num1}/${denom1} × ${num2}/${denom2} = ?`;
        } else {
            // Деление дробей
            const num1 = Math.floor(Math.random() * 4) + 1;
            const denom1 = Math.floor(Math.random() * 5) + 2;
            const num2 = Math.floor(Math.random() * 3) + 1;
            const denom2 = Math.floor(Math.random() * 4) + 2;
            
            const resNum = num1 * denom2;
            const resDenom = denom1 * num2;
            const gcd = this.getGCD(resNum, resDenom);
            this.ans = (resNum / gcd) / (resDenom / gcd);
            document.getElementById('game-problem').innerText = `${num1}/${denom1} ÷ ${num2}/${denom2} = ?`;
        }
    } 
    else {
        // СЛОЖНЫЙ: обычные дроби + десятичные
        const useDecimal = Math.random() < 0.5;
        
        if (useDecimal) {
            // Десятичные дроби
            const operations = ['+', '-', '*', '/'];
            const op = operations[Math.floor(Math.random() * operations.length)];
            
            const num1 = (Math.floor(Math.random() * 50) + 1) / 10; // от 0.1 до 5.0
            const num2 = (Math.floor(Math.random() * 50) + 1) / 10;
            
            if (op === '+') {
                this.ans = Math.round((num1 + num2) * 100) / 100;
                document.getElementById('game-problem').innerText = `${num1} + ${num2} = ?`;
            } else if (op === '-') {
                this.ans = Math.round((num1 - num2) * 100) / 100;
                document.getElementById('game-problem').innerText = `${num1} - ${num2} = ?`;
            } else if (op === '*') {
                this.ans = Math.round((num1 * num2) * 100) / 100;
                document.getElementById('game-problem').innerText = `${num1} × ${num2} = ?`;
            } else {
                this.ans = Math.round((num1 / num2) * 100) / 100;
                document.getElementById('game-problem').innerText = `${num1} ÷ ${num2} = ?`;
            }
        } else {
            // Сложные обычные дроби (как в среднем, но с большими числами)
            const operations = ['+', '-', '*', '/'];
            const op = operations[Math.floor(Math.random() * operations.length)];
            
            if (op === '+' || op === '-') {
                const denom1 = [3, 4, 5, 6, 7, 8][Math.floor(Math.random() * 6)];
                const denom2 = [3, 4, 5, 6, 7, 8][Math.floor(Math.random() * 6)];
                let num1 = Math.floor(Math.random() * denom1) + 1;
                let num2 = Math.floor(Math.random() * denom2) + 1;
                
                const commonDenom = denom1 * denom2;
                const newNum1 = num1 * denom2;
                const newNum2 = num2 * denom1;
                
                if (op === '+') {
                    const resNum = newNum1 + newNum2;
                    const gcd = this.getGCD(resNum, commonDenom);
                    this.ans = (resNum / gcd) / (commonDenom / gcd);
                    document.getElementById('game-problem').innerText = `${num1}/${denom1} + ${num2}/${denom2} = ?`;
                } else {
                    let resNum = newNum1 - newNum2;
                    if (resNum < 0) {
                        [num1, denom1, num2, denom2] = [num2, denom2, num1, denom1];
                        resNum = -resNum;
                    }
                    const gcd = this.getGCD(resNum, commonDenom);
                    this.ans = resNum === 0 ? 0 : (resNum / gcd) / (commonDenom / gcd);
                    document.getElementById('game-problem').innerText = `${num1}/${denom1} - ${num2}/${denom2} = ?`;
                }
            } else if (op === '*') {
                const num1 = Math.floor(Math.random() * 7) + 1;
                const denom1 = Math.floor(Math.random() * 8) + 2;
                const num2 = Math.floor(Math.random() * 6) + 1;
                const denom2 = Math.floor(Math.random() * 7) + 2;
                
                const resNum = num1 * num2;
                const resDenom = denom1 * denom2;
                const gcd = this.getGCD(resNum, resDenom);
                this.ans = (resNum / gcd) / (resDenom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom1} × ${num2}/${denom2} = ?`;
            } else {
                const num1 = Math.floor(Math.random() * 6) + 1;
                const denom1 = Math.floor(Math.random() * 7) + 2;
                const num2 = Math.floor(Math.random() * 5) + 1;
                const denom2 = Math.floor(Math.random() * 6) + 2;
                
                const resNum = num1 * denom2;
                const resDenom = denom1 * num2;
                const gcd = this.getGCD(resNum, resDenom);
                this.ans = (resNum / gcd) / (resDenom / gcd);
                document.getElementById('game-problem').innerText = `${num1}/${denom1} ÷ ${num2}/${denom2} = ?`;
            }
        }
    }
    
    document.getElementById('game-input').value = '';
}

            // --- 4. РЕЖИМ: ПРОЦЕНТЫ 📊 ---
            else if (this.mode === 'percent') {
                if (this.difficulty === 'easy') {
                    // ЛЕГКИЙ: «X% от Y = ?»
                    const percents = [10, 20, 25, 50, 75];
                    const p = percents[Math.floor(Math.random() * percents.length)];
                    const base = [100, 200, 40, 60, 80, 120, 200, 500][Math.floor(Math.random() * 8)];
                    this.ans = (p / 100) * base;
                    document.getElementById('game-problem').innerText = `${p}% от ${base} = ?`;
                }
                else if (this.difficulty === 'medium') {
                    // СРЕДНИЙ: «X% от Y = ?» + «A — это сколько % от B» + обратные задачи
                    const type = Math.random() < 0.5 ? 'findValue' : 'findPercent';
                    
                    if (type === 'findValue') {
                        // «30% от 180 = ?»
                        const p = Math.floor(Math.random() * 45) + 5; // 5-49%
                        const base = Math.floor(Math.random() * 20 + 2) * 10; // 20-210, кратно 10
                        this.ans = Math.round((p / 100) * base * 100) / 100;
                        document.getElementById('game-problem').innerText = `${p}% от ${base} = ?`;
                    } else {
                        // «45 из 180 — это сколько %?»
                        const base = [80, 100, 120, 150, 200, 250][Math.floor(Math.random() * 6)];
                        const p = Math.floor(Math.random() * 40) + 10; // 10-49%
                        const part = Math.round(base * p / 100);
                        this.ans = Math.round((part / base) * 100 * 10) / 10;
                        document.getElementById('game-problem').innerText = `${part} из ${base} — это сколько %?`;
                    }
                }
                else {
                    // СЛОЖНЫЙ: «X% от Y = Z, найти Y» + «если X выросло на N%...»
                    const type = Math.floor(Math.random() * 3);
                    
                    if (type === 0) {
                        // «25% числа равно 50. Найди число»
                        const p = [10, 15, 20, 25, 30, 40, 50][Math.floor(Math.random() * 7)];
                        const result = Math.floor(Math.random() * 40 + 5) * 10;
                        this.ans = Math.round(result / (p / 100));
                        document.getElementById('game-problem').innerText = `${p}% числа равно ${result}. Найди число`;
                    } else if (type === 1) {
                        // «Цена выросла на 20%. Было 500. Стало?»
                        const p = [10, 15, 20, 25, 30, 50][Math.floor(Math.random() * 6)];
                        const base = Math.floor(Math.random() * 50 + 10) * 10;
                        this.ans = Math.round(base * (1 + p / 100));
                        document.getElementById('game-problem').innerText = `Цена выросла на ${p}%. Было ${base}. Стало?`;
                    } else {
                        // «Скидка 30%. Цена стала 350. Какова была?»
                        const p = [10, 15, 20, 25, 30, 40][Math.floor(Math.random() * 6)];
                        const newPrice = Math.floor(Math.random() * 40 + 10) * 10;
                        this.ans = Math.round(newPrice / (1 - p / 100));
                        document.getElementById('game-problem').innerText = `Скидка ${p}%. Цена стала ${newPrice}. Какова была?`;
                    }
                }
            }

            // --- 5. РЕЖИМ: ФСУ (Формулы сокращённого умножения) 🧮 ---
            else if (this.mode === 'fsu') {
                // Коэффициенты для загадывания: a/b — числа, k — множитель перед x
                // Задача: «(kx ± a)² раскрой. Введи коэффициент при x» — ответ ka² и т.п.
                if (this.difficulty === 'easy') {
                    // ЛЕГКИЙ: (x ± a)² → коэффициент при x (2a)
                    const type = Math.random() < 0.5 ? 'sq' : 'sqSum';
                    const a = Math.floor(Math.random() * 9) + 2; // 2-10

                    if (type === 'sq') {
                        const sign = Math.random() < 0.5 ? '+' : '-';
                        this.ans = 2 * a;
                        document.getElementById('game-problem').innerText = `(x ${sign} ${a})² = x² ± ?x + ${a*a}. ? =`;
                    } else {
                        // (x + a)(x - a) = x² - ?
                        this.ans = a * a;
                        document.getElementById('game-problem').innerText = `(x + ${a})(x - ${a}) = x² - ?. ? =`;
                    }
                }
                else if (this.difficulty === 'medium') {
                    // СРЕДНИЙ: логические задачи на формулы (без подстановки чисел)
                    const type = Math.floor(Math.random() * 4);
                    const a = Math.floor(Math.random() * 8) + 2; // 2-9
                    const b = Math.floor(Math.random() * 8) + 2;

                    if (type === 0) {
                        // Коэффициент при x в (x+a)(x+b) → a+b
                        this.ans = a + b;
                        document.getElementById('game-problem').innerText = `(x + ${a})(x + ${b}) = x² + ?x + ${a*b}. ? =`;
                    } else if (type === 1) {
                        // (x - a)(x - b) = x² - (a+b)x + ab → коэффициент при x (a+b), всегда положительный
                        this.ans = a + b;
                        document.getElementById('game-problem').innerText = `(x - ${a})(x - ${b}) = x² - ?x + ${a*b}. ? =`;
                    } else if (type === 2) {
                        // (a + b)² = a² + 2ab + b² → коэффициент при a равен 2b
                        this.ans = 2 * b;
                        document.getElementById('game-problem').innerText = `(a + ${b})² = a² + ?a + ${b*b}. ? =`;
                    } else {
                        // Обратная логика: x² + 12x + 36 = (x + ?)²
                        // a² = last, 2a = middle → a = last^(1/2)
                        const sq = [2,3,4,5,6,7,8,9][Math.floor(Math.random() * 8)];
                        this.ans = sq;
                        document.getElementById('game-problem').innerText = `x² + ${2*sq}x + ${sq*sq} = (x + ?)². ? =`;
                    }
                }
                else {
                    // СЛОЖНЫЙ: формулы 3-й степени + сложная логика (без подстановки)
                    const type = Math.floor(Math.random() * 5);
                    const a = Math.floor(Math.random() * 6) + 2; // 2-7
                    const k = [2, 3, 4][Math.floor(Math.random() * 3)];

                    if (type === 0) {
                        // Куб суммы: (x+a)³ = x³ + 3a·x² + 3a²·x + a³ → коэффициент при x²
                        this.ans = 3 * a;
                        document.getElementById('game-problem').innerText = `(x + ${a})³ = x³ + ?x² + ... . ? =`;
                    } else if (type === 1) {
                        // Куб разности: (x-a)³ = x³ - 3a·x² + 3a²·x - a³ → последний член a³
                        this.ans = a * a * a;
                        document.getElementById('game-problem').innerText = `(x - ${a})³ = x³ - ${3*a}x² + ... - ?. Последний ? =`;
                    } else if (type === 2) {
                        // (kx + m)(kx - m) = k²x² - m² → свободный член m²
                        const m = Math.floor(Math.random() * 6) + 2;
                        this.ans = m * m;
                        document.getElementById('game-problem').innerText = `(${k}x + ${m})(${k}x - ${m}) = ${k*k}x² - ?. ? =`;
                    } else if (type === 3) {
                        // Обратная куб-формула: x³ + 6x² + 12x + 8 = (x + ?)³ → 3a=6 → a=2, a³=8
                        const c = Math.floor(Math.random() * 4) + 2; // 2-5
                        this.ans = c;
                        document.getElementById('game-problem').innerText = `x³ + ${3*c}x² + ${3*c*c}x + ${c*c*c} = (x + ?)³. ? =`;
                    } else {
                        // Сумма кубов: a³ + b³ = (a+b)(a² - ab + b²) → коэффициент при ab всегда 1
                        this.ans = 1;
                        document.getElementById('game-problem').innerText = `Сумма кубов: a³ + b³ = (a + b)(a² - ?ab + b²). ? =`;
                    }
                }
                document.getElementById('game-input').value = '';
            }

            // --- 6. РЕЖИМ: КЛАССИКА 🔢 ---
            else {
                // Легко/Средне
                if (this.difficulty !== 'hard') {
                    let range = this.difficulty === 'easy' ? 20 : 50;
                    let multRange = this.difficulty === 'easy' ? 5 : 10;
                    let ops = this.difficulty === 'easy' ? ['+', '-'] : ['+', '-', '*'];
                    
                    const op = ops[Math.floor(Math.random() * ops.length)];
                    let a, b;

                    if (op === '*') {
                        a = Math.floor(Math.random() * multRange) + 2; 
                        b = Math.floor(Math.random() * multRange) + 2;
                    } else {
                        a = Math.floor(Math.random() * range) + 2;
                        b = Math.floor(Math.random() * range) + 2;
                    }

                    if(op === '+') this.ans = a + b; 
                    if(op === '-') this.ans = a - b; 
                    if(op === '*') this.ans = a * b;

                    let displayOp = op === '*' ? '×' : (op === '-' ? '−' : '+');
                    document.getElementById('game-problem').innerText = `${a} ${displayOp} ${b}`; 
                }
                // Сложно (с отрицательными и делением)
                else {
                    const ops = ['+', '-', '*', '/'];
                    const op = ops[Math.floor(Math.random() * ops.length)];
                    let limit = (op === '*' || op === '/') ? 12 : 30;
                    let absA = Math.floor(Math.random() * limit) + 1;
                    let absB = Math.floor(Math.random() * limit) + 1;
                    let signA = Math.random() < 0.5 ? -1 : 1; 
                    let signB = Math.random() < 0.5 ? -1 : 1;

                    if (op === '/') {
                        let res = Math.floor(Math.random() * 10) + 1;
                        let signRes = Math.random() < 0.5 ? -1 : 1;
                        absB = Math.floor(Math.random() * 10) + 2;
                        let bVal = absB * signB;
                        let resVal = res * signRes;
                        var a = bVal * resVal; var b = bVal;
                    } else {
                        var a = absA * signA; var b = absB * signB;
                    }

                    if (op === '+') this.ans = a + b;
                    if (op === '-') this.ans = a - b;
                    if (op === '*') this.ans = a * b;
                    if (op === '/') this.ans = a / b;

                    let displayB = b < 0 ? `(${b})` : b;
                    let displayOp = op === '*' ? '×' : (op === '/' ? '÷' : (op === '-' ? '−' : '+'));
                    document.getElementById('game-problem').innerText = `${a} ${displayOp} ${displayB}`;
                }
                document.getElementById('game-input').value = '';
            }
        },

        // --- ПРОВЕРКА ЧИСЕЛ (Классика/Квадраты) ---
        // --- ПРОВЕРКА ЧИСЕЛ (Классика/Степени/Дроби) ---
        check() {
            if (this.isLocked) return;
            const inputEl = document.getElementById('game-input');
            const userInput = inputEl.value.trim();
            if (!userInput) return;

            this.isLocked = true;
            
            let userAnswer;
            
            // Если режим "Дроби" и введена обычная дробь
            if (this.mode === 'fractions' && userInput.includes('/')) {
                const parts = userInput.split('/');
                if (parts.length !== 2) {
                    this.fail(inputEl);
                    return;
                }
                const num = parseInt(parts[0]);
                const denom = parseInt(parts[1]);
                if (isNaN(num) || isNaN(denom) || denom === 0) {
                    this.fail(inputEl);
                    return;
                }
                
                // Упрощаем введенную дробь
                const gcd = this.getGCD(num, denom);
                userAnswer = (num / gcd) / (denom / gcd);
            } 
            // Если режим "Дроби" или "Проценты" — десятичное число
            else if (this.mode === 'fractions' || this.mode === 'percent') {
                userAnswer = parseFloat(userInput);
                if (isNaN(userAnswer)) {
                    this.fail(inputEl);
                    return;
                }
            }
            // Для остальных режимов (Классика, Степени) - целое число
            else {
                userAnswer = parseInt(userInput);
                if (isNaN(userAnswer)) {
                    this.fail(inputEl);
                    return;
                }
            }
            
            // Сравниваем (для дробей/процентов - с точностью, для остальных - точно)
            let isCorrect;
            if (this.mode === 'fractions' || this.mode === 'percent') {
                const expected = Math.round(this.ans * 100) / 100;
                const answer = Math.round(userAnswer * 100) / 100;
                isCorrect = Math.abs(answer - expected) < 0.01;
            } else {
                isCorrect = (userAnswer === this.ans);
            }
            
            if (isCorrect) {
                this.success(inputEl);
            } else {
                this.fail(inputEl);
            }
        },

        // --- ПРОВЕРКА ЗНАКОВ (Найди знак) ---
        checkSign(sign) {
            if (this.isLocked) return; 
            this.isLocked = true;

            if(sign === this.correctSign) {
                this.success(document.getElementById('sign-area'));
            } else {
                this.fail(document.getElementById('sign-area'));
            }
        },

        // --- УСПЕХ ---
    success(el) {
        this.score++; 
        DB.user.lifetimeMathSolved = (DB.user.lifetimeMathSolved || 0) + 1;
        document.getElementById('game-score').innerText = this.score; 
        QuestSys.update('mathSolved', 1);
        WeeklyQuestSys.update('mathSolved', 1);

        // === BATTLE ANIMATION ===
        if (this.isDuel) {
            // ⚔️ Звон меча при ударе
            SoundSys.play('sword');
            if (navigator.vibrate) navigator.vibrate(50);
            
            // Обновляем счёт в Battle HUD
            const myScoreEl = document.getElementById('battle-me-score');
            myScoreEl.textContent = this.score;
            myScoreEl.classList.remove('pop');
            void myScoreEl.offsetWidth;
            myScoreEl.classList.add('pop');
            
            // HP соперника уменьшается
            const rivalHP = Math.max(0, 100 - (this.score * 10));
            document.getElementById('battle-rival-hp').style.width = rivalHP + '%';
            
            // Flash атаки (фиолетовый)
            const flash = document.getElementById('battle-flash');
            flash.className = 'battle-flash me-attack show';
            setTimeout(() => flash.className = 'battle-flash', 500);
            
            // Пузырёк урона
            const problemBox = document.getElementById('problem-box');
            const popup = document.createElement('div');
            popup.className = 'battle-dmg-popup damage';
            popup.textContent = '-10 HP';
            popup.style.left = '50%';
            popup.style.top = '-5px';
            problemBox.style.position = 'relative';
            problemBox.appendChild(popup);
            setTimeout(() => popup.remove(), 800);
            
            // Тряска экрана
            const card = document.getElementById('trainer-game');
            card.classList.remove('battle-shake');
            void card.offsetWidth;
            card.classList.add('battle-shake');
            
            // Отправляем свой счёт в Firebase
            if (this.pvpCode && window.DB_Online) {
                const docRef = window.DB_Online.doc(window.DB_Online.db, 'battles_v2', this.pvpCode);
                const upd = {};
                upd[`${this.pvpRole}_score`] = this.score;
                window.DB_Online.updateDoc(docRef, upd).catch(() => {});
            }
        }

        // Подсвечиваем рамку, если элемент существует
        if (el && el.style) el.style.borderColor = 'var(--success)'; 
        
        // Переход к следующему вопросу
        setTimeout(() => {
            if (el && el.style) el.style.borderColor = ''; 
            this.nextProblem(); 
            this.unlockControls(); // Разблокируем ввод
        }, 200);

        // 🛡️ АВАРИЙНАЯ РАЗБЛОКИРОВКА (если через 1 сек всё еще висит)
        setTimeout(() => {
            if (this.isLocked) {
                console.log("⚠️ Сработала аварийная разблокировка (Success)");
                this.unlockControls();
            }
        }, 1000);
    },

    // --- УЛУЧШЕННАЯ ОШИБКА (БЕЗ ЗАВИСАНИЙ) ---
    fail(el) {
        SoundSys.play('error'); 
        if (el && el.classList) el.classList.add('error-shake');
        
        // Визуально блокируем кнопки
        document.getElementById('input-area').classList.add('input-locked');
        document.getElementById('sign-area').classList.add('input-locked');

        this.time -= 5;
        if (this.time < 0) this.time = 0;
        document.getElementById('game-time').innerText = this.time;

        // Штрафная разблокировка (1.2 секунды)
        setTimeout(() => {
            this.unlockControls(); 
        }, 1200);

        // 🛡️ АВАРИЙНАЯ РАЗБЛОКИРОВКА (если через 2 сек всё еще висит)
        setTimeout(() => {
            if (this.isLocked) {
                console.log("⚠️ Сработала аварийная разблокировка (Fail)");
                this.unlockControls();
            }
        }, 2000);
    },

        end() {
            clearInterval(this.interval); 
            document.getElementById('trainer-game').style.display = 'none'; 
            
            if (this.isDuel) {
                // ⚔️ В ДУЭЛИ — БЕЗ обычной награды (ставка/приз решают всё)
                // Убираем Battle HUD
                document.getElementById('battle-hud').classList.remove('active');
                document.getElementById('normal-stats').style.display = '';
                if (this._rivalScoreListener) { this._rivalScoreListener(); this._rivalScoreListener = null; }
                this.handleDuelEnd();
                this.isDuel = false;
                return; 
            }
            
            // Расчет награды (только обычная игра)
            let mult = (this.difficulty === 'hard') ? 10 : (this.difficulty === 'medium' ? 7 : 4);
            const earnedXP = this.score * mult; 

            let div = (this.difficulty === 'hard') ? 5 : (this.difficulty === 'medium' ? 7 : 5);
            const earnedCoins = Math.floor(this.score / div); 
            
            App.addXP(earnedXP);
            if(earnedCoins > 0) { 
                DB.user.coins += earnedCoins; 
            }

            // ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
            document.getElementById('trainer-result').style.display = 'block';
            document.getElementById('result-score').innerText = this.score; 
            document.getElementById('result-xp').innerText = `+${earnedXP} XP`; 
            document.getElementById('result-coins').innerText = `+${earnedCoins} 💰`;

            // Проверка рекорда
            if (!DB.user.trainerRecords[this.mode]) DB.user.trainerRecords[this.mode] = { easy:0, medium:0, hard:0 };
            const oldRec = DB.user.trainerRecords[this.mode][this.difficulty] || 0;

            if(this.score > oldRec) {
                DB.user.trainerRecords[this.mode][this.difficulty] = this.score;
                document.getElementById('result-title').innerText = "НОВЫЙ РЕКОРД! 🏆";
                FX.confetti(); 
            } else {
                document.getElementById('result-title').innerText = "Время вышло!";
            }

            Data.save(); 
            App.updateUI();
        },    
            

        pvpRole: null, 
        pvpCode: null,
        pvpListener: null,

        startPVP(role, code, bet, mode, diff) {
            this.pvpRole = role;
            this.pvpCode = code;
            this.duelBet = bet; 
            this.isDuel = true; 
            this._duelSettled = false; // 🛡️ сброс флага награды для нового боя
            
            this.mode = mode || 'standard';
            this.difficulty = diff || 'easy';

            App.toast(`⚔️ БОЙ НАЧАЛСЯ! Ставка: ${bet} 💰`);
            document.getElementById('battle-modal').classList.remove('show');
            
            // Показываем Battle HUD
            document.getElementById('battle-hud').classList.add('active');
            document.getElementById('normal-stats').style.display = 'none';
            
            // Устанавливаем аватарки и имена
            const myName = DB.user.name || 'Я';
            document.getElementById('battle-me-name').textContent = myName;
            document.getElementById('battle-me-avatar').textContent = DB.user.avatar || '😎';
            
            // Слушаем Firebase для обновления счёта соперника
            this._rivalScoreListener = null;
            this._prevRivalScore = 0;
            const docRef = window.DB_Online.doc(window.DB_Online.db, 'battles_v2', code);
            this._rivalScoreListener = window.DB_Online.onSnapshot(docRef, (docSnap) => {
                const data = docSnap.data();
                if (!data) return;
                const rivalScore = (role === 'p1') ? (data.p2_score || 0) : (data.p1_score || 0);
                const rivalName = (role === 'p1') ? (data.p2 || 'Соперник') : (data.p1 || 'Соперник');
                
                document.getElementById('battle-rival-score').textContent = rivalScore;
                document.getElementById('battle-rival-name').textContent = rivalName;
                
                // === АНИМАЦИЯ АТАКИ СОПЕРНИКА ===
                if (rivalScore > this._prevRivalScore) {
                    // 💥 Звук удара + вибрация
                    SoundSys.play('hit');
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    
                    // Score pop
                    const rivalScoreEl = document.getElementById('battle-rival-score');
                    rivalScoreEl.classList.remove('pop');
                    void rivalScoreEl.offsetWidth;
                    rivalScoreEl.classList.add('pop');
                    
                    // Красная вспышка по экрану
                    const flash = document.getElementById('battle-flash');
                    flash.className = 'battle-flash rival-attack show';
                    setTimeout(() => flash.className = 'battle-flash', 500);
                    
                    // Аватар игрока мигает (получает удар)
                    const myAvatar = document.getElementById('battle-me-avatar');
                    myAvatar.classList.remove('hit');
                    void myAvatar.offsetWidth;
                    myAvatar.classList.add('hit');
                    
                    // Пузырёк урона на моей стороне
                    const problemBox = document.getElementById('problem-box');
                    const popup = document.createElement('div');
                    popup.className = 'battle-dmg-popup damage';
                    popup.textContent = '-10 HP';
                    popup.style.left = '20%';
                    popup.style.top = '-5px';
                    problemBox.style.position = 'relative';
                    problemBox.appendChild(popup);
                    setTimeout(() => popup.remove(), 800);
                    
                    // Тряска экрана
                    const card = document.getElementById('trainer-game');
                    card.classList.remove('battle-shake');
                    void card.offsetWidth;
                    card.classList.add('battle-shake');
                }
                this._prevRivalScore = rivalScore;
                
                // HP: каждое очко соперника = -10% HP игрока
                const myHP = Math.max(0, 100 - (this.score * 10));
                const rivalHP = Math.max(0, 100 - (rivalScore * 10));
                document.getElementById('battle-me-hp').style.width = myHP + '%';
                document.getElementById('battle-rival-hp').style.width = rivalHP + '%';
            });
            
            this.start(); 
        },

        // Эта функция вызывается из end(), если isDuel = true
        async handleDuelEnd() {
            const score = this.score;
            QuestSys.update('pvpDone', 1);
            DB.user.lastBattleTime = Date.now(); // Твой лимит 8 часов
            Data.save();

            document.getElementById('trainer-game').style.display = 'none';
            document.getElementById('trainer-result').style.display = 'block';
            document.getElementById('result-score').innerText = score;
            document.querySelector('#trainer-result h2').innerText = "Ждем соперника... ⏳";
            document.getElementById('result-coins').innerText = "Осталось: 120с";

            const docRef = window.DB_Online.doc(window.DB_Online.db, "battles_v2", this.pvpCode);
            
            // Отправляем свой счет
            const updateData = {};
            updateData[`${this.pvpRole}_score`] = score;
            try {
                await window.DB_Online.updateDoc(docRef, updateData);
            } catch (e) {
                console.error('Не удалось отправить счёт:', e);
            }

            // --- ТАЙМ-АУТ (ЗАЩИТА) ---
            let timeLeft = 120;
            const timeoutInterval = setInterval(() => {
                timeLeft--;
                document.getElementById('result-coins').innerText = `Осталось: ${timeLeft}с`;
                
                if (timeLeft <= 0) {
                    clearInterval(timeoutInterval);
                    if (this.pvpListener) this.pvpListener();
                    this.claimTechnicalWin(); // Функция технической победы
                }
            }, 1000);

            // Слушаем результат
            this.pvpListener = window.DB_Online.onSnapshot(docRef, (docSnap) => {
                const data = docSnap.data();
                if (!data) return;
                const my = this.pvpRole === 'p1' ? data.p1_score : data.p2_score;
                const opp = this.pvpRole === 'p1' ? data.p2_score : data.p1_score;
                // 🛡️ -1 = "ещё не сыграл". Ждём ОБА реальных счёта (0 — валидный счёт!)
                if (my !== -1 && opp !== -1) {
                    clearInterval(timeoutInterval);
                    this.finishPVP(data);
                }
            });
        },

        // Функция для тех. победы
        claimTechnicalWin() {
            // 🛡️ Защита от двойной выдачи награды
            if (this._duelSettled) return;
            this._duelSettled = true;
            
            alert("⚔️ Соперник не ответил! Ставка возвращена.");
            // 🛡️ Возврат ставки (а не Award: соперник мог просто выйти)
            DB.user.coins += this.duelBet; 

            document.querySelector('#trainer-result h2').innerText = "🤝 НИЧЬЯ (тех.)";
            document.getElementById('result-coins').innerText = "Соперник не закончил — ставка возвращена";
            Data.save();
            App.updateUI();
            
            const btn = document.querySelector('#trainer-result button');
            if (btn) {
                btn.innerText = "✓ Закрыть";
                btn.onclick = () => {
                    document.getElementById('trainer-result').style.display = 'none';
                    Trainer.init();
                };
            }
        },

        // Финал: оба закончили
        finishPVP(data) {
            // 🛡️ Защита от двойной выдачи (two snapshots / timeout race)
            if (this._duelSettled) return;
            this._duelSettled = true;
            
            if (this.pvpListener) this.pvpListener();

            const myScore = (this.pvpRole === 'p1') ? data.p1_score : data.p2_score;
            const oppScore = (this.pvpRole === 'p1') ? data.p2_score : data.p1_score;
            const oppName = (this.pvpRole === 'p1') ? data.p2 : data.p1;

            let msg = "";
            let resultMsg = "";
            
            if (myScore > oppScore) {
                msg = "🏆 ПОБЕДА!";
                resultMsg = `Ты выиграл ${myScore} : ${oppScore}`;
                DB.user.coins += data.bet * 2; // 🛡️ своя ставка + ставка соперника
                DB.user.pvpWins = (DB.user.pvpWins || 0) + 1;
                SoundSys.play('win');
                FX.confetti();
            } else if (myScore < oppScore) {
                msg = "💀 ПОРАЖЕНИЕ";
                resultMsg = `Ты проиграл ${myScore} : ${oppScore}`;
                DB.user.pvpLosses = (DB.user.pvpLosses || 0) + 1;
                SoundSys.play('error');
            } else {
                msg = "🤝 НИЧЬЯ";
                resultMsg = `Счёт равный ${myScore} : ${oppScore}`;
                DB.user.coins += data.bet; // Возвращаем свою ставку
            }

            document.querySelector('#trainer-result h2').innerText = msg;
            document.getElementById('result-score').innerText = myScore; // Твой счёт
            document.getElementById('result-xp').innerText = resultMsg; // Результат
            document.getElementById('result-coins').innerText = `Соперник: ${oppName}`; // Имя соперника
            
            const btn = document.querySelector('#trainer-result button');
            btn.innerText = "✓ Закрыть";
            btn.onclick = () => {
                document.getElementById('trainer-result').style.display = 'none';
                Trainer.init(); // Возврат в меню тренажера
            };
            
            Data.save();
            App.updateUI();
        },

        unlockControls() {
        this.isLocked = false; // Открываем замок
        
        // Убираем все красные рамки и тряску
        document.querySelectorAll('.error-shake').forEach(el => el.classList.remove('error-shake'));
        
        // Убираем визуальную блокировку (серый фон)
        const inputArea = document.getElementById('input-area');
        const signArea = document.getElementById('sign-area');
        if (inputArea) inputArea.classList.remove('input-locked');
        if (signArea) signArea.classList.remove('input-locked');
        
        // Очищаем поле и возвращаем фокус
        const input = document.getElementById('game-input');
        if (this.mode !== 'sign' && input) {
            input.value = ''; // Очищаем старый ответ
            this._updateNumpadDisplay(); // Обновляем дисплей нумпада
        }
    },
        // Вспомогательная функция: наибольший общий делитель (НОД)
        // Вспомогательная функция: наибольший общий делитель
        getGCD(a, b) {
            a = Math.abs(a);
            b = Math.abs(b);
            while (b) {
                let temp = b;
                b = a % b;
                a = temp;
            }
            return a;
        }
    };

    const AchievementSys = {
        check() {
            if (!DB || !DB.achievements) return;
            let changed = false;
            const now = new Date();
            const hour = now.getHours();

            DB.achievements.forEach(a => {
                if (a.unlocked) return;

                let currentVal = 0;
                switch(a.type) {
                    case 'total':       currentVal = DB.user.totalSec; break;
                    case 'lvl':         currentVal = DB.user.level; break;
                    case 'xp':          currentVal = DB.user.lifetimeXP || DB.user.xp; break;
                    case 'streak':      currentVal = DB.user.dailyStreak || 0; break;
                    case 'coins_max':   currentVal = DB.user.coins; break;
                    case 'coins_spent': currentVal = DB.user.lifetimeCoinsSpent || 0; break;
                    case 'strict_time': currentVal = DB.user.lifetimeStrictSec || 0; break;
                    case 'pvp_wins':    currentVal = DB.user.pvpWins || 0; break;
                    case 'math_total':  currentVal = DB.user.lifetimeMathSolved || 0; break;
                    case 'themes_count':  currentVal = DB.user.ownedThemes ? DB.user.ownedThemes.length : 0; break;
                    case 'avatars_count': currentVal = DB.user.ownedAvatars ? DB.user.ownedAvatars.length : 0; break;
                    case 'strict_sessions': currentVal = DB.user.lifetimeStrictSessions || 0; break;
                    case 'quests_done':  currentVal = DB.user.lifetimeQuestsDone || 0; break;
                    case 'perfect_days': currentVal = DB.user.lifetimePerfectDays || 0; break;
                    case 'daily_claims': currentVal = DB.user.lifetimeDailyClaims || 0; break;
                    case 'parent_mode':  currentVal = DB.user.visitedParentMode ? 1 : 0; break;
                    case 'multi_subject': currentVal = DB.user.multiSubjectSession ? 1 : 0; break;
                    case 'month_minutes': currentVal = DB.user.currentMonthSec || 0; break;
                    
                    // Проверки по времени суток (если таймер активен)
                    case 'night_study': 
                        if (Timer.active && (hour >= 22 || hour < 4)) currentVal = 1; break;
                    case 'morning_study': 
                        if (Timer.active && (hour >= 5 && hour <= 8)) currentVal = 1; break;
                    case 'lunch_study': 
                        if (Timer.active && hour === 14) currentVal = 1; break;
                    case 'midnight_study':
                        if (Timer.active && hour === 0) currentVal = 1; break;
                }

                if (currentVal >= a.max) {
                    a.unlocked = true;
                    changed = true;
                    App.toast(`🏅 Медаль: ${a.title}`);
                    SoundSys.play('level_up'); 
                    FX.confetti();
                }
            });

            if (changed) Data.save();
        },
    };
    const WeeklyReportSys = {
        check() {
            if (!DB || !DB.achievements) return;
            let changed = false;
            const now = new Date();
            const hour = now.getHours();

            DB.achievements.forEach(a => {
                if (a.unlocked) return;

                let currentVal = 0;
                switch(a.type) {
                    case 'total': currentVal = DB.user.totalSec; break;
                    case 'lvl': currentVal = DB.user.level; break;
                    case 'streak': currentVal = DB.user.dailyStreak; break;
                    case 'pvp_wins': currentVal = DB.user.pvpWins || 0; break;
                    case 'math_total': currentVal = DB.user.lifetimeMathSolved || 0; break;
                    case 'themes_count': currentVal = (DB.user.ownedThemes || []).length; break;
                    case 'radios_count': currentVal = (DB.user.ownedRadios || []).length; break;
                    case 'avatars_count': currentVal = (DB.user.ownedAvatars || []).length; break;
                    case 'coins_max': currentVal = DB.user.coins; break;
                    case 'morning_study': if (Timer.active && (hour >= 6 && hour <= 8)) currentVal = 1; break;
                    case 'night_study': if (Timer.active && (hour >= 23 || hour < 4)) currentVal = 1; break;
                }

                if (currentVal >= a.max) {
                    a.unlocked = true;
                    changed = true;
                    App.toast(`🏅 Награда: ${a.title}`);
                    SoundSys.play('level_up'); 
                    FX.confetti();
                }
            });
            if (changed) Data.save();
        },

        show() {
            // 1. Считаем время за последние 7 дней (Пн-Вс)
            let totalSec = 0;
            let subjectsTime = {};
            
            for (let i = 1; i <= 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = getUZDate(d);
                const s = DB.history[key] || 0;
                totalSec += s;
            }

            // 2. Ищем самый популярный предмет в сессиях за неделю
            DB.sessions.forEach(sess => {
                const sessDate = new Date(sess.date);
                const diffDays = (new Date() - sessDate) / (1000 * 60 * 60 * 24);
                if (diffDays <= 7) {
                    subjectsTime[sess.subject] = (subjectsTime[sess.subject] || 0) + sess.sec;
                }
            });

            let topSubject = "—";
            let maxS = 0;
            for (let name in subjectsTime) {
                if (subjectsTime[name] > maxS) {
                    maxS = subjectsTime[name];
                    topSubject = name;
                }
            }

            // 3. Заполняем данными
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);

            document.getElementById('wr-time').innerText = `${h}ч ${m}м`;
            document.getElementById('wr-subject').innerText = topSubject;
            document.getElementById('wr-xp').innerText = `+${Math.floor(totalSec / 60 * 10)} XP`;

            // Показываем окно
            document.getElementById('weekly-modal').classList.add('show');
            
            // Запоминаем, что показали
            DB.user.lastWeeklyReportDate = getUZDate();
            Data.save();
            FX.confetti();
            SoundSys.play('win');
            // Громкий звук-уведомление
            SoundSys.play('quest_done'); 
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);

        }
    };
