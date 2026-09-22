# -*- coding: utf-8 -*-
"""
Верификация выноса родительского режима в js/parent.js.

Проверки:
 1. Все тела методов ParentApp/ParentUI встречаются в legacy-эталоне
    (web/src/legacy/app-core.js) ПОБАЙТОВО (после нормализации \\r).
    Известные намеренные правки маскируются обратно перед сравнением.
 2. Прокси App.* / Auth.* присутствуют в parent.js.
 3. В app.js/auth.js не осталось родительских методов.
 4. Все HTML-точки входа (onclick) имеют реализацию.
 5. node --check проходит для всех 18 модулей.
Запуск:  python web/scripts/verify_parent.py   (из корня MathMaster)
"""
import subprocess, sys, os

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = os.path.join(ROOT, 'web', 'public', 'js')
LEGACY = os.path.join(ROOT, 'web', 'src', 'legacy', 'app-core.js')

norm = lambda s: s.replace('\r\n', '\n').replace('\r', '\n')
legacy = norm(open(LEGACY, encoding='utf-8').read())
parent = norm(open(os.path.join(JS, 'parent.js'), encoding='utf-8').read())

ok, fail = 0, []

def check(name, cond, detail=''):
    global ok
    if cond: ok += 1
    else: fail.append(f'{name} {detail}')

# ── 1. Тела методов verbatim из legacy ──────────────────────────────
def body(src, start_marker, end_marker):
    i = src.index(start_marker)
    j = src.index(end_marker, i)
    return src[i:j]

# Маскируем разрешённые правки (совместимость с переездом):
# 1) Auth.renderUserList() — внутри ParentUI нет этого метода
# 2) Auth._hideAllAuth() — метод остался на Auth (общий для экранов входа)
parent_for_cmp = (parent
    .replace('Auth.renderUserList();', 'this.renderUserList();')
    .replace("Auth._hideAllAuth(); // метод остался на Auth (общий для всех экранов входа)",
             'this._hideAllAuth();'))

# ParentApp: каждый метод — от "имя() {" до следующей известной границы
app_methods = ['initParentView', 'renderParentSubjects', 'renderParentWeek',
               'renderParentHeatmap', 'renderParentHistory', 'renderParentProgress',
               'startParentMonitoring', 'exitParentMode']
for m in app_methods:
    try:
        b = body(parent_for_cmp, f'{m}() {{', '\n    },')
        check(f'ParentApp.{m} verbatim', b in legacy, f'({len(b)} chars)')
    except ValueError as e:
        check(f'ParentApp.{m} extractable', False, str(e))

# ParentUI: методы от "имя(...) {" до "\n        },"
ui_methods = ['showParentLogin() {', 'parentLoginPrompt() {', 'parentLoginSubmit() {',
              'async loginAsParent(code) {', 'async _saveParentFcmToken(childUserId, childName) {',
              'removeParentLink(id, event) {', 'updateParentCode(id, event) {']
for m in ui_methods:
    try:
        b = body(parent_for_cmp, m, '\n        },')
        check(f'ParentUI.{m} verbatim', b in legacy, f'({len(b)} chars)')
    except ValueError as e:
        check(f'ParentUI.{m} extractable', False, str(e))

# renderParentLinks: внутренний фрагмент (forEach-блок) — verbatim
frag = body(parent_for_cmp, "const parentLinks = JSON.parse(localStorage.getItem('ParentLinks') || '[]');\n        if (parentLinks.length > 0) {",
            'list.appendChild(pDiv);')
check('renderParentLinks fragment verbatim', frag in legacy, f'({len(frag)} chars)')

# ── 2. Прокси ────────────────────────────────────────────────────────
proxies = ['App.initParentView', 'App.startParentMonitoring', 'App.exitParentMode',
           'Auth.showParentLogin', 'Auth.parentLoginPrompt', 'Auth.parentLoginSubmit',
           'Auth.loginAsParent', 'Auth._saveParentFcmToken', 'Auth.removeParentLink',
           'Auth.updateParentCode']
for p in proxies:
    check(f'proxy {p}', f'{p} ' in parent and '=> Parent' in parent)

# ── 3. Остатков в app.js/auth.js нет ────────────────────────────────
for f, banned in [('app.js', ['initParentView', 'startParentMonitoring', 'exitParentMode',
                              'renderParentSubjects', 'parentUnsub', 'parentTimerInterval']),
                  ('auth.js', ['loginAsParent', 'parentLoginPrompt', 'parentLoginSubmit',
                               '_saveParentFcmToken', 'removeParentLink', 'updateParentCode',
                               'showParentLogin'])]:
    src = open(os.path.join(JS, f), encoding='utf-8').read()
    for b in banned:
        check(f'{f} clean of {b}', b not in src)

# ── 4. HTML-точки входа имеют реализацию ────────────────────────────
entries = ['exitParentMode', 'parentLoginSubmit', 'showParentLogin',
           'initParentView', 'startParentMonitoring', 'loginAsParent',
           'removeParentLink', 'updateParentCode']
for e in entries:
    check(f'entry {e} implemented',
          f'{e}' in parent and (f'ParentApp.{e}' in parent or f'ParentUI.{e}' in parent))

# ── 5. Синтаксис всех модулей ───────────────────────────────────────
mods = sorted(f for f in os.listdir(JS) if f.endswith('.js'))
for m in mods:
    r = subprocess.run(['node', '--check', os.path.join(JS, m)], capture_output=True, text=True)
    check(f'node --check {m}', r.returncode == 0, r.stderr[:150])

print(f'Проверок пройдено: {ok}')
if fail:
    print(f'ПРОВАЛЕНО: {len(fail)}')
    for f in fail: print('  ✗', f)
    sys.exit(1)
print('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ✔')
