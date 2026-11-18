import type { Feature } from "./types";
import { injectStyle, waitForElement } from "@/utils/dom";
import { detectHost } from "@/utils/host";
import { isFeatureEnabled } from "@/settings/store";
import { storageGet, storageSet } from "@/utils/storage";

const STORAGE_KEY = "vvsu-tweaks.avatar-blur";
const STYLE_ID = "vvsu-tweaks-avatar-blur";
const EARLY_STYLE_ID = "vvsu-tweaks-avatar-blur-early";
const WRAP_CLASS = "vvsu-avatar-blur-wrap";
const CLIP_CLASS = "vvsu-avatar-blur-clip";
const BLURRED_CLASS = "is-blurred";
const READY_CLASS = "is-ready";

const BLUR_FILTER =
  "blur(28px) brightness(1.08) contrast(0.85) saturate(0.7)";

const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`;
const EYE_SLASH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2.1 3.51 3.51 2.1l18.39 18.39-1.41 1.41-3.13-3.13A11.7 11.7 0 0 1 12 19c-5 0-9.27-3.11-11-7a12.7 12.7 0 0 1 4.68-5.41L2.1 3.51zM12 7a5 5 0 0 1 4.9 6.1l-1.55-1.55A3 3 0 0 0 12 9a3 3 0 0 0-2.55 1.35L7.9 8.8A4.97 4.97 0 0 1 12 7zm11 5c-.55 1.23-1.4 2.4-2.5 3.4l-1.45-1.45c.7-.7 1.28-1.5 1.7-2.35C19.27 8.11 15.5 5 12 5c-.7 0-1.38.08-2.03.24L8.4 3.67C9.54 3.24 10.74 3 12 3c5 0 9.27 3.11 11 7z"/></svg>`;

function readBlurred(): boolean {
  return storageGet(STORAGE_KEY) === "1";
}

function writeBlurred(value: boolean): void {
  storageSet(STORAGE_KEY, value ? "1" : "0");
}

/**
 * Early blur до mount: clip-path держит растекание фильтра внутри круга.
 */
export function primeAvatarBlur(): void {
  if (detectHost() !== "cabinet") return;
  if (!isFeatureEnabled("avatar-blur")) return;
  if (!readBlurred()) return;

  injectStyle(
    `
.photosecond .avatar,
.avatar.rounded-circle {
  filter: ${BLUR_FILTER} !important;
  clip-path: circle(50% at 50% 50%);
}
`,
    EARLY_STYLE_ID,
  );
}

function clearEarlyBlur(): void {
  document.getElementById(EARLY_STYLE_ID)?.remove();
}

function injectAvatarBlurStyles(): void {
  injectStyle(
    `
.${WRAP_CLASS} {
  position: relative;
  display: inline-block;
  line-height: 0;
  flex-shrink: 0;
}

/* клип отдельно от кнопки: overflow режет blur ребёнка, кнопка не обрезается */
.${WRAP_CLASS} .${CLIP_CLASS} {
  display: block;
  overflow: hidden;
  border-radius: 50%;
  line-height: 0;
  isolation: isolate;
}

.${WRAP_CLASS} .avatar {
  margin-left: 0 !important;
  will-change: filter;
}

.${WRAP_CLASS}.${READY_CLASS} .avatar {
  transition: filter 0.2s ease, transform 0.2s ease;
}

.${WRAP_CLASS}.${BLURRED_CLASS} .avatar {
  filter: ${BLUR_FILTER};
  /* чуть увеличить внутри клипа — прячет мягкий край blur, не вылезая наружу */
  transform: scale(1.12);
}

.${WRAP_CLASS} .vvsu-avatar-blur-btn {
  position: absolute;
  right: 6%;
  bottom: 6%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #0a56a4;
  color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: background 0.15s ease, transform 0.15s ease;
}

/* Невидимое расширение hit-area без увеличения визуальной кнопки */
.${WRAP_CLASS} .vvsu-avatar-blur-btn::before {
  content: "";
  position: absolute;
  inset: -6px;
}

@media (hover: hover) {
  .${WRAP_CLASS} .vvsu-avatar-blur-btn:hover {
    background: #1460af;
  }
}

.${WRAP_CLASS} .vvsu-avatar-blur-btn:active {
  transform: scale(0.94);
}

.${WRAP_CLASS} .vvsu-avatar-blur-btn:focus-visible {
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

.${WRAP_CLASS} .vvsu-avatar-blur-btn svg {
  display: block;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .${WRAP_CLASS}.${READY_CLASS} .avatar,
  .${WRAP_CLASS} .vvsu-avatar-blur-btn {
    transition: none !important;
  }
}

@media (max-width: 767.98px) {
  .${WRAP_CLASS} .vvsu-avatar-blur-btn {
    width: 36px;
    height: 36px;
    right: 4%;
    bottom: 4%;
  }

  .${WRAP_CLASS} .vvsu-avatar-blur-btn::before {
    inset: -8px;
  }

  .${WRAP_CLASS} .vvsu-avatar-blur-btn svg {
    width: 18px;
    height: 18px;
  }

  /* На мобилке карточка column-reverse и центрирует аватар — ml-3 смещает */
  .photosecond .${WRAP_CLASS},
  .${WRAP_CLASS}.ml-3 {
    margin-left: 0 !important;
  }
}
`,
    STYLE_ID,
  );
}

function applyState(wrap: HTMLElement, btn: HTMLButtonElement, blurred: boolean): void {
  wrap.classList.toggle(BLURRED_CLASS, blurred);
  btn.setAttribute("aria-pressed", blurred ? "true" : "false");
  btn.title = blurred ? "Показать фото" : "Скрыть фото";
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = blurred ? EYE_OPEN : EYE_SLASH;
}

function mountBlurToggle(avatar: HTMLElement): void {
  if (avatar.closest(`.${WRAP_CLASS}`)) return;

  const hadMl3 = avatar.classList.contains("ml-3");
  const wrap = document.createElement("div");
  wrap.className = WRAP_CLASS;
  if (hadMl3) {
    wrap.classList.add("ml-3");
    avatar.classList.remove("ml-3");
  }

  const clip = document.createElement("div");
  clip.className = CLIP_CLASS;

  avatar.replaceWith(wrap);
  clip.appendChild(avatar);
  wrap.appendChild(clip);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vvsu-avatar-blur-btn";

  const blurred = readBlurred();
  applyState(wrap, btn, blurred);
  clearEarlyBlur();

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !wrap.classList.contains(BLURRED_CLASS);
    applyState(wrap, btn, next);
    writeBlurred(next);
  });

  wrap.appendChild(btn);

  requestAnimationFrame(() => {
    wrap.classList.add(READY_CLASS);
  });
}

export const avatarBlur: Feature = {
  id: "avatar-blur",
  name: "Скрытие фото профиля (blur)",
  hosts: ["cabinet"],
  async run() {
    if (!isFeatureEnabled("avatar-blur")) return;

    primeAvatarBlur();
    injectAvatarBlurStyles();

    const avatar = await waitForElement<HTMLElement>(
      ".photosecond .avatar.rounded-circle, .photosecond .avatar, .avatar.rounded-circle",
    );
    if (!avatar) {
      console.warn("[vvsu-tweaks] avatar-blur: avatar not found");
      return;
    }

    mountBlurToggle(avatar);
    console.info("[vvsu-tweaks] avatar-blur: mounted");
  },
};
