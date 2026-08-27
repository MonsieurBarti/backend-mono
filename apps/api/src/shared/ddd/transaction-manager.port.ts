/**
 * Unit-of-work port. The adapter lives in infrastructure and wraps the database
 * transaction; domain and application never see the database client.
 *
 * Abstract class so it doubles as the Nest DI token.
 */
export abstract class TransactionManager {
  abstract run<TResult>(work: () => Promise<TResult>): Promise<TResult>;
}
