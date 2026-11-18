import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "./package.json" with { type: "json" };

const root = path.dirname(fileURLToPath(import.meta.url));
const repoUrl = "https://github.com/siNeZix/vvsu-tweaks";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  server: {
    // HTTPS обязателен: cabinet.vvsu.ru — https, иначе mixed content блокирует entry.js.
    // Только localhost: открытый dev-сервер в общей сети (общежитие, Wi-Fi вуза) отдаёт исходники.
    // Для теста с телефона: npm run dev -- --host
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  plugins: [
    basicSsl(),
    // На document-start document.head === null: monkey ≥ 8 сам вешает entry и CSS
    // в head || documentElement (их issue #262), свои патчи не нужны
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "VVSU Tweaks",
        // Не менять после 1.0.0: name + namespace — идентификатор скрипта в менеджере,
        // смена создаст у пользователей дубликат вместо обновления
        namespace: repoUrl,
        // Единый источник: package.json → git tag vX.Y.Z (см. scripts/assert-version-sync.mjs)
        version: pkg.version,
        description: "Улучшения интерфейса и UX сайтов ВВГУ",
        author: "siNeZix",
        license: pkg.license,
        homepageURL: repoUrl,
        supportURL: `${repoUrl}/issues`,
        match: ["https://*.vvsu.ru/*", "https://vvsu.ru/*"],
        icon: "https://www.vvsu.ru/favicon.ico",
        // grant none: в Firefox TM + vite serve GM_* ломает загрузку entry.js
        // общее хранилище — cookie domain=.vvsu.ru (см. utils/storage.ts)
        grant: "none",
        noframes: true,
        // document-start: early blur / тема до первой отрисовки
        "run-at": "document-start",
      },
      build: {
        fileName: "vvsu-tweaks.user.js",
      },
    }),
  ],
});
