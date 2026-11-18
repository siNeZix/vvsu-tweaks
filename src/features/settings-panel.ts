import type { Feature } from "./types";
import { injectStyle, waitForElement } from "@/utils/dom";
import { detectHost } from "@/utils/host";
import {
  SETTING_META,
  getSettings,
  getSettingsByGroup,
  setFeatureEnabled,
  type SettingKey,
} from "@/settings/store";
import { DARK_THEME_CLASS } from "@/features/dark-theme";
import { version as APP_VERSION } from "../../package.json";

const STYLE_ID = "vvsu-tweaks-settings-style";
const ROOT_ID = "vvsu-tweaks-settings";
const OPEN_CLASS = "is-open";
const SCROLL_LOCK_CLASS = "vvsu-tweaks-settings-scroll-lock";
const MOBILE_MQ = "(max-width: 767.98px)";
const GITHUB_URL = "https://github.com/siNeZix/vvsu-tweaks";
const TELEGRAM_URL = "https://t.me/siNeZix";

type SettingsSurface = "cabinet" | "openid";

function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

const ICON_GEAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>`;

const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;

const ICON_GITHUB = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.71.12 2.51.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.58.69.48A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/></svg>`;

const ICON_TELEGRAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.95 4.34a1.25 1.25 0 0 0-1.28-.2L3.4 11.05c-.74.3-.73 1.36.02 1.64l4.2 1.55 1.62 5.12c.2.64.98.84 1.48.38l2.35-2.18 4.22 3.11c.55.4 1.33.1 1.48-.57l3.3-14.5a1.25 1.25 0 0 0-.14-.96zM9.5 14.2l-.9 3.04-.76-2.41 8.73-5.58-7.07 4.95z"/></svg>`;

const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/></svg>`;

function formatCount(visible: number, total: number, filtered: boolean): string {
  if (filtered) return `${visible}/${total}`;
  const n = total % 100;
  const n1 = total % 10;
  const word =
    n >= 11 && n <= 14
      ? "функций"
      : n1 === 1
        ? "функция"
        : n1 >= 2 && n1 <= 4
          ? "функции"
          : "функций";
  return `${total} ${word}`;
}

function injectSettingsStyles(): void {
  injectStyle(
    `
/* Слот в футере: не клипать выпадающую панель */
footer.footer #${ROOT_ID},
#footer #${ROOT_ID},
[data-vvsu-tweaks-slot] {
  overflow: visible;
}

footer.footer .container:has(#${ROOT_ID}),
footer.footer .d-flex:has(#${ROOT_ID}),
#footer .container:has(#${ROOT_ID}),
#footer .d-flex:has(#${ROOT_ID}) {
  overflow: visible;
}

#${ROOT_ID} {
  --vvsu-set-bg: #ffffff;
  --vvsu-set-bg-soft: #f3f6fa;
  --vvsu-set-border: #d5dee8;
  --vvsu-set-text: #243447;
  --vvsu-set-muted: #6b7f94;
  --vvsu-set-accent: #0a56a4;
  --vvsu-set-shadow: 0 10px 28px rgba(16, 36, 64, 0.16);
  --vvsu-set-row-h: 2.15rem;
  position: relative;
  display: inline-flex;
  align-items: center;
  z-index: 30;
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  color: var(--vvsu-set-text);
}

html.${DARK_THEME_CLASS} #${ROOT_ID} {
  --vvsu-set-bg: #1a2740;
  --vvsu-set-bg-soft: #152032;
  --vvsu-set-border: #2a3b52;
  --vvsu-set-text: #e6edf5;
  --vvsu-set-muted: #9aadc2;
  --vvsu-set-accent: #6ebcfb;
  --vvsu-set-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

#${ROOT_ID} * {
  box-sizing: border-box;
}

#${ROOT_ID} .vvsu-set-trigger {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.35rem 0.1rem;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--vvsu-set-accent);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.01em;
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

#${ROOT_ID} .vvsu-set-trigger:focus-visible {
  color: #1460af;
  border-bottom-color: currentColor;
  outline: none;
}

html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-trigger:focus-visible {
  color: #9fd0ff;
}

