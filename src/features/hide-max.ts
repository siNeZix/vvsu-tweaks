import type { Feature } from "./types";
import { injectStyle } from "@/utils/dom";
import { isFeatureEnabled } from "@/settings/store";

const STYLE_ID = "vvsu-tweaks-hide-max";
const MARK = "data-vvsu-hide-max";

const MAX_DOMAIN = "max.ru";
/**
 * Название мессенджера отдельным словом (латиница или кириллица «МАХ»/«Макс»).
 * \b в JS не знает кириллицу — границы слова через \p{L}\p{N}.
 */
const MAX_TEXT = /(?<![\p{L}\p{N}])(?:max|мах|макс)(?![\p{L}\p{N}.])/iu;

function closestFieldRow(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>(".row.mb-2");
}

function inMessage(el: Element): boolean {
  return Boolean(el.closest(".message-block, .message"));
}

/** @internal exported for unit tests */
export function isMaxHref(href: string): boolean {
  try {
    const { hostname } = new URL(href, location.href);
    return hostname === MAX_DOMAIN || hostname.endsWith(`.${MAX_DOMAIN}`);
  } catch {
    return false;
  }
}

/** @internal exported for unit tests */
export function mentionsMax(text: string): boolean {
  return MAX_TEXT.test(text);
}

function isMaxLink(anchor: HTMLAnchorElement): boolean {
  if (isMaxHref(anchor.getAttribute("href") ?? "")) return true;
  return mentionsMax(anchor.getAttribute("aria-label") ?? "");
}

function rowLooksLikeMaxField(row: HTMLElement): boolean {
  if (row.querySelector("#social-max")) return true;
  for (const anchor of row.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (isMaxHref(anchor.getAttribute("href") ?? "")) return true;
  }

  for (const label of row.querySelectorAll("label")) {
    if (mentionsMax(label.textContent ?? "")) return true;
  }

  return false;
}

function removeNode(el: Element): void {
  if (el.hasAttribute(MARK)) return;
  el.setAttribute(MARK, "1");
  el.remove();
}

function scrubMax(): void {
  for (const svg of document.querySelectorAll("#social-max")) {
    if (inMessage(svg)) continue;

    const row = closestFieldRow(svg);
    if (row && rowLooksLikeMaxField(row)) {
      removeNode(row);
      continue;
    }
    removeNode(svg);
  }

  for (const label of document.querySelectorAll("label")) {
    if (inMessage(label)) continue;
    if (!mentionsMax(label.textContent ?? "")) continue;
    const row = closestFieldRow(label);
    if (row) removeNode(row);
  }

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    // Ссылки в тексте оповещений не трогаем
    if (inMessage(anchor) || !isMaxLink(anchor)) continue;

    const row = closestFieldRow(anchor);
    if (row && rowLooksLikeMaxField(row)) {
      removeNode(row);
      continue;
    }

    removeNode(anchor);
  }
}

function startHideMax(): void {
  injectStyle(
    `
/* До первого скраба, без мигания. Вне сообщений — прячем; в тексте оповещений .message* — не трогаем. */
:is(
  a[href="https://max.ru" i],
  a[href="http://max.ru" i],
  a[href^="https://max.ru/" i],
  a[href^="http://max.ru/" i],
  a[href*=".max.ru/" i]
):not(.message a, .message-block a),
#social-max {
  display: none !important;
}
`,
    STYLE_ID,
  );

  let scheduled = false;
  const scheduleScrub = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scrubMax();
    });
  };

  scrubMax();

  const observer = new MutationObserver(scheduleScrub);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  console.info("[vvsu-tweaks] hide-max: hidden outside messages");
}

export const hideMax: Feature = {
  id: "hide-max",
  name: "Скрыть мессенджер Max",
  run() {
    if (!isFeatureEnabled("hide-max")) return;
    startHideMax();
  },
};
