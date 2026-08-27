import { Module } from "@nestjs/common";
import { ClsModule, type ClsService } from "nestjs-cls";

import { CLS_CORRELATION_ID, CLS_IP, CLS_SOURCE, CLS_USER_AGENT } from "./cls-store.js";
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_RESPONSE_HEADER,
  resolveCorrelationId,
} from "./correlation-id.js";

/** Minimal view of the inbound request the middleware reads. */
interface ClsRequestView {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/** Minimal view of the outbound response the middleware writes. */
interface ClsResponseView {
  setHeader(name: string, value: string): void;
}

/**
 * Fills the request scoped store and echoes the correlation id. Runs inside the
 * `nestjs-cls` middleware, before guards, interceptors and controllers.
 */
function setupClsStore(cls: ClsService, req: ClsRequestView, res: ClsResponseView): void {
  const inbound = req.headers[CORRELATION_ID_HEADER];
  const correlationId = resolveCorrelationId(Array.isArray(inbound) ? inbound[0] : inbound);
  const userAgent = req.headers["user-agent"];

  cls.set(CLS_CORRELATION_ID, correlationId);
  cls.set(CLS_SOURCE, "api");
  cls.set(CLS_IP, req.ip);
  cls.set(CLS_USER_AGENT, Array.isArray(userAgent) ? userAgent[0] : userAgent);

  res.setHeader(CORRELATION_ID_RESPONSE_HEADER, correlationId);
}

/**
 * Root CLS registration. Global so every provider can inject `ClsService`
 * without importing a feature module, and mounted as middleware so the store
 * covers the whole HTTP lifecycle.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, setup: setupClsStore },
    }),
  ],
  exports: [ClsModule],
})
export class KernelClsModule {}