@media (hover: hover) {
  #${ROOT_ID} .vvsu-set-trigger:hover {
    color: #1460af;
    border-bottom-color: currentColor;
  }

  html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-trigger:hover {
    color: #9fd0ff;
  }
}

#${ROOT_ID} .vvsu-set-trigger svg {
  display: block;
  flex-shrink: 0;
  opacity: 0.9;
}

#${ROOT_ID} .vvsu-set-backdrop {
  display: none;
}

#${ROOT_ID} .vvsu-set-panel {
  --vvsu-set-vv-offset: 0px;
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.75rem);
  top: auto;
  display: flex;
  flex-direction: column;
  width: min(19.5rem, calc(100vw - 2rem));
  max-height: min(72vh, 32rem);
  overflow: hidden;
  border: 1px solid var(--vvsu-set-border);
  border-radius: 0.5rem;
  background: var(--vvsu-set-bg);
  box-shadow: var(--vvsu-set-shadow);
  color: var(--vvsu-set-text);
  font-family: "Montserrat", "Segoe UI", system-ui, sans-serif;
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
}

#${ROOT_ID} .vvsu-set-panel.vvsu-set-panel--down {
  bottom: auto;
  top: calc(100% + 0.75rem);
  transform: translateY(-6px);
}

#${ROOT_ID}.${OPEN_CLASS} .vvsu-set-panel {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  #${ROOT_ID} .vvsu-set-panel,
  #${ROOT_ID} .vvsu-set-backdrop,
  #${ROOT_ID} .vvsu-set-switch span,
  #${ROOT_ID} .vvsu-set-switch span::after,
  #${ROOT_ID} .vvsu-set-link,
  #${ROOT_ID} .vvsu-set-trigger,
  #${ROOT_ID} .vvsu-set-search-input {
    transition: none !important;
  }
}

#${ROOT_ID} .vvsu-set-head {
  flex-shrink: 0;
  padding: 0.7rem 0.75rem 0.55rem;
  border-bottom: 1px solid var(--vvsu-set-border);
  background: var(--vvsu-set-bg);
}

#${ROOT_ID} .vvsu-set-sheet-bar {
  display: none;
}

#${ROOT_ID} .vvsu-set-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

#${ROOT_ID} .vvsu-set-title-group {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}

#${ROOT_ID} .vvsu-set-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--vvsu-set-text);
  line-height: 1.2;
}

#${ROOT_ID} .vvsu-set-credit {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--vvsu-set-muted);
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0.85;
  letter-spacing: 0.01em;
}

#${ROOT_ID} .vvsu-set-head-end {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

#${ROOT_ID} .vvsu-set-count {
  font-size: 0.72rem;
  color: var(--vvsu-set-muted);
  white-space: nowrap;
}

#${ROOT_ID} .vvsu-set-close {
  display: none;
  appearance: none;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--vvsu-set-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

#${ROOT_ID} .vvsu-set-close:focus-visible {
  outline: 2px solid #80bdff;
  outline-offset: 2px;
  color: var(--vvsu-set-accent);
}

@media (hover: hover) {
  #${ROOT_ID} .vvsu-set-close:hover {
    color: var(--vvsu-set-accent);
    background: var(--vvsu-set-bg-soft);
  }
}

#${ROOT_ID} .vvsu-set-search {
  position: relative;
  display: flex;
  align-items: center;
}

#${ROOT_ID} .vvsu-set-search-icon {
  position: absolute;
  left: 0.55rem;
  display: flex;
  color: var(--vvsu-set-muted);
  pointer-events: none;
  opacity: 0.85;
}

#${ROOT_ID} .vvsu-set-search-input {
  width: 100%;
  margin: 0;
  padding: 0.4rem 0.55rem 0.4rem 1.85rem;
  border: 1px solid var(--vvsu-set-border);
  border-radius: 0.35rem;
  background: var(--vvsu-set-bg-soft);
  color: var(--vvsu-set-text);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.3;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

#${ROOT_ID} .vvsu-set-search-input::placeholder {
  color: var(--vvsu-set-muted);
  opacity: 0.9;
}

