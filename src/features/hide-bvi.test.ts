import { describe, expect, it } from "vitest";
import { hideBvi } from "./hide-bvi";
import { useCleanDom } from "@/test/helpers";

useCleanDom();

describe("hideBvi", () => {
  it("инжектит CSS скрытия BVI", () => {
    hideBvi.run();
    const style = document.getElementById("vvsu-tweaks-hide-bvi");
    expect(style?.textContent).toContain("a.bvi-open");
    expect(style?.textContent).toContain("display: none");
  });

  it("уважает выключенную настройку", () => {
    localStorage.setItem(
      "vvsu-tweaks.settings",
      JSON.stringify({ "hide-bvi": false }),
    );
    hideBvi.run();
    expect(document.getElementById("vvsu-tweaks-hide-bvi")).toBeNull();
  });
});
