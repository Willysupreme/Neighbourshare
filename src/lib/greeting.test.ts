import { describe, it, expect } from "vitest";
import { getTimeBasedGreeting, firstNameOf } from "./greeting";

describe("getTimeBasedGreeting", () => {
  it("says good morning from 5am up to (not including) noon", () => {
    expect(getTimeBasedGreeting(5)).toBe("Good morning");
    expect(getTimeBasedGreeting(9)).toBe("Good morning");
    expect(getTimeBasedGreeting(11)).toBe("Good morning");
  });

  it("says good afternoon from noon up to (not including) 5pm", () => {
    expect(getTimeBasedGreeting(12)).toBe("Good afternoon");
    expect(getTimeBasedGreeting(16)).toBe("Good afternoon");
  });

  it("says good evening from 5pm onward, and before 5am", () => {
    expect(getTimeBasedGreeting(17)).toBe("Good evening");
    expect(getTimeBasedGreeting(22)).toBe("Good evening");
    expect(getTimeBasedGreeting(0)).toBe("Good evening");
    expect(getTimeBasedGreeting(4)).toBe("Good evening");
  });
});

describe("firstNameOf", () => {
  it("returns just the first word of a full name", () => {
    expect(firstNameOf("Wilfred Osei Wilson")).toBe("Wilfred");
  });

  it("handles a single-word name", () => {
    expect(firstNameOf("Ama")).toBe("Ama");
  });

  it("handles extra whitespace", () => {
    expect(firstNameOf("  Kofi   Mensah  ")).toBe("Kofi");
  });
});