#${ROOT_ID} .vvsu-set-search-input:focus {
  border-color: var(--vvsu-set-accent);
  box-shadow: 0 0 0 2px rgba(10, 86, 164, 0.15);
}

html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-search-input:focus {
  box-shadow: 0 0 0 2px rgba(110, 188, 251, 0.2);
}

#${ROOT_ID} .vvsu-set-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0.35rem 0.35rem 0.45rem;
}

#${ROOT_ID} .vvsu-set-group {
  margin: 0 0 0.35rem;
}

#${ROOT_ID} .vvsu-set-group[hidden],
#${ROOT_ID} .vvsu-set-item[hidden],
#${ROOT_ID} .vvsu-set-empty[hidden] {
  display: none !important;
}

#${ROOT_ID} .vvsu-set-group-title {
  margin: 0;
  padding: 0.35rem 0.5rem 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vvsu-set-muted);
  line-height: 1.2;
}

#${ROOT_ID} .vvsu-set-list {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
  border-radius: 0.35rem;
  overflow: hidden;
  background: var(--vvsu-set-border);
}

#${ROOT_ID} .vvsu-set-item {
  margin: 0;
  padding: 0;
  background: var(--vvsu-set-bg-soft);
  list-style: none;
}

#${ROOT_ID} .vvsu-set-item-hit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  min-height: var(--vvsu-set-row-h);
  padding: 0.3rem 0.55rem;
  margin: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: hover) {
  #${ROOT_ID} .vvsu-set-item-hit:hover {
    filter: brightness(0.985);
  }

  html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-item-hit:hover {
    filter: brightness(1.08);
  }
}

#${ROOT_ID} .vvsu-set-item-text {
  min-width: 0;
  flex: 1 1 auto;
}

#${ROOT_ID} .vvsu-set-item-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--vvsu-set-text);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#${ROOT_ID} .vvsu-set-item-hint {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  margin-top: 0.05rem;
  font-size: 0.72rem;
  color: var(--vvsu-set-muted);
  line-height: 1.3;
  overflow: hidden;
}

#${ROOT_ID} .vvsu-set-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

#${ROOT_ID} .vvsu-set-switch input {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}

#${ROOT_ID} .vvsu-set-switch span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: #c5d0dc;
  transition: background 0.15s ease;
  pointer-events: none;
}

html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-switch span {
  background: #2a3b52;
}

#${ROOT_ID} .vvsu-set-switch span::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  transition: transform 0.15s ease;
}

#${ROOT_ID} .vvsu-set-switch input:checked + span {
  background: var(--vvsu-set-accent);
}

#${ROOT_ID} .vvsu-set-switch input:checked + span::after {
  transform: translateX(16px);
}

#${ROOT_ID} .vvsu-set-switch input:focus-visible + span {
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

#${ROOT_ID} .vvsu-set-empty {
  margin: 0.85rem 0.5rem;
  font-size: 0.75rem;
  color: var(--vvsu-set-muted);
  text-align: center;
  line-height: 1.35;
}

#${ROOT_ID} .vvsu-set-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem 0.55rem;
  border-top: 1px solid var(--vvsu-set-border);
  background: var(--vvsu-set-bg);
}

#${ROOT_ID} .vvsu-set-version {
  margin: 0;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--vvsu-set-muted);
  line-height: 1.3;
  white-space: nowrap;
}

#${ROOT_ID} .vvsu-set-links {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

#${ROOT_ID} .vvsu-set-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 0.3rem;
  color: var(--vvsu-set-muted);
  text-decoration: none;
  opacity: 0.85;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}

#${ROOT_ID} .vvsu-set-link:focus-visible {
  color: var(--vvsu-set-accent);
  background: var(--vvsu-set-bg-soft);
  opacity: 1;
  outline: none;
}

@media (hover: hover) {
  #${ROOT_ID} .vvsu-set-link:hover {
    color: var(--vvsu-set-accent);
    background: var(--vvsu-set-bg-soft);
    opacity: 1;
  }
}

#${ROOT_ID} .vvsu-set-link svg {
  display: block;
}

