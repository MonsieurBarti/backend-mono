import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { Level } from "pino";
import type { Observable } from "rxjs";

import type { AppClsStore } from "../../cls/cls-store.js";
import { AppLogger } from "../logging/logger.service.js";

const CLIENT_ERROR_THRESHOLD = 400;
const SERVER_ERROR_THRESHOLD = 500;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/** Minimal view of the inbound request the canonical line reads. */
interface HttpRequestView {
  method: string;
  url: string;
  originalUrl?: string;
}

/** Minimal view of the outbound response the canonical line reads. */
interface HttpResponseView {
  statusCode: number;
  once(event: "finish", listener: () => void): void;
}

/**
 * Emits exactly one canonical line per HTTP request, keyed by method, path and
 * status code.
 *
 * The line is written on the response `finish` event, not when the handler
 * returns: that is the only moment the real status code is known, so a failure
 * rendered by an exception filter is reported with its final status. CLS is
 * read while the store is still active and the fields are passed explicitly,
 * so the line stays complete even though the emit happens on an I/O callback.
 */
@Injectable()
export class CanonicalLogInterceptor implements NestInterceptor {
  constructor(
    @Inject(AppLogger) private readonly logger: AppLogger,
    @Inject(ClsService) private readonly cls: ClsService<AppClsStore>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestView>();
    const response = http.getResponse<HttpResponseView>();
    const store: Partial<AppClsStore> = this.cls.isActive() ? this.cls.get() : {};
    const startedAt = process.hrtime.bigint();

    response.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MILLISECOND;
      const statusCode = response.statusCode;
      const failed = statusCode >= CLIENT_ERROR_THRESHOLD;
      const level: Level = failed
        ? statusCode >= SERVER_ERROR_THRESHOLD
          ? "error"
          : "warn"
        : "info";

      this.logger.emit(level, failed ? "request.failed" : "request.completed", {
        correlationId: store.correlationId,
        method: request.method,
        path: (request.originalUrl ?? request.url).split("?")[0],
        statusCode,
        duration_ms: Math.round(durationMs),
        status: failed ? "failure" : "success",
        source: store.source,
      });
    });

    return next.handle();
  }
}
