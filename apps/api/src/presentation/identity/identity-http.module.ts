import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { BearerAuthGuard } from "./bearer-auth.guard.js";
import { V1AuthProbeController } from "./v1-auth-probe.controller.js";

/**
 * Presentation binding for bearer auth. The guard covers `/v1/*` only.
 * Health stays unauthenticated because it is not under `/v1`.
 */
@Module({
  controllers: [V1AuthProbeController],
  providers: [{ provide: APP_GUARD, useClass: BearerAuthGuard }],
})
export class IdentityHttpModule {}
