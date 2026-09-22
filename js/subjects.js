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
