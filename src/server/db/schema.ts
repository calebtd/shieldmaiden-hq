import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import type { Role } from "@shared/roles";

/**
 * Every synced table has a `version` column. Each successful write bumps the single
 * counter in `sync_counter` and stamps the rows it touched with the new value, so a
 * device can ask for "everything after version N".
 */
export const syncCounter = sqliteTable("sync_counter", {
  id: integer("id").primaryKey(),
  value: integer("value").notNull(),
});

/** Mutation IDs already applied, so retries from a device are harmless. */
export const mutationsApplied = sqliteTable("mutations_applied", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  staffId: text("staff_id").notNull(),
  clientCreatedAt: integer("client_created_at").notNull(),
  appliedAt: integer("applied_at").notNull(),
});

export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    email: text("email"),
    phone: text("phone"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    uniqueIndex("staff_email_unique")
      .on(t.email)
      .where(sql`email is not null`),
    index("staff_version").on(t.version),
  ],
);

/** Who changed what, for anything that touches data. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mutationId: text("mutation_id").notNull(),
    staffId: text("staff_id").notNull(),
    mutation: text("mutation").notNull(),
    args: text("args").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [index("audit_log_at").on(t.at)],
);

/**
 * Small key/value facts about this database. `epoch` changes whenever the data is wiped
 * (e.g. the nightly demo reset), telling devices to throw away their local copy.
 */
export const serverMeta = sqliteTable("server_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
