    const PWA = {
        prompt: null,
        init() {
            window.addEventListener('beforeinstallprompt', (e) => {
                // Блокируем системный всплывающий баннер (отсюда и идет предупреждение в консоли - это нормально)
                e.preventDefault(); 
                this.prompt = e;
                
                // Показываем вашу красивую карточку установки
                const installCard = document.getElementById('install-promo-card');
                if (installCard) installCard.style.display = 'block';
            });
        },
        install() {
            if(this.prompt) {
                this.prompt.prompt(); // Вызываем системное окно установки Android/Chrome
                this.prompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        const installCard = document.getElementById('install-promo-card');
                        if (installCard) installCard.style.display = 'none'; 
                    }
                    this.prompt = null;
                });
            }
        }
    };
    const MusicPlayer = {
        playing: false,
        audio: null,
        
        init() { 
            this.audio = document.getElementById('lofi-stream'); 
            this.audio.addEventListener('ended', () => this.reset());
            this.audio.addEventListener('error', (e) => {
                App.toast("❌ Ошибка радио. Попробуйте позже.");
                this.reset();
            });
        },

        reset() {
            this.playing = false;
            const btn = document.getElementById('music-btn');
            const vis = document.getElementById('music-vis');
            if(btn) btn.innerText = "▶";
            if(vis) vis.style.opacity = "0";
        },

        toggle() {
            if (!this.audio) this.audio = document.getElementById('lofi-stream');
            const currentId = DB.user.currentRadio || (DB.user.ownedRadios ? DB.user.ownedRadios[0] : null);
            if (!currentId) return App.toast("Купите радио в магазине!");
            const station = SHOP_RADIOS.find(x => x.id === currentId);
            
            const btn = document.getElementById('music-btn');
            const vis = document.getElementById('music-vis');
            
            if(this.playing) {
                // ПАУЗА
                this.audio.pause(); this.playing = false;
                if(btn) btn.innerText = "▶"; 
                if(vis) vis.style.opacity = "0";
            } else {
                // ПЛЕЙ
                if (this.audio.src !== station.url) { this.audio.src = station.url; this.audio.load(); }
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    if(btn) btn.innerText = "⏳";
                    playPromise.then(_ => {
                        this.playing = true; 
                        if(btn) btn.innerText = "⏸"; 
                        if(vis) vis.style.opacity = "1";
                    }).catch(e => { 
                        App.toast("Ошибка потока 📻"); 
                        if(btn) btn.innerText = "▶"; 
                    });
                }
            }
        }
    };

    const SoundSys = {
    ctx: null, 
    enabled: true,
    lastPlayTime: {}, // ← ДОБАВИТЬ
    
    init() { 
        try { 
            const AudioContext = window.AudioContext || window.webkitAudioContext; 
            this.ctx = new AudioContext(); 
        } catch(e) {} 
    },
    
    toggleSFX(val) { 
        this.enabled = val; 
        DB.settings.sfx = val; 
        Data.save(); 
        if(val) this.play('click'); 
    },
    
    play(type) {
        if(!this.enabled || !this.ctx) return; 
        if(this.ctx.state === 'suspended') this.ctx.resume();
        
        // 🔒 ЗАЩИТА ОТ СПАМА (минимум 50мс между одинаковыми звуками)
        const now = Date.now();
        if (this.lastPlayTime[type] && now - this.lastPlayTime[type] < 50) {
            return; // Игнорируем слишком частые вызовы
        }
        this.lastPlayTime[type] = now;
        
        const t = this.ctx.currentTime; 
        const osc = this.ctx.createOscillator(); 
        const gain = this.ctx.createGain();
        
        osc.connect(gain); 
        gain.connect(this.ctx.destination);

        const pack = (DB && DB.user && DB.user.soundPack) ? DB.user.soundPack : 'standard';

        if (type === 'quest_done') {
            [523, 659, 783, 1046].forEach((f, i) => {
                this.beep(f, t + i * 0.1, 0.1);
            });
            return;
        }

        if (type === 'level_up') {
            [523, 523, 523, 1046].forEach((f, i) => {
                this.beep(f, t + i * 0.15, i === 3 ? 0.5 : 0.1);
            });
            return;
        }
        
        // --- 🕹️ 8-BIT (РЕТРО) ---
        if (pack === 'retro') {
            osc.type = 'square'; 
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

            if (type === 'click') { osc.frequency.setValueAtTime(440, t); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'coin')  { osc.frequency.setValueAtTime(900, t); osc.frequency.linearRampToValueAtTime(1800, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'success') { osc.frequency.setValueAtTime(500, t); osc.frequency.setValueAtTime(1000, t+0.1); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'error') { osc.frequency.setValueAtTime(150, t); osc.frequency.linearRampToValueAtTime(50, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'win')   { osc.frequency.setValueAtTime(500, t); osc.frequency.linearRampToValueAtTime(1500, t+0.3); osc.start(t); osc.stop(t+0.3); }
            else if (type === 'sword') { osc.frequency.setValueAtTime(1200, t); osc.frequency.linearRampToValueAtTime(600, t+0.1); osc.start(t); osc.stop(t+0.15); }
            else if (type === 'hit') { osc.frequency.setValueAtTime(100, t); osc.frequency.linearRampToValueAtTime(40, t+0.1); osc.start(t); osc.stop(t+0.15); }
            else if (type === 'critical') { osc.frequency.setValueAtTime(1500, t); osc.frequency.linearRampToValueAtTime(100, t+0.2); osc.start(t); osc.stop(t+0.2); }
        }
        
        // --- 🧼 BUBBLE (БУЛЬК) ---
        else if (pack === 'bubble') {
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.15);

            if (type === 'click') { osc.frequency.setValueAtTime(300, t); osc.frequency.linearRampToValueAtTime(600, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'coin')  { osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(1200, t+0.15); osc.start(t); osc.stop(t+0.15); }
            else { osc.frequency.setValueAtTime(400, t); osc.start(t); osc.stop(t+0.1); }
        }

        // --- 🚀 SCI-FI (КОСМОС) ---
        else if (pack === 'sci-fi') {
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

            if (type === 'click') { osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t+0.1); osc.start(t); osc.stop(t+0.1); }
            else if (type === 'sword') { osc.type = 'square'; osc.frequency.setValueAtTime(3000, t); osc.frequency.exponentialRampToValueAtTime(500, t+0.15); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'hit') { osc.type = 'sine'; osc.frequency.setValueAtTime(80, t); osc.frequency.linearRampToValueAtTime(30, t+0.2); gain.gain.setValueAtTime(0.15, t); gain.gain.linearRampToValueAtTime(0, t+0.2); osc.start(t); osc.stop(t+0.2); }
            else if (type === 'critical') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(5000, t); osc.frequency.exponentialRampToValueAtTime(100, t+0.25); gain.gain.setValueAtTime(0.05, t); gain.gain.exponentialRampToValueAtTime(0.001, t+0.3); osc.start(t); osc.stop(t+0.3); }
            else { osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(800, t+0.3); osc.start(t); osc.stop(t+0.3); }
        }

        else if (pack === 'mechanical') {
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.1, t);
            if (type === 'click') { 
                osc.frequency.setValueAtTime(150, t); 
                osc.start(t); osc.stop(t+0.05); 
            } else if (type === 'sword') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, t); osc.frequency.linearRampToValueAtTime(400, t+0.1); gain.gain.setValueAtTime(0.08, t); gain.gain.linearRampToValueAtTime(0, t+0.12); osc.start(t); osc.stop(t+0.12);
            } else if (type === 'hit') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(100, t); osc.frequency.linearRampToValueAtTime(50, t+0.15); gain.gain.setValueAtTime(0.12, t); gain.gain.linearRampToValueAtTime(0, t+0.15); osc.start(t); osc.stop(t+0.15);
            } else if (type === 'critical') {
                osc.type = 'square'; osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(100, t+0.2); gain.gain.setValueAtTime(0.06, t); gain.gain.linearRampToValueAtTime(0, t+0.2); osc.start(t); osc.stop(t+0.2);
            } else { 
                osc.frequency.setValueAtTime(300, t); 
                osc.start(t); osc.stop(t+0.1); 
            }
        }
        
        // --- 💜 STANDARD (КЛАССИКА) ---
        else {
            if(type === 'click') { 
                osc.type = 'sine'; 
                osc.frequency.setValueAtTime(800, t); 
                osc.frequency.exponentialRampToValueAtTime(1200, t+0.1); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.1); 
                osc.start(t); 
                osc.stop(t+0.1); 
            }
            else if(type === 'coin') { 
                osc.type = 'sine'; 
                osc.frequency.setValueAtTime(1200, t); 
                osc.frequency.exponentialRampToValueAtTime(1800, t+0.3); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.linearRampToValueAtTime(0, t+0.5); 
                osc.start(t); 
                osc.stop(t+0.5); 
            }
            else if(type === 'success') { 
                this.beep(523.25, t, 0.1); 
                this.beep(659.25, t+0.1, 0.1); 
                this.beep(783.99, t+0.2, 0.2); 
            }
            else if(type === 'error') { 
                osc.type = 'sawtooth'; 
                osc.frequency.setValueAtTime(150, t); 
                osc.frequency.linearRampToValueAtTime(100, t+0.3); 
                gain.gain.setValueAtTime(0.1, t); 
                gain.gain.linearRampToValueAtTime(0, t+0.3); 
                osc.start(t); 
                osc.stop(t+0.3); 
            }            else if(type === 'win') { 
                this.beep(523.25, t, 0.15); 
                this.beep(523.25, t+0.15, 0.15); 
                this.beep(523.25, t+0.30, 0.15); 
                this.beep(659.25, t+0.45, 0.4); 
            }
            else if(type === 'sword') {
                // ⚔️ Звон меча — резкий металлический звук
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(1800, t);
                osc.frequency.exponentialRampToValueAtTime(800, t+0.08);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.15);
                osc.start(t); osc.stop(t+0.15);
                // Второй тон — эхо металла
                this.beep(2200, t+0.02, 0.06);
                this.beep(1200, t+0.05, 0.08);
            }
            else if(type === 'hit') {
                // 💥 Удар — глухой низкий звук
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.linearRampToValueAtTime(60, t+0.15);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.linearRampToValueAtTime(0, t+0.2);
                osc.start(t); osc.stop(t+0.2);
            }
            else if(type === 'critical') {
                // 🔥 Критический удар — комбо sword+hit
                osc.type = 'square';
                osc.frequency.setValueAtTime(2000, t);
                osc.frequency.exponentialRampToValueAtTime(200, t+0.15);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t+0.2);
                osc.start(t); osc.stop(t+0.2);
                this.beep(100, t+0.05, 0.15);
            }

            }
    },
    
    // Вспомогательная функция для стандартных звуков
    beep(freq, time, dur) { 
        const osc = this.ctx.createOscillator(); 
        const gain = this.ctx.createGain(); 
        osc.connect(gain); 
        gain.connect(this.ctx.destination); 
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(freq, time); 
        gain.gain.setValueAtTime(0.1, time); 
        gain.gain.linearRampToValueAtTime(0, time+dur); 
        osc.start(time); 
        osc.stop(time+dur); 
    }
};
