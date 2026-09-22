// -*- coding: utf-8 -*-
// Разбивает src/legacy/app-core.js на логические модули js/*.js
// БЕЗ изменения кода: модули = непрерывные диапазоны top-level стейтментов
// (границы по acorn AST), порядок конкатенации = исходный порядок файла.
// Верификация: конкатенация модулей + служебных зазоров == исходный файл байт-в-байт.
import { parse } from 'acorn';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(WEB, 'src', 'legacy', 'app-core.js');
const OUT = join(WEB, 'public', 'js');
mkdirSync(OUT, { recursive: true });

const src = readFileSync(SRC, 'utf8');
const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
const L = s => src.slice(0, s).split('\n').length;

// ── Стейтменты: [start, end) в символах ──────────────────────────────────────
const stmts = ast.body.map(n => ({ start: n.start, end: n.end, line: L(n.start) }));
if (stmts.length !== 89) throw new Error(`ожидалось 89 стейтментов, найдено ${stmts.length}`);

// span [a,b) в СТРОКАХ (1-based, включительно) — удобные манипуляции
const lineOffsets = [0]; // offset начала каждой строки (0-based index → offset)
for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineOffsets.push(i + 1);
const lo = l => lineOffsets[l - 1];
const hi = l => lineOffsets[l]; // конец строки l (включая \n)

// ── Служебный зазор между стейтментами (комментарии/пустые строки) ──────────
function gapBetween(prevEndLine, nextStartLine) {
  if (nextStartLine <= prevEndLine + 1) return null;
  return { from: prevEndLine + 1, to: nextStartLine - 1 };
}

// ── Определения модулей: диапазоны ИНДЕКСОВ стейтментов (0-based, включительно)
// Соответствие индексов (см. core-map.txt):
//  0 FX, 1 PWA, 2 MusicPlayer, 3 SoundSys, 4 GenAch, 5 DefaultDB, 6-13 SHOP_*/THEMES,
//  14-15 CURRENT_SEASON/SEASON_NAMES, 16-17 markSeasonButtons/renderSeasonBanner,
//  18-19 SeasonSystem(+window), 20 getUZDate, 21 NameGuard, 22-24 DB/isParentMode/Data,
//  25 Whiteboard, 26 Calc, 27 SubjectSys, 28 DailySys, 29 Donation, 30 Online,
//  31 Auth, 32 Tutorial, 33-34 Timer(+window), 35-36 Quest/WeeklyQuest, 37 MathGame,
//  38 BattleSys, 39 Trainer, 40-41 Achievement/WeeklyReport, 42 TimeGuard,
//  43 SecretSys, 44 App, 45 Transfer, 46 InstallSys, 47 Notify, 48-61 window.* exports,
//  62 window.onload, 63-73 АФК, 74-78 предметы, 79-81 DB.subjects init/timeout,
//  82-83 manualQRTransfer/pasteCode, 84 debug-clock, 85-88 fundraiser/switchTab
const MODULES = [
  { file: 'fx.js',          stmts: [0, 0],    desc: 'FX эффекты' },
  { file: 'sound.js',       stmts: [1, 3],    desc: 'PWA install + MusicPlayer + SoundSys' },
  { file: 'config.js',      stmts: [4, 15],   desc: 'GenAch, DefaultDB, THEMES, SHOP_*, LEAGUES, CURRENT_SEASON' },
  { file: 'seasons.js',     stmts: [16, 19],  desc: 'SeasonSystem + баннер + window.SeasonSystem' },
  { file: 'storage.js',     stmts: [20, 24],  desc: 'getUZDate, NameGuard, DB, isParentMode, Data' },
  { file: 'tools.js',       stmts: [25, 29],  desc: 'Whiteboard, Calc, SubjectSys, DailySys, Donation' },
  { file: 'online.js',      stmts: [30, 30],  desc: 'Online (firestore-статусы)' },
  { file: 'auth.js',        stmts: [31, 32],  desc: 'Auth + Tutorial' },
  { file: 'timer.js',       stmts: [33, 34],  desc: 'Timer + window.Timer' },
  { file: 'quests.js',      stmts: [35, 37],  desc: 'QuestSys, WeeklyQuestSys, MathGame' },
  { file: 'battle.js',      stmts: [38, 38],  desc: 'BattleSys (дуэли)' },
  { file: 'trainer.js',     stmts: [39, 41],  desc: 'Trainer, AchievementSys, WeeklyReportSys' },
  { file: 'security.js',    stmts: [42, 43],  desc: 'TimeGuard + SecretSys' },
  { file: 'app.js',         stmts: [44, 47],  desc: 'App, Transfer, InstallSys, Notify' },
  { file: 'exports.js',     stmts: [48, 73],  desc: 'window.* экспорты + onload + АФК' },
  { file: 'subjects.js',    stmts: [74, 83],  desc: 'Предметы + manualQRTransfer/pasteCode' },
  { file: 'init.js',        stmts: [84, 88],  desc: 'debug-clock + fundraiser + switchTab wrap' },
];

