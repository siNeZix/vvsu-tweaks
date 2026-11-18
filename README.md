# VVSU Tweaks

Userscript с улучшениями интерфейса и UX сайтов ВВГУ (`*.vvsu.ru`).

Работает через Tampermonkey / Violentmonkey. Сборка — Vite + TypeScript, `grant: none` (без `GM_*`).

## Установка

1. Установите [Tampermonkey](https://www.tampermonkey.net/) или [Violentmonkey](https://violentmonkey.github.io/).
2. Установите скрипт одним из способов:
   - из [последнего релиза](https://github.com/siNeZix/vvsu-tweaks/releases/latest) — файл `vvsu-tweaks.user.js`;
   - из [Tampermonkey Hub](https://thub.szxx.dad/);
   - локально: `npm run build` → откройте `dist/vvsu-tweaks.user.js` в менеджере скриптов.
3. Откройте [cabinet.vvsu.ru](https://cabinet.vvsu.ru/) или [fort.vvsu.ru](https://fort.vvsu.ru/) — в футере появится панель настроек.

## Возможности

| Фича | Где | Описание |
| --- | --- | --- |
| Тёмная тема | кабинет, вход | Тема до первой отрисовки + переключатель |
| Скрытие фото | кабинет | Блюр аватара, переключается глазиком |
| Скрыть BVI | кабинет, вход | Убирает кнопку режима для слабовидящих |
| Скрыть Max | все сайты ВВГУ | Прячет ссылки и поля мессенджера Max (ссылки в тексте оповещений остаются) |
| Пропуск соглашения | кабинет | Автопропуск `consent-student` с защитой от петель редиректа |
| Всегда «Запомнить» | вход | Чекбокс `#remember` всегда включён |
| Ошибки входа | кабинет | Понятная страница вместо сырого OpenID dump |
| Панель настроек | кабинет, вход | Включение/выключение фич |

## Приватность и безопасность

- Скрипт не делает сетевых запросов и ничего не отправляет третьим лицам.
- Настройки хранятся в cookie `vvsu_tw_*` на `.vvsu.ru` (общие для поддоменов) и в `localStorage`. Как и любые cookie домена, они уходят на серверы ВВГУ вместе с запросами; внутри только флаги фич.
- Работает только на `https://`, не запускается во фреймах (`@noframes`).
- Редиректы (пропуск соглашения, «Войти снова») — только на тот же origin, абсолютным URL.
- Код ошибки из адреса показывается, только если похож на OAuth-код (`[a-z0-9_]`), иначе «unknown»: ссылкой нельзя подсунуть свой текст на страницу с брендингом ВВГУ.

Уязвимости — в [issues](https://github.com/siNeZix/vvsu-tweaks/issues) или лично в [Telegram](https://t.me/siNeZix).

## Сайты

| Хост | Роль |
| --- | --- |
| `cabinet.vvsu.ru` | Личный кабинет |
| `fort.vvsu.ru` | OpenID / вход |
| `portal.vvsu.ru`, `www.vvsu.ru`, `portfolio.vvsu.ru` | Прочие сервисы ВВГУ |

Match: `https://*.vvsu.ru/*`, `https://vvsu.ru/*`.

## Разработка

Требования: Node.js 22.12+, npm.

```bash
npm ci
npm run dev        # HTTPS 127.0.0.1:5173, HMR через vite-plugin-monkey
npm run check      # typecheck + test + build + сверка версии в dist
```

### Dev-цикл

1. `npm run dev`
2. Установите userscript, который отдаёт Vite: `https://127.0.0.1:5173/__vite-plugin-monkey.install.user.js`
3. Откройте реальный сайт ВВГУ — entry грузится с localhost по HTTPS (иначе mixed content)

Dev-сервер слушает только localhost. Для проверки с телефона в своей сети: `npm run dev -- --host` (не делайте этого в общих сетях — сервер отдаёт исходники).

Локальный макет без ВВГУ: `preview.html` (в dev считается `cabinet`).

HTML-снимки реальных страниц для отладки держите в `refs/` — каталог в `.gitignore`, потому что снимки кабинета содержат персональные данные (фото, ФИО, группа). Не коммитьте их.

### Скрипты

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Dev-сервер + userscript |
| `npm run build` | typecheck + production-сборка |
| `npm run check` | Всё, что проверяет CI |
| `npm test` | Vitest (happy-dom) |
| `npm run test:watch` | Тесты в watch |
| `npm run typecheck` | `tsc` |
| `npm run preview` | Превью production-сборки |
| `npm run release:patch\|minor\|major` | typecheck + test → bump версии, коммит и тег `vX.Y.Z` |

## Архитектура

```
src/
  main.ts              # bootstrap: host check → prime темы/blur → features
  features/            # одна фича = один файл + Feature { id, hosts?, run }
  settings/store.ts    # флаги фич, группы UI
  utils/               # host, dom, storage, redirect-guard, timers
```

- `run-at: document-start` — тема и blur до первой отрисовки (`primeDarkTheme`, `primeAvatarBlur`). На этом этапе `<head>`/`<body>` ещё нет: стили и оверлеи вешаются в `document.head ?? document.documentElement`, создавать `head`/`body` вручную нельзя — парсер добавит свои, и их станет два.
- Фичи изолированы: ошибка одной не роняет остальные.
- Хостам можно ограничить запуск через `hosts` в `Feature`.
- Общее хранилище — cookie на `.vvsu.ru` (`src/utils/storage.ts`), без Tampermonkey API.
- Таймеры, которые не должна гасить зачистка таймеров страницы в `consent-skip`, заводите через `setOwnTimeout` (`src/utils/timers.ts`).

### Новая фича

1. Файл в `src/features/<id>.ts`, экспорт `Feature`.
2. Зарегистрировать в `src/features/index.ts`.
3. Если нужен тумблер — ключ в `SETTING_KEYS` / `SETTING_META` / `DEFAULTS` (`src/settings/store.ts`).
4. Тест рядом: `src/features/<id>.test.ts`.

## Релиз

1. `npm run release:patch` (или `minor` / `major`) — прогонит typecheck и тесты, поднимет версию, создаст коммит и тег.
2. `git push --follow-tags`.
3. CI на теге `v*`: проверит, что тег = `package.json` = `@version` в сборке, создаст [GitHub Release](https://github.com/siNeZix/vvsu-tweaks/releases) с `vvsu-tweaks.user.js` и опубликует сборку в Tampermonkey Hub (секрет `TMH_API_KEY`).

Идентификатор скрипта в менеджерах — пара `@name` + `@namespace`. Не меняйте их: у пользователей появится дубликат вместо обновления.

## CI

GitHub Actions (`.github/workflows/ci.yml`), actions закреплены по SHA, токен по умолчанию только на чтение:

1. На каждый push / PR: `npm ci` → typecheck → test → build → сверка версии → артефакт `vvsu-tweaks.user.js`.
2. На тег `v*`: GitHub Release + публикация в Tampermonkey Hub.

Обновления зависимостей и actions — Dependabot (`.github/dependabot.yml`).

## Лицензия

[GPL-3.0](LICENSE). Можно использовать, изменять и распространять; изменённые версии — только с открытым кодом под той же лицензией.

Личный / студенческий проект. К ВВГУ отношения не имеет и официально не поддерживается.
