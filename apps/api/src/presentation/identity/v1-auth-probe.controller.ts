import { Controller, Get, Req } from "@nestjs/common";

import type { RequestActor } from "../../shared/identity/request-actor.js";
import type { AuthenticatedRequest } from "./bearer-auth.guard.js";

/**
 * Stub `/v1` surface so auth can be proved before BrokerageLink HTTP exists.
 * Delete this controller when BrokerageLink HTTP lands (MON-50).
 */
@Controller("v1")
export class V1AuthProbeController {
  @Get("me")
  getMe(@Req() request: AuthenticatedRequest): RequestActor {
    const actor = request.actor;
    if (actor === undefined) {
      throw new Error("BearerAuthGuard must set request.actor on /v1");
    }
    return actor;
  }
}
