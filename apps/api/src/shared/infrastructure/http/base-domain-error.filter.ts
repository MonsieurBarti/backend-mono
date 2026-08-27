import {
  Catch,
  Inject,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";

import { BaseDomainError, ValidationFailedError } from "../../ddd/index.js";
import { AppLogger } from "../logging/logger.service.js";
import {
  writeProblem,
  type ProblemDocument,
  type ProblemResponseView,
} from "./problem-document.js";

const SERVER_ERROR_THRESHOLD = 500;

/**
 * Maps a framework-free domain failure onto RFC 9457. Registered AFTER the
 * catch-all so Nest — which evaluates global filters in reverse registration
 * order — reaches this one first.
 *
 * The server-only `context` goes to the log line, never to the client.
 */
@Injectable()
@Catch(BaseDomainError)
export class BaseDomainErrorFilter implements ExceptionFilter<BaseDomainError> {
  constructor(@Inject(AppLogger) private readonly logger: AppLogger) {}

  catch(exception: BaseDomainError, host: ArgumentsHost): void {
    const problem: ProblemDocument = {
      type: exception.type,
      title: exception.title,
      status: exception.status,
      detail: exception.detail,
      instance: exception.instance,
    };
    if (exception instanceof ValidationFailedError) {
      problem.violations = exception.violations;
    }

    this.logger.emit(
      exception.status >= SERVER_ERROR_THRESHOLD ? "error" : "warn",
      "error.domain",
      {
        type: exception.type,
        status: exception.status,
        instance: exception.instance,
        detail: exception.detail,
        context: exception.context,
      },
    );

    writeProblem(host.switchToHttp().getResponse<ProblemResponseView>(), problem);
  }
}
