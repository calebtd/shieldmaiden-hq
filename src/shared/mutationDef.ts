import type { z } from "zod";
import type { Role } from "./roles";

export interface MutationDefinition<A extends z.ZodType> {
  args: A;
  /** Roles allowed to run this mutation. */
  roles: readonly Role[];
}

/** Declares one mutation (see src/shared/mutations.ts). */
export function define<A extends z.ZodType>(def: MutationDefinition<A>): MutationDefinition<A> {
  return def;
}
