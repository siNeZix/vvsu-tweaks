/**
 * Счётчик быстрых редиректов в sessionStorage.
 * Скользящее окно: hop'ы старше windowMs выпадают, новые добавляются.
 * Ловит зацикливания (consent ↔ error, middleware ↔ skip и т.п.).
 */

const STORAGE_KEY = "vvsu-tweaks.redirect-guard";
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_HOPS = 3;

export type RedirectGuardOptions = {
  /** Окно в мс, в котором считаются hop'ы (скользящее). */
  windowMs?: number;
  /** Сколько hop'ов допускаем в окне (включая текущий). */
  maxHops?: number;
  /** Изолированный ключ для отдельного контура (consent, auth, …). */
  scope?: string;
};

type GuardState = {
  /** Отметки времени hop'ов внутри окна. */
  times: number[];
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
    const parsed = JSON.parse(raw) as Partial<GuardState> & {
      /** legacy fixed-window format */
      startedAt?: number;
      hops?: number;
    };

    if (Array.isArray(parsed.times)) {
      const times = parsed.times.filter(
        (t): t is number => typeof t === "number" && Number.isFinite(t),
      );
      return {
        times,
        lastFrom: typeof parsed.lastFrom === "string" ? parsed.lastFrom : "",
        lastTo: typeof parsed.lastTo === "string" ? parsed.lastTo : "",
      };
    }

    // Миграция со старого формата { startedAt, hops }
    if (
      typeof parsed.startedAt === "number" &&
      typeof parsed.hops === "number" &&
      parsed.hops > 0
    ) {
      const times = Array.from({ length: Math.min(parsed.hops, 32) }, () => parsed.startedAt!);
      return {
        times,
        lastFrom: typeof parsed.lastFrom === "string" ? parsed.lastFrom : "",
        lastTo: typeof parsed.lastTo === "string" ? parsed.lastTo : "",
      };
    }

    return null;
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

/** Сбросить счётчик (после удачного входа и т.п.). */
export function clearRedirectGuard(scope?: string): void {
  try {
    sessionStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}

/**
 * Зафиксировать намерение сделать location-редирект.
 * Если hop'ов слишком много за скользящее окно — `allowed: false`.
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

  const prev = readState(key);
  const times = (prev?.times ?? []).filter((t) => now - t <= windowMs);
  times.push(now);

  const state: GuardState = {
    times,
    lastFrom: from,
    lastTo: to,
  };
  writeState(key, state);

  const hops = times.length;
  const allowed = hops <= maxHops;
  if (!allowed) {
    console.warn(
      `[vvsu-tweaks] redirect-guard: loop detected (${hops}/${maxHops})`,
      { from, to, scope: options.scope ?? "default" },
    );
  }

  return { allowed, hops, maxHops };
}
