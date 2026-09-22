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
