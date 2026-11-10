import { createDiscount, updateDiscount } from "./discounts";
import { createEvent, setEventMenuItem, setPayOverride, setWorking, updateEvent } from "./events";
import { createMenuItem, updateMenuItem } from "./menu";
import { setPay } from "./pay";
import { createSkill, setStaffSkill, updateSkill } from "./skills";
import { createStaff, updateStaff } from "./staff";
import { addTime, clockIn, clockOut, correctTime, endBreak, startBreak, voidTime } from "./time";
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
  "menu.create": createMenuItem,
  "menu.update": updateMenuItem,
  "skill.create": createSkill,
  "skill.update": updateSkill,
  "staff.setSkill": setStaffSkill,
  "event.setMenuItem": setEventMenuItem,
  "time.clockIn": clockIn,
  "time.clockOut": clockOut,
  "time.startBreak": startBreak,
  "time.endBreak": endBreak,
  "time.add": addTime,
  "time.correct": correctTime,
  "time.void": voidTime,
};
