/**
 * Clock port. Domain code and command handlers inject this instead of calling
 * `new Date()`.
 *
 * Abstract class so it doubles as the Nest DI token.
 */
export abstract class IDateProvider {
  abstract now(): Date;
}
