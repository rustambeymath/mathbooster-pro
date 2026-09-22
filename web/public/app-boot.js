
        // 📱 АДАПТАЦИЯ ТЕКСТА ЗАДАЧИ ПОД ТЕЛЕФОН:
        // следим за текстом примера — длинные предложения (Проценты и др.)
        // получают класс .compact, чтобы переноситься и помещаться в окно
        (function() {
            function fitProblem(el) {
                if (!el) return;
                const t = el.textContent || '';
                if (t.length > 18) {
                    el.classList.add('compact');
                } else {
                    el.classList.remove('compact');
                }
            }
            const gp = document.getElementById('game-problem');
            if (gp) fitProblem(gp);
            const mo = new MutationObserver(function(muts) {
                muts.forEach(function(m) {
                    if (m.type === 'characterData' || m.type === 'childList') {
                        fitProblem(m.target.nodeType === 1 ? m.target : m.target.parentElement);
                    }
                });
            });
            const opts = { characterData: true, childList: true, subtree: true };
            if (gp) mo.observe(gp, opts);
        })();

        // 🛡️ ЗАЩИТА ОТ КОПИРОВАНИЯ
        document.addEventListener('contextmenu', event => event.preventDefault()); // Блок правой кнопки

        document.onkeydown = function(e) {
            // Блок F12
            if (e.keyCode == 123) return false;
            
            // Блок Ctrl+U (Просмотр кода)
            if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
            
            // Блок Ctrl+Shift+I (Консоль)
            if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
        }

        // === УНИВЕРСАЛЬНЫЕ ЗВУКИ ДЛЯ ВСЕХ КНОПОК И КАРТОЧЕК ===
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем звук ко ВСЕМ кнопкам
    const addClickSound = () => {
        // === ЕДИНАЯ СИСТЕМА ЗВУКОВ (БЕЗ ДУБЛИРОВАНИЯ) ===
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .btn, .nav-btn, .shop-item, .subject-item-fixed');
    if (!target || target.disabled) return;

    const text = target.innerText.toLowerCase();
    let played = false;

    if (text.includes('💰') || text.includes('купить') || text.includes('забрать')) {
        SoundSys.play('coin'); played = true;
    } 
    else if (text.includes('✅') || text.includes('✓') || text.includes('готов')) {
        SoundSys.play('success'); played = true;
    }
    else if (text.includes('❌') || text.includes('удалить') || text.includes('сдаться')) {
        SoundSys.play('error'); played = true;
    }
    else if (text.includes('старт') || text.includes('🚀')) {
        SoundSys.play('win'); played = true;
    }

    // Если ни один спец-звук не сыграл — играем обычный клик
    if (!played) {
        SoundSys.play('click');
    }

    // Вибрация
    if (navigator.vibrate) navigator.vibrate(10);
}, true);
        // Все кнопки
        document.querySelectorAll('button, .btn, .nav-btn').forEach(btn => {
            if (!btn.dataset.soundAttached) {
                btn.addEventListener('click', (e) => {
                    // Не играем звук, если кнопка заблокирована
                    if (!btn.disabled) {                        
                        // Вибрация на мобильных
                        if (navigator.vibrate) {
                            navigator.vibrate(10);
                        }
                    }
                });
                btn.dataset.soundAttached = 'true';
            }
        });

        // Все кликабельные карточки
        document.querySelectorAll('.card[onclick], .shop-item, .subject-item, .subject-item-fixed, .user-list-item, .ach-row, .mode-btn, .daily-day, .preset-btn').forEach(item => {
            if (!item.dataset.soundAttached) {
                item.addEventListener('click', () => {
                    SoundSys.play('click');
                    if (navigator.vibrate) navigator.vibrate(10);
                });
                item.dataset.soundAttached = 'true';
            }
        });

        // Все инпуты (при фокусе)
        document.querySelectorAll('input, textarea, select').forEach(input => {
            if (!input.dataset.soundAttached) {
                input.addEventListener('focus', () => {
                    // Не играем звук для input на экране входа (дублирует глобальный клик)
                    if (!input.closest('#auth-screen')) {
                        SoundSys.play('click');
                    }
                });
                input.dataset.soundAttached = 'true';
            }
        });
    };

    // Запускаем сразу
    addClickSound();

    // Перезапускаем каждые 2 секунды (для динамически созданных элементов)
    setInterval(addClickSound, 2000);
});
document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (target && target.innerText.includes('ЗАБРАТЬ')) {
        setTimeout(() => SoundSys.play('coin'), 100);
    }
});

// Звук при покупке темы, аватара, смене предмета
window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof App !== 'undefined' && App.buyTheme) {
            const originalBuyTheme = App.buyTheme;
            App.buyTheme = function(id) {
                const result = originalBuyTheme.call(this, id);
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                return result;
            };

            const originalBuyAvatar = App.buyAvatar;
            App.buyAvatar = function(id) {
                const result = originalBuyAvatar.call(this, id);
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                return result;
            };

            const originalSelectSubject = App.selectSubject;
            App.selectSubject = function(key, event) {
                const result = originalSelectSubject.call(this, key, event);
                if (navigator.vibrate) navigator.vibrate(15);
                return result;
            };
        }
    }, 3000);
});
    