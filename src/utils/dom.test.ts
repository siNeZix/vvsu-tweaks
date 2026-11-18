import { describe, expect, it, vi } from "vitest";
import { documentRoot, injectStyle, waitForElement } from "./dom";
import { useCleanDom } from "@/test/helpers";

useCleanDom();

describe("documentRoot", () => {
  it("возвращает <head>, если он есть", () => {
    expect(documentRoot()).toBe(document.head);
  });

  it("без <head> возвращает <html> и не создаёт head/body", () => {
    document.head.remove();
    document.body.remove();

    expect(documentRoot()).toBe(document.documentElement);
    injectStyle(".a{}", "vvsu-test-no-head");

    expect(document.getElementById("vvsu-test-no-head")?.parentElement).toBe(
      document.documentElement,
    );
    expect(document.querySelector("head")).toBeNull();
    expect(document.querySelector("body")).toBeNull();
  });
});

describe("injectStyle", () => {
  it("вставляет style и обновляет по id", () => {
    const first = injectStyle(".a{}", "vvsu-test-style");
    expect(document.getElementById("vvsu-test-style")).toBe(first);
    expect(first.textContent).toBe(".a{}");

    const second = injectStyle(".b{}", "vvsu-test-style");
    expect(second).toBe(first);
    expect(first.textContent).toBe(".b{}");
    expect(document.querySelectorAll("#vvsu-test-style")).toHaveLength(1);
  });

  it("без id каждый раз создаёт новый style", () => {
    injectStyle(".one{}");
    injectStyle(".two{}");
    expect(document.querySelectorAll("style")).toHaveLength(2);
  });
});

describe("waitForElement", () => {
  it("сразу резолвит существующий элемент", async () => {
    document.body.innerHTML = '<div id="ready"></div>';
    const el = await waitForElement("#ready", document, 100);
    expect(el?.id).toBe("ready");
  });

  it("ждёт появления элемента", async () => {
    vi.useFakeTimers();
    const promise = waitForElement<HTMLDivElement>("#late", document, 1000);

    queueMicrotask(() => {
      const el = document.createElement("div");
      el.id = "late";
      document.body.appendChild(el);
    });

    await vi.runAllTimersAsync();
    const found = await promise;
    expect(found?.id).toBe("late");
    vi.useRealTimers();
  });

  it("возвращает null по таймауту", async () => {
    vi.useFakeTimers();
    const promise = waitForElement("#missing", document, 50);
    await vi.advanceTimersByTimeAsync(60);
    expect(await promise).toBeNull();
    vi.useRealTimers();
  });
});
