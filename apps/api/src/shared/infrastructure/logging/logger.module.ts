import { Global, Module } from "@nestjs/common";

import { AppLogger } from "./logger.service.js";

/**
 * Global so any provider can inject `AppLogger` without re-importing, and so
 * `app.get(AppLogger)` resolves for `app.useLogger` during bootstrap.
 *
 * Depends on a globally registered `ClsService` (see `KernelClsModule`).
 */
@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class KernelLoggingModule {}
