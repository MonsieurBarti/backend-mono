import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

import { ValidationFailedError } from "../../ddd/index.js";

/** Narrowing guard: a bound schema is anything exposing Zod's `safeParse`. */
function isZodSchema(value: unknown): value is ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "safeParse") === "function"
  );
}

/**
 * Global request validation. A DTO opts in by declaring
 * `static readonly schema = z.object({ ... })`; everything else — primitives,
 * unmarked classes, the unmarked health route — passes straight through.
 *
 * A bound schema is fail-loud: the pipe throws `ValidationFailedError` so the
 * RFC 9457 filter chain renders `application/problem+json`. It never throws a
 * Nest `BadRequestException`.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype;
    if (metatype === undefined) {
      return value;
    }

    const schema: unknown = Reflect.get(metatype, "schema");
    if (!isZodSchema(schema)) {
      return value;
    }

    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    throw new ValidationFailedError(
      result.error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
}
