// ═══════════════════════════════════════════════════════════════
// РОДИТЕЛЬСКИЙ РЕЖИМ — вербатим-перенос из app.js и auth.js.
// ParentApp — дашборд родителя (было: методы литерала App в app.js).
// ParentUI  — вход родителя и список детей (было: методы литерала Auth).
// Зависимости (общий лексический скоуп): App, Auth, DB, Data, TimeGuard,
// getUZDate, isParentMode (storage.js), window.DB_Online.
// Подключается ПОСЛЕ app.js (порядок см. web/index.html):
// прокси в конце файла перезаписывают тонкие заглушки App/Auth.

var ParentApp = {
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

// ═══════════════════════════════════════════════════════════════
// ЧАСТЬ 2: Вход родителя и список детей (вербатим из auth.js)
// ═══════════════════════════════════════════════════════════════

var ParentUI = {
        renderParentLinks(list) {
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
        showParentLogin() {
            Auth._hideAllAuth(); // метод остался на Auth (общий для всех экранов входа)
            document.getElementById('parent-login-view').style.display = 'block';
            setTimeout(() => { const inp = document.getElementById('parent-code-input'); if(inp) inp.focus(); }, 100);
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
            Auth.renderUserList();
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
                Auth.renderUserList();
                App.toast("✅ Код обновлен");
            }
        },
};

// ═══════════════════════════════════════════════════════════════
// ПРОКСИ ДЛЯ СОВМЕСТИМОСТИ: HTML (onclick) и старый код зовут
// App.initParentView / Auth.loginAsParent — переадресуем в ParentApp/ParentUI.
// ═══════════════════════════════════════════════════════════════
App.initParentView        = (...a) => ParentApp.initParentView(...a);
App.renderParentSubjects  = (...a) => ParentApp.renderParentSubjects(...a);
App.renderParentWeek      = (...a) => ParentApp.renderParentWeek(...a);
App.renderParentHeatmap   = (...a) => ParentApp.renderParentHeatmap(...a);
App.renderParentHistory   = (...a) => ParentApp.renderParentHistory(...a);
App.renderParentProgress  = (...a) => ParentApp.renderParentProgress(...a);
App.startParentMonitoring = (...a) => ParentApp.startParentMonitoring(...a);
App.exitParentMode        = (...a) => ParentApp.exitParentMode(...a);

Auth.showParentLogin     = (...a) => ParentUI.showParentLogin(...a);
Auth.parentLoginPrompt   = (...a) => ParentUI.parentLoginPrompt(...a);
Auth.parentLoginSubmit   = (...a) => ParentUI.parentLoginSubmit(...a);
Auth.loginAsParent       = (...a) => ParentUI.loginAsParent(...a);
Auth._saveParentFcmToken = (...a) => ParentUI._saveParentFcmToken(...a);
Auth.removeParentLink    = (...a) => ParentUI.removeParentLink(...a);
Auth.updateParentCode    = (...a) => ParentUI.updateParentCode(...a);
