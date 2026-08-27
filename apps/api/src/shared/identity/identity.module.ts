import { Global, Module } from "@nestjs/common";

import type { Database } from "../infrastructure/drizzle/drizzle.client.js";
import { DRIZZLE_DB } from "../infrastructure/drizzle/drizzle.module.js";
import { IdentityRepository } from "./identity.port.js";
import { IdentityDrizzleRepository } from "./infrastructure/identity.drizzle-repository.js";

/**
 * Binds the identity port to its Postgres adapter. Global so the presentation
 * guard injects it without a feature-module import cycle.
 *
 * A factory rather than `useClass`: the adapter stays Nest-free.
 */
@Global()
@Module({
  providers: [
    {
      provide: IdentityRepository,
      useFactory: (database: Database): IdentityRepository =>
        new IdentityDrizzleRepository(database),
      inject: [DRIZZLE_DB],
    },
  ],
  exports: [IdentityRepository],
})
export class IdentityModule {}
