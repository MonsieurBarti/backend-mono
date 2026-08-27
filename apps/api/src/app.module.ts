import { Module } from "@nestjs/common";

import { HealthModule } from "./presentation/health/health.module.js";
import { AuditModule } from "./shared/audit/audit.module.js";
import { KernelClsModule } from "./shared/cls/cls.module.js";
import { KernelCqrsModule } from "./shared/infrastructure/cqrs/cqrs.module.js";
import { KernelHttpModule } from "./shared/infrastructure/http/http.module.js";
import { KernelLoggingModule } from "./shared/infrastructure/logging/logger.module.js";
import { KernelModule } from "./shared/kernel.module.js";

@Module({
  imports: [
    KernelClsModule,
    KernelLoggingModule,
    KernelCqrsModule,
    KernelHttpModule,
    KernelModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
