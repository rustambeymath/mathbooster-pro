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
