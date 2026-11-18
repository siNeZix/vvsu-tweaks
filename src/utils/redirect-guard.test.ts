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

  it("сбрасывает окно по времени", () => {
    registerRedirect("/a", "/b", { maxHops: 2, windowMs: 1000 });
    registerRedirect("/b", "/c", { maxHops: 2, windowMs: 1000 });

    vi.advanceTimersByTime(1001);
    const next = registerRedirect("/c", "/d", { maxHops: 2, windowMs: 1000 });
    expect(next.allowed).toBe(true);
    expect(next.hops).toBe(1);
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
});
