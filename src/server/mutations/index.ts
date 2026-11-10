import { createDiscount, updateDiscount } from "./discounts";
import { createEvent, setPayOverride, setWorking, updateEvent } from "./events";
import { setPay } from "./pay";
import { createStaff, updateStaff } from "./staff";
import type { MutationHandlers } from "./types";

/** Every mutation in src/shared/mutations.ts must have a handler here (TypeScript enforces it). */
export const handlers: MutationHandlers = {
  "staff.create": createStaff,
  "staff.update": updateStaff,
  "pay.set": setPay,
  "event.create": createEvent,
  "event.update": updateEvent,
  "event.setWorking": setWorking,
  "event.setPayOverride": setPayOverride,
  "discount.create": createDiscount,
  "discount.update": updateDiscount,
};
