import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { env } from "./shared/framework/config/env.js";
import { AppLogger } from "./shared/infrastructure/logging/logger.service.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLogger));
  await app.listen(env.PORT);
}

await bootstrap();
