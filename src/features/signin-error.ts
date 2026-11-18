import type { Feature } from "./types";
import { injectStyle } from "@/utils/dom";
import { setOwnTimeout } from "@/utils/timers";
import { DARK_THEME_CLASS } from "@/features/dark-theme";
import { mountSettingsInto } from "@/features/settings-panel";

const STYLE_ID = "vvsu-tweaks-signin-error-style";
const OVERLAY_ID = "vvsu-tweaks-signin-error";
const ROOT_CLASS = "vvsu-tweaks-signin-error-active";
const BOUND = "data-vvsu-signin-error";
const DUMP_WATCH_MS = 8000;
/** Повторная ошибка входа в окне → петля, не «ещё один /sign-in/». */
const ERROR_SEEN_KEY = "vvsu-tweaks.signin-error.seen";
const ERROR_SEEN_MS = 120_000;
/** OAuth error codes — snake_case ASCII. Всё прочее из URL не показываем. */
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/i;

type AuthErrorInfo = {
  code: string;
  description: string;
  title: string;
  summary: string;
};

function isSignInPath(pathname = location.pathname): boolean {
  return /\/sign-in\/?$/i.test(pathname);
}

function decodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.trim();
  }
}

/**
 * Код и описание приходят из URL, который может прислать кто угодно.
 * На странице с брендингом ВВГУ показываем только код из whitelist-формата,
 * иначе ссылка превращается в инструмент подмены текста (фишинг).
 *
 * @internal exported for unit tests
 */
export function friendlyError(rawCode: string, description: string): AuthErrorInfo {
  const code = ERROR_CODE.test(rawCode) ? rawCode : "";

  if (code === "access_denied" && /consent verifier.*already been used/i.test(description)) {
    return {
      code,
      description,
      title: "Ссылка входа уже использована",
      summary:
        "Одноразовый код входа уже израсходован (обновление, «Назад» или повторный переход). Нажмите «Войти снова» — начнём вход с чистого адреса.",
    };
  }

  if (code === "access_denied") {
    return {
      code,
      description,
      title: "Вход отклонён",
      summary: "Сервер ВВГУ не завершил авторизацию. Попробуйте ещё раз.",
    };
  }

  if (code === "login_required" || code === "interaction_required") {
    return {
      code,
      description,
      title: "Нужно войти заново",
      summary: "Сессия истекла. Нажмите «Войти снова».",
    };
  }

  if (code) {
    return {
      code,
      description,
      title: "Не удалось войти",
      summary: "Ошибка на стороне сервера ВВГУ. Попробуйте ещё раз.",
    };
  }

  return {
    code: "unknown",
    description,
    title: "Не удалось войти",
    summary: "Сервер вернул техническую ошибку. Попробуйте войти снова.",
  };
}

function errorFromUrl(): AuthErrorInfo | null {
  if (!isSignInPath()) return null;

  const params = new URLSearchParams(location.search);
  const code = decodeParam(params.get("error"));
  if (!code) return null;

  return friendlyError(code, decodeParam(params.get("error_description")));
}

