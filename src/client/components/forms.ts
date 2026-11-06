import { ZodError } from "zod";

/** Turns a validation error into `{ fieldName: "message" }` for showing next to inputs. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ZodError)) {
    return { _form: err instanceof Error ? err.message : String(err) };
  }
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}
