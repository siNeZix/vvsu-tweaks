import { describe, expect, it, vi } from "vitest";
import { forceRemember } from "./force-remember";
import { useCleanDom } from "@/test/helpers";

useCleanDom();

describe("forceRemember", () => {
  it("держит #remember отмеченным и возвращает после снятия", async () => {
    document.body.innerHTML = `<input type="checkbox" id="remember" />`;

    forceRemember.run();
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLInputElement>("#remember")?.checked).toBe(true);
    });

    const input = document.querySelector<HTMLInputElement>("#remember")!;
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(input.checked).toBe(true);

    input.click();
    await Promise.resolve();
    expect(input.checked).toBe(true);
  });

  it("не запускается при выключенной настройке", async () => {
    localStorage.setItem(
      "vvsu-tweaks.settings",
      JSON.stringify({ "force-remember": false }),
    );
    document.body.innerHTML = `<input type="checkbox" id="remember" />`;

    forceRemember.run();
    await Promise.resolve();
    expect(document.querySelector<HTMLInputElement>("#remember")?.checked).toBe(false);
  });
});
