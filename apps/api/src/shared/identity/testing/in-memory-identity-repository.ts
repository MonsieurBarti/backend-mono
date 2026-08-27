import {
  IdentityRepository,
  type PersonalAccessTokenRecord,
  type UserRecord,
} from "../identity.port.js";

export class InMemoryIdentityRepository extends IdentityRepository {
  readonly users: UserRecord[] = [];
  readonly tokens: PersonalAccessTokenRecord[] = [];

  async provisionUserWithToken(user: UserRecord, token: PersonalAccessTokenRecord): Promise<void> {
    this.users.push(user);
    this.tokens.push(token);
  }

  async findUserIdByTokenHash(tokenHash: string): Promise<string | undefined> {
    return this.tokens.find((token) => token.tokenHash === tokenHash)?.userId;
  }
}
