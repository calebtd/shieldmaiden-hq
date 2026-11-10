import { z } from "zod";
import { discountNameSchema, discountRuleSchema } from "./entities/discount";
import {
  eventCitySchema,
  eventDays,
  eventNameSchema,
  isoDateSchema,
  MAX_EVENT_DAYS,
  taxRateBpsSchema,
} from "./entities/event";
import { hourlyCentsSchema, percentBpsSchema } from "./entities/money";
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

const eventFields = {
  name: eventNameSchema,
  city: eventCitySchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  /** Sales tax for the event's city. Forms take a percent and convert it. */
  taxRateBps: taxRateBpsSchema,
};

/** End date can't be before the start, and an event can't run longer than a month. */
function checkDates(
  v: { startDate?: string | undefined; endDate?: string | undefined },
  ctx: z.RefinementCtx,
) {
  if (!v.startDate || !v.endDate) return;
  const days = eventDays(v.startDate, v.endDate);
  if (days < 1)
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ends before it starts" });
  else if (days > MAX_EVENT_DAYS) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: `Events can be at most ${MAX_EVENT_DAYS} days. Check the year.`,
    });
  }
}

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

  /** Sets someone's usual pay (replaces what was there). */
  "pay.set": define({
    roles: ["owner"],
    args: z.object({
      staffId: idSchema,
      hourlyCents: hourlyCentsSchema,
      commissionBps: percentBpsSchema,
      tipShareBps: percentBpsSchema,
    }),
  }),

  "event.create": define({
    roles: ["owner"],
    args: z.object({ id: idSchema, ...eventFields }).superRefine(checkDates),
  }),
  /** Both dates are sent together when either changes, so they can be checked as a pair. */
  "event.update": define({
    roles: ["owner"],
    args: z
      .object({
        id: idSchema,
        name: eventFields.name.optional(),
        city: eventFields.city.optional(),
        startDate: eventFields.startDate.optional(),
        endDate: eventFields.endDate.optional(),
        taxRateBps: eventFields.taxRateBps.optional(),
      })
      .refine((v) => (v.startDate === undefined) === (v.endDate === undefined), {
        message: "Send both dates together",
        path: ["endDate"],
      })
      .superRefine(checkDates),
  }),
  /** Puts someone on (or takes them off) an event's crew. */
  "event.setWorking": define({
    roles: ["owner"],
    args: z.object({ eventId: idSchema, staffId: idSchema, working: z.boolean() }),
  }),
  /** Pay for one person at one event that differs from their usual. Null = usual rate. */
  "event.setPayOverride": define({
    roles: ["owner"],
    args: z.object({
      eventId: idSchema,
      staffId: idSchema,
      hourlyCents: hourlyCentsSchema.nullable(),
      commissionBps: percentBpsSchema.nullable(),
      tipShareBps: percentBpsSchema.nullable(),
      note: z
        .string()
        .trim()
        .max(200)
        .transform((v) => v || null)
        .nullable(),
    }),
  }),

  "discount.create": define({
    roles: ["owner"],
    args: z.object({
      id: idSchema,
      name: discountNameSchema,
      rule: discountRuleSchema,
      reducesCommission: z.boolean().default(false),
    }),
  }),
  "discount.update": define({
    roles: ["owner"],
    args: z.object({
      id: idSchema,
      name: discountNameSchema.optional(),
      rule: discountRuleSchema.optional(),
      reducesCommission: z.boolean().optional(),
      active: z.boolean().optional(),
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
