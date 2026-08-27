import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { RealDateProvider } from "../ddd/real-date-provider.js";
import { env } from "../framework/config/env.js";
import { IdentityDrizzleRepository } from "./infrastructure/identity.drizzle-repository.js";
import { provisionUser } from "./provision-user.js";

const client = postgres(env.DATABASE_URL);
const identity = new IdentityDrizzleRepository(drizzle(client));

const result = await provisionUser({ identity, dates: new RealDateProvider() });

process.stdout.write(`userId=${result.userId}\n`);
process.stdout.write(`token=${result.token}\n`);

await client.end();
