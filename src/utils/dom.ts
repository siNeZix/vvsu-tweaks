import { clearOwnTimeout, setOwnTimeout } from "@/utils/timers";

/** Дождаться появления элемента в DOM. */
export function waitForElement<T extends Element = Element>(
  selector: string,
  root: ParentNode = document,
  timeoutMs = 10_000,
): Promise<T | null> {
  const existing = root.querySelector<T>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const timer = setOwnTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const el = root.querySelector<T>(selector);
      if (!el) return;
      clearOwnTimeout(timer);
      observer.disconnect();
      resolve(el);
    });

    observer.observe(root instanceof Node ? root : document, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Куда вешать <style> и оверлеи. На document-start парсер ещё не создал
 * <head>/<body>; создавать их вручную нельзя — парсер добавит свои и в
 * документе окажется по два head/body. <html> к этому моменту уже есть.
 */
export function documentRoot(): HTMLElement {
  return document.head ?? document.documentElement;
}

/** Вставить CSS в страницу один раз (при том же id — обновить содержимое). */
export function injectStyle(css: string, id?: string): HTMLStyleElement {
  if (id) {
    const prev = document.getElementById(id);
    if (prev instanceof HTMLStyleElement) {
      prev.textContent = css;
      return prev;
    }
  }

  const style = document.createElement("style");
  if (id) style.id = id;
  style.textContent = css;
  documentRoot().appendChild(style);
  return style;
}
