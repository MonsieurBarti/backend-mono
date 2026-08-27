import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../../framework/config/env.js";

/** The connection pool is lazy: postgres.js opens a socket on the first query, never on boot. */
const client = postgres(env.DATABASE_URL);

export const db: PostgresJsDatabase = drizzle(client);

export type Database = PostgresJsDatabase;

/** The client handed to a `db.transaction` callback. */
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** What a repository reads and writes through: the pool, or the current transaction. */
export type DatabaseExecutor = Database | DatabaseTransaction;
