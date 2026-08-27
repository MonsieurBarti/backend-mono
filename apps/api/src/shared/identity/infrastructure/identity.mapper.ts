import type { PersonalAccessTokenRecord, UserRecord } from "../identity.port.js";
import type { PersonalAccessTokenInsert, UserInsert } from "./identity.schema.js";

export function userToRow(user: UserRecord): UserInsert {
  return {
    id: user.id,
    createdAt: user.createdAt,
  };
}

export function personalAccessTokenToRow(
  token: PersonalAccessTokenRecord,
): PersonalAccessTokenInsert {
  return {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    prefix: token.prefix,
    createdAt: token.createdAt,
  };
}
