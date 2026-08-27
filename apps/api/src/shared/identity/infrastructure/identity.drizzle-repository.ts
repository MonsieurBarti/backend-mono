import { eq } from "drizzle-orm";

import type { Database } from "../../infrastructure/drizzle/drizzle.client.js";
import {
  IdentityRepository,
  type PersonalAccessTokenRecord,
  type UserRecord,
} from "../identity.port.js";
import { personalAccessTokenToRow, userToRow } from "./identity.mapper.js";
import { personalAccessTokens, users } from "./identity.schema.js";

/**
 * Postgres adapter for kernel identity. Nest-free: `IdentityModule` wires it
 * through a factory.
 */
export class IdentityDrizzleRepository extends IdentityRepository {
  constructor(private readonly database: Database) {
    super();
  }

  async provisionUserWithToken(user: UserRecord, token: PersonalAccessTokenRecord): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.insert(users).values(userToRow(user));
      await tx.insert(personalAccessTokens).values(personalAccessTokenToRow(token));
    });
  }

  async findUserIdByTokenHash(tokenHash: string): Promise<string | undefined> {
    const rows = await this.database
      .select({ userId: personalAccessTokens.userId })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.tokenHash, tokenHash))
      .limit(1);

    return rows[0]?.userId;
  }
}
