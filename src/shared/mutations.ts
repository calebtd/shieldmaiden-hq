import { z } from "zod";
import { staffEmailSchema, staffNameSchema, staffPhoneSchema } from "./entities/staff";
import { idSchema } from "./ids";
import { roleSchema, type Role } from "./roles";

/**
 * Every change to data is a named mutation. The same definition is used by:
 *  - the client, to apply the change locally right away (works offline), and
 *  - the server, to validate, check permissions, and store it.
 *
 * To add one: define it here, then add a server handler (src/server/mutations) and a
 * client applier (src/client/mutations). TypeScript will flag any that are missing.
 */
interface MutationDefinition<A extends z.ZodType> {
  args: A;
  /** Roles allowed to run this mutation. */
  roles: readonly Role[];
}

function define<A extends z.ZodType>(def: MutationDefinition<A>): MutationDefinition<A> {
  return def;
}

const optionalEmail = z.union([z.literal(""), staffEmailSchema]).transform((v) => v || null);
const optionalPhone = z.union([z.literal(""), staffPhoneSchema]).transform((v) => v || null);

export const mutations = {
  "staff.create": define({
    roles: ["owner"],
    args: z.object({
      id: idSchema,
      name: staffNameSchema,
      role: roleSchema,
      email: optionalEmail,
      phone: optionalPhone,
    }),
  }),
  "staff.update": define({
    roles: ["owner"],
    args: z.object({
      id: idSchema,
      name: staffNameSchema.optional(),
      role: roleSchema.optional(),
      active: z.boolean().optional(),
      email: optionalEmail.optional(),
      phone: optionalPhone.optional(),
    }),
  }),
};

export type MutationName = keyof typeof mutations;
export type MutationArgs<N extends MutationName> = z.output<(typeof mutations)[N]["args"]>;
export type MutationInput<N extends MutationName> = z.input<(typeof mutations)[N]["args"]>;

export function isMutationName(name: string): name is MutationName {
  return Object.hasOwn(mutations, name);
}

export function canRun(name: MutationName, role: Role): boolean {
  return mutations[name].roles.includes(role);
}
