import { defineConfig } from 'vite';

export default defineConfig({
  // Сайт живёт в подпапке GitHub Pages — относительные пути работают везде
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Код вынесен из монолита ВЕРБАТИМ: никакой трансформации,
    // минификации и tree-shaking — поведение байт-в-байт как у монолита.
    minify: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        // Фиксированные имена вместо хэшей — стабильные деплои и кэш-инвалидация через ?v=
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
});
