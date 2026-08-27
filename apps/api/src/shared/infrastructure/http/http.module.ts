import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { KernelLoggingModule } from "../logging/logger.module.js";
import { BaseDomainErrorFilter } from "./base-domain-error.filter.js";
import { CanonicalLogInterceptor } from "./canonical-log.interceptor.js";
import { GlobalExceptionCatcherFilter } from "./global-exception-catcher.filter.js";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

/**
 * Every HTTP edge binding of the kernel: the Zod pipe, the RFC 9457 filter
 * chain and the canonical log line. Importing this module is the whole wiring
 * contract — no `APP_*` provider belongs in `AppModule`.
 *
 * Filter registration order is load-bearing. Nest evaluates global filters in
 * reverse registration order, so the catch-all is registered FIRST and the
 * domain filter SECOND; swapping them would turn every domain problem into a
 * generic 500.
 *
 * Requires a globally registered `ClsService` (`KernelClsModule`).
 */
@Module({
  imports: [KernelLoggingModule],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: GlobalExceptionCatcherFilter },
    { provide: APP_FILTER, useClass: BaseDomainErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: CanonicalLogInterceptor },
  ],
})
export class KernelHttpModule {}
