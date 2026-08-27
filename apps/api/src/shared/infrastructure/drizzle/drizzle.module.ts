import { Global, Module } from "@nestjs/common";

import { db, type Database } from "./drizzle.client.js";

/** Nest DI token for the process-wide Drizzle postgres.js client. */
export const DRIZZLE_DB = Symbol("DRIZZLE_DB");

/**
 * Publishes the Drizzle pool as `DRIZZLE_DB`. Global so a BC module never
 * re-imports it to inject the database.
 */
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: (): Database => db,
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DrizzleModule {}
