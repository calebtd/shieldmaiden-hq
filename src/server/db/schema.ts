import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { EventStatus } from "@shared/entities/event";
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

/** Someone's usual pay: one row per person. Per-event changes are on `event_staff`. */
export const payProfiles = sqliteTable(
  "pay_profiles",
  {
    staffId: text("staff_id").primaryKey(),
    hourlyCents: integer("hourly_cents").notNull(),
    commissionBps: integer("commission_bps").notNull(),
    tipShareBps: integer("tip_share_bps").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [index("pay_profiles_version").on(t.version)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    /** "YYYY-MM-DD", the event's local calendar dates. */
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    status: text("status").$type<EventStatus>().notNull().default("planning"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [index("events_version").on(t.version), index("events_start").on(t.startDate)],
);

/** Who's working an event, and pay that differs from their usual there (null = usual). */
export const eventStaff = sqliteTable(
  "event_staff",
  {
    eventId: text("event_id").notNull(),
    staffId: text("staff_id").notNull(),
    working: integer("working", { mode: "boolean" }).notNull(),
    hourlyCents: integer("hourly_cents"),
    commissionBps: integer("commission_bps"),
    tipShareBps: integer("tip_share_bps"),
    note: text("note"),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.staffId] }),
    index("event_staff_version").on(t.version),
  ],
);

export const discountTypes = sqliteTable(
  "discount_types",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").$type<"percent" | "amount">().notNull(),
    percentBps: integer("percent_bps"),
    amountCents: integer("amount_cents"),
    reducesCommission: integer("reduces_commission", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [index("discount_types_version").on(t.version)],
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