@media (max-width: 767.98px) {
  /* Блокировка скролла страницы под bottom-sheet */
  html.${SCROLL_LOCK_CLASS},
  html.${SCROLL_LOCK_CLASS} body {
    overflow: hidden !important;
    overscroll-behavior: none;
  }

  html.${SCROLL_LOCK_CLASS} #${ROOT_ID} .vvsu-set-panel,
  html.${SCROLL_LOCK_CLASS} #${ROOT_ID} .vvsu-set-body {
    touch-action: pan-y;
  }

  footer.footer .d-flex.justify-content-between:has(#${ROOT_ID}),
  #footer .d-flex.justify-content-between:has(#${ROOT_ID}) {
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    align-items: flex-start;
  }

  /* Поднимаем весь слот над шапкой/карточками сайта */
  #${ROOT_ID}.${OPEN_CLASS} {
    z-index: 2147483000;
  }

  #${ROOT_ID} .vvsu-set-trigger {
    font-size: 0.9rem;
    min-height: 44px;
    padding: 0.45rem 0.15rem;
  }

  #${ROOT_ID} .vvsu-set-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1;
    background: rgba(10, 20, 40, 0.35);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.16s ease, visibility 0.16s ease;
    -webkit-tap-highlight-color: transparent;
  }

  html.${DARK_THEME_CLASS} #${ROOT_ID} .vvsu-set-backdrop {
    background: rgba(0, 0, 0, 0.55);
  }

  #${ROOT_ID}.${OPEN_CLASS} .vvsu-set-backdrop {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  #${ROOT_ID} .vvsu-set-sheet-bar {
    display: flex;
    justify-content: center;
    padding: 0.45rem 0 0.15rem;
  }

  #${ROOT_ID} .vvsu-set-sheet-bar::before {
    content: "";
    width: 2.25rem;
    height: 0.28rem;
    border-radius: 999px;
    background: var(--vvsu-set-border);
  }

  #${ROOT_ID} .vvsu-set-close {
    display: inline-flex;
    width: 2.5rem;
    height: 2.5rem;
  }

  #${ROOT_ID} .vvsu-set-panel {
    position: fixed;
    left: max(0.75rem, env(safe-area-inset-left, 0px));
    right: max(0.75rem, env(safe-area-inset-right, 0px));
    bottom: max(0.75rem, env(safe-area-inset-bottom, 0px), var(--vvsu-set-vv-offset, 0px));
    top: auto;
    width: auto;
    max-width: none;
    max-height: min(
      78vh,
      calc(100dvh - 2rem - env(safe-area-inset-top, 0px) - var(--vvsu-set-vv-offset, 0px))
    );
    z-index: 2;
    /* iOS: не даём rubber-band вылезти за sheet */
    overscroll-behavior: contain;
  }

  #${ROOT_ID} .vvsu-set-panel.vvsu-set-panel--down {
    top: auto;
    bottom: max(0.75rem, env(safe-area-inset-bottom, 0px), var(--vvsu-set-vv-offset, 0px));
  }

  #${ROOT_ID} {
    --vvsu-set-row-h: 2.75rem;
  }

  #${ROOT_ID} .vvsu-set-search-input {
    font-size: 16px; /* без авто-зума iOS при фокусе */
    min-height: 2.5rem;
    padding: 0.55rem 0.65rem 0.55rem 2rem;
  }

  #${ROOT_ID} .vvsu-set-item-hit {
    padding: 0.55rem 0.7rem;
    gap: 0.75rem;
  }

  #${ROOT_ID} .vvsu-set-item-label {
    font-size: 0.9rem;
    white-space: normal;
  }

  #${ROOT_ID} .vvsu-set-item-hint {
    font-size: 0.75rem;
    -webkit-line-clamp: 3;
  }

  #${ROOT_ID} .vvsu-set-switch {
    width: 48px;
    height: 28px;
  }

  #${ROOT_ID} .vvsu-set-switch span::after {
    width: 24px;
    height: 24px;
  }

  #${ROOT_ID} .vvsu-set-switch input:checked + span::after {
    transform: translateX(20px);
  }

  #${ROOT_ID} .vvsu-set-foot {
    padding-bottom: max(0.55rem, env(safe-area-inset-bottom, 0px));
  }

  #${ROOT_ID} .vvsu-set-link {
    width: 2rem;
    height: 2rem;
  }
}

