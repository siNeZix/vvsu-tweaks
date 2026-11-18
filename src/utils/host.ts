export type VvsuHost =
  | "portal"
  | "cabinet"
  | "openid"
  | "www"
  | "portfolio"
  | "other";

function isLocalPreviewHost(hostname = location.hostname): boolean {
  return (
    import.meta.env.DEV &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local"))
  );
}

/** Определить сервис ВВГУ по hostname. */
export function detectHost(hostname = location.hostname): VvsuHost {
  // Локальный preview (index.html) ведём как cabinet — там лежит аватар.
  if (isLocalPreviewHost(hostname)) return "cabinet";
  if (hostname === "portal.vvsu.ru") return "portal";
  if (hostname === "cabinet.vvsu.ru") return "cabinet";
  if (hostname === "fort.vvsu.ru") return "openid";
  if (hostname === "www.vvsu.ru" || hostname === "vvsu.ru") return "www";
  if (hostname === "portfolio.vvsu.ru") return "portfolio";
  return "other";
}

/** Реальный домен ВВГУ, без dev-preview. */
export function isVvsuDomain(hostname = location.hostname): boolean {
  return hostname === "vvsu.ru" || hostname.endsWith(".vvsu.ru");
}

export function isVvsuHost(hostname = location.hostname): boolean {
  return isLocalPreviewHost(hostname) || isVvsuDomain(hostname);
}
