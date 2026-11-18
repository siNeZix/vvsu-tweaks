import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRedirectGuard, registerRedirect } from "./redirect-guard";

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("redirect-guard", () => {
  it("разрешает hop'ы пока не превышен лимит", () => {
    expect(registerRedirect("/a", "/b", { maxHops: 3 }).allowed).toBe(true);
    expect(registerRedirect("/b", "/c", { maxHops: 3 }).allowed).toBe(true);
    expect(registerRedirect("/c", "/a", { maxHops: 3 }).allowed).toBe(true);
    const blocked = registerRedirect("/a", "/b", { maxHops: 3 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.hops).toBe(4);
  });

  it("скользящее окно: старые hop'ы выпадают, новые остаются", () => {
    registerRedirect("/a", "/b", { maxHops: 3, windowMs: 10_000 });
    vi.advanceTimersByTime(4000);
    registerRedirect("/b", "/c", { maxHops: 3, windowMs: 10_000 });
    vi.advanceTimersByTime(4000);
    registerRedirect("/c", "/d", { maxHops: 3, windowMs: 10_000 });

    // через 3с после третьего: первому hop'у 11с → выпал, hops=3 (2 старых + новый)
    vi.advanceTimersByTime(3001);
    const next = registerRedirect("/d", "/e", { maxHops: 3, windowMs: 10_000 });
    expect(next.allowed).toBe(true);
    expect(next.hops).toBe(3);

    // ещё один сразу — блок
    expect(registerRedirect("/e", "/f", { maxHops: 3, windowMs: 10_000 }).allowed).toBe(
      false,
    );
  });

  it("полный сброс окна, если все hop'ы устарели", () => {
    registerRedirect("/a", "/b", { maxHops: 2, windowMs: 1000 });
    registerRedirect("/b", "/c", { maxHops: 2, windowMs: 1000 });

    vi.advanceTimersByTime(1001);
    const next = registerRedirect("/c", "/d", { maxHops: 2, windowMs: 1000 });
    expect(next.allowed).toBe(true);
    expect(next.hops).toBe(1);
  });

  it("петля с паузами ~5с ловится (раньше fixed-window пропускал)", () => {
    const opts = { maxHops: 3, windowMs: 60_000 };
    expect(registerRedirect("/consent", "/", opts).allowed).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(registerRedirect("/consent", "/", opts).allowed).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(registerRedirect("/consent", "/", opts).allowed).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(registerRedirect("/consent", "/", opts).allowed).toBe(false);
  });

  it("изолирует scope", () => {
    registerRedirect("/a", "/b", { scope: "consent", maxHops: 1 });
    expect(registerRedirect("/b", "/c", { scope: "consent", maxHops: 1 }).allowed).toBe(
      false,
    );
    expect(registerRedirect("/x", "/y", { scope: "auth", maxHops: 1 }).allowed).toBe(
      true,
    );
  });

  it("clearRedirectGuard снимает счётчик своего scope", () => {
    registerRedirect("/a", "/b", { scope: "consent", maxHops: 1 });
    clearRedirectGuard("consent");
    expect(registerRedirect("/a", "/b", { scope: "consent", maxHops: 1 }).hops).toBe(1);
  });

  it("игнорирует битый JSON в sessionStorage", () => {
    sessionStorage.setItem("vvsu-tweaks.redirect-guard", "{not-json");
    expect(registerRedirect("/a", "/b").hops).toBe(1);
  });

  it("мигрирует legacy { startedAt, hops }", () => {
    sessionStorage.setItem(
      "vvsu-tweaks.redirect-guard",
      JSON.stringify({ startedAt: Date.now(), hops: 2, lastFrom: "/a", lastTo: "/b" }),
    );
    const next = registerRedirect("/b", "/c", { maxHops: 3 });
    expect(next.hops).toBe(3);
    expect(next.allowed).toBe(true);
  });
});
