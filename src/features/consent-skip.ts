import type { Feature } from "./types";
import { injectStyle } from "@/utils/dom";
import { DARK_THEME_CLASS } from "@/features/dark-theme";
import { isFeatureEnabled } from "@/settings/store";
import { clearRedirectGuard, registerRedirect } from "@/utils/redirect-guard";
import { clearOwnTimeout, ownTimerIds, setOwnTimeout } from "@/utils/timers";

const DURATION_MS = 2000;
const DEFAULT_PATH = "/";
/** Чистый вход без OAuth error-параметров — выход из битого callback. */
const SAFE_AUTH_URL = "/sign-in/";
const STYLE_ID = "vvsu-tweaks-consent-skip-style";
const OVERLAY_ID = "vvsu-tweaks-consent-skip-overlay";
const ROOT_CLASS = "vvsu-tweaks-consent-skip-active";
const PLAY_CLASS = "vvsu-play";
const GUARD_SCOPE = "consent-skip";
const COOLDOWN_KEY = "vvsu-tweaks.consent-skip.cooldown";
const COOLDOWN_MS = 60_000;

const HEART_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
           2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
           C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
           c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
</svg>`;

function isConsentPage(): boolean {
  return /\/consent-student\.html$/i.test(location.pathname);
}

function sameOriginUrl(path: string): string {
  return new URL(path, location.origin).href;
}

/** callback_url часто не энкодят: всё после `callback_url=` — один URL с вложенными &. */
function rawCallbackParam(): string | null {
  const search = location.search;
  const marker = "callback_url=";
  const idx = search.indexOf(marker);
  if (idx === -1) return null;

  const raw = search.slice(idx + marker.length);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return raw.trim();
  }
}

/** @internal exported for unit tests */
export function isUnsafeCallback(url: URL): boolean {
  if (url.origin !== location.origin) return true;
  if (/\/consent-student\.html/i.test(url.pathname)) return true;

  const params = url.searchParams;
  if (params.has("error") || params.has("error_description")) return true;

  const blob = `${url.pathname}${url.search}${url.hash}`;
  if (/access_denied|consent\s*verifier|already\s+been\s+used/i.test(blob)) {
    return true;
  }

  return false;
}

type RedirectPlan = {
  /**
   * Всегда абсолютный URL текущего origin. Путь вида `//host/…` нельзя
   * отдавать в location.replace как есть — это протокол-относительная ссылка.
   */
  url: string;
  /** false = подменили битый callback на безопасный URL. */
  fromCallback: boolean;
};

/** @internal exported for unit tests */
export function resolveRedirectPlan(): RedirectPlan {
  const fallback = { url: sameOriginUrl(DEFAULT_PATH), fromCallback: false };
  const callback = rawCallbackParam();
  if (!callback) return fallback;

  try {
    const url = new URL(callback, location.origin);
    if (isUnsafeCallback(url)) {
      console.warn(
        "[vvsu-tweaks] consent-skip: unsafe callback_url, using clean sign-in",
        url.pathname + url.search,
      );
      return { url: sameOriginUrl(SAFE_AUTH_URL), fromCallback: false };
    }
    return { url: url.href, fromCallback: true };
  } catch {
    return fallback;
  }
}

