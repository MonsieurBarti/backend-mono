import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { ValidationFailedError } from "../../ddd/index.js";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

class BoundDto {
  static readonly schema = z.object({
    name: z.string(),
    address: z.object({
      city: z.string(),
    }),
  });
}

class UnmarkedDto {}

describe("ZodValidationPipe", () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe();
  });

  it("should return the original value when metatype is undefined", () => {
    const value = { raw: true };

    const result = pipe.transform(value, { type: "body" });

    expect(result).toBe(value);
  });

  it("should return the original value when the class has no schema", () => {
    const value = { raw: true };

    const result = pipe.transform(value, { type: "body", metatype: UnmarkedDto });

    expect(result).toBe(value);
  });

  it("should return parsed data when the bound schema accepts the value", () => {
    const value = { name: "Ada", address: { city: "Paris" }, extra: true };

    const result = pipe.transform(value, { type: "body", metatype: BoundDto });

    expect(result).toEqual({ name: "Ada", address: { city: "Paris" } });
    expect(result).not.toBe(value);
  });

  it("should throw ValidationFailedError when the bound schema rejects the value", () => {
    const value = { name: 1, address: { city: 2 } };
    const parsed = BoundDto.schema.safeParse(value);
    if (parsed.success) {
      throw new Error("expected bound schema to reject the value");
    }

    let thrown: unknown;
    try {
      pipe.transform(value, { type: "body", metatype: BoundDto });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ValidationFailedError);
    if (!(thrown instanceof ValidationFailedError)) {
      throw new Error("expected ValidationFailedError");
    }
    expect(thrown.violations).toEqual(
      parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
    expect(thrown.violations.map((violation) => violation.field)).toEqual(["name", "address.city"]);
  });
});
