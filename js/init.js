setInterval(() => {
    const clockEl = document.getElementById('debug-clock');
    if (!clockEl) return;

    const tashkentTimestamp = TimeGuard.getTrueTime();
    const now = new Date(tashkentTimestamp);
    const userTZ = (window.DB && DB.user && DB.user.timezone && DB.user.timezone !== 'auto')
        ? DB.user.timezone
        : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + 
                    now.getMinutes().toString().padStart(2, '0') + ":" + 
                    now.getSeconds().toString().padStart(2, '0');
                    
    clockEl.innerText = `🕒 ${timeStr} (${userTZ.split('/').pop() || userTZ})`;
}, 1000);  
    
    // 🔥 ГЕНЕРАЛЬНЫЙ НАСТРОЙЩИК СБОРА
function updateFundraiser() {
    // Донат,Donate (в UZS):
    const collectedAmount = 70000 ;   
    
    const targetAmount = 500000; // Твоя цель 500к
    const percentage = Math.floor((collectedAmount / targetAmount) * 100);
    const safePercentage = Math.min(100, percentage); // Чтобы полоска не улетела дальше 100%

    // Находим элементы на странице
    const bar = document.getElementById('funding-bar-fill');
    const pctText = document.getElementById('funding-pct-text');
    const sumText = document.getElementById('funding-sum-text');

    if (bar && pctText && sumText) {
        // Применяем изменения
        bar.style.width = safePercentage + "%";
        pctText.innerText = safePercentage + "%";
        sumText.innerText = `Собрано: ${collectedAmount.toLocaleString()} UZS`;
    }
}

// Запускаем расчет сразу при загрузке и при каждом входе в настройки
window.addEventListener('load', updateFundraiser);
// Также добавим вызов в switchTab, чтобы полоска обновлялась, когда заходишь в опции
const originalSwitchTabFund = App.switchTab;
App.switchTab = function(id, btn) {
    originalSwitchTabFund.apply(this, arguments);
    if (id === 'settings') updateFundraiser();
};
