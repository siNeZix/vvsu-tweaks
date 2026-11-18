import { describe, expect, it } from "vitest";
import { storageGet, storageSet } from "./storage";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

describe("storage", () => {
  it("пишет и читает через localStorage на localhost", () => {
    const restore = mockLocation({
      hostname: "localhost",
      protocol: "http:",
      origin: "http://localhost",
    });

    storageSet("theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(storageGet("theme")).toBe("dark");

    restore();
  });

  it("на *.vvsu.ru зеркалит значение в cookie", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      protocol: "https:",
      origin: "https://cabinet.vvsu.ru",
    });

    storageSet("flag", "1");
    expect(localStorage.getItem("flag")).toBe("1");
    expect(document.cookie).toContain("vvsu_tw_flag=");
    expect(storageGet("flag")).toBe("1");

    restore();
  });

  it("sanitizes ключ cookie", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      protocol: "https:",
      origin: "https://cabinet.vvsu.ru",
    });

    storageSet("a.b/c", "x");
    expect(document.cookie).toContain("vvsu_tw_a_b_c=");
    expect(storageGet("a.b/c")).toBe("x");

    restore();
  });

  it("подтягивает старое localStorage в cookie на vvsu", () => {
    const restore = mockLocation({
      hostname: "fort.vvsu.ru",
      protocol: "https:",
      origin: "https://fort.vvsu.ru",
    });

    localStorage.setItem("legacy", "yes");
    expect(storageGet("legacy")).toBe("yes");
    expect(document.cookie).toContain("vvsu_tw_legacy=");

    restore();
  });
});
