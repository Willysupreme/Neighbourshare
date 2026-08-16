// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { isLocalDevelopment } from "./isLocalDevelopment";

describe("isLocalDevelopment", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  function setHostname(hostname: string) {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname },
      writable: true,
    });
  }

  it("returns true for localhost", () => {
    setHostname("localhost");
    expect(isLocalDevelopment()).toBe(true);
  });

  it("returns true for 127.0.0.1", () => {
    setHostname("127.0.0.1");
    expect(isLocalDevelopment()).toBe(true);
  });

  it("returns false for the production domain", () => {
    setHostname("neighbourshare.vercel.app");
    expect(isLocalDevelopment()).toBe(false);
  });

  it("returns false for a Vercel preview deployment", () => {
    setHostname("neighbourshare-git-feature-branch.vercel.app");
    expect(isLocalDevelopment()).toBe(false);
  });
});
