import {
  Catch,
  Inject,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";

import { newUuidV7, PROBLEM_TYPE_BASE_URI } from "../../ddd/index.js";
import { AppLogger } from "../logging/logger.service.js";
import { writeProblem, type ProblemResponseView } from "./problem-document.js";

const INTERNAL_SERVER_ERROR_STATUS = 500;
const INSTANCE_REFERENCE_LENGTH = 6;

/**
 * Last line of defence. Anything that is not a `BaseDomainError` — connection
 * timeout, programming error, unexpected library throw — becomes one generic
 * `500` problem. The original failure stays in the logs only: the client gets
 * `type` plus `instance` and nothing else to correlate with.
 *
 * Registered FIRST so Nest's reverse evaluation order puts it last.
 */
@Injectable()
@Catch()
export class GlobalExceptionCatcherFilter implements ExceptionFilter {
  constructor(@Inject(AppLogger) private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const reference = newUuidV7()
      .replaceAll("-", "")
      .slice(-INSTANCE_REFERENCE_LENGTH)
      .toUpperCase();
    const instance = `${PROBLEM_TYPE_BASE_URI}/instances/IE-${reference}`;

    this.logger.emit("error", "error.unhandled", {
      instance,
      error:
        exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : { value: String(exception) },
    });

    writeProblem(host.switchToHttp().getResponse<ProblemResponseView>(), {
      type: `${PROBLEM_TYPE_BASE_URI}/internal`,
      title: "Internal Server Error",
      status: INTERNAL_SERVER_ERROR_STATUS,
      detail: "Internal server error",
      instance,
    });
  }
}
