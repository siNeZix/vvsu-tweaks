import type { Feature } from "./types";
import { injectStyle, waitForElement } from "@/utils/dom";
import { detectHost } from "@/utils/host";
import { isFeatureEnabled } from "@/settings/store";
import { storageGet, storageSet } from "@/utils/storage";

const STORAGE_KEY = "vvsu-tweaks.dark-theme";
const STYLE_ID = "vvsu-tweaks-dark-theme";
export const DARK_THEME_CLASS = "vvsu-tweaks-dark";
const ROOT_CLASS = DARK_THEME_CLASS;
const BTN_CLASS = "vvsu-theme-toggle";

/* Классический полумесяц (Feather/Lucide) */
const ICON_MOON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

/* Солнце: диск + 8 лучей */
const ICON_SUN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0-5a1 1 0 0 1 1 1v1.25a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17.75a1 1 0 0 1 1 1V22a1 1 0 1 1-2 0v-1.25a1 1 0 0 1 1-1zM3 11a1 1 0 1 0 0 2h1.25a1 1 0 1 0 0-2H3zm15.75 0a1 1 0 1 0 0 2H20a1 1 0 1 0 0-2h-1.25zM5.99 4.58a1 1 0 0 0-1.41 1.41l.88.89a1 1 0 1 0 1.42-1.42l-.89-.88zm12.55 12.55a1 1 0 0 0-1.41 1.41l.88.89a1 1 0 0 0 1.42-1.42l-.89-.88zM18.42 5.99a1 1 0 0 0-1.41-1.41l-.89.88a1 1 0 0 0 1.42 1.42l.88-.89zM5.87 18.13a1 1 0 0 0-1.41-1.41l-.89.88a1 1 0 1 0 1.42 1.42l.88-.89z"/></svg>`;

function readDark(): boolean {
  const stored = storageGet(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  // Нет явного выбора — следуем системной теме
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function writeDark(value: boolean): void {
  storageSet(STORAGE_KEY, value ? "1" : "0");
}

function setDark(enabled: boolean): void {
  document.documentElement.classList.toggle(ROOT_CLASS, enabled);
  document.documentElement.dataset.vvsuTheme = enabled ? "dark" : "light";
  if (document.body) {
    document.body.classList.toggle(ROOT_CLASS, enabled);
  }
}

function isDarkThemeHost(host = detectHost()): boolean {
  return host === "cabinet" || host === "openid";
}

/** До runFeatures: класс тёмной темы до первой отрисовки (consent overlay и т.п.). */
export function primeDarkTheme(): void {
  if (!isDarkThemeHost()) return;
  if (!isFeatureEnabled("dark-theme")) return;
  if (!readDark()) return;
  setDark(true);
}

function syncButton(btn: HTMLButtonElement, dark: boolean): void {
  btn.setAttribute("aria-pressed", dark ? "true" : "false");
  btn.title = dark ? "Светлая тема" : "Тёмная тема";
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
}

const SURFACE_MARK = "data-vvsu-dark-surface";
const CELL_MARK = "data-vvsu-dark-cell";
const IMG_MARK = "data-vvsu-dark-img";
const IMG_ORIG = "data-vvsu-img-orig";
const IMG_SRCSET = "data-vvsu-img-srcset";
const IMG_SIZES = "data-vvsu-img-sizes";
const NOTICE_BG = "#1a2740";

function forceSurface(el: HTMLElement): void {
  el.removeAttribute("bgcolor");
  if (el.getAttribute(SURFACE_MARK) === "1") return;
  el.setAttribute(SURFACE_MARK, "1");
  el.style.setProperty("background", NOTICE_BG, "important");
  el.style.setProperty("background-color", NOTICE_BG, "important");
  el.style.setProperty("background-image", "none", "important");
}

function scrubWhiteInline(el: HTMLElement): void {
  if (el.getAttribute(CELL_MARK) === "1") {
    if (el.hasAttribute("bgcolor")) el.removeAttribute("bgcolor");
    return;
  }

  const hasBgcolor = el.hasAttribute("bgcolor");
  const style = el.getAttribute("style") ?? "";
  const looksWhite =
    hasBgcolor ||
    /background(?:-color)?\s*:\s*(#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255)/i.test(
      style,
    );

  if (!looksWhite) return;

  el.setAttribute(CELL_MARK, "1");
  el.removeAttribute("bgcolor");
  el.style.setProperty("background", "transparent", "important");
  el.style.setProperty("background-color", "transparent", "important");
  el.style.setProperty("background-image", "none", "important");
}

/** Белая кайма с краёв → прозрачная (белый текст внутри баннера не трогаем). */
function knockOutEdgeWhite(imageData: ImageData): void {
  const { width, height, data } = imageData;
  const n = width * height;
  const visited = new Uint8Array(n);
  const stack: number[] = [];

  const knockable = (i: number): boolean => {
    const o = i * 4;
    if (data[o + 3] < 20) return false;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min > 215 && max - min < 45;
  };

  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    if (!knockable(i)) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop()!;
    data[i * 4 + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

/** Приглушить яркие цвета баннеров под палитру тёмной темы. */
function toneImageForDark(imageData: ImageData): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    d[i] = (d[i] * 0.7) | 0;
    d[i + 1] = (d[i + 1] * 0.74) | 0;
    d[i + 2] = (d[i + 2] * 0.88) | 0;
  }
}

async function adaptNoticeImage(img: HTMLImageElement): Promise<void> {
  if (img.getAttribute(IMG_MARK) === "1") return;
  img.setAttribute(IMG_MARK, "1");

  try {
    if (!img.complete || img.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => reject(new Error("img")), {
          once: true,
        });
      });
    }

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, w, h);
    } catch {
      return;
    }

    knockOutEdgeWhite(imageData);
    toneImageForDark(imageData);
    ctx.putImageData(imageData, 0, 0);

    if (!img.getAttribute(IMG_ORIG)) {
      img.setAttribute(IMG_ORIG, img.currentSrc || img.src);
      if (img.srcset) img.setAttribute(IMG_SRCSET, img.srcset);
      if (img.sizes) img.setAttribute(IMG_SIZES, img.sizes);
    }
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = canvas.toDataURL("image/png");
  } catch {
    /* CORS / broken image */
  }
}

function adaptNoticeImages(): void {
  if (!document.documentElement.classList.contains(ROOT_CLASS)) return;
  for (const img of document.querySelectorAll<HTMLImageElement>(
    ".message-block img, .message img",
  )) {
    void adaptNoticeImage(img);
  }
}

function clearNoticeImages(): void {
  for (const img of document.querySelectorAll<HTMLImageElement>(
    `img[${IMG_ORIG}]`,
  )) {
    const orig = img.getAttribute(IMG_ORIG);
    const srcset = img.getAttribute(IMG_SRCSET);
    const sizes = img.getAttribute(IMG_SIZES);
    if (orig) img.src = orig;
    if (srcset) img.setAttribute("srcset", srcset);
    else img.removeAttribute("srcset");
    if (sizes) img.setAttribute("sizes", sizes);
    else img.removeAttribute("sizes");
    img.removeAttribute(IMG_ORIG);
    img.removeAttribute(IMG_SRCSET);
    img.removeAttribute(IMG_SIZES);
    img.removeAttribute(IMG_MARK);
  }
}

