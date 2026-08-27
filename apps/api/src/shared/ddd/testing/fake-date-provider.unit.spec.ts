import { describe, expect, it } from "vitest";

import { FAKE_CLOCK_DEFAULT_INSTANT, FakeDateProvider } from "./fake-date-provider.js";

const ONE_AND_A_HALF_SECONDS_MS = 1500;

describe("FakeDateProvider", () => {
  it("should freeze at FAKE_CLOCK_DEFAULT_INSTANT when constructed with no argument", () => {
    const clock = new FakeDateProvider();

    expect(clock.now().toISOString()).toBe(FAKE_CLOCK_DEFAULT_INSTANT);
  });

  it("should return a Date equal to the frozen instant but not the same reference when now is called", () => {
    const clock = new FakeDateProvider();

    const first = clock.now();
    expect(first.toISOString()).toBe(FAKE_CLOCK_DEFAULT_INSTANT);

    first.setUTCFullYear(1999);
    const second = clock.now();

    expect(second).not.toBe(first);
    expect(second.toISOString()).toBe(FAKE_CLOCK_DEFAULT_INSTANT);
  });

  it("should move the clock to that instant when set is called", () => {
    const clock = new FakeDateProvider();
    const next = new Date("2026-06-15T12:30:00.000Z");

    clock.set(next);

    expect(clock.now().toISOString()).toBe("2026-06-15T12:30:00.000Z");
  });

  it("should add milliseconds when advance is called", () => {
    const clock = new FakeDateProvider();

    clock.advance(ONE_AND_A_HALF_SECONDS_MS);

    expect(clock.now().getTime()).toBe(
      new Date(FAKE_CLOCK_DEFAULT_INSTANT).getTime() + ONE_AND_A_HALF_SECONDS_MS,
    );
  });
});