// ── Сборка модулей и верификация ─────────────────────────────────────────────
let cursorStmt = 0;            // следующий не распределённый индекс стейтмента
const pieces = [];             // последовательность кусков в порядке конкатенации
const report = [];

for (const mod of MODULES) {
  const first = mod.stmts[0], last = mod.stmts[1];
  if (first !== cursorStmt) throw new Error(`модуль ${mod.file}: ожидается стейтмент ${cursorStmt}, получен ${first} (пропуск/перекрытие!)`);
  const startLine = stmts[first].line;
  const endLine = L(stmts[last].end - 1); // строка последнего стейтмента
  const text = src.slice(lo(startLine), hi(endLine));
  // зазор ПЕРЕД модулем (между предыдущим куском и этим)
  const prevEndLine = cursorStmt === 0 ? 0 : L(stmts[cursorStmt - 1].end - 1);
  const gap = gapBetween(prevEndLine, startLine);
  if (gap) pieces.push({ kind: 'gap', text: src.slice(lo(gap.from), hi(gap.to)), where: `${mod.file}#pre` });
  pieces.push({ kind: 'mod', file: mod.file, text });
  report.push(`${mod.file.padEnd(14)} stmt ${first}-${last}  L${startLine}-${endLine}  ${text.length} симв.  ${mod.desc}`);
  cursorStmt = last + 1;
}
// хвост после последнего стейтмента
const lastEndLine = L(stmts[stmts.length - 1].end - 1);
if (lastEndLine < src.split('\n').length) {
  pieces.push({ kind: 'gap', text: src.slice(hi(lastEndLine)), where: 'EOF' });
}
if (cursorStmt !== stmts.length) throw new Error('не все стейтменты распределены!');

// ── Верификация: конкатенация == исходный файл ──────────────────────────────
const rebuilt = pieces.map(p => p.text).join('');
if (rebuilt !== src) {
  // найти первое расхождение для отладки
  for (let i = 0; i < Math.max(rebuilt.length, src.length); i++) {
    if (rebuilt[i] !== src[i]) {
      console.error('РАСХОЖДЕНИЕ на', i);
      console.error('SRC :', JSON.stringify(src.slice(i - 80, i + 80)));
      console.error('BUILT:', JSON.stringify(rebuilt.slice(i - 80, i + 80)));
      throw new Error('конкатенация не совпала!');
    }
  }
}
console.log(`[OK] конкатенация ${pieces.length} кусков == исходник (${src.length} символов)`);

// ── Запись модулей ───────────────────────────────────────────────────────────
let written = 0;
for (const p of pieces) {
  if (p.kind === 'mod') {
    writeFileSync(join(OUT, p.file), p.text);
    written++;
  }
}
console.log(`[OK] записано модулей: ${written} в public/js/`);
report.forEach(r => console.log('  ' + r));

// ── Проверка: каждый модуль парсится как script ─────────────────────────────
import { execFileSync } from 'node:child_process';
for (const mod of MODULES) {
  execFileSync(process.execPath, ['--check', join(OUT, mod.file)], { stdio: 'pipe' });
}
console.log('[OK] все модули проходят node --check');
