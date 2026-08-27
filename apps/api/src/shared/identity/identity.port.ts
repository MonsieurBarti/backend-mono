export type UserRecord = {
  readonly id: string;
  readonly createdAt: Date;
};

export type PersonalAccessTokenRecord = {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly prefix: string;
  readonly createdAt: Date;
};

/**
 * Kernel identity store. Abstract class so it doubles as the Nest DI token.
 * Not a bounded-context port: this module lives under `shared/identity/`.
 */
export abstract class IdentityRepository {
  abstract provisionUserWithToken(
    user: UserRecord,
    token: PersonalAccessTokenRecord,
  ): Promise<void>;

  abstract findUserIdByTokenHash(tokenHash: string): Promise<string | undefined>;
}
