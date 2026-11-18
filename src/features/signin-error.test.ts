import { describe, expect, it, vi } from "vitest";
import { friendlyError, isSigninErrorLoop, signinError } from "./signin-error";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

describe("friendlyError", () => {
  it("объясняет reused consent verifier", () => {
    const info = friendlyError(
      "access_denied",
      "The consent verifier has already been used.",
    );
    expect(info.title).toContain("уже использована");
  });

  it("мапит известные коды", () => {
    expect(friendlyError("access_denied", "").title).toBe("Вход отклонён");
    expect(friendlyError("login_required", "").title).toBe("Нужно войти заново");
    expect(friendlyError("interaction_required", "").title).toBe("Нужно войти заново");
    expect(friendlyError("server_error", "").title).toBe("Не удалось войти");
    expect(friendlyError("", "raw").code).toBe("unknown");
  });

  it("не пропускает произвольный текст из URL в код ошибки", () => {
    const info = friendlyError("Аккаунт заблокирован, звоните +7 900 000-00-00", "");
    expect(info.code).toBe("unknown");
    expect(friendlyError("<img src=x>", "").code).toBe("unknown");
    expect(friendlyError("a".repeat(65), "").code).toBe("unknown");
  });
});

describe("signinError feature", () => {
  it("рисует оверлей для error в query, CTA на /", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/sign-in/",
      search: "?error=access_denied&error_description=denied",
      href: "https://cabinet.vvsu.ru/sign-in/?error=access_denied&error_description=denied",
    });

    signinError.run();

    const overlay = document.getElementById("vvsu-tweaks-signin-error");
    expect(overlay).toBeTruthy();
    expect(overlay?.textContent).toContain("Вход отклонён");
    expect(overlay?.querySelector(".vvsu-se-btn")?.getAttribute("href")).toBe(
      "https://cabinet.vvsu.ru/",
    );
    expect(overlay?.querySelector(".vvsu-se-btn")?.textContent).toMatch(/кабинет/i);
    expect(document.documentElement.classList.contains("vvsu-tweaks-signin-error-active")).toBe(
      true,
    );
    expect(isSigninErrorLoop()).toBe(true);

    restore();
  });

  it("не запускается вне /sign-in/", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/student/",
      search: "?error=access_denied",
      href: "https://cabinet.vvsu.ru/student/?error=access_denied",
    });

    signinError.run();
    expect(document.getElementById("vvsu-tweaks-signin-error")).toBeNull();
    restore();
  });

  it("кнопка «Открыть кабинет» идёт на / и не сбрасывает consent guards", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/sign-in/",
      search: "?error=access_denied",
      href: "https://cabinet.vvsu.ru/sign-in/?error=access_denied",
    });

    const replace = vi.fn();
    Object.defineProperty(window.location, "replace", {
      configurable: true,
      value: replace,
    });

    sessionStorage.setItem(
      "vvsu-tweaks.consent-skip.auto-used",
      String(Date.now() + 60_000),
    );
    sessionStorage.setItem("vvsu-tweaks.consent-skip.cooldown", "1");
    signinError.run();

    document.querySelector<HTMLAnchorElement>(".vvsu-se-btn")?.click();
    expect(replace).toHaveBeenCalledWith("https://cabinet.vvsu.ru/");
    expect(sessionStorage.getItem("vvsu-tweaks.consent-skip.auto-used")).not.toBeNull();
    expect(sessionStorage.getItem("vvsu-tweaks.consent-skip.cooldown")).toBe("1");

    restore();
  });

  it("повторная ошибка показывает петлю", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/sign-in/",
      search: "?error=access_denied",
      href: "https://cabinet.vvsu.ru/sign-in/?error=access_denied",
    });

    sessionStorage.setItem(
      "vvsu-tweaks.signin-error.seen",
      String(Date.now() + 60_000),
    );
    // BOUND ещё не стоит — первый run в этом DOM
    signinError.run();

    expect(document.getElementById("vvsu-tweaks-signin-error")?.textContent).toContain(
      "Петля входа",
    );
    expect(document.querySelector(".vvsu-se-btn")?.textContent).toMatch(/кабинет/i);

    restore();
  });

  it("CTA на / не уводит на чужой домен", () => {
    const href = "https://cabinet.vvsu.ru//evil.example/sign-in/?error=access_denied";
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "//evil.example/sign-in/",
      search: "?error=access_denied",
      href,
    });

    signinError.run();

    const retry = document.querySelector(".vvsu-se-btn")?.getAttribute("href") ?? "";
    expect(new URL(retry).origin).toBe("https://cabinet.vvsu.ru");
    expect(new URL(retry).pathname).toBe("/");
    restore();
  });

  it("распознаёт PHP-дамп OpenIDConnectClientException", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/sign-in/",
      search: "",
      href: "https://cabinet.vvsu.ru/sign-in/",
    });

    // Пробел/кавычка важны: /Error:\s*([a-z0-9_]+)/i с флагом i иначе склеит Description
    document.body.textContent = [
      "object(Jumbojett\\OpenIDConnectClientException)#1 (7) {",
      'Error: access_denied Description: The consent verifier has already been used."',
      "}",
    ].join("\n");

    signinError.run();

    expect(document.getElementById("vvsu-tweaks-signin-error")?.textContent).toContain(
      "уже использована",
    );
    restore();
  });
});