function clearNoticeDarkSurfaces(): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[${SURFACE_MARK}]`)) {
    el.removeAttribute(SURFACE_MARK);
    el.style.removeProperty("background");
    el.style.removeProperty("background-color");
    el.style.removeProperty("background-image");
  }
  for (const el of document.querySelectorAll<HTMLElement>(`[${CELL_MARK}]`)) {
    el.removeAttribute(CELL_MARK);
    el.style.removeProperty("background");
    el.style.removeProperty("background-color");
    el.style.removeProperty("background-image");
  }
  clearNoticeImages();
}

/** Word/CMS-таблицы и белые плашки оповещений — инлайн !important поверх сайта. */
function scrubNoticeDarkSurfaces(): void {
  if (!document.documentElement.classList.contains(ROOT_CLASS)) return;

  const blocks = document.querySelectorAll<HTMLElement>(
    ".message-block, .message, .message.table, .message.table-cabinet",
  );

  for (const block of blocks) {
    forceSurface(block);

    const wrap = block.closest<HTMLElement>(
      ".card, .card-cabinet, .card-body, .card-border, .bg-white",
    );
    if (wrap) forceSurface(wrap);

    for (const node of block.querySelectorAll<HTMLElement>("*")) {
      scrubWhiteInline(node);
    }
  }

  adaptNoticeImages();
}

let noticeScrubStarted = false;

function startNoticeDarkScrub(): void {
  if (noticeScrubStarted) {
    scrubNoticeDarkSurfaces();
    return;
  }
  noticeScrubStarted = true;

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scrubNoticeDarkSurfaces();
    });
  };

  scrubNoticeDarkSurfaces();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function injectDarkThemeStyles(): void {
  injectStyle(
    `
/* —— кнопка рядом с BVI (как .btn-top-nav с FA) —— */
.${BTN_CLASS} {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-right: 0.4rem;
  min-width: 38px;
  width: 38px;
  height: 32px;
  max-height: 32px;
  padding: 0 !important;
  border: 1px solid #0a56a4;
  border-radius: 0.25rem;
  background: transparent;
  color: #0a56a4;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  line-height: 1;
  box-sizing: border-box;
}

.${BTN_CLASS}:active {
  transform: scale(0.96);
}

.${BTN_CLASS}:focus-visible {
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

@media (hover: hover) {
  .${BTN_CLASS}:hover {
    background-color: #0a56a4 !important;
    border-color: #0a56a4 !important;
    color: #fff !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .${BTN_CLASS} {
    transition: none !important;
  }
}

.${BTN_CLASS} svg {
  display: block;
  width: 18px;
  height: 18px;
  pointer-events: none;
  flex-shrink: 0;
}

@media (max-width: 767.98px) {
  .${BTN_CLASS} {
    min-width: 44px;
    width: 44px;
    height: 44px;
    max-height: 44px;
  }

  .${BTN_CLASS} svg {
    width: 20px;
    height: 20px;
  }

  .${BTN_CLASS}.${BTN_CLASS}--openid {
    min-width: 44px;
    width: 44px;
    height: 44px;
    max-height: none;
    padding: 0 !important;
    margin-right: 0.35rem;
  }
}

html.${ROOT_CLASS} .${BTN_CLASS},
.${ROOT_CLASS} .${BTN_CLASS} {
  border-color: #6ebcfb !important;
  color: #6ebcfb !important;
  background: transparent !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} .${BTN_CLASS}:hover,
  .${ROOT_CLASS} .${BTN_CLASS}:hover {
    background-color: #0a56a4 !important;
    border-color: #0a56a4 !important;
    color: #fff !important;
  }
}

/* —— палитра тёмной темы ВВГУ —— */
html.${ROOT_CLASS} {
  color-scheme: dark;
  --vvsu-blue: #0a56a4;
  --vvsu-blue-mid: #1460af;
  --vvsu-blue-bright: #4d9de0;
  --vvsu-blue-soft: #6ebcfb;
  --vvsu-orange: #e35321;
  --vvsu-bg: #0e1621;
  --vvsu-bg-raised: #152032;
  --vvsu-bg-card: #1a2740;
  --vvsu-bg-header: #121c2b;
  --vvsu-bg-hero: #083a72;
  --vvsu-bg-input: #121c2b;
  --vvsu-bg-hover: #243652;
  --vvsu-bg-stripe: #1e2d45;
  --vvsu-text: #e6edf5;
  --vvsu-text-muted: #9aadc2;
  --vvsu-border: #2a3b52;
  --vvsu-shadow: rgba(0, 0, 0, 0.45);
  /* Bootstrap 5 (OpenID / fort): компоненты на var(--bs-*) */
  --bs-body-bg: #0e1621;
  --bs-body-bg-rgb: 14, 22, 33;
  --bs-body-color: #e6edf5;
  --bs-body-color-rgb: 230, 237, 245;
  --bs-secondary-color: #9aadc2;
  --bs-secondary-bg: #152032;
  --bs-tertiary-bg: #1a2740;
  --bs-border-color: #2a3b52;
  --bs-heading-color: #6ebcfb;
}

