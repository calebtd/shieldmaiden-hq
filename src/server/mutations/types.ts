import type { BatchItem } from "drizzle-orm/batch";
import type { MutationArgs, MutationName } from "@shared/mutations";
import type { AuthedUser, Db } from "../context";

export interface MutationContext<N extends MutationName> {
  db: Db;
  user: AuthedUser;
  args: MutationArgs<N>;
  /** Server time for this write. */
  now: number;
}

/**
 * A handler validates against current data (throwing DomainError if the change isn't
 * allowed) and returns the statements to write. It must not write anything itself:
 * the sync layer runs the statements in one transaction with the version bump.
 * Use `nextVersion` as the `version` of every row written.
 */
export type MutationHandler<N extends MutationName> = (
  ctx: MutationContext<N>,
) => Promise<BatchItem<"sqlite">[]>;

export type MutationHandlers = { [N in MutationName]: MutationHandler<N> };
