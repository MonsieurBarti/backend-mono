import type { ClsService } from "nestjs-cls";
import type { ZodType } from "zod";

import type { AppClsStore } from "../cls/cls-store.js";
import type { DomainEvent, DomainEventPayload } from "../ddd/index.js";
import type { AppLogger } from "../infrastructure/logging/logger.service.js";
import type {
  AuditActorType,
  AuditEntryInput,
  AuditLogRepository,
  AuditMetadata,
} from "./audit.port.js";

type MutableAuditMetadata = { -readonly [Key in keyof AuditMetadata]: AuditMetadata[Key] };

/**
 * Base class for the audit handler of one auditable domain event. A bounded
 * context subclasses it, names its `aggregateType`, pins the Zod schema for its
 * payload and says who the actor is; the mapping to `persist()` stays here
 * (docs/adr/007-audit-event-log.md §4).
 *
 * Writes are fire-and-forget after the business `save()`. Neither an invalid
 * payload nor a failed insert throws: the command has already committed, so
 * rethrowing would fail a request over a lost audit row. Both cases log and
 * return (docs/adr/007-audit-event-log.md §7).
 *
 * Nest-agnostic on purpose: the subclass carries the `@EventsHandler` decorator
 * and the `@Injectable()` wiring.
 */
export abstract class AuditEventHandler<E extends DomainEvent> {
  /** Aggregate class name stored on every row this handler writes. */
  protected abstract readonly aggregateType: string;

  /**
   * Validates the event payload before insert. Each auditable event type owns
   * its schema; there is no schemaless write contract
   * (docs/adr/007-audit-event-log.md §6).
   */
  protected abstract readonly payloadSchema: ZodType<DomainEventPayload>;

  /**
   * Actor identity, read from the event only. CLS carries `actorId` and
   * `actorType` for logging, and this base class deliberately never reads them:
   * crons and tests must audit correctly with no store at all, and CLS must not
   * be able to invent an actor.
   */
  protected abstract actorOf(event: E): { actorId: string; actorType: AuditActorType };

  constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly logger: AppLogger,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async handle(event: E): Promise<void> {
    const parsed = this.payloadSchema.safeParse(event.payload);
    if (!parsed.success) {
      this.logger.emit("error", "audit.payload.invalid", {
        eventId: event.eventId,
        eventType: event.type,
        err: parsed.error,
      });
      return;
    }

    const actor = this.actorOf(event);
    const entry: AuditEntryInput = {
      eventId: event.eventId,
      eventType: event.type,
      aggregateType: this.aggregateType,
      aggregateId: event.aggregateId,
      actorId: actor.actorId,
      actorType: actor.actorType,
      occurredAt: event.occurredAt,
      payload: parsed.data,
      metadata: this.metadataFromCls(),
    };

    try {
      await this.auditLogs.persist(entry);
    } catch (err) {
      this.logger.emit("error", "audit.persist.failed", {
        eventId: event.eventId,
        eventType: event.type,
        err,
      });
    }
  }

  /**
   * Technical enrichment only. A missing store yields an empty object rather
   * than throwing: a cron or a test has no CLS and must still audit.
   */
  private metadataFromCls(): AuditMetadata {
    if (!this.cls.isActive()) {
      return {};
    }

    const store: Partial<AppClsStore> = this.cls.get();
    const metadata: MutableAuditMetadata = {};
    if (store.correlationId !== undefined) {
      metadata.correlationId = store.correlationId;
    }
    if (store.ip !== undefined) {
      metadata.ip = store.ip;
    }
    if (store.userAgent !== undefined) {
      metadata.userAgent = store.userAgent;
    }
    if (store.source !== undefined) {
      metadata.source = store.source;
    }
    return metadata;
  }
}
