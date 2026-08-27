import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import { CommandBus, CqrsModule, EventBus, QueryBus } from "@nestjs/cqrs";

import { KernelLoggingModule } from "../logging/logger.module.js";
import { AppLogger } from "../logging/logger.service.js";
import {
  createLoggingCommandPublisher,
  createLoggingEventPublisher,
  createLoggingQueryPublisher,
} from "./cqrs-publishers.js";

/**
 * Owns `CqrsModule.forRoot()` — which registers itself globally, so
 * `CommandBus`, `QueryBus` and `EventBus` are injectable app-wide — and swaps
 * each bus publisher for a log-then-forward wrapper on init.
 *
 * Wrapping happens in `onModuleInit`, before Nest CQRS registers handlers in
 * its `onApplicationBootstrap` hook, and the buses stay idle until the first
 * `execute` or `publish`.
 */
@Module({
  imports: [CqrsModule.forRoot(), KernelLoggingModule],
})
export class KernelCqrsModule implements OnModuleInit {
  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
    @Inject(EventBus) private readonly eventBus: EventBus,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    this.commandBus.publisher = createLoggingCommandPublisher(
      this.commandBus.publisher,
      this.logger,
    );
    this.queryBus.publisher = createLoggingQueryPublisher(this.queryBus.publisher, this.logger);
    this.eventBus.publisher = createLoggingEventPublisher(this.eventBus.publisher, this.logger);
  }
}
