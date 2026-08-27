import { newUuidV7 } from "./uuid-v7.js";

/**
 * Published Language payload values: primitives, ISO date strings, plain
 * records and arrays of the same. No `Date`, no class instances, no functions.
 */
export type DomainEventPayloadValue =
  | string
  | number
  | boolean
  | null
  | readonly DomainEventPayloadValue[]
  | { readonly [key: string]: DomainEventPayloadValue };

export type DomainEventPayload = {
  readonly [key: string]: DomainEventPayloadValue;
};

export type DomainEventProps<Payload extends DomainEventPayload> = {
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Payload;
};

/**
 * Base class for domain events. `occurredAt` is required: the domain never
 * calls `new Date()`, so the caller supplies it from `IDateProvider`.
 *
 * Concrete events name themselves `{Aggregate}{Verb}Event` through `type`.
 */
export abstract class DomainEvent<Payload extends DomainEventPayload = DomainEventPayload> {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Payload;

  protected constructor(props: DomainEventProps<Payload>) {
    this.eventId = newUuidV7();
    this.aggregateId = props.aggregateId;
    this.occurredAt = props.occurredAt;
    this.payload = props.payload;
  }

  /**
   * Stable event name, `{Aggregate}{Verb}Event`.
   */
  abstract get type(): string;
}
