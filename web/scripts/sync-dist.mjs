// Синхронизирует web/dist → корень репозитория (MathMaster/),
// чтобы деплой на GitHub Pages остался прежним: статические файлы в корне.
import { cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(dirname(fileURLToPath(import.meta.url))); // web/
const repo = dirname(web);                                    // MathMaster/
const dist = join(web, 'dist');

// Файлы, которые деплоить нельзя (не часть сайта)
const SKIP = new Set(['node_modules']);

for (const name of readdirSync(dist)) {
  if (SKIP.has(name)) continue;
  const from = join(dist, name);
  const to = join(repo, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  const kind = statSync(from).isDirectory() ? 'dir ' : 'file';
  console.log(`  ${kind} ${name}`);
}
console.log('[OK] dist синхронизирован в корень репозитория');
