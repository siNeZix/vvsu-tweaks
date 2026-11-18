import { describe, expect, it, vi } from "vitest";
import { detectHost, isVvsuHost } from "./host";

describe("detectHost", () => {
  it("распознаёт сервисы ВВГУ", () => {
    expect(detectHost("portal.vvsu.ru")).toBe("portal");
    expect(detectHost("cabinet.vvsu.ru")).toBe("cabinet");
    expect(detectHost("fort.vvsu.ru")).toBe("openid");
    expect(detectHost("www.vvsu.ru")).toBe("www");
    expect(detectHost("vvsu.ru")).toBe("www");
    expect(detectHost("portfolio.vvsu.ru")).toBe("portfolio");
    expect(detectHost("example.com")).toBe("other");
  });

  it("в DEV localhost считает cabinet", () => {
    vi.stubEnv("DEV", true);
    expect(detectHost("localhost")).toBe("cabinet");
    expect(detectHost("127.0.0.1")).toBe("cabinet");
    expect(detectHost("[::1]")).toBe("cabinet");
    expect(detectHost("preview.local")).toBe("cabinet");
  });
});

describe("isVvsuHost", () => {
  it("принимает vvsu.ru и поддомены", () => {
    expect(isVvsuHost("vvsu.ru")).toBe(true);
    expect(isVvsuHost("cabinet.vvsu.ru")).toBe(true);
    expect(isVvsuHost("evil.com")).toBe(false);
    expect(isVvsuHost("notvvsu.ru")).toBe(false);
  });

  it("в DEV принимает локальный preview", () => {
    vi.stubEnv("DEV", true);
    expect(isVvsuHost("localhost")).toBe(true);
  });
});
