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
