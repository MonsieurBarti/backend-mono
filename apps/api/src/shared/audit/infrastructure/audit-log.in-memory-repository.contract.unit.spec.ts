import { FakeDateProvider } from "../../ddd/testing/fake-date-provider.js";
import { AuditLogInMemoryRepository } from "./audit-log.in-memory-repository.js";
import { runAuditLogRepositoryContract } from "./audit-log.repository.contract.js";

runAuditLogRepositoryContract(async () => {
  const dates = new FakeDateProvider();
  const repo = new AuditLogInMemoryRepository(dates);
  return { repo, dates };
});
