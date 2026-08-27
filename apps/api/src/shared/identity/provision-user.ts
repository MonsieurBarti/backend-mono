import type { IDateProvider } from "../ddd/date-provider.js";
import { newUuidV7 } from "../ddd/uuid-v7.js";
import type { IdentityRepository } from "./identity.port.js";
import {
  hashPersonalAccessToken,
  mintPersonalAccessToken,
  tokenPrefix,
} from "./personal-access-token.js";

export type ProvisionUserResult = {
  readonly userId: string;
  readonly token: string;
};

export async function provisionUser(input: {
  readonly identity: IdentityRepository;
  readonly dates: IDateProvider;
}): Promise<ProvisionUserResult> {
  const createdAt = input.dates.now();
  const userId = newUuidV7();
  const token = mintPersonalAccessToken();

  await input.identity.provisionUserWithToken(
    { id: userId, createdAt },
    {
      id: newUuidV7(),
      userId,
      tokenHash: hashPersonalAccessToken(token),
      prefix: tokenPrefix(token),
      createdAt,
    },
  );

  return { userId, token };
}
