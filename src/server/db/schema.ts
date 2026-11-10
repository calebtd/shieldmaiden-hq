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
import type { MenuKind } from "@shared/entities/menu";
import type { TimeKind } from "@shared/entities/time";
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

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<MenuKind>().notNull(),
    name: text("name").notNull(),
    /** Tax-included. 0 when `open_price` (decided at checkout). */
    priceCents: integer("price_cents").notNull(),
    openPrice: integer("open_price", { mode: "boolean" }).notNull().default(false),
    minutes: integer("minutes"),
    description: text("description"),
    /** Skill IDs needed to do it, as a JSON array. */
    skillIds: text("skill_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [index("menu_items_version").on(t.version)],
);

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [index("skills_version").on(t.version)],
);

export const staffSkills = sqliteTable(
  "staff_skills",
  {
    staffId: text("staff_id").notNull(),
    skillId: text("skill_id").notNull(),
    has: integer("has", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.skillId] }),
    index("staff_skills_version").on(t.version),
  ],
);

/** Per-event menu changes: a different price (null = usual) or not offered there. */
export const eventMenu = sqliteTable(
  "event_menu",
  {
    eventId: text("event_id").notNull(),
    menuItemId: text("menu_item_id").notNull(),
    priceCents: integer("price_cents"),
    offered: integer("offered", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.menuItemId] }),
    index("event_menu_version").on(t.version),
  ],
);

/**
 * Time on the clock or on break. Append-only: corrections void an entry and add one
 * that `replaces_id` it. Only `end_at` is filled in place (clock out / end break).
 */
export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    staffId: text("staff_id").notNull(),
    kind: text("kind").$type<TimeKind>().notNull(),
    startAt: integer("start_at").notNull(),
    endAt: integer("end_at"),
    replacesId: text("replaces_id"),
    reason: text("reason"),
    createdBy: text("created_by").notNull(),
    voidedAt: integer("voided_at"),
    voidedBy: text("voided_by"),
    voidReason: text("void_reason"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    index("time_entries_version").on(t.version),
    index("time_entries_staff").on(t.staffId, t.startAt),
    index("time_entries_event").on(t.eventId),
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
