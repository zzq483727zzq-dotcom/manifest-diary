import { describe, it, expect } from "vitest";
import { getTimeOfDay, greetingText, reflectionSubtitle, themeForTime } from "@/lib/time-greeting";

describe("time-greeting", () => {
  it("classifies morning at 8am", () => {
    expect(getTimeOfDay(new Date("2026-06-16T08:00:00"))).toBe("morning");
  });
  it("classifies noon at 12:30", () => {
    expect(getTimeOfDay(new Date("2026-06-16T12:30:00"))).toBe("noon");
  });
  it("classifies afternoon at 16:00", () => {
    expect(getTimeOfDay(new Date("2026-06-16T16:00:00"))).toBe("afternoon");
  });
  it("classifies evening at 23:00", () => {
    expect(getTimeOfDay(new Date("2026-06-16T23:00:00"))).toBe("evening");
  });
  it("classifies evening at 3am (early morning still evening bucket)", () => {
    expect(getTimeOfDay(new Date("2026-06-16T03:00:00"))).toBe("evening");
  });
  it("returns Chinese greeting text", () => {
    expect(greetingText(new Date("2026-06-16T08:00:00"))).toBe("早安");
    expect(greetingText(new Date("2026-06-16T23:00:00"))).toBe("晚上好");
  });
  it("reflection subtitle is softer at evening", () => {
    expect(reflectionSubtitle(new Date("2026-06-16T23:00:00"))).toContain("接住你");
  });
  it("themeForTime always returns night (no day theme switch per spec)", () => {
    expect(themeForTime("morning")).toBe("night");
    expect(themeForTime("evening")).toBe("night");
  });
});
