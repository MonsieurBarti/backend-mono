import { IDateProvider } from "../date-provider.js";

/**
 * Instant the clock freezes at when no explicit start is given.
 */
export const FAKE_CLOCK_DEFAULT_INSTANT = "2026-01-01T00:00:00.000Z";

/**
 * Test clock. Frozen until `set` or `advance` moves it, so a test asserts on an
 * exact instant instead of a tolerance window.
 */
export class FakeDateProvider extends IDateProvider {
  private _current: Date;

  constructor(frozenAt: Date = new Date(FAKE_CLOCK_DEFAULT_INSTANT)) {
    super();
    this._current = new Date(frozenAt.getTime());
  }

  now(): Date {
    return new Date(this._current.getTime());
  }

  set(date: Date): void {
    this._current = new Date(date.getTime());
  }

  advance(milliseconds: number): void {
    this._current = new Date(this._current.getTime() + milliseconds);
  }
}
