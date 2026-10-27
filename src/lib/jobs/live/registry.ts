import "server-only";

import { AdzunaAdapter } from "./adzuna";
import { JobicyAdapter } from "./jobicy";
import type { JobSourceAdapter } from "./types";

/**
 * The set of live job sources the deployment queries.
 *
 * Kept in its own module so the orchestrator can be tested against fake
 * adapters (the registry is mocked, the rest of the service is real) without
 * pulling in `server-only` provider modules or hitting the network.
 *
 * Order is presentation order; the orchestrator sorts results independently.
 */
export const ADAPTERS: JobSourceAdapter[] = [
  new AdzunaAdapter(),
  new JobicyAdapter(),
];
