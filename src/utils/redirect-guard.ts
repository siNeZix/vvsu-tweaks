/**
 * Счётчик быстрых редиректов в sessionStorage.
 * Ловит зацикливания (consent ↔ error, middleware ↔ skip и т.п.).
 */

const STORAGE_KEY = "vvsu-tweaks.redirect-guard";
const DEFAULT_WINDOW_MS = 12_000;
const DEFAULT_MAX_HOPS = 3;

export type RedirectGuardOptions = {
  /** Окно в мс, в котором считаются hop'ы. */
  windowMs?: number;
  /** Сколько hop'ов допускаем в окне (включая текущий). */
  maxHops?: number;
  /** Изолированный ключ для отдельного контура (consent, auth, …). */
  scope?: string;
};

type GuardState = {
  /** Начало текущего окна. */
  startedAt: number;
  hops: number;
  lastFrom: string;
  lastTo: string;
};

export type RedirectGuardResult = {
  allowed: boolean;
  hops: number;
  maxHops: number;
};

function storageKey(scope?: string): string {
  return scope ? `${STORAGE_KEY}:${scope}` : STORAGE_KEY;
}

function readState(key: string): GuardState | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuardState>;
    if (
      typeof parsed.startedAt !== "number" ||
      typeof parsed.hops !== "number"
    ) {
      return null;
    }
    return {
      startedAt: parsed.startedAt,
      hops: parsed.hops,
      lastFrom: typeof parsed.lastFrom === "string" ? parsed.lastFrom : "",
      lastTo: typeof parsed.lastTo === "string" ? parsed.lastTo : "",
    };
  } catch {
    return null;
  }
}

function writeState(key: string, state: GuardState): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

/** Сбросить счётчик (после ручного «войти снова», удачного входа и т.п.). */
export function clearRedirectGuard(scope?: string): void {
  try {
    sessionStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}

/**
 * Зафиксировать намерение сделать location-редирект.
 * Если hop'ов слишком много за короткое окно — `allowed: false`.
 */
export function registerRedirect(
  from: string,
  to: string,
  options: RedirectGuardOptions = {},
): RedirectGuardResult {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;
  const key = storageKey(options.scope);
  const now = Date.now();

  let state = readState(key);
  if (!state || now - state.startedAt > windowMs) {
    state = { startedAt: now, hops: 0, lastFrom: "", lastTo: "" };
  }

  state.hops += 1;
  state.lastFrom = from;
  state.lastTo = to;
  writeState(key, state);

  const allowed = state.hops <= maxHops;
  if (!allowed) {
    console.warn(
      `[vvsu-tweaks] redirect-guard: loop detected (${state.hops}/${maxHops})`,
      { from, to, scope: options.scope ?? "default" },
    );
  }

  return { allowed, hops: state.hops, maxHops };
}