html.${ROOT_CLASS},
html.${ROOT_CLASS} body,
body.${ROOT_CLASS} {
  /* сайт: body{background-color:#f5f5f5!important} */
  background-color: var(--vvsu-bg) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .main-content {
  color: var(--vvsu-text);
}

/* Шапка */
html.${ROOT_CLASS} .header {
  background: var(--vvsu-bg-header) !important;
  box-shadow: 0 0 20px 0 var(--vvsu-shadow) !important;
  border-bottom: 1px solid var(--vvsu-border);
}

html.${ROOT_CLASS} .heading a,
html.${ROOT_CLASS} .header a:not(.btn) {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .btn-top-nav {
  color: var(--vvsu-blue-soft) !important;
  border-color: var(--vvsu-blue-soft) !important;
  background: transparent !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} .btn-top-nav:hover {
    background-color: var(--vvsu-blue) !important;
    border-color: var(--vvsu-blue) !important;
    color: #fff !important;
  }
}

/* Синяя полоса бренда */
html.${ROOT_CLASS} .head-content {
  background-color: var(--vvsu-bg-hero) !important;
  background-image: linear-gradient(160deg, #0a56a5 0%, #062f5c 55%, #0a457f 100%) !important;
}

html.${ROOT_CLASS} .crumbs,
html.${ROOT_CLASS} .crumbs a,
html.${ROOT_CLASS} .head-content .crumbs,
html.${ROOT_CLASS} .head-content .text-white {
  color: #d7e8fa !important;
}

html.${ROOT_CLASS} .crumbs a:hover {
  color: #fff !important;
}

/* Карточки и белые поверхности */
html.${ROOT_CLASS} .card,
html.${ROOT_CLASS} .card-cabinet,
html.${ROOT_CLASS} .card-portfolio,
html.${ROOT_CLASS} .card-border,
html.${ROOT_CLASS} .bg-white,
html.${ROOT_CLASS} .main-content .card,
html.${ROOT_CLASS} .main-content .card-cabinet,
html.${ROOT_CLASS} .main-content .card-body,
html.${ROOT_CLASS} .main-content .bg-white,
html.${ROOT_CLASS} .main-content .card-border,
html.${ROOT_CLASS} body .main-content .card,
html.${ROOT_CLASS} body .main-content .card-cabinet,
html.${ROOT_CLASS} body .main-content .card-body,
html.${ROOT_CLASS} .dropdown-menu {
  background-color: var(--vvsu-bg-card) !important;
  background: var(--vvsu-bg-card) !important;
  background-image: none !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
  box-shadow: 0 0 20px var(--vvsu-shadow) !important;
}

html.${ROOT_CLASS} .card-cabinet {
  border: 1px solid var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .card-body,
html.${ROOT_CLASS} .card-header,
html.${ROOT_CLASS} .card-footer,
html.${ROOT_CLASS} .modal-content,
html.${ROOT_CLASS} .list-group-item {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

/* Типографика профиля */
html.${ROOT_CLASS} .fio h1,
html.${ROOT_CLASS} .fio .h3,
html.${ROOT_CLASS} .h3,
html.${ROOT_CLASS} .title,
html.${ROOT_CLASS} h1,
html.${ROOT_CLASS} h2,
html.${ROOT_CLASS} h3,
html.${ROOT_CLASS} h4,
html.${ROOT_CLASS} h5,
html.${ROOT_CLASS} .person .info {
  color: var(--vvsu-blue-soft) !important;
}

/* Смысловые цвета внутри alert / status — не перекрашиваем */
html.${ROOT_CLASS} .alert h1,
html.${ROOT_CLASS} .alert h2,
html.${ROOT_CLASS} .alert h3,
html.${ROOT_CLASS} .alert h4,
html.${ROOT_CLASS} .alert h5,
html.${ROOT_CLASS} .alert .h1,
html.${ROOT_CLASS} .alert .h2,
html.${ROOT_CLASS} .alert .h3,
html.${ROOT_CLASS} .alert .h4,
html.${ROOT_CLASS} .alert .h5,
html.${ROOT_CLASS} .alert,
html.${ROOT_CLASS} .alert * {
  color: inherit !important;
}

html.${ROOT_CLASS} .alert-info { color: var(--vvsu-text) !important; }
html.${ROOT_CLASS} .alert-warning { color: #f0e0b0 !important; }
html.${ROOT_CLASS} .alert-danger { color: #f0c0c0 !important; }
html.${ROOT_CLASS} .alert-success { color: #c0f0d0 !important; }
html.${ROOT_CLASS} .alert-primary { color: var(--vvsu-blue-soft) !important; }
html.${ROOT_CLASS} .alert-secondary,
html.${ROOT_CLASS} .alert-light { color: var(--vvsu-text) !important; }

/* сайт: strong{color:#42505f} — тёмный текст на тёмном фоне */
html.${ROOT_CLASS} strong,
html.${ROOT_CLASS} b {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .alert strong,
html.${ROOT_CLASS} .alert b,
html.${ROOT_CLASS} .text-danger,
html.${ROOT_CLASS} .text-danger *,
html.${ROOT_CLASS} .text-success,
html.${ROOT_CLASS} .text-success *,
html.${ROOT_CLASS} .text-warning,
html.${ROOT_CLASS} .text-warning * {
  color: inherit !important;
}

html.${ROOT_CLASS} .text-danger { color: #e06060 !important; }
html.${ROOT_CLASS} .text-success { color: #3dba74 !important; }
html.${ROOT_CLASS} .text-warning { color: #e0b050 !important; }

html.${ROOT_CLASS} .line {
  background: var(--vvsu-orange) !important;
}

html.${ROOT_CLASS} .person label,
html.${ROOT_CLASS} .person .mail,
html.${ROOT_CLASS} .person .eduinfo,
html.${ROOT_CLASS} .file-sum,
html.${ROOT_CLASS} .copyright {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .text-dark,
html.${ROOT_CLASS} .text-body,
html.${ROOT_CLASS} .text-black-50,
html.${ROOT_CLASS} .text-muted {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .person i.fas,
html.${ROOT_CLASS} .person i.bi {
  color: var(--vvsu-blue-bright) !important;
}

html.${ROOT_CLASS} .dropdown-toggle::after {
  color: var(--vvsu-blue-soft) !important;
}

/* Ссылки основного контента */
html.${ROOT_CLASS} .main-content a:not(.nav-link):not(.main-nav-link):not(.dropdown-item):not(.btn):not(.page-link):not(.label):not(.carousel-control) {
  color: var(--vvsu-blue-soft) !important;
  border-bottom-color: rgba(110, 188, 251, 0.35) !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} .main-content a:not(.nav-link):not(.main-nav-link):not(.dropdown-item):not(.btn):not(.page-link):not(.label):not(.carousel-control):hover {
    background: var(--vvsu-bg-hover) !important;
    color: #fff !important;
  }
}

/* Навигация кабинета (pills, tabs — у сайта background:white) */
html.${ROOT_CLASS} a.nav-link,
html.${ROOT_CLASS} .nav-link,
html.${ROOT_CLASS} .nav-pills .nav-link,
html.${ROOT_CLASS} .nav-tabs .nav-link {
  background: var(--vvsu-bg-raised) !important;
  background-color: var(--vvsu-bg-raised) !important;
  border-color: var(--vvsu-blue) !important;
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} a.nav-link.active,
html.${ROOT_CLASS} .nav-link.active,
html.${ROOT_CLASS} .nav-pills .nav-link.active,
html.${ROOT_CLASS} .nav-tabs .nav-link.active,
html.${ROOT_CLASS} .nav-pills .show > .nav-link,
html.${ROOT_CLASS} .nav-tabs .show > .nav-link {
  background: var(--vvsu-blue-mid) !important;
  background-color: var(--vvsu-blue-mid) !important;
  border-color: var(--vvsu-blue-mid) !important;
  color: #fff !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} a.nav-link:hover,
  html.${ROOT_CLASS} .nav-link:hover,
  html.${ROOT_CLASS} .nav-pills .nav-link:hover,
  html.${ROOT_CLASS} .nav-tabs .nav-link:hover {
    background: var(--vvsu-blue-mid) !important;
    background-color: var(--vvsu-blue-mid) !important;
    border-color: var(--vvsu-blue-mid) !important;
    color: #fff !important;
  }
}

html.${ROOT_CLASS} .nav-tabs {
  border-bottom-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .nav-tabs .nav-link {
  border-radius: 0.25rem 0.25rem 0 0 !important;
}

html.${ROOT_CLASS} .nav-tabs .nav-link.active {
  border-bottom-color: var(--vvsu-blue-mid) !important;
}

html.${ROOT_CLASS} .nav-tabs .nav-link b,
html.${ROOT_CLASS} .nav-pills .nav-link b,
html.${ROOT_CLASS} a.nav-link b {
  color: inherit !important;
}

/* Главные плитки кабинета (.main-nav-pills) — сетка карточек, не compact pills */
html.${ROOT_CLASS} ul.main-nav-pills,
html.${ROOT_CLASS} ul.main-nav-pills.cabinet-stud {
  background: transparent !important;
  border-color: transparent !important;
}

html.${ROOT_CLASS} .main-nav-item,
html.${ROOT_CLASS} .main-nav-pills .main-nav-item {
  background: transparent !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} a.main-nav-link,
html.${ROOT_CLASS} .main-nav-link,
html.${ROOT_CLASS} .main-nav-pills .main-nav-link,
html.${ROOT_CLASS} .main-nav-pills.cabinet-stud .main-nav-link {
  background: var(--vvsu-bg-card) !important;
  background-color: var(--vvsu-bg-card) !important;
  background-image: none !important;
  border: 1px solid rgba(110, 188, 251, 0.35) !important;
  color: #f0f6fc !important;
  box-shadow: none !important;
  text-decoration: none !important;
  outline: none !important;
}

html.${ROOT_CLASS} a.main-nav-link:focus,
html.${ROOT_CLASS} .main-nav-link:focus,
html.${ROOT_CLASS} a.main-nav-link.active,
html.${ROOT_CLASS} .main-nav-link.active,
html.${ROOT_CLASS} .main-nav-pills .main-nav-link.active,
html.${ROOT_CLASS} .main-nav-pills.cabinet-stud .main-nav-link.active {
  background: #243652 !important;
  background-color: #243652 !important;
  border-color: var(--vvsu-blue-soft) !important;
  color: #fff !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} a.main-nav-link:hover,
  html.${ROOT_CLASS} .main-nav-link:hover,
  html.${ROOT_CLASS} .main-nav-pills .main-nav-link:hover,
  html.${ROOT_CLASS} .main-nav-pills.cabinet-stud .main-nav-link:hover {
    background: #243652 !important;
    background-color: #243652 !important;
    border-color: var(--vvsu-blue-soft) !important;
    color: #fff !important;
  }

  html.${ROOT_CLASS} .main-nav-pills .main-nav-link:hover i,
  html.${ROOT_CLASS} a.main-nav-link:hover i {
    color: #fff !important;
  }
}

html.${ROOT_CLASS} .main-nav-pills .main-nav-link i,
html.${ROOT_CLASS} a.main-nav-link i,
html.${ROOT_CLASS} .main-nav-pills.cabinet-stud .main-nav-link i {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .main-nav-pills .main-nav-link.active i,
html.${ROOT_CLASS} a.main-nav-link.active i {
  color: #fff !important;
}

html.${ROOT_CLASS} .tab-content,
html.${ROOT_CLASS} .tab-pane {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .dropdown-item {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .dropdown-item:focus {
  background-color: var(--vvsu-bg-hover) !important;
  color: #fff !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} .dropdown-item:hover {
    background-color: var(--vvsu-bg-hover) !important;
    color: #fff !important;
  }
}

html.${ROOT_CLASS} .dropdown-divider {
  border-top-color: var(--vvsu-border) !important;
}

/* Таблицы */
html.${ROOT_CLASS} .table,
html.${ROOT_CLASS} .table-cabinet {
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .table th,
html.${ROOT_CLASS} .table td,
html.${ROOT_CLASS} .table-bordered,
html.${ROOT_CLASS} .table-bordered th,
html.${ROOT_CLASS} .table-bordered td {
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-text) !important;
  background-color: transparent;
}

/* Заголовки дней в расписании (часто bold/colspan) */
html.${ROOT_CLASS} .table td b,
html.${ROOT_CLASS} .table td strong,
html.${ROOT_CLASS} .table th b,
html.${ROOT_CLASS} .table-cabinet tbody td,
html.${ROOT_CLASS} .table-cabinet tbody th {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .table-cabinet tbody td[colspan],
html.${ROOT_CLASS} .table-cabinet tbody th[colspan] {
  color: var(--vvsu-blue-soft) !important;
  background-color: #0f2a4a !important;
  font-weight: 600;
}

/* сайт: .table thead{background:#e7eef6;border-bottom:1px solid #cfdfee} */
html.${ROOT_CLASS} .table thead,
html.${ROOT_CLASS} .table-cabinet thead,
html.${ROOT_CLASS} .thead-v-secondary,
html.${ROOT_CLASS} .table thead th,
html.${ROOT_CLASS} .table-cabinet thead th {
  background: #0f2a4a !important;
  background-color: #0f2a4a !important;
  color: var(--vvsu-blue-soft) !important;
  border-color: var(--vvsu-border) !important;
  border-bottom-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .table-striped tbody tr:nth-of-type(odd) {
  background-color: var(--vvsu-bg-stripe) !important;
}

html.${ROOT_CLASS} .table-striped tbody tr:nth-of-type(even) {
  background-color: var(--vvsu-bg-card) !important;
}

html.${ROOT_CLASS} .table-hover tbody tr:hover,
html.${ROOT_CLASS} .table-striped tbody tr:hover {
  background-color: var(--vvsu-bg-hover) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .table a {
  color: var(--vvsu-blue-soft) !important;
}

/* Оповещения: белая плашка .message-block + Word/CMS-таблицы */
html.${ROOT_CLASS} .message-block,
html.${ROOT_CLASS} .message,
html.${ROOT_CLASS} .message.table,
html.${ROOT_CLASS} .message.table-cabinet,
html.${ROOT_CLASS} .message.table-bordered {
  background: var(--vvsu-bg-card) !important;
  background-color: var(--vvsu-bg-card) !important;
  background-image: none !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
  box-shadow: none !important;
}

html.${ROOT_CLASS} .message-block h5,
html.${ROOT_CLASS} .message-block h4,
html.${ROOT_CLASS} .message-block h3,
html.${ROOT_CLASS} .vvsu-log-new,
html.${ROOT_CLASS} .vvsu-log-new * {
  color: var(--vvsu-blue-soft) !important;
  background-color: transparent !important;
}

html.${ROOT_CLASS} .message-block .font-weight-bold:not(.vvsu-log-new) {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .message-block *,
html.${ROOT_CLASS} .message * {
  background-color: transparent !important;
  background-image: none !important;
}

html.${ROOT_CLASS} .message-block,
html.${ROOT_CLASS} .message {
  background: var(--vvsu-bg-card) !important;
  background-color: var(--vvsu-bg-card) !important;
}

html.${ROOT_CLASS} .message table,
html.${ROOT_CLASS} .message-block table,
html.${ROOT_CLASS} .main-content .message table,
html.${ROOT_CLASS} .main-content table:not(.table) {
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
  background: transparent !important;
  background-color: transparent !important;
}

html.${ROOT_CLASS} .message table td,
html.${ROOT_CLASS} .message table th,
html.${ROOT_CLASS} .message-block table td,
html.${ROOT_CLASS} .message-block table th,
html.${ROOT_CLASS} .message table tr,
html.${ROOT_CLASS} .message-block table tr,
html.${ROOT_CLASS} .main-content table:not(.table) td,
html.${ROOT_CLASS} .main-content table:not(.table) th {
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
  background: transparent !important;
  background-color: transparent !important;
}

html.${ROOT_CLASS} .message p,
html.${ROOT_CLASS} .message span,
html.${ROOT_CLASS} .message font,
html.${ROOT_CLASS} .message strong,
html.${ROOT_CLASS} .message b,
html.${ROOT_CLASS} .message-block p,
html.${ROOT_CLASS} .message-block span,
html.${ROOT_CLASS} .message-block font,
html.${ROOT_CLASS} .message-block strong,
html.${ROOT_CLASS} .message-block b {
  color: var(--vvsu-text) !important;
  background: transparent !important;
  background-color: transparent !important;
}

html.${ROOT_CLASS} .message a,
html.${ROOT_CLASS} .message-block a {
  color: var(--vvsu-blue-soft) !important;
  background-color: transparent !important;
}

html.${ROOT_CLASS} .message img,
html.${ROOT_CLASS} .message-block img {
  max-width: 100%;
  height: auto;
  border-radius: 0.4rem;
  vertical-align: middle;
  background: transparent !important;
}

/* Фильтр расписания — белая плашка .news-filter */
html.${ROOT_CLASS} .news-filter,
html.${ROOT_CLASS} #process-filters.news-filter,
html.${ROOT_CLASS} #process-filters {
  background: var(--vvsu-bg-card) !important;
  background-color: var(--vvsu-bg-card) !important;
  box-shadow: 0 0 20px var(--vvsu-shadow) !important;
  border: 1px solid var(--vvsu-border);
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .vvsu-filter-drop,
html.${ROOT_CLASS} .vvsu-filter-text .dropdown-menu {
  background-color: var(--vvsu-bg-card) !important;
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-text) !important;
}

/* Формы */
html.${ROOT_CLASS} .form-control,
html.${ROOT_CLASS} input.form-control,
html.${ROOT_CLASS} select.form-control,
html.${ROOT_CLASS} textarea.form-control,
html.${ROOT_CLASS} .custom-select,
html.${ROOT_CLASS} .form-control.bg-white,
html.${ROOT_CLASS} .form-control.text-dark,
html.${ROOT_CLASS} input.form-control.bg-white.text-dark,
html.${ROOT_CLASS} .vvsu-filter-text .form-control,
html.${ROOT_CLASS} .input-group .form-control {
  background-color: #121c2b !important;
  background-image: none !important;
  color: #e6edf5 !important;
  border-color: var(--vvsu-border) !important;
  -webkit-text-fill-color: #e6edf5;
  caret-color: #e6edf5;
}

html.${ROOT_CLASS} .form-control::placeholder {
  color: var(--vvsu-text-muted) !important;
  -webkit-text-fill-color: var(--vvsu-text-muted);
  opacity: 1;
}

html.${ROOT_CLASS} .form-control:focus {
  background-color: #152032 !important;
  border-color: var(--vvsu-blue-bright) !important;
  color: #e6edf5 !important;
  box-shadow: 0 0 0 0.2rem rgba(10, 86, 164, 0.35) !important;
}

/* Chrome autofill: светлый фон + наш светлый текст = нечитаемо */
html.${ROOT_CLASS} input:-webkit-autofill,
html.${ROOT_CLASS} input:-webkit-autofill:hover,
html.${ROOT_CLASS} input:-webkit-autofill:focus,
html.${ROOT_CLASS} textarea:-webkit-autofill,
html.${ROOT_CLASS} select:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #121c2b inset !important;
  box-shadow: 0 0 0 1000px #121c2b inset !important;
  -webkit-text-fill-color: #e6edf5 !important;
  caret-color: #e6edf5;
  border-color: var(--vvsu-border) !important;
  transition: background-color 99999s ease-out;
}

html.${ROOT_CLASS} .form-control[readonly],
html.${ROOT_CLASS} .form-control:disabled {
  background-color: #152032 !important;
  color: var(--vvsu-text-muted) !important;
  -webkit-text-fill-color: var(--vvsu-text-muted);
  opacity: 1 !important;
}

html.${ROOT_CLASS} .input-group-text,
html.${ROOT_CLASS} .input-group-append .btn,
html.${ROOT_CLASS} .input-group-prepend .btn {
  background-color: var(--vvsu-bg-raised) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .input-group-append .btn-primary {
  background-color: var(--vvsu-blue) !important;
  border-color: var(--vvsu-blue) !important;
  color: #fff !important;
}

/* Кнопки */
html.${ROOT_CLASS} .btn-primary,
html.${ROOT_CLASS} .btn-filter {
  background-color: var(--vvsu-blue) !important;
  border-color: var(--vvsu-blue) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .btn-primary:hover,
html.${ROOT_CLASS} .btn-filter:hover {
  background-color: var(--vvsu-blue-mid) !important;
  border-color: var(--vvsu-blue-mid) !important;
}

html.${ROOT_CLASS} .btn-secondary,
html.${ROOT_CLASS} .btn-outline-secondary,
html.${ROOT_CLASS} .btn-light,
html.${ROOT_CLASS} .vsu_flt_rst,
html.${ROOT_CLASS} .vsu_flt_rst.btn,
html.${ROOT_CLASS} input.vsu_flt_rst {
  background-color: var(--vvsu-bg-raised) !important;
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .main-content a.label.full-danger {
  background: #a82828 !important;
  color: #fff !important;
  border-color: transparent !important;
}

html.${ROOT_CLASS} .main-content .label.full-danger:hover,
html.${ROOT_CLASS} .main-content .label.full-danger:focus {
  background: transparent !important;
  border-color: #e06060 !important;
  color: #e06060 !important;
}

/* Пагинация / карусель расписания */
html.${ROOT_CLASS} .carousel-indicators li,
html.${ROOT_CLASS} .carousel-indicators .active {
  background-color: transparent !important;
  background: transparent !important;
  opacity: 1 !important;
  text-indent: 0 !important;
}

html.${ROOT_CLASS} .page-item .page-link,
html.${ROOT_CLASS} .page-link,
html.${ROOT_CLASS} .timetable-slider-link,
html.${ROOT_CLASS} .carousel .page-link {
  background-color: var(--vvsu-bg-raised) !important;
  border: 1px solid var(--vvsu-border) !important;
  color: var(--vvsu-blue-soft) !important;
  width: auto !important;
  min-width: 2.5rem;
  height: auto !important;
  min-height: 30px;
  padding: 0.35rem 0.7rem !important;
  line-height: 1.25 !important;
}

html.${ROOT_CLASS} .page-item.active .page-link,
html.${ROOT_CLASS} .page-item.active .timetable-slider-link,
html.${ROOT_CLASS} .page-item .page-link:hover {
  background: #125ead !important;
  border-color: #125ead !important;
  color: #fff !important;
}

/* Стрелки уже белые на синем фоне сайта — не инвертировать */
html.${ROOT_CLASS} .carousel-control {
  background-color: var(--vvsu-blue) !important;
  border-bottom: none !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .carousel-control:hover {
  background-color: var(--vvsu-blue-mid) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .carousel-control-prev-icon,
html.${ROOT_CLASS} .carousel-control-next-icon {
  filter: none;
}

/* Футер */
html.${ROOT_CLASS} .footer,
html.${ROOT_CLASS} #footer {
  background-color: var(--vvsu-bg-header) !important;
  color: var(--vvsu-text-muted) !important;
  border-top: 1px solid var(--vvsu-border);
}

/* Вспомогательные bootstrap-утилиты */
html.${ROOT_CLASS} .bg-light,
html.${ROOT_CLASS} .bg-white,
html.${ROOT_CLASS} .bg-transparent.bg-white {
  background-color: var(--vvsu-bg-card) !important;
}

html.${ROOT_CLASS} .border,
html.${ROOT_CLASS} .border-light,
html.${ROOT_CLASS} .border-top,
html.${ROOT_CLASS} .border-bottom,
html.${ROOT_CLASS} .border-left,
html.${ROOT_CLASS} .border-right,
html.${ROOT_CLASS} .border-secondary {
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .text-primary {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .text-secondary,
html.${ROOT_CLASS} .text-black-50 {
  color: var(--vvsu-text-muted) !important;
}

/* Алерты */
html.${ROOT_CLASS} .alert,
html.${ROOT_CLASS} .alert-secondary,
html.${ROOT_CLASS} .alert-light {
  background-color: var(--vvsu-bg-raised) !important;
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .alert-info {
  background-color: #143352 !important;
  border-color: #1e4a73 !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .alert-warning {
  background-color: #3a2e14 !important;
  border-color: #6b5420 !important;
  color: #f0e0b0 !important;
}

html.${ROOT_CLASS} .alert-danger {
  background-color: #3a1818 !important;
  border-color: #6b2a2a !important;
  color: #f0c0c0 !important;
}

html.${ROOT_CLASS} .alert-success {
  background-color: #143a22 !important;
  border-color: #1e5a34 !important;
  color: #c0f0d0 !important;
}

html.${ROOT_CLASS} .alert-primary {
  background-color: #0f2a4a !important;
  border-color: #1e4a73 !important;
  color: var(--vvsu-blue-soft) !important;
}

/* —— запас по компонентам других разделов кабинета —— */

/* Таблицы: светлые варианты Bootstrap */
html.${ROOT_CLASS} .thead-light th,
html.${ROOT_CLASS} .table .thead-light th,
html.${ROOT_CLASS} .table-light,
html.${ROOT_CLASS} .table-light > th,
html.${ROOT_CLASS} .table-light > td,
html.${ROOT_CLASS} .table-secondary,
html.${ROOT_CLASS} .table-secondary > th,
html.${ROOT_CLASS} .table-secondary > td {
  background-color: #0f2a4a !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .table-primary,
html.${ROOT_CLASS} .table-info {
  background-color: #143352 !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .table-warning {
  background-color: #3a2e14 !important;
  color: #f0e0b0 !important;
}

html.${ROOT_CLASS} .table-danger {
  background-color: #3a1818 !important;
  color: #f0c0c0 !important;
}

html.${ROOT_CLASS} .table-success {
  background-color: #143a22 !important;
  color: #c0f0d0 !important;
}

html.${ROOT_CLASS} .table-active,
html.${ROOT_CLASS} .table-hover tbody tr:hover > * {
  background-color: var(--vvsu-bg-hover) !important;
  color: #fff !important;
}

/* Бейджи / лейблы */
html.${ROOT_CLASS} .badge,
html.${ROOT_CLASS} .badge-light,
html.${ROOT_CLASS} .badge-secondary,
html.${ROOT_CLASS} .label,
html.${ROOT_CLASS} .label-default {
  background-color: var(--vvsu-bg-hover) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .badge-primary,
html.${ROOT_CLASS} .label-primary {
  background-color: var(--vvsu-blue) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .badge-info,
html.${ROOT_CLASS} .label-info {
  background-color: #1e4a73 !important;
  color: #d7e8fa !important;
}

/* Модалки */
html.${ROOT_CLASS} .modal-content,
html.${ROOT_CLASS} .modal-header,
html.${ROOT_CLASS} .modal-body,
html.${ROOT_CLASS} .modal-footer {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .modal-header .close,
html.${ROOT_CLASS} .modal-header .btn-close,
html.${ROOT_CLASS} .close {
  color: var(--vvsu-text) !important;
  text-shadow: none !important;
  opacity: 0.85;
}

html.${ROOT_CLASS} .modal-backdrop.show {
  opacity: 0.7;
}

/* Поповеры / тосты / тултипы */
html.${ROOT_CLASS} .popover,
html.${ROOT_CLASS} .popover-header,
html.${ROOT_CLASS} .popover-body,
html.${ROOT_CLASS} .toast,
html.${ROOT_CLASS} .toast-header,
html.${ROOT_CLASS} .toast-body {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .tooltip-inner {
  background-color: #0a2038 !important;
  color: #fff !important;
}

/* Хлебные крошки (если вне .crumbs) */
html.${ROOT_CLASS} .breadcrumb {
  background-color: var(--vvsu-bg-raised) !important;
}

html.${ROOT_CLASS} .breadcrumb-item,
html.${ROOT_CLASS} .breadcrumb-item + .breadcrumb-item::before {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .breadcrumb-item a {
  color: var(--vvsu-blue-soft) !important;
}

/* Прогресс, джамботрон, hr, код */
html.${ROOT_CLASS} .progress {
  background-color: var(--vvsu-bg-raised) !important;
}

html.${ROOT_CLASS} .jumbotron,
html.${ROOT_CLASS} .jumbotron-fluid {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} hr {
  border-top-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} pre,
html.${ROOT_CLASS} code,
html.${ROOT_CLASS} kbd,
html.${ROOT_CLASS} samp {
  background-color: var(--vvsu-bg-raised) !important;
  color: var(--vvsu-blue-soft) !important;
  border-color: var(--vvsu-border);
}

/* Списки */
html.${ROOT_CLASS} .list-group {
  background-color: transparent !important;
}

html.${ROOT_CLASS} .list-group-item,
html.${ROOT_CLASS} .list-group-item-action {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .list-group-item-action:hover,
html.${ROOT_CLASS} .list-group-item-action:focus,
html.${ROOT_CLASS} .list-group-item.active {
  background-color: var(--vvsu-bg-hover) !important;
  color: #fff !important;
  border-color: var(--vvsu-border) !important;
}

/* Аккордеон / collapse-карточки */
html.${ROOT_CLASS} .accordion > .card,
html.${ROOT_CLASS} .collapse .card,
html.${ROOT_CLASS} .collapsing .card {
  background-color: var(--vvsu-bg-card) !important;
}

/* Чекбоксы / радио Bootstrap custom */
html.${ROOT_CLASS} .custom-control-label::before,
html.${ROOT_CLASS} .custom-file-label {
  background-color: var(--vvsu-bg-input) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .custom-file-label::after {
  background-color: var(--vvsu-bg-raised) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

/* Инпуты без .form-control (редко, но бывают) */
html.${ROOT_CLASS} input[type="text"],
html.${ROOT_CLASS} input[type="search"],
html.${ROOT_CLASS} input[type="email"],
html.${ROOT_CLASS} input[type="password"],
html.${ROOT_CLASS} input[type="number"],
html.${ROOT_CLASS} input[type="tel"],
html.${ROOT_CLASS} input[type="url"],
html.${ROOT_CLASS} input[type="date"],
html.${ROOT_CLASS} input[type="datetime-local"],
html.${ROOT_CLASS} input[type="month"],
html.${ROOT_CLASS} input[type="week"],
html.${ROOT_CLASS} input[type="time"],
html.${ROOT_CLASS} select,
html.${ROOT_CLASS} textarea {
  background-color: var(--vvsu-bg-input) !important;
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} option,
html.${ROOT_CLASS} optgroup {
  background-color: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
}

/* Кнопки outline / link / default */
html.${ROOT_CLASS} .btn-outline-primary {
  color: var(--vvsu-blue-soft) !important;
  border-color: var(--vvsu-blue) !important;
  background: transparent !important;
}

html.${ROOT_CLASS} .btn-outline-primary:hover {
  background: var(--vvsu-blue) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .btn-outline-light,
html.${ROOT_CLASS} .btn-outline-dark,
html.${ROOT_CLASS} .btn-default {
  color: var(--vvsu-text) !important;
  border-color: var(--vvsu-border) !important;
  background: var(--vvsu-bg-raised) !important;
}

html.${ROOT_CLASS} .btn-link {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .btn-link:hover {
  color: #fff !important;
}

html.${ROOT_CLASS} .nav-link.disabled,
html.${ROOT_CLASS} .main-nav-link.disabled,
html.${ROOT_CLASS} .page-item.disabled .page-link {
  color: var(--vvsu-text-muted) !important;
  background-color: var(--vvsu-bg-raised) !important;
  opacity: 0.55;
}

/* Пагинация вне карусели (+ www-стиль ul.pagination li a без .page-link) */
html.${ROOT_CLASS} .pagination .page-link,
html.${ROOT_CLASS} ul.pagination li a,
html.${ROOT_CLASS} ul.pagination li:first-child a,
html.${ROOT_CLASS} ul.pagination li:last-child a {
  background-color: var(--vvsu-bg-raised) !important;
  background: var(--vvsu-bg-raised) !important;
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} ul.pagination li a:hover,
html.${ROOT_CLASS} ul.pagination li:first-child a:hover,
html.${ROOT_CLASS} ul.pagination li:last-child a:hover,
html.${ROOT_CLASS} ul.pagination li.active a,
html.${ROOT_CLASS} ul.pagination li.active a:hover {
  background: var(--vvsu-blue-mid) !important;
  background-color: var(--vvsu-blue-mid) !important;
  border-color: var(--vvsu-blue-soft) !important;
  color: #fff !important;
}

/* Футер: линия-разделитель сайта */
html.${ROOT_CLASS} footer .container > div,
html.${ROOT_CLASS} #footer .container > div {
  border-top-color: var(--vvsu-border) !important;
}

/* Контентные обёртки / PDF-блоки / фильтры */
html.${ROOT_CLASS} #cnt,
html.${ROOT_CLASS} #filter-content,
html.${ROOT_CLASS} .portfolio_text,
html.${ROOT_CLASS} .cabinetMain,
html.${ROOT_CLASS} .pdf {
  color: var(--vvsu-text);
}

html.${ROOT_CLASS} .file-sum {
  color: var(--vvsu-text-muted) !important;
}

/* —— пробелы из /css/main.css (не покрытые при тесте расписания) —— */

html.${ROOT_CLASS} .text-gray,
html.${ROOT_CLASS} .text-gray a,
html.${ROOT_CLASS} .status,
html.${ROOT_CLASS} span.no-items {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .text-gray a:hover {
  background: var(--vvsu-bg-hover) !important;
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .main-content a:not(.nav-link):not(.dropdown-item).dashed,
html.${ROOT_CLASS} .main-content a.dashed {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .main-content a.dashed:hover {
  color: var(--vvsu-blue-soft) !important;
  background: var(--vvsu-bg-hover) !important;
}

/* Таймлайн: белые плашки и светлый коннектор */
html.${ROOT_CLASS} .timeline-time span {
  background: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .timeline-item + .timeline-item .timeline-time:before {
  background: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .timeline .title {
  color: var(--vvsu-blue-soft) !important;
}

/* Иконки категорий ресурсов */
html.${ROOT_CLASS} .category-box .icon {
  background: var(--vvsu-bg-raised) !important;
  background-color: var(--vvsu-bg-raised) !important;
}

html.${ROOT_CLASS} .category-box .icon i {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .category-box.blocked:hover .icon {
  background-color: #a82828 !important;
}

html.${ROOT_CLASS} .category-box.blocked:hover .icon i {
  color: #fff !important;
}

/* Список людей: светлые разделители */
html.${ROOT_CLASS} .person-list .person {
  border-bottom-color: var(--vvsu-border) !important;
}

/* Подсветка .selected (сайт: #ffe38f) */
html.${ROOT_CLASS} .selected {
  background: #3a2e14 !important;
  color: #f0e0b0 !important;
}

/* Дерево / иконки узлов */
html.${ROOT_CLASS} .treeview .icon {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .treeview .node-selected .icon {
  color: #fff !important;
}

/* Мобильные таблицы: светлые бордеры из main.css */
html.${ROOT_CLASS} table:not(.ui-datepicker-calendar):not(.phones) tbody tr {
  border-color: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} table:not(.ui-datepicker-calendar):not(.phones) tbody tr td {
  border-bottom-color: var(--vvsu-border) !important;
}

/* Оверлеи загрузки */
html.${ROOT_CLASS} .overlay-element-gap,
html.${ROOT_CLASS} #modal {
  color: var(--vvsu-text);
}

/* Подстраховка: инлайновые белые фоны с страниц/JS */
html.${ROOT_CLASS} [style*="background-color:#fff"],
html.${ROOT_CLASS} [style*="background-color: #fff"],
html.${ROOT_CLASS} [style*="background-color:#ffffff"],
html.${ROOT_CLASS} [style*="background-color: #ffffff"],
html.${ROOT_CLASS} [style*="background-color:rgb(255, 255, 255)"],
html.${ROOT_CLASS} [style*="background-color: rgb(255, 255, 255)"],
html.${ROOT_CLASS} [style*="background:#fff"],
html.${ROOT_CLASS} [style*="background: #fff"],
html.${ROOT_CLASS} [style*="background:white"],
html.${ROOT_CLASS} [style*="background: white"] {
  background-color: var(--vvsu-bg-card) !important;
  background-image: none !important;
}

html.${ROOT_CLASS} [style*="color:#000"],
html.${ROOT_CLASS} [style*="color: #000"],
html.${ROOT_CLASS} [style*="color:#212529"],
html.${ROOT_CLASS} [style*="color: #212529"],
html.${ROOT_CLASS} [style*="color:#343a40"],
html.${ROOT_CLASS} [style*="color: #343a40"],
html.${ROOT_CLASS} [style*="color:rgb(33, 37, 41)"],
html.${ROOT_CLASS} [style*="color: rgb(33, 37, 41)"] {
  color: var(--vvsu-text) !important;
}

/* Скроллбар */
html.${ROOT_CLASS} {
  scrollbar-color: var(--vvsu-border) var(--vvsu-bg);
  scrollbar-width: thin;
}

html.${ROOT_CLASS} ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

html.${ROOT_CLASS} ::-webkit-scrollbar-track {
  background: var(--vvsu-bg);
}

html.${ROOT_CLASS} ::-webkit-scrollbar-thumb {
  background: var(--vvsu-border);
  border-radius: 5px;
}

@media (hover: hover) {
  html.${ROOT_CLASS} ::-webkit-scrollbar-thumb:hover {
    background: var(--vvsu-blue-mid);
  }
}

/* Логотип остаётся читаемым на тёмном фоне */
html.${ROOT_CLASS} .logo img {
  filter: brightness(1.15);
}

/* —— страница согласия (consent-student) —— */
html.${ROOT_CLASS} .consent-lead {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .consent-fact {
  background: var(--vvsu-bg-raised) !important;
  border-color: var(--vvsu-border) !important;
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .consent-fact__icon {
  background: #0f2a4a !important;
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .consent-fact__title {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .consent-fact__text {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} .consent-timer__track {
  stroke: var(--vvsu-border) !important;
}

html.${ROOT_CLASS} .consent-timer__progress {
  stroke: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .consent-timer__value {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .consent-timer__caption,
html.${ROOT_CLASS} .consent-timer__caption strong {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .main-content a.consent-cta,
html.${ROOT_CLASS} .main-content a.consent-cta:hover,
html.${ROOT_CLASS} .main-content a.consent-cta:focus {
  color: #fff !important;
  background-image: none !important;
  border-bottom: none !important;
}

/* BVI / accessibility — не ломаем их панель */
html.${ROOT_CLASS} .bvi-panel,
html.${ROOT_CLASS} .bvi-panel * {
  color-scheme: light;
}

/* —— OpenID / fort.vvsu.ru (страница входа) —— */
html.${ROOT_CLASS} .background.screen {
  background-color: var(--vvsu-bg) !important;
  background-image:
    linear-gradient(180deg, rgba(8, 14, 24, 0.82), rgba(8, 14, 24, 0.88)),
    url("/openid/vvsu_bg2.jpg") !important;
  background-size: cover !important;
  background-position: center !important;
}

html.${ROOT_CLASS} .screen .body {
  background: var(--vvsu-bg-card) !important;
  color: var(--vvsu-text) !important;
  box-shadow: 0 12px 40px var(--vvsu-shadow) !important;
  border: 1px solid var(--vvsu-border);
}

/* BS5 floating-label псевдофон и серый скроллбар .body */
html.${ROOT_CLASS} .form-floating > .form-control:not(:placeholder-shown) ~ label:after,
html.${ROOT_CLASS} .form-floating > .form-control-plaintext:not(:placeholder-shown) ~ label:after {
  background-color: var(--vvsu-bg-card) !important;
}

html.${ROOT_CLASS} .body::-webkit-scrollbar-thumb {
  background: var(--vvsu-border) !important;
  background-image: none !important;
}

html.${ROOT_CLASS} .small-title,
html.${ROOT_CLASS} .small-title a {
  color: var(--vvsu-blue-soft) !important;
}

/* .hr-title: центральный блок обычно с белым фоном поверх <hr> */
html.${ROOT_CLASS} .hr-title,
html.${ROOT_CLASS} .hr-title > div {
  color: var(--vvsu-blue-soft) !important;
  background: var(--vvsu-bg-card) !important;
  background-color: var(--vvsu-bg-card) !important;
}

html.${ROOT_CLASS} .hr-title hr {
  border-color: var(--vvsu-border) !important;
  background-color: var(--vvsu-border) !important;
  opacity: 1;
}

html.${ROOT_CLASS} #form-login label,
html.${ROOT_CLASS} #label-for-login,
html.${ROOT_CLASS} #label-for-password,
html.${ROOT_CLASS} #label-for-remember {
  color: var(--vvsu-text) !important;
}

html.${ROOT_CLASS} #form-login a,
html.${ROOT_CLASS} main a {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} #form-login a:hover,
html.${ROOT_CLASS} main a:hover {
  color: #9fd0ff !important;
}

html.${ROOT_CLASS} .body-footer,
html.${ROOT_CLASS} .body-footer-copyright,
html.${ROOT_CLASS} .scookie,
html.${ROOT_CLASS} .tech-support,
html.${ROOT_CLASS} .tech-support span {
  color: var(--vvsu-text-muted) !important;
}

html.${ROOT_CLASS} .body-footer a,
html.${ROOT_CLASS} .scookie a,
html.${ROOT_CLASS} .tech-support a {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .body-footer-socials,
html.${ROOT_CLASS} .body-footer-socials a,
html.${ROOT_CLASS} .body-footer-socials-mobile a {
  color: var(--vvsu-blue-soft) !important;
}

html.${ROOT_CLASS} .body-footer-socials-mobile .btn-primary {
  background-color: var(--vvsu-blue) !important;
  border-color: var(--vvsu-blue) !important;
  color: #fff !important;
}

html.${ROOT_CLASS} .btn-outline-primary.bvi-open,
html.${ROOT_CLASS} button.bvi-open {
  color: var(--vvsu-blue-soft) !important;
  border-color: var(--vvsu-blue-soft) !important;
  background: transparent !important;
}

@media (hover: hover) {
  html.${ROOT_CLASS} .btn-outline-primary.bvi-open:hover,
  html.${ROOT_CLASS} button.bvi-open:hover {
    background-color: var(--vvsu-blue) !important;
    border-color: var(--vvsu-blue) !important;
    color: #fff !important;
  }
}

/* Кнопка темы на странице входа — рядом с BVI outline */
.${BTN_CLASS}.${BTN_CLASS}--openid {
  min-width: 2.5rem;
  width: auto;
  height: auto;
  max-height: none;
  margin-right: 0.5rem;
  padding: 0.5rem 0.65rem !important;
  border: 1px solid #0a56a4;
  color: #0a56a4;
  background: transparent;
}

html.${ROOT_CLASS} .${BTN_CLASS}.${BTN_CLASS}--openid {
  border-color: var(--vvsu-blue-soft) !important;
  color: var(--vvsu-blue-soft) !important;
}
`,
    STYLE_ID,
  );
}

function resolveToggleClass(anchor: Element): string {
  // На странице входа BVI — outline-кнопка; в кабинете — .btn-top-nav
  const openidChrome =
    anchor.matches("button.bvi-open, .btn-outline-primary") ||
    detectHost() === "openid";

  return openidChrome
    ? `btn btn-outline-primary py-2 ${BTN_CLASS} ${BTN_CLASS}--openid`
    : `btn btn-top-nav ${BTN_CLASS}`;
}

function applyThemeState(dark: boolean, btn?: HTMLButtonElement | null): void {
  setDark(dark);
  if (btn) syncButton(btn, dark);
  if (dark) startNoticeDarkScrub();
  else clearNoticeDarkSurfaces();
}

function mountToggle(anchor: Element): HTMLButtonElement {
  const host =
    anchor.closest(".service") ??
    anchor.parentElement ??
    anchor;

  const existing = host.querySelector<HTMLButtonElement>(`.${BTN_CLASS}`);
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = resolveToggleClass(anchor);

  const dark = document.documentElement.classList.contains(ROOT_CLASS);
  syncButton(btn, dark);

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !document.documentElement.classList.contains(ROOT_CLASS);
    writeDark(next);
    applyThemeState(next, btn);
  });

  // Перед глазиком BVI («для людей с ограничениями»)
  host.insertBefore(btn, anchor);
  return btn;
}

export const darkTheme: Feature = {
  id: "dark-theme",
  name: "Тёмная тема ВВГУ",
  hosts: ["cabinet", "openid"],
  async run() {
    if (!isFeatureEnabled("dark-theme")) return;

    // Сразу, до ожидания DOM — без вспышки светлой темы
    const initial = readDark();
    if (initial) setDark(true);

    injectDarkThemeStyles();
    if (initial) startNoticeDarkScrub();

    const bvi = await waitForElement<HTMLElement>(
      [
        "a.bvi-open",
        "button.bvi-open",
        ".bvi-open",
        ".header .btn-top-nav.bvi-open",
        ".header .service",
      ].join(", "),
    );
    if (!bvi) {
      console.warn("[vvsu-tweaks] dark-theme: header / bvi button not found");
      return;
    }

    const anchor =
      bvi.matches("a.bvi-open, button.bvi-open, .bvi-open")
        ? bvi
        : bvi.querySelector("a.bvi-open, button.bvi-open, .bvi-open") ?? bvi;

    const btn = mountToggle(anchor);

    // Синхронизация между вкладками (localStorage)
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || event.newValue == null) return;
      applyThemeState(event.newValue === "1", btn);
    });

    // Пока нет ручного выбора — следим за системной темой
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        if (storageGet(STORAGE_KEY) !== null) return;
        applyThemeState(event.matches, btn);
      });

    console.info("[vvsu-tweaks] dark-theme: mounted");
  },
};
