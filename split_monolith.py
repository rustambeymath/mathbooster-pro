# -*- coding: utf-8 -*-
"""Механический сплит монолита index.html на модули (без изменения кода).

Стратегия безопасности:
- JS выносится ВЕРБАТИМ в отдельные классические скрипты (общий глобальный
  лексический скоуп сохраняется, порядок выполнения = исходному).
- CSS выносится вербатим в .css файлы.
- Firebase type="module" — единственный бандлится Vite (нет inline-обработчиков).
- web/index.html отличается от оригинала ТОЛЬКО заменой inline-блоков на src/href
  и переносом <noscript> Метрики из <head> в <body> (иначе HTML-парсер Vite
  падает; поведение в браузере идентично).
- Реконструкция проверяется побайтово на каждом шаге.
"""
import re, sys, hashlib, pathlib

sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).parent
WEB = ROOT / 'web'
src = (ROOT / 'index.html').read_text(encoding='utf-8')
H = lambda s: hashlib.sha256(s.encode()).hexdigest()[:16]

# ── 1. Найти все inline-скрипты (спаны от ИСХОДНОГО src) ─────────────────────
script_re = re.compile(r'<script\b([^>]*)>(.*?)</script>', re.DOTALL)
scripts = []
for m in script_re.finditer(src):
    attrs, inner = m.group(1), m.group(2)
    if 'src=' in attrs:          # CDN-подключения не трогаем
        continue
    scripts.append({'attrs': attrs, 'span': m.span(), 'inner': inner})

assert len(scripts) == 5, f'ожидалось 5 inline-скриптов, найдено {len(scripts)}'

module = next(s for s in scripts if 'type="module"' in s['attrs'])
ios    = next(s for s in scripts if 'iOS PWA' in s['inner'])
main   = max(scripts, key=lambda s: len(s['inner']))
boot   = next(s for s in scripts if 'fitProblem' in s['inner'])
assert module is not main and boot is not main and ios is not main
assert main['span'] != boot['span'] and main['span'] != ios['span']

# ── 2. Найти все <style> ─────────────────────────────────────────────────────
style_re = re.compile(r'<style>(.*?)</style>', re.DOTALL)
styles = [{'span': m.span(), 'inner': m.group(1)} for m in style_re.finditer(src)]
assert len(styles) == 3, f'ожидалось 3 <style>, найдено {len(styles)}'
style_main = max(styles, key=lambda s: len(s['inner']))
style_tut  = next(s for s in styles if 'tut-dot' in s['inner'])
style_rest = next(s for s in styles
                  if s is not style_main and s is not style_tut)

# ── 3. Замены inline-блоков на ссылки (на НЕИЗМЕННОМ src, справа налево) ─────
repl = [
    (style_main['span'], '<link rel="stylesheet" href="styles/main.css">'),
    (style_rest['span'], '<link rel="stylesheet" href="styles/dashboard.css">'),
    (style_tut['span'],  '<link rel="stylesheet" href="styles/tutorial.css">'),
    (module['span'], '<script type="module" src="/src/firebase-init.js"></script>'),
    (ios['span'],  '<script src="ios-pwa.js"></script>'),
    (main['span'], '<script src="app-core.js"></script>'),
    (boot['span'], '<script src="app-boot.js"></script>'),
]
repl.sort(key=lambda r: r[0][0], reverse=True)
html = src
for (a, b), rep in repl:
    html = html[:a] + rep + html[b:]

# ── 4. Верификация №1: обратная сборка == исходный монолит ───────────────────
back = html
back = back.replace('<script type="module" src="/src/firebase-init.js"></script>',
                    f'<script type="module">{module["inner"]}</script>')
back = back.replace('<script src="ios-pwa.js"></script>',
                    f'<script>{ios["inner"]}</script>')
back = back.replace('<script src="app-core.js"></script>',
                    f'<script>{main["inner"]}</script>')
back = back.replace('<script src="app-boot.js"></script>',
                    f'<script>{boot["inner"]}</script>')
back = back.replace('<link rel="stylesheet" href="styles/main.css">',
                    f'<style>{style_main["inner"]}</style>')
back = back.replace('<link rel="stylesheet" href="styles/dashboard.css">',
                    f'<style>{style_rest["inner"]}</style>')
back = back.replace('<link rel="stylesheet" href="styles/tutorial.css">',
                    f'<style>{style_tut["inner"]}</style>')
assert back == src, 'РЕКОНСТРУКЦИЯ НЕ СОВПАЛА!'
print(f'[OK] реконструкция байт-в-байт: {H(back)}')

# ── 5. Перенос <noscript> Метрики из <head> в <body> (после замен) ───────────
mnos = re.search(r'<noscript>.*?</noscript>', html, re.DOTALL)
assert mnos, 'noscript метрики не найден'
frag = mnos.group(0)
html_nos = html[:mnos.start()] + html[mnos.end():]
mb = re.search(r'<body[^>]*>', html_nos)
built = html_nos[:mb.end()] + '\n    ' + frag + html_nos[mb.end():]

# ── 6. Верификация №2: перенос тронул только позицию фрагмента ───────────────
assert html.count(frag) == 1 and built.count(frag) == 1
assert built.replace('\n    ' + frag, '', 1) == html.replace(frag, '', 1)
print(f'[OK] noscript перенесён в <body>, иных изменений нет: {H(built)}')

# ── 7. Запись файлов ─────────────────────────────────────────────────────────
(WEB / 'index.html').write_text(built, encoding='utf-8')
(WEB / 'src').mkdir(exist_ok=True)
(WEB / 'public' / 'styles').mkdir(parents=True, exist_ok=True)
(WEB / 'src' / 'firebase-init.js').write_text(module['inner'], encoding='utf-8')
(WEB / 'public' / 'ios-pwa.js').write_text(ios['inner'], encoding='utf-8')
(WEB / 'public' / 'app-core.js').write_text(main['inner'], encoding='utf-8')
(WEB / 'public' / 'app-boot.js').write_text(boot['inner'], encoding='utf-8')
(WEB / 'public' / 'styles' / 'main.css').write_text(style_main['inner'], encoding='utf-8')
(WEB / 'public' / 'styles' / 'dashboard.css').write_text(style_rest['inner'], encoding='utf-8')
(WEB / 'public' / 'styles' / 'tutorial.css').write_text(style_tut['inner'], encoding='utf-8')
print('[OK] записаны: web/index.html, src/firebase-init.js, public/{ios-pwa,app-core,app-boot}.js, public/styles/*.css')
for name, s in [('firebase-init', module), ('ios-pwa', ios), ('app-core', main), ('app-boot', boot)]:
    print(f'     {name}: {len(s["inner"])} символов, строки {src[:s["span"][0]].count(chr(10))+1}-{src[:s["span"][1]].count(chr(10))+1}')
