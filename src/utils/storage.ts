/**
 * Общее хранилище между *.vvsu.ru без GM_* (grant none).
 * Cookie с domain=.vvsu.ru шарится на cabinet/fort/…;
 * localStorage — зеркало и запасной вариант (localhost).
 */

import { isVvsuDomain } from "@/utils/host";

const COOKIE_DOMAIN = ".vvsu.ru";
const COOKIE_PREFIX = "vvsu_tw_";
const MAX_AGE_SEC = 60 * 60 * 24 * 365 * 2;

function cookieName(key: string): string {
  return COOKIE_PREFIX + key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function writeCookie(name: string, value: string): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    `max-age=${MAX_AGE_SEC}`,
    "SameSite=Lax",
  ];

  if (location.protocol === "https:") parts.push("Secure");
  if (isVvsuDomain()) parts.push(`domain=${COOKIE_DOMAIN}`);

  document.cookie = parts.join("; ");
}

export function storageGet(key: string): string | null {
  const name = cookieName(key);
  const fromCookie = readCookie(name);
  if (fromCookie !== null) return fromCookie;

  try {
    const fromLocal = localStorage.getItem(key);
    // Подтянуть старые значения в общий cookie
    if (fromLocal !== null && isVvsuDomain()) {
      writeCookie(name, fromLocal);
    }
    return fromLocal;
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  writeCookie(cookieName(key), value);

  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}
