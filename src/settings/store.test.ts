import { describe, expect, it, vi } from "vitest";
import {
  SETTING_KEYS,
  getSettings,
  getSettingsByGroup,
  isFeatureEnabled,
  isToggleableFeature,
  setFeatureEnabled,
} from "./store";
import { mockLocation, useCleanDom } from "@/test/helpers";

useCleanDom();

describe("settings store", () => {
  it("по умолчанию все фичи включены", () => {
    const settings = getSettings();
    for (const key of SETTING_KEYS) {
      expect(settings[key]).toBe(true);
      expect(isFeatureEnabled(key)).toBe(true);
    }
  });

  it("читает сохранённые флаги и игнорирует мусор", () => {
    localStorage.setItem(
      "vvsu-tweaks.settings",
      JSON.stringify({
        "dark-theme": false,
        "hide-max": false,
        unknown: true,
        "avatar-blur": "yes",
      }),
    );

    const settings = getSettings();
    expect(settings["dark-theme"]).toBe(false);
    expect(settings["hide-max"]).toBe(false);
    expect(settings["avatar-blur"]).toBe(true);
  });

  it("при битом JSON возвращает defaults", () => {
    localStorage.setItem("vvsu-tweaks.settings", "{broken");
    expect(getSettings()["consent-skip"]).toBe(true);
  });

  it("setFeatureEnabled сохраняет и вызывает reload", () => {
    const restore = mockLocation({
      hostname: "localhost",
      protocol: "http:",
      origin: "http://localhost",
    });
    const reload = vi.fn();
    Object.defineProperty(window.location, "reload", {
      configurable: true,
      value: reload,
    });

    setFeatureEnabled("hide-bvi", false);

    expect(JSON.parse(localStorage.getItem("vvsu-tweaks.settings")!)["hide-bvi"]).toBe(
      false,
    );
    expect(reload).toHaveBeenCalledOnce();
    restore();
  });

  it("isToggleableFeature и группы", () => {
    expect(isToggleableFeature("dark-theme")).toBe(true);
    expect(isToggleableFeature("nope")).toBe(false);

    const groups = getSettingsByGroup();
    expect(groups.map((g) => g.id)).toEqual(["interface", "privacy", "automation"]);
    expect(groups.find((g) => g.id === "privacy")?.keys).toEqual(["avatar-blur"]);
  });
});
