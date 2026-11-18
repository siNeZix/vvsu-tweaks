/**
 * Таймеры скрипта. consent-skip массово гасит таймеры страницы —
 * свои он обязан пропускать, иначе зависнут waitForElement и observer'ы.
 */

const own = new Set<number>();

export function setOwnTimeout(callback: () => void, delayMs: number): number {
  const id = window.setTimeout(() => {
    own.delete(id);
    callback();
  }, delayMs);
  own.add(id);
  return id;
}

export function clearOwnTimeout(id: number): void {
  own.delete(id);
  window.clearTimeout(id);
}

export function ownTimerIds(): ReadonlySet<number> {
  return own;
}
