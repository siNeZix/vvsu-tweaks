import { describe, expect, it } from "vitest";
import {
  isUnsafeCallback,
  resetConsentSkipGuards,
  resolveRedirectPlan,
} from "./consent-skip";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

describe("isUnsafeCallback", () => {
  const origin = "https://cabinet.vvsu.ru";

  function withCabinetOrigin(run: () => void): void {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin,
      protocol: "https:",
      href: `${origin}/`,
    });
    try {
      run();
    } finally {
      restore();
    }
  }

  it("режет чужой origin и consent loop", () => {
    withCabinetOrigin(() => {
      expect(isUnsafeCallback(new URL("https://evil.example/cb", origin))).toBe(true);
      expect(
        isUnsafeCallback(new URL("https://cabinet.vvsu.ru/consent-student.html", origin)),
      ).toBe(true);
    });
  });

  it("режет error-параметры и access_denied", () => {
    withCabinetOrigin(() => {
      expect(
        isUnsafeCallback(
          new URL("https://cabinet.vvsu.ru/sign-in/?error=access_denied", origin),
        ),
      ).toBe(true);
      expect(
        isUnsafeCallback(
          new URL(
            "https://cabinet.vvsu.ru/sign-in/?error_description=consent+verifier",
            origin,
          ),
        ),
      ).toBe(true);
    });
  });

  it("пропускает чистый callback того же origin", () => {
    withCabinetOrigin(() => {
      expect(isUnsafeCallback(new URL("https://cabinet.vvsu.ru/", origin))).toBe(false);
      expect(
        isUnsafeCallback(new URL("https://cabinet.vvsu.ru/student/profile", origin)),
      ).toBe(false);
    });
  });
});

describe("resolveRedirectPlan", () => {
  it("без callback_url ведёт на /", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/consent-student.html",
      search: "",
      href: "https://cabinet.vvsu.ru/consent-student.html",
    });

    expect(resolveRedirectPlan()).toEqual({
      url: "https://cabinet.vvsu.ru/",
      fromCallback: false,
    });
    restore();
  });

  it("путь вида //host не превращается в протокол-относительный редирект", () => {
    const callback = "https://cabinet.vvsu.ru//evil.example/steal";
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/consent-student.html",
      search: `?callback_url=${encodeURIComponent(callback)}`,
      href: `https://cabinet.vvsu.ru/consent-student.html?callback_url=${encodeURIComponent(callback)}`,
    });

    const plan = resolveRedirectPlan();
    expect(new URL(plan.url).origin).toBe("https://cabinet.vvsu.ru");
    expect(plan.url.startsWith("//")).toBe(false);
    restore();
  });

  it("берёт безопасный callback_url", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/consent-student.html",
      search: "?callback_url=https%3A%2F%2Fcabinet.vvsu.ru%2Fstudent%2F",
      href: "https://cabinet.vvsu.ru/consent-student.html?callback_url=https%3A%2F%2Fcabinet.vvsu.ru%2Fstudent%2F",
    });

    expect(resolveRedirectPlan()).toEqual({
      url: "https://cabinet.vvsu.ru/student/",
      fromCallback: true,
    });
    restore();
  });

  it("подменяет unsafe callback на /sign-in/", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/consent-student.html",
      search:
        "?callback_url=https%3A%2F%2Fcabinet.vvsu.ru%2Fsign-in%2F%3Ferror%3Daccess_denied",
      href: "https://cabinet.vvsu.ru/consent-student.html?callback_url=https%3A%2F%2Fcabinet.vvsu.ru%2Fsign-in%2F%3Ferror%3Daccess_denied",
    });

    expect(resolveRedirectPlan()).toEqual({
      url: "https://cabinet.vvsu.ru/sign-in/",
      fromCallback: false,
    });
    restore();
  });

  it("парсит неэнкодированный callback_url с вложенными &", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/consent-student.html",
      search: "?callback_url=https://cabinet.vvsu.ru/app?x=1&y=2",
      href: "https://cabinet.vvsu.ru/consent-student.html?callback_url=https://cabinet.vvsu.ru/app?x=1&y=2",
    });

    expect(resolveRedirectPlan()).toEqual({
      url: "https://cabinet.vvsu.ru/app?x=1&y=2",
      fromCallback: true,
    });
    restore();
  });
});

describe("resetConsentSkipGuards", () => {
  it("чистит cooldown и redirect-guard scope", () => {
    sessionStorage.setItem("vvsu-tweaks.consent-skip.cooldown", String(Date.now() + 99999));
    sessionStorage.setItem(
      "vvsu-tweaks.redirect-guard:consent-skip",
      JSON.stringify({ startedAt: Date.now(), hops: 9, lastFrom: "", lastTo: "" }),
    );

    resetConsentSkipGuards();

    expect(sessionStorage.getItem("vvsu-tweaks.consent-skip.cooldown")).toBeNull();
    expect(sessionStorage.getItem("vvsu-tweaks.redirect-guard:consent-skip")).toBeNull();
  });
});
