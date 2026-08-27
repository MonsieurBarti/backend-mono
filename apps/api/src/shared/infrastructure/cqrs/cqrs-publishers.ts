import type {
  AsyncContext,
  ICommand,
  ICommandPublisher,
  IEvent,
  IEventPublisher,
  IQuery,
  IQueryPublisher,
} from "@nestjs/cqrs";

import type { AppLogger } from "../logging/logger.service.js";

/**
 * Nest has no all-command listener, so the bus publishers are the observation
 * point. Every wrapper below forwards to the publisher it replaced: dropping
 * the forward would silently kill handler dispatch — fatally so for events,
 * whose only delivery path is the default publisher's subject.
 *
 * Only the message class name is logged. Never the payload.
 */
export function createLoggingCommandPublisher(
  delegate: ICommandPublisher,
  logger: AppLogger,
): ICommandPublisher {
  return {
    publish(command: ICommand): unknown {
      try {
        const result: unknown = delegate.publish(command);
        logger.emit("info", "command.executed", { command: command.constructor.name });
        return result;
      } catch (error) {
        logger.emit("error", "command.failed", { command: command.constructor.name });
        throw error;
      }
    },
  };
}

/** Query counterpart of {@link createLoggingCommandPublisher}. */
export function createLoggingQueryPublisher(
  delegate: IQueryPublisher,
  logger: AppLogger,
): IQueryPublisher {
  return {
    publish(query: IQuery): unknown {
      try {
        const result: unknown = delegate.publish(query);
        logger.emit("info", "query.executed", { query: query.constructor.name });
        return result;
      } catch (error) {
        logger.emit("error", "query.failed", { query: query.constructor.name });
        throw error;
      }
    },
  };
}

/**
 * Event counterpart. `publishAll` is deliberately not implemented: `EventBus`
 * then falls back to one `publish` per event, which keeps one line per event
 * and matches the default publisher's own behaviour.
 */
export function createLoggingEventPublisher(
  delegate: IEventPublisher,
  logger: AppLogger,
): IEventPublisher {
  return {
    publish(event: IEvent, dispatcherContext?: unknown, asyncContext?: AsyncContext): unknown {
      const result: unknown = delegate.publish(event, dispatcherContext, asyncContext);
      logger.emit("info", "event.published", { event: event.constructor.name });
      return result;
    },
  };
}
