import type { AggregateRoot } from "./aggregate-root.js";

/**
 * Write-side repository contract. Abstract class so it doubles as the Nest DI
 * token; each aggregate extends it with its own write-side methods.
 *
 * `findById` returns `null` for absence. The command handler decides whether
 * absence is a domain error.
 */
export abstract class RepositoryPort<Entity extends AggregateRoot> {
  abstract save(entity: Entity): Promise<void>;
  abstract findById(id: string): Promise<Entity | null>;
  abstract findAll(): Promise<Entity[]>;
  abstract delete(id: string): Promise<void>;
}
