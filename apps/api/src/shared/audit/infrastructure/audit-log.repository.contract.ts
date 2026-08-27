import { beforeEach, describe, expect, it } from "vitest";

import { newUuidV7 } from "../../ddd/index.js";
import type { FakeDateProvider } from "../../ddd/testing/fake-date-provider.js";
import type { AuditEntryInput, AuditLogRepository } from "../audit.port.js";

/** Known uuid pair that sorts lexicographically and as Postgres `uuid`. */
const EARLIER_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LATER_EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function anAuditEntryInput(overrides: Partial<AuditEntryInput> = {}): AuditEntryInput {
  return {
    eventId: newUuidV7(),
    eventType: "CampaignArchivedEvent",
    aggregateType: "Campaign",
    aggregateId: newUuidV7(),
    actorId: "user-1",
    actorType: "user",
    occurredAt: new Date("2026-03-15T12:00:00.000Z"),
    payload: { action: "archive" },
    ...overrides,
  };
}

/**
 * Shared `AuditLogRepository` contract. Both adapters call this factory so a
 * port change fails in memory and on Postgres
 * (docs/adr/006-testing-hexagonal-modules.md §5).
 */
export function runAuditLogRepositoryContract(
  factory: () => Promise<{ repo: AuditLogRepository; dates: FakeDateProvider }>,
): void {
  describe("AuditLogRepository contract", () => {
    let repo!: AuditLogRepository;
    let dates!: FakeDateProvider;

    beforeEach(async () => {
      ({ repo, dates } = await factory());
    });

    it("should return the entry from findByAggregate when persist succeeds", async () => {
      const input = anAuditEntryInput();

      await repo.persist(input);
      const found = await repo.findByAggregate(input.aggregateId, { limit: 10 });

      expect(found).toHaveLength(1);
      expect(found[0]?.eventId).toBe(input.eventId);
      expect(found[0]?.aggregateId).toBe(input.aggregateId);
      expect(found[0]?.payload).toEqual({ action: "archive" });
      expect(found[0]?.actorType).toBe("user");
    });

    it("should return the entry from findByActor when persist succeeds", async () => {
      const input = anAuditEntryInput({ actorId: "cron-nightly" });

      await repo.persist(input);
      const found = await repo.findByActor("cron-nightly", { limit: 10 });

      expect(found).toHaveLength(1);
      expect(found[0]?.eventId).toBe(input.eventId);
      expect(found[0]?.actorId).toBe("cron-nightly");
    });

    it("should not return another aggregate's rows when findByAggregate is called", async () => {
      const kept = anAuditEntryInput();
      const other = anAuditEntryInput();

      await repo.persist(kept);
      await repo.persist(other);
      const found = await repo.findByAggregate(kept.aggregateId, { limit: 10 });

      expect(found).toHaveLength(1);
      expect(found[0]?.eventId).toBe(kept.eventId);
    });

    it("should sort by occurredAt ascending then eventId ascending when occurredAt ties", async () => {
      const aggregateId = newUuidV7();
      const tiedOccurredAt = new Date("2026-06-01T00:00:00.000Z");
      const earlierOccurredAt = new Date("2026-05-01T00:00:00.000Z");

      await repo.persist(
        anAuditEntryInput({
          eventId: LATER_EVENT_ID,
          aggregateId,
          occurredAt: tiedOccurredAt,
        }),
      );
      await repo.persist(
        anAuditEntryInput({
          eventId: EARLIER_EVENT_ID,
          aggregateId,
          occurredAt: tiedOccurredAt,
        }),
      );
      await repo.persist(
        anAuditEntryInput({
          aggregateId,
          occurredAt: earlierOccurredAt,
        }),
      );

      const found = await repo.findByAggregate(aggregateId, { limit: 10 });

      expect(found.map((entry) => entry.occurredAt.toISOString())).toEqual([
        "2026-05-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z",
      ]);
      expect(found[1]?.eventId).toBe(EARLIER_EVENT_ID);
      expect(found[2]?.eventId).toBe(LATER_EVENT_ID);
    });

    it("should honor limit and offset when paging findByAggregate", async () => {
      const aggregateId = newUuidV7();
      const first = anAuditEntryInput({
        aggregateId,
        occurredAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      const second = anAuditEntryInput({
        aggregateId,
        occurredAt: new Date("2026-02-02T00:00:00.000Z"),
      });
      const third = anAuditEntryInput({
        aggregateId,
        occurredAt: new Date("2026-02-03T00:00:00.000Z"),
      });

      await repo.persist(first);
      await repo.persist(second);
      await repo.persist(third);

      const firstPage = await repo.findByAggregate(aggregateId, { limit: 2 });
      const secondPage = await repo.findByAggregate(aggregateId, { limit: 2, offset: 2 });

      expect(firstPage.map((entry) => entry.eventId)).toEqual([first.eventId, second.eventId]);
      expect(secondPage.map((entry) => entry.eventId)).toEqual([third.eventId]);
    });

    it("should reject persist when eventId already exists", async () => {
      const input = anAuditEntryInput();

      await repo.persist(input);

      await expect(repo.persist(input)).rejects.toThrow();
    });

    it("should stamp recordedAt from the FakeDateProvider clock when persist runs", async () => {
      const input = anAuditEntryInput({
        occurredAt: new Date("2026-06-15T08:30:00.000Z"),
      });

      await repo.persist(input);
      const found = await repo.findByAggregate(input.aggregateId, { limit: 1 });

      expect(found[0]?.recordedAt.toISOString()).toBe(dates.now().toISOString());
      expect(found[0]?.occurredAt.toISOString()).toBe("2026-06-15T08:30:00.000Z");
      expect(found[0]?.recordedAt.toISOString()).not.toBe(found[0]?.occurredAt.toISOString());
    });

    it("should default version to 1 when version is omitted", async () => {
      const input = anAuditEntryInput();

      await repo.persist(input);
      const found = await repo.findByAggregate(input.aggregateId, { limit: 1 });

      expect(found[0]?.version).toBe(1);
    });

    it("should store metadata as {} when metadata is omitted", async () => {
      const input = anAuditEntryInput();

      await repo.persist(input);
      const found = await repo.findByAggregate(input.aggregateId, { limit: 1 });

      expect(found[0]?.metadata).toEqual({});
    });

    it("should lift correlationId onto the entry when metadata carries it", async () => {
      const correlationId = newUuidV7();
      const input = anAuditEntryInput({ metadata: { correlationId } });

      await repo.persist(input);
      const found = await repo.findByAggregate(input.aggregateId, { limit: 1 });

      expect(found[0]?.correlationId).toBe(correlationId);
    });
  });
}
