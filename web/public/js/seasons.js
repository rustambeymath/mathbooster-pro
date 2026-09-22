// СЕЗОНЫ: архивация карточек при смене сезона, заморозка итогов,
// расчёт часов текущего сезона (с учётом админ-правок seasonHoursOverride).
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
