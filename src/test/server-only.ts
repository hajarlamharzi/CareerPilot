/**
 * Test substitute for the `server-only` marker package.
 *
 * The real package throws when imported outside a React Server Component graph.
 * Vitest has no such graph, so `vitest.config.mts` aliases the import here. This
 * file must stay empty: it exists only to satisfy the import.
 */

export {};
