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
