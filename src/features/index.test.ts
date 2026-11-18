import { describe, expect, it, vi } from "vitest";
import { runFeatures } from "./index";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

describe("runFeatures", () => {
  it("на cabinet запускает синхронные фичи и не падает", () => {
    const restore = mockLocation({
      hostname: "cabinet.vvsu.ru",
      origin: "https://cabinet.vvsu.ru",
      pathname: "/",
      search: "",
      href: "https://cabinet.vvsu.ru/",
      protocol: "https:",
    });

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    runFeatures();

    expect(document.getElementById("vvsu-tweaks-hide-bvi")).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    restore();
  });

  it("на openid не ставит cabinet-only avatar-blur early style без аватара", () => {
    const restore = mockLocation({
      hostname: "fort.vvsu.ru",
      origin: "https://fort.vvsu.ru",
      pathname: "/sign-in/",
      search: "",
      href: "https://fort.vvsu.ru/sign-in/",
      protocol: "https:",
    });

    runFeatures();
    expect(document.getElementById("vvsu-tweaks-avatar-blur-early")).toBeNull();
    restore();
  });
});
