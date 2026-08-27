import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import { CLS_ACTOR_ID, CLS_ACTOR_TYPE, type AppClsStore } from "../../shared/cls/cls-store.js";
import { IdentityRepository } from "../../shared/identity/identity.port.js";
import { hashPersonalAccessToken } from "../../shared/identity/personal-access-token.js";
import type { RequestActor } from "../../shared/identity/request-actor.js";
import { UnauthenticatedError } from "../../shared/identity/unauthenticated.error.js";

type IncomingHeaders = {
  authorization?: string | string[];
};

export type AuthenticatedRequest = {
  url: string;
  path?: string;
  headers: IncomingHeaders;
  actor?: RequestActor;
};

const BEARER_PREFIX = "Bearer ";

function requestPath(request: AuthenticatedRequest): string {
  if (request.path !== undefined) {
    return request.path;
  }
  const [path] = request.url.split("?");
  return path ?? request.url;
}

function isV1Path(path: string): boolean {
  return path === "/v1" || path.startsWith("/v1/");
}

function readBearerSecret(authorization: string | string[] | undefined): string | undefined {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const secret = header.slice(BEARER_PREFIX.length).trim();
  if (secret.length === 0) {
    return undefined;
  }
  return secret;
}

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!isV1Path(requestPath(request))) {
      return true;
    }

    const secret = readBearerSecret(request.headers.authorization);
    if (secret === undefined) {
      throw new UnauthenticatedError();
    }

    const userId = await this.identity.findUserIdByTokenHash(hashPersonalAccessToken(secret));
    if (userId === undefined) {
      throw new UnauthenticatedError();
    }

    this.cls.set(CLS_ACTOR_ID, userId);
    this.cls.set(CLS_ACTOR_TYPE, "user");
    request.actor = { userId };
    return true;
  }
}
