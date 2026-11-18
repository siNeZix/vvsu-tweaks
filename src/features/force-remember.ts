import type { Feature } from "./types";
import { waitForElement } from "@/utils/dom";
import { isFeatureEnabled } from "@/settings/store";

const SELECTOR = "#remember";
const BOUND = "data-vvsu-force-remember";

function ensureChecked(input: HTMLInputElement): void {
  if (input.checked) return;
  input.checked = true;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function bindRemember(input: HTMLInputElement): void {
  if (input.getAttribute(BOUND) === "1") {
    ensureChecked(input);
    return;
  }

  input.setAttribute(BOUND, "1");
  ensureChecked(input);

  input.addEventListener("change", () => ensureChecked(input));
  input.addEventListener("click", () => {
    // После клика браузер уже переключил checked — вернём обратно.
    queueMicrotask(() => ensureChecked(input));
  });
}

function scrubRemember(): void {
  const input = document.querySelector<HTMLInputElement>(SELECTOR);
  if (input) bindRemember(input);
}

async function startForceRemember(): Promise<void> {
  const found = await waitForElement<HTMLInputElement>(SELECTOR);
  if (!found) {
    console.warn("[vvsu-tweaks] force-remember: #remember not found");
    return;
  }

  scrubRemember();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scrubRemember();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  console.info("[vvsu-tweaks] force-remember: checkbox kept checked");
}

export const forceRemember: Feature = {
  id: "force-remember",
  name: "Всегда «Запомнить» на входе",
  hosts: ["openid"],
  run() {
    if (!isFeatureEnabled("force-remember")) return;
    void startForceRemember();
  },
};
