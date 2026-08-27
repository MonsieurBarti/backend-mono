import { Global, Module } from "@nestjs/common";

import { IDateProvider, RealDateProvider, TransactionManager } from "./ddd/index.js";
import { DrizzleTransactionManager } from "./infrastructure/drizzle/drizzle-transaction-manager.js";
import { DrizzleModule } from "./infrastructure/drizzle/drizzle.module.js";

/**
 * Binds the kernel ports every bounded context depends on. Global so a BC module
 * never re-imports it to inject time or transactions.
 */
@Global()
@Module({
  imports: [DrizzleModule],
  providers: [
    { provide: IDateProvider, useClass: RealDateProvider },
    { provide: TransactionManager, useClass: DrizzleTransactionManager },
  ],
  exports: [IDateProvider, TransactionManager],
})
export class KernelModule {}
