import { describe, expect, it } from "vitest";
import { hideMax, isMaxHref, mentionsMax } from "./hide-max";
import { useCleanDom } from "@/test/helpers";

useCleanDom();

describe("isMaxHref", () => {
  it("узнаёт max.ru и поддомены", () => {
    expect(isMaxHref("https://max.ru/vvsu_dv")).toBe(true);
    expect(isMaxHref("https://max.ru/join/abc")).toBe(true);
    expect(isMaxHref("https://web.max.ru/")).toBe(true);
  });

  it("не путает с похожими доменами и query", () => {
    expect(isMaxHref("https://imax.ru/")).toBe(false);
    expect(isMaxHref("https://3dsmax.ru/")).toBe(false);
    expect(isMaxHref("https://vvsu.ru/?ref=max.ru")).toBe(false);
    expect(isMaxHref("https://max.ru.evil.example/")).toBe(false);
  });
});

describe("mentionsMax", () => {
  it("находит название мессенджера отдельным словом", () => {
    expect(mentionsMax("Чат группы в МАХ:")).toBe(true);
    expect(mentionsMax("Max")).toBe(true);
    expect(mentionsMax("Мессенджер Макс")).toBe(true);
  });

  it("не трогает обычные слова и сокращения", () => {
    expect(mentionsMax("Максимальный балл")).toBe(false);
    expect(mentionsMax("Макс. нагрузка")).toBe(false);
    expect(mentionsMax("Максимов И. И.")).toBe(false);
    expect(mentionsMax("Размах крыла")).toBe(false);
    expect(mentionsMax("Maximum")).toBe(false);
  });
});

describe("hideMax", () => {
  it("удаляет поле Max вне сообщений и не трогает ссылки в оповещениях", () => {
    document.body.innerHTML = `
      <div class="row mb-2">
        <label>Max</label>
        <svg id="social-max"></svg>
        <a href="https://max.ru/invite">Max</a>
      </div>
      <div class="message-block">
        <a href="https://max.ru/chat" aria-label="Max">открыть</a>
      </div>
      <a id="outside" href="https://max.ru/x">вне</a>
    `;

    hideMax.run();

    expect(document.querySelector(".row.mb-2")).toBeNull();
    expect(document.getElementById("outside")).toBeNull();

    const inMessage = document.querySelector<HTMLAnchorElement>(".message-block a");
    expect(inMessage?.textContent).toBe("открыть");
    expect(inMessage?.getAttribute("aria-label")).toBe("Max");
    expect(inMessage?.getAttribute("href")).toBe("https://max.ru/chat");
    expect(document.getElementById("vvsu-tweaks-hide-max")).toBeTruthy();
  });

  it("не удаляет строки профиля с похожими словами", () => {
    document.body.innerHTML = `
      <div class="row mb-2" id="score"><label>Максимальный балл:</label><span>100</span></div>
      <div class="row mb-2" id="imax"><label>Сайт:</label><a href="https://imax.ru/">imax</a></div>
    `;

    hideMax.run();

    expect(document.getElementById("score")).toBeTruthy();
    expect(document.getElementById("imax")).toBeTruthy();
  });

  it("не работает, если фича выключена", () => {
    localStorage.setItem(
      "vvsu-tweaks.settings",
      JSON.stringify({ "hide-max": false }),
    );
    document.body.innerHTML = `<a href="https://max.ru/x">max</a>`;

    hideMax.run();
    expect(document.querySelector("a")?.href).toContain("max.ru");
    expect(document.getElementById("vvsu-tweaks-hide-max")).toBeNull();
  });
});
