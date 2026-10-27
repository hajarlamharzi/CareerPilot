export { StorageError, isStorageError } from "./errors";
export type { StorageErrorCode } from "./errors";
export { createStorageAdapter } from "./adapter";
export type { StorageAdapter } from "./adapter";
export { cvFileStore } from "./idb";
export {
  DOMAIN_KEYS,
  DOMAIN_SCHEMAS,
  KEY_TO_DOMAIN,
  STORE_DOMAINS,
} from "./keys";
export type { StoreDomain, StoreShape } from "./keys";
export { WorkspaceStore, workspaceStore } from "./service";
export type {
  DomainUsage,
  OrphanUsage,
  StorageIssue,
  StorageUsage,
} from "./service";
export { encodeEnvelope, decodeEnvelope, migrate, MIGRATIONS } from "./envelope";
export type { Envelope, DecodedEnvelope } from "./envelope";
