import { createStaff, updateStaff } from "./staff";
import type { MutationHandlers } from "./types";

/** Every mutation in src/shared/mutations.ts must have a handler here (TypeScript enforces it). */
export const handlers: MutationHandlers = {
  "staff.create": createStaff,
  "staff.update": updateStaff,
};
