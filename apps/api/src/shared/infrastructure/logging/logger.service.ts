import { Inject, Injectable, type LoggerService } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import type { Level, Logger } from "pino";

import type { AppClsStore } from "../../cls/cls-store.js";
import { createRootLogger, type LogBindings } from "./root-logger.js";

/**
 * The only logger in the process. Exposes two surfaces:
 *
 * - `emit`, the application surface: a dotted event name plus structured
 *   fields, enriched from CLS.
 * - the Nest `LoggerService` methods, so framework output goes through the same
 *   pino instance once `app.useLogger` is called.
 *
 * The domain layer never logs; only presentation, application and
 * infrastructure hold a reference to this class.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly root: Logger;

  constructor(@Inject(ClsService) private readonly cls: ClsService<AppClsStore>) {
    this.root = createRootLogger(() => this.correlationBindings());
  }

  /**
   * Emits one structured line. `event` is a stable dotted name
   * (`request.completed`, `command.executed`) and carries no interpolation.
   */
  emit(level: Level, event: string, fields: LogBindings = {}): void {
    this.root[level](fields, event);
  }

  log(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("info", message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("error", message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("warn", message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("debug", message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("trace", message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.writeFrameworkLine("fatal", message, params);
  }

  /**
   * Nest hands us a sentence plus an optional trailing context string. Those
   * lines keep their sentence `msg`; only application events are dotted.
   */
  private writeFrameworkLine(level: Level, message: unknown, params: unknown[]): void {
    const last = params.at(-1);
    const fields: LogBindings = { logger: "nest" };
    if (typeof last === "string") {
      fields.context = last;
    }
    this.root[level](fields, typeof message === "string" ? message : JSON.stringify(message));
  }

  /** CLS enrichment. A missing store yields no fields rather than throwing. */
  private correlationBindings(): LogBindings {
    if (!this.cls.isActive()) {
      return {};
    }
    const store: Partial<AppClsStore> = this.cls.get();
    const bindings: LogBindings = {};
    if (store.correlationId !== undefined) {
      bindings.correlationId = store.correlationId;
    }
    if (store.actorId !== undefined) {
      bindings.actorId = store.actorId;
    }
    if (store.source !== undefined) {
      bindings.source = store.source;
    }
    return bindings;
  }
}