function errorFromDump(): AuthErrorInfo | null {
  if (!isSignInPath()) return null;

  const raw = (document.body?.innerText || document.documentElement.innerText || "").trim();
  if (!raw) return null;

  const looksLikeDump =
    /OpenIDConnectClientException/i.test(raw) ||
    /object\s*\(\s*Jumbojett\\OpenIDConnectClientException\s*\)/i.test(raw) ||
    (/consent verifier has already been used/i.test(raw) && /access_denied/i.test(raw));

  if (!looksLikeDump) return null;

  const descMatch = raw.match(
    /Description:\s*([^\n\r"']+?)(?:\s*"|\s*\[|\s*$)/i,
  );
  const codeMatch = raw.match(/Error:\s*([a-z0-9_]+)/i);
  const description =
    descMatch?.[1]?.trim() ||
    (/consent verifier has already been used/i.test(raw)
      ? "The resource owner or authorization server denied the request. The consent verifier has already been used."
      : "");
  const code = codeMatch?.[1]?.trim() || (description ? "access_denied" : "unknown");

  return friendlyError(code, description);
}

/**
 * Корень кабинета того же origin. Не /sign-in/: чистый sign-in рестартит OAuth
 * и снова может вернуть на consent → петля. Если сессии нет, сервер сам
 * отправит на вход по своей цепочке.
 */
function resolveRetryHref(): string {
  return new URL("/", location.origin).href;
}

/** @internal exported for unit tests */
export function isSigninErrorLoop(): boolean {
  try {
    const raw = sessionStorage.getItem(ERROR_SEEN_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || Date.now() >= until) {
      sessionStorage.removeItem(ERROR_SEEN_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markSigninErrorSeen(): void {
  try {
    sessionStorage.setItem(ERROR_SEEN_KEY, String(Date.now() + ERROR_SEEN_MS));
  } catch {
    /* ignore */
  }
}

/** Переход на / без сброса consent-guard — one-shot должен остаться. */
function beginFreshSignIn(retryHref: string): void {
  markSigninErrorSeen();
  // replace: убираем error URL из history, чтобы «Назад» не вернул в тот же дамп
  location.replace(retryHref);
}

function injectErrorStyles(): HTMLStyleElement {
  return injectStyle(
    `
html.${ROOT_CLASS},
html.${ROOT_CLASS} body {
  overflow: hidden !important;
  margin: 0 !important;
  min-height: 100% !important;
}

html.${ROOT_CLASS} body {
  display: none !important;
}

#${OVERLAY_ID} {
  --vvsu-se-text: #243447;
  --vvsu-se-muted: #5f7388;
  --vvsu-se-accent: #0a56a4;
  --vvsu-se-panel: rgba(255, 255, 255, 0.78);
  --vvsu-se-panel-border: rgba(10, 86, 164, 0.12);
  --vvsu-se-note: #eef5fc;
  --vvsu-se-note-border: rgba(10, 86, 164, 0.16);
  --vvsu-se-credit: #7a8fa3;
  --vvsu-se-btn-text: #ffffff;
  --vvsu-se-shadow: 0 18px 40px rgba(16, 36, 64, 0.12);
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding:
    max(1rem, env(safe-area-inset-top, 0px))
    max(1rem, env(safe-area-inset-right, 0px))
    max(1rem, env(safe-area-inset-bottom, 0px))
    max(1rem, env(safe-area-inset-left, 0px));
  background:
    radial-gradient(ellipse 75% 55% at 50% 28%, #ffffff 0%, #f4f8fc 46%, #e5eef8 100%);
  color: var(--vvsu-se-text);
  font-family: "Montserrat", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: light;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  overflow: auto;
  overscroll-behavior: contain;
}

html.${DARK_THEME_CLASS} #${OVERLAY_ID} {
  --vvsu-se-text: #e6edf5;
  --vvsu-se-muted: #9aadc2;
  --vvsu-se-accent: #6ebcfb;
  --vvsu-se-panel: rgba(26, 39, 64, 0.88);
  --vvsu-se-panel-border: rgba(110, 188, 251, 0.16);
  --vvsu-se-note: rgba(21, 32, 50, 0.95);
  --vvsu-se-note-border: rgba(110, 188, 251, 0.2);
  --vvsu-se-credit: #7f95ad;
  --vvsu-se-btn-text: #0b1a2b;
  --vvsu-se-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
  background:
    radial-gradient(ellipse 75% 55% at 50% 28%, #1a2740 0%, #152032 48%, #0e1621 100%);
  color-scheme: dark;
}

#${OVERLAY_ID}::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #0a56a4;
}

html.${DARK_THEME_CLASS} #${OVERLAY_ID}::before {
  background: linear-gradient(90deg, #0a56a4 0%, #4d9de0 50%, #0a56a4 100%);
}

#${OVERLAY_ID} * {
  box-sizing: border-box;
}

#${OVERLAY_ID} .vvsu-se-shell {
  position: relative;
  width: min(34rem, 100%);
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.35rem 0 0.15rem;
}

#${OVERLAY_ID} .vvsu-se-kicker {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vvsu-se-accent);
}

#${OVERLAY_ID} .vvsu-se-panel {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.1rem 1.1rem 1.15rem;
  border: 1px solid var(--vvsu-se-panel-border);
  border-radius: 0.75rem;
  background: var(--vvsu-se-panel);
  box-shadow: var(--vvsu-se-shadow);
  backdrop-filter: blur(8px);
}

#${OVERLAY_ID} .vvsu-se-title {
  margin: 0;
  font-size: clamp(1.15rem, 3.8vw, 1.4rem);
  font-weight: 700;
  line-height: 1.25;
  color: var(--vvsu-se-text);
}

#${OVERLAY_ID} .vvsu-se-summary {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--vvsu-se-muted);
}

#${OVERLAY_ID} .vvsu-se-meta {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--vvsu-se-credit);
  word-break: break-word;
}

#${OVERLAY_ID} .vvsu-se-note {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--vvsu-se-note-border);
  border-radius: 0.5rem;
  background: var(--vvsu-se-note);
  color: var(--vvsu-se-text);
  font-size: 0.82rem;
  line-height: 1.45;
}

#${OVERLAY_ID} .vvsu-se-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.1rem;
}

#${OVERLAY_ID} .vvsu-se-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.65rem 1.1rem;
  border: 0;
  border-radius: 0.45rem;
  background: #0a56a4;
  color: var(--vvsu-se-btn-text);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}

html.${DARK_THEME_CLASS} #${OVERLAY_ID} .vvsu-se-btn {
  background: #6ebcfb;
}

#${OVERLAY_ID} .vvsu-se-btn:focus-visible {
  background: #1460af;
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

html.${DARK_THEME_CLASS} #${OVERLAY_ID} .vvsu-se-btn:focus-visible {
  background: #9fd0ff;
}

@media (hover: hover) {
  #${OVERLAY_ID} .vvsu-se-btn:hover {
    background: #1460af;
  }

  html.${DARK_THEME_CLASS} #${OVERLAY_ID} .vvsu-se-btn:hover {
    background: #9fd0ff;
  }
}

#${OVERLAY_ID} .vvsu-se-btn:active {
  transform: translateY(1px);
}

@media (prefers-reduced-motion: reduce) {
  #${OVERLAY_ID} .vvsu-se-btn {
    transition: none !important;
  }
}

#${OVERLAY_ID} .vvsu-se-link {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.65rem 0.8rem;
  border: 0;
  background: transparent;
  color: var(--vvsu-se-accent);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

#${OVERLAY_ID} .vvsu-se-link:focus-visible {
  text-decoration: underline;
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

@media (hover: hover) {
  #${OVERLAY_ID} .vvsu-se-link:hover {
    text-decoration: underline;
  }
}

#${OVERLAY_ID} .vvsu-se-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}

#${OVERLAY_ID} .vvsu-se-credit {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--vvsu-se-credit);
}

#${OVERLAY_ID} .vvsu-se-settings-slot {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
}

/* Кнопка настроек на фоне нашей страницы */
#${OVERLAY_ID} #vvsu-tweaks-settings {
  --vvsu-set-accent: var(--vvsu-se-accent);
  --vvsu-set-text: var(--vvsu-se-text);
  --vvsu-set-muted: var(--vvsu-se-muted);
}

#${OVERLAY_ID} #vvsu-tweaks-settings .vvsu-set-trigger {
  color: var(--vvsu-se-accent);
  font-family: inherit;
}

@media (max-width: 767.98px) {
  #${OVERLAY_ID} {
    padding:
      max(0.85rem, env(safe-area-inset-top, 0px))
      max(0.85rem, env(safe-area-inset-right, 0px))
      max(1rem, env(safe-area-inset-bottom, 0px))
      max(0.85rem, env(safe-area-inset-left, 0px));
  }

  #${OVERLAY_ID} .vvsu-se-panel {
    padding: 1rem 0.95rem 1.05rem;
    border-radius: 0.65rem;
  }

  #${OVERLAY_ID} .vvsu-se-actions {
    flex-direction: column;
    align-items: stretch;
  }

  #${OVERLAY_ID} .vvsu-se-btn,
  #${OVERLAY_ID} .vvsu-se-link {
    width: 100%;
  }

  #${OVERLAY_ID} .vvsu-se-foot {
    flex-direction: column;
    align-items: stretch;
  }

  #${OVERLAY_ID} .vvsu-se-settings-slot {
    margin-left: 0;
    justify-content: flex-end;
  }
}
`,
    STYLE_ID,
  );
}

function renderOverlay(info: AuthErrorInfo): void {
  if (document.getElementById(OVERLAY_ID)) return;

  // На html, не в body: на document-start body ещё нет, а body скрываем стилем
  const html = document.documentElement;
  injectErrorStyles();
  html.classList.add(ROOT_CLASS);

  const looping = isSigninErrorLoop();
  markSigninErrorSeen();

  const title = looping ? "Петля входа" : info.title;
  const summary = looping
    ? "Повторная ошибка за короткое время. Не открывайте /sign-in/ снова — сессия OAuth на fort.vvsu.ru, скорее всего, сломана. Откройте кабинет (/) или очистите cookie для cabinet.vvsu.ru и fort.vvsu.ru."
    : info.summary;
  const note = looping
    ? "Твикер не сбрасывает защиту при переходе в кабинет, чтобы не крутить consent ↔ ошибка. Страницу оформил VVSU Tweaks."
    : "Ошибку вернул сервер ВВГУ — твикер ни при чём. Отключать расширение не нужно. Страницу оформил VVSU Tweaks.";
  // CTA всегда на / — не /sign-in/, иначе снова OAuth → consent
  const primaryLabel = "Открыть кабинет";

  setTitleWhenHeadReady(`${title} · ВВГУ`);

  const retryHref = resolveRetryHref();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute(BOUND, "1");
  overlay.setAttribute("role", "main");
  overlay.innerHTML = [
    '<div class="vvsu-se-shell">',
    '  <p class="vvsu-se-kicker">Личный кабинет · ВВГУ</p>',
    '  <section class="vvsu-se-panel" aria-labelledby="vvsu-se-title">',
    `    <h1 class="vvsu-se-title" id="vvsu-se-title">${escapeHtml(title)}</h1>`,
    `    <p class="vvsu-se-summary">${escapeHtml(summary)}</p>`,
    `    <p class="vvsu-se-meta">Код: ${escapeHtml(info.code)}</p>`,
    `    <p class="vvsu-se-note">${escapeHtml(note)}</p>`,
    '    <div class="vvsu-se-actions">',
    `      <a class="vvsu-se-btn" href="${escapeAttr(retryHref)}">${escapeHtml(primaryLabel)}</a>`,
    '      <a class="vvsu-se-link" href="https://www.vvsu.ru/">На сайт ВВГУ</a>',
    "    </div>",
    "  </section>",
    '  <div class="vvsu-se-foot">',
    '    <p class="vvsu-se-credit">VVSU Tweaks</p>',
    '    <div class="vvsu-se-settings-slot" data-vvsu-tweaks-slot="1"></div>',
    "  </div>",
    "</div>",
  ].join("");

  html.appendChild(overlay);

  const retryBtn = overlay.querySelector<HTMLAnchorElement>(".vvsu-se-btn");
  retryBtn?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      beginFreshSignIn(retryHref);
    },
    { once: true },
  );

  const settingsSlot = overlay.querySelector<HTMLElement>(".vvsu-se-settings-slot");
  if (settingsSlot) mountSettingsInto(settingsSlot, "cabinet");

  console.info("[vvsu-tweaks] signin-error: friendly page shown", info.code, {
    looping,
  });
}

/** Без <head> присвоение document.title игнорируется (а где-то бросает). */
function setTitleWhenHeadReady(title: string): void {
  const apply = () => {
    if (document.head) document.title = title;
  };
  if (document.head) {
    apply();
    return;
  }
  document.addEventListener("DOMContentLoaded", apply, { once: true });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function tryShow(): boolean {
  const info = errorFromUrl() || errorFromDump();
  if (!info) return false;
  renderOverlay(info);
  return true;
}

function startSigninError(): void {
  if (!isSignInPath()) return;
  if (document.documentElement.getAttribute(BOUND) === "1") return;
  document.documentElement.setAttribute(BOUND, "1");

  if (tryShow()) return;

  // innerText форсирует layout — не чаще раза за кадр
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (tryShow()) observer.disconnect();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setOwnTimeout(() => observer.disconnect(), DUMP_WATCH_MS);
}

export const signinError: Feature = {
  id: "signin-error",
  name: "Понятная страница ошибки входа",
  hosts: ["cabinet"],
  run() {
    startSigninError();
  },
};
