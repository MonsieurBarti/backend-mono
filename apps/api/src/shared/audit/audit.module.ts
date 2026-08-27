import { Global, Module } from "@nestjs/common";

import { IDateProvider } from "../ddd/index.js";
import type { Database } from "../infrastructure/drizzle/drizzle.client.js";
import { DRIZZLE_DB } from "../infrastructure/drizzle/drizzle.module.js";
import { AuditLogRepository } from "./audit.port.js";
import { AuditLogDrizzleRepository } from "./infrastructure/audit-log.drizzle-repository.js";

/**
 * Binds the audit port to its Postgres adapter. Global so a bounded context
 * registers an audit handler without importing this module, and so the kernel
 * never imports a bounded context (docs/adr/007-audit-event-log.md §1).
 *
 * A factory rather than `useClass`: the adapter stays Nest-free, so it takes a
 * plain `Database` instead of carrying `@Injectable()` and `@Inject(DRIZZLE_DB)`
 * decorators down into infrastructure.
 *
 * The in-memory adapter is deliberately not bound. It is kernel code for
 * contract suites and local drivers, never a production binding.
 */
@Global()
@Module({
  providers: [
    {
      provide: AuditLogRepository,
      useFactory: (database: Database, dates: IDateProvider): AuditLogRepository =>
        new AuditLogDrizzleRepository(database, dates),
      inject: [DRIZZLE_DB, IDateProvider],
    },
  ],
  exports: [AuditLogRepository],
})
export class AuditModule {}
