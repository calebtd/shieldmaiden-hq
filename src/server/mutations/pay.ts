import { payProfiles } from "../db/schema";
import { nextVersion } from "../sync/version";
import { requireStaff } from "./guards";
import type { MutationHandler } from "./types";

/**
 * Pay profiles are simple settings (last change wins). History is kept where it
 * matters: an event's rates are snapshotted into its payouts when it's locked.
 */
export const setPay: MutationHandler<"pay.set"> = async ({ db, args, now }) => {
  await requireStaff(db, args.staffId);
  const values = {
    hourlyCents: args.hourlyCents,
    commissionBps: args.commissionBps,
    tipShareBps: args.tipShareBps,
    updatedAt: now,
    version: nextVersion,
  };
  return [
    db
      .insert(payProfiles)
      .values({ staffId: args.staffId, ...values })
      .onConflictDoUpdate({ target: payProfiles.staffId, set: values }),
  ];
};
