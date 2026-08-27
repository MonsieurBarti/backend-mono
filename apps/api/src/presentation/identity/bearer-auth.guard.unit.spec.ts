import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { CLS_ACTOR_ID, CLS_ACTOR_TYPE, type AppClsStore } from "../../shared/cls/cls-store.js";
import { hashPersonalAccessToken } from "../../shared/identity/personal-access-token.js";
import { provisionUser } from "../../shared/identity/provision-user.js";
import { InMemoryIdentityRepository } from "../../shared/identity/testing/in-memory-identity-repository.js";
import { UnauthenticatedError } from "../../shared/identity/unauthenticated.error.js";
import { FakeDateProvider } from "../../shared/ddd/testing/fake-date-provider.js";
import { BearerAuthGuard, type AuthenticatedRequest } from "./bearer-auth.guard.js";

class RecordingCls {
  readonly store: Partial<AppClsStore> = {};

  set<Key extends keyof AppClsStore>(key: Key, value: AppClsStore[Key]): void {
    this.store[key] = value;
  }
}

function httpContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("BearerAuthGuard", () => {
  it("should allow an unauthenticated health request when the path is not v1", async () => {
    const guard = new BearerAuthGuard(
      new InMemoryIdentityRepository(),
      new RecordingCls() as never,
    );
    const request: AuthenticatedRequest = { url: "/health", headers: {} };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(request.actor).toBeUndefined();
  });

  it("should throw UnauthenticatedError when a v1 request has no bearer", async () => {
    const guard = new BearerAuthGuard(
      new InMemoryIdentityRepository(),
      new RecordingCls() as never,
    );

    const missingError = await guard
      .canActivate(httpContext({ url: "/v1/me", headers: {} }))
      .catch((error: unknown) => error);
    const unknownError = await guard
      .canActivate(
        httpContext({ url: "/v1/me", headers: { authorization: "Bearer unknown-token" } }),
      )
      .catch((error: unknown) => error);

    expect(missingError).toBeInstanceOf(UnauthenticatedError);
    expect(unknownError).toBeInstanceOf(UnauthenticatedError);
    if (
      missingError instanceof UnauthenticatedError &&
      unknownError instanceof UnauthenticatedError
    ) {
      expect(missingError.detail).toBe(unknownError.detail);
      expect(missingError.type).toBe("https://problems.monsieurbarti.dev/unauthenticated");
      expect(missingError.status).toBe(401);
    }
  });

  it("should set the request actor when a v1 request carries a provisioned PAT", async () => {
    const identity = new InMemoryIdentityRepository();
    const cls = new RecordingCls();
    const { userId, token } = await provisionUser({ identity, dates: new FakeDateProvider() });
    const guard = new BearerAuthGuard(identity, cls as never);
    const request: AuthenticatedRequest = {
      url: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(request.actor).toEqual({ userId });
    expect(cls.store[CLS_ACTOR_ID]).toBe(userId);
    expect(cls.store[CLS_ACTOR_TYPE]).toBe("user");
    expect(hashPersonalAccessToken(token)).toBe(identity.tokens[0]?.tokenHash);
  });
});
