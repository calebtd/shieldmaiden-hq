import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Role } from "@shared/roles";
import type { Config } from "./config";
import * as schema from "./db/schema";

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

export interface AuthedUser {
  staffId: string;
  name: string;
  role: Role;
}

/** Hono typing: what every request handler can read from `c.env` and `c.var`. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    config: Config;
    db: Db;
    user: AuthedUser;
  };
}

/** A problem the person can fix (bad input, not allowed). Shown to them as-is. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