#${ROOT_ID} .vvsu-set-trigger .vvsu-set-trigger-short {
  display: none;
}

@media (max-width: 379.98px) {
  #${ROOT_ID} .vvsu-set-trigger .vvsu-set-trigger-full {
    display: none;
  }

  #${ROOT_ID} .vvsu-set-trigger .vvsu-set-trigger-short {
    display: inline;
  }
}

/* —— OpenID / страница входа: триггер в духе .tech-support —— */
.body-footer,
.body-footer [data-vvsu-tweaks-slot],
.body-footer #${ROOT_ID} {
  overflow: visible !important;
}

/* overflow:visible только пока открыт sheet — иначе ломает скролл карточки входа */
@media (max-width: 767.98px) {
  html.${SCROLL_LOCK_CLASS} .screen .body {
    overflow: visible !important;
  }
}

#${ROOT_ID}[data-vvsu-surface="openid"] {
  display: block;
  width: 100%;
  margin: 0.65rem 0 0.15rem;
  z-index: 40;
}

#${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger {
  min-height: 0;
  padding: 0.15rem 0;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0;
  color: royalblue;
  border-bottom: none;
}

#${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger:focus-visible {
  color: #0a56a4;
  text-decoration: underline;
  border-bottom-color: transparent;
}

@media (hover: hover) {
  #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger:hover {
    color: #0a56a4;
    text-decoration: underline;
    border-bottom-color: transparent;
  }

  html.${DARK_THEME_CLASS} #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger:hover {
    color: #9fd0ff;
  }
}

html.${DARK_THEME_CLASS} #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger {
  color: var(--vvsu-set-accent);
}

html.${DARK_THEME_CLASS} #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger:focus-visible {
  color: #9fd0ff;
}

#${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-panel {
  right: auto;
  left: 0;
  bottom: calc(100% + 0.55rem);
  width: min(22rem, calc(100vw - 2rem));
}

#${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger svg {
  width: 14px;
  height: 14px;
}

