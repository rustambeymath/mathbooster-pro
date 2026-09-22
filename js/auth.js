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