function isCooldownActive(): boolean {
  try {
    const raw = sessionStorage.getItem(COOLDOWN_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || Date.now() >= until) {
      sessionStorage.removeItem(COOLDOWN_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function armCooldown(reason: string): void {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
  } catch {
    /* ignore */
  }
  console.warn(`[vvsu-tweaks] consent-skip: cooldown ${COOLDOWN_MS}ms — ${reason}`);
}

/** Сброс петли/cooldown — вызывать при осознанном «Войти снова». */
export function resetConsentSkipGuards(): void {
  clearRedirectGuard(GUARD_SCOPE);
  try {
    sessionStorage.removeItem(COOLDOWN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Сносит setTimeout/setInterval страницы (countdown consent-student).
 * Id таймеров общие для окна при grant none, поэтому свои пропускаем.
 */
function killPageTimers(): void {
  const own = ownTimerIds();
  const highest = window.setTimeout(() => {}, 0);
  for (let id = 1; id <= highest; id++) {
    if (own.has(id)) continue;
    window.clearTimeout(id);
    window.clearInterval(id);
  }
}

function neutralizeNativeConsent(): void {
  killPageTimers();
  sanitizeConsentLocation(SAFE_AUTH_URL);
  hardenNativeConsentCta(SAFE_AUTH_URL);
}

/** Патчим нативный CTA, чтобы ручной клик тоже не ушёл в error-callback. */
function hardenNativeConsentCta(safeUrl: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>("a.consent-cta[href]");
  for (const link of links) {
    try {
      const href = link.getAttribute("href");
      if (!href) continue;
      const url = new URL(href, location.origin);
      if (isUnsafeCallback(url)) {
        link.setAttribute("href", safeUrl);
      }
    } catch {
      /* ignore bad href */
    }
  }
}

/**
 * Подменяем callback_url в адресной строке — нативный таймер/JS consent-student
 * часто читает location.search и иначе снова утащит на error-URL.
 */
function sanitizeConsentLocation(safeUrl: string): void {
  try {
    const current = rawCallbackParam();
    if (!current) return;
    const parsed = new URL(current, location.origin);
    if (!isUnsafeCallback(parsed)) return;

    const next = new URL(location.href);
    next.search = `callback_url=${encodeURIComponent(sameOriginUrl(safeUrl))}`;
    history.replaceState(history.state, "", next.href);
  } catch {
    /* ignore */
  }
}

function injectConsentStyles(): HTMLStyleElement {
  return injectStyle(
    `
html.${ROOT_CLASS},
html.${ROOT_CLASS} body {
  overflow: hidden !important;
}

html.${ROOT_CLASS} body > :not(#${OVERLAY_ID}) {
  visibility: hidden !important;
}

#${OVERLAY_ID} {
  --vvsu-cs-heart-fill: #000000;
  --vvsu-cs-ring: rgba(10, 86, 164, 0.55);
  --vvsu-cs-stop: #5a6f84;
  --vvsu-cs-stop-hover: #3d5166;
  --vvsu-cs-shadow: 0 12px 22px rgba(10, 20, 40, 0.28);
  --vvsu-cs-glow: 0 0 28px rgba(10, 86, 164, 0.4);
  --vvsu-cs-ring-glow: rgba(10, 86, 164, 0.4);
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.75rem;
  margin: 0;
  padding:
    max(1rem, env(safe-area-inset-top, 0px))
    max(1rem, env(safe-area-inset-right, 0px))
    max(1.25rem, env(safe-area-inset-bottom, 0px))
    max(1rem, env(safe-area-inset-left, 0px));
  background:
    radial-gradient(ellipse 70% 55% at 50% 42%, #ffffff 0%, #f7fafd 48%, #e7f0fa 100%);
  color: #42505f;
  font-family: "Montserrat", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: light;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

html.${DARK_THEME_CLASS} #${OVERLAY_ID} {
  --vvsu-cs-heart-fill: #f2f6fb;
  --vvsu-cs-ring: rgba(160, 210, 255, 0.85);
  --vvsu-cs-stop: #9aadc2;
  --vvsu-cs-stop-hover: #c5d6e8;
  --vvsu-cs-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
  --vvsu-cs-glow: 0 0 36px rgba(140, 200, 255, 0.7);
  --vvsu-cs-ring-glow: rgba(160, 210, 255, 0.55);
  background:
    radial-gradient(ellipse 70% 55% at 50% 42%, #1a2740 0%, #152032 48%, #0e1621 100%);
  color: #e6edf5;
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

#${OVERLAY_ID} .vvsu-heart-stage {
  position: relative;
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;
}

#${OVERLAY_ID} .vvsu-heart-ring {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 2.5px solid var(--vvsu-cs-ring);
  box-shadow: 0 0 0 0 transparent;
  opacity: 0;
  transform: scale(0.5);
  pointer-events: none;
}

#${OVERLAY_ID} .vvsu-heart {
  position: relative;
  width: 78px;
  height: 72px;
  opacity: 0;
  transform: scale(0.28);
  filter: drop-shadow(var(--vvsu-cs-shadow));
  will-change: transform, opacity;
}

#${OVERLAY_ID} .vvsu-heart svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: var(--vvsu-cs-heart-fill) !important;
  color: var(--vvsu-cs-heart-fill);
}

#${OVERLAY_ID} .vvsu-heart svg path {
  fill: var(--vvsu-cs-heart-fill) !important;
}

#${OVERLAY_ID}.${PLAY_CLASS} .vvsu-heart {
  animation: vvsu-heart-play 1300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

#${OVERLAY_ID}.${PLAY_CLASS} .vvsu-heart-ring {
  animation: vvsu-heart-ring 900ms cubic-bezier(0.16, 1, 0.3, 1) 560ms 1 forwards;
}

#${OVERLAY_ID} .vvsu-stop {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0.75rem 1.1rem;
  margin: 0;
  min-height: 44px;
  min-width: 5.5rem;
  color: var(--vvsu-cs-stop);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  cursor: pointer;
  opacity: 0;
  transition: color 180ms ease, opacity 220ms ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

#${OVERLAY_ID}.${PLAY_CLASS} .vvsu-stop {
  animation: vvsu-fade-in 420ms ease 180ms forwards;
}

#${OVERLAY_ID} .vvsu-stop:focus-visible {
  color: var(--vvsu-cs-stop-hover);
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

@media (hover: hover) {
  #${OVERLAY_ID} .vvsu-stop:hover {
    color: var(--vvsu-cs-stop-hover);
  }
}

#${OVERLAY_ID} .vvsu-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 767.98px) {
  #${OVERLAY_ID} {
    gap: 2.25rem;
  }

  #${OVERLAY_ID} .vvsu-heart-stage {
    width: 140px;
    height: 140px;
  }

  #${OVERLAY_ID} .vvsu-heart {
    width: 70px;
    height: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  #${OVERLAY_ID}.${PLAY_CLASS} .vvsu-heart,
  #${OVERLAY_ID}.${PLAY_CLASS} .vvsu-heart-ring,
  #${OVERLAY_ID}.${PLAY_CLASS} .vvsu-stop {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: drop-shadow(var(--vvsu-cs-shadow));
  }

  #${OVERLAY_ID} .vvsu-stop {
    opacity: 1;
  }
}

/* 0–37%: появление, 38–100%: удар (одна анимация — без конфликта transform) */
@keyframes vvsu-heart-play {
  0% { opacity: 0; transform: scale(0.28); filter: drop-shadow(var(--vvsu-cs-shadow)); }
  37% { opacity: 1; transform: scale(1); filter: drop-shadow(var(--vvsu-cs-shadow)); }
  48% { opacity: 1; transform: scale(1.45); filter: drop-shadow(var(--vvsu-cs-glow)); }
  58% { opacity: 1; transform: scale(0.84); filter: drop-shadow(var(--vvsu-cs-shadow)); }
  70% { opacity: 1; transform: scale(1.3); filter: drop-shadow(var(--vvsu-cs-glow)); }
  82% { opacity: 1; transform: scale(0.94); filter: drop-shadow(var(--vvsu-cs-shadow)); }
  100% { opacity: 1; transform: scale(1); filter: drop-shadow(var(--vvsu-cs-shadow)); }
}

@keyframes vvsu-heart-ring {
  0% { opacity: 0; transform: scale(0.45); box-shadow: 0 0 0 0 var(--vvsu-cs-ring-glow); }
  14% { opacity: 1; }
  100% { opacity: 0; transform: scale(2.55); box-shadow: 0 0 0 22px transparent; }
}

@keyframes vvsu-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`,
    STYLE_ID,
  );
}

function startConsentSkip(): void {
  const plan = resolveRedirectPlan();
  if (!plan.fromCallback) {
    sanitizeConsentLocation(SAFE_AUTH_URL);
  }
  hardenNativeConsentCta(SAFE_AUTH_URL);

  let cancelled = false;
  let redirectTimer: number | null = null;
  let overlayEl: HTMLDivElement | null = null;
  const styleEl = injectConsentStyles();

  const cleanup = () => {
    document.documentElement.classList.remove(ROOT_CLASS);
    overlayEl?.remove();
    overlayEl = null;
    styleEl.remove();
  };

  const cancelAndRestore = () => {
    cancelled = true;
    if (redirectTimer !== null) {
      clearOwnTimeout(redirectTimer);
      redirectTimer = null;
    }
    cleanup();
    sanitizeConsentLocation(SAFE_AUTH_URL);
    hardenNativeConsentCta(SAFE_AUTH_URL);
  };

  const abortLoop = (reason: string) => {
    armCooldown(reason);
    cancelAndRestore();
    neutralizeNativeConsent();
  };

  const redirect = () => {
    if (cancelled) return;

    const from = location.pathname + location.search;
    const guard = registerRedirect(from, plan.url, {
      scope: GUARD_SCOPE,
      maxHops: 3,
      windowMs: 12_000,
    });

    if (!guard.allowed) {
      abortLoop(`redirect loop (${guard.hops}/${guard.maxHops})`);
      return;
    }

    location.replace(plan.url);
  };

  overlayEl = document.createElement("div");
  overlayEl.id = OVERLAY_ID;
  overlayEl.setAttribute("role", "status");
  overlayEl.setAttribute("aria-live", "polite");
  overlayEl.innerHTML = [
    '<p class="vvsu-status">Переход в кабинет… Нажмите «стоп», чтобы остаться.</p>',
    '<div class="vvsu-heart-stage" aria-hidden="true">',
    '  <div class="vvsu-heart-ring"></div>',
    '  <div class="vvsu-heart">',
    `    ${HEART_SVG}`,
    "  </div>",
    "</div>",
    '<button type="button" class="vvsu-stop">стоп</button>',
  ].join("");

  overlayEl.querySelector(".vvsu-stop")?.addEventListener("click", cancelAndRestore, {
    once: true,
  });

  // Overlay на html: body может ещё не существовать при document-start
  document.documentElement.appendChild(overlayEl);
  document.documentElement.classList.add(ROOT_CLASS);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    if (!cancelled && overlayEl) overlayEl.classList.add(PLAY_CLASS);
  });

  redirectTimer = setOwnTimeout(redirect, reduceMotion ? 400 : DURATION_MS);
  console.info("[vvsu-tweaks] consent-skip: overlay started →", plan.url);
}

export const consentSkip: Feature = {
  id: "consent-skip",
  name: "Пропуск consent interstitial",
  hosts: ["cabinet"],
  run() {
    if (!isFeatureEnabled("consent-skip")) return;
    if (!isConsentPage()) return;

    if (isCooldownActive()) {
      console.info("[vvsu-tweaks] consent-skip: cooldown active, leaving native page");
      sanitizeConsentLocation(SAFE_AUTH_URL);
      hardenNativeConsentCta(SAFE_AUTH_URL);

      // Второй pass после того, как страница успеет поставить countdown.
      setOwnTimeout(neutralizeNativeConsent, 1200);

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", neutralizeNativeConsent, {
          once: true,
        });
      } else {
        neutralizeNativeConsent();
      }
      return;
    }

    startConsentSkip();
  },
};
