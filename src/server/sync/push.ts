import type { BatchItem } from "drizzle-orm/batch";
import { eq } from "drizzle-orm";
import { canRun, isMutationName, mutations, type MutationName } from "@shared/mutations";
import type { MutationEnvelope, MutationResult, PushResponse } from "@shared/sync";
import { DomainError, type AuthedUser, type Db } from "../context";
import { auditLog, mutationsApplied } from "../db/schema";
import { handlers } from "../mutations";
import type { MutationHandler } from "../mutations/types";
import { bumpVersion } from "./version";

/**
 * Applies a device's queued changes in order. Each change is its own transaction:
 * version bump + the handler's writes + the "already applied" marker + audit entry.
 */
export async function push(
  db: Db,
  user: AuthedUser,
  envelopes: MutationEnvelope[],
  now: () => number = Date.now,
): Promise<PushResponse> {
  const results: MutationResult[] = [];
  for (const envelope of envelopes) {
    try {
      results.push(await applyOne(db, user, envelope, now()));
    } catch (err) {
      console.error("push: unexpected error", envelope.name, err);
      return { results, error: "The server couldn't save some changes. They'll be retried." };
    }
  }
  return { results };
}

async function applyOne(
  db: Db,
  user: AuthedUser,
  envelope: MutationEnvelope,
  now: number,
): Promise<MutationResult> {
  const { id, name } = envelope;
  const reject = (error: string): MutationResult => ({ id, status: "rejected", error });

  const seen = await db
    .select({ id: mutationsApplied.id })
    .from(mutationsApplied)
    .where(eq(mutationsApplied.id, id))
    .get();
  if (seen) return { id, status: "duplicate" };

  if (!isMutationName(name)) return reject(`Unknown change "${name}". Update the app.`);
  if (!canRun(name, user.role)) return reject("You don't have permission to make that change.");

  const parsed = mutations[name].args.safeParse(envelope.args);
  if (!parsed.success) return reject(parsed.error.issues[0]?.message ?? "Invalid change.");

  let writes: BatchItem<"sqlite">[];
  try {
    // The registry is typed per name; this is the one place a runtime name meets a handler.
    const handler: MutationHandler<MutationName> = handlers[name];
    writes = await handler({ db, user, args: parsed.data, now });
  } catch (err) {
    if (err instanceof DomainError) return reject(err.message);
    throw err;
  }

  try {
    await db.batch([
      bumpVersion(db),
      ...writes,
      db.insert(mutationsApplied).values({
        id,
        name,
        staffId: user.staffId,
        clientCreatedAt: envelope.createdAt,
        appliedAt: now,
      }),
      db.insert(auditLog).values({
        mutationId: id,
        staffId: user.staffId,
        mutation: name,
        args: JSON.stringify(parsed.data),
        at: now,
      }),
    ]);
  } catch (err) {
    // Another request applied the same mutation between our check and the write.
    if (String(err).includes("mutations_applied.id")) return { id, status: "duplicate" };
    throw err;
  }
  return { id, status: "applied" };
}
