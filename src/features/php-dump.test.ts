import { describe, expect, it, vi } from "vitest";
import { runFeatures } from "./index";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

/**
 * PHP-дамп на document-start: есть только <html>, без <head>/<body>.
 * Раньше падал document.head.append — скрипт не стартовал вовсе.
 */
describe("страница с PHP-дампом без head/body", () => {
  it("фичи стартуют без ошибок и показывают страницу ошибки входа", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/sign-in/",
      search: "",
      href: "https://cabinet.vvsu.ru/sign-in/",
      protocol: "https:",
    });

    const html = document.documentElement;
    document.head.remove();
    document.body.remove();
    html.append(
      'object(Jumbojett\\OpenIDConnectClientException)#2 (7) {\n' +
        'string(140) "Error: access_denied Description: The consent verifier has already been used."\n}',
    );

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => runFeatures()).not.toThrow();

    const overlay = document.getElementById("vvsu-tweaks-signin-error");
    expect(overlay?.parentElement).toBe(html);
    expect(overlay?.textContent).toContain("уже использована");
    expect(document.getElementById("vvsu-tweaks-signin-error-style")?.parentElement).toBe(html);
    expect(document.querySelectorAll("head, body")).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();

    restore();
  });
});
