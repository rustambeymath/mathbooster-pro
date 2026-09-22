
    /* ==========================================
    0. FX SYSTEM
    ========================================== */
    const FX = {
        floatText(x, y, text, color) {
            const el = document.createElement('div'); 
            el.className = 'float-text';
            // Улучшаем стиль вылетающего текста
            el.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                color: ${color || '#FFD700'};
                font-weight: 900;
                font-size: 24px;
                pointer-events: none;
                z-index: 9999;
                text-shadow: 0 4px 10px rgba(0,0,0,0.2);
                transition: all 1s ease-out;
            `;
            el.innerText = text;
            document.body.appendChild(el);

            // Запускаем анимацию через requestAnimationFrame
            requestAnimationFrame(() => {
                el.style.transform = `translateY(-100px) scale(1.5) rotate(${Math.random() * 20 - 10}deg)`;
                el.style.opacity = '0';
            });

            setTimeout(() => el.remove(), 1000);
        },
        confetti() {
            const colors = ['#FFD700', '#FF7675', '#6C63FF', '#00d26a', '#ffffff'];
            for(let i=0; i<100; i++) { // Увеличиваем количество до 100
                const el = document.createElement('div'); 
                el.className = 'confetti-piece';
                el.style.cssText = `
                    position: fixed;
                    width: ${Math.random() * 10 + 5}px;
                    height: ${Math.random() * 10 + 5}px;
                    background: ${colors[Math.floor(Math.random()*colors.length)]};
                    left: ${Math.random() * 100}vw;
                    top: -10px;
                    opacity: ${Math.random()};
                    z-index: 99999;
                    pointer-events: none;
                    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                    animation: fall ${Math.random() * 3 + 2}s linear forwards;
                `;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 5000);
            }
        }
    };

    /* ==========================================
    0. PWA & SOUND
    ========================================== */
    const PWA = {
        prompt: null,
        init() {
            window.addEventListener('beforeinstallprompt', (e) => {
                // Блокируем системный всплывающий баннер (отсюда и идет предупреждение в консоли - это нормально)
                e.preventDefault(); 
                this.prompt = e;
                
                // Показываем вашу красивую карточку установки
                const installCard = document.getElementById('install-promo-card');
                if (installCard) installCard.style.display = 'block';
            });
        },
        install() {
            if(this.prompt) {
                this.prompt.prompt(); // Вызываем системное окно установки Android/Chrome
                this.prompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        const installCard = document.getElementById('install-promo-card');
                        if (installCard) installCard.style.display = 'none'; 
                    }
                    this.prompt = null;
                });
            }
        }
    };
    const MusicPlayer = {
        playing: false,
        audio: null,
        
        init() { 
            this.audio = document.getElementById('lofi-stream'); 
            this.audio.addEventListener('ended', () => this.reset());
            this.audio.addEventListener('error', (e) => {
                App.toast("❌ Ошибка радио. Попробуйте позже.");
                this.reset();
            });
        },

        reset() {
            this.playing = false;
            const btn = document.getElementById('music-btn');
            const vis = document.getElementById('music-vis');
            if(btn) btn.innerText = "▶";
            if(vis) vis.style.opacity = "0";
        },

        toggle() {
            if (!this.audio) this.audio = document.getElementById('lofi-stream');
            const currentId = DB.user.currentRadio || (DB.user.ownedRadios ? DB.user.ownedRadios[0] : null);
            if (!currentId) return App.toast("Купите радио в магазине!");
            const station = SHOP_RADIOS.find(x => x.id === currentId);
            
            const btn = document.getElementById('music-btn');
            const vis = document.getElementById('music-vis');
            
            if(this.playing) {
                // ПАУЗА
                this.audio.pause(); this.playing = false;
                if(btn) btn.innerText = "▶"; 
                if(vis) vis.style.opacity = "0";
            } else {
                // ПЛЕЙ
                if (this.audio.src !== station.url) { this.audio.src = station.url; this.audio.load(); }
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    if(btn) btn.innerText = "⏳";
                    playPromise.then(_ => {
                        this.playing = true; 
                        if(btn) btn.innerText = "⏸"; 
                        if(vis) vis.style.opacity = "1";
                    }).catch(e => { 
                        App.toast("Ошибка потока 📻"); 
                        if(btn) btn.innerText = "▶"; 
                    });
                }
            }
        }
    };

    const SoundSys = {
    ctx: null, 
    enabled: true,
    lastPlayTime: {}, // ← ДОБАВИТЬ
    
    init() { 
        try { 
            const AudioContext = window.AudioContext || window.webkitAudioContext; 
            this.ctx = new AudioContext(); 
        } catch(e) {} 
    },
    
    toggleSFX(val) { 
        this.enabled = val; 
        DB.settings.sfx = val; 
        Data.save(); 
        if(val) this.play('click'); 
    },
    
    play(type) {
        if(!this.enabled || !this.ctx) return; 
        if(this.ctx.state === 'suspended') this.ctx.resume();
        
        // 🔒 ЗАЩИТА ОТ СПАМА (минимум 50мс между одинаковыми звуками)
        const now = Date.now();
        if (this.lastPlayTime[type] && now - this.lastPlayTime[type] < 50) {
            return; // Игнорируем слишком частые вызовы
        }
        this.lastPlayTime[type] = now;
        
        const t = this.ctx.currentTime; 
        const osc = this.ctx.createOscillator(); 
        const gain = this.ctx.createGain();
        
        osc.connect(gain); 
        gain.connect(this.ctx.destination);

        const pack = (DB && DB.user && DB.user.soundPack) ? DB.user.soundPack : 'standard';

        if (type === 'quest_done') {
            [523, 659, 783, 1046].forEach((f, i) => {
                this.beep(f, t + i * 0.1, 0.1);
            });
            return;
        }

        if (type === 'level_up') {
            [523, 523, 523, 1046].forEach((f, i) => {
                this.beep(f, t + i * 0.15, i === 3 ? 0.5 : 0.1);
            });
            return;
        }
        
        // --- 🕹️ 8-BIT (РЕТРО) ---
        if (pack === 'retro') {
            osc.type = 'square'; 
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

            if (type === 'click') { osc.frequency.setValueAtTime(440, t); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'coin')  { osc.frequency.setValueAtTime(900, t); osc.frequency.linearRampToValueAtTime(1800, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'success') { osc.frequency.setValueAtTime(500, t); osc.frequency.setValueAtTime(1000, t+0.1); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'error') { osc.frequency.setValueAtTime(150, t); osc.frequency.linearRampToValueAtTime(50, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'win')   { osc.frequency.setValueAtTime(500, t); osc.frequency.linearRampToValueAtTime(1500, t+0.3); osc.start(t); osc.stop(t+0.3); }
            else if (type === 'sword') { osc.frequency.setValueAtTime(1200, t); osc.frequency.linearRampToValueAtTime(600, t+0.1); osc.start(t); osc.stop(t+0.15); }
            else if (type === 'hit') { osc.frequency.setValueAtTime(100, t); osc.frequency.linearRampToValueAtTime(40, t+0.1); osc.start(t); osc.stop(t+0.15); }
            else if (type === 'critical') { osc.frequency.setValueAtTime(1500, t); osc.frequency.linearRampToValueAtTime(100, t+0.2); osc.start(t); osc.stop(t+0.2); }
        }
        
        // --- 🧼 BUBBLE (БУЛЬК) ---
        else if (pack === 'bubble') {
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.15);

            if (type === 'click') { osc.frequency.setValueAtTime(300, t); osc.frequency.linearRampToValueAtTime(600, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'coin')  { osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(1200, t+0.15); osc.start(t); osc.stop(t+0.15); }
            else { osc.frequency.setValueAtTime(400, t); osc.start(t); osc.stop(t+0.1); }
        }

        // --- 🚀 SCI-FI (КОСМОС) ---
        else if (pack === 'sci-fi') {
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

            if (type === 'click') { osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'sword') { osc.type = 'square'; osc.frequency.setValueAtTime(3000, t); osc.frequency.exponentialRampToValueAtTime(500, t+0.15); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'hit') { osc.type = 'sine'; osc.frequency.setValueAtTime(80, t); osc.frequency.linearRampToValueAtTime(30, t+0.2); gain.gain.setValueAtTime(0.15, t); gain.gain.linearRampToValueAtTime(0, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'critical') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(5000, t); osc.frequency.exponentialRampToValueAtTime(100, t+0.25); gain.gain.setValueAtTime(0.05, t); gain.gain.exponentialRampToValueAtTime(0.001, t+0.3); osc.start(t); osc.stop(t+0.3); }
            else { osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(800, t+0.3); osc.start(t); osc.stop(t+0.3); }
        }

        else if (pack === 'mechanical') {
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.1, t);
            if (type === 'click') { 
                osc.frequency.setValueAtTime(150, t); 
                osc.start(t); osc.stop(t+0.05); 
            } else if (type === 'sword') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, t); osc.frequency.linearRampToValueAtTime(400, t+0.1); gain.gain.setValueAtTime(0.08, t); gain.gain.linearRampToValueAtTime(0, t+0.12); osc.start(t); osc.stop(t+0.12);
            } else if (type === 'hit') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(100, t); osc.frequency.linearRampToValueAtTime(50, t+0.15); gain.gain.setValueAtTime(0.12, t); gain.gain.linearRampToValueAtTime(0, t+0.15); osc.start(t); osc.stop(t+0.15);
            } else if (type === 'critical') {
                osc.type = 'square'; osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(100, t+0.2); gain.gain.setValueAtTime(0.06, t); gain.gain.linearRampToValueAtTime(0, t+0.2); osc.start(t); osc.stop(t+0.2);
            } else { 
                osc.frequency.setValueAtTime(300, t); 
                osc.start(t); osc.stop(t+0.1); 
            }
        }
        
        // --- 💜 STANDARD (КЛАССИКА) ---
        else {
            if(type === 'click') { 
                osc.type = 'sine'; 
                osc.frequency.setValueAtTime(800, t); 
                osc.frequency.exponentialRampToValueAtTime(1200, t+0.1); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.1); 
                osc.start(t); 
                osc.stop(t+0.1); 
            }
            else if(type === 'coin') { 
                osc.type = 'sine'; 
                osc.frequency.setValueAtTime(1200, t); 
                osc.frequency.exponentialRampToValueAtTime(1800, t+0.3); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.linearRampToValueAtTime(0, t+0.5); 
                osc.start(t); 
                osc.stop(t+0.5); 
            }
            else if(type === 'success') { 
                this.beep(523.25, t, 0.1); 
                this.beep(659.25, t+0.1, 0.1); 
                this.beep(783.99, t+0.2, 0.2); 
            }
            else if(type === 'error') { 
                osc.type = 'sawtooth'; 
                osc.frequency.setValueAtTime(150, t); 
                osc.frequency.linearRampToValueAtTime(100, t+0.3); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.linearRampToValueAtTime(0, t+0.3); 
                osc.start(t); 
                osc.stop(t+0.3); 
            }            else if(type === 'win') { 
                this.beep(523.25, t, 0.15); 
                this.beep(523.25, t+0.15, 0.15); 
                this.beep(523.25, t+0.30, 0.15); 
                this.beep(659.25, t+0.45, 0.4); 
            }
            else if(type === 'sword') {
                // ⚔️ Звон меча — резкий металлический звук
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(1800, t);
                osc.frequency.exponentialRampToValueAtTime(800, t+0.08);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.15);
                osc.start(t); osc.stop(t+0.15);
                // Второй тон — эхо металла
                this.beep(2200, t+0.02, 0.06);
                this.beep(1200, t+0.05, 0.08);
            }
            else if(type === 'hit') {
                // 💥 Удар — глухой низкий звук
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.linearRampToValueAtTime(60, t+0.15);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.linearRampToValueAtTime(0, t+0.2);
                osc.start(t); osc.stop(t+0.2);
            }
            else if(type === 'critical') {
                // 🔥 Критический удар — комбо sword+hit
                osc.type = 'square';
                osc.frequency.setValueAtTime(2000, t);
                osc.frequency.exponentialRampToValueAtTime(200, t+0.15);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.2);
                osc.start(t); osc.stop(t+0.2);
                this.beep(100, t+0.05, 0.15);
            }

            }
    },
    
    // Вспомогательная функция для стандартных звуков
    beep(freq, time, dur) { 
        const osc = this.ctx.createOscillator(); 
        const gain = this.ctx.createGain(); 
        osc.connect(gain); 
        gain.connect(this.ctx.destination); 
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(freq, time); 
        gain.gain.setValueAtTime(0.1, time); 
        gain.gain.linearRampToValueAtTime(0, time+dur); 
        osc.start(time); 
        osc.stop(time+dur); 
    }
};
    /* ==========================================
    1. DATA & CONFIG
    ========================================= */
    const GenAch = () => {
        const list = []; 
        let id = 1; 
        const add = (title, desc, max, icon, type, rarity = 'bronze') => 
            list.push({id: id++, title, desc, max, icon, type, rarity, unlocked: false});

        // --- Категория: ВРЕМЯ (Инвестиции в интеллект) ---
        add("Первый шаг", "1 минута учебы", 60, "🌱", "total", "bronze"); 
        add("Час силы", "1 час фокуса", 3600, "🕐", "total", "bronze"); 
        add("Глубокое погружение", "5 часов учебы", 18000, "🤿", "silver"); 
        add("Марафонец", "24 часа общего времени", 86400, "🏃", "silver"); 
        add("Ученый совет", "100 часов учебы", 360000, "🎓", "gold"); 
        add("Магистр времени", "500 часов учебы", 1800000, "🏛️", "gold"); 

        // --- Категория: ДИСЦИПЛИНА (Стрики) ---
        add("Три дня", "Держи стрик 3 дня", 3, "🔥", "streak", "bronze");
        add("Неделя в огне", "Держи стрик 7 дней", 7, "🔥", "streak", "silver");
        add("Две недели", "Держи стрик 14 дней", 14, "⚡", "streak", "silver");
        add("Железная воля", "Держи стрик 30 дней", 30, "🌋", "gold");
        add("Легендарный год", "Держи стрик 365 дней", 365, "👑", "gold");

        // --- Категория: ТРЕНАЖЕР И PVP ---
        add("Счетовод", "100 решенных примеров", 100, "🔢", "math_total", "bronze");
        add("Калькулятор", "1000 решенных примеров", 1000, "🤖", "math_total", "silver");
        add("Первая кровь", "Выиграй 1 дуэль", 1, "⚔️", "pvp_wins", "bronze");
        add("Гладиатор", "Выиграй 10 дуэлей", 10, "🗡️", "pvp_wins", "silver");
        add("Легенда Арены", "Выиграй 50 дуэлей", 50, "🏆", "pvp_wins", "gold");

        // --- Категория: МАГАЗИН И СТИЛЬ ---
        add("Стильный", "Купи 3 темы оформления", 3, "🎨", "themes_count", "bronze");
        add("Коллекционер", "Купи 10 тем оформления", 10, "🌈", "themes_count", "silver");
        add("Меломан", "Купи 3 радиостанции", 3, "📻", "radios_count", "bronze");
        add("Зоопарк", "Купи 5 аватарок", 5, "🐱", "avatars_count", "bronze");
        add("Богатей", "Накопи 5000 монет", 5000, "💰", "coins_max", "silver");

        // --- Категория: УРОВНИ ---
        add("Новичок", "Достигни 5 уровня", 5, "🐣", "lvl", "bronze");
        add("Мастер", "Достигни 25 уровня", 25, "🎖️", "lvl", "silver");
        add("Абсолют", "Достигни 50 уровня", 50, "👑", "lvl", "gold");        // --- Категория: ХАРДКОР ---
        add("Без пощады", "1 сессия в хардкоре", 1, "💪", "strict_sessions", "bronze");
        add("Безжалостный", "10 сессий в хардкоре", 10, "🔱", "strict_sessions", "silver");
        add("Бог смерти", "50 сессий в хардкоре", 50, "💀", "strict_sessions", "gold");

        // --- Категория: КВЕСТЫ ---
        add("Исполнитель", "Заверши 1 квест", 1, "✅", "quests_done", "bronze");
        add("Мастер квестов", "Заверши 50 квестов", 50, "📜", "quests_done", "silver");
        add("Безупречный", "Выполни все квесты за день 7 раз", 7, "⭐", "perfect_days", "gold");

        // --- Категория: ДИСЦИПЛИНА (исправленные) ---
        add("Ежедневник", "Забирай награду 7 дней подряд", 7, "📅", "daily_claims", "bronze");
        add("Регулярность", "Забирай награду 30 дней подряд", 30, "🗓️", "daily_claims", "silver");

        // --- Категория: СЕКРЕТНЫЕ ---
        add("Ранняя пташка", "Учись в 6-8 утра", 1, "☀️", "morning_study", "silver"); 
        add("Ночная сова", "Учись после 23:00", 1, "🦉", "night_study", "silver");
        add("Обеденный перерыв", "Учись ровно в 14:00", 1, "🍱", "lunch_study", "bronze");
        add("Полночный мудрец", "Учись ровно в 00:00", 1, "🌙", "midnight_study", "silver");
        add("Родитель", "Подключись в режиме родителя", 1, "👨‍👩‍👧", "parent_mode", "bronze");
        add("Полиглот", "Учись 3+ предмета за сессию", 1, "🌐", "multi_subject", "silver");
        add("Тысячник", "Заработай 10,000 монет", 10000, "🪙", "coins_max", "gold");

        // --- Категория: МАРАФОН ---
        add("1000 минут", "1000 минут за месяц", 60000, "⏱️", "month_minutes", "silver");
        add("Учёный semestre", "50 часов за месяц", 180000, "📚", "month_minutes", "gold");

        return list;
    };

    const DefaultDB = { 
        user: { 
            darkMode: false,
            xp: 0, level: 1, nextXp: 500, 
            totalSec: 0, subject: 'algebra', theme: 'standard', 
            avatar: '😎', gender: 'male', 
            coins: 0, streak: 0,
            lastStudyDate: null,
            lifetimeMathSolved: 0,
            pvpWins: 0,
            ownedRadios: [], // Список купленных станций
            currentRadio: null, // Какая станция выбрана сейчас 
            dailyStreak: 0, lastDailyClaim: null, 
            ownedThemes: ['standard'], ownedAvatars: [], 
            ownedTitles: [],
            timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent'), // Автоопределение по устройству; Ташкент — резерв
            currentTitle: null, // Если null, показываем Лигу
            lastSaveTime: 0,
            lifetimeStrictSec: 0,
            lifetimeCoinsSpent: 0,
            lifetimeStrictSessions: 0,
            lifetimeQuestsDone: 0,
            lifetimePerfectDays: 0,
            lifetimeDailyClaims: 0,
            visitedParentMode: false,
            multiSubjectSession: false,
            currentMonthSec: 0,
            ownedFrames: [],      // Купленные рамки
            currentFrame: null,   // Текущая рамка
            ownedSounds: ['standard'], // Купленные звуки
            soundPack: 'standard',     // Текущий пак
            trainerRecords: {
                standard: { easy: 0, medium: 0, hard: 0 },
                sign:     { easy: 0, medium: 0, hard: 0 },
                square:   { easy: 0, medium: 0, hard: 0 },
                fractions: { easy: 0, medium: 0, hard: 0 } 
            },
            usedCodes: [],
            lifetimeXP: 0,
            inventory: { shield: 0 },
            dailyQuests: { 
                date: "", studyMin: 0, mathSolved: 0, pvpDone: 0, claimed: [], 
                targets: { studyMin: 30, mathSolved: 20, pvpDone: 1 } 
            },
            weeklyQuest: {
                weekId: "", 
                progressSec: 0,
                targetSec: 28800, // Цель: 8 часов (8 * 3600)
                claimed: false
            }
        }, 

        settings: { 
            sfx: true,  
            notifications: false,
            notifyTime: "19:00" // Время по умолчанию
        },
        // Предметы
        subjects: { 
            algebra: {name:'Алгебра', icon:'✖️', sec:0}, 
            geometry: {name:'Геометрия', icon:'📐', sec:0},
            calculus: {name:'Мат. анализ', icon:'∫', sec:0},
            arithmetic: {name:'Арифметика', icon:'🔢', sec:0},
            combinatorics: {name:'Комбинаторика', icon:'🔀', sec:0},
            statistics: {name:'Статистика', icon:'📊', sec:0},
            trigonometry: {name:'Тригонометрия', icon:'📏', sec:0},
            stereometry: {name:'Стереометрия', icon:'🧊', sec:0}
        }, 
        history:{}, sessions:[], achievements:[] 
    };

    

    const THEMES = [
        // Бесплатные и Дешевые
        { id: 'standard', name: 'Стандарт', icon: '💜', price: 0 },
        { id: 'dark', name: 'Темная', icon: '🌙', price: 0 }, 
        
        // Новые Дневные (Легкие)
        { id: 'sakura', name: 'Сакура', icon: '🌸', price: 400 },
        { id: 'lemon', name: 'Лимон', icon: '🍋', price: 400 },

        // Стильные (Средние)
        { id: 'pantone', name: 'Персик', icon: '🍑', price: 500 },
        { id: 'bw', name: 'B & W', icon: '🏁', price: 500 },
        { id: 'forest', name: 'Лес', icon: '🌲', price: 600 },
        
        // Элитные
        { id: 'neon', name: 'Неон', icon: '🦄', price: 800 },
        { id: 'math', name: 'Алмаз', icon: '💎', price: 1000 },
        { id: 'gold', name: 'Золото', icon: '🥇', price: 1500 },
        
        // Легендарная
        { id: 'magma', name: 'MAGMA', icon: '🔥', price: 2500 },
        { id: 'joker', name: 'JOKER', icon: '🃏', price: 3000 },
        { id: 'platinum', name: 'PLATINUM', icon: '💿', price: 4000 },

        // КОСМИЧЕСКАЯ ТЕМА
        { id: 'galaxy', name: 'Галактика', icon: '🌌', price: 5000 },

        // 🌠 СЕВЕРНОЕ СИЯНИЕ
        { id: 'aurora', name: 'Аврора', icon: '🌠', price: 6000 },

        //    СЕКРЕТНАЯ ТЕМА
        { id: 'cyber', name: 'Матрица', icon: '💻', price: 8000 }

    ];

    const SHOP_AVATARS = [
        // 🐣 НАЧАЛЬНЫЕ (Нейтральные — видят все)
        { id: 'cat', icon: '🐱', name: 'Котик', price: 50 },
        { id: 'dog', icon: '🐶', name: 'Песель', price: 50 },
        { id: 'hamster', icon: '🐹', name: 'Хомяк', price: 50 },
        { id: 'panda', icon: '🐼', name: 'Панда', price: 200 },
        { id: 'robot', icon: '🤖', name: 'Робот', price: 200 },
        { id: 'fox', icon: '🦊', name: 'Лисичка', price: 75 },
        { id: 'frog', icon: '🐸', name: 'Лягушка', price: 75 },
        { id: 'octopus', icon: '🐙', name: 'Осьминог', price: 100 },
        { id: 'lion', icon: '🦁', name: 'Лев', price: 100 },

        // 👩‍🎓 ЖЕНСКИЕ (Только для девушек)
        { id: 'girl_student', icon: '👩‍🎓', name: 'Студентка', price: 100, gender: 'female' },
        { id: 'muslimah', icon: '🧕', name: 'Муслима', price: 150, gender: 'female' },
        { id: 'artist', icon: '👩‍🎨', name: 'Художница', price: 250, gender: 'female' },
        { id: 'supergirl', icon: '🦸‍♀️', name: 'Супергёрл', price: 350, gender: 'female' },
        { id: 'queen', icon: '👸', name: 'Королева', price: 1000, gender: 'female' },
        { id: 'vampire_f', icon: '🧛‍♀️', name: 'Вампирша', price: 300, gender: 'female' },

        // 👨‍🎓 МУЖСКИЕ (Только для парней)
        { id: 'boy_student', icon: '👨‍🎓', name: 'Студент', price: 100, gender: 'male' },
        { id: 'brother', icon: '🧔', name: 'Бородач', price: 150, gender: 'male' },
        { id: 'gamer', icon: '🎧', name: 'Геймер', price: 100, gender: 'male' },
        { id: 'superman', icon: '🦸‍♂️', name: 'Супермен', price: 350, gender: 'male' },
        { id: 'wizard', icon: '🧙‍♂️', name: 'Волшебник', price: 450, gender: 'male' },
        { id: 'vampire_m', icon: '🧛', name: 'Вампир', price: 300, gender: 'male' },
        { id: 'gentleman', icon: '🤵', name: 'Джентльмен', price: 400, gender: 'male' },

        // 🔥 ЭПИЧЕСКИЕ (Нейтральные — видят все)
        { id: 'alien', icon: '👽', name: 'Пришелец', price: 300 },
        { id: 'skull', icon: '💀', name: 'Череп', price: 350 },
        { id: 'dragon', icon: '🐲', name: 'Дракон', price: 500 },
        { id: 'samurai', icon: '👺', name: 'Самурай', price: 600 },
        { id: 'unicorn', icon: '🦄', name: 'Единорог', price: 1200 },  
        { id: 'sigma', icon: '🗿', name: 'Сигма', price: 1500 },
        { id: 'diamond', icon: '💎', name: 'Магнат', price: 2000 },
        { id: 'ghost', icon: '👾', name: 'Призрак', price: 800 },
        { id: 'dragon2', icon: '🐉', name: 'Драконий', price: 1800 },
        { id: 'masks', icon: '🎭', name: 'Театр', price: 700 },
        { id: 'dna', icon: '🧬', name: 'ДНК', price: 1500 },
        { id: 'wolf', icon: '🐺', name: 'Альфа', price: 2500 },

        // 💀 ЛЕГЕНДАРНЫЕ
        { id: 'skeleton', icon: '☠️', name: 'Скелет', price: 3000 },
        { id: 'oracle', icon: '🔮', name: 'Оракул', price: 4000 },

        // 🚀 LEGENDARY (Для миллионеров)
        { id: 'hacker', icon: '🕵️‍♂️', name: 'Анонимус', price: 5000 },
        { id: 'joker', icon: '🤡', name: 'Джокер', price: 7500 },
        { id: 'elon', icon: '🚀', name: 'SpaceX', price: 10000 },
        { id: 'astronaut', icon: '👨‍🚀', name: 'Космонавт', price: 12000 },

        // 🌌 MYTHIC (Секретный уровень роскоши)
        { id: 'god', icon: '👁️', name: 'Абсолют', price: 15000 },
    ];

    const SHOP_ITEMS = [
        { id: 'shield', name: 'Щит Стрика', icon: '🛡️', price: 300, desc: 'Спасет твой огонь при пропуске дня' },
        { id: 'booster', name: 'XP Бустер', icon: '⚡', price: 500, desc: 'Двойной опыт (x2) на 24 часа' }
    ];

    const SHOP_TITLES = [
        { id: 'student', name: 'Ученик', price: 50 },
        { id: 'pro', name: 'PRO', price: 200 },
        { id: 'brain', name: 'Мегамозг 🧠', price: 300 },
        { id: 'zombie', name: '🧟 Зомби', price: 400 },
        { id: 'boss', name: 'Big Boss 😎', price: 500 },
        { id: 'coffee_addict', name: '☕ Кофеман', price: 500 },
        { id: 'hustler', name: '💪 Трудяга', price: 600 },
        { id: 'grinder', name: '⚡ Grinder', price: 800 },
        { id: 'overachiever', name: '📈 Сверхдостигатор', price: 1800 },
        { id: 'sigma', name: 'SIGMA 🗿', price: 1000 },
        { id: 'unstoppable', name: '🔥 Неудержимый', price: 1200 },
        { id: 'beast_mode', name: '🦁 Beast', price: 1500 },
        { id: 'perfectionist', name: '💎 Перфекционист', price: 1600 },
        { id: 'khan', name: 'ХАН ', price: 2000 },
        { id: 'future', name: 'Millionaire 💼', price: 5000 },
        { id: 'einstein', name: '👨‍🔬 Эйнштейн', price: 5000 },
        { id: 'immortal', name: '⚜️ Бессмертный', price: 8000 },
        
        // ЭКСКЛЮЗИВНЫЙ СТАТУС (уникальные id чтобы не дублировать обычные)
        { id: 'vip_excl', name: '💎 VIP', price: -1 },
        { id: 'pro_excl', name: '⭐ PRO', price: -1 },
        { id: 'legend', name: '👑 LEGEND', price: -1 }
    ,

        

    ];

    // 🖼️ РАМКИ
    const SHOP_FRAMES = [
        { id: 'gold', name: 'Золотая цепь', price: 500, css: 'frame-gold' },
        { id: 'glitch', name: 'Хакер', price: 2000, css: 'frame-glitch' },
        { id: 'neon', name: 'Неон', price: 3000, css: 'frame-neon' },
        { id: 'fire', name: 'Огонь 🔥', price: 4000, css: 'frame-fire' },
        { id: 'royal', name: 'Корона', price: 5000, css: 'frame-royal' },
        { id: 'titan', name: 'Титан 🌌', price: 10000, css: 'frame-titan' }
    ];

    // 🔊 ЗВУКИ (Синтезатор)
    const SHOP_SOUNDS = [
        { id: 'standard', name: 'Стандарт', price: 0 },
        { id: 'retro', name: '8-Bit (Денди)', price: 500 },
        { id: 'bubble', name: 'Бульк (Bubble)', price: 500 },
        { id: 'sci-fi', name: 'Космос', price: 1000 },
        { id: 'mechanical', name: 'Механика ⚙️', price: 1200 }
    ];
    // РАДИО
    const SHOP_RADIOS = [
        { id: 'lofi', name: 'Lo-Fi Chill', icon: '🎧', price: 100, url: 'https://lofi.stream.laut.fm/lofi' },
        { id: 'classic', name: 'Классика IQ', icon: '🎻', price: 300, url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128' },
        { id: 'jazz', name: 'Smooth Jazz 24/7', icon: '🎷', price: 250, url: 'https://jazz-wr01.ice.infomaniak.ch/jazz-wr01-128.mp3' },
        { id: 'nature', name: 'Nature Sounds', icon: '🌿', price: 200, url: 'https://stream.zeno.fm/0r0xa792kwzuv' },
        { id: 'electronic', name: 'Deep Focus', icon: '⚡', price: 400, url: 'https://ice1.somafm.com/deepspaceone-128-mp3' }
    ];
    // ЛИГИ 
    const LEAGUES = [
        { min: 1,  name: "🥉 Бронзовая Лига", color: "league-bronze" },
        { min: 5,  name: "🥈 Серебряная Лига", color: "league-silver" },
        { min: 10, name: "🥇 Золотая Лига", color: "league-gold" },
        { min: 20, name: "💠 Платиновая Лига", color: "league-platinum" },
        { min: 35, name: "💎 Алмазная Лига", color: "league-diamond" },
        { min: 50, name: "👑 Легендарная Лига", color: "league-legend" }
    ];


    // === 🏆 СИСТЕМА СЕЗОНОВ ===
    const CURRENT_SEASON = 2;
    const SEASON_NAMES = { 1: 'Сезон 1', 2: 'Сезон 2' };
    
    // Подсветка активного сезона (всегда Сезон 2 — прошлые сезоны в архиве)
    function markSeasonButtons(season) {
        const b1 = document.getElementById('season-btn-1');
        const b2 = document.getElementById('season-btn-2');
        const setActive = (el, active) => {
            if (!el) return;
            el.style.background = active ? 'var(--primary)' : 'transparent';
            el.style.color = active ? '#fff' : 'var(--text-light)';
            el.style.fontWeight = active ? '700' : '500';
        };
        setActive(b1, season === 1);
        setActive(b2, season !== 1);
        // 📜 Баннер «Сезон завершён» — только в архиве Сезона 1
        const banner = document.getElementById('season1-banner');
        if (banner) banner.style.display = (season === 1) ? 'block' : 'none';
    }

    /**
     * 🏆 Баннер завершённого сезона: дата окончания + подиум победителей топ-3.
     * Дата берётся из seasonHistory (когда сезон был заархивирован),
     * победители — из замороженного архива топа.
     */
    function renderSeasonBanner(top3) {
        const banner = document.getElementById('season1-banner');
        if (!banner) return;
        const inner = document.getElementById('season1-banner-inner');
        if (!inner) return;

        // Дата окончания сезона из личного архива игрока
        let dateStr = '';
        if (DB && DB.seasonHistory && DB.seasonHistory.length) {
            const s1 = DB.seasonHistory.find(s => (s.season || 1) === 1);
            if (s1 && s1.endDate) {
                try { dateStr = new Date(s1.endDate).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }); } catch(e) {}
            }
        }

        // 🏆 Подиум победителей
        let podiumHtml = '';
        if (top3 && top3.length) {
            const medals = ['🥇', '🥈', '🥉'];
            // Сортируем для подиума: 2-й, 1-й, 3-й (классический подиум)
            const order = top3.length >= 3 ? [1, 0, 2] : top3.map((_, i) => i);
            podiumHtml = `<div style="display:flex; align-items:flex-end; justify-content:center; gap:6px; margin-top:12px;">` +
                order.map(idx => {
                    const w = top3[idx];
                    if (!w) return '';
                    const h = Math.floor((w.totalSec || 0) / 3600);
                    const m = Math.floor(((w.totalSec || 0) % 3600) / 60);
                    const place = idx;
                    const heights = ['56px', '40px', '32px'];
                    const bh = heights[place] || '32px';
                    return `<div style="display:flex; flex-direction:column; align-items:center; flex:1; max-width:110px;">
                        <div style="font-size:18px; line-height:1;">${medals[place]}</div>
                        <div style="font-size:20px; margin-top:3px;">${w.avatar || '😎'}</div>
                        <div style="font-size:10.5px; font-weight:700; color:var(--text); max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">${w.name}</div>
                        <div style="font-size:10px; color:var(--primary); font-weight:800;">${h}ч${m ? ' ' + m + 'м' : ''}</div>
                        <div style="width:100%; height:${bh}; margin-top:5px; background:linear-gradient(180deg, var(--primary), transparent); border-radius:8px 8px 0 0; opacity:.35;"></div>
                    </div>`;
                }).join('') + `</div>`;
        }

        inner.innerHTML = `
            <div style="font-size:22px; line-height:1;">🏆</div>
            <div style="font-size:14px; font-weight:900; color:var(--primary); letter-spacing:.5px; margin-top:4px;">СЕЗОН 1 ЗАВЕРШЁН</div>
            ${dateStr ? `<div style="font-size:10.5px; color:var(--text-light); margin-top:2px; letter-spacing:.3px;">${dateStr}</div>` : ''}
            ${podiumHtml}
        `;
    }

    const SeasonSystem = {
        activeSeason: CURRENT_SEASON,
        /**
         * Проверяет нужна ли архивация и сброс при загрузке.
         * Вызывается после входа пользователя.
         */
        async checkAndReset() {
            const userSeason = DB.user.currentSeason || 1;
            if (userSeason >= CURRENT_SEASON) return; // Уже в текущем сезоне
            
            console.log(`🏆 Архивация сезона ${userSeason} → ${CURRENT_SEASON}`);
            
            // 1. Архивируем данные сезона в историю
            if (!DB.seasonHistory) DB.seasonHistory = [];
            
            // Подсчитываем статистику из журнала сессий
            let totalSec = DB.user.totalSec || 0;
            let xp = DB.user.xp || 0;
            let level = DB.user.level || 1;
            let pvpWins = DB.user.pvpWins || 0;
            let pvpLosses = DB.user.pvpLosses || 0;
            
            // Сохраняем архив
            DB.seasonHistory.push({
                season: userSeason,
                totalSec: totalSec,
                xp: xp,
                level: level,
                pvpWins: pvpWins,
                pvpLosses: pvpLosses,
                endDate: new Date().toISOString()
                // Предметы в архив сезона НЕ кладём — их статистика стоит отдельно
            });
            
            console.log(`📊 Сезон ${userSeason}: ${Math.floor(totalSec/3600)}ч, ${xp} XP, Lvl ${level}`);
            
            // 2. Сбрасываем для нового сезона ТОЛЬКО часы (время учёбы).
            // XP, уровень, монеты, PVP, стрик и всё остальное — навсегда.
            DB.user.totalSec = 0;
            DB.user.currentSeason = CURRENT_SEASON;
            delete DB.user.seasonHoursOverride; // 🔧 админ-правка часов не должна жить в новом сезоне
            
            // Предметы НЕ сбрасываем: их статистика по дисциплинам
            // копится всегда и стоит отдельно от сезонов
            
            // Сбрасываем журнал сессий и дневную историю времени
            DB.sessions = [];
            DB.history = {};
            
            // 3. Сохраняем в облако
            Data.save();
            
            // 3.5 🧊 Замораживаем карточку Сезона 1 в архиве топа
            // (чтобы игрок остался в итоговой таблице Сезона 1 навсегда,
            // даже когда его живая карточка перезаписалась на Сезон 2)
            if (window.DB_Online) {
                try {
                    const dbRef = window.DB_Online;
                    const histDoc = dbRef.doc(dbRef.db, "leaderboard_history_" + userSeason, Auth.currentUser.id);
                    await dbRef.setDoc(histDoc, {
                        name: DB.user.name,
                        totalSec: totalSec,
                        avatar: DB.user.avatar,
                        level: level,
                        currentTitle: DB.user.currentTitle || "",
                        currentFrame: DB.user.currentFrame || null,
                        isTitan: !!DB.user.isTitan,
                        isKing: !!DB.user.isKing,
                        isPro: !!DB.user.isPro,
                        isVip: !!DB.user.isVip,
                        season: userSeason,
                        // 🔐 Владелец карточки — обязательно для Firestore Rules
                        _ownerUID: window._firebaseUID || null,
                        archivedSeason: userSeason,
                        archivedAt: Date.now()
                    }, { merge: true });
                } catch(e) {
                    console.warn("Заморозка карточки сезона пропущена:", e.code || e.message);
                    App.toast("⚠️ Не удалось заархивировать прошлый сезон — попробуй позже");
                }
            }
            
            // 4. Обновляем leaderboard в облаке
            if (window.DB_Online) {
                try {
                    const dbRef = window.DB_Online;
                    const userId = Auth.currentUser.id;
                    const topDoc = dbRef.doc(dbRef.db, "leaderboard", userId);
                    await dbRef.setDoc(topDoc, {
                        name: DB.user.name,
                        totalSec: 0,
                        avatar: DB.user.avatar,
                        level: DB.user.level || 1,
                        currentTitle: DB.user.currentTitle || "",
                        currentFrame: DB.user.currentFrame || null,
                        isPro: !!DB.user.isPro,
                        isVip: !!DB.user.isVip,
                        isKing: !!DB.user.isKing,
                        isTitan: !!DB.user.isTitan,
                        season: CURRENT_SEASON,
                        lastActive: Date.now()
                    }, { merge: true });
                } catch(e) { console.error("Ошибка обновления leaderboard:", e); }
            }
            
            App.toast(`🏆 Добро пожаловать в ${SEASON_NAMES[CURRENT_SEASON]}! Часы учёбы обнулены — с чистого листа!`);
            App.updateUI();
        },

        // Момент старта текущего сезона = endDate последнего архивного сезона.
        // Если архивов нет (сезон ещё не переключался) — 0 (считаем все сессии).
        currentSeasonStart() {
            let start = 0;
            const archives = (DB.seasonHistory || []).filter(a => (a.season || 1) < CURRENT_SEASON);
            archives.forEach(a => {
                const t = Date.parse(a.endDate || '');
                if (!isNaN(t) && t > start) start = t;
            });
            return start;
        },

        // Сумма секунд журнала ТОЛЬКО текущего сезона.
        // Сессии прошлых сезонов остаются в журнале навсегда, но в часы
        // текущего сезона не идут (иначе старые часы воскресают в новом).
        currentSessionSec() {
            // 🔧 АДМИН-ПРАВКА ЧАСОВ: если админ ставил часы вручную (seasonHoursOverride),
            // базой сезона считается ПРАВКА АДМИНА + все сессии, начавшиеся ПОСЛЕ неё.
            // Старый журнал до правки не перетирает значение, новые сессии прибавляются честно.
            const ov = DB && DB.user && DB.user.seasonHoursOverride;
            if (ov && Number(ov.sec) > 0) {
                let extra = 0;
                (DB.sessions || []).forEach(s => {
                    let t = Number(s.date);
                    if (!t) {
                        const p = Date.parse(s.date);
                        if (!isNaN(p)) t = p; else t = 0;
                    }
                    if (t >= (Number(ov.at) || 0)) extra += (Number(s.sec) || 0);
                });
                return Math.max(0, (Number(ov.sec) || 0) + extra);
            }
            const start = this.currentSeasonStart();
            let sum = 0;
            (DB.sessions || []).forEach(s => {
                let t = Number(s.date);
                if (!t) {
                    const p = Date.parse(s.date);
                    if (!isNaN(p)) t = p; else t = 0;
                }
                if (!start || t >= start) sum += (Number(s.sec) || 0);
            });
            return sum;
        },

        /**
         * Загружает лидерборд для указанного сезона.
         * season=0 или season=CURRENT_SEASON → текущий сезон (из leaderboard)
         * season < CURRENT_SEASON → из leaderboard_history
         */

        /**
         * Переключение сезона в Топе
         */
        async switchSeason(season) {
            this.activeSeason = season;
            markSeasonButtons(season);
            await this.loadLeaderboard(season);
        },

        async loadLeaderboard(season = 0) {
            const list = document.getElementById('leaderboard-list');
            if (!list) return;
            
            list.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Загрузка...</div>';
            
            try {
                const dbRef = window.DB_Online;
                // Сезон 1 = замороженный архив leaderboard_history_1.
                // Текущий сезон = живая коллекция leaderboard.
                const isCurrentView = (!season || season === CURRENT_SEASON);
                const q = isCurrentView
                    ? dbRef.query(
                        dbRef.collection(dbRef.db, "leaderboard"),
                        dbRef.orderBy("totalSec", "desc"),
                        dbRef.limit(200)
                    )
                    : dbRef.query(
                        dbRef.collection(dbRef.db, "leaderboard_history_" + season),
                        dbRef.orderBy("totalSec", "desc"),
                        dbRef.limit(200)
                    );
                const snap = await dbRef.getDocs(q);
                
                if (snap.empty) {
                    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-light);">Нет данных за этот сезон</div>';
                    return;
                }
                
                // 🏅 Собираем топ-3 для баннера «Сезон завершён»
                if (!isCurrentView) {
                    const top3 = [];
                    snap.forEach(doc => {
                        if (top3.length >= 3) return;
                        const u = doc.data();
                        if (u && u.name && !u.isBanned) top3.push({ name: u.name, avatar: u.avatar || '😎', totalSec: u.totalSec || 0 });
                    });
                    renderSeasonBanner(top3);
                }
                
                // Используем существующий рендер, но с новыми данными
                let html = '';
                let rank = 1;
                const nowTime = Date.now();
                let prevRanks = {};
                try { prevRanks = JSON.parse(localStorage.getItem('MathLeaderRanks_s' + season) || '{}'); } catch(e) {}
                const newRanks = {};
                
                let shownCount = 0;
                snap.forEach(doc => {
                    const u = doc.data();
                    // 🔒 Фильтр по сезону: в архиве лежат записи прошлого сезона,
                    // а в живой таблице — только текущего (season === CURRENT_SEASON).
                    const docSeason = (u.season === undefined || u.season === null) ? 1 : Number(u.season);
                    const belongs = isCurrentView ? (docSeason === CURRENT_SEASON) : (docSeason === Number(season));
                    if (!belongs || shownCount >= 50) return;
                    shownCount++;
                    const isOnline = !u.isBanned && (nowTime - (u.lastActive || 0)) < 300000;
                    const frameClass = u.currentFrame ? `profile-img framed ${u.currentFrame}` : 'profile-img';
                    const isMe = (Auth.currentUser && Auth.currentUser.id === doc.id);
                    const isBannedCard = !!u.isBanned;
                    
                    const prevRank = prevRanks[doc.id];
                    let arrowHtml = '';
                    let rankClass = 'rank-same';
                    if (prevRank !== undefined && prevRank !== null) {
                        if (rank < prevRank) { arrowHtml = `<span class="rank-arrow rank-up">▲${prevRank - rank}</span>`; }
                        else if (rank > prevRank) { arrowHtml = `<span class="rank-arrow rank-down">▼${rank - prevRank}</span>`; }
                        else { arrowHtml = `<span class="rank-arrow rank-same">—</span>`; }
                    }
                    newRanks[doc.id] = rank;
                    
                    const medals = ['🥇', '🥈', '🥉'];
                    const topClass = rank <= 3 ? ` top-${rank}` : '';
                    const rankDisplay = rank <= 3 ? `<span style="font-size:18px;">${medals[rank-1]}</span>` : `<span style="font-weight:900; width:26px; color:var(--text-light); font-size:11px; text-align:right;">#${rank}</span>`;
                    const animDelay = (rank - 1) * 0.04;
                    
                    html += `
                        <div class="user-list-item leader-enter${topClass}" style="display: flex; align-items: center; padding: 8px 10px; ${isMe ? 'border:2px solid var(--primary) !important; background:rgba(108,99,255,0.05) !important;' : ''} animation-delay: ${animDelay}s;">
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 6px;">
                                <div style="width: 26px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 2px;">
                                    ${rankDisplay}
                                    ${arrowHtml}
                                </div>
                                <div style="position:relative; width:36px; height:36px;">
                                    <div class="${frameClass}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius: 50%;">
                                        <span style="font-size:18px; line-height: 1;">${u.avatar || '😎'}</span>
                                    </div>
                                    ${isOnline ? '<div style="position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; background:#00d26a; border:2px solid var(--surface); border-radius:50%; z-index:2;"></div>' : ''}
                                </div>
                            </div>
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; margin-left: 12px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 12px; flex-shrink: 0;">${isBannedCard ? '🚫' : (u.isTitan ? '🌌' : (u.isKing ? '👑' : (u.isPro ? '⭐' : (u.isVip ? '💎' : ''))))}</span>
                                    <b style="font-size: 13px; color: ${isBannedCard ? 'var(--accent)' : 'var(--text)'}; text-decoration: ${isBannedCard ? 'line-through' : 'none'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.name}</b>
                                </div>
                                <small style="font-size:10px; opacity:0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${isBannedCard ? `<span style="color:var(--accent); font-weight:800;">🚫 ЗАБАНЕН${u.banReason ? ' • ' + u.banReason : ''}</span>` : `Lvl ${u.level} • ${u.currentTitle || 'Участник'}`}
                                </small>
                            </div>
                            <div style="text-align:right; flex-shrink: 0; margin-left: 6px;">
                                ${isBannedCard
                                    ? '<b style="color:var(--accent); font-size: 12px; white-space:nowrap;">0ч</b>'
                                    : `<b style="color:var(--primary); font-size: 12px; white-space:nowrap;">
                                        ${Math.floor((u.totalSec||0)/3600)}ч ${Math.floor(((u.totalSec||0)%3600)/60)}м
                                    </b>`}
                            </div>
                        </div>`;
                    rank++;
                });
                
                localStorage.setItem('MathLeaderRanks_s' + season, JSON.stringify(newRanks));
                list.innerHTML = html;
                
            } catch(e) {
                console.error("Ошибка загрузки leaderboard:", e);
                list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent);">❌ Ошибка загрузки</div>';
            }
        },
        
        /**
         * При входе: замораживаем итоги сезона в leaderboard_history_N.
         * Пропускаем записи уже помеченные этим сезоном — архив пишется один раз.
         */
        async archiveLeaderboard() {
            if (!window.DB_Online) return;
            
            try {
                const dbRef = window.DB_Online;
                const oldSeason = CURRENT_SEASON - 1;
                const sourceCol = dbRef.collection(dbRef.db, "leaderboard");
                const targetCol = dbRef.collection(dbRef.db, "leaderboard_history_" + oldSeason);
                
                const snap = await dbRef.getDocs(sourceCol);
                const batch = [];
                snap.forEach(doc => {
                    const d = doc.data();
                    // Пропускаем: (а) записи нового сезона, (б) уже заархивированные
                    if (d.season === CURRENT_SEASON) return;
                    if (d.archivedSeason === oldSeason) return;
                    batch.push(dbRef.setDoc(
                        dbRef.doc(dbRef.db, "leaderboard_history_" + oldSeason, doc.id),
                        { ...d, archivedSeason: oldSeason }
                    ));
                });
                
                if (batch.length === 0) {
                    console.log("🏆 Архив сезона " + oldSeason + " уже актуален");
                    return;
                }
                
                Promise.all(batch).then(() => {
                    console.log(`🏆 Архивировано ${batch.length} игроков в leaderboard_history_${oldSeason}`);
                }).catch(e => console.error("Ошибка архивации leaderboard:", e));
                
            } catch(e) { console.error("Ошибка архивации leaderboard:", e); }
        },
        
        /**
         * 🧊 САМООРХИВАЦИЯ: игрок сам замораживает свои итоги прошлых сезонов
         * в leaderboard_history_N (из своего архива seasonHistory).
         * Лечит всех, кто уже перешёл в Сезон 2 и чья живая карточка перезаписана.
         */
        async archiveMySeasonCards() {
            if (!window.DB_Online || !DB.seasonHistory || !DB.seasonHistory.length) return;
            const dbRef = window.DB_Online;
            for (const s of DB.seasonHistory) {
                const sn = s.season || 1;
                if (sn >= CURRENT_SEASON) continue; // Архивируем только завершённые сезоны
                try {
                    // Идемпотентность: уже заархивировано (до конца) — не пишем снова
                    const archRef = dbRef.doc(dbRef.db, "leaderboard_history_" + sn, Auth.currentUser.id);
                    const archSnap = await dbRef.getDoc(archRef);
                    if (archSnap.exists() && archSnap.data().archivedSeason === sn) continue;
                    await dbRef.setDoc(archRef, {
                        name: DB.user.name,
                        totalSec: s.totalSec || 0,
                        avatar: DB.user.avatar,
                        level: s.level || 1,
                        currentTitle: DB.user.currentTitle || "",
                        currentFrame: DB.user.currentFrame || null,
                        isTitan: !!DB.user.isTitan,
                        isKing: !!DB.user.isKing,
                        isPro: !!DB.user.isPro,
                        isVip: !!DB.user.isVip,
                        season: sn,
                        // 🔐 Владелец карточки — обязательно для Firestore Rules
                        _ownerUID: window._firebaseUID || null,
                        archivedSeason: sn,
                        archivedAt: Date.now()
                    }, { merge: true });
                } catch(e) {
                    // Тихо: нет прав (чужой UID), офлайн и т.п. — не спамим в консоль
                    console.warn("Архив сезона " + sn + " пропущен:", e.code || e.message);
                }
            }
        },
        
        /**
         * 🧹 ЗАМОРОЗКА (один раз за сессию): копируем из живой leaderboard все
         * карточки завершённых сезонов в архив. Спасает данные игроков,
         * которые ещё НЕ заходили в Сезон 2 и могут не зайти никогда.
         */
        async sweepOldSeasons() {
            if (!window.DB_Online) return;
            if (sessionStorage.getItem('seasons_swept')) return;
            try {
                const dbRef = window.DB_Online;
                const q = dbRef.query(
                    dbRef.collection(dbRef.db, "leaderboard"),
                    dbRef.orderBy("totalSec", "desc"),
                    dbRef.limit(500)
                );
                const snap = await dbRef.getDocs(q);
                const writes = [];
                snap.forEach(d => {
                    const u = d.data();
                    const ds = (u.season === undefined || u.season === null) ? 1 : u.season;
                    if (ds >= CURRENT_SEASON) return;          // Карточка текущего сезона — не трогаем
                    if (u.archivedSeason === ds) return;        // Уже в архиве
                    writes.push(dbRef.setDoc(
                        dbRef.doc(dbRef.db, "leaderboard_history_" + ds, d.id),
                        Object.assign({}, u, {
                            archivedSeason: ds,
                            archivedAt: Date.now(),
                            // 🔐 Сохраняем исходного владельца карточки — иначе правила
                            // отклонят запись (мы не можем писать в чужую карточку)
                            _ownerUID: u._ownerUID || null
                        }),
                        { merge: true })
                    .catch(() => {})); // чужая карточка → 403 → тихо пропускаем
                });
                sessionStorage.setItem('seasons_swept', '1');
                if (writes.length) {
                    console.log(`🧊 Заморозка прошлых сезонов: ${writes.length} карточек → архив`);
                    Promise.allSettled(writes).then(results => {
                        const ok = results.filter(r => r.status === 'fulfilled').length;
                        if (ok < results.length) {
                            console.log(`🧊 Заморозка: ${ok}/${results.length} карточек (остальные — чужие, заархивируют их владельцы при входе)`);
                        }
                    });
                }
            } catch(e) {
                console.warn("Заморозка сезонов пропущена:", e.code || e.message);
            }
        },
        
        /**
         * Показать историю сезона в профиле
         */
        renderSeasonHistory() {
            const el = document.getElementById('season-history');
            if (!el || !DB.seasonHistory || DB.seasonHistory.length === 0) {
                if (el) el.innerHTML = '<p style="color:var(--text-light); font-size:12px;">Нет данных за прошлые сезоны</p>';
                return;
            }
            
            let html = '';
            DB.seasonHistory.forEach(s => {
                const h = Math.floor(s.totalSec / 3600);
                const m = Math.floor((s.totalSec % 3600) / 60);
                html += `
                    <div style="background:var(--bg); border-radius:12px; padding:12px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:var(--primary);">🏆 ${SEASON_NAMES[s.season] || 'Сезон ' + s.season}</b>
                            <small style="color:var(--text-light);">${s.endDate ? new Date(s.endDate).toLocaleDateString('ru') : ''}</small>
                        </div>
                        <div style="display:flex; gap:16px; margin-top:6px; font-size:12px;">
                            <span>⏱ ${h}ч ${m}м</span>
                            <span>⭐ ${s.xp || 0} XP</span>
                            <span>📊 Lvl ${s.level || 1}</span>
                            <span>⚔️ ${s.pvpWins || 0}W / ${s.pvpLosses || 0}L</span>
                        </div>
                    </div>`;
            });
            
            el.innerHTML = html;
        }
    };
    
    window.SeasonSystem = SeasonSystem;


    // 🌍 ФУНКЦИЯ ДАТЫ ЖУРНАЛА (ГГГГ-ММ-ДД в поясе пользователя)
    // Пояс берётся из профиля (по умолчанию — пояс устройства), НЕ хардкод Ташкента.
    // Ход времени не зависит от пояса — только группировка дней в журнале/статистике.
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
            
            // Если мы что-то меняли в последние 10 секунд — не слушаем облако (защита от отката)
            const timeSinceLastSave = Date.now() - (DB.user.lastSaveTime || 0);
            if (timeSinceLastSave < 10000) return; 

            // В остальное время — синхронизируем
            if (JSON.stringify(cloud) !== JSON.stringify(DB)) {
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

        if (window.DB_Online) {
            const dbRef = window.DB_Online;
            const userId = Auth.currentUser.id;

            try {
                // 2. Отправляем ПОЛНЫЙ профиль в папку users
                const userDoc = dbRef.doc(dbRef.db, "users", userId);
                // 🔐 Добавляем ownerUID для проверки Firestore Rules
                DB._ownerUID = window._firebaseUID || null;
                await dbRef.setDoc(userDoc, DB);

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
                    lastActive: Date.now(),
                    fcmToken: DB.user.fcmToken || null
                });

                if (DB.user.rescueCode) {
                                const rescueDoc = dbRef.doc(dbRef.db, "transfers", DB.user.rescueCode);
                                await dbRef.setDoc(rescueDoc, {
                                    userId: userId,
                                    data: DB,
                                    isPermanent: true,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                }, { merge: true }); // merge: true — не перезаписывает, а обновляет
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
            }
        }
    },

        
        export() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB)); const node = document.createElement('a'); node.setAttribute("href", dataStr); node.setAttribute("download", `${Auth.currentUser.name}_MathData.json`); document.body.appendChild(node); node.click(); node.remove(); },
        import(el) { const fr = new FileReader(); fr.onload = (e) => { try { DB = JSON.parse(e.target.result); this.save(); location.reload(); } catch(x) { alert("Ошибка файла"); } }; fr.readAsText(el.files[0]); }
    };

    

    // --- WHITEBOARD & CALC ---
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

    const Online = {
        lastLoadTime: 0, 

        async loadLeaderboard() {
            if (!window.DB_Online) return App.toast("⚠️ Нет связи");

            const now = Date.now();
            const cooldown = 60000;

            if (now - this.lastLoadTime < cooldown) {
                const secondsLeft = Math.ceil((cooldown - (now - this.lastLoadTime)) / 1000);
                App.toast(`⏳ Подождите ${secondsLeft} сек. перед обновлением`);
                return; 
            }

            this.lastLoadTime = now; 

            // Подсвечиваем активный сезон в кнопках переключения
            const viewSeason = (window.SeasonSystem && SeasonSystem.activeSeason) ? SeasonSystem.activeSeason : CURRENT_SEASON;
            if (window.SeasonSystem) markSeasonButtons(viewSeason);
            
            // 🧊 Прошлые сезоны смотрим в замороженном архиве
            if (viewSeason && viewSeason !== CURRENT_SEASON) {
                return SeasonSystem.loadLeaderboard(viewSeason);
            }

            const list = document.getElementById('leaderboard-list');
            list.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Загрузка...</div>';

            try {
                // Фильтр по сезону делаем на клиенте: записи без поля season — прошлые сезоны
                const isCurrentView = (!viewSeason || viewSeason === CURRENT_SEASON);
                const q = window.DB_Online.query(
                    window.DB_Online.collection(window.DB_Online.db, "leaderboard"),
                    window.DB_Online.orderBy("totalSec", "desc"),
                    window.DB_Online.limit(200)
                );

                const snap = await window.DB_Online.getDocs(q);
                let html = '';
                let rank = 1;
                const nowTime = Date.now();

                // 📊 Загружаем ПРЕДЫДУЩИЕ позиции для стрелок
                let prevRanks = {};
                try { prevRanks = JSON.parse(localStorage.getItem('MathLeaderRanks') || '{}'); } catch(e) {}
                const newRanks = {};

                let shownCount = 0;
                snap.forEach(doc => {
    const u = doc.data();
    const docSeason = (u.season === undefined || u.season === null) ? 1 : u.season;
    const belongs = isCurrentView ? (docSeason === CURRENT_SEASON) : (docSeason !== CURRENT_SEASON);
    if (!belongs || shownCount >= 50) return; // записи другого сезона не участвуют в рейтинге
    shownCount++;
    const isOnline = (nowTime - (u.lastActive || 0)) < 300000;
    const frameClass = u.currentFrame ? `profile-img framed ${u.currentFrame}` : 'profile-img';
    const isMe = (Auth.currentUser && Auth.currentUser.id === doc.id);

    // 📊 Стрелки: сравнение с прошлым
    const prevRank = prevRanks[doc.id];
    let arrowHtml = '';
    let rankClass = 'rank-same';
    if (prevRank !== undefined && prevRank !== null) {
        if (rank < prevRank) {
            arrowHtml = `<span class="rank-arrow rank-up">▲${prevRank - rank}</span>`;
            rankClass = 'rank-up';
        } else if (rank > prevRank) {
            arrowHtml = `<span class="rank-arrow rank-down">▼${rank - prevRank}</span>`;
            rankClass = 'rank-down';
        } else {
            arrowHtml = `<span class="rank-arrow rank-same">—</span>`;
        }
    }
    newRanks[doc.id] = rank;

    // 🏆 Медали для топ-3
    const medals = ['🥇', '🥈', '🥉'];
    const topClass = rank <= 3 ? ` top-${rank}` : '';
    const rankDisplay = rank <= 3 ? `<span style="font-size:18px;">${medals[rank-1]}</span>` : `<span style="font-weight:900; width:26px; color:var(--text-light); font-size:11px; text-align:right;">#${rank}</span>`;
    const animDelay = (rank - 1) * 0.04;

    html += `
        <div class="user-list-item leader-enter${topClass}" style="display: flex; align-items: center; padding: 8px 10px; ${isMe ? 'border:2px solid var(--primary) !important; background:rgba(108,99,255,0.05) !important;' : ''} animation-delay: ${animDelay}s;">
            
            <!-- 1. НОМЕР / МЕДАЛЬ И АВАТАР -->
            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 6px;">
                <div style="width: 26px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 2px;">
                    ${rankDisplay}
                    ${arrowHtml}
                </div>
                
                <div style="position:relative; width:36px; height:36px;">
                    <div class="${frameClass}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius: 50%;">
                        <span style="font-size:18px; line-height: 1;">
                            ${u.avatar || '😎'}
                        </span>
                    </div>
                    ${isOnline ? '<div style="position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; background:#00d26a; border:2px solid var(--surface); border-radius:50%; z-index:2;"></div>' : ''}
                </div>
            </div>

            <!-- 2. ИМЯ И СТАТУС -->
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; margin-left: 12px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 12px; flex-shrink: 0;">${u.isTitan ? '🌌' : (u.isKing ? '👑' : (u.isPro ? '⭐' : (u.isVip ? '💎' : '')))}</span>
                    <b style="font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${u.name}
                    </b>
                </div>
                <small style="font-size:10px; opacity:0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    Lvl ${u.level} • ${u.currentTitle || 'Участник'}
                </small>
            </div>

            <!-- 3. ВРЕМЯ -->
            <div style="text-align:right; flex-shrink: 0; margin-left: 6px;">
                <b style="color:var(--primary); font-size: 12px; white-space:nowrap;">
                    ${Math.floor(u.totalSec/3600)}ч ${Math.floor((u.totalSec%3600)/60)}м
                </b>
            </div>

            <!-- 4. КНОПКА ВЫЗОВА НА ДУЭЛЬ (только для онлайн и не для себя) -->
            ${isOnline && !isMe ? `<button class="challenge-btn" onclick="BattleSys.challengePlayer('${doc.id}', '${u.name.replace(/'/g, "\\'")}', '${u.fcmToken || ''}')" style="flex-shrink:0; margin-left:6px;">⚔️</button>` : ''}

        </div>`;
    rank++;
});

                // 💾 Сохраняем текущие позиции для следующего сравнения
                try { localStorage.setItem('MathLeaderRanks', JSON.stringify(newRanks)); } catch(e) {}

                list.innerHTML = html;
            } catch (e) {
                console.error(e);
                list.innerHTML = '<div style="text-align:center; color:red;">Ошибка сети</div>';
            }
        }
    };

    /* ==========================================
    APP CORE
    ========================================== */
    const Auth = {
        users: [], currentUser: null,
        avatars: ['😎', '👩‍🎓', '👨‍🎓', '👱‍♀️', '👨', '🧕', '🧔', '🐱', '🦊', '⚽'],
        init() {
            let stored = localStorage.getItem('MathUsers');
            if (stored) {
                try {
                    const raw = JSON.parse(stored);
                    this.users = Array.isArray(raw) 
                        ? raw.filter(u => u && typeof u === 'object' && u.id && typeof u.id === 'string' && u.name)
                        : [];
                    if (this.users.length === 0 && raw.length > 0) {
                        localStorage.removeItem('MathUsers');
                    }
                } catch (e) {
                    localStorage.removeItem('MathUsers');
                }
            }

            this.renderUserList();
            this.renderAvatars();
            SoundSys.init();
            Whiteboard.init();
            PWA.init();
            MusicPlayer.init();

            // 👇 ВОТ ЭТОТ БЛОК ВСТАВЛЯЕМ СЮДА 👇
            window.addEventListener('click', () => {
                if (SoundSys.ctx && SoundSys.ctx.state === 'suspended') {
                    SoundSys.ctx.resume();
                }
            }, { once: true });
        },

        renderUserList() {
        const list = document.getElementById('user-list');
        if (!list) return;

        list.innerHTML = '';

        if (this.users.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-light); padding:20px;">Нет профилей. Создайте первый!</div>';
            return;
        }

        // 🔥 Фильтруем и чистим битые записи прямо здесь
        this.users = this.users.filter(u => u && u.id && u.name && typeof u.id === 'string');

        this.users.forEach(u => {
            // Безопасный ID
            const safeID = u.id ? u.id.toString().slice(0,8) + '...' : 'нет ID';

            const div = document.createElement('div');
            div.className = 'user-list-item';

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = "display:flex; align-items:center; gap:15px; flex-grow:1;";
            infoDiv.innerHTML = `
                <div class="user-avatar">${u.avatar || '😎'}</div>
                <div>
                    <div style="font-weight:bold">${u.name || 'Без имени'}</div>
                    <div style="font-size:12px; color:var(--text-light)">ID: ${safeID}</div>
                </div>`;

            infoDiv.onclick = () => this.login(u.id);

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-user-btn';
            delBtn.innerHTML = '✕';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteUser(u.id, e);
            };

            div.appendChild(infoDiv);
            div.appendChild(delBtn);
            list.appendChild(div);
        });

        // Если после чистки список пуст — покажем сообщение
        if (this.users.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-light); padding:20px;">Все профили повреждены. Создайте новый!</div>';
        }

        // 2. ОТРИСОВКА СПИСКА ДЛЯ РОДИТЕЛЕЙ (Наблюдение)
        const parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
        if (parentLinks.length > 0) {
            const parentTitle = document.createElement('h3');
            parentTitle.style.cssText = "margin-top:25px; margin-bottom:10px; font-size:12px; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; text-align:center;";
            parentTitle.innerText = "🔎 Профили детей (Наблюдение)";
            list.appendChild(parentTitle);

            parentLinks.forEach(link => {
                const pDiv = document.createElement('div');
                pDiv.className = 'user-list-item';
                pDiv.style.borderLeft = "4px solid #2ECC71";
                
                pDiv.innerHTML = `
                    <div class="user-avatar">${link.avatar || '👦'}</div>
                    <div style="flex-grow:1;" onclick="Auth.loginAsParent('${link.code}')">
                        <div style="font-weight:bold">${link.name}</div>
                        <div style="font-size:11px; color:#2ECC71">Режим просмотра (Online)</div>
                    </div>
                    <button class="delete-user-btn" style="background:#f39c12; margin-right:5px; font-size:12px;" onclick="Auth.updateParentCode('${link.id}', event)">🔄</button>
                    <button class="delete-user-btn" onclick="Auth.removeParentLink('${link.id}', event)">✕</button>
                `;
                list.appendChild(pDiv);
            });
        }
    },
        deleteUser(id, event) {
            event.stopPropagation();
            if(!confirm("Точно удалить этот профиль? Он пропадет с телефона и из Топа!")) return;
            
            this.users = this.users.filter(u => u.id !== id);
            localStorage.setItem('MathUsers', JSON.stringify(this.users));
            localStorage.removeItem('MathData_' + id);
            
            if (window.DB_Online) {
                const dbRef = window.DB_Online;
                
                // 1. Удаляем профиль
                const userDoc = dbRef.doc(dbRef.db, "users", id);
                dbRef.deleteDoc(userDoc).catch(err => console.error("users:", err));
                
                // 2. ✅ Удаляем из Топа (это и было забыто!)
                const leaderDoc = dbRef.doc(dbRef.db, "leaderboard", id);
                dbRef.deleteDoc(leaderDoc).catch(err => console.error("leaderboard:", err));
                
                // 3. Удаляем резервную копию (если есть код)
                try {
                    const localData = localStorage.getItem('MathData_' + id);
                    if (localData) {
                        const parsed = JSON.parse(localData);
                        if (parsed.user && parsed.user.rescueCode) {
                            const rescueDoc = dbRef.doc(dbRef.db, "transfers", parsed.user.rescueCode);
                            dbRef.deleteDoc(rescueDoc).catch(err => console.error("transfers:", err));
                        }
                    }
                } catch(e) {}
            }
            
            this.renderUserList();
            App.toast("🗑️ Удалено везде");
        },

        renderAvatars() { 
            const el = document.getElementById('avatar-selector');
            if(el) el.innerHTML = this.avatars.map(a => 
                `<div class="avatar-option ${a===this.selectedAvatar?'selected':''}" onclick="Auth.selectAvatar('${a}')">${a}</div>`
            ).join(''); 
            // Обновляем превью-аватарку
            const preview = document.getElementById('reg-preview-avatar');
            if (preview) {
                preview.innerText = this.selectedAvatar || '😎';
                preview.classList.remove('pulse');
                void preview.offsetWidth; // reflow
                preview.classList.add('pulse');
            }
        },

        selectAvatar(a) { 
            this.selectedAvatar = a; 
            this.renderAvatars(); 
            SoundSys.play('click'); 
        },

        setGender(g) {
            this.selectedGender = g;
            // Обновляем тогл пола
            document.getElementById('gender-male')?.classList.toggle('active', g === 'male');
            document.getElementById('gender-female')?.classList.toggle('active', g === 'female');
            // Обновляем классические кнопки (для совместимости)
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            const btns = document.querySelectorAll('.gender-btn');
            if(btns.length > 1) btns[g==='male'?0:1].classList.add('active');
        },

        _allAuthViews: ['role-select-view','login-view','register-view','parent-login-view','transfer-view'],

        _hideAllAuth() {
            this._allAuthViews.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        },

        showRoleSelect() {
            this._hideAllAuth();
            document.getElementById('role-select-view').style.display = 'block';
            SoundSys.play('click');
        },

        showParentLogin() {
            this._hideAllAuth();
            document.getElementById('parent-login-view').style.display = 'block';
            setTimeout(() => { const inp = document.getElementById('parent-code-input'); if(inp) inp.focus(); }, 100);
        },

        showRegister() { 
            this._hideAllAuth();
            document.getElementById('register-view').style.display = 'block';
        },

        showLogin() { 
            this._hideAllAuth();
            document.getElementById('login-view').style.display = 'block';
        },

        showTransfer() {
            this._hideAllAuth();
            document.getElementById('transfer-view').style.display = 'block';
            setTimeout(() => { const inp = document.getElementById('transfer-code-input'); if(inp) inp.focus(); }, 100);
        },

        transferSubmit() {
            const inp = document.getElementById('transfer-code-input');
            if (!inp) return;
            const cleanID = inp.value.trim().toUpperCase();
            if (cleanID.length < 4) return App.toast('❌ Слишком короткий код');
            Transfer.transferByIDCode(cleanID);
        },

        async createAccount() {
        const inputField = document.getElementById('reg-name');
        const name = inputField.value.trim();
        if (!name) return App.toast('⚠️ Введите имя!');

        // 🔐 Ждём Firebase Auth UID (уникальный для каждого устройства)
        const uid = await window._authReady;
        console.log("🔐 Auth UID для нового профиля:", uid);

        // 1. Создаем объект для списка профилей
        const newUser = {
            id: uid,
            name: name,
            avatar: this.selectedAvatar || '😎',
            gender: this.selectedGender || 'male'
        };

        // 2. Создаем структуру данных (DB) ПРЯМО ЗДЕСЬ
        const newDB = JSON.parse(JSON.stringify(DefaultDB));
        newDB.user.name = name;
        newDB.user.avatar = newUser.avatar;
        newDB.user.gender = newUser.gender;
        newDB.achievements = GenAch();
        newDB.user.id = newUser.id;

        // 3. Сохраняем это в память телефона ДО входа
        localStorage.setItem('MathData_' + newUser.id, JSON.stringify(newDB));

        // 4. Добавляем в список пользователей
        this.users.push(newUser);
        localStorage.setItem('MathUsers', JSON.stringify(this.users));

        // 5. Теперь входим. login увидит данные в localStorage и не поставит "Игрока"
        await this.login(newUser.id);
        
        setTimeout(() => {
            if (typeof Tutorial !== 'undefined') Tutorial.startFlow(); 
        }, 800);
    },

        async login(id) { 
            const user = this.users.find(u => u.id === id); 
            if (!user) return; 

            const loginCard = document.getElementById('login-view');
            const originalHTML = loginCard ? loginCard.innerHTML : "";
            
            if(loginCard) loginCard.innerHTML = `
                <div style="padding:40px; text-align:center;">
                    <div class="loader" style="margin:0 auto 20px auto; border-top-color:var(--primary);"></div>
                    <p style="font-weight:bold; color:var(--primary);">Облачная синхронизация...</p>
                    <p style="font-size:12px; opacity:0.6;">Загружаем твой прогресс</p>
                </div>`;

            try {
            let attempts = 0;
            while (!window.DB_Online && attempts < 10) {
                await new Promise(res => setTimeout(res, 500));
                attempts++;
            }

            const dbRef = window.DB_Online; 
            const docRef = dbRef.doc(dbRef.db, "users", id);
            const docSnap = await dbRef.getDoc(docRef);

            if (docSnap.exists()) {
                // Если в облаке есть данные - берем их
                DB = docSnap.data();
            } else {
                // ЕСЛИ В ОБЛАКЕ ПУСТО (новый юзер)
                // Загружаем то, что мы только что подготовили в createAccount
                Data.load(id); 
                // И сразу отправляем это в облако, чтобы там больше не было пусто
                await Data.save();
            }

            this.currentUser = user; 
            localStorage.setItem('LastUserId', id); 
            document.getElementById('auth-screen').classList.add('hidden'); 
            document.getElementById('app-container').style.display = 'block'; 
            
            await App.initAfterLogin();
            Data.startListening(id);
            
        } catch (e) {
            console.error("Login Error:", e);
            if(loginCard) loginCard.innerHTML = originalHTML;
            this.renderUserList(); 
            alert("❌ Ошибка входа");
            }
        },

        logout() { 
            if(confirm("Выйти из профиля?")) { 
                if(window.Timer) Timer.stop(false);
                if (typeof Data !== 'undefined' && Data.stopListening) Data.stopListening();
                if (window.BattleSys) BattleSys.stopChallengeListener();
                localStorage.removeItem('LastUserId'); 
                location.reload(); 
            } 
        },

        parentLoginPrompt() {
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.style.zIndex = '15000';
            modal.innerHTML = `
                <div class="modal-content" style="text-align:center; max-width:340px;">
                    <div style="font-size:48px; margin-bottom:10px;">👨‍👩‍👧</div>
                    <h3 style="margin-bottom:5px;">Режим родителя</h3>
                    <p style="font-size:12px; color:var(--text-light); margin-bottom:15px;">Введи код восстановления ребенка<br>для просмотра его прогресса</p>
                    <input type="text" id="parent-code-input" class="input-field" placeholder="XXXX-XXXX" maxlength="8" style="text-align:center; font-size:20px; font-family:monospace; letter-spacing:3px; text-transform:uppercase; font-weight:bold;">
                    <button class="btn btn-primary" id="parent-code-btn" style="margin-top:15px; width:100%;" onclick="Auth.parentLoginSubmit()">📡 Подключиться</button>
                    <button class="btn btn-outline" style="margin-top:8px; width:100%;" onclick="this.closest('.modal').remove()">Отмена</button>
                </div>`;
            document.body.appendChild(modal);
            setTimeout(() => { const inp = document.getElementById('parent-code-input'); if(inp) inp.focus(); }, 100);
        },

        parentLoginSubmit() {
            const inp = document.getElementById('parent-code-input');
            if (!inp) return;
            const cleanID = inp.value.trim().toUpperCase();
            if (cleanID.length < 4) return App.toast("❌ Слишком короткий код");
            document.querySelector('.modal.show')?.remove();
            // Сохраняем связь в список родителя
            let parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
            if (!parentLinks.find(l => l.code === cleanID)) {
                parentLinks.push({
                    id: 'p' + Date.now(),
                    code: cleanID,
                    name: 'Ребенок (' + cleanID.slice(0,4) + ')',
                    avatar: '👦',
                    addedAt: Date.now()
                });
                localStorage.setItem('ParentLinks', JSON.stringify(parentLinks));
            }
            this.loginAsParent(cleanID);
        },

        async loginAsParent(code) {
            App.toast("📡 Подключение к профилю ребенка...");
            try {
                let attempts = 0;
                while (!window.DB_Online && attempts < 10) {
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
                if (!window.DB_Online) {
                    App.toast("❌ Сервер недоступен");
                    return;
                }
                const docRef = window.DB_Online.doc(window.DB_Online.db, "transfers", code);
                const docSnap = await window.DB_Online.getDoc(docRef);
                if (docSnap.exists()) {
                    isParentMode = true;
                    DB = docSnap.data().data;
                    Auth.currentUser = { 
                        id: DB.user.id, 
                        name: DB.user.name, 
                        avatar: DB.user.avatar 
                    };
                    // Обновляем имя в parentLinks
                    let parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
                    const link = parentLinks.find(l => l.code === code);
                    if (link) {
                        link.name = DB.user.name;
                        link.avatar = DB.user.avatar || '👦';
                        localStorage.setItem('ParentLinks', JSON.stringify(parentLinks));
                    }
                    App.initParentView();
                    DB.user.visitedParentMode = true;
                    // Сохраняем FCM-токен родителя в Firebase (для серверных push-уведомлений)
                    this._saveParentFcmToken(DB.user.id, DB.user.name);
                } else {
                    App.toast("❌ Код не найден или истёк");
                }
            } catch (e) {
                console.error("Parent Login Error:", e);
                App.toast("❌ Ошибка подключения");
            }
        },

        // Сохраняем FCM-токен родителя в Firebase (для push-уведомлений)
        // Храним по коду ребёнка: parentTokens/{childCode}/tokens/{fcmToken}
        async _saveParentFcmToken(childUserId, childName) {
            try {
                let attempts = 0;
                while (!window.DB_Online && attempts < 10) {
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
                if (!window.DB_Online) return;

                // Получаем FCM-токен родителя
                let token = localStorage.getItem('fcm_token');
                if (!token && window.DB_Online.messaging) {
                    try {
                        const { getToken } = window.DB_Online;
                        token = await getToken(window.DB_Online.messaging, {
                            vapidKey: 'BHMScHHyu4ovNRTDndNKTHovdL5SkrSRFjrkZ6GiTLATTDvir7mGp9iFFzZFpaFoVDhLCI7TPuOSZ08ZotWVBrw'
                        });
                        if (token) localStorage.setItem('fcm_token', token);
                    } catch(e) { console.warn('FCM token error:', e); }
                }
                if (!token) return;

                // Определяем код ребёнка из parentLinks
                let childCode = '';
                try {
                    const parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
                    const link = parentLinks.find(l => l.name?.includes(childName) || true);
                    if (link) childCode = link.code;
                } catch(e) {}
                if (!childCode) { console.warn('Нет кода ребёнка для сохранения FCM-токена'); return; }

                // Сохраняем в parentTokens/{childCode}/tokens/{fcmToken}
                const { doc, setDoc, db } = window.DB_Online;
                const tokenDoc = doc(db, 'parentTokens', childCode, 'tokens', token);
                await setDoc(tokenDoc, {
                    token: token,
                    parentName: (() => { try { return JSON.parse(localStorage.getItem('MathUsers') || '[]').find(u => u.id === Auth.currentUser?.id)?.name || 'Родитель'; } catch(e) { return 'Родитель'; } })(),
                    childName: childName || 'Ребёнок',
                    childUserId: childUserId || '',
                    createdAt: Date.now(),
                    lastSeen: Date.now(),
                    userAgent: navigator.userAgent.substring(0, 100)
                });
                console.log('✅ FCM-токен родителя сохранён в Firebase для push-уведомлений');
            } catch(e) {
                console.error('Ошибка сохранения parent FCM token:', e);
            }
        },

        removeParentLink(id, event) {
            event.stopPropagation();
            if(!confirm("Прекратить наблюдение за этим профилем?")) return;
            let parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
            parentLinks = parentLinks.filter(link => link.id !== id);
            localStorage.setItem('ParentLinks', JSON.stringify(parentLinks));
            this.renderUserList();
        },

        updateParentCode(id, event) {
            event.stopPropagation();
            const newCode = window.prompt("Ребенок обновил код? Введите новый:");
            if (!newCode) return;
            let parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');
            const index = parentLinks.findIndex(l => l.id === id);
            if (index !== -1) {
                parentLinks[index].code = newCode.trim().toUpperCase();
                localStorage.setItem('ParentLinks', JSON.stringify(parentLinks));
                this.renderUserList();
                App.toast("✅ Код обновлен");
            }
        },

        resetData() {
            if(confirm("ВЫ УВЕРЕНЫ? Всё будет удалено навсегда!")) {
                Data.initNewData(this.currentUser.id);
                alert("Данные сброшены.");
                localStorage.removeItem('LastUserId');
                location.reload();
            }
        }
    };

    const Tutorial = {
        // 1. ГЛАВНЫЙ СТАРТ (Цепочка: Термы -> Туториал)
        startFlow() {
            const termsModal = document.getElementById('terms-modal');
            const acceptBtn = document.getElementById('terms-accept-btn');

            // Открываем соглашение
            termsModal.classList.add('show');

            // Перехватываем нажатие кнопки
            acceptBtn.onclick = () => {
                termsModal.classList.remove('show');
                
                // Запускаем само обучение через полсекунды
                setTimeout(() => {
                    this.start();
                }, 500);

                // Возвращаем кнопке обычное поведение (просто закрывать окно)
                // Это нужно, чтобы если он потом откроет правила из настроек, туториал не запускался снова
                acceptBtn.onclick = () => termsModal.classList.remove('show');
            };
        },

        // 2. ЗАПУСК СЛАЙДОВ
        start() {
            document.getElementById('tutorial-modal').classList.add('show');
        },

        next(slideNum) {
        // Скрываем все слайды
        document.querySelectorAll('.tutorial-slide').forEach(el => el.style.display = 'none');
        
        // Показываем нужный
        const slide = document.getElementById('tut-' + slideNum);
        if(slide) {
            slide.style.display = 'block';
            slide.style.animation = 'fadeInUp 0.4s ease';
        }

        // Обновляем точки
        document.querySelectorAll('.tut-dot').forEach((dot, index) => {
            if (index + 1 === slideNum) dot.classList.add('active');
            else dot.classList.remove('active');
        });

        SoundSys.play('click');
    },

    close() {
        document.getElementById('tutorial-modal').classList.remove('show');
        FX.confetti(); 
        SoundSys.play('level_up');
        App.toast("🚀 Добро пожаловать!");

        // 🔥 ПРИНУДИТЕЛЬНЫЙ ВЫЗОВ НАГРАДЫ ДЛЯ НОВИЧКА
        setTimeout(() => {
            if (window.DailySys) DailySys.check();
        }, 600);
    }
};

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

const QuestSys = {
        // 1. Список квестов (цели обновляются в checkDay)
        list: [
            { id: 'q1', title: '⏱️ Время учебы', type: 'studyMin', baseTarget: 20, reward: 50 },
            { id: 'q2', title: '🧠 Тренировка мозга', type: 'mathSolved', baseTarget: 15, reward: 40 },
            { id: 'q3', title: '⚔️ Дуэль с другом', type: 'pvpDone', baseTarget: 1, reward: 60 }
        ],

        // 2. Проверка дня и генерация целей
        checkDay() {
    const today = getUZDate();
    
        // 🛡️ СТРАХОВКА: Если папки квестов нет, создаем её мгновенно
        if (!DB.user.dailyQuests) {
            DB.user.dailyQuests = {
                date: today, studyMin: 0, mathSolved: 0, pvpDone: 0, claimed: [],
                targets: { studyMin: 30, mathSolved: 20, pvpDone: 1 }
            };
        }

        if (DB.user.dailyQuests.date !== today) {
            const randomStudy = 20 + Math.floor(Math.random() * 21);
            const randomMath = 15 + Math.floor(Math.random() * 21);
            
            DB.user.dailyQuests = {
                date: today,
                studyMin: 0,
                mathSolved: 0,
                pvpDone: 0,
                claimed: [],
                targets: {
                    studyMin: randomStudy,
                    mathSolved: randomMath,
                    pvpDone: 1
                }
            };
            Data.save();
        }
    },

        // 3. Обновление прогресса
        update(type, amount = 1) {
            this.checkDay();
            if (DB.user.dailyQuests[type] !== undefined) {
                DB.user.dailyQuests[type] += amount;
                Data.save();
                // Перерисовываем, только если мы на главном экране
                const dash = document.getElementById('dashboard');
                if (dash && dash.classList.contains('active')) this.render();
            }
        },

        // 4. Отрисовка в HTML
        render() {
            const container = document.getElementById('quests-container');
            if (!container) return;

            this.checkDay();
            const targets = DB.user.dailyQuests.targets || { studyMin: 30, mathSolved: 20, pvpDone: 1 };

            container.innerHTML = this.list.map(q => {
                const current = DB.user.dailyQuests[q.type] || 0;
                const target = targets[q.type];
                const isClaimed = DB.user.dailyQuests.claimed.includes(q.id);
                const isDone = current >= target;
                const pct = Math.min(100, (current / target) * 100);

                // ФОРМИРУЕМ ПОНЯТНЫЙ ТЕКСТ ЦЕЛИ
                let questGoalText = "";
                const left = target - current;
                if (q.type === 'studyMin') {
                    questGoalText = isDone ? "✅ Время вышло, забирай!" : `Поучись еще ${left} мин.`;
                } else if (q.type === 'mathSolved') {
                    questGoalText = isDone ? "✅ Мозг прокачан!" : `Реши еще ${left} примеров в тренажере`;
                } else if (q.type === 'pvpDone') {
                    questGoalText = isDone ? "✅ Арена пройдена!" : `Сыграй 1 дуэль с другом`;
                }

                return `
                    <div class="card" style="padding: 15px; margin-bottom: 10px; border-left: 4px solid ${isDone ? 'var(--success)' : 'var(--primary)'}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: bold; font-size: 14px;">${q.title}</div>
                                <div style="font-size: 11px; color: var(--text-light); margin-top: 2px;">${questGoalText}</div>
                            </div>
                            <div style="font-weight: 800; color: var(--primary); font-size: 14px;">${current}/${target}</div>
                        </div>
                        
                        <!-- Шкала прогресса -->
                        <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; margin: 12px 0 8px 0; overflow: hidden;">
                            <div style="width: ${pct}%; height: 100%; background: ${isDone ? 'var(--success)' : 'var(--primary)'}; transition: 0.8s cubic-bezier(0.17, 0.67, 0.83, 0.67);"></div>
                        </div>

                        ${isDone && !isClaimed ? `
                            <button class="btn btn-primary" style="padding: 10px; font-size: 12px; width: 100%; margin-top: 5px; background: var(--success);" onclick="QuestSys.claim('${q.id}')">
                                🎁 ЗАБРАТЬ НАГРАДУ +${q.reward} 💰
                            </button>
                        ` : ''}

                        ${isClaimed ? `
                            <div style="color: var(--success); font-size: 12px; font-weight: bold; text-align: center; padding: 5px; background: rgba(0,210,106,0.1); border-radius: 8px; margin-top: 5px;">
                                ⭐ ВЫПОЛНЕНО
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        },

        // 5. ФУНКЦИЯ ЗАБОРА НАГРАДЫ (Её скорее всего не хватало)
        claim(id) {
            const q = this.list.find(x => x.id === id);
            if (!q) return;

            this.checkDay();
            
            if (DB.user.dailyQuests.claimed.includes(id)) return;

            const current = DB.user.dailyQuests[q.type];
            const target = DB.user.dailyQuests.targets[q.type];

            if (current >= target) {
                DB.user.dailyQuests.claimed.push(id);
                DB.user.coins += q.reward;
                DB.user.lifetimeQuestsDone = (DB.user.lifetimeQuestsDone || 0) + 1;

                // Проверяем, все ли квесты за день забраны (для "Безупречный")
                const allClaimed = this.list.every(x => DB.user.dailyQuests.claimed.includes(x.id));
                if (allClaimed) {
                    DB.user.lifetimePerfectDays = (DB.user.lifetimePerfectDays || 0) + 1;
                }
                
                SoundSys.play('quest_done'); // Наш новый звук
                FX.confetti();
                App.toast(`🎁 Награда: +${q.reward} 💰`);
                
                Data.save();
                App.updateUI();
                this.render();
            } else {
                App.toast("⚠️ Квест еще не выполнен!");
            }
        }
    };
    
const WeeklyQuestSys = {
    // Настройки марафона: цель недели и награда
    REWARD: 100,        // монеты за выполнение
    TARGET_HOURS: 8,    // часов учёбы на неделю

    getWeekID() {
        const now = new Date();
        const oneJan = new Date(now.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((now - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((now.getDay() + 1 + numberOfDays) / 7);
        return `${now.getFullYear()}-${weekNum}`;
    },

    checkWeek() {
        const currentWeek = this.getWeekID();
        
        // Миграция: у кого осталась старая цель (случайная 4-10 ч или 5 ч) — ставим 8 ч
        if (DB.user.weeklyQuest && DB.user.weeklyQuest.weekId === currentWeek &&
            DB.user.weeklyQuest.targetSec !== this.TARGET_HOURS * 3600) {
            DB.user.weeklyQuest.targetSec = this.TARGET_HOURS * 3600;
            Data.save();
        }
        
        // Если квеста еще нет или наступила новая неделя
        if (!DB.user.weeklyQuest || DB.user.weeklyQuest.weekId !== currentWeek) {
            
            // Фиксированная цель недели (8 часов)
            const randomHours = this.TARGET_HOURS;
            
            DB.user.weeklyQuest = {
                weekId: currentWeek,
                progressSec: 0,
                targetSec: randomHours * 3600, // Переводим часы в секунды
                claimed: false
            };
            
            Data.save();
            console.log("📅 Новая неделя! Цель установлена на " + randomHours + " ч.");
        }
    },

    update(seconds) {
        this.checkWeek();
        if (DB.user.weeklyQuest.claimed) return;
        DB.user.weeklyQuest.progressSec += seconds;
        Data.save();
        if (document.getElementById('dashboard').classList.contains('active')) this.render();
    },

    render() {
        const container = document.getElementById('weekly-quest-container');
        if (!container) return;
        this.checkWeek();
        const q = DB.user.weeklyQuest;
        
        const pct = Math.min(100, (q.progressSec / q.targetSec) * 100);
        const isDone = q.progressSec >= q.targetSec;
        const hoursLeft = Math.max(0, ((q.targetSec - q.progressSec) / 3600).toFixed(1));

        container.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, var(--surface), #f0f3ff); border: 2px solid ${isDone ? 'var(--gold)' : 'transparent'}; position: relative; overflow: hidden; margin-top: 20px;">
                <h3 style="margin-bottom: 5px; font-size: 16px;">📅 Недельный Марафон</h3>
                <p style="font-size: 12px; color: var(--text-light); margin-bottom: 15px;">
                    ${isDone ? 'Цель достигнута! Забирай награду.' : `Осталось учиться: <b>${hoursLeft} ч.</b> на этой неделе`}
                </p>
                
                <div style="height: 12px; background: var(--bg); border-radius: 6px; overflow: hidden; margin-bottom: 15px;">
                    <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--primary), #a29bfe); transition: 1s;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 900; color: var(--primary); font-size: 14px;">
                        ${Math.floor(q.progressSec / 3600)} / ${Math.round(q.targetSec / 3600)} ч.
                    </div>
                    ${isDone && !q.claimed ? 
                        `<button class="btn btn-primary" onclick="WeeklyQuestSys.claim()" style="padding: 8px 20px; width: auto; background: var(--gold); color: #000;">🎁 ЗАБРАТЬ ${this.REWARD} 💰</button>` : 
                        (q.claimed ? '<b style="color:var(--success);">✅ НАГРАДА ВЗЯТА</b>' : `<span style="font-size:11px; opacity:0.6;">Награда: ${this.REWARD} 💰</span>`)
                    }
                </div>
            </div>`;
    },

    claim() {
        if (DB.user.weeklyQuest.claimed) return;
        const reward = this.REWARD;
        DB.user.weeklyQuest.claimed = true;
        DB.user.coins += reward;
        App.addXP(500);
        Data.save();
        App.updateUI();
        this.render();
        SoundSys.play('level_up');
        FX.confetti();
        App.toast(`🏆 Марафон недели пройден! +${reward} 💰`);
    }
};
    
    const MathGame = { 
        ans:0, show(isCheck=false) { 
            const a=Math.floor(Math.random()*9)+2, b=Math.floor(Math.random()*9)+2; this.ans = a*b; 
            document.getElementById('math-problem').
            innerText = `${a} x ${b} = ?`; 
            document.getElementById('math-answer').value = ''; 
            document.getElementById('modal-title').innerText = isCheck?"👮 Проверка":"🧠 Задача"; 
            document.getElementById('modal-msg').innerText = isCheck?"Вы долго учились. Подтвердите присутствие.":""; 
            document.getElementById('math-modal').classList.add('show'); 
            document.getElementById('math-answer').focus(); }, 
                check() { if(parseInt(document.getElementById('math-answer').value) === this.ans) { 
                    document.getElementById('math-modal').classList.remove('show'); 
                    Timer.start(); } else { 
                        document.getElementById('math-answer').style.borderColor='red'; 
                        SoundSys.play('error'); } } };

    
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

    

    const TimeGuard = {
    serverOffset: 0,
    isSyncing: false,

    async sync() {
        this.isSyncing = true;
        
        // 1. Берем пояс из настроек; 'auto' = не синхронизируемся по сетевой зоне, только точное время
        const userTZ = (window.DB && DB.user && DB.user.timezone && DB.user.timezone !== 'auto')
            ? DB.user.timezone
            : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        
        // 2. Вставляем этот пояс в ссылку
        const url = `https://timeapi.io/api/Time/current/zone?timeZone=${userTZ}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const response = await fetch(url, { cache: "no-store", signal: controller.signal });
            const data = await response.json();
            clearTimeout(timeoutId);
            
            // 🛡️ FIX (+120 мин при смене пояса): API возвращает МЕСТНОЕ время
            // выбранной зоны БЕЗ маркера зоны ("2026-09-18T18:30:58"). Старый код
            // делал new Date(data.dateTime), и браузер парсил это как ЛОКАЛЬНОЕ
            // время устройства. При смене пояса (Москва → Ташкент = +2ч) офсет
            // прыгал ровно на разницу зон, и идущий таймер мгновенно получал +120 мин.
            //
            // Правильно: собираем UTC-время из ПОЛЕЙ ответа (API отдаёт их как
            // составляющие времени ВЫБРАННОЙ зоны) и вычитаем зону вручную.
            const tzOffsetMin = this._getZoneOffsetMinutes(data.timeZone || userTZ);
            const asUTC = Date.UTC(
                data.year, data.month - 1, data.day,
                data.hour, data.minute, data.seconds, data.milliSeconds || 0
            );
            const serverTime = asUTC - tzOffsetMin * 60000; // → истинный UTC-мгновенный момент
            
            const newOffset = serverTime - Date.now();
            
            // 🛡️ ЗАЩИТА ОТ СКАЧКА: реальная разница зон меняется редко, а вот
            // подмена часов или кривой ответ API — запросто. Если офсет прыгнул
            // больше чем на 5 минут между синхронизациями — не применяем его
            // немедленно (иначе идущий таймер улетит). Ограничиваем шаг.
            const drift = Math.abs(newOffset - (this.serverOffset || 0));
            if (this.serverOffset !== 0 && drift > 5 * 60000) {
                console.warn(`⚠️ Прыжок офсета ${drift}ms отклонён (смена зоны НЕ должна двигать время). Старый офсет оставлен.`);
            } else {
                this.serverOffset = newOffset;
            }
            
            console.log(`✅ Синхронизация с ${userTZ}. Офсет: ${this.serverOffset}ms`);
        } catch (e) {
            console.warn("⚠️ Ошибка синхронизации, используем локальное время.");
            this.serverOffset = 0;
        }
        this.isSyncing = false;
    },

    // 🛡️ Смещение зоны в минутах (как getTimezoneOffset, но для ЛЮБОЙ IANA-зоны).
    // formatToParts даёт «настенное» время зоны; сравнение с UTC даёт смещение.
    _getZoneOffsetMinutes(tz) {
        try {
            const now = Date.now();
            const dtf = new Intl.DateTimeFormat('en-US', {
                timeZone: tz, hour12: false,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const parts = {};
            dtf.formatToParts(new Date(now)).forEach(p => { parts[p.type] = p.value; });
            const asUTC = Date.UTC(
                +parts.year, +parts.month - 1, +parts.day,
                +parts.hour % 24, +parts.minute, +parts.second
            );
            return Math.round((asUTC - now) / 60000);
        } catch (e) {
            return 0; // неизвестная зона — считаем UTC
        }
    },

    getTrueTime() {
        // Возвращает истинный момент времени (UTC-эпоха) с поправкой на
        // расхождение часов устройства и сервера. НЕ зависит от выбора пояса.
        return Date.now() + this.serverOffset;
    }
};

    const SecretSys = {
        logoTaps: 0,
            versionClicks: 0, // Счетчик для кодов
        // Вызов окна ввода кода
        triggerPrompt() {
            this.versionClicks++;
            
            // Маленькая подсказка при нажатиях
            if (this.versionClicks < 5) {
                App.toast(`Еще ${5 - this.versionClicks}...`);
            }

            if (this.versionClicks === 5) {
                // Награда за открытие меню кодов
                if (!DB.user.isVersionRewardClaimed) {
                    DB.user.coins += 100;
                    DB.user.isVersionRewardClaimed = true;
                    Data.save();
                    App.updateUI();
                    App.toast("💰 Меню взлома открыто: +100 монет!");
                    FX.confetti();
                }

                const code = prompt("Введите секретный код:");
                if (code) this.checkCode(code);
                this.versionClicks = 0; 
            }
        },

        checkCode(input) {
            const code = input.toUpperCase().trim();
            
            if (code === 'MATRIX') {
                document.body.style.transition = "5s linear";
                document.body.style.transform = "skewX(5deg) rotateY(10deg)";
                App.toast("🕶️ Система взломана...");
            }
            
            if (code === 'RAINBOW') {
                App.toast("🌈 Режим ВЕЧЕРИНКИ!");
                setInterval(() => {
                    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)].id;
                    DB.user.theme = randomTheme;
                    App.updateUI();
                }, 1000);
            }

            if (code === 'GOLD') {
                DB.user.coins += 1000;
                Data.save();
                App.updateUI();
                App.toast("💰 Читы активированы!");
            }
        },

        // 1. Обработка кликов по логотипу
        handleLogoClick() {
            this.logoTaps++;
            const logo = document.querySelector('.app-logo');
            if (logo) {
                logo.classList.add('logo-spin');
                setTimeout(() => logo.classList.remove('logo-spin'), 500);
            }

            if (this.logoTaps === 10) {
                this.showCredits();
                
                // Награда за нахождение пасхалки
                if (!DB.user.isLogoRewardClaimed) {
                    DB.user.coins += 100;
                    DB.user.isLogoRewardClaimed = true;
                    Data.save();
                    App.updateUI();
                    App.toast("💰 Награда за любопытство: +100 монет!");
                    FX.confetti();
                    SoundSys.play('win');
                }
                this.logoTaps = 0;
            }
        },

        // 2. Секретные коды (вводить в консоль или в поле имени)
        checkCode(input) {
            const code = input.toUpperCase();
            if (code === 'MATRIX') {
                document.body.style.filter = 'matrix(1, 2, -1, 1, 80, 80)'; // Шуточный эффект
                App.toast("🕶️ Welcome to the Matrix");
            }
            if (code === 'RAINBOW') {
                setInterval(() => {
                    DB.user.theme = THEMES[Math.floor(Math.random() * THEMES.length)].id;
                    App.updateUI();
                }, 1000);
                App.toast("🌈 PARTY MODE!");
            }
        },

        showCredits() {
            // Показываем окно
            alert("💎 ВЫ НАШЛИ ПАСКАХЛКУ \n\nРазработка: Rustam Mansurov\nВерсия: 1.0 (PRO Edition)\n\nСпасибо, что используете наше приложение для достижения своих целей!");
            FX.confetti();
            // Запускаем эффекты только если они доступны
            if (window.FX) FX.confetti();
            
            // Безопасный вызов звука
            try {
                SoundSys.play('level_up'); // 'level_up' звучит торжественнее для титров
            } catch(e) {
                console.log("Звук пока не готов");
            }
        },

        // Функция пасхалки в разделе "О нас"
        claimMotivationReward() {
            if (DB.user.isMotivationClaimed) {
                App.toast("😊 Ты уже заряжен на успех!");
                return;
            }

            DB.user.coins += 100;
            DB.user.isMotivationClaimed = true; // Помечаем как использованную
            
            Data.save();
            App.updateUI();
            
            // Праздничные эффекты
            FX.confetti();
            SoundSys.play('win');
            App.toast("💰 Пасхалка найдена! +100 монет за веру в себя!");
        }
    };

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
    // Делаем эти объекты доступными для кнопок в HTML
        window.App = App;
        window.Auth = Auth;
        window.Timer = Timer;
        window.Trainer = Trainer;
        window.QuestSys = QuestSys;
        window.DailySys = DailySys;
        window.BattleSys = BattleSys;
        window.Donation = Donation;
        window.Transfer = Transfer;
        window.Whiteboard = Whiteboard;
        window.Calc = Calc;
        window.SecretSys = SecretSys;
        window.WeeklyReportSys = WeeklyReportSys;
        window.AchievementSys = AchievementSys;

        // === УМНЫЙ ЭКРАН ЗАГРУЗКИ ===
    window.onload = () => {
        const bar = document.getElementById('splash-bar');
        const screen = document.getElementById('splash-screen');
        const text = document.getElementById('splash-text');
        let progress = 0;

        // 1. Анимация прогресса
        const loadingInterval = setInterval(() => {
            // Прибавляем по чуть-чуть для плавности
            if (progress < 90) {
                progress += Math.random() * 1.5; // Случайный шаг от 0 до 1.5%
            }
            
            if (bar) bar.style.width = progress + "%";

            // Меняем тексты в зависимости от процента
            if (progress > 10 && progress < 40) if (text) text.innerText = "Инициализация модулей...";
            if (progress > 40 && progress < 70) if (text) text.innerText = "Подключение к облаку...";
            if (progress > 70 && progress < 90) if (text) text.innerText = "Проверка синхронизации...";
        }, 50); // Частое обновление (20 раз в секунду) для идеальной плавности

        // 2. Логика запуска систем
        Auth.init();
        InstallSys.init();

        const startApp = async () => {
            const lastId = localStorage.getItem('LastUserId');
            
            try {
                if (lastId) {
                    // Пытаемся войти (функция login сама подождет базу внутри)
                    await Auth.login(lastId);
                }
            } catch (e) {
                console.error("Ошибка авто-входа:", e);
            }

            // Когда всё готово (база ответила и логин прошел)
            clearInterval(loadingInterval); // Останавливаем медленный таймер
            
            if (bar) bar.style.width = "100%"; // Мгновенно доводим до конца
            if (text) text.innerText = "Вход выполнен! 🚀";

            // Плавно скрываем экран
            setTimeout(() => {
                if (screen) {
                    screen.style.transition = "opacity 0.8s ease-out, visibility 0.8s";
                    screen.style.opacity = '0';
                    screen.style.visibility = 'hidden';
                    // Удаляем из DOM через 1 секунду после начала затухания
                    setTimeout(() => screen.remove(), 1000);
                }
            }, 400);
        };

        startApp();
    };

    // ===== АНТИ-АФК: проверка каждые 20 минут =====
    let afkTimer = null;
    let afkPromptActive = false;
    const AFK_INTERVAL = 35 * 60 * 1000; // 35 минут
    const PROMPT_TIMEOUT = 30 * 1000;    // 30 секунд на ответ

    function startAfkCheck() {
        if (afkTimer) clearTimeout(afkTimer);
        afkTimer = setTimeout(showAfkPrompt, AFK_INTERVAL);
    }

    function stopAfkCheck() {
        if (afkTimer) {
            clearTimeout(afkTimer);
            afkTimer = null;
        }
        afkPromptActive = false;
        hideAfkPrompt();
    }

    function showAfkPrompt() {
        if (afkPromptActive || !Timer.isRunning) return;
        afkPromptActive = true;

        const prompt = document.createElement('div');
        prompt.id = 'afk-prompt';
        prompt.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface);
            padding: 15px 25px;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.4);
            z-index: 999;
            text-align: center;
            max-width: 90vw;
        `;
        prompt.innerHTML = `
            <p style="margin:0 0 10px; font-weight:bold;">Продолжаешь учиться? 😊</p>
            <p style="margin:0 0 15px; font-size:14px;">Нажми "Да" в течение 30 секунд</p>
            <button onclick="confirmAfk()" class="btn btn-primary" style="margin-right:10px;">Да, продолжаю!</button>
            <button onclick="pauseAfk()" class="btn btn-outline">Я отошёл</button>
        `;
        document.body.appendChild(prompt);

        setTimeout(() => {
            if (afkPromptActive) pauseAfk();
        }, PROMPT_TIMEOUT);
    }

    function confirmAfk() {
        afkPromptActive = false;
        hideAfkPrompt();
        startAfkCheck();
        App.toast("Круто! Продолжаем 💪");
    }

    function pauseAfk() {
        afkPromptActive = false;
        hideAfkPrompt();
        Timer.pause();
        App.toast("Таймер на паузе. Возобнови когда вернёшься!");
    }

    function hideAfkPrompt() {
        const prompt = document.getElementById('afk-prompt');
        if (prompt) prompt.remove();
    }

    // Подключаем к таймеру (если у тебя Timer — объект)
    if (typeof Timer !== 'undefined') {
        const originalStart = Timer.start;
        Timer.start = function() {
            originalStart?.apply(this, arguments);
            startAfkCheck();
        };

        const originalPause = Timer.pause;
        Timer.pause = function() {
            originalPause?.apply(this, arguments);
            stopAfkCheck();
        };

        const originalStop = Timer.stop;
        Timer.stop = function() {
            originalStop?.apply(this, arguments);
            stopAfkCheck();
        };
    }

    // ===== ПРЕДМЕТЫ: ПЕРЕМЕЩЕНИЕ ОДНИМ КЛИКОМ — ФИНАЛЬНЫЙ ВАРИАНТ =====
// 🛠️ ИСПРАВЛЕННАЯ СИСТЕМА ПРЕДМЕТОВ (БЕЗ БАГОВ)

// Функция отрисовки списков
let isSubjectProcessing = false; // Флаг блокировки спама

function moveSubject(id, isAlreadyAdded) {
    if (Timer.active) return App.toast("⛔️ Сначала остановите таймер!");
    if (isSubjectProcessing) return; // Если уже идет сохранение — игнорируем клик

    isSubjectProcessing = true; // Блокируем
    
    if (isAlreadyAdded) {
        if (Object.keys(DB.subjects).length <= 1) {
            isSubjectProcessing = false;
            return App.toast("Минимум 1 предмет!");
        }
        delete DB.subjects[id];
        if (DB.user.subject === id) DB.user.subject = Object.keys(DB.subjects)[0];
    } else {
        const template = ALL_SUBJECTS.find(s => s.id === id);
        if (template) {
            DB.subjects[id] = { name: template.name, icon: template.icon, sec: 0 };
        }
    }

    DB.user.lastSaveTime = Date.now(); 
    
    // Мгновенно обновляем экран (локально)
    updateSubjectLists();
    App.renderSubjects();
    App.updateUI();

    // Сохраняем в облако и разблокируем через 0.5 сек
    Data.save().then(() => {
        setTimeout(() => { isSubjectProcessing = false; }, 500);
    });
}

// 2. ЕДИНАЯ ОТРИСОВКА СПИСКОВ В НАСТРОЙКАХ
function updateSubjectLists() {
    const myGrid = document.getElementById('my-subjects-list');
    const availGrid = document.getElementById('available-subjects-list');
    if (!myGrid || !availGrid || !DB || !DB.subjects) return;

    myGrid.innerHTML = '';
    availGrid.innerHTML = '';

    // Отрисовка всегда по порядку ALL_SUBJECTS (решает проблему прыжков)
    ALL_SUBJECTS.forEach(item => {
        const isAdded = !!DB.subjects[item.id];
        const div = document.createElement('div');
        div.className = 'subject-item' + (isAdded ? ' added' : '');
        div.innerHTML = `<div class="icon">${item.icon}</div><div class="name">${item.name}</div>`;
        
        if (isAdded) {
            div.onclick = () => moveSubject(item.id, true);
            myGrid.appendChild(div);
        } else {
            div.onclick = () => moveSubject(item.id, false);
            availGrid.appendChild(div);
        }
    });
}

// 3. БЕЗОПАСНАЯ ЧИСТКА (только при загрузке)
function cleanSubjects() {
    if (!DB || !DB.subjects) return;
    
    const validIds = ALL_SUBJECTS.map(s => s.id);
    const cleaned = {};

    // Берем только те предметы, которые УЖЕ есть у пользователя
    Object.keys(DB.subjects).forEach(key => {
        const template = ALL_SUBJECTS.find(t => t.id === key);
        if (template) {
            // Обновляем только метаданные (имя/иконку), сохраняя время
            cleaned[key] = {
                name: template.name,
                icon: template.icon,
                sec: DB.subjects[key].sec || 0
            };
        }
    });

    // Если список стал совсем пустым (ошибка), даем только Алгебру
    if (Object.keys(cleaned).length === 0) {
        cleaned['algebra'] = { name: 'Алгебра', icon: '✖️', sec: 0 };
    }

    DB.subjects = cleaned;
}

// Функция перемещения предметов

    // Все предметы
    // 📚 КАТАЛОГ ВСЕХ ПРЕДМЕТОВ (Эталон)
    const ALL_SUBJECTS = [
        { id: 'algebra', name: 'Алгебра', icon: '✖️' },
        { id: 'geometry', name: 'Геометрия', icon: '📐' },
        { id: 'calculus', name: 'Мат. анализ', icon: '∫' },
        { id: 'arithmetic', name: 'Арифметика', icon: '🔢' },
        { id: 'combinatorics', name: 'Комбинаторика', icon: '🔀' },
        { id: 'statistics', name: 'Статистика', icon: '📊' },
        { id: 'trigonometry', name: 'Тригонометрия', icon: '📏' },
        { id: 'stereometry', name: 'Стереометрия', icon: '🧊' },
        { id: 'physics', name: 'Физика', icon: '⚛️' },
        { id: 'chemistry', name: 'Химия', icon: '🧪' },
        { id: 'biology', name: 'Биология', icon: '🧬' },
        { id: 'history', name: 'История', icon: '🏺' },
        { id: 'lit', name: 'Литература', icon: '📖' },
        { id: 'eng', name: 'Иностранный язык', icon: '🌐' }
    ];

    // Защита от null (самое важное!)
    if (!DB) DB = {};
    if (!DB.subjects) DB.subjects = {};

    // Очистка от пустых ключей (фикс Firebase)
    

    

    // (Дублирующая функция moveSubject удалена — используется основная выше)
   

    

    
    // Перемещение
    

// Запуск после загрузки
    setTimeout(() => {
        if (typeof updateSubjectLists === 'function') {
            updateSubjectLists();
        }
    }, 1000);
    // Важно! Вызов после загрузки профиля (добавь это в Auth.login или initAfterLogin)
    

    // ===== ПЕРЕМЕЩЕНИЕ ИЗ ПРЕСЕТА В "МОИ ПРЕДМЕТЫ" =====

    
    
    

    // Ручной перенос по коду (запасной вариант)
    function manualQRTransfer() {
        const code = document.getElementById('manual-qr-code').value.trim();
        if (!code) return App.toast("Введите код");
        Transfer.pasteCode(code);
        document.querySelector('.modal.show').remove();
    }
    Transfer.pasteCode = function(code) {
        if (!code || code.trim() === '') {
            App.toast("❌ Код пустой");
            return;
        }

        try {
            // Убираем все пробелы и переносы строк
            const cleanedCode = code.trim().replace(/\s+/g, '');

            // Декодируем base64 → текст → JSON
            const decoded = atob(cleanedCode);
            const jsonText = decodeURIComponent(escape(decoded));
            const imported = JSON.parse(jsonText);

            if (imported && imported.user && imported.subjects) {
                DB = imported;
                Data.save();
                App.toast("✅ Прогресс успешно перенесён!");
                setTimeout(() => location.reload(), 1500); // перезагрузка через 1.5 сек
            } else {
                App.toast("❌ Неверный формат данных");
            }
        } catch (e) {
            console.error("Ошибка переноса:", e);
            App.toast("❌ Ошибка чтения кода. Попробуйте скопировать заново.");
        }
    };

// Функция для обновления отладочных часов
// Улучшенная функция отладочных часов
setInterval(() => {
    const clockEl = document.getElementById('debug-clock');
    if (!clockEl) return;

    const tashkentTimestamp = TimeGuard.getTrueTime();
    const now = new Date(tashkentTimestamp);
    const userTZ = (window.DB && DB.user && DB.user.timezone && DB.user.timezone !== 'auto')
        ? DB.user.timezone
        : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + 
                    now.getMinutes().toString().padStart(2, '0') + ":" + 
                    now.getSeconds().toString().padStart(2, '0');
                    
    clockEl.innerText = `🕒 ${timeStr} (${userTZ.split('/').pop() || userTZ})`;
}, 1000);  
    
    // 🔥 ГЕНЕРАЛЬНЫЙ НАСТРОЙЩИК СБОРА
function updateFundraiser() {
    // Донат,Donate (в UZS):
    const collectedAmount = 70000 ;   
    
    const targetAmount = 500000; // Твоя цель 500к
    const percentage = Math.floor((collectedAmount / targetAmount) * 100);
    const safePercentage = Math.min(100, percentage); // Чтобы полоска не улетела дальше 100%

    // Находим элементы на странице
    const bar = document.getElementById('funding-bar-fill');
    const pctText = document.getElementById('funding-pct-text');
    const sumText = document.getElementById('funding-sum-text');

    if (bar && pctText && sumText) {
        // Применяем изменения
        bar.style.width = safePercentage + "%";
        pctText.innerText = safePercentage + "%";
        sumText.innerText = `Собрано: ${collectedAmount.toLocaleString()} UZS`;
    }
}

// Запускаем расчет сразу при загрузке и при каждом входе в настройки
window.addEventListener('load', updateFundraiser);
// Также добавим вызов в switchTab, чтобы полоска обновлялась, когда заходишь в опции
const originalSwitchTabFund = App.switchTab;
App.switchTab = function(id, btn) {
    originalSwitchTabFund.apply(this, arguments);
    if (id === 'settings') updateFundraiser();
};
    