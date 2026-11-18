import { afterEach, beforeEach, vi } from "vitest";

/** Сбросить DOM и storage между тестами. */
export function resetDom(): void {
  const html = document.documentElement;
  for (const attr of [...html.attributes]) {
    html.removeAttribute(attr.name);
  }

  // Оверлеи consent/signin вешаются на <html>, не только в body
  for (const child of [...html.children]) {
    const tag = child.tagName.toLowerCase();
    if (tag !== "head" && tag !== "body") child.remove();
  }

  if (!document.head) html.prepend(document.createElement("head"));
  if (!document.body) html.append(document.createElement("body"));
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  for (const attr of [...document.body.attributes]) {
    document.body.removeAttribute(attr.name);
  }
  document.title = "";

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  // Чистим cookies happy-dom
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

type LocationPatch = {
  hostname?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  href?: string;
  origin?: string;
  protocol?: string;
};

/**
 * Подмена location.* для happy-dom.
 * Возвращает restore().
 */
export function mockLocation(patch: LocationPatch): () => void {
  const loc = window.location;
  const originals: Array<[string, PropertyDescriptor | undefined]> = [];

  const define = (key: string, value: string) => {
    originals.push([key, Object.getOwnPropertyDescriptor(loc, key)]);
    Object.defineProperty(loc, key, {
      configurable: true,
      enumerable: true,
      get: () => value,
    });
  };

  if (patch.hostname !== undefined) define("hostname", patch.hostname);
  if (patch.pathname !== undefined) define("pathname", patch.pathname);
  if (patch.search !== undefined) define("search", patch.search);
  if (patch.hash !== undefined) define("hash", patch.hash);
  if (patch.origin !== undefined) define("origin", patch.origin);
  if (patch.protocol !== undefined) define("protocol", patch.protocol);

  if (patch.href !== undefined) {
    define("href", patch.href);
  } else if (
    patch.origin !== undefined ||
    patch.pathname !== undefined ||
    patch.search !== undefined ||
    patch.hash !== undefined
  ) {
    const origin = patch.origin ?? loc.origin;
    const pathname = patch.pathname ?? loc.pathname;
    const search = patch.search ?? loc.search;
    const hash = patch.hash ?? loc.hash;
    define("href", `${origin}${pathname}${search}${hash}`);
  }

  return () => {
    for (const [key, desc] of originals.reverse()) {
      if (desc) Object.defineProperty(loc, key, desc);
      else Reflect.deleteProperty(loc, key);
    }
  };
}

/** Стандартный before/after для DOM-тестов. */
export function useCleanDom(): void {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDom();
  });
}
