    const FX = {
        floatText(x, y, text, color) {
            const el = document.createElement('div'); 
            el.className = 'float-text';
            // Улучшаем стиль вылетающего текста
            el.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                color: ${color || '#FFD700'};
                font-weight: 900;
                font-size: 24px;
                pointer-events: none;
                z-index: 9999;
                text-shadow: 0 4px 10px rgba(0,0,0,0.2);
                transition: all 1s ease-out;
            `;
            el.innerText = text;
            document.body.appendChild(el);

            // Запускаем анимацию через requestAnimationFrame
            requestAnimationFrame(() => {
                el.style.transform = `translateY(-100px) scale(1.5) rotate(${Math.random() * 20 - 10}deg)`;
                el.style.opacity = '0';
            });

            setTimeout(() => el.remove(), 1000);
        },
        confetti() {
            const colors = ['#FFD700', '#FF7675', '#6C63FF', '#00d26a', '#ffffff'];
            for(let i=0; i<100; i++) { // Увеличиваем количество до 100
                const el = document.createElement('div'); 
                el.className = 'confetti-piece';
                el.style.cssText = `
                    position: fixed;
                    width: ${Math.random() * 10 + 5}px;
                    height: ${Math.random() * 10 + 5}px;
                    background: ${colors[Math.floor(Math.random()*colors.length)]};
                    left: ${Math.random() * 100}vw;
                    top: -10px;
                    opacity: ${Math.random()};
                    z-index: 99999;
                    pointer-events: none;
                    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                    animation: fall ${Math.random() * 3 + 2}s linear forwards;
                `;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 5000);
            }
        }
    };
