import type { DomainEvent } from "../domain-event.js";

/**
 * Standalone test double that records domain events instead of dispatching
 * them. Application tests assert on `captured` or `ofType` without booting the
 * Nest CQRS event bus.
 */
export class CapturingEventEmitter {
  private readonly _captured: DomainEvent[] = [];

  get captured(): readonly DomainEvent[] {
    return this._captured;
  }

  publish(event: DomainEvent): void {
    this._captured.push(event);
  }

  publishAll(events: readonly DomainEvent[]): void {
    this._captured.push(...events);
  }

  clear(): void {
    this._captured.length = 0;
  }

  ofType(type: string): DomainEvent[] {
    return this._captured.filter((event) => event.type === type);
  }
}
