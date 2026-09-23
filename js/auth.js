// АВТОРИЗАЦИЯ: профили учеников, вход, восстановление по коду.
// Родительский режим (вход и список детей) — см. js/parent.js.
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

        // 2. Список профилей детей для родителя — js/parent.js (ParentUI.renderParentLinks)
        if (window.ParentUI) ParentUI.renderParentLinks(list);
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

        // Экран входа родителя перенесён в js/parent.js (ParentUI)

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
            // 😴 Хук восстановления таймера после сна/блокировки телефона и
            // перезагрузки страницы (visibilitychange/focus/pageshow)
            if (window.Timer && Timer.initBackgroundRecovery) Timer.initBackgroundRecovery();
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
