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
