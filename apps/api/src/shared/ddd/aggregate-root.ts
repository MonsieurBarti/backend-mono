import type { DomainEvent } from "./domain-event.js";

/**
 * Base class for aggregate roots. Holds the domain-minted id and buffers the
 * events raised by behavioral methods until the repository drains them after a
 * successful `save()`.
 */
export abstract class AggregateRoot {
  private readonly _events: DomainEvent[] = [];
  private readonly _id: string;

  protected constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  protected addEvent(event: DomainEvent): void {
    this._events.push(event);
  }

  /**
   * Returns the buffered events and empties the buffer, so a second drain
   * cannot republish the same event.
   */
  pullEvents(): DomainEvent[] {
    const pulled = [...this._events];
    this._events.length = 0;
    return pulled;
  }
}
