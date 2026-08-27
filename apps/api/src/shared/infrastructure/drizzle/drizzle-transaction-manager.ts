import { AsyncLocalStorage } from "node:async_hooks";

import { Inject, Injectable } from "@nestjs/common";

import { TransactionManager } from "../../ddd/index.js";
import {
  db,
  type Database,
  type DatabaseExecutor,
  type DatabaseTransaction,
} from "./drizzle.client.js";
import { DRIZZLE_DB } from "./drizzle.module.js";

/**
 * Process-wide so every holder of a `DrizzleTransactionManager` sees the same
 * active transaction, whatever the DI token it was resolved through.
 */
const activeTransaction = new AsyncLocalStorage<DatabaseTransaction>();

/** The client a repository must use: the current transaction when one is open, else the pool. */
export function currentExecutor(): DatabaseExecutor {
  return activeTransaction.getStore() ?? db;
}

@Injectable()
export class DrizzleTransactionManager extends TransactionManager {
  constructor(@Inject(DRIZZLE_DB) private readonly database: Database) {
    super();
  }

  async run<TResult>(work: () => Promise<TResult>): Promise<TResult> {
    if (activeTransaction.getStore() !== undefined) {
      return work();
    }

    return this.database.transaction(async (tx) => activeTransaction.run(tx, work));
  }
}
