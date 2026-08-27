import { IDateProvider } from "./date-provider.js";

/**
 * Production clock. Not decorated: the kernel folder stays framework-free, so
 * the binding `{ provide: IDateProvider, useClass: RealDateProvider }` lives in
 * the wiring module.
 */
export class RealDateProvider extends IDateProvider {
  now(): Date {
    return new Date();
  }
}