/* OpenID mobile: desktop left:0/width не должны ломать fixed bottom-sheet */
@media (max-width: 767.98px) {
  #${ROOT_ID}[data-vvsu-surface="openid"] {
    z-index: 40;
  }

  #${ROOT_ID}[data-vvsu-surface="openid"].${OPEN_CLASS} {
    z-index: 2147483000;
  }

  #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-panel {
    left: max(0.75rem, env(safe-area-inset-left, 0px));
    right: max(0.75rem, env(safe-area-inset-right, 0px));
    bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
    width: auto;
    max-width: none;
  }

  #${ROOT_ID}[data-vvsu-surface="openid"] .vvsu-set-trigger {
    min-height: 44px;
    padding: 0.45rem 0;
    font-size: 0.95rem;
  }
}
`,
    STYLE_ID,
  );
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesQuery(key: SettingKey, query: string): boolean {
  if (!query) return true;
  const meta = SETTING_META[key];
  const haystack = `${meta.label} ${meta.hint} ${key}`.toLowerCase();
  return haystack.includes(query);
}

function buildToggleRow(key: SettingKey, enabled: boolean): HTMLLIElement {
  const meta = SETTING_META[key];
  const li = document.createElement("li");
  li.className = "vvsu-set-item";
  li.dataset.settingKey = key;

  const hit = document.createElement("label");
  hit.className = "vvsu-set-item-hit";

  const text = document.createElement("div");
  text.className = "vvsu-set-item-text";

  const label = document.createElement("span");
  label.className = "vvsu-set-item-label";
  label.textContent = meta.label;

  const hint = document.createElement("span");
  hint.className = "vvsu-set-item-hint";
  hint.textContent = meta.hint;

  text.append(label, hint);

  const sw = document.createElement("span");
  sw.className = "vvsu-set-switch";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = enabled;
  input.setAttribute("aria-label", meta.label);
  input.addEventListener("change", () => {
    setFeatureEnabled(key, input.checked);
  });

  const track = document.createElement("span");
  track.setAttribute("aria-hidden", "true");
  sw.append(input, track);

  hit.append(text, sw);
  li.appendChild(hit);
  return li;
}

/** Правый слот футера кабинета: пустой div напротив .copyright, иначе создаём. */
function resolveCabinetSlot(footer: HTMLElement): HTMLElement {
  const row = footer.querySelector<HTMLElement>(
    ".container > .d-flex, .d-flex.justify-content-between",
  );
  if (row) {
    const copyright = row.querySelector(".copyright");
    if (copyright) {
      let slot = copyright.nextElementSibling;
      while (slot && !(slot instanceof HTMLElement)) {
        slot = slot.nextElementSibling;
      }
      if (slot instanceof HTMLElement) return slot;

      const created = document.createElement("div");
      row.appendChild(created);
      return created;
    }

    const kids = Array.from(row.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (kids.length >= 2) return kids[kids.length - 1]!;
  }

  let slot = footer.querySelector<HTMLElement>("[data-vvsu-tweaks-slot]");
  if (slot) return slot;

  slot = document.createElement("div");
  slot.dataset.vvsuTweaksSlot = "1";
  slot.style.display = "flex";
  slot.style.justifyContent = "flex-end";
  slot.style.padding = "0.75rem 1rem";
  footer.appendChild(slot);
  return slot;
}

/** Слот в футере страницы входа — рядом с техподдержкой. */
function resolveOpenidSlot(footer: HTMLElement): HTMLElement {
  const existing = footer.querySelector<HTMLElement>("[data-vvsu-tweaks-slot]");
  if (existing) return existing;

  const slot = document.createElement("div");
  slot.dataset.vvsuTweaksSlot = "1";

  const tech = footer.querySelector(".tech-support");
  if (tech) {
    tech.after(slot);
  } else {
    const table = footer.querySelector("table");
    if (table) footer.insertBefore(slot, table);
    else footer.appendChild(slot);
  }

  return slot;
}

function resolveSettingsSlot(
  footer: HTMLElement,
  surface: SettingsSurface,
): HTMLElement {
  return surface === "openid"
    ? resolveOpenidSlot(footer)
    : resolveCabinetSlot(footer);
}

/** Смонтировать панель в готовый слот (футер сайта или страница ошибки входа). */
export function mountSettingsInto(
  slot: HTMLElement,
  surface: SettingsSurface = "cabinet",
): void {
  if (document.getElementById(ROOT_ID)) return;

  injectSettingsStyles();
  slot.replaceChildren();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.dataset.vvsuSurface = surface;

  const backdrop = document.createElement("div");
  backdrop.className = "vvsu-set-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.id = `${ROOT_ID}-panel`;
  panel.className = "vvsu-set-panel";
  // Desktop: немодальный поповер. Mobile sheet: aria-modal при открытии
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "Настройки VVSU Tweaks");

  const groups = getSettingsByGroup();
  const settings = getSettings();
  const totalCount = groups.reduce((sum, group) => sum + group.keys.length, 0);

  const sheetBar = document.createElement("div");
  sheetBar.className = "vvsu-set-sheet-bar";
  sheetBar.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "vvsu-set-head";

  const titleRow = document.createElement("div");
  titleRow.className = "vvsu-set-title-row";

  const titleGroup = document.createElement("div");
  titleGroup.className = "vvsu-set-title-group";

  const title = document.createElement("h2");
  title.className = "vvsu-set-title";
  title.id = `${ROOT_ID}-title`;
  title.textContent = "VVSU Tweaks";
  panel.setAttribute("aria-labelledby", title.id);

  const credit = document.createElement("span");
  credit.className = "vvsu-set-credit";
  credit.textContent = "by siNeZix";

  titleGroup.append(title, credit);

  const count = document.createElement("span");
  count.className = "vvsu-set-count";
  count.textContent = formatCount(totalCount, totalCount, false);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "vvsu-set-close";
  closeBtn.setAttribute("aria-label", "Закрыть настройки");
  closeBtn.title = "Закрыть";
  closeBtn.innerHTML = ICON_CLOSE;

  const headEnd = document.createElement("div");
  headEnd.className = "vvsu-set-head-end";
  headEnd.append(count, closeBtn);

  titleRow.append(titleGroup, headEnd);

  const searchWrap = document.createElement("div");
  searchWrap.className = "vvsu-set-search";

  const searchIcon = document.createElement("span");
  searchIcon.className = "vvsu-set-search-icon";
  searchIcon.innerHTML = ICON_SEARCH;

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "vvsu-set-search-input";
  searchInput.placeholder = "Поиск функций…";
  searchInput.setAttribute("aria-label", "Поиск функций");
  searchInput.autocomplete = "off";
  searchInput.spellcheck = false;

  searchWrap.append(searchIcon, searchInput);
  head.append(titleRow, searchWrap);

  const body = document.createElement("div");
  body.className = "vvsu-set-body";
  body.id = `${ROOT_ID}-body`;

  const groupNodes: Array<{
    root: HTMLElement;
    keys: SettingKey[];
    items: Map<SettingKey, HTMLLIElement>;
  }> = [];

  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "vvsu-set-group";
    section.dataset.group = group.id;

    const groupTitle = document.createElement("h3");
    groupTitle.className = "vvsu-set-group-title";
    groupTitle.textContent = group.label;

    const list = document.createElement("ul");
    list.className = "vvsu-set-list";

    const items = new Map<SettingKey, HTMLLIElement>();
    for (const key of group.keys) {
      const row = buildToggleRow(key, settings[key]);
      items.set(key, row);
      list.appendChild(row);
    }

    section.append(groupTitle, list);
    body.appendChild(section);
    groupNodes.push({ root: section, keys: group.keys, items });
  }

  const empty = document.createElement("p");
  empty.className = "vvsu-set-empty";
  empty.hidden = true;
  empty.textContent = "Ничего не найдено";
  body.appendChild(empty);

  const foot = document.createElement("div");
  foot.className = "vvsu-set-foot";

  const version = document.createElement("p");
  version.className = "vvsu-set-version";
  version.textContent = `v${APP_VERSION}`;

  const links = document.createElement("div");
  links.className = "vvsu-set-links";

  const githubLink = document.createElement("a");
  githubLink.className = "vvsu-set-link";
  githubLink.href = GITHUB_URL;
  githubLink.target = "_blank";
  githubLink.rel = "noopener noreferrer";
  githubLink.title = "GitHub";
  githubLink.setAttribute("aria-label", "GitHub");
  githubLink.innerHTML = ICON_GITHUB;

  const telegramLink = document.createElement("a");
  telegramLink.className = "vvsu-set-link";
  telegramLink.href = TELEGRAM_URL;
  telegramLink.target = "_blank";
  telegramLink.rel = "noopener noreferrer";
  telegramLink.title = "Telegram";
  telegramLink.setAttribute("aria-label", "Telegram");
  telegramLink.innerHTML = ICON_TELEGRAM;

  links.append(githubLink, telegramLink);
  foot.append(version, links);
  panel.append(sheetBar, head, body, foot);

  const applyFilter = (rawQuery: string) => {
    const query = normalizeQuery(rawQuery);
    let visible = 0;

    for (const group of groupNodes) {
      let groupVisible = 0;
      for (const key of group.keys) {
        const show = matchesQuery(key, query);
        const item = group.items.get(key);
        if (item) item.hidden = !show;
        if (show) groupVisible += 1;
      }
      group.root.hidden = groupVisible === 0;
      visible += groupVisible;
    }

    empty.hidden = visible > 0;
    count.textContent = formatCount(visible, totalCount, Boolean(query));
  };

  searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value);
  });

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "vvsu-set-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);
  trigger.title = "Настройки VVSU Tweaks";
  trigger.innerHTML = [
    ICON_GEAR,
    '<span class="vvsu-set-trigger-full">VVSU Tweaks</span>',
    '<span class="vvsu-set-trigger-short">Tweaks</span>',
  ].join("");

  const setScrollLock = (locked: boolean) => {
    document.documentElement.classList.toggle(SCROLL_LOCK_CLASS, locked);
  };

  const syncSheetViewport = () => {
    if (!isMobileViewport() || !root.classList.contains(OPEN_CLASS)) {
      panel.style.removeProperty("--vvsu-set-vv-offset");
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      panel.style.removeProperty("--vvsu-set-vv-offset");
      return;
    }
    const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    panel.style.setProperty("--vvsu-set-vv-offset", `${keyboard}px`);
  };

  const placeDesktopPanel = () => {
    if (isMobileViewport()) {
      panel.classList.remove("vvsu-set-panel--down");
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const need = Math.min(window.innerHeight * 0.72, 32 * 16);
    const openDown = spaceAbove < need && spaceBelow > spaceAbove;
    panel.classList.toggle("vvsu-set-panel--down", openDown);
  };

  const getFocusable = (): HTMLElement[] => {
    const nodes = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    return Array.from(nodes).filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
    );
  };

  const setOpen = (open: boolean) => {
    root.classList.toggle(OPEN_CLASS, open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    const mobile = isMobileViewport();
    // На мобилке sheet fixed — без lock страница уезжает под оверлеем
    setScrollLock(open && mobile);
    panel.setAttribute("aria-modal", open && mobile ? "true" : "false");

    if (open) {
      placeDesktopPanel();
      syncSheetViewport();
      // Фокус в поиск только на desktop; на таче клавиатура перекрывает sheet
      requestAnimationFrame(() => {
        if (window.matchMedia("(pointer: fine)").matches) {
          searchInput.focus({ preventScroll: true });
          searchInput.select();
        } else if (mobile) {
          closeBtn.focus({ preventScroll: true });
        }
      });
    } else {
      panel.style.removeProperty("--vvsu-set-vv-offset");
    }
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!root.classList.contains(OPEN_CLASS));
  });

  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.focus({ preventScroll: true });
  });

  backdrop.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  });

  // Закрытие по тапу вне sheet; на мобилке backdrop ловит сам
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!root.classList.contains(OPEN_CLASS)) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      setOpen(false);
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains(OPEN_CLASS)) return;

    if (event.key === "Escape") {
      const focusInside = root.contains(document.activeElement);
      setOpen(false);
      if (focusInside) trigger.focus({ preventScroll: true });
      return;
    }

    // Простой focus trap на мобильном sheet
    if (event.key !== "Tab" || !isMobileViewport()) return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  });

  // Если повернули устройство / изменили ширину — снять lock вне mobile
  window.matchMedia(MOBILE_MQ).addEventListener("change", (event) => {
    if (!event.matches) {
      setScrollLock(false);
      panel.setAttribute("aria-modal", "false");
      panel.style.removeProperty("--vvsu-set-vv-offset");
      if (root.classList.contains(OPEN_CLASS)) placeDesktopPanel();
    } else if (root.classList.contains(OPEN_CLASS)) {
      setScrollLock(true);
      panel.setAttribute("aria-modal", "true");
      syncSheetViewport();
    }
  });

  const onViewportChange = () => syncSheetViewport();
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("scroll", onViewportChange);

  root.append(backdrop, panel, trigger);
  slot.appendChild(root);
  console.info(`[vvsu-tweaks] settings-panel: mounted (${surface})`);
}

function mountSettingsPanel(
  footer: HTMLElement,
  surface: SettingsSurface,
): void {
  const slot = resolveSettingsSlot(footer, surface);
  mountSettingsInto(slot, surface);
}

export const settingsPanel: Feature = {
  id: "settings-panel",
  name: "Панель настроек VVSU Tweaks",
  hosts: ["cabinet", "openid"],
  async run() {
    if (document.getElementById(ROOT_ID)) return;

    const surface: SettingsSurface =
      detectHost() === "openid" ? "openid" : "cabinet";

    const footer = await waitForElement<HTMLElement>(
      surface === "openid"
        ? ".body-footer"
        : "footer.footer, #footer, footer",
    );
    if (!footer) {
      // На PHP-дампе sign-in футера нет — слот монтирует signin-error
      if (!document.getElementById("vvsu-tweaks-signin-error")) {
        console.warn("[vvsu-tweaks] settings-panel: footer not found");
      }
      return;
    }
    mountSettingsPanel(footer, surface);
  },
};
